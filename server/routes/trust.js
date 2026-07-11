const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { queryAll, queryOne, execute } = require('../db-helpers');

const router = express.Router();

var VALID_PLACEMENTS = ['cars', 'drivers', 'vehicles', 'blog', 'checkout'];

function sanitizeBadge(b, existing) {
    existing = existing || {};
    var rawList = Array.isArray(b.placements) ? b.placements
        : (b.placement !== undefined ? String(b.placement).split(',') : null);
    var placement;
    if (rawList) {
        var clean = rawList.map(function (x) { return String(x).trim(); })
            .filter(function (x) { return VALID_PLACEMENTS.indexOf(x) !== -1; });
        clean = clean.filter(function (x, i) { return clean.indexOf(x) === i; });
        placement = clean.length ? clean.join(',') : (existing.placement || 'cars');
    } else {
        placement = existing.placement || 'cars,drivers,vehicles,blog,checkout';
    }
    var out = {
        icon: b.icon !== undefined ? (b.icon ? String(b.icon).slice(0, 16) : null) : (existing.icon || null),
        label: b.label !== undefined ? (b.label ? String(b.label).slice(0, 120) : null) : (existing.label || null),
        placement: placement,
        position: b.position !== undefined ? Math.max(1, parseInt(b.position, 10) || 1) : (existing.position || 1),
        is_active: b.is_active !== undefined ? (b.is_active ? 1 : 0) : (existing.is_active !== undefined ? existing.is_active : 1)
    };
    ['ru', 'ka', 'he'].forEach(function (lng) {
        var k = 'label_' + lng;
        out[k] = b[k] !== undefined ? (b[k] ? String(b[k]).slice(0, 120) : null) : (existing[k] || null);
    });
    return out;
}

// =================== PUBLIC ===================
// GET /api/trust-badges?placement=cars — active badges for a page
router.get('/', async (req, res) => {
    try {
        var placement = VALID_PLACEMENTS.indexOf(req.query.placement) !== -1 ? req.query.placement : null;
        var sql = 'SELECT id, icon, label, label_ru, label_ka, label_he, placement, position FROM trust_badges WHERE is_active = 1';
        var params = [];
        if (placement) {
            sql += " AND (',' || COALESCE(placement,'') || ',') LIKE $1";
            params.push('%,' + placement + ',%');
        }
        sql += ' ORDER BY position ASC, id ASC';
        var rows = await queryAll(sql, params);
        res.json({ badges: rows });
    } catch (err) {
        console.error('List trust badges error:', err);
        res.status(500).json({ error: 'Failed to load trust badges' });
    }
});

// =================== ADMIN ===================
router.get('/admin/all', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        var rows = await queryAll('SELECT * FROM trust_badges ORDER BY position ASC, id ASC', []);
        res.json({ badges: rows });
    } catch (err) {
        console.error('Admin list trust badges error:', err);
        res.status(500).json({ error: 'Failed to load trust badges' });
    }
});

router.post('/admin', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        var a = sanitizeBadge(req.body, {});
        if (!a.label) return res.status(400).json({ error: 'Label is required' });
        await execute(
            `INSERT INTO trust_badges (icon, label, label_ru, label_ka, label_he, placement, position, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [a.icon, a.label, a.label_ru, a.label_ka, a.label_he, a.placement, a.position, a.is_active]
        );
        var created = await queryOne('SELECT * FROM trust_badges ORDER BY id DESC LIMIT 1', []);
        res.status(201).json({ message: 'Trust badge created', badge: created });
    } catch (err) {
        console.error('Create trust badge error:', err);
        res.status(500).json({ error: 'Failed to create trust badge' });
    }
});

router.put('/admin/:id', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        var id = parseInt(req.params.id, 10);
        var existing = await queryOne('SELECT * FROM trust_badges WHERE id = $1', [id]);
        if (!existing) return res.status(404).json({ error: 'Trust badge not found' });
        var a = sanitizeBadge(req.body, existing);
        if (!a.label) return res.status(400).json({ error: 'Label is required' });
        await execute(
            `UPDATE trust_badges SET icon=$1, label=$2, label_ru=$3, label_ka=$4, label_he=$5,
               placement=$6, position=$7, is_active=$8, updated_at=CURRENT_TIMESTAMP WHERE id=$9`,
            [a.icon, a.label, a.label_ru, a.label_ka, a.label_he, a.placement, a.position, a.is_active, id]
        );
        var updated = await queryOne('SELECT * FROM trust_badges WHERE id = $1', [id]);
        res.json({ message: 'Trust badge updated', badge: updated });
    } catch (err) {
        console.error('Update trust badge error:', err);
        res.status(500).json({ error: 'Failed to update trust badge' });
    }
});

router.delete('/admin/:id', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        var id = parseInt(req.params.id, 10);
        var r = await execute('DELETE FROM trust_badges WHERE id = $1', [id]);
        if (!r.rowCount) return res.status(404).json({ error: 'Trust badge not found' });
        res.json({ message: 'Trust badge deleted' });
    } catch (err) {
        console.error('Delete trust badge error:', err);
        res.status(500).json({ error: 'Failed to delete trust badge' });
    }
});

module.exports = router;
