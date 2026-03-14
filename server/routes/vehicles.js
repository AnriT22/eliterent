const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { queryAll, queryOne, execute } = require('../db-helpers');

const router = express.Router();

// GET /api/vehicles — list all active vehicles (public)
router.get('/', (req, res) => {
    try {
        var sql = `SELECT v.*, u.full_name as partner_name, pp.company_name
                   FROM vehicles v
                   JOIN users u ON v.partner_id = u.id
                   LEFT JOIN partner_profiles pp ON u.id = pp.user_id
                   WHERE v.status = 'active'`;
        var params = [];

        // Optional filters
        if (req.query.category) {
            sql += ' AND v.category = ?';
            params.push(req.query.category);
        }
        if (req.query.engine) {
            sql += ' AND v.engine = ?';
            params.push(req.query.engine);
        }
        if (req.query.gearbox) {
            sql += ' AND v.gearbox = ?';
            params.push(req.query.gearbox);
        }
        if (req.query.drive_type) {
            sql += ' AND v.drive_type = ?';
            params.push(req.query.drive_type);
        }
        if (req.query.min_price) {
            sql += ' AND v.price_per_day >= ?';
            params.push(parseFloat(req.query.min_price));
        }
        if (req.query.max_price) {
            sql += ' AND v.price_per_day <= ?';
            params.push(parseFloat(req.query.max_price));
        }
        if (req.query.year_min) {
            sql += ' AND v.year >= ?';
            params.push(parseInt(req.query.year_min));
        }
        if (req.query.year_max) {
            sql += ' AND v.year <= ?';
            params.push(parseInt(req.query.year_max));
        }

        // Availability filtering
        if (req.query.pickup_date && req.query.dropoff_date) {
            // Filter out vehicles that are blocked or booked during the requested period
            sql += ` AND v.id NOT IN (
                SELECT DISTINCT va.vehicle_id 
                FROM vehicle_availability va 
                WHERE va.date >= ? AND va.date < ? 
                AND va.status IN ('blocked', 'booked')
            )`;
            params.push(req.query.pickup_date, req.query.dropoff_date);
        }

        // Sort
        var sortMap = {
            'price-asc': 'v.price_per_day ASC',
            'price-desc': 'v.price_per_day DESC',
            'year-desc': 'v.year DESC',
            'name-asc': 'v.name ASC',
            'newest': 'v.created_at DESC'
        };
        var sort = sortMap[req.query.sort] || 'v.created_at DESC';
        sql += ' ORDER BY ' + sort;

        var vehicles = queryAll(sql, params.length > 0 ? params : undefined);

        res.json({ vehicles, count: vehicles.length });
    } catch (err) {
        console.error('Get vehicles error:', err);
        res.status(500).json({ error: 'Failed to get vehicles' });
    }
});

// GET /api/vehicles/my — get partner's own vehicles (protected, partner only)
router.get('/my', authenticateToken, requireRole('partner'), (req, res) => {
    try {
        var vehicles = queryAll(
            'SELECT * FROM vehicles WHERE partner_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json({ vehicles, count: vehicles.length });
    } catch (err) {
        console.error('Get my vehicles error:', err);
        res.status(500).json({ error: 'Failed to get vehicles' });
    }
});

// GET /api/vehicles/:id — get single vehicle (public)
router.get('/:id', (req, res) => {
    try {
        var vehicle = queryOne(
            `SELECT v.*, u.full_name as partner_name, pp.company_name, pp.whatsapp, pp.telegram, pp.location as partner_location
             FROM vehicles v
             JOIN users u ON v.partner_id = u.id
             LEFT JOIN partner_profiles pp ON u.id = pp.user_id
             WHERE v.id = ?`,
            [parseInt(req.params.id)]
        );

        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        res.json({ vehicle });
    } catch (err) {
        console.error('Get vehicle error:', err);
        res.status(500).json({ error: 'Failed to get vehicle' });
    }
});

// POST /api/vehicles — add a new vehicle (partner only, must be verified)
router.post('/', authenticateToken, requireRole('partner'), (req, res) => {
    try {
        var partnerProfile = queryOne('SELECT is_verified FROM partner_profiles WHERE user_id = ?', [req.user.id]);
        if (!partnerProfile || !partnerProfile.is_verified) {
            return res.status(403).json({ error: 'Your partner account must be verified by admin before you can add vehicles. Please wait for verification.' });
        }

        var b = req.body;

        if (!b.name || !b.category || !b.engine || !b.gearbox || !b.drive_type || !b.price_per_day || !b.year) {
            return res.status(400).json({ error: 'Name, category, engine, gearbox, drive type, price, and year are required' });
        }

        if (!b.tech_passport_front) {
            return res.status(400).json({ error: 'Technical passport image is required' });
        }

        execute(`
            INSERT INTO vehicles
            (partner_id, name, brand, model, color, min_age, location_city,
             category, engine, gearbox, drive_type,
             interior_type, steering_side,
             price_per_day, year, seats, doors,
             fuel_policy, luggage, region,
             fuel_consumption, engine_cc, horsepower,
             mileage_limit_enabled, mileage_km,
             image_url, gallery, description,
             features, multimedia,
             price_tiers, extras, insurance,
             pickup_fees_enabled, pickup_fees,
             visible_in_search, block_after_payment,
             custom_pricing_enabled, custom_pricing_ranges, registration_number,
             deposit_amount,
             tech_passport_front, tech_passport_back, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [
                req.user.id,
                b.name,
                b.brand || null,
                b.model || null,
                b.color || null,
                parseInt(b.min_age) || 21,
                b.location_city || null,
                b.category,
                b.engine,
                b.gearbox,
                b.drive_type,
                b.interior_type || 'fabric',
                b.steering_side || 'left',
                parseFloat(b.price_per_day),
                parseInt(b.year),
                parseInt(b.seats) || 5,
                parseInt(b.doors) || 4,
                b.fuel_policy || 'full_to_full',
                b.luggage || null,
                b.region || null,
                b.fuel_consumption || null,
                parseInt(b.engine_cc) || null,
                parseInt(b.horsepower) || null,
                b.mileage_limit_enabled ? 1 : 0,
                parseInt(b.mileage_km) || null,
                b.image_url || null,
                JSON.stringify(b.gallery || []),
                b.description || null,
                JSON.stringify(b.features || {}),
                JSON.stringify(b.multimedia || {}),
                JSON.stringify(b.price_tiers || {}),
                JSON.stringify(b.extras || {}),
                JSON.stringify(b.insurance || {}),
                b.pickup_fees_enabled ? 1 : 0,
                JSON.stringify(b.pickup_fees || {}),
                b.visible_in_search !== false ? 1 : 0,
                b.block_after_payment ? 1 : 0,
                b.custom_pricing_enabled ? 1 : 0,
                JSON.stringify(b.custom_pricing_ranges || []),
                b.registration_number || null,
                parseFloat(b.deposit_amount) || 0,
                b.tech_passport_front,
                b.tech_passport_back || null
            ]
        );

        var newVehicle = queryOne(
            'SELECT * FROM vehicles WHERE partner_id = ? ORDER BY id DESC LIMIT 1',
            [req.user.id]
        );

        res.status(201).json({ message: 'Vehicle added successfully! It will appear on the site after admin approval.', vehicle: newVehicle });
    } catch (err) {
        console.error('Add vehicle error:', err);
        res.status(500).json({ error: 'Failed to add vehicle' });
    }
});

// PUT /api/vehicles/:id — update a vehicle (partner only, own vehicles)
router.put('/:id', authenticateToken, requireRole('partner'), (req, res) => {
    try {
        var vehicleId = parseInt(req.params.id);
        var existing = queryOne('SELECT * FROM vehicles WHERE id = ? AND partner_id = ?', [vehicleId, req.user.id]);

        if (!existing) {
            return res.status(404).json({ error: 'Vehicle not found or not yours' });
        }

        var b = req.body;

        execute(`
            UPDATE vehicles SET
                name = ?, brand = ?, model = ?, color = ?, min_age = ?, location_city = ?,
                category = ?, engine = ?, gearbox = ?, drive_type = ?,
                interior_type = ?, steering_side = ?,
                price_per_day = ?, year = ?, seats = ?, doors = ?,
                fuel_policy = ?, luggage = ?, region = ?,
                fuel_consumption = ?, engine_cc = ?, horsepower = ?,
                mileage_limit_enabled = ?, mileage_km = ?,
                image_url = ?, gallery = ?, description = ?,
                features = ?, multimedia = ?,
                price_tiers = ?, extras = ?, insurance = ?,
                pickup_fees_enabled = ?, pickup_fees = ?,
                visible_in_search = ?, block_after_payment = ?,
                custom_pricing_enabled = ?, custom_pricing_ranges = ?, registration_number = ?,
                deposit_amount = ?,
                tech_passport_front = ?, tech_passport_back = ?,
                status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND partner_id = ?`,
            [
                b.name || existing.name,
                b.brand !== undefined ? b.brand : existing.brand,
                b.model !== undefined ? b.model : existing.model,
                b.color !== undefined ? b.color : existing.color,
                parseInt(b.min_age) || existing.min_age || 21,
                b.location_city !== undefined ? b.location_city : existing.location_city,
                b.category || existing.category,
                b.engine || existing.engine,
                b.gearbox || existing.gearbox,
                b.drive_type || existing.drive_type,
                b.interior_type || existing.interior_type,
                b.steering_side || existing.steering_side,
                parseFloat(b.price_per_day) || existing.price_per_day,
                parseInt(b.year) || existing.year,
                parseInt(b.seats) || existing.seats,
                parseInt(b.doors) || existing.doors,
                b.fuel_policy || existing.fuel_policy || 'full_to_full',
                b.luggage !== undefined ? b.luggage : existing.luggage,
                b.region !== undefined ? b.region : existing.region,
                b.fuel_consumption !== undefined ? b.fuel_consumption : existing.fuel_consumption,
                b.engine_cc !== undefined ? (parseInt(b.engine_cc) || null) : existing.engine_cc,
                b.horsepower !== undefined ? (parseInt(b.horsepower) || null) : existing.horsepower,
                b.mileage_limit_enabled !== undefined ? (b.mileage_limit_enabled ? 1 : 0) : existing.mileage_limit_enabled,
                b.mileage_km !== undefined ? (parseInt(b.mileage_km) || null) : existing.mileage_km,
                b.image_url !== undefined ? b.image_url : existing.image_url,
                b.gallery ? JSON.stringify(b.gallery) : existing.gallery,
                b.description !== undefined ? b.description : existing.description,
                b.features ? JSON.stringify(b.features) : existing.features,
                b.multimedia ? JSON.stringify(b.multimedia) : existing.multimedia,
                b.price_tiers ? JSON.stringify(b.price_tiers) : existing.price_tiers,
                b.extras ? JSON.stringify(b.extras) : existing.extras,
                b.insurance ? JSON.stringify(b.insurance) : existing.insurance,
                b.pickup_fees_enabled !== undefined ? (b.pickup_fees_enabled ? 1 : 0) : existing.pickup_fees_enabled,
                b.pickup_fees ? JSON.stringify(b.pickup_fees) : existing.pickup_fees,
                b.visible_in_search !== undefined ? (b.visible_in_search ? 1 : 0) : existing.visible_in_search,
                b.block_after_payment !== undefined ? (b.block_after_payment ? 1 : 0) : existing.block_after_payment,
                b.custom_pricing_enabled !== undefined ? (b.custom_pricing_enabled ? 1 : 0) : existing.custom_pricing_enabled,
                b.custom_pricing_ranges ? JSON.stringify(b.custom_pricing_ranges) : existing.custom_pricing_ranges,
                b.registration_number !== undefined ? b.registration_number : existing.registration_number,
                b.deposit_amount !== undefined ? parseFloat(b.deposit_amount) : existing.deposit_amount,
                b.tech_passport_front !== undefined ? b.tech_passport_front : existing.tech_passport_front,
                b.tech_passport_back !== undefined ? b.tech_passport_back : existing.tech_passport_back,
                b.status || existing.status,
                vehicleId,
                req.user.id
            ]
        );

        var updated = queryOne('SELECT * FROM vehicles WHERE id = ?', [vehicleId]);
        res.json({ message: 'Vehicle updated', vehicle: updated });
    } catch (err) {
        console.error('Update vehicle error:', err);
        res.status(500).json({ error: 'Failed to update vehicle' });
    }
});

// DELETE /api/vehicles/:id — request vehicle deletion (partner only, own vehicles)
// Partners cannot directly delete — they request deletion, admin approves
router.delete('/:id', authenticateToken, requireRole('partner'), (req, res) => {
    try {
        var vehicleId = parseInt(req.params.id);
        var existing = queryOne('SELECT * FROM vehicles WHERE id = ? AND partner_id = ?', [vehicleId, req.user.id]);

        if (!existing) {
            return res.status(404).json({ error: 'Vehicle not found or not yours' });
        }

        // Check for active reservations (pending, accepted, cancel_requested)
        var activeBooking = queryOne(
            "SELECT id FROM bookings WHERE vehicle_id = ? AND status IN ('pending', 'accepted', 'cancel_requested')",
            [vehicleId]
        );
        if (activeBooking) {
            return res.status(400).json({ error: 'Cannot request deletion — this vehicle has active reservations. Please wait until all bookings are completed or cancelled.' });
        }

        // Set status to delete_requested instead of actually deleting
        execute("UPDATE vehicles SET status = 'delete_requested', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND partner_id = ?", [vehicleId, req.user.id]);

        res.json({ message: 'Deletion requested. Admin will review and approve your request.' });
    } catch (err) {
        console.error('Delete vehicle request error:', err);
        res.status(500).json({ error: 'Failed to request vehicle deletion' });
    }
});

module.exports = router;
