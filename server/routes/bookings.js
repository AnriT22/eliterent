const express = require('express');
const { getDB, saveDB } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { queryAll, queryOne, execute } = require('../db-helpers');

const WEBSITE_FEE_PERCENT = 0.30;

const router = express.Router();

function parseUtcDate(dateStr) {
    return new Date(dateStr + 'T00:00:00Z');
}

function daysBetween(startStr, endStr) {
    var s = parseUtcDate(startStr);
    var e = parseUtcDate(endStr);
    return Math.max(1, Math.round((e - s) / 86400000));
}

function eachBookingDate(startStr, endStr, cb) {
    var cur = parseUtcDate(startStr);
    var end = parseUtcDate(endStr);
    while (cur <= end) {
        cb(cur);
        cur.setUTCDate(cur.getUTCDate() + 1);
    }
}

function formatDateUtc(date) {
    return date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0') + '-' + String(date.getUTCDate()).padStart(2, '0');
}

function blockDatesForBooking(vehicleId, startStr, endStr) {
    var db = getDB();
    eachBookingDate(startStr, endStr, function(date) {
        var dateStr = formatDateUtc(date);
        var existing = queryOne('SELECT id FROM vehicle_availability WHERE vehicle_id = ? AND date = ?', [vehicleId, dateStr]);
        if (existing) {
            db.run('UPDATE vehicle_availability SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE vehicle_id = ? AND date = ?', ['booked', vehicleId, dateStr]);
        } else {
            db.run('INSERT INTO vehicle_availability (vehicle_id, date, status) VALUES (?, ?, ?)', [vehicleId, dateStr, 'booked']);
        }
    });
    saveDB();
}

function unblockDatesForBooking(vehicleId, startStr, endStr) {
    var db = getDB();
    eachBookingDate(startStr, endStr, function(date) {
        var dateStr = formatDateUtc(date);
        db.run("DELETE FROM vehicle_availability WHERE vehicle_id = ? AND date = ? AND status = 'booked'", [vehicleId, dateStr]);
    });
    saveDB();
}

function parseJsonArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
        var parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function normalizeVehicleServices(vehicle) {
    // New structure: extras is a JSON object with named keys
    var ext = vehicle.extras;
    if (typeof ext === 'string') { try { ext = JSON.parse(ext); } catch(e) { ext = {}; } }
    ext = ext || {};

    var EXTRA_DEFS = [
        { code: 'child_seat', key: 'child_seat', name: 'Child Seat (up to 5 years)', perDay: true },
        { code: 'snow_chains', key: 'snow_chains', name: 'Snow Chains', perDay: false },
        { code: 'roof_rack', key: 'roof_rack', name: 'Roof Luggage Carrier', perDay: true },
        { code: 'third_driver', key: 'third_driver', name: 'Additional Driver', perDay: true }
    ];

    var services = [];
    EXTRA_DEFS.forEach(function(def) {
        var price = parseFloat(ext[def.key]);
        if (price > 0 || ext[def.key] === 0 || ext[def.key] === '0') {
            services.push({ code: def.code, name: def.name, price: price || 0, perDay: def.perDay });
        }
    });

    // Backward compat: fall back to old extra_services array
    if (services.length === 0) {
        var old = parseJsonArray(vehicle.extra_services);
        old.filter(function(item) { return item && item.enabled !== false; }).forEach(function(item) {
            services.push({
                code: item.code || item.id || item.name,
                name: item.name || 'Extra Service',
                price: parseFloat(item.price) || 0,
                perDay: (item.code || item.id || item.name) === 'additional_driver'
            });
        });
    }

    return services.filter(function(item) { return !!item.code; });
}

function buildSelectedExtras(vehicleServices, selectedExtras) {
    var selectedCodes = Array.isArray(selectedExtras) ? selectedExtras : [];
    return vehicleServices.filter(function(service) {
        return selectedCodes.indexOf(service.code) !== -1;
    });
}

function getDailyRateByTier(vehicle, days, pickupDate) {
    // Check custom date-based pricing first
    if (vehicle.custom_pricing_enabled) {
        var ranges = vehicle.custom_pricing_ranges;
        if (typeof ranges === 'string') { try { ranges = JSON.parse(ranges); } catch(e) { ranges = []; } }
        if (Array.isArray(ranges) && ranges.length > 0) {
            for (var i = 0; i < ranges.length; i++) {
                var r = ranges[i];
                if (r.start && r.end && pickupDate >= r.start && pickupDate <= r.end) {
                    return parseFloat(r.price) || 0;
                }
            }
        }
    }

    var pt = vehicle.price_tiers;
    if (typeof pt === 'string') { try { pt = JSON.parse(pt); } catch(e) { pt = {}; } }
    pt = pt || {};
    var fallback = parseFloat(vehicle.price_per_day) || 0;
    if (days <= 3 && pt.price_1_3 > 0) return parseFloat(pt.price_1_3);
    if (days <= 7 && pt.price_4_7 > 0) return parseFloat(pt.price_4_7);
    if (days <= 14 && pt.price_8_14 > 0) return parseFloat(pt.price_8_14);
    if (days <= 30 && pt.price_15_30 > 0) return parseFloat(pt.price_15_30);
    return fallback;
}

router.post('/', authenticateToken, requireRole('guest'), async (req, res) => {
    try {
        var body = req.body || {};
        var vehicle_id = body.vehicle_id;
        var pickup_date = body.pickup_date;
        var dropoff_date = body.dropoff_date;
        var pickup_location = body.pickup_location;
        var dropoff_location = body.dropoff_location;
        var guest_notes = body.guest_notes;
        var selected_extras = body.selected_extras;
        var pickup_time = body.pickup_time || '10:00';
        var dropoff_time = body.dropoff_time || '10:00';
        var location_fee = Math.round((parseFloat(body.location_fee) || 0) * 100) / 100;

        if (!vehicle_id || !pickup_date || !dropoff_date) {
            return res.status(400).json({ error: 'vehicle_id, pickup_date and dropoff_date are required' });
        }

        var dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(pickup_date) || !dateRegex.test(dropoff_date)) {
            return res.status(400).json({ error: 'Dates must be YYYY-MM-DD format' });
        }
        if (pickup_date >= dropoff_date) {
            return res.status(400).json({ error: 'dropoff_date must be after pickup_date' });
        }

        var vehicle = queryOne(
            `SELECT v.*, pp.company_name FROM vehicles v
             LEFT JOIN partner_profiles pp ON v.partner_id = pp.user_id
             WHERE v.id = ? AND v.status = 'active'`,
            [vehicle_id]
        );
        if (!vehicle) return res.status(404).json({ error: 'Vehicle not found or inactive' });

        var conflicts = queryAll(
            `SELECT date FROM vehicle_availability
             WHERE vehicle_id = ? AND date >= ? AND date < ? AND status IN ('blocked', 'booked')`,
            [vehicle_id, pickup_date, dropoff_date]
        );
        if (conflicts.length > 0) {
            return res.status(409).json({
                error: 'Vehicle is not available for the selected dates',
                conflicting_dates: conflicts.map(function(r) { return r.date; })
            });
        }

        var overlapBooking = queryOne(
            `SELECT id FROM bookings
             WHERE vehicle_id = ?
             AND status IN ('pending', 'accepted', 'completed', 'cancel_requested')
             AND pickup_date <= ?
             AND dropoff_date >= ?`,
            [vehicle_id, dropoff_date, pickup_date]
        );
        if (overlapBooking) {
            return res.status(409).json({ error: 'Vehicle already has an overlapping reservation for these dates' });
        }

        var days = daysBetween(pickup_date, dropoff_date);
        var dailyPrice = getDailyRateByTier(vehicle, days, pickup_date);
        var rentalTotal = Math.round(days * dailyPrice * 100) / 100;
        var vehicleServices = normalizeVehicleServices(vehicle);
        var chosenExtras = buildSelectedExtras(vehicleServices, selected_extras);
        var extrasTotal = Math.round(chosenExtras.reduce(function(sum, extra) {
            var price = parseFloat(extra.price) || 0;
            return sum + (extra.perDay ? price * days : price);
        }, 0) * 100) / 100;
        var serviceFee = Math.round(dailyPrice * WEBSITE_FEE_PERCENT * 100) / 100;
        var total_price = Math.round((rentalTotal + extrasTotal + location_fee) * 100) / 100;

        execute(
            `INSERT INTO bookings
             (guest_id, vehicle_id, partner_id, pickup_date, dropoff_date, pickup_time, dropoff_time, rental_days,
              pickup_location, dropoff_location, extras_json, extras_total, location_fee, service_fee,
              total_price, status, guest_notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
            [
                req.user.id,
                vehicle_id,
                vehicle.partner_id,
                pickup_date,
                dropoff_date,
                pickup_time,
                dropoff_time,
                days,
                pickup_location || null,
                dropoff_location || null,
                JSON.stringify(chosenExtras),
                extrasTotal,
                location_fee,
                serviceFee,
                total_price,
                guest_notes || null
            ]
        );

        // Block dates immediately so partner can see them in calendar
        blockDatesForBooking(vehicle_id, pickup_date, dropoff_date);

        var booking = queryOne(
            'SELECT id FROM bookings WHERE guest_id = ? AND vehicle_id = ? AND pickup_date = ? ORDER BY id DESC',
            [req.user.id, vehicle_id, pickup_date]
        );

        // Notify partner about new booking
        try {
            var partnerInfo = queryOne(
                `SELECT u.email, u.full_name, pp.company_name
                 FROM users u LEFT JOIN partner_profiles pp ON u.id = pp.user_id
                 WHERE u.id = ?`, [vehicle.partner_id]
            );
            if (partnerInfo && partnerInfo.email) {
                var { sendEmail } = require('../mailer');
                var guestUser = queryOne('SELECT full_name FROM users WHERE id = ?', [req.user.id]);
                await sendEmail({
                    to: partnerInfo.email,
                    subject: 'New Booking Request — ' + vehicle.name,
                    text: 'Hello ' + (partnerInfo.company_name || partnerInfo.full_name || 'Partner') + ',\n\nYou have a new booking request:\n\nVehicle: ' + vehicle.name + '\nGuest: ' + (guestUser ? guestUser.full_name : 'Guest') + '\nDates: ' + pickup_date + ' → ' + dropoff_date + '\nTotal: $' + total_price.toFixed(2) + '\n\nPlease review and accept/reject in your dashboard.\n\nEliterent.ge',
                    html: '<p>Hello ' + (partnerInfo.company_name || partnerInfo.full_name || 'Partner') + ',</p><p>You have a new booking request:</p><ul><li><strong>Vehicle:</strong> ' + vehicle.name + '</li><li><strong>Guest:</strong> ' + (guestUser ? guestUser.full_name : 'Guest') + '</li><li><strong>Dates:</strong> ' + pickup_date + ' → ' + dropoff_date + '</li><li><strong>Total:</strong> $' + total_price.toFixed(2) + '</li></ul><p>Please review and accept/reject in your dashboard.</p><p>Eliterent.ge</p>'
                });
            }
        } catch (emailErr) {
            console.error('New booking notification email error:', emailErr.message);
        }

        res.status(201).json({
            message: 'Booking created successfully',
            booking_id: booking.id,
            total_price: total_price,
            rental_days: days,
            extras_total: extrasTotal,
            service_fee: serviceFee,
            status: 'pending'
        });
    } catch (err) {
        console.error('Create booking error:', err);
        res.status(500).json({ error: 'Failed to create booking' });
    }
});

router.get('/my', authenticateToken, requireRole('guest'), (req, res) => {
    try {
        var bookings = queryAll(
            `SELECT b.*, v.name as vehicle_name, v.image_url, v.price_per_day,
                    v.category, v.year, pp.company_name as partner_company
             FROM bookings b
             JOIN vehicles v ON b.vehicle_id = v.id
             LEFT JOIN partner_profiles pp ON b.partner_id = pp.user_id
             WHERE b.guest_id = ?
             ORDER BY b.created_at DESC`,
            [req.user.id]
        );
        res.json({ bookings: bookings });
    } catch (err) {
        console.error('Get my bookings error:', err);
        res.status(500).json({ error: 'Failed to get bookings' });
    }
});

router.get('/partner', authenticateToken, requireRole('partner'), (req, res) => {
    try {
        var bookings = queryAll(
            `SELECT b.*, v.name as vehicle_name, v.image_url, v.price_per_day,
                    u.full_name as guest_name, u.email as guest_email, u.phone as guest_phone
             FROM bookings b
             JOIN vehicles v ON b.vehicle_id = v.id
             JOIN users u ON b.guest_id = u.id
             WHERE b.partner_id = ?
             ORDER BY b.created_at DESC`,
            [req.user.id]
        );
        res.json({ bookings: bookings });
    } catch (err) {
        console.error('Get partner bookings error:', err);
        res.status(500).json({ error: 'Failed to get bookings' });
    }
});

router.patch('/:id/status', authenticateToken, async (req, res) => {
    try {
        var bookingId = parseInt(req.params.id, 10);
        var status = req.body ? req.body.status : null;
        var booking = queryOne(
            `SELECT b.*, v.name as vehicle_name,
                    u.email as guest_email, u.full_name as guest_name,
                    pu.email as partner_email, pu.full_name as partner_name,
                    pp.company_name as partner_company
             FROM bookings b
             JOIN vehicles v ON b.vehicle_id = v.id
             JOIN users u ON b.guest_id = u.id
             LEFT JOIN users pu ON b.partner_id = pu.id
             LEFT JOIN partner_profiles pp ON b.partner_id = pp.user_id
             WHERE b.id = ?`,
            [bookingId]
        );

        if (!booking) return res.status(404).json({ error: 'Booking not found' });

        var allowed = [];
        var bStatus = String(booking.status || '');

        // Guest actions
        if (req.user.role === 'guest' && booking.guest_id == req.user.id) {
            if (bStatus === 'pending') {
                allowed = ['cancelled'];
            } else if (bStatus === 'accepted') {
                allowed = ['cancel_requested'];
            }
        }

        // Partner actions
        if (req.user.role === 'partner' && booking.partner_id == req.user.id) {
            if (bStatus === 'pending') {
                allowed = ['accepted', 'rejected'];
            } else if (bStatus === 'cancel_requested') {
                allowed = ['cancelled'];
            }
        }

        if (allowed.indexOf(status) === -1) {
            return res.status(403).json({ error: 'Action not allowed' });
        }

        try {
            execute('UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, bookingId]);
        } catch (dbErr) {
            console.error('DB update error:', dbErr.message);
            return res.status(500).json({ error: 'Database error updating status. Server may need restart to apply migrations.' });
        }

        // Handle date blocking/unblocking
        if (status === 'accepted') {
            blockDatesForBooking(booking.vehicle_id, booking.pickup_date, booking.dropoff_date);
        }
        if (status === 'cancelled' || status === 'rejected') {
            unblockDatesForBooking(booking.vehicle_id, booking.pickup_date, booking.dropoff_date);
        }

        // Send email notifications on status changes
        var { sendEmail } = require('../mailer');
        var vehicleName = booking.vehicle_name || 'Vehicle';
        var dates = booking.pickup_date + ' → ' + booking.dropoff_date;

        try {
            if (status === 'accepted' && booking.guest_email) {
                await sendEmail({
                    to: booking.guest_email,
                    subject: 'Booking Accepted — ' + vehicleName,
                    text: 'Hello ' + (booking.guest_name || 'Guest') + ',\n\nYour reservation for ' + vehicleName + ' (' + dates + ') has been accepted by the partner.\n\nTotal: $' + (parseFloat(booking.total_price) || 0).toFixed(2) + '\n\nThank you for using Eliterent.ge!',
                    html: '<p>Hello ' + (booking.guest_name || 'Guest') + ',</p><p>Your reservation for <strong>' + vehicleName + '</strong> (' + dates + ') has been <strong style="color:#16a34a;">accepted</strong>.</p><p>Total: <strong>$' + (parseFloat(booking.total_price) || 0).toFixed(2) + '</strong></p><p>Thank you for using Eliterent.ge!</p>'
                });
            }
            if (status === 'rejected' && booking.guest_email) {
                await sendEmail({
                    to: booking.guest_email,
                    subject: 'Booking Declined — ' + vehicleName,
                    text: 'Hello ' + (booking.guest_name || 'Guest') + ',\n\nUnfortunately your reservation for ' + vehicleName + ' (' + dates + ') was not accepted.\n\nPlease try another vehicle or different dates.\n\nEliterent.ge Team',
                    html: '<p>Hello ' + (booking.guest_name || 'Guest') + ',</p><p>Unfortunately your reservation for <strong>' + vehicleName + '</strong> (' + dates + ') was <strong style="color:#dc2626;">declined</strong>.</p><p>Please try another vehicle or different dates.</p><p>Eliterent.ge Team</p>'
                });
            }
            if (status === 'cancel_requested' && booking.partner_email) {
                await sendEmail({
                    to: booking.partner_email,
                    subject: 'Cancellation Requested — ' + vehicleName,
                    text: 'Hello ' + (booking.partner_company || booking.partner_name || 'Partner') + ',\n\nGuest ' + (booking.guest_name || '') + ' has requested cancellation for ' + vehicleName + ' (' + dates + ').\n\nPlease review in your dashboard.\n\nEliterent.ge',
                    html: '<p>Hello ' + (booking.partner_company || booking.partner_name || 'Partner') + ',</p><p>Guest <strong>' + (booking.guest_name || '') + '</strong> has requested cancellation for <strong>' + vehicleName + '</strong> (' + dates + ').</p><p>Please review in your dashboard.</p>'
                });
            }
            if (status === 'cancelled' && booking.guest_email) {
                await sendEmail({
                    to: booking.guest_email,
                    subject: 'Booking Cancelled — ' + vehicleName,
                    text: 'Hello ' + (booking.guest_name || 'Guest') + ',\n\nYour reservation for ' + vehicleName + ' (' + dates + ') has been cancelled.\n\nEliterent.ge Team',
                    html: '<p>Hello ' + (booking.guest_name || 'Guest') + ',</p><p>Your reservation for <strong>' + vehicleName + '</strong> (' + dates + ') has been <strong>cancelled</strong>.</p><p>Eliterent.ge Team</p>'
                });
            }
        } catch (emailErr) {
            console.error('Booking notification email error:', emailErr.message);
        }

        res.json({ message: 'Booking status updated', status: status });
    } catch (err) {
        console.error('Update booking status error:', err);
        res.status(500).json({ error: 'Failed to update booking' });
    }
});

router.get('/:id', authenticateToken, (req, res) => {
    try {
        var bookingId = parseInt(req.params.id, 10);
        var booking = queryOne(
            `SELECT b.*, v.name as vehicle_name, v.image_url, v.price_per_day, v.category, v.year,
                    u.full_name as guest_name, u.email as guest_email, u.phone as guest_phone,
                    pp.company_name as partner_company
             FROM bookings b
             JOIN vehicles v ON b.vehicle_id = v.id
             JOIN users u ON b.guest_id = u.id
             LEFT JOIN partner_profiles pp ON b.partner_id = pp.user_id
             WHERE b.id = ?`,
            [bookingId]
        );

        if (!booking) return res.status(404).json({ error: 'Booking not found' });
        if (booking.guest_id != req.user.id && booking.partner_id != req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({ booking: booking });
    } catch (err) {
        console.error('Get booking error:', err);
        res.status(500).json({ error: 'Failed to get booking' });
    }
});

module.exports = router;
