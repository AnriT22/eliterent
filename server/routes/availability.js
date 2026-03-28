const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { queryAll, queryOne, execute } = require('../db-helpers');

const router = express.Router();

// GET /api/availability/:vehicleId?month=2024-02 — get vehicle availability for a month (public)
router.get('/:vehicleId', async (req, res) => {
    try {
        var vehicleId = parseInt(req.params.vehicleId);
        var month = req.query.month; // Format: YYYY-MM
        
        if (!vehicleId) {
            return res.status(400).json({ error: 'Invalid vehicle ID' });
        }

        // Check if vehicle exists and is active
        var vehicle = await queryOne('SELECT id FROM vehicles WHERE id = $1 AND status = $2', [vehicleId, 'active']);
        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        var sql = 'SELECT date, status FROM vehicle_availability WHERE vehicle_id = $1';
        var params = [vehicleId];
        
        if (month) {
            sql += ' AND date LIKE $2';
            params.push(month + '-%');
        }
        
        sql += ' ORDER BY date';
        
        var availability = await queryAll(sql, params);
        
        res.json({ availability });
    } catch (err) {
        console.error('Get availability error:', err);
        res.status(500).json({ error: 'Failed to get availability' });
    }
});

// POST /api/availability/:vehicleId — set availability dates (partner only)
router.post('/:vehicleId', authenticateToken, requireRole('partner'), async (req, res) => {
    try {
        var vehicleId = parseInt(req.params.vehicleId);
        var { dates, status } = req.body;
        
        if (!vehicleId || !Array.isArray(dates) || dates.length === 0) {
            return res.status(400).json({ error: 'Invalid request' });
        }

        // Check if vehicle belongs to this partner
        var vehicle = await queryOne('SELECT id FROM vehicles WHERE id = $1 AND partner_id = $2', [vehicleId, req.user.id]);
        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found or access denied' });
        }

        var validStatus = ['available', 'blocked'];
        if (!validStatus.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Validate date format (YYYY-MM-DD)
        var dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        var invalidDates = dates.filter(function (date) { return !dateRegex.test(date); });
        if (invalidDates.length > 0) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
        }

        // Update availability for each date
        for (var i = 0; i < dates.length; i++) {
            var date = dates[i];
            var existing = await queryOne('SELECT id, status FROM vehicle_availability WHERE vehicle_id = $1 AND date = $2', [vehicleId, date]);
            if (existing) {
                if (existing.status === 'booked') continue;
                await execute('UPDATE vehicle_availability SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE vehicle_id = $2 AND date = $3', [status, vehicleId, date]);
            } else {
                await execute('INSERT INTO vehicle_availability (vehicle_id, date, status) VALUES ($1, $2, $3)', [vehicleId, date, status]);
            }
        }

        res.json({ message: 'Availability updated successfully', updated: dates.length });
    } catch (err) {
        console.error('Set availability error:', err);
        res.status(500).json({ error: 'Failed to update availability' });
    }
});

// DELETE /api/availability/:vehicleId/:date — remove availability for a specific date (partner only)
router.delete('/:vehicleId/:date', authenticateToken, requireRole('partner'), async (req, res) => {
    try {
        var vehicleId = parseInt(req.params.vehicleId);
        var date = req.params.date;
        
        if (!vehicleId || !date) {
            return res.status(400).json({ error: 'Invalid request' });
        }

        // Check if vehicle belongs to this partner
        var vehicle = await queryOne('SELECT id FROM vehicles WHERE id = $1 AND partner_id = $2', [vehicleId, req.user.id]);
        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found or access denied' });
        }

        // Validate date format
        var dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
        }

        // Check if record exists before deleting
        var existing = await queryOne('SELECT id, status FROM vehicle_availability WHERE vehicle_id = $1 AND date = $2', [vehicleId, date]);
        if (!existing) {
            return res.status(404).json({ error: 'Availability record not found' });
        }

        if (existing.status === 'booked') {
            return res.status(400).json({ error: 'Cannot remove booked dates. Cancel the booking first.' });
        }

        // Delete availability record
        await execute('DELETE FROM vehicle_availability WHERE vehicle_id = $1 AND date = $2', [vehicleId, date]);

        res.json({ message: 'Availability removed successfully' });
    } catch (err) {
        console.error('Delete availability error:', err);
        res.status(500).json({ error: 'Failed to delete availability' });
    }
});

// GET /api/availability/:vehicleId/summary — get availability summary (public)
router.get('/:vehicleId/summary', async (req, res) => {
    try {
        var vehicleId = parseInt(req.params.vehicleId);
        var month = req.query.month; // Format: YYYY-MM
        
        if (!vehicleId) {
            return res.status(400).json({ error: 'Invalid vehicle ID' });
        }

        // Check if vehicle exists and is active
        var vehicle = await queryOne('SELECT id FROM vehicles WHERE id = $1 AND status = $2', [vehicleId, 'active']);
        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        var sql = 'SELECT status, COUNT(*) as count FROM vehicle_availability WHERE vehicle_id = $1';
        var params = [vehicleId];
        
        if (month) {
            sql += ' AND date LIKE $2';
            params.push(month + '-%');
        }
        
        sql += ' GROUP BY status';
        
        var results = await queryAll(sql, params);
        
        var summary = {
            available: 0,
            blocked: 0,
            booked: 0
        };
        
        results.forEach(function (row) {
            summary[row.status] = parseInt(row.count);
        });
        
        res.json({ summary });
    } catch (err) {
        console.error('Get availability summary error:', err);
        res.status(500).json({ error: 'Failed to get availability summary' });
    }
});

module.exports = router;
