const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { queryAll, queryOne, execute } = require('../db-helpers');

const router = express.Router();

function sanitizeAd(b, existing) {
    existing = existing || {};
    var placement = ['cars', 'drivers', 'both'].indexOf(b.placement) !== -1 ? b.placement : (existing.placement || 'cars');
    return {
        title: b.title !== undefined ? (b.title ? String(b.title).slice(0, 200) : null) : (existing.title || null),
        description: b.description !== undefined ? (b.description ? String(b.description).slice(0, 1000) : null) : (existing.description || null),
        cover_url: b.cover_url !== undefined ? b.cover_url : (existing.cover_url || null),
        target_link: b.target_link !== undefined ? String(b.target_link || '').slice(0, 1000) : (existing.target_link || ''),
        cta_text: b.cta_text !== undefined ? (b.cta_text ? String(b.cta_text).slice(0, 60) : null) : (existing.cta_text || null),
        placement: placement,
        position: b.position !== undefined ? Math.max(1, parseInt(b.position) || 4) : (existing.position || 4),
        is_active: b.is_active !== undefined ? (b.is_active ? 1 : 0) : (existing.is_active !== undefined ? existing.is_active : 1)
    };
}

// =================== PUBLIC ===================

// GET /api/ads?placement=cars|drivers — active ad cards for a page
router.get('/', async (req, res) => {
    try {
        var placement = ['cars', 'drivers'].indexOf(req.query.placement) !== -1 ? req.query.placement : null;
        var sql = 'SELECT id, title, description, cover_url, target_link, cta_text, placement, position FROM ad_cards WHERE is_active = 1';
        var params = [];
        if (placement) {
            sql += " AND (placement = $1 OR placement = 'both')";
            params.push(placement);
        }
        sql += ' ORDER BY position ASC, id ASC';
        var rows = await queryAll(sql, params);
        res.json({ ads: rows });
    } catch (err) {
        console.error('List ads error:', err);
        res.status(500).json({ error: 'Failed to load ads' });
    }
});

// =================== ADMIN ===================

// GET /api/ads/admin/all — all ad cards
router.get('/admin/all', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        var rows = await queryAll('SELECT * FROM ad_cards ORDER BY placement ASC, position ASC, id ASC', []);
        res.json({ ads: rows });
    } catch (err) {
        console.error('Admin list ads error:', err);
        res.status(500).json({ error: 'Failed to load ads' });
    }
});

// POST /api/ads/admin — create ad card
router.post('/admin', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        var a = sanitizeAd(req.body, {});
        if (!a.target_link) return res.status(400).json({ error: 'Target link is required' });
        await execute(
            `INSERT INTO ad_cards (title, description, cover_url, target_link, cta_text, placement, position, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [a.title, a.description, a.cover_url, a.target_link, a.cta_text, a.placement, a.position, a.is_active]
        );
        var created = await queryOne('SELECT * FROM ad_cards ORDER BY id DESC LIMIT 1', []);
        res.status(201).json({ message: 'Ad card created', ad: created });
    } catch (err) {
        console.error('Create ad error:', err);
        res.status(500).json({ error: 'Failed to create ad' });
    }
});

// PUT /api/ads/admin/:id — update ad card
router.put('/admin/:id', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        var id = parseInt(req.params.id);
        var existing = await queryOne('SELECT * FROM ad_cards WHERE id = $1', [id]);
        if (!existing) return res.status(404).json({ error: 'Ad card not found' });
        var a = sanitizeAd(req.body, existing);
        if (!a.target_link) return res.status(400).json({ error: 'Target link is required' });
        await execute(
            `UPDATE ad_cards SET title=$1, description=$2, cover_url=$3, target_link=$4, cta_text=$5,
               placement=$6, position=$7, is_active=$8, updated_at=CURRENT_TIMESTAMP WHERE id=$9`,
            [a.title, a.description, a.cover_url, a.target_link, a.cta_text, a.placement, a.position, a.is_active, id]
        );
        var updated = await queryOne('SELECT * FROM ad_cards WHERE id = $1', [id]);
        res.json({ message: 'Ad card updated', ad: updated });
    } catch (err) {
        console.error('Update ad error:', err);
        res.status(500).json({ error: 'Failed to update ad' });
    }
});

// POST /api/ads/:id/click — track ad click (public, no auth needed)
router.post('/:id/click', async (req, res) => {
    try {
        var id = parseInt(req.params.id);
        await execute('UPDATE ad_cards SET clicks = clicks + 1 WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Ad click tracking error:', err);
        res.json({ success: false }); // silent fail — don't break user experience
    }
});

// DELETE /api/ads/admin/:id — delete ad card
router.delete('/admin/:id', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        var id = parseInt(req.params.id);
        var r = await execute('DELETE FROM ad_cards WHERE id = $1', [id]);
        if (!r.rowCount) return res.status(404).json({ error: 'Ad card not found' });
        res.json({ message: 'Ad card deleted' });
    } catch (err) {
        console.error('Delete ad error:', err);
        res.status(500).json({ error: 'Failed to delete ad' });
    }
});

module.exports = router;
