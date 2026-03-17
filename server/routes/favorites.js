const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { queryAll, queryOne, execute } = require('../db-helpers');

const router = express.Router();

// GET /api/favorites — get user's favorites (guest only)
router.get('/', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'guest') {
            return res.status(403).json({ error: 'Only guests can have favorites' });
        }

        var favorites = await queryAll(`
            SELECT v.*, f.created_at as favorited_at
            FROM favorites f
            JOIN vehicles v ON f.vehicle_id = v.id
            WHERE f.guest_id = $1 AND v.status = 'active'
            ORDER BY f.created_at DESC
        `, [req.user.id]);

        res.json({ favorites, count: favorites.length });
    } catch (err) {
        console.error('Get favorites error:', err);
        res.status(500).json({ error: 'Failed to get favorites' });
    }
});

// POST /api/favorites/:vehicleId — add vehicle to favorites (guest only)
router.post('/:vehicleId', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'guest') {
            return res.status(403).json({ error: 'Only guests can add favorites' });
        }

        var vehicleId = parseInt(req.params.vehicleId);
        if (!vehicleId) {
            return res.status(400).json({ error: 'Invalid vehicle ID' });
        }

        var vehicle = await queryOne('SELECT id FROM vehicles WHERE id = $1 AND status = $2', [vehicleId, 'active']);
        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        var existing = await queryOne('SELECT id FROM favorites WHERE guest_id = $1 AND vehicle_id = $2', [req.user.id, vehicleId]);
        if (existing) {
            return res.status(409).json({ error: 'Vehicle already in favorites' });
        }

        await execute('INSERT INTO favorites (guest_id, vehicle_id) VALUES ($1, $2)', [req.user.id, vehicleId]);

        res.json({ message: 'Vehicle added to favorites' });
    } catch (err) {
        console.error('Add favorite error:', err);
        res.status(500).json({ error: 'Failed to add favorite' });
    }
});

// DELETE /api/favorites/:vehicleId — remove vehicle from favorites (guest only)
router.delete('/:vehicleId', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'guest') {
            return res.status(403).json({ error: 'Only guests can remove favorites' });
        }

        var vehicleId = parseInt(req.params.vehicleId);
        if (!vehicleId) {
            return res.status(400).json({ error: 'Invalid vehicle ID' });
        }

        var result = await execute('DELETE FROM favorites WHERE guest_id = $1 AND vehicle_id = $2', [req.user.id, vehicleId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Favorite not found' });
        }

        res.json({ message: 'Vehicle removed from favorites' });
    } catch (err) {
        console.error('Remove favorite error:', err);
        res.status(500).json({ error: 'Failed to remove favorite' });
    }
});

// GET /api/favorites/ids — return all favorited vehicle IDs for the current guest (batch check)
router.get('/ids', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'guest') return res.json({ ids: [] });
        var rows = await queryAll('SELECT vehicle_id FROM favorites WHERE guest_id = $1', [req.user.id]);
        res.json({ ids: rows.map(function(r){ return r.vehicle_id; }) });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get favorite IDs' });
    }
});

// GET /api/favorites/check/:vehicleId — check if vehicle is in user's favorites (guest only)
router.get('/check/:vehicleId', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'guest') {
            return res.json({ isFavorite: false });
        }

        var vehicleId = parseInt(req.params.vehicleId);
        if (!vehicleId) {
            return res.json({ isFavorite: false });
        }

        var favorite = await queryOne('SELECT id FROM favorites WHERE guest_id = $1 AND vehicle_id = $2', [req.user.id, vehicleId]);
        res.json({ isFavorite: !!favorite });
    } catch (err) {
        console.error('Check favorite error:', err);
        res.status(500).json({ error: 'Failed to check favorite' });
    }
});

module.exports = router;
