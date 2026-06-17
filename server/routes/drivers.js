const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { queryAll, queryOne, execute } = require('../db-helpers');

const router = express.Router();

// ---- helpers ---------------------------------------------------------------

function parseLangs(val) {
    if (Array.isArray(val)) return val.filter(Boolean).map(String);
    if (typeof val === 'string') {
        try { var a = JSON.parse(val); return Array.isArray(a) ? a.filter(Boolean).map(String) : []; }
        catch (e) { return val.split(',').map(function (s) { return s.trim(); }).filter(Boolean); }
    }
    return [];
}

function sanitizeDriverInput(b, existing) {
    existing = existing || {};
    var unit = (b.price_unit === 'hour') ? 'hour' : (b.price_unit === 'day' ? 'day' : (existing.price_unit || 'day'));
    return {
        full_name: (b.full_name !== undefined ? String(b.full_name) : existing.full_name || '').trim().slice(0, 100),
        photo_url: b.photo_url !== undefined ? b.photo_url : (existing.photo_url || null),
        experience_years: b.experience_years !== undefined ? (parseInt(b.experience_years) || 0) : (existing.experience_years || 0),
        languages: b.languages !== undefined ? JSON.stringify(parseLangs(b.languages)) : (existing.languages || '[]'),
        has_own_vehicle: b.has_own_vehicle !== undefined ? (b.has_own_vehicle ? 1 : 0) : (existing.has_own_vehicle || 0),
        vehicle_info: b.vehicle_info !== undefined ? (b.vehicle_info ? String(b.vehicle_info).slice(0, 500) : null) : (existing.vehicle_info || null),
        price_amount: b.price_amount !== undefined ? (parseFloat(b.price_amount) || 0) : (existing.price_amount || 0),
        price_unit: unit,
        phone: b.phone !== undefined ? (b.phone ? String(b.phone).slice(0, 40) : null) : (existing.phone || null),
        whatsapp: b.whatsapp !== undefined ? (b.whatsapp ? String(b.whatsapp).slice(0, 40) : null) : (existing.whatsapp || null),
        bio: b.bio !== undefined ? (b.bio ? String(b.bio).slice(0, 2000) : null) : (existing.bio || null),
        location_city: b.location_city !== undefined ? (b.location_city ? String(b.location_city).slice(0, 100) : null) : (existing.location_city || null),
        country: b.country !== undefined ? (b.country || 'georgia') : (existing.country || 'georgia'),
        license_front: b.license_front !== undefined ? b.license_front : (existing.license_front || null),
        license_back: b.license_back !== undefined ? b.license_back : (existing.license_back || null),
        id_document: b.id_document !== undefined ? b.id_document : (existing.id_document || null)
    };
}

// =================== PUBLIC ===================

// GET /api/drivers — list approved drivers with filters + pagination
router.get('/', async (req, res) => {
    try {
        var where = ["d.status = 'approved'"];
        var params = [];
        var i = 1;

        // languages: comma-separated codes — match ANY
        var langs = req.query.languages ? String(req.query.languages).split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
        if (langs.length) {
            var ors = langs.map(function (code) {
                params.push('%"' + code.replace(/[^a-zA-Z_-]/g, '') + '"%');
                return 'd.languages LIKE $' + (i++);
            });
            where.push('(' + ors.join(' OR ') + ')');
        }
        if (req.query.min_rating) {
            where.push('d.rating >= $' + (i++));
            params.push(parseFloat(req.query.min_rating) || 0);
        }
        if (req.query.has_own_vehicle === '1' || req.query.has_own_vehicle === 'true') {
            where.push('d.has_own_vehicle = 1');
        }
        if (req.query.country) {
            where.push('d.country = $' + (i++));
            params.push(req.query.country);
        }
        if (req.query.location) {
            where.push('LOWER(d.location_city) = LOWER($' + (i++) + ')');
            params.push(req.query.location);
        }

        var whereSql = where.join(' AND ');

        var page = Math.max(1, parseInt(req.query.page) || 1);
        var limit = Math.min(48, Math.max(1, parseInt(req.query.limit) || 12));
        var offset = (page - 1) * limit;

        var countRow = await queryOne('SELECT COUNT(*)::int AS total FROM drivers d WHERE ' + whereSql, params);
        var total = countRow ? countRow.total : 0;

        var listParams = params.slice();
        listParams.push(limit); var limIdx = i++;
        listParams.push(offset); var offIdx = i++;

        var rows = await queryAll(
            'SELECT d.id, d.full_name, d.photo_url, d.experience_years, d.languages, ' +
            'd.has_own_vehicle, d.vehicle_info, d.price_amount, d.price_unit, d.phone, d.whatsapp, ' +
            'd.bio, d.location_city, d.country, d.is_verified, d.rating, d.reviews_count ' +
            'FROM drivers d WHERE ' + whereSql +
            ' ORDER BY d.priority DESC, d.is_verified DESC, d.rating DESC, d.created_at DESC' +
            ' LIMIT $' + limIdx + ' OFFSET $' + offIdx,
            listParams
        );

        res.json({
            drivers: rows,
            total: total,
            page: page,
            limit: limit,
            hasMore: offset + rows.length < total
        });
    } catch (err) {
        console.error('List drivers error:', err);
        res.status(500).json({ error: 'Failed to load drivers' });
    }
});

// =================== PARTNER ===================

// GET /api/drivers/mine — partner's own drivers (any status)
router.get('/mine', authenticateToken, requireRole('partner'), async (req, res) => {
    try {
        var rows = await queryAll('SELECT * FROM drivers WHERE partner_id = $1 ORDER BY created_at DESC', [req.user.id]);
        res.json({ drivers: rows });
    } catch (err) {
        console.error('My drivers error:', err);
        res.status(500).json({ error: 'Failed to load your drivers' });
    }
});

// POST /api/drivers — add a driver (partner only, must be verified). Defaults to pending.
router.post('/', authenticateToken, requireRole('partner'), async (req, res) => {
    try {
        var partnerProfile = await queryOne('SELECT is_verified FROM partner_profiles WHERE user_id = $1', [req.user.id]);
        if (!partnerProfile || !partnerProfile.is_verified) {
            return res.status(403).json({ error: 'Your partner account must be verified by admin before you can add drivers.' });
        }
        var d = sanitizeDriverInput(req.body, {});
        if (!d.full_name) {
            return res.status(400).json({ error: 'Driver name is required' });
        }
        await execute(
            `INSERT INTO drivers
             (partner_id, full_name, photo_url, experience_years, languages, has_own_vehicle, vehicle_info,
              price_amount, price_unit, phone, whatsapp, bio, location_city, country,
              license_front, license_back, id_document, status, is_verified)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'pending',0)`,
            [req.user.id, d.full_name, d.photo_url, d.experience_years, d.languages, d.has_own_vehicle, d.vehicle_info,
             d.price_amount, d.price_unit, d.phone, d.whatsapp, d.bio, d.location_city, d.country,
             d.license_front, d.license_back, d.id_document]
        );
        var created = await queryOne('SELECT * FROM drivers WHERE partner_id = $1 ORDER BY id DESC LIMIT 1', [req.user.id]);

        (async () => {
            try {
                var pp = await queryOne('SELECT company_name FROM partner_profiles WHERE user_id = $1', [req.user.id]);
                await require('../services/notify').notifyOwner('🧑\u200d✈️ New driver pending approval\n' + d.full_name + (pp && pp.company_name ? ' — ' + pp.company_name : '') + '\nReview it in the admin panel.');
            } catch (e) { console.error('[notify] driver:', e.message); }
        })();

        res.status(201).json({ message: 'Driver submitted! It will appear after admin approval.', driver: created });
    } catch (err) {
        console.error('Add driver error:', err);
        res.status(500).json({ error: 'Failed to add driver' });
    }
});

// PUT /api/drivers/:id — update own driver (resets to pending for re-moderation)
router.put('/:id', authenticateToken, requireRole('partner'), async (req, res) => {
    try {
        var id = parseInt(req.params.id);
        var existing = await queryOne('SELECT * FROM drivers WHERE id = $1 AND partner_id = $2', [id, req.user.id]);
        if (!existing) return res.status(404).json({ error: 'Driver not found or not yours' });

        var d = sanitizeDriverInput(req.body, existing);
        if (!d.full_name) return res.status(400).json({ error: 'Driver name is required' });

        await execute(
            `UPDATE drivers SET
               full_name=$1, photo_url=$2, experience_years=$3, languages=$4, has_own_vehicle=$5, vehicle_info=$6,
               price_amount=$7, price_unit=$8, phone=$9, whatsapp=$10, bio=$11, location_city=$12, country=$13,
               license_front=$14, license_back=$15, id_document=$16,
               status='pending', is_verified=0, updated_at=CURRENT_TIMESTAMP
             WHERE id=$17 AND partner_id=$18`,
            [d.full_name, d.photo_url, d.experience_years, d.languages, d.has_own_vehicle, d.vehicle_info,
             d.price_amount, d.price_unit, d.phone, d.whatsapp, d.bio, d.location_city, d.country,
             d.license_front, d.license_back, d.id_document, id, req.user.id]
        );
        var updated = await queryOne('SELECT * FROM drivers WHERE id = $1', [id]);
        res.json({ message: 'Driver updated. It will be re-reviewed by admin.', driver: updated });
    } catch (err) {
        console.error('Update driver error:', err);
        res.status(500).json({ error: 'Failed to update driver' });
    }
});

// DELETE /api/drivers/:id — delete own driver
router.delete('/:id', authenticateToken, requireRole('partner'), async (req, res) => {
    try {
        var id = parseInt(req.params.id);
        var result = await execute('DELETE FROM drivers WHERE id = $1 AND partner_id = $2', [id, req.user.id]);
        if (!result.rowCount) return res.status(404).json({ error: 'Driver not found or not yours' });
        res.json({ message: 'Driver deleted' });
    } catch (err) {
        console.error('Delete driver error:', err);
        res.status(500).json({ error: 'Failed to delete driver' });
    }
});

// =================== PUBLIC DETAIL (kept after /mine to avoid route clash) ===================

// GET /api/drivers/:id — approved driver detail (public)
router.get('/:id', async (req, res) => {
    try {
        var id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ error: 'Invalid driver id' });
        var d = await queryOne(
            'SELECT id, full_name, photo_url, experience_years, languages, has_own_vehicle, vehicle_info, ' +
            'price_amount, price_unit, phone, whatsapp, bio, location_city, country, is_verified, rating, reviews_count ' +
            "FROM drivers WHERE id = $1 AND status = 'approved'",
            [id]
        );
        if (!d) return res.status(404).json({ error: 'Driver not found' });
        var reviews = await queryAll(
            `SELECT dr.id, dr.rating_score, dr.review_text, dr.created_at,
                    u.full_name AS customer_name
             FROM driver_reviews dr
             JOIN users u ON dr.customer_id = u.id
             WHERE dr.driver_id = $1 AND dr.is_hidden = 0
             ORDER BY dr.created_at DESC LIMIT 10`,
            [id]
        );
        res.json({ driver: d, reviews: reviews });
    } catch (err) {
        console.error('Get driver error:', err);
        res.status(500).json({ error: 'Failed to load driver' });
    }
});

// =================== ADMIN ===================

// GET /api/drivers/admin/all — all drivers with partner info (optional ?status=)
router.get('/admin/all', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        var sql = `SELECT d.*, u.full_name AS partner_name, u.email AS partner_email, pp.company_name
                   FROM drivers d
                   JOIN users u ON d.partner_id = u.id
                   LEFT JOIN partner_profiles pp ON u.id = pp.user_id`;
        var params = [];
        if (req.query.status) { sql += ' WHERE d.status = $1'; params.push(req.query.status); }
        sql += ' ORDER BY (d.status = \'pending\') DESC, d.created_at DESC';
        var rows = await queryAll(sql, params);
        res.json({ drivers: rows });
    } catch (err) {
        console.error('Admin list drivers error:', err);
        res.status(500).json({ error: 'Failed to load drivers' });
    }
});

// PUT /api/drivers/admin/:id/status — approve / reject / pending
router.put('/admin/:id/status', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        var id = parseInt(req.params.id);
        var status = req.body.status;
        if (['pending', 'approved', 'rejected'].indexOf(status) === -1) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        var r = await execute('UPDATE drivers SET status=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2', [status, id]);
        if (!r.rowCount) return res.status(404).json({ error: 'Driver not found' });
        res.json({ message: 'Status updated' });
    } catch (err) {
        console.error('Admin driver status error:', err);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// PUT /api/drivers/admin/:id/verify — set verified badge
router.put('/admin/:id/verify', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        var id = parseInt(req.params.id);
        var verified = req.body.is_verified ? 1 : 0;
        var r = await execute('UPDATE drivers SET is_verified=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2', [verified, id]);
        if (!r.rowCount) return res.status(404).json({ error: 'Driver not found' });
        res.json({ message: 'Verification updated' });
    } catch (err) {
        console.error('Admin driver verify error:', err);
        res.status(500).json({ error: 'Failed to update verification' });
    }
});

// PUT /api/drivers/admin/:id — full edit (admin CRUD) incl rating/priority/status/verify
router.put('/admin/:id', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        var id = parseInt(req.params.id);
        var existing = await queryOne('SELECT * FROM drivers WHERE id = $1', [id]);
        if (!existing) return res.status(404).json({ error: 'Driver not found' });
        var d = sanitizeDriverInput(req.body, existing);
        var b = req.body;
        var status = ['pending', 'approved', 'rejected'].indexOf(b.status) !== -1 ? b.status : existing.status;
        var isVerified = b.is_verified !== undefined ? (b.is_verified ? 1 : 0) : existing.is_verified;
        var rating = b.rating !== undefined ? Math.max(0, Math.min(5, parseFloat(b.rating) || 0)) : existing.rating;
        var reviewsCount = b.reviews_count !== undefined ? (parseInt(b.reviews_count) || 0) : existing.reviews_count;
        var priority = b.priority !== undefined ? (parseInt(b.priority) || 0) : existing.priority;

        await execute(
            `UPDATE drivers SET
               full_name=$1, photo_url=$2, experience_years=$3, languages=$4, has_own_vehicle=$5, vehicle_info=$6,
               price_amount=$7, price_unit=$8, phone=$9, whatsapp=$10, bio=$11, location_city=$12, country=$13,
               license_front=$14, license_back=$15, id_document=$16,
               status=$17, is_verified=$18, rating=$19, reviews_count=$20, priority=$21, updated_at=CURRENT_TIMESTAMP
             WHERE id=$22`,
            [d.full_name, d.photo_url, d.experience_years, d.languages, d.has_own_vehicle, d.vehicle_info,
             d.price_amount, d.price_unit, d.phone, d.whatsapp, d.bio, d.location_city, d.country,
             d.license_front, d.license_back, d.id_document,
             status, isVerified, rating, reviewsCount, priority, id]
        );
        var updated = await queryOne('SELECT * FROM drivers WHERE id = $1', [id]);
        res.json({ message: 'Driver updated', driver: updated });
    } catch (err) {
        console.error('Admin driver edit error:', err);
        res.status(500).json({ error: 'Failed to update driver' });
    }
});

// DELETE /api/drivers/admin/:id — admin delete any driver
router.delete('/admin/:id', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        var id = parseInt(req.params.id);
        var r = await execute('DELETE FROM drivers WHERE id = $1', [id]);
        if (!r.rowCount) return res.status(404).json({ error: 'Driver not found' });
        res.json({ message: 'Driver deleted' });
    } catch (err) {
        console.error('Admin driver delete error:', err);
        res.status(500).json({ error: 'Failed to delete driver' });
    }
});

module.exports = router;
