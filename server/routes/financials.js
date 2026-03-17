const express = require('express');
const router = express.Router();
const { queryOne, queryAll } = require('../db-helpers');
const { authenticateToken, requireRole } = require('../middleware/auth');

var PARTNER_SHARE = 0.70;

var EARNING_STATUSES = "('accepted', 'completed', 'cancel_requested')";

router.get('/overview', authenticateToken, requireRole('partner'), async function(req, res) {
    try {
        var partnerId = req.user.id;
        var period = req.query.period || '30';

        var dateFilter = '';
        if (period !== 'all') {
            var days = parseInt(period) || 30;
            dateFilter = "AND b.created_at >= NOW() - INTERVAL '" + days + " days'";
        }

        var activeVehiclesRow = await queryOne(
            "SELECT COUNT(*) as count FROM vehicles WHERE partner_id = $1 AND status = 'active'",
            [partnerId]
        );

        var bookingsRow = await queryOne(
            "SELECT COUNT(*) as count, COALESCE(SUM(b.rental_days), 0) as total_days " +
            "FROM bookings b WHERE b.partner_id = $1 AND b.status IN " + EARNING_STATUSES + " " + dateFilter,
            [partnerId]
        );

        var upcomingRow = await queryOne(
            "SELECT COUNT(*) as count FROM bookings b " +
            "WHERE b.partner_id = $1 AND b.status = 'accepted' AND b.pickup_date >= CURRENT_DATE::text",
            [partnerId]
        );

        var earningsRow = await queryOne(
            "SELECT COALESCE(SUM(b.total_price * " + PARTNER_SHARE + "), 0) as total " +
            "FROM bookings b WHERE b.partner_id = $1 AND b.status IN " + EARNING_STATUSES + " " + dateFilter,
            [partnerId]
        );

        var previousEarnings = 0;
        if (period !== 'all') {
            var d = parseInt(period) || 30;
            var prevRow = await queryOne(
                "SELECT COALESCE(SUM(b.total_price * " + PARTNER_SHARE + "), 0) as total " +
                "FROM bookings b WHERE b.partner_id = $1 AND b.status IN " + EARNING_STATUSES + " " +
                "AND b.created_at >= NOW() - INTERVAL '" + (d * 2) + " days' " +
                "AND b.created_at < NOW() - INTERVAL '" + d + " days'",
                [partnerId]
            );
            previousEarnings = (prevRow && prevRow.total) || 0;
        }

        var currentEarnings = (earningsRow && earningsRow.total) || 0;
        var earningsChange = 0;
        if (previousEarnings > 0) {
            earningsChange = ((currentEarnings - previousEarnings) / previousEarnings) * 100;
        } else if (currentEarnings > 0) {
            earningsChange = 100;
        }

        var earningsData = await generateEarningsData(partnerId, period);
        var statusData = await generateStatusData(partnerId);
        var recentBookings = await getRecentBookings(partnerId, 20);

        res.json({
            stats: {
                totalEarnings: Math.round(currentEarnings * 100) / 100,
                activeVehicles: parseInt((activeVehiclesRow && activeVehiclesRow.count) || 0),
                completedBookings: parseInt((bookingsRow && bookingsRow.count) || 0),
                completedDays: Math.round((bookingsRow && bookingsRow.total_days) || 0),
                upcomingBookings: parseInt((upcomingRow && upcomingRow.count) || 0),
                earningsChange: Math.round(earningsChange * 10) / 10
            },
            earningsData: earningsData,
            statusData: statusData,
            recentBookings: recentBookings
        });
    } catch (err) {
        console.error('Financial overview error:', err);
        res.status(500).json({ error: 'Failed to load financial data' });
    }
});

async function generateEarningsData(partnerId, period) {
    var days = period === 'all' ? 30 : (parseInt(period) || 30);
    var limit = Math.min(days, 30);

    var data = [];
    for (var i = limit - 1; i >= 0; i--) {
        var date = new Date();
        date.setDate(date.getDate() - i);
        var dateStr = date.toISOString().split('T')[0];

        var row = await queryOne(
            "SELECT COALESCE(SUM(b.total_price * " + PARTNER_SHARE + "), 0) as total " +
            "FROM bookings b WHERE b.partner_id = $1 AND b.status IN " + EARNING_STATUSES + " " +
            "AND b.created_at::date = $2::date",
            [partnerId, dateStr]
        );

        data.push({
            date: formatDateLabel(date, i),
            earnings: Math.round(((row && row.total) || 0) * 100) / 100
        });
    }

    return data;
}

function formatDateLabel(date, daysAgo) {
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (daysAgo === 0) return 'Today';
    if (daysAgo === 1) return 'Yesterday';
    return months[date.getMonth()] + ' ' + date.getDate();
}

async function generateStatusData(partnerId) {
    var statuses = ['completed', 'accepted', 'pending', 'cancelled', 'rejected'];
    var labels = { completed: 'Completed', accepted: 'Active', pending: 'Pending', cancelled: 'Cancelled', rejected: 'Rejected' };
    var data = [];

    for (var i = 0; i < statuses.length; i++) {
        var status = statuses[i];
        var row = await queryOne(
            "SELECT COUNT(*) as count FROM bookings WHERE partner_id = $1 AND status = $2",
            [partnerId, status]
        );
        var count = parseInt((row && row.count) || 0);
        if (count > 0) {
            data.push({
                status: labels[status] || status,
                count: count
            });
        }
    }

    if (data.length === 0) {
        data.push({ status: 'No Data', count: 1 });
    }

    return data;
}

async function getRecentBookings(partnerId, limit) {
    var bookings = await queryAll(
        "SELECT b.id, b.pickup_date, b.dropoff_date, b.status, b.total_price, " +
        "u.full_name as customer_name, v.name as vehicle_name " +
        "FROM bookings b " +
        "JOIN vehicles v ON b.vehicle_id = v.id " +
        "JOIN users u ON b.guest_id = u.id " +
        "WHERE b.partner_id = $1 " +
        "ORDER BY b.created_at DESC LIMIT $2",
        [partnerId, limit]
    );

    return bookings.map(function(booking) {
        return {
            id: String(booking.id),
            customer_name: booking.customer_name || 'Unknown',
            vehicle_name: booking.vehicle_name || 'Unknown Vehicle',
            pickup_date: booking.pickup_date,
            dropoff_date: booking.dropoff_date,
            status: booking.status,
            partner_earnings: Math.round((booking.total_price * PARTNER_SHARE) * 100) / 100
        };
    });
}

module.exports = router;
