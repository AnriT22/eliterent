const express = require('express');
const { getDB, saveDB } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { queryAll, queryOne, execute } = require('../db-helpers');
const { sendEmail } = require('../mailer');
const paypal = require('../paypal');

const router = express.Router();

function parseExtras(value) {
    if (!value) return [];
    try {
        var parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function blockDatesForBooking(vehicleId, startStr, endStr) {
    var db = getDB();
    var cur = new Date(startStr + 'T00:00:00Z');
    var end = new Date(endStr + 'T00:00:00Z');
    while (cur <= end) {
        var dateStr = cur.getUTCFullYear() + '-' + String(cur.getUTCMonth() + 1).padStart(2, '0') + '-' + String(cur.getUTCDate()).padStart(2, '0');
        var existing = queryOne('SELECT id FROM vehicle_availability WHERE vehicle_id = ? AND date = ?', [vehicleId, dateStr]);
        if (existing) {
            db.run('UPDATE vehicle_availability SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE vehicle_id = ? AND date = ?', ['booked', vehicleId, dateStr]);
        } else {
            db.run('INSERT INTO vehicle_availability (vehicle_id, date, status) VALUES (?, ?, ?)', [vehicleId, dateStr, 'booked']);
        }
        cur.setUTCDate(cur.getUTCDate() + 1);
    }
    saveDB();
}

function unblockDatesForBooking(vehicleId, startStr, endStr) {
    var db = getDB();
    var cur = new Date(startStr + 'T00:00:00Z');
    var end = new Date(endStr + 'T00:00:00Z');
    while (cur <= end) {
        var dateStr = cur.getUTCFullYear() + '-' + String(cur.getUTCMonth() + 1).padStart(2, '0') + '-' + String(cur.getUTCDate()).padStart(2, '0');
        db.run("DELETE FROM vehicle_availability WHERE vehicle_id = ? AND date = ? AND status = 'booked'", [vehicleId, dateStr]);
        cur.setUTCDate(cur.getUTCDate() + 1);
    }
    saveDB();
}

function formatMoney(value) {
    return '$' + (parseFloat(value) || 0).toFixed(2);
}

function buildApprovalEmailText(booking, recipientLabel) {
    var extras = parseExtras(booking.extras_json);
    var extrasLine = extras.length ? '\nExtras: ' + extras.map(function(item) { return item.name + ' (' + formatMoney(item.price) + ')'; }).join(', ') : '';
    return 'Hello ' + recipientLabel + ',\n\n'
        + 'The reservation has been accepted.\n\n'
        + 'Car: ' + (booking.vehicle_name || 'Vehicle') + '\n'
        + 'Dates: ' + booking.pickup_date + ' → ' + booking.dropoff_date + '\n'
        + 'Pickup location: ' + (booking.pickup_location || 'Not specified') + '\n'
        + 'Total price: ' + formatMoney(booking.total_price) + '\n'
        + extrasLine + '\n\n'
        + 'Thank you for using Eliterent.ge.';
}

// All admin routes require admin role
router.use(authenticateToken, requireRole('admin'));

// ========================================
// ANALYTICS
// ========================================
router.get('/analytics', (req, res) => {
    try {
        const totalUsers = queryOne('SELECT COUNT(*) as count FROM users WHERE role != ?', ['admin']);
        const totalGuests = queryOne('SELECT COUNT(*) as count FROM users WHERE role = ?', ['guest']);
        const totalPartners = queryOne('SELECT COUNT(*) as count FROM users WHERE role = ?', ['partner']);
        const totalVehicles = queryOne('SELECT COUNT(*) as count FROM vehicles');
        const activeVehicles = queryOne("SELECT COUNT(*) as count FROM vehicles WHERE status = 'active'");
        const pendingVehicles = queryOne("SELECT COUNT(*) as count FROM vehicles WHERE status = 'pending'");
        const totalBookings = queryOne('SELECT COUNT(*) as count FROM bookings');
        const verifiedPartners = queryOne('SELECT COUNT(*) as count FROM partner_profiles WHERE is_verified = 1');

        // Uploads per day (last 7 days)
        const dailyUploads = queryAll(
            "SELECT DATE(created_at) as date, COUNT(*) as count FROM vehicles WHERE created_at >= DATE('now', '-7 days') GROUP BY DATE(created_at) ORDER BY date DESC"
        );

        // Uploads per week (last 4 weeks)
        const weeklyUploads = queryAll(
            "SELECT strftime('%Y-W%W', created_at) as week, COUNT(*) as count FROM vehicles WHERE created_at >= DATE('now', '-28 days') GROUP BY week ORDER BY week DESC"
        );

        // Uploads per month (last 6 months)
        const monthlyUploads = queryAll(
            "SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count FROM vehicles WHERE created_at >= DATE('now', '-180 days') GROUP BY month ORDER BY month DESC"
        );

        // Recent registrations (last 7 days)
        const recentUsers = queryOne("SELECT COUNT(*) as count FROM users WHERE created_at >= DATE('now', '-7 days') AND role != 'admin'");
        const earningsOverall = queryOne("SELECT COALESCE(SUM(service_fee), 0) as amount FROM bookings WHERE status IN ('accepted', 'completed')");
        const earningsMonth = queryOne("SELECT COALESCE(SUM(service_fee), 0) as amount FROM bookings WHERE status IN ('accepted', 'completed') AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')");
        const reservationsOverall = queryOne('SELECT COUNT(*) as count FROM bookings');
        const reservationsMonth = queryOne("SELECT COUNT(*) as count FROM bookings WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')");

        res.json({
            users: { total: totalUsers.count, guests: totalGuests.count, partners: totalPartners.count, recentSignups: recentUsers.count },
            vehicles: { total: totalVehicles.count, active: activeVehicles.count, pending: pendingVehicles.count },
            partners: { total: totalPartners.count, verified: verifiedPartners.count },
            bookings: { total: totalBookings.count },
            earnings: {
                month: earningsMonth.amount,
                overall: earningsOverall.amount,
                reservationsMonth: reservationsMonth.count,
                reservationsOverall: reservationsOverall.count
            },
            uploads: { daily: dailyUploads, weekly: weeklyUploads, monthly: monthlyUploads }
        });
    } catch (err) {
        console.error('Analytics error:', err);
        res.status(500).json({ error: 'Failed to load analytics' });
    }
});

// ========================================
// USER MANAGEMENT
// ========================================
router.get('/users', (req, res) => {
    try {
        const role = req.query.role;
        let sql = "SELECT id, email, full_name, phone, role, avatar_url, is_approved, created_at FROM users WHERE role != 'admin'";
        let params = [];
        if (role) { sql += ' AND role = ?'; params.push(role); }
        sql += ' ORDER BY created_at DESC';
        const users = queryAll(sql, params.length ? params : undefined);
        res.json({ users, count: users.length });
    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// GET /api/admin/users/:id/detail — full detail view for a user or partner
router.get('/users/:id/detail', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = queryOne(
            'SELECT id, email, full_name, phone, role, avatar_url, is_approved, admin_notes, created_at, updated_at FROM users WHERE id = ?',
            [userId]
        );
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Partner profile if applicable
        let partnerProfile = null;
        if (user.role === 'partner') {
            partnerProfile = queryOne(
                'SELECT company_name, description, location, whatsapp, telegram, categories, is_verified, created_at FROM partner_profiles WHERE user_id = ?',
                [userId]
            );
        }

        // Vehicles owned by this user (if partner)
        const vehicles = user.role === 'partner'
            ? queryAll(
                'SELECT id, name, category, engine, gearbox, price_per_day, year, status, image_url, created_at FROM vehicles WHERE partner_id = ? ORDER BY created_at DESC',
                [userId]
            )
            : [];

        // Bookings — as guest or as partner
        let bookings = [];
        if (user.role === 'guest') {
            bookings = queryAll(
                `SELECT b.id, b.pickup_date, b.dropoff_date, b.total_price, b.service_fee, b.status, b.payment_status, b.created_at,
                        v.name as vehicle_name, v.image_url,
                        pp.company_name as partner_company
                 FROM bookings b
                 JOIN vehicles v ON b.vehicle_id = v.id
                 LEFT JOIN partner_profiles pp ON b.partner_id = pp.user_id
                 WHERE b.guest_id = ?
                 ORDER BY b.created_at DESC`,
                [userId]
            );
        } else if (user.role === 'partner') {
            bookings = queryAll(
                `SELECT b.id, b.pickup_date, b.dropoff_date, b.total_price, b.service_fee, b.status, b.payment_status, b.created_at,
                        v.name as vehicle_name, v.image_url,
                        u.full_name as guest_name, u.email as guest_email
                 FROM bookings b
                 JOIN vehicles v ON b.vehicle_id = v.id
                 JOIN users u ON b.guest_id = u.id
                 WHERE b.partner_id = ?
                 ORDER BY b.created_at DESC`,
                [userId]
            );
        }

        // Stats
        const totalBookings = bookings.length;
        const activeBookings = bookings.filter(b => ['pending', 'accepted', 'cancel_requested'].includes(b.status)).length;
        const totalRevenue = bookings
            .filter(b => ['accepted', 'completed'].includes(b.status))
            .reduce((sum, b) => sum + (parseFloat(b.total_price) || 0), 0);
        const totalServiceFees = bookings
            .filter(b => ['accepted', 'completed'].includes(b.status))
            .reduce((sum, b) => sum + (parseFloat(b.service_fee) || 0), 0);

        // Reviews (if guest)
        let reviews = [];
        if (user.role === 'guest') {
            reviews = queryAll(
                'SELECT id, rating, title, body, created_at FROM reviews WHERE user_id = ? ORDER BY created_at DESC',
                [userId]
            );
        }

        res.json({
            user,
            partner_profile: partnerProfile,
            vehicles,
            bookings,
            reviews,
            stats: {
                total_bookings: totalBookings,
                active_bookings: activeBookings,
                total_revenue: totalRevenue,
                total_service_fees: totalServiceFees,
                total_vehicles: vehicles.length,
                active_vehicles: vehicles.filter(v => v.status === 'active').length
            }
        });
    } catch (err) {
        console.error('Admin user detail error:', err);
        res.status(500).json({ error: 'Failed to load user details' });
    }
});

router.put('/users/:id/approve', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = queryOne('SELECT * FROM users WHERE id = ? AND role != ?', [userId, 'admin']);
        if (!user) return res.status(404).json({ error: 'User not found' });
        execute('UPDATE users SET is_approved = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
        res.json({ message: 'User approved' });
    } catch (err) {
        console.error('Approve user error:', err);
        res.status(500).json({ error: 'Failed to approve user' });
    }
});

router.put('/users/:id/reject', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = queryOne('SELECT * FROM users WHERE id = ? AND role != ?', [userId, 'admin']);
        if (!user) return res.status(404).json({ error: 'User not found' });
        execute('DELETE FROM users WHERE id = ?', [userId]);
        res.json({ message: 'User rejected and removed' });
    } catch (err) {
        console.error('Reject user error:', err);
        res.status(500).json({ error: 'Failed to reject user' });
    }
});

router.delete('/users/:id', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = queryOne('SELECT * FROM users WHERE id = ? AND role != ?', [userId, 'admin']);
        if (!user) return res.status(404).json({ error: 'User not found' });
        // If partner, explicitly delete all their vehicles first
        if (user.role === 'partner') {
            execute('DELETE FROM vehicles WHERE partner_id = ?', [userId]);
        }
        execute('DELETE FROM users WHERE id = ?', [userId]);
        res.json({ message: 'User deleted' + (user.role === 'partner' ? ' (all vehicles removed)' : '') });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Suspend user (set is_approved = 0)
router.put('/users/:id/suspend', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = queryOne('SELECT * FROM users WHERE id = ? AND role != ?', [userId, 'admin']);
        if (!user) return res.status(404).json({ error: 'User not found' });
        execute('UPDATE users SET is_approved = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
        res.json({ message: 'User suspended' });
    } catch (err) {
        console.error('Suspend user error:', err);
        res.status(500).json({ error: 'Failed to suspend user' });
    }
});

// Unsuspend user (set is_approved = 1)
router.put('/users/:id/unsuspend', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        execute('UPDATE users SET is_approved = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
        res.json({ message: 'User unsuspended' });
    } catch (err) {
        console.error('Unsuspend user error:', err);
        res.status(500).json({ error: 'Failed to unsuspend user' });
    }
});

// Edit user profile from admin
router.put('/users/:id/edit', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = queryOne('SELECT * FROM users WHERE id = ? AND role != ?', [userId, 'admin']);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const { full_name, email, phone } = req.body;
        if (full_name) execute('UPDATE users SET full_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [full_name.trim(), userId]);
        if (email) execute('UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [email.trim(), userId]);
        if (phone !== undefined) execute('UPDATE users SET phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [phone || null, userId]);
        res.json({ message: 'User updated' });
    } catch (err) {
        console.error('Edit user error:', err);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Save admin notes on a user
router.put('/users/:id/notes', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { notes } = req.body;
        execute('UPDATE users SET admin_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [notes || null, userId]);
        res.json({ message: 'Notes saved' });
    } catch (err) {
        console.error('Save notes error:', err);
        res.status(500).json({ error: 'Failed to save notes' });
    }
});

// ========================================
// PARTNER MANAGEMENT
// ========================================
router.get('/partners', (req, res) => {
    try {
        const partners = queryAll(
            `SELECT u.id, u.email, u.full_name, u.phone, u.created_at,
                    pp.company_name, pp.location, pp.is_verified, pp.description
             FROM users u
             LEFT JOIN partner_profiles pp ON u.id = pp.user_id
             WHERE u.role = 'partner'
             ORDER BY u.created_at DESC`
        );
        res.json({ partners, count: partners.length });
    } catch (err) {
        console.error('Get partners error:', err);
        res.status(500).json({ error: 'Failed to get partners' });
    }
});

router.put('/partners/:id/verify', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        execute('UPDATE partner_profiles SET is_verified = 1 WHERE user_id = ?', [userId]);
        res.json({ message: 'Partner verified' });
    } catch (err) {
        console.error('Verify partner error:', err);
        res.status(500).json({ error: 'Failed to verify partner' });
    }
});

router.put('/partners/:id/unverify', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        execute('UPDATE partner_profiles SET is_verified = 0 WHERE user_id = ?', [userId]);
        res.json({ message: 'Partner unverified' });
    } catch (err) {
        console.error('Unverify partner error:', err);
        res.status(500).json({ error: 'Failed to unverify partner' });
    }
});

// ========================================
// VEHICLE MANAGEMENT
// ========================================
router.get('/vehicles', (req, res) => {
    try {
        const vehicles = queryAll(
            `SELECT v.*, u.full_name as partner_name, pp.company_name
             FROM vehicles v
             JOIN users u ON v.partner_id = u.id
             LEFT JOIN partner_profiles pp ON u.id = pp.user_id
             ORDER BY v.created_at DESC`
        );
        res.json({ vehicles, count: vehicles.length });
    } catch (err) {
        console.error('Admin get vehicles error:', err);
        res.status(500).json({ error: 'Failed to get vehicles' });
    }
});

router.put('/vehicles/:id/status', (req, res) => {
    try {
        const vehicleId = parseInt(req.params.id);
        const { status } = req.body;
        if (!['active', 'inactive', 'pending', 'delete_requested'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        execute('UPDATE vehicles SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, vehicleId]);
        res.json({ message: 'Vehicle status updated' });
    } catch (err) {
        console.error('Update vehicle status error:', err);
        res.status(500).json({ error: 'Failed to update vehicle status' });
    }
});

// Approve a delete request — actually deletes the vehicle
router.delete('/vehicles/:id/approve-delete', (req, res) => {
    try {
        const vehicleId = parseInt(req.params.id);
        execute('DELETE FROM vehicles WHERE id = ?', [vehicleId]);
        res.json({ message: 'Vehicle deletion approved and vehicle removed' });
    } catch (err) {
        console.error('Admin approve delete error:', err);
        res.status(500).json({ error: 'Failed to approve vehicle deletion' });
    }
});

// Reject a delete request — set status back to active
router.put('/vehicles/:id/reject-delete', (req, res) => {
    try {
        const vehicleId = parseInt(req.params.id);
        execute("UPDATE vehicles SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [vehicleId]);
        res.json({ message: 'Vehicle deletion rejected, vehicle restored to active' });
    } catch (err) {
        console.error('Admin reject delete error:', err);
        res.status(500).json({ error: 'Failed to reject vehicle deletion' });
    }
});

router.delete('/vehicles/:id', (req, res) => {
    try {
        const vehicleId = parseInt(req.params.id);
        execute('DELETE FROM vehicles WHERE id = ?', [vehicleId]);
        res.json({ message: 'Vehicle deleted' });
    } catch (err) {
        console.error('Admin delete vehicle error:', err);
        res.status(500).json({ error: 'Failed to delete vehicle' });
    }
});

// ========================================
// BOOKING MANAGEMENT
// ========================================
router.get('/bookings', (req, res) => {
    try {
        let sql = `SELECT b.*, v.name as vehicle_name, v.image_url,
                          u.full_name as guest_name, u.email as guest_email,
                          pu.email as partner_email, pu.full_name as partner_name,
                          pp.company_name as partner_company
                   FROM bookings b
                   JOIN vehicles v ON b.vehicle_id = v.id
                   JOIN users u ON b.guest_id = u.id
                   LEFT JOIN users pu ON b.partner_id = pu.id
                   LEFT JOIN partner_profiles pp ON b.partner_id = pp.user_id`;
        let params = [];
        if (req.query.status) { sql += ' WHERE b.status = ?'; params.push(req.query.status); }
        sql += ' ORDER BY b.created_at DESC';
        const bookings = queryAll(sql, params.length ? params : undefined);
        res.json({ bookings, count: bookings.length });
    } catch (err) {
        console.error('Admin get bookings error:', err);
        res.status(500).json({ error: 'Failed to get bookings' });
    }
});

router.patch('/bookings/:id/status', async (req, res) => {
    try {
        var bookingId = parseInt(req.params.id, 10);
        var status = req.body ? req.body.status : null;
        if (['accepted', 'rejected', 'cancelled'].indexOf(status) === -1) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        var booking = queryOne(
            `SELECT b.*, v.name as vehicle_name,
                    u.email as guest_email, u.full_name as guest_name,
                    pu.email as partner_email, pu.full_name as partner_name,
                    pp.company_name as partner_company
             FROM bookings b
             JOIN vehicles v ON b.vehicle_id = v.id
             JOIN users u ON b.guest_id = u.id
             JOIN users pu ON b.partner_id = pu.id
             LEFT JOIN partner_profiles pp ON b.partner_id = pp.user_id
             WHERE b.id = ?`,
            [bookingId]
        );
        if (!booking) return res.status(404).json({ error: 'Booking not found' });
        // Allow: pending -> accepted/rejected, accepted/cancel_requested -> cancelled
        var validTransitions = {
            pending: ['accepted', 'rejected'],
            accepted: ['cancelled'],
            cancel_requested: ['cancelled', 'accepted']
        };
        var allowed = validTransitions[booking.status] || [];
        if (allowed.indexOf(status) === -1) {
            return res.status(400).json({ error: 'Cannot change from ' + booking.status + ' to ' + status });
        }

        execute('UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, bookingId]);

        if (status === 'rejected' || status === 'cancelled') {
            unblockDatesForBooking(booking.vehicle_id, booking.pickup_date, booking.dropoff_date);

            // Auto-refund if booking was paid
            var pStatus = String(booking.payment_status || 'unpaid');
            if (pStatus === 'paid' && booking.paypal_capture_id && paypal.isConfigured()) {
                try {
                    await paypal.refundPayment(booking.paypal_capture_id, booking.service_fee, 'USD');
                    execute("UPDATE bookings SET payment_status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [bookingId]);
                    console.log('Auto-refund processed for booking #' + bookingId);
                } catch (refundErr) {
                    console.error('Auto-refund failed for booking #' + bookingId + ':', refundErr.message);
                    // Don't fail the cancellation — admin can manually refund later
                }
            }
        }

        if (status === 'accepted') {
            blockDatesForBooking(booking.vehicle_id, booking.pickup_date, booking.dropoff_date);
            var guestText = buildApprovalEmailText(booking, booking.guest_name || 'Guest');
            var partnerText = buildApprovalEmailText(booking, booking.partner_company || booking.partner_name || 'Partner');

            if (booking.guest_email) {
                await sendEmail({
                    to: booking.guest_email,
                    subject: 'Reservation accepted — ' + (booking.vehicle_name || 'Vehicle'),
                    text: guestText,
                    html: guestText.replace(/\n/g, '<br>')
                });
            }
            if (booking.partner_email) {
                await sendEmail({
                    to: booking.partner_email,
                    subject: 'New accepted reservation — ' + (booking.vehicle_name || 'Vehicle'),
                    text: partnerText,
                    html: partnerText.replace(/\n/g, '<br>')
                });
            }
        }

        res.json({ message: 'Booking status updated', status: status });
    } catch (err) {
        console.error('Admin update booking status error:', err);
        res.status(500).json({ error: 'Failed to update booking status' });
    }
});

// ========================================
// FINANCIAL DATA
// ========================================
router.get('/financial', (req, res) => {
    try {
        var records = queryAll(`
            SELECT b.id, b.vehicle_id, b.pickup_date, b.dropoff_date, b.rental_days,
                   b.extras_total, b.service_fee, b.total_price, b.status, b.created_at, b.updated_at,
                   b.payment_status, b.payment_date,
                   v.name as vehicle_name,
                   u.full_name as guest_name, u.email as guest_email
            FROM bookings b
            JOIN vehicles v ON b.vehicle_id = v.id
            JOIN users u ON b.guest_id = u.id
            WHERE b.status IN ('accepted', 'completed', 'cancelled', 'cancel_requested')
            ORDER BY b.updated_at DESC
        `);

        // Only include bookings that were accepted at some point
        // cancelled bookings that were never accepted (rejected directly) won't have service_fee income
        var financial = records.filter(function(r) {
            // If status is cancelled but service_fee is 0, it was likely rejected, not a cancelled accepted booking
            // We include all accepted/completed/cancel_requested + cancelled with service_fee > 0
            return r.status !== 'cancelled' || (parseFloat(r.service_fee) || 0) > 0;
        }).map(function(r) {
            var rentalTotal = Math.round((r.total_price - (r.extras_total || 0) - (r.service_fee || 0)) * 100) / 100;
            return {
                id: r.id,
                vehicle_name: r.vehicle_name,
                guest_name: r.guest_name,
                guest_email: r.guest_email,
                pickup_date: r.pickup_date,
                dropoff_date: r.dropoff_date,
                rental_days: r.rental_days,
                rental_total: rentalTotal,
                extras_total: parseFloat(r.extras_total) || 0,
                service_fee: parseFloat(r.service_fee) || 0,
                total_price: parseFloat(r.total_price) || 0,
                status: r.status,
                payment_status: r.payment_status || 'unpaid',
                payment_date: r.payment_date || null,
                is_active: r.status === 'accepted' || r.status === 'completed' || r.status === 'cancel_requested',
                date: r.updated_at || r.created_at
            };
        });

        res.json({ records: financial });
    } catch (err) {
        console.error('Admin financial error:', err);
        res.status(500).json({ error: 'Failed to load financial data' });
    }
});

// ========================================
// PROMO CODES
// ========================================
router.get('/promo-codes', (req, res) => {
    try {
        const codes = queryAll('SELECT * FROM promo_codes ORDER BY created_at DESC');
        res.json({ codes });
    } catch (err) {
        console.error('Get promo codes error:', err);
        res.status(500).json({ error: 'Failed to get promo codes' });
    }
});

router.post('/promo-codes', (req, res) => {
    try {
        const { code, discount_type, discount_value, min_order, max_uses, valid_from, valid_until } = req.body;
        if (!code || !discount_type || !discount_value) {
            return res.status(400).json({ error: 'Code, discount type, and value are required' });
        }
        if (!['percent', 'fixed'].includes(discount_type)) {
            return res.status(400).json({ error: 'Discount type must be percent or fixed' });
        }
        const existing = queryOne('SELECT id FROM promo_codes WHERE code = ?', [code.toUpperCase()]);
        if (existing) return res.status(409).json({ error: 'Code already exists' });
        execute(
            'INSERT INTO promo_codes (code, discount_type, discount_value, min_order, max_uses, valid_from, valid_until) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [code.toUpperCase(), discount_type, parseFloat(discount_value), parseFloat(min_order) || 0, parseInt(max_uses) || 0, valid_from || null, valid_until || null]
        );
        res.status(201).json({ message: 'Promo code created' });
    } catch (err) {
        console.error('Create promo code error:', err);
        res.status(500).json({ error: 'Failed to create promo code' });
    }
});

router.put('/promo-codes/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { is_active, max_uses, valid_until } = req.body;
        if (is_active !== undefined) execute('UPDATE promo_codes SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, id]);
        if (max_uses !== undefined) execute('UPDATE promo_codes SET max_uses = ? WHERE id = ?', [parseInt(max_uses) || 0, id]);
        if (valid_until !== undefined) execute('UPDATE promo_codes SET valid_until = ? WHERE id = ?', [valid_until || null, id]);
        res.json({ message: 'Promo code updated' });
    } catch (err) {
        console.error('Update promo code error:', err);
        res.status(500).json({ error: 'Failed to update promo code' });
    }
});

router.delete('/promo-codes/:id', (req, res) => {
    try {
        execute('DELETE FROM promo_codes WHERE id = ?', [parseInt(req.params.id)]);
        res.json({ message: 'Promo code deleted' });
    } catch (err) {
        console.error('Delete promo code error:', err);
        res.status(500).json({ error: 'Failed to delete promo code' });
    }
});

// ========================================
// CSV EXPORT
// ========================================
router.get('/export/bookings', (req, res) => {
    try {
        const rows = queryAll(
            `SELECT b.id, b.pickup_date, b.dropoff_date, b.rental_days, b.total_price, b.service_fee, b.extras_total, b.status, b.payment_status, b.created_at,
                    v.name as vehicle_name,
                    u.full_name as guest_name, u.email as guest_email,
                    pp.company_name as partner_company
             FROM bookings b
             JOIN vehicles v ON b.vehicle_id = v.id
             JOIN users u ON b.guest_id = u.id
             LEFT JOIN partner_profiles pp ON b.partner_id = pp.user_id
             ORDER BY b.created_at DESC`
        );
        var csv = 'ID,Vehicle,Guest,Guest Email,Partner,Pickup,Dropoff,Days,Total,Service Fee,Extras,Status,Payment,Created\n';
        rows.forEach(function(r) {
            csv += [r.id, '"'+(r.vehicle_name||'')+'"', '"'+(r.guest_name||'')+'"', r.guest_email||'', '"'+(r.partner_company||'')+'"',
                r.pickup_date||'', r.dropoff_date||'', r.rental_days||'', (r.total_price||0), (r.service_fee||0), (r.extras_total||0),
                r.status||'', r.payment_status||'', r.created_at||''].join(',') + '\n';
        });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=bookings_export.csv');
        res.send(csv);
    } catch (err) {
        console.error('Export bookings error:', err);
        res.status(500).json({ error: 'Export failed' });
    }
});

router.get('/export/financial', (req, res) => {
    try {
        const rows = queryAll(
            `SELECT b.id, b.pickup_date, b.dropoff_date, b.rental_days, b.total_price, b.service_fee, b.extras_total, b.status, b.payment_status, b.payment_date,
                    v.name as vehicle_name,
                    u.full_name as guest_name, u.email as guest_email
             FROM bookings b
             JOIN vehicles v ON b.vehicle_id = v.id
             JOIN users u ON b.guest_id = u.id
             WHERE b.status IN ('accepted', 'completed', 'cancelled', 'cancel_requested')
             ORDER BY b.updated_at DESC`
        );
        var csv = 'ID,Vehicle,Guest,Guest Email,Pickup,Dropoff,Days,Rental Total,Extras,Service Fee,Total,Status,Payment Status,Payment Date\n';
        rows.forEach(function(r) {
            var rental = Math.round(((r.total_price||0) - (r.extras_total||0) - (r.service_fee||0)) * 100) / 100;
            csv += [r.id, '"'+(r.vehicle_name||'')+'"', '"'+(r.guest_name||'')+'"', r.guest_email||'',
                r.pickup_date||'', r.dropoff_date||'', r.rental_days||'', rental, (r.extras_total||0), (r.service_fee||0), (r.total_price||0),
                r.status||'', r.payment_status||'unpaid', r.payment_date||''].join(',') + '\n';
        });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=financial_export.csv');
        res.send(csv);
    } catch (err) {
        console.error('Export financial error:', err);
        res.status(500).json({ error: 'Export failed' });
    }
});

// ========================================
// BULK ACTIONS
// ========================================
router.post('/bulk/approve-vehicles', (req, res) => {
    try {
        const result = execute("UPDATE vehicles SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE status = 'pending'");
        const count = queryOne("SELECT changes() as count");
        res.json({ message: 'All pending vehicles approved', count: count ? count.count : 0 });
    } catch (err) {
        console.error('Bulk approve vehicles error:', err);
        res.status(500).json({ error: 'Failed to bulk approve' });
    }
});

router.post('/bulk/approve-partners', (req, res) => {
    try {
        execute('UPDATE partner_profiles SET is_verified = 1 WHERE is_verified = 0');
        const count = queryOne("SELECT changes() as count");
        res.json({ message: 'All unverified partners approved', count: count ? count.count : 0 });
    } catch (err) {
        console.error('Bulk approve partners error:', err);
        res.status(500).json({ error: 'Failed to bulk approve' });
    }
});

// ========================================
// ACTIVITY FEED
// ========================================
router.get('/activity', (req, res) => {
    try {
        var activities = [];

        // Recent registrations (last 7 days)
        var recentUsers = queryAll(
            "SELECT id, full_name, email, role, created_at FROM users WHERE created_at >= datetime('now', '-7 days') AND role != 'admin' ORDER BY created_at DESC LIMIT 20"
        );
        recentUsers.forEach(function(u) {
            activities.push({ type: 'registration', icon: 'user', text: (u.full_name || u.email) + ' registered as ' + u.role, time: u.created_at, id: u.id });
        });

        // Recent bookings (last 7 days)
        var recentBookings = queryAll(
            `SELECT b.id, b.status, b.created_at, b.updated_at, v.name as vehicle_name, u.full_name as guest_name
             FROM bookings b JOIN vehicles v ON b.vehicle_id = v.id JOIN users u ON b.guest_id = u.id
             WHERE b.created_at >= datetime('now', '-7 days') ORDER BY b.created_at DESC LIMIT 20`
        );
        recentBookings.forEach(function(b) {
            activities.push({ type: 'booking', icon: 'calendar', text: (b.guest_name || 'Guest') + ' booked ' + (b.vehicle_name || 'vehicle') + ' — ' + b.status, time: b.created_at, id: b.id });
        });

        // Recent vehicle uploads (last 7 days)
        var recentVehicles = queryAll(
            `SELECT v.id, v.name, v.status, v.created_at, u.full_name as partner_name
             FROM vehicles v JOIN users u ON v.partner_id = u.id
             WHERE v.created_at >= datetime('now', '-7 days') ORDER BY v.created_at DESC LIMIT 20`
        );
        recentVehicles.forEach(function(v) {
            activities.push({ type: 'vehicle', icon: 'car', text: (v.partner_name || 'Partner') + ' added ' + (v.name || 'vehicle') + ' — ' + v.status, time: v.created_at, id: v.id });
        });

        // Recent status changes (bookings updated in last 7 days that differ from created)
        var recentChanges = queryAll(
            `SELECT b.id, b.status, b.updated_at, v.name as vehicle_name, u.full_name as guest_name
             FROM bookings b JOIN vehicles v ON b.vehicle_id = v.id JOIN users u ON b.guest_id = u.id
             WHERE b.updated_at >= datetime('now', '-7 days') AND b.updated_at != b.created_at AND b.status != 'pending'
             ORDER BY b.updated_at DESC LIMIT 20`
        );
        recentChanges.forEach(function(b) {
            activities.push({ type: 'status_change', icon: 'check', text: (b.vehicle_name || 'Booking') + ' → ' + b.status + ' (guest: ' + (b.guest_name || '') + ')', time: b.updated_at, id: b.id });
        });

        // Sort by time descending
        activities.sort(function(a, b) { return new Date(b.time) - new Date(a.time); });

        res.json({ activities: activities.slice(0, 30) });
    } catch (err) {
        console.error('Activity feed error:', err);
        res.status(500).json({ error: 'Failed to load activity feed' });
    }
});

module.exports = router;
