const express = require('express');
const { getDB, saveDB } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { queryAll, queryOne, execute } = require('../db-helpers');

const router = express.Router();

// GET /api/favorites — get user's favorites (guest only)
router.get('/', authenticateToken, (req, res) => {
    try {
        if (req.user.role !== 'guest') {
            return res.status(403).json({ error: 'Only guests can have favorites' });
        }

        var favorites = queryAll(`
            SELECT v.*, f.created_at as favorited_at
            FROM favorites f
            JOIN vehicles v ON f.vehicle_id = v.id
            WHERE f.guest_id = ? AND v.status = 'active'
            ORDER BY f.created_at DESC
        `, [req.user.id]);

        res.json({ favorites, count: favorites.length });
    } catch (err) {
        console.error('Get favorites error:', err);
        res.status(500).json({ error: 'Failed to get favorites' });
    }
});

// POST /api/favorites/:vehicleId — add vehicle to favorites (guest only)
router.post('/:vehicleId', authenticateToken, (req, res) => {
    try {
        if (req.user.role !== 'guest') {
            return res.status(403).json({ error: 'Only guests can add favorites' });
        }

        var vehicleId = parseInt(req.params.vehicleId);
        if (!vehicleId) {
            return res.status(400).json({ error: 'Invalid vehicle ID' });
        }

        // Check if vehicle exists and is active
        var vehicle = queryOne('SELECT id FROM vehicles WHERE id = ? AND status = ?', [vehicleId, 'active']);
        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        // Check if already favorited
        var existing = queryOne('SELECT id FROM favorites WHERE guest_id = ? AND vehicle_id = ?', [req.user.id, vehicleId]);
        if (existing) {
            return res.status(409).json({ error: 'Vehicle already in favorites' });
        }

        // Add to favorites
        execute('INSERT INTO favorites (guest_id, vehicle_id) VALUES (?, ?)', [req.user.id, vehicleId]);

        res.json({ message: 'Vehicle added to favorites' });
    } catch (err) {
        console.error('Add favorite error:', err);
        res.status(500).json({ error: 'Failed to add favorite' });
    }
});

// DELETE /api/favorites/:vehicleId — remove vehicle from favorites (guest only)
router.delete('/:vehicleId', authenticateToken, (req, res) => {
    try {
        if (req.user.role !== 'guest') {
            return res.status(403).json({ error: 'Only guests can remove favorites' });
        }

        var vehicleId = parseInt(req.params.vehicleId);
        if (!vehicleId) {
            return res.status(400).json({ error: 'Invalid vehicle ID' });
        }

        // Remove from favorites
        var result = getDB().run('DELETE FROM favorites WHERE guest_id = ? AND vehicle_id = ?', [req.user.id, vehicleId]);
        saveDB();

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Favorite not found' });
        }

        res.json({ message: 'Vehicle removed from favorites' });
    } catch (err) {
        console.error('Remove favorite error:', err);
        res.status(500).json({ error: 'Failed to remove favorite' });
    }
});

// GET /api/favorites/ids — return all favorited vehicle IDs for the current guest (batch check)
router.get('/ids', authenticateToken, (req, res) => {
    try {
        if (req.user.role !== 'guest') return res.json({ ids: [] });
        var rows = queryAll('SELECT vehicle_id FROM favorites WHERE guest_id = ?', [req.user.id]);
        res.json({ ids: rows.map(function(r){ return r.vehicle_id; }) });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get favorite IDs' });
    }
});

// GET /api/favorites/check/:vehicleId — check if vehicle is in user's favorites (guest only)
router.get('/check/:vehicleId', authenticateToken, (req, res) => {
    try {
        if (req.user.role !== 'guest') {
            return res.json({ isFavorite: false });
        }

        var vehicleId = parseInt(req.params.vehicleId);
        if (!vehicleId) {
            return res.json({ isFavorite: false });
        }

        var favorite = queryOne('SELECT id FROM favorites WHERE guest_id = ? AND vehicle_id = ?', [req.user.id, vehicleId]);
        res.json({ isFavorite: !!favorite });
    } catch (err) {
        console.error('Check favorite error:', err);
        res.status(500).json({ error: 'Failed to check favorite' });
    }
});

module.exports = router;
