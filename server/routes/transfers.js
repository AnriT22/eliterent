/**
 * Transfers — private transfer requests and the vehicle matching engine.
 *
 * Supply is aggregated from two sources behind one interface, in this order:
 *   1. our own fleet   (vehicles table, status = 'active')
 *   2. partner supply  (server/services/transfer-partners.js)
 *
 * The customer never leaves the site and never sees which partner a car came
 * from — a partner match simply becomes a request rather than an instant
 * booking. Nothing here asserts availability we cannot verify: partner offers
 * carry instant:false and are quoted as "from", not as a firm price.
 */

const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { queryAll, queryOne, execute } = require('../db-helpers');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const { LOCATIONS, BY_CODE, estimateRoute } = require('../services/transfer-locations');
const { listPartnerVehicles } = require('../services/transfer-partners');

let notifyOwner = function () {};
try { notifyOwner = require('../services/notify').notifyOwner; } catch (e) { /* alerts optional */ }

const router = express.Router();

/**
 * Attaches req.user when a valid token is present and does nothing otherwise.
 * A transfer can be requested before signing up, but if the visitor IS signed
 * in we want the row linked so it appears under their account.
 */
function optionalAuth(req, res, next) {
    var header = req.headers['authorization'];
    var token = (header && header.split(' ')[1]) || req.query.token;
    if (token) {
        try { req.user = jwt.verify(token, JWT_SECRET); } catch (e) { /* treat as guest */ }
    }
    next();
}

// ---- helpers ---------------------------------------------------------------

function str(v, max) {
    if (v === undefined || v === null) return null;
    var s = String(v).trim();
    if (!s) return null;
    return s.slice(0, max || 200);
}

function int(v, def) {
    var n = parseInt(v, 10);
    return isNaN(n) ? (def === undefined ? null : def) : n;
}

// TR-<4 hex>-<4 hex>. Short enough to read over the phone, random enough that
// a reference cannot be guessed to enumerate other people's transfers.
function makeReference() {
    var raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    return 'TR-' + raw.slice(0, 4) + '-' + raw.slice(4, 8);
}

// `luggage` on vehicles is a SIZE word, not a count — the column only ever
// holds 'small', 'medium' or 'large'. Map that to a realistic number of large
// suitcases, and accept a bare number too in case the field is ever filled in
// numerically later.
//
// The third row matters: a 7-seater with every seat occupied has almost no
// boot left, because the luggage space *is* the third row. So capacity is
// computed against the party size, not in the abstract.
var LUGGAGE_BY_SIZE = { small: 2, medium: 3, large: 4 };

function luggageCapacity(raw, seats, passengers) {
    var n;
    var m = raw != null ? String(raw).match(/\d+/) : null;
    if (m) {
        n = parseInt(m[0], 10);
    } else {
        var key = String(raw || '').trim().toLowerCase();
        n = LUGGAGE_BY_SIZE[key];
        if (n === undefined) n = 3; // unlabelled: assume a normal boot
    }
    var s = parseInt(seats, 10) || 5;
    if (s >= 7) n += 1;                                   // bigger vehicle, bigger boot
    if (s >= 7 && (parseInt(passengers, 10) || 0) > 5) {
        n -= 2;                                           // third row in use — boot is gone
    }
    return Math.max(1, n);
}

function firstImage(gallery) {
    if (!gallery) return null;
    try {
        var g = typeof gallery === 'string' ? JSON.parse(gallery) : gallery;
        if (Array.isArray(g) && g.length) return g[0];
    } catch (e) { /* gallery may be a bare path */ }
    return typeof gallery === 'string' && gallery.indexOf('[') !== 0 ? gallery : null;
}

function fleetRow(v, pax) {
    return {
        id: v.id,
        source: 'fleet',
        brand: v.brand || '',
        model: v.model || '',
        year: v.year,
        category: (v.category || '').toLowerCase(),
        label: v.category ? String(v.category).replace(/_/g, ' ') : 'Vehicle',
        passengers: parseInt(v.seats, 10) || 4,
        luggage: luggageCapacity(v.luggage, v.seats, pax),
        luggage_size: v.luggage || null,
        price: Number(v.price_per_day),
        image: firstImage(v.gallery),
        chauffeur: true,
        instant: true
    };
}

async function activeFleet() {
    return queryAll(
        "SELECT id, brand, model, year, category, seats, luggage, price_per_day, gallery " +
        "FROM vehicles WHERE status = 'active' ORDER BY price_per_day ASC"
    );
}

/**
 * Seats are a hard constraint — a five-seat car genuinely cannot take six
 * people. Luggage is NOT: it is an estimate from a size word, and the real
 * answer is usually "it fits, or it fits with a support vehicle". Hiding a
 * Highlander because our guess said 3 bags instead of 5 is worse than showing
 * it and being honest that the boot is tight. So `fits` gates the list and
 * `luggage_ok` is advisory, surfaced in the UI as a trunk-service prompt.
 */
function fits(v, pax) {
    return v.passengers >= pax;
}

function withLuggageFlag(v, bags) {
    v.luggage_ok = v.luggage >= bags;
    return v;
}

// Roomy-enough vehicles first, then cheapest — so the default choice is one
// that actually takes the luggage.
function bySuitability(a, b) {
    if (a.luggage_ok !== b.luggage_ok) return a.luggage_ok ? -1 : 1;
    return a.price - b.price;
}

// ---- locations -------------------------------------------------------------

router.get('/locations', function (req, res) {
    res.json({ locations: LOCATIONS });
});

// ---- route estimate --------------------------------------------------------

router.get('/route', function (req, res) {
    var est = estimateRoute(str(req.query.from, 40), str(req.query.to, 40));
    if (!est) return res.status(400).json({ error: 'Unknown or identical locations' });
    res.json(est);
});

// ---- matching engine -------------------------------------------------------

/**
 * POST /api/transfers/quote
 * Body: { pickup_code, dropoff_code, passengers, luggage }
 * Returns fleet + partner vehicles that can carry the party.
 */
router.post('/quote', async function (req, res) {
    try {
        var b = req.body || {};
        var pax = Math.max(1, int(b.passengers, 1));
        var bags = Math.max(0, int(b.luggage, 0));
        var pickup = str(b.pickup_code, 40);

        var fleet = (await activeFleet())
            .map(function (v) { return fleetRow(v, pax); })
            .filter(function (v) { return fits(v, pax); })
            .map(function (v) { return withLuggageFlag(v, bags); })
            .sort(bySuitability);

        var partner = listPartnerVehicles({ passengers: pax, pickup_code: pickup })
            .map(function (v) { return withLuggageFlag(v, bags); })
            .sort(bySuitability);

        res.json({
            fleet: fleet,
            partner: partner,
            route: estimateRoute(pickup, str(b.dropoff_code, 40))
        });
    } catch (e) {
        console.error('[transfers] quote error:', e.message);
        res.status(500).json({ error: 'Could not load vehicles' });
    }
});

/**
 * POST /api/transfers/find-vehicle — the "Find My Car" feature.
 *
 * Three outcomes, mirroring the three UI states:
 *   exact     — we hold the requested brand+model and it can be booked
 *   similar   — no exact match, but comparable vehicles exist
 *   request   — nothing close; the journey goes to partners as a request
 */
router.post('/find-vehicle', async function (req, res) {
    try {
        var b = req.body || {};
        var brand = (str(b.brand, 60) || '').toLowerCase();
        var model = (str(b.model, 60) || '').toLowerCase();
        var pax = Math.max(1, int(b.passengers, 1));
        var bags = Math.max(0, int(b.luggage, 0));
        var pickup = str(b.pickup_code, 40);

        if (!brand) return res.status(400).json({ error: 'Brand is required' });

        var pool = (await activeFleet()).map(function (v) { return fleetRow(v, pax); })
            .concat(listPartnerVehicles({ passengers: pax, pickup_code: pickup }))
            .filter(function (v) { return fits(v, pax); })
            .map(function (v) { return withLuggageFlag(v, bags); });

        var sameBrand = pool.filter(function (v) {
            return (v.brand || '').toLowerCase().indexOf(brand) !== -1;
        });

        // Exact = brand matches and, when a model was given, the model matches too.
        var exact = sameBrand.filter(function (v) {
            if (!model) return true;
            var m = (v.model || '').toLowerCase();
            return m.indexOf(model) !== -1 || model.indexOf(m) !== -1;
        });

        if (exact.length) {
            return res.json({ outcome: 'exact', vehicles: exact.slice(0, 4) });
        }

        // Similar = same brand first, then the same class at a comparable price.
        var classHint = (str(b.vehicle_class, 40) || '').toLowerCase();
        var similar = sameBrand.slice();
        if (similar.length < 3) {
            var byClass = pool.filter(function (v) {
                if (similar.indexOf(v) !== -1) return false;
                if (!classHint) return true;
                return v.category === classHint || (v.label || '').toLowerCase().indexOf(classHint) !== -1;
            });
            byClass.sort(function (x, y) { return y.price - x.price; });
            similar = similar.concat(byClass.slice(0, 3 - similar.length));
        }

        if (similar.length) {
            return res.json({ outcome: 'similar', vehicles: similar.slice(0, 3) });
        }

        res.json({ outcome: 'request', vehicles: [] });
    } catch (e) {
        console.error('[transfers] find-vehicle error:', e.message);
        res.status(500).json({ error: 'Search failed' });
    }
});

// ---- create ----------------------------------------------------------------

/**
 * POST /api/transfers
 * Creates a booking (own fleet, instantly available) or a request (partner
 * sourced, or a specific vehicle we could not confirm). Auth is optional so a
 * visitor can request a transfer before they have an account; if a valid token
 * is present the row is linked to them and shows up in their profile.
 */
router.post('/', optionalAuth, async function (req, res) {
    try {
        var b = req.body || {};

        var pickupLabel = str(b.pickup_label, 160);
        var dropoffLabel = str(b.dropoff_label, 160);
        var date = str(b.pickup_date, 20);
        var time = str(b.pickup_time, 10);

        if (!pickupLabel || !dropoffLabel) return res.status(400).json({ error: 'Pick-up and drop-off are required' });
        if (!date || !time) return res.status(400).json({ error: 'Pick-up date and time are required' });
        if (!str(b.contact_name, 100) || !(str(b.contact_phone, 40) || str(b.contact_email, 160))) {
            return res.status(400).json({ error: 'A name and either a phone or an email are required' });
        }

        var source = ['fleet', 'partner', 'requested'].indexOf(b.vehicle_source) !== -1 ? b.vehicle_source : 'requested';
        // Only our own fleet can be booked outright; everything else is a request.
        var kind = source === 'fleet' ? 'booking' : 'request';
        var reference = makeReference();

        // vehicle_id is a real FK, so only keep it for our own fleet.
        var vehicleId = source === 'fleet' ? int(b.vehicle_id) : null;

        var route = estimateRoute(str(b.pickup_code, 40), str(b.dropoff_code, 40)) || {};

        await execute(
            'INSERT INTO transfer_requests (' +
            'reference, guest_id, kind, transfer_type, contact_name, contact_email, contact_phone,' +
            'pickup_code, pickup_label, dropoff_code, dropoff_label, pickup_date, pickup_time,' +
            'return_date, return_time, distance_km, duration_min, passengers, luggage,' +
            'requirements, extras, vehicle_id, vehicle_source, vehicle_label, requested_vehicle,' +
            'quoted_price, currency, status' +
            ') VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)',
            [
                reference,
                (req.user && req.user.id) || null,
                kind,
                str(b.transfer_type, 40) || 'airport',
                str(b.contact_name, 100),
                str(b.contact_email, 160),
                str(b.contact_phone, 40),
                str(b.pickup_code, 40), pickupLabel,
                str(b.dropoff_code, 40), dropoffLabel,
                date, time,
                str(b.return_date, 20), str(b.return_time, 10),
                route.distance_km || null, route.duration_min || null,
                Math.max(1, int(b.passengers, 1)), Math.max(0, int(b.luggage, 0)),
                JSON.stringify(Array.isArray(b.requirements) ? b.requirements.slice(0, 20) : []),
                JSON.stringify(Array.isArray(b.extras) ? b.extras.slice(0, 20) : []),
                vehicleId, source,
                str(b.vehicle_label, 120),
                str(b.requested_vehicle, 160),
                // A partner offer is indicative only — never stored as a firm quote.
                kind === 'booking' ? (b.quoted_price != null ? Number(b.quoted_price) : null) : null,
                str(b.currency, 8) || 'USD',
                kind === 'booking' ? 'new' : 'searching'
            ]
        );

        notifyOwner(
            '🚘 Transfer ' + (kind === 'booking' ? 'BOOKING' : 'REQUEST') + ' ' + reference + '\n' +
            pickupLabel + ' → ' + dropoffLabel + '\n' +
            date + ' ' + time + ' · ' + Math.max(1, int(b.passengers, 1)) + ' pax\n' +
            (str(b.vehicle_label, 120) || str(b.requested_vehicle, 160) || 'No vehicle chosen') + '\n' +
            (str(b.contact_name, 100) || '') + ' ' + (str(b.contact_phone, 40) || str(b.contact_email, 160) || '')
        );

        res.status(201).json({
            reference: reference,
            kind: kind,
            status: kind === 'booking' ? 'new' : 'searching'
        });
    } catch (e) {
        console.error('[transfers] create error:', e.message);
        res.status(500).json({ error: 'Could not submit your transfer' });
    }
});

// ---- status ----------------------------------------------------------------

/**
 * Public status lookup by reference. Returns only what the holder of the
 * reference already knows — no contact details, no other bookings.
 */
router.get('/ref/:reference', async function (req, res) {
    try {
        var ref = str(req.params.reference, 20);
        if (!ref) return res.status(400).json({ error: 'Reference required' });
        var row = await queryOne(
            'SELECT reference, kind, status, transfer_type, pickup_label, dropoff_label,' +
            ' pickup_date, pickup_time, passengers, luggage, vehicle_label, requested_vehicle,' +
            ' quoted_price, currency, created_at' +
            ' FROM transfer_requests WHERE reference = $1',
            [ref.toUpperCase()]
        );
        if (!row) return res.status(404).json({ error: 'Not found' });
        res.json({ transfer: row });
    } catch (e) {
        console.error('[transfers] status error:', e.message);
        res.status(500).json({ error: 'Lookup failed' });
    }
});

/** The signed-in customer's own transfers. */
router.get('/mine', authenticateToken, async function (req, res) {
    try {
        var rows = await queryAll(
            'SELECT reference, kind, status, transfer_type, pickup_label, dropoff_label,' +
            ' pickup_date, pickup_time, passengers, luggage, vehicle_label, requested_vehicle,' +
            ' quoted_price, currency, created_at' +
            ' FROM transfer_requests WHERE guest_id = $1 ORDER BY created_at DESC LIMIT 50',
            [req.user.id]
        );
        res.json({ transfers: rows });
    } catch (e) {
        console.error('[transfers] mine error:', e.message);
        res.status(500).json({ error: 'Could not load your transfers' });
    }
});

module.exports = router;
