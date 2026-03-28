const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { queryAll, queryOne, execute } = require('../db-helpers');

const router = express.Router();

// GET /api/reviews — public list (optionally filter by vehicle_id)
router.get('/', async (req, res) => {
    try {
        var sql = `
            SELECT r.*, u.full_name as guest_name,
                   v.name as vehicle_name, v.category as vehicle_category
            FROM reviews r
            JOIN users u ON r.guest_id = u.id
            LEFT JOIN vehicles v ON r.vehicle_id = v.id`;
        var params = [];
        var paramIdx = 1;
        if (req.query.vehicle_id) {
            sql += ' WHERE r.vehicle_id = $' + paramIdx++;
            params.push(parseInt(req.query.vehicle_id));
        }
        sql += ' ORDER BY r.created_at DESC';
        if (req.query.limit) {
            sql += ' LIMIT $' + paramIdx++;
            params.push(Math.min(parseInt(req.query.limit) || 20, 100));
        }

        var reviews = await queryAll(sql, params);
        var avgRating = reviews.length
            ? Math.round(reviews.reduce(function(s, r) { return s + r.rating; }, 0) / reviews.length * 10) / 10
            : 0;

        res.json({ reviews, count: reviews.length, avg_rating: avgRating });
    } catch (err) {
        console.error('Get reviews error:', err);
        res.status(500).json({ error: 'Failed to get reviews' });
    }
});

// GET /api/reviews/stats — overall rating stats
router.get('/stats', async (req, res) => {
    try {
        var reviews = await queryAll('SELECT rating FROM reviews');
        var total = reviews.length;
        var avg = total ? Math.round(reviews.reduce(function(s, r) { return s + r.rating; }, 0) / total * 10) / 10 : 0;
        var dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        reviews.forEach(function(r) { dist[r.rating] = (dist[r.rating] || 0) + 1; });
        res.json({ total, avg_rating: avg, distribution: dist });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// POST /api/reviews — guest submits a review
router.post('/', authenticateToken, requireRole('guest'), async (req, res) => {
    try {
        var { vehicle_id, booking_id, rating, title, body } = req.body;

        if (!rating || !body) {
            return res.status(400).json({ error: 'rating and body are required' });
        }
        rating = parseInt(rating);
        if (rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'rating must be 1–5' });
        }

        // If booking_id given, verify ownership
        if (booking_id) {
            var booking = await queryOne('SELECT * FROM bookings WHERE id = $1 AND guest_id = $2', [booking_id, req.user.id]);
            if (!booking) return res.status(403).json({ error: 'Booking not found or not yours' });
            if (booking.status !== 'confirmed' && booking.status !== 'completed') {
                return res.status(400).json({ error: 'Can only review confirmed or completed bookings' });
            }
            // Check not already reviewed
            var existing = await queryOne('SELECT id FROM reviews WHERE booking_id = $1 AND guest_id = $2', [booking_id, req.user.id]);
            if (existing) return res.status(409).json({ error: 'You already reviewed this booking' });
            if (!vehicle_id) vehicle_id = booking.vehicle_id;
        }

        await execute(
            `INSERT INTO reviews (guest_id, vehicle_id, booking_id, rating, title, body)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.user.id, vehicle_id || null, booking_id || null, rating, title || null, body]
        );

        var review = await queryOne(
            'SELECT id FROM reviews WHERE guest_id = $1 ORDER BY id DESC LIMIT 1',
            [req.user.id]
        );

        res.status(201).json({ message: 'Review submitted', review_id: review.id });
    } catch (err) {
        console.error('Post review error:', err);
        res.status(500).json({ error: 'Failed to submit review' });
    }
});

// DELETE /api/reviews/:id — guest deletes own review
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        var reviewId = parseInt(req.params.id);
        var review = await queryOne('SELECT * FROM reviews WHERE id = $1', [reviewId]);
        if (!review) return res.status(404).json({ error: 'Review not found' });
        if (review.guest_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not your review' });
        }
        await execute('DELETE FROM reviews WHERE id = $1', [reviewId]);
        res.json({ message: 'Review deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete review' });
    }
});

module.exports = router;
