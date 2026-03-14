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

router.put('/users/:id/ban', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = queryOne('SELECT * FROM users WHERE id = ? AND role != ?', [userId, 'admin']);
        if (!user) return res.status(404).json({ error: 'User not found' });
        // Toggle ban by changing role to 'banned' or restoring
        // For simplicity, we use a 'banned' status approach — set role to original + suffix
        // Actually, let's add a simple banned flag approach via a convention
        // We'll just delete for now and add suspend later if needed
        execute("UPDATE users SET role = 'banned_' || role WHERE id = ? AND role NOT LIKE 'banned_%'", [userId]);
        res.json({ message: 'User suspended' });
    } catch (err) {
        console.error('Ban user error:', err);
        res.status(500).json({ error: 'Failed to suspend user' });
    }
});

router.put('/users/:id/unban', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        execute("UPDATE users SET role = REPLACE(role, 'banned_', '') WHERE id = ?", [userId]);
        res.json({ message: 'User unsuspended' });
    } catch (err) {
        console.error('Unban user error:', err);
        res.status(500).json({ error: 'Failed to unsuspend user' });
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
router.get('/financial', authenticateToken, requireRole('admin'), (req, res) => {
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

module.exports = router;
