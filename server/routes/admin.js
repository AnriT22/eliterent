const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { queryAll, queryOne, execute } = require('../db-helpers');
const { sendEmail, escapeHtml } = require('../mailer');
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

async function blockDatesForBooking(vehicleId, startStr, endStr) {
    var cur = new Date(startStr + 'T00:00:00Z');
    var end = new Date(endStr + 'T00:00:00Z');
    while (cur <= end) {
        var dateStr = cur.getUTCFullYear() + '-' + String(cur.getUTCMonth() + 1).padStart(2, '0') + '-' + String(cur.getUTCDate()).padStart(2, '0');
        var existing = await queryOne('SELECT id FROM vehicle_availability WHERE vehicle_id = $1 AND date = $2', [vehicleId, dateStr]);
        if (existing) {
            await execute('UPDATE vehicle_availability SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE vehicle_id = $2 AND date = $3', ['booked', vehicleId, dateStr]);
        } else {
            await execute('INSERT INTO vehicle_availability (vehicle_id, date, status) VALUES ($1, $2, $3)', [vehicleId, dateStr, 'booked']);
        }
        cur.setUTCDate(cur.getUTCDate() + 1);
    }
}

async function unblockDatesForBooking(vehicleId, startStr, endStr) {
    var cur = new Date(startStr + 'T00:00:00Z');
    var end = new Date(endStr + 'T00:00:00Z');
    while (cur <= end) {
        var dateStr = cur.getUTCFullYear() + '-' + String(cur.getUTCMonth() + 1).padStart(2, '0') + '-' + String(cur.getUTCDate()).padStart(2, '0');
        await execute("DELETE FROM vehicle_availability WHERE vehicle_id = $1 AND date = $2 AND status = 'booked'", [vehicleId, dateStr]);
        cur.setUTCDate(cur.getUTCDate() + 1);
    }
}

function formatMoney(value) {
    return '$' + (parseFloat(value) || 0).toFixed(2);
}

function csvSafe(val) {
    val = String(val || '');
    if (/^[=+\-@\t\r]/.test(val)) val = "'" + val;
    return '"' + val.replace(/"/g, '""') + '"';
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
        + 'Thank you for using RoyalCar.rent.';
}

// All admin routes require admin role
router.use(authenticateToken, requireRole('admin'));

// ========================================
// ANALYTICS
// ========================================
router.get('/analytics', async (req, res) => {
    try {
        const totalUsers = await queryOne("SELECT COUNT(*) as count FROM users WHERE role != $1", ['admin']);
        const totalGuests = await queryOne("SELECT COUNT(*) as count FROM users WHERE role = $1", ['guest']);
        const totalPartners = await queryOne("SELECT COUNT(*) as count FROM users WHERE role = $1", ['partner']);
        const totalVehicles = await queryOne('SELECT COUNT(*) as count FROM vehicles');
        const activeVehicles = await queryOne("SELECT COUNT(*) as count FROM vehicles WHERE status = 'active'");
        const pendingVehicles = await queryOne("SELECT COUNT(*) as count FROM vehicles WHERE status = 'pending'");
        const totalBookings = await queryOne('SELECT COUNT(*) as count FROM bookings');
        const verifiedPartners = await queryOne('SELECT COUNT(*) as count FROM partner_profiles WHERE is_verified = 1');

        // Uploads per day (last 7 days)
        const dailyUploads = await queryAll(
            "SELECT created_at::date as date, COUNT(*) as count FROM vehicles WHERE created_at >= CURRENT_DATE - INTERVAL '7 days' GROUP BY created_at::date ORDER BY date DESC"
        );

        // Uploads per week (last 4 weeks)
        const weeklyUploads = await queryAll(
            "SELECT to_char(created_at, 'IYYY-\"W\"IW') as week, COUNT(*) as count FROM vehicles WHERE created_at >= CURRENT_DATE - INTERVAL '28 days' GROUP BY week ORDER BY week DESC"
        );

        // Uploads per month (last 6 months)
        const monthlyUploads = await queryAll(
            "SELECT to_char(created_at, 'YYYY-MM') as month, COUNT(*) as count FROM vehicles WHERE created_at >= CURRENT_DATE - INTERVAL '180 days' GROUP BY month ORDER BY month DESC"
        );

        // Recent registrations (last 7 days)
        const recentUsers = await queryOne("SELECT COUNT(*) as count FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '7 days' AND role != 'admin'");
        const earningsOverall = await queryOne("SELECT COALESCE(SUM(service_fee), 0) as amount FROM bookings WHERE status IN ('accepted', 'completed')");
        const earningsMonth = await queryOne("SELECT COALESCE(SUM(service_fee), 0) as amount FROM bookings WHERE status IN ('accepted', 'completed') AND to_char(created_at, 'YYYY-MM') = to_char(NOW(), 'YYYY-MM')");
        const reservationsOverall = await queryOne('SELECT COUNT(*) as count FROM bookings');
        const reservationsMonth = await queryOne("SELECT COUNT(*) as count FROM bookings WHERE to_char(created_at, 'YYYY-MM') = to_char(NOW(), 'YYYY-MM')");

        res.json({
            users: { total: parseInt(totalUsers.count), guests: parseInt(totalGuests.count), partners: parseInt(totalPartners.count), recentSignups: parseInt(recentUsers.count) },
            vehicles: { total: parseInt(totalVehicles.count), active: parseInt(activeVehicles.count), pending: parseInt(pendingVehicles.count) },
            partners: { total: parseInt(totalPartners.count), verified: parseInt(verifiedPartners.count) },
            bookings: { total: parseInt(totalBookings.count) },
            earnings: {
                month: parseFloat(earningsMonth.amount) || 0,
                overall: parseFloat(earningsOverall.amount) || 0,
                reservationsMonth: parseInt(reservationsMonth.count),
                reservationsOverall: parseInt(reservationsOverall.count)
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
router.get('/users', async (req, res) => {
    try {
        const role = req.query.role;
        let sql = "SELECT id, email, full_name, phone, role, avatar_url, google_id, is_approved, is_verified, email_verified, phone_verified, created_at FROM users WHERE role != 'admin'";
        let params = [];
        let paramIdx = 1;
        if (role) { sql += ' AND role = $' + paramIdx++; params.push(role); }
        sql += ' ORDER BY created_at DESC';
        const users = await queryAll(sql, params);
        res.json({ users, count: users.length });
    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// GET /api/admin/users/:id/detail — full detail view for a user or partner
router.get('/users/:id/detail', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = await queryOne(
            'SELECT id, email, full_name, phone, role, avatar_url, google_id, is_approved, is_verified, email_verified, phone_verified, admin_notes, created_at, updated_at FROM users WHERE id = $1',
            [userId]
        );
        if (!user) return res.status(404).json({ error: 'User not found' });

        let partnerProfile = null;
        if (user.role === 'partner') {
            partnerProfile = await queryOne(
                'SELECT company_name, description, location, whatsapp, telegram, categories, is_verified, created_at FROM partner_profiles WHERE user_id = $1',
                [userId]
            );
        }

        const vehicles = user.role === 'partner'
            ? await queryAll(
                'SELECT id, name, category, engine, gearbox, price_per_day, year, status, image_url, created_at FROM vehicles WHERE partner_id = $1 ORDER BY created_at DESC',
                [userId]
            )
            : [];

        let bookings = [];
        if (user.role === 'guest') {
            bookings = await queryAll(
                `SELECT b.id, b.pickup_date, b.dropoff_date, b.total_price, b.service_fee, b.status, b.payment_status, b.created_at,
                        v.name as vehicle_name, v.image_url,
                        pp.company_name as partner_company
                 FROM bookings b
                 JOIN vehicles v ON b.vehicle_id = v.id
                 LEFT JOIN partner_profiles pp ON b.partner_id = pp.user_id
                 WHERE b.guest_id = $1
                 ORDER BY b.created_at DESC`,
                [userId]
            );
        } else if (user.role === 'partner') {
            bookings = await queryAll(
                `SELECT b.id, b.pickup_date, b.dropoff_date, b.total_price, b.service_fee, b.status, b.payment_status, b.created_at,
                        v.name as vehicle_name, v.image_url,
                        u.full_name as guest_name, u.email as guest_email
                 FROM bookings b
                 JOIN vehicles v ON b.vehicle_id = v.id
                 JOIN users u ON b.guest_id = u.id
                 WHERE b.partner_id = $1
                 ORDER BY b.created_at DESC`,
                [userId]
            );
        }

        const totalBookings = bookings.length;
        const activeBookings = bookings.filter(b => ['pending', 'accepted', 'cancel_requested'].includes(b.status)).length;
        const totalRevenue = bookings
            .filter(b => ['accepted', 'completed'].includes(b.status))
            .reduce((sum, b) => sum + (parseFloat(b.total_price) || 0), 0);
        const totalServiceFees = bookings
            .filter(b => ['accepted', 'completed'].includes(b.status))
            .reduce((sum, b) => sum + (parseFloat(b.service_fee) || 0), 0);

        let reviews = [];
        if (user.role === 'guest') {
            reviews = await queryAll(
                'SELECT id, rating, title, body, created_at FROM reviews WHERE guest_id = $1 ORDER BY created_at DESC',
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

router.put('/users/:id/approve', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = await queryOne('SELECT * FROM users WHERE id = $1 AND role != $2', [userId, 'admin']);
        if (!user) return res.status(404).json({ error: 'User not found' });
        await execute('UPDATE users SET is_approved = 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
        res.json({ message: 'User approved' });
    } catch (err) {
        console.error('Approve user error:', err);
        res.status(500).json({ error: 'Failed to approve user' });
    }
});

router.put('/users/:id/reject', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = await queryOne('SELECT * FROM users WHERE id = $1 AND role != $2', [userId, 'admin']);
        if (!user) return res.status(404).json({ error: 'User not found' });
        await execute('DELETE FROM users WHERE id = $1', [userId]);
        res.json({ message: 'User rejected and removed' });
    } catch (err) {
        console.error('Reject user error:', err);
        res.status(500).json({ error: 'Failed to reject user' });
    }
});

router.delete('/users/:id', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = await queryOne('SELECT * FROM users WHERE id = $1 AND role != $2', [userId, 'admin']);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.role === 'partner') {
            await execute('DELETE FROM vehicles WHERE partner_id = $1', [userId]);
        }
        await execute('DELETE FROM users WHERE id = $1', [userId]);
        res.json({ message: 'User deleted' + (user.role === 'partner' ? ' (all vehicles removed)' : '') });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

router.put('/users/:id/suspend', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = await queryOne('SELECT * FROM users WHERE id = $1 AND role != $2', [userId, 'admin']);
        if (!user) return res.status(404).json({ error: 'User not found' });
        await execute('UPDATE users SET is_approved = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
        res.json({ message: 'User suspended' });
    } catch (err) {
        console.error('Suspend user error:', err);
        res.status(500).json({ error: 'Failed to suspend user' });
    }
});

router.put('/users/:id/unsuspend', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        await execute('UPDATE users SET is_approved = 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
        res.json({ message: 'User unsuspended' });
    } catch (err) {
        console.error('Unsuspend user error:', err);
        res.status(500).json({ error: 'Failed to unsuspend user' });
    }
});

router.put('/users/:id/edit', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = await queryOne('SELECT * FROM users WHERE id = $1 AND role != $2', [userId, 'admin']);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const { full_name, email, phone } = req.body;
        if (full_name) await execute('UPDATE users SET full_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [full_name.trim(), userId]);
        if (email) await execute('UPDATE users SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [email.trim(), userId]);
        if (phone !== undefined) await execute('UPDATE users SET phone = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [phone || null, userId]);
        res.json({ message: 'User updated' });
    } catch (err) {
        console.error('Edit user error:', err);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

router.put('/users/:id/notes', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { notes } = req.body;
        await execute('UPDATE users SET admin_notes = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [notes || null, userId]);
        res.json({ message: 'Notes saved' });
    } catch (err) {
        console.error('Save notes error:', err);
        res.status(500).json({ error: 'Failed to save notes' });
    }
});

// ========================================
// PARTNER MANAGEMENT
// ========================================
router.get('/partners', async (req, res) => {
    try {
        const partners = await queryAll(
            `SELECT u.id, u.email, u.full_name, u.phone, u.google_id, u.phone_verified, u.email_verified, u.is_verified as user_verified, u.created_at,
                    pp.company_name, pp.location, pp.is_verified, pp.description, pp.whatsapp, pp.telegram
             FROM users u
             LEFT JOIN partner_profiles pp ON u.id = pp.user_id
             WHERE u.role = 'partner'
             ORDER BY u.created_at DESC`
        );
        console.log('[Admin] GET /partners — found', partners.length, 'partner(s)');
        res.json({ partners, count: partners.length });
    } catch (err) {
        console.error('Get partners error:', err);
        res.status(500).json({ error: 'Failed to get partners' });
    }
});

router.put('/partners/:id/verify', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        await execute('UPDATE partner_profiles SET is_verified = 1 WHERE user_id = $1', [userId]);
        await execute('UPDATE users SET is_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
        res.json({ message: 'Partner verified' });
    } catch (err) {
        console.error('Verify partner error:', err);
        res.status(500).json({ error: 'Failed to verify partner' });
    }
});

router.put('/partners/:id/unverify', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        const activeBookings = await queryAll(
            `SELECT b.id, b.vehicle_id, b.pickup_date, b.dropoff_date, b.guest_id,
                    v.name as vehicle_name,
                    u.email as guest_email, u.full_name as guest_name
             FROM bookings b
             JOIN vehicles v ON b.vehicle_id = v.id
             JOIN users u ON b.guest_id = u.id
             WHERE b.partner_id = $1 AND b.status IN ('pending', 'accepted', 'cancel_requested')`,
            [userId]
        );

        if (activeBookings.length > 0) {
            await execute(
                "UPDATE bookings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE partner_id = $1 AND status IN ('pending', 'accepted', 'cancel_requested')",
                [userId]
            );

            for (var i = 0; i < activeBookings.length; i++) {
                var bk = activeBookings[i];
                await unblockDatesForBooking(bk.vehicle_id, bk.pickup_date, bk.dropoff_date);

                if (bk.guest_email) {
                    try {
                        await sendEmail({
                            to: bk.guest_email,
                            subject: 'Reservation Cancelled — ' + (bk.vehicle_name || 'Vehicle'),
                            text: 'Hello ' + (bk.guest_name || 'Guest') + ',\n\nYour reservation for ' + (bk.vehicle_name || 'a vehicle') + ' (' + bk.pickup_date + ' → ' + bk.dropoff_date + ') has been cancelled because the partner is no longer verified.\n\nWe apologize for the inconvenience. Please book another vehicle on RoyalCar.rent.\n\nBest regards,\nRoyalCar.rent Team',
                            html: '<p>Hello ' + escapeHtml(bk.guest_name || 'Guest') + ',</p><p>Your reservation for <strong>' + escapeHtml(bk.vehicle_name || 'a vehicle') + '</strong> (' + escapeHtml(bk.pickup_date) + ' → ' + escapeHtml(bk.dropoff_date) + ') has been cancelled because the partner is no longer verified.</p><p>We apologize for the inconvenience. Please book another vehicle on <a href="' + (process.env.BASE_URL || 'http://localhost:3000') + '">RoyalCar.rent</a>.</p>'
                        });
                    } catch (emailErr) {
                        console.error('Failed to notify guest #' + bk.guest_id + ':', emailErr.message);
                    }
                }
            }
        }

        await execute('UPDATE partner_profiles SET is_verified = 0 WHERE user_id = $1', [userId]);
        await execute('UPDATE users SET is_verified = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [userId]);

        res.json({
            message: 'Partner unverified' + (activeBookings.length > 0 ? '. ' + activeBookings.length + ' active booking(s) cancelled and guests notified.' : ''),
            cancelled_bookings: activeBookings.length
        });
    } catch (err) {
        console.error('Unverify partner error:', err);
        res.status(500).json({ error: 'Failed to unverify partner' });
    }
});

// ========================================
// VEHICLE MANAGEMENT
// ========================================
router.get('/vehicles', async (req, res) => {
    try {
        const vehicles = await queryAll(
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

router.put('/vehicles/:id/status', async (req, res) => {
    try {
        const vehicleId = parseInt(req.params.id);
        const { status } = req.body;
        if (!['active', 'inactive', 'pending', 'delete_requested'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        await execute('UPDATE vehicles SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [status, vehicleId]);
        res.json({ message: 'Vehicle status updated' });
    } catch (err) {
        console.error('Update vehicle status error:', err);
        res.status(500).json({ error: 'Failed to update vehicle status' });
    }
});

router.delete('/vehicles/:id/approve-delete', async (req, res) => {
    try {
        const vehicleId = parseInt(req.params.id);
        await execute('DELETE FROM vehicles WHERE id = $1', [vehicleId]);
        res.json({ message: 'Vehicle deletion approved and vehicle removed' });
    } catch (err) {
        console.error('Admin approve delete error:', err);
        res.status(500).json({ error: 'Failed to approve vehicle deletion' });
    }
});

router.put('/vehicles/:id/reject-delete', async (req, res) => {
    try {
        const vehicleId = parseInt(req.params.id);
        await execute("UPDATE vehicles SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [vehicleId]);
        res.json({ message: 'Vehicle deletion rejected, vehicle restored to active' });
    } catch (err) {
        console.error('Admin reject delete error:', err);
        res.status(500).json({ error: 'Failed to reject vehicle deletion' });
    }
});

router.delete('/vehicles/:id', async (req, res) => {
    try {
        const vehicleId = parseInt(req.params.id);
        await execute('DELETE FROM vehicles WHERE id = $1', [vehicleId]);
        res.json({ message: 'Vehicle deleted' });
    } catch (err) {
        console.error('Admin delete vehicle error:', err);
        res.status(500).json({ error: 'Failed to delete vehicle' });
    }
});

// ========================================
// BOOKING MANAGEMENT
// ========================================
router.get('/bookings', async (req, res) => {
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
        if (req.query.status) { sql += ' WHERE b.status = $1'; params.push(req.query.status); }
        sql += ' ORDER BY b.created_at DESC';
        const bookings = await queryAll(sql, params);
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

        var booking = await queryOne(
            `SELECT b.*, v.name as vehicle_name,
                    u.email as guest_email, u.full_name as guest_name,
                    pu.email as partner_email, pu.full_name as partner_name,
                    pp.company_name as partner_company
             FROM bookings b
             JOIN vehicles v ON b.vehicle_id = v.id
             JOIN users u ON b.guest_id = u.id
             JOIN users pu ON b.partner_id = pu.id
             LEFT JOIN partner_profiles pp ON b.partner_id = pp.user_id
             WHERE b.id = $1`,
            [bookingId]
        );
        if (!booking) return res.status(404).json({ error: 'Booking not found' });

        var validTransitions = {
            pending: ['accepted', 'rejected'],
            accepted: ['cancelled'],
            cancel_requested: ['cancelled', 'accepted']
        };
        var allowed = validTransitions[booking.status] || [];
        if (allowed.indexOf(status) === -1) {
            return res.status(400).json({ error: 'Cannot change from ' + booking.status + ' to ' + status });
        }

        await execute('UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [status, bookingId]);

        if (status === 'rejected' || status === 'cancelled') {
            await unblockDatesForBooking(booking.vehicle_id, booking.pickup_date, booking.dropoff_date);

            var pStatus = String(booking.payment_status || 'unpaid');
            if (pStatus === 'paid' && booking.paypal_capture_id && paypal.isConfigured()) {
                try {
                    await paypal.refundPayment(booking.paypal_capture_id, booking.service_fee, 'USD');
                    await execute("UPDATE bookings SET payment_status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [bookingId]);
                    console.log('Auto-refund processed for booking #' + bookingId);
                } catch (refundErr) {
                    console.error('Auto-refund failed for booking #' + bookingId + ':', refundErr.message);
                }
            }
        }

        if (status === 'accepted') {
            await blockDatesForBooking(booking.vehicle_id, booking.pickup_date, booking.dropoff_date);
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
router.get('/financial', async (req, res) => {
    try {
        var records = await queryAll(`
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

        var financial = records.filter(function(r) {
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
router.get('/promo-codes', async (req, res) => {
    try {
        const codes = await queryAll('SELECT * FROM promo_codes ORDER BY created_at DESC');
        res.json({ codes });
    } catch (err) {
        console.error('Get promo codes error:', err);
        res.status(500).json({ error: 'Failed to get promo codes' });
    }
});

router.post('/promo-codes', async (req, res) => {
    try {
        const { code, discount_type, discount_value, min_order, max_uses, valid_from, valid_until } = req.body;
        if (!code || !discount_type || !discount_value) {
            return res.status(400).json({ error: 'Code, discount type, and value are required' });
        }
        if (typeof code !== 'string' || code.length > 20 || !/^[A-Za-z0-9_-]+$/.test(code)) {
            return res.status(400).json({ error: 'Promo code must be alphanumeric, max 20 characters' });
        }
        var dv = parseFloat(discount_value);
        if (isNaN(dv) || dv <= 0) {
            return res.status(400).json({ error: 'Discount value must be a positive number' });
        }
        if (discount_type === 'percent' && dv > 100) {
            return res.status(400).json({ error: 'Percent discount cannot exceed 100%' });
        }
        if (!['percent', 'fixed'].includes(discount_type)) {
            return res.status(400).json({ error: 'Discount type must be percent or fixed' });
        }
        const existing = await queryOne('SELECT id FROM promo_codes WHERE code = $1', [code.toUpperCase()]);
        if (existing) return res.status(409).json({ error: 'Code already exists' });
        await execute(
            'INSERT INTO promo_codes (code, discount_type, discount_value, min_order, max_uses, valid_from, valid_until) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [code.toUpperCase(), discount_type, parseFloat(discount_value), parseFloat(min_order) || 0, parseInt(max_uses) || 0, valid_from || null, valid_until || null]
        );
        res.status(201).json({ message: 'Promo code created' });
    } catch (err) {
        console.error('Create promo code error:', err);
        res.status(500).json({ error: 'Failed to create promo code' });
    }
});

router.put('/promo-codes/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { is_active, max_uses, valid_until } = req.body;
        if (is_active !== undefined) await execute('UPDATE promo_codes SET is_active = $1 WHERE id = $2', [is_active ? 1 : 0, id]);
        if (max_uses !== undefined) await execute('UPDATE promo_codes SET max_uses = $1 WHERE id = $2', [parseInt(max_uses) || 0, id]);
        if (valid_until !== undefined) await execute('UPDATE promo_codes SET valid_until = $1 WHERE id = $2', [valid_until || null, id]);
        res.json({ message: 'Promo code updated' });
    } catch (err) {
        console.error('Update promo code error:', err);
        res.status(500).json({ error: 'Failed to update promo code' });
    }
});

router.delete('/promo-codes/:id', async (req, res) => {
    try {
        await execute('DELETE FROM promo_codes WHERE id = $1', [parseInt(req.params.id)]);
        res.json({ message: 'Promo code deleted' });
    } catch (err) {
        console.error('Delete promo code error:', err);
        res.status(500).json({ error: 'Failed to delete promo code' });
    }
});

// ========================================
// CSV EXPORT
// ========================================
router.get('/export/bookings', async (req, res) => {
    try {
        const rows = await queryAll(
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
            csv += [r.id, csvSafe(r.vehicle_name), csvSafe(r.guest_name), csvSafe(r.guest_email), csvSafe(r.partner_company),
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

router.get('/export/financial', async (req, res) => {
    try {
        const rows = await queryAll(
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
            csv += [r.id, csvSafe(r.vehicle_name), csvSafe(r.guest_name), csvSafe(r.guest_email),
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
router.post('/bulk/approve-vehicles', async (req, res) => {
    try {
        var result = await execute("UPDATE vehicles SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE status = 'pending'");
        res.json({ message: 'All pending vehicles approved', count: result.rowCount || 0 });
    } catch (err) {
        console.error('Bulk approve vehicles error:', err);
        res.status(500).json({ error: 'Failed to bulk approve' });
    }
});

router.post('/bulk/approve-partners', async (req, res) => {
    try {
        var result = await execute('UPDATE partner_profiles SET is_verified = 1 WHERE is_verified = 0 RETURNING user_id');
        if (result.rows && result.rows.length > 0) {
            var ids = result.rows.map(function(r) { return r.user_id; });
            await execute('UPDATE users SET is_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($1::int[])', [ids]);
        }
        res.json({ message: 'All unverified partners approved', count: result.rowCount || 0 });
    } catch (err) {
        console.error('Bulk approve partners error:', err);
        res.status(500).json({ error: 'Failed to bulk approve' });
    }
});

// ========================================
// ACTIVITY FEED
// ========================================
router.get('/activity', async (req, res) => {
    try {
        var activities = [];

        var recentUsers = await queryAll(
            "SELECT id, full_name, email, role, created_at FROM users WHERE created_at >= NOW() - INTERVAL '7 days' AND role != 'admin' ORDER BY created_at DESC LIMIT 20"
        );
        recentUsers.forEach(function(u) {
            activities.push({ type: 'registration', icon: 'user', text: (u.full_name || u.email) + ' registered as ' + u.role, time: u.created_at, id: u.id });
        });

        var recentBookings = await queryAll(
            `SELECT b.id, b.status, b.created_at, b.updated_at, v.name as vehicle_name, u.full_name as guest_name
             FROM bookings b JOIN vehicles v ON b.vehicle_id = v.id JOIN users u ON b.guest_id = u.id
             WHERE b.created_at >= NOW() - INTERVAL '7 days' ORDER BY b.created_at DESC LIMIT 20`
        );
        recentBookings.forEach(function(b) {
            activities.push({ type: 'booking', icon: 'calendar', text: (b.guest_name || 'Guest') + ' booked ' + (b.vehicle_name || 'vehicle') + ' — ' + b.status, time: b.created_at, id: b.id });
        });

        var recentVehicles = await queryAll(
            `SELECT v.id, v.name, v.status, v.created_at, u.full_name as partner_name
             FROM vehicles v JOIN users u ON v.partner_id = u.id
             WHERE v.created_at >= NOW() - INTERVAL '7 days' ORDER BY v.created_at DESC LIMIT 20`
        );
        recentVehicles.forEach(function(v) {
            activities.push({ type: 'vehicle', icon: 'car', text: (v.partner_name || 'Partner') + ' added ' + (v.name || 'vehicle') + ' — ' + v.status, time: v.created_at, id: v.id });
        });

        var recentChanges = await queryAll(
            `SELECT b.id, b.status, b.updated_at, v.name as vehicle_name, u.full_name as guest_name
             FROM bookings b JOIN vehicles v ON b.vehicle_id = v.id JOIN users u ON b.guest_id = u.id
             WHERE b.updated_at >= NOW() - INTERVAL '7 days' AND b.updated_at != b.created_at AND b.status != 'pending'
             ORDER BY b.updated_at DESC LIMIT 20`
        );
        recentChanges.forEach(function(b) {
            activities.push({ type: 'status_change', icon: 'check', text: (b.vehicle_name || 'Booking') + ' → ' + b.status + ' (guest: ' + (b.guest_name || '') + ')', time: b.updated_at, id: b.id });
        });

        activities.sort(function(a, b) { return new Date(b.time) - new Date(a.time); });

        res.json({ activities: activities.slice(0, 30) });
    } catch (err) {
        console.error('Activity feed error:', err);
        res.status(500).json({ error: 'Failed to load activity feed' });
    }
});

// ========================================
// ADMIN CHANGE PASSWORD
// ========================================
router.put('/change-password', async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }
        if (new_password.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters' });
        }
        if (!/[A-Z]/.test(new_password)) {
            return res.status(400).json({ error: 'New password must contain at least one uppercase letter' });
        }
        if (!/[0-9]/.test(new_password)) {
            return res.status(400).json({ error: 'New password must contain at least one number' });
        }
        if (!/[^A-Za-z0-9]/.test(new_password)) {
            return res.status(400).json({ error: 'New password must contain at least one special character' });
        }
        const admin = await queryOne('SELECT id, password_hash FROM users WHERE id = $1 AND role = $2', [req.user.id, 'admin']);
        if (!admin) return res.status(404).json({ error: 'Admin not found' });

        const bcrypt = require('bcryptjs');
        const valid = await bcrypt.compare(current_password, admin.password_hash);
        if (!valid) return res.status(403).json({ error: 'Current password is incorrect' });

        const newHash = await bcrypt.hash(new_password, 12);
        await execute('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newHash, admin.id]);

        res.json({ message: 'Password changed successfully' });
    } catch (err) {
        console.error('Admin change password error:', err);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

module.exports = router;
