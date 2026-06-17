const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { queryAll, queryOne, execute } = require('../db-helpers');

const router = express.Router();

// Recalculate and update a driver's rating + reviews_count
async function recalcDriverRating(driverId) {
    var row = await queryOne(
        `SELECT COALESCE(AVG(rating_score), 0) AS avg_rating,
                COUNT(*) AS total
         FROM driver_reviews WHERE driver_id = $1 AND is_hidden = 0`,
        [driverId]
    );
    var avg = row ? Math.round(parseFloat(row.avg_rating) * 10) / 10 : 0;
    var total = row ? parseInt(row.total) : 0;
    await execute(
        'UPDATE drivers SET rating = $1, reviews_count = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [avg, total, driverId]
    );
}

// =================== PUBLIC ===================

// GET /api/driver-reviews?driver_id= — list visible reviews for a driver
router.get('/', async (req, res) => {
    try {
        var driverId = parseInt(req.query.driver_id);
        if (!driverId) return res.status(400).json({ error: 'driver_id is required' });

        var reviews = await queryAll(
            `SELECT dr.id, dr.rating_score, dr.review_text, dr.created_at,
                    u.full_name AS customer_name
             FROM driver_reviews dr
             JOIN users u ON dr.customer_id = u.id
             WHERE dr.driver_id = $1 AND dr.is_hidden = 0
             ORDER BY dr.created_at DESC`,
            [driverId]
        );

        var stats = await queryOne(
            `SELECT COALESCE(AVG(rating_score), 0) AS avg_rating, COUNT(*) AS total
             FROM driver_reviews WHERE driver_id = $1 AND is_hidden = 0`,
            [driverId]
        );

        res.json({
            reviews: reviews,
            avg_rating: stats ? Math.round(parseFloat(stats.avg_rating) * 10) / 10 : 0,
            total: stats ? parseInt(stats.total) : 0
        });
    } catch (err) {
        console.error('List driver reviews error:', err);
        res.status(500).json({ error: 'Failed to load reviews' });
    }
});

// =================== AUTHENTICATED ===================

// POST /api/driver-reviews — customer submits a review
router.post('/', authenticateToken, async (req, res) => {
    try {
        var { driver_id, rating_score, review_text } = req.body;
        driver_id = parseInt(driver_id);
        rating_score = parseInt(rating_score);

        if (!driver_id || !rating_score) {
            return res.status(400).json({ error: 'driver_id and rating_score are required' });
        }
        if (rating_score < 1 || rating_score > 5) {
            return res.status(400).json({ error: 'rating_score must be 1–5' });
        }
        if (review_text && typeof review_text === 'string' && review_text.length > 2000) {
            return res.status(400).json({ error: 'Review text too long (max 2000 characters)' });
        }

        // Verify driver exists and is approved
        var driver = await queryOne("SELECT id FROM drivers WHERE id = $1 AND status = 'approved'", [driver_id]);
        if (!driver) return res.status(404).json({ error: 'Driver not found or not approved' });

        // Check user has at least one confirmed/completed booking (practical restriction)
        var hasBooking = await queryOne(
            "SELECT id FROM bookings WHERE guest_id = $1 AND status IN ('confirmed', 'completed') LIMIT 1",
            [req.user.id]
        );
        if (!hasBooking) {
            return res.status(403).json({ error: 'Only customers with a completed booking can leave a review' });
        }

        // Check not already reviewed this driver
        var existing = await queryOne(
            'SELECT id FROM driver_reviews WHERE driver_id = $1 AND customer_id = $2',
            [driver_id, req.user.id]
        );
        if (existing) return res.status(409).json({ error: 'You already reviewed this driver' });

        await execute(
            `INSERT INTO driver_reviews (driver_id, customer_id, rating_score, review_text)
             VALUES ($1, $2, $3, $4)`,
            [driver_id, req.user.id, rating_score, review_text || null]
        );

        await recalcDriverRating(driver_id);

        var review = await queryOne(
            `SELECT dr.id, dr.rating_score, dr.review_text, dr.created_at,
                    u.full_name AS customer_name
             FROM driver_reviews dr
             JOIN users u ON dr.customer_id = u.id
             WHERE dr.driver_id = $1 AND dr.customer_id = $2
             ORDER BY dr.id DESC LIMIT 1`,
            [driver_id, req.user.id]
        );

        res.status(201).json({ message: 'Review submitted', review: review });
    } catch (err) {
        console.error('Post driver review error:', err);
        res.status(500).json({ error: 'Failed to submit review' });
    }
});

// DELETE /api/driver-reviews/:id — customer deletes own review, admin can delete any
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        var reviewId = parseInt(req.params.id);
        var review = await queryOne('SELECT * FROM driver_reviews WHERE id = $1', [reviewId]);
        if (!review) return res.status(404).json({ error: 'Review not found' });
        if (review.customer_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not your review' });
        }
        await execute('DELETE FROM driver_reviews WHERE id = $1', [reviewId]);
        await recalcDriverRating(review.driver_id);
        res.json({ message: 'Review deleted' });
    } catch (err) {
        console.error('Delete driver review error:', err);
        res.status(500).json({ error: 'Failed to delete review' });
    }
});

// =================== ADMIN ===================

// GET /api/driver-reviews/admin/all — all reviews for moderation
router.get('/admin/all', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        var reviews = await queryAll(
            `SELECT dr.id, dr.rating_score, dr.review_text, dr.is_hidden, dr.created_at,
                    dr.driver_id, d.full_name AS driver_name,
                    u.full_name AS customer_name, u.email AS customer_email
             FROM driver_reviews dr
             JOIN drivers d ON dr.driver_id = d.id
             JOIN users u ON dr.customer_id = u.id
             ORDER BY dr.created_at DESC`
        );
        res.json({ reviews: reviews });
    } catch (err) {
        console.error('Admin list driver reviews error:', err);
        res.status(500).json({ error: 'Failed to load reviews' });
    }
});

// PUT /api/driver-reviews/admin/:id/hide — toggle hide/unhide a review
router.put('/admin/:id/hide', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        var reviewId = parseInt(req.params.id);
        var review = await queryOne('SELECT * FROM driver_reviews WHERE id = $1', [reviewId]);
        if (!review) return res.status(404).json({ error: 'Review not found' });
        var nextHidden = review.is_hidden ? 0 : 1;
        await execute('UPDATE driver_reviews SET is_hidden = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [nextHidden, reviewId]);
        await recalcDriverRating(review.driver_id);
        res.json({ message: nextHidden ? 'Review hidden' : 'Review visible', is_hidden: nextHidden });
    } catch (err) {
        console.error('Hide driver review error:', err);
        res.status(500).json({ error: 'Failed to update review' });
    }
});

// =================== PARTNER ===================

// GET /api/driver-reviews/partner/mine — reviews for partner's drivers
router.get('/partner/mine', authenticateToken, requireRole('partner'), async (req, res) => {
    try {
        var reviews = await queryAll(
            `SELECT dr.id, dr.rating_score, dr.review_text, dr.created_at,
                    dr.driver_id, d.full_name AS driver_name,
                    u.full_name AS customer_name
             FROM driver_reviews dr
             JOIN drivers d ON dr.driver_id = d.id
             JOIN users u ON dr.customer_id = u.id
             WHERE d.partner_id = $1 AND dr.is_hidden = 0
             ORDER BY dr.created_at DESC`,
            [req.user.id]
        );

        var stats = await queryAll(
            `SELECT d.id, d.full_name, d.rating, d.reviews_count
             FROM drivers d
             WHERE d.partner_id = $1 AND d.status = 'approved'`,
            [req.user.id]
        );

        res.json({ reviews: reviews, stats: stats });
    } catch (err) {
        console.error('Partner driver reviews error:', err);
        res.status(500).json({ error: 'Failed to load reviews' });
    }
});

module.exports = router;
