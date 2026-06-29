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

// ============================================================================
// HOUR-LEVEL TIME BLOCKS (date + time ranges, with an automatic buffer)
// ============================================================================

var BUFFER_MINUTES = 120; // 2h added after a block so the partner can turn the car around

// Parse a naive local 'YYYY-MM-DDTHH:MM' / 'YYYY-MM-DD HH:MM' into ms since epoch,
// treating it as UTC purely for arithmetic (avoids server-timezone drift on naive times).
function parseLocal(s) {
    var m = String(s || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if (!m) return null;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}
function fmtLocal(ms) {
    var d = new Date(ms);
    function p(n) { return String(n).padStart(2, '0'); }
    return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate())
        + 'T' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
}

// GET /api/availability/:vehicleId/time-blocks — list blocks (public).
// Returns raw partner-defined times AND the effective interval (end + buffer)
// so the customer UI can disable unavailable hours.
router.get('/:vehicleId/time-blocks', async (req, res) => {
    try {
        var vehicleId = parseInt(req.params.vehicleId);
        if (!vehicleId) return res.status(400).json({ error: 'Invalid vehicle ID' });
        var rows = await queryAll('SELECT id, start_ts, end_ts, buffer_minutes FROM vehicle_time_blocks WHERE vehicle_id = $1 ORDER BY start_ts', [vehicleId]);
        var blocks = rows.map(function (r) {
            var buf = (r.buffer_minutes == null ? BUFFER_MINUTES : r.buffer_minutes);
            var endMs = parseLocal(r.end_ts);
            var effEnd = endMs != null ? fmtLocal(endMs + buf * 60000) : r.end_ts;
            return {
                id: r.id,
                start: r.start_ts,            // partner-defined start
                end: r.end_ts,                // partner-defined end (raw)
                buffer_minutes: buf,
                effective_start: r.start_ts,  // customer-facing blocked interval
                effective_end: effEnd         // = end + buffer
            };
        });
        res.json({ blocks: blocks });
    } catch (err) {
        console.error('Get time-blocks error:', err);
        res.status(500).json({ error: 'Failed to get time blocks' });
    }
});

// POST /api/availability/:vehicleId/time-blocks — create a block (partner only)
router.post('/:vehicleId/time-blocks', authenticateToken, requireRole('partner'), async (req, res) => {
    try {
        var vehicleId = parseInt(req.params.vehicleId);
        var start = req.body.start, end = req.body.end;
        if (!vehicleId) return res.status(400).json({ error: 'Invalid vehicle ID' });

        var vehicle = await queryOne('SELECT id FROM vehicles WHERE id = $1 AND partner_id = $2', [vehicleId, req.user.id]);
        if (!vehicle) return res.status(404).json({ error: 'Vehicle not found or access denied' });

        var sMs = parseLocal(start), eMs = parseLocal(end);
        if (sMs == null || eMs == null) return res.status(400).json({ error: 'Invalid date/time. Use YYYY-MM-DDTHH:MM' });
        if (eMs <= sMs) return res.status(400).json({ error: 'End must be after start' });

        // Normalise to a consistent stored format
        var startStr = fmtLocal(sMs), endStr = fmtLocal(eMs);
        // Idempotent: if an identical block already exists, return it instead of
        // inserting a duplicate. This makes retries (e.g. after a dropped response)
        // safe — the partner can't pile up duplicate blocks by re-clicking.
        var existing = await queryOne(
            'SELECT id, start_ts, end_ts, buffer_minutes FROM vehicle_time_blocks WHERE vehicle_id = $1 AND start_ts = $2 AND end_ts = $3',
            [vehicleId, startStr, endStr]);
        if (existing) return res.status(200).json({ message: 'Time block already exists', block: existing });
        await execute('INSERT INTO vehicle_time_blocks (vehicle_id, start_ts, end_ts, buffer_minutes) VALUES ($1, $2, $3, $4)',
            [vehicleId, startStr, endStr, BUFFER_MINUTES]);
        var created = await queryOne('SELECT id, start_ts, end_ts, buffer_minutes FROM vehicle_time_blocks WHERE vehicle_id = $1 ORDER BY id DESC LIMIT 1', [vehicleId]);
        res.status(201).json({ message: 'Time block added', block: created });
    } catch (err) {
        console.error('Create time-block error:', err);
        res.status(500).json({ error: 'Failed to add time block' });
    }
});

// DELETE /api/availability/:vehicleId/time-blocks/:id — remove a block (partner only)
router.delete('/:vehicleId/time-blocks/:id', authenticateToken, requireRole('partner'), async (req, res) => {
    try {
        var vehicleId = parseInt(req.params.vehicleId);
        var id = parseInt(req.params.id);
        if (!vehicleId || !id) return res.status(400).json({ error: 'Invalid request' });
        var vehicle = await queryOne('SELECT id FROM vehicles WHERE id = $1 AND partner_id = $2', [vehicleId, req.user.id]);
        if (!vehicle) return res.status(404).json({ error: 'Vehicle not found or access denied' });
        var r = await execute('DELETE FROM vehicle_time_blocks WHERE id = $1 AND vehicle_id = $2', [id, vehicleId]);
        if (!r.rowCount) return res.status(404).json({ error: 'Time block not found' });
        res.json({ message: 'Time block removed' });
    } catch (err) {
        console.error('Delete time-block error:', err);
        res.status(500).json({ error: 'Failed to remove time block' });
    }
});

module.exports = router;
