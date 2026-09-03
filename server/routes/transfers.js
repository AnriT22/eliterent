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
const { queryAll, queryOne, execute } = require('../db-helpers');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { LOCATIONS, BY_CODE, estimateRoute, isMountainRoute, mountainEndpoint } =
    require('../services/transfer-locations');
const { listPartnerVehicles } = require('../services/transfer-partners');
const paypal = require('../paypal');

let notifyOwner = function () {};
try { notifyOwner = require('../services/notify').notifyOwner; } catch (e) { /* alerts optional */ }

const router = express.Router();

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

// Vehicle classes that actually belong on a Georgian mountain road.
var MOUNTAIN_READY = ['suv', 'crossover', 'suv_6_8'];

function markTerrain(v, mountain) {
    v.recommended = mountain && MOUNTAIN_READY.indexOf(v.category) !== -1;
    return v;
}

// Ordering answers "which car should I take?" in the order it matters:
// right vehicle for the road, then enough room for the bags, then price.
function bySuitability(a, b) {
    if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
    if (a.luggage_ok !== b.luggage_ok) return a.luggage_ok ? -1 : 1;
    return a.price - b.price;
}

// The client sends option ids; the alert should read like a dispatch note,
// not like a database row.
var OPTION_LABELS = {
    child_seat: 'Child seat', extra_luggage: 'Extra luggage',
    trunk_service: 'Additional trunk service', wheelchair: 'Wheelchair accessible',
    pet: 'Pet-friendly vehicle', meet_greet: 'Meet & greet',
    multi_stop: 'Multiple stops', chauffeur: 'Chauffeur service',
    other: 'Other request', other_extra: 'Other request',
    extra_stop: 'Additional stop', waiting: 'Waiting time',
    occasion: 'Special occasion'
};

function labelList(ids) {
    if (!Array.isArray(ids) || !ids.length) return null;
    return ids.map(function (id) { return OPTION_LABELS[id] || String(id); }).join(', ');
}

function humanDuration(mins) {
    if (!mins) return null;
    var h = Math.floor(mins / 60), m = mins % 60;
    return (h ? h + 'h ' : '') + m + 'm';
}


var FEE_FIELDS = ['price_car', 'fee_airport', 'fee_chauffeur', 'fee_dropoff', 'fee_luggage', 'fee_other'];

// ---- platform commission ---------------------------------------------------
//
// The platform earns on a confirmed transfer. The partner quotes what THEY want
// to receive; the customer is shown that grossed up so the commission is
// included in every line rather than appearing as a separate charge at the end
// — a visible "service fee" line is what makes people abandon a checkout.
//
// COMMISSION is a share of what the CUSTOMER pays, not a markup on the partner's
// price, so it divides rather than multiplies:
//
//     customer = partner / (1 - 0.15)     160 / 0.85 = 188.24
//     platform = 188.24 - 160  = 28.24    = 15.0% of 188.24
//
// (A x1.15 markup would give 184.00 and a real take of only 13.04%.)
// Change PLATFORM_COMMISSION to adjust the rate; set it to 0 to bill at cost.
var PLATFORM_COMMISSION = 0.15;

function grossUp(net) {
    var n = Number(net);
    if (!n || n <= 0) return 0;
    return Math.round((n / (1 - PLATFORM_COMMISSION)) * 100) / 100;
}

/**
 * Gross every fee line, then take the total from the SUM of those lines rather
 * than grossing the total separately — otherwise the customer adds the visible
 * numbers up and gets a different answer to the total, which reads as a
 * hidden charge even when it is only a rounding cent.
 */
function customerFacingQuote(q) {
    var out = {};
    var total = 0;
    FEE_FIELDS.forEach(function (f) {
        var g = grossUp(q[f]);
        out[f] = g;
        total += g;
    });
    out.quote_total = Math.round(total * 100) / 100;
    return out;
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

        var dropoff = str(b.dropoff_code, 40);
        var mountain = isMountainRoute(pickup, dropoff);

        var fleet = (await activeFleet())
            .map(function (v) { return fleetRow(v, pax); })
            .filter(function (v) { return fits(v, pax); })
            .map(function (v) { return markTerrain(withLuggageFlag(v, bags), mountain); })
            .sort(bySuitability);

        var partner = listPartnerVehicles({ passengers: pax, pickup_code: pickup })
            .map(function (v) { return markTerrain(withLuggageFlag(v, bags), mountain); })
            .sort(bySuitability);

        res.json({
            fleet: fleet,
            partner: partner,
            route: estimateRoute(pickup, dropoff),
            terrain: mountain ? 'mountain' : 'road',
            terrain_label: mountainEndpoint(pickup, dropoff)
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
router.post('/', authenticateToken, async function (req, res) {
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

        // If the guest chose one of our listed cars, the partner who owns that
        // car is the one who fulfils it, so route it straight to them. A
        // "find my car" request has no owner, so it stays on the shared board
        // for any partner to pick up.
        var assignedPartner = null;
        if (vehicleId) {
            var owner = await queryOne('SELECT partner_id FROM vehicles WHERE id = $1', [vehicleId]);
            if (owner) assignedPartner = owner.partner_id;
        }

        var route = estimateRoute(str(b.pickup_code, 40), str(b.dropoff_code, 40)) || {};

        await execute(
            'INSERT INTO transfer_requests (' +
            'reference, guest_id, partner_id, kind, transfer_type, contact_name, contact_email, contact_phone,' +
            'pickup_code, pickup_label, dropoff_code, dropoff_label, pickup_date, pickup_time,' +
            'return_date, return_time, distance_km, duration_min, passengers, luggage,' +
            'requirements, extras, vehicle_id, vehicle_source, vehicle_label, requested_vehicle,' +
            'quoted_price, currency, status' +
            ') VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)',
            [
                reference,
                (req.user && req.user.id) || null,
                assignedPartner,
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
                'pending_admin'
            ]
        );

        // Dispatch note: everything needed to act on this without opening the
        // admin panel. Ordered by what you decide first — is it bookable, when
        // is it, what car, who do I call.
        var paxN = Math.max(1, int(b.passengers, 1));
        var bagsN = Math.max(0, int(b.luggage, 0));
        var mountain = isMountainRoute(str(b.pickup_code, 40), str(b.dropoff_code, 40));
        // One merged list now — Step 2 collects every optional service.
        var servicesTxt = labelList(b.extras);
        var L = [];

        L.push(kind === 'booking'
            ? '🚘 NEW TRANSFER BOOKING  ' + reference
            : '🔎 TRANSFER REQUEST (needs sourcing)  ' + reference);
        L.push('');
        L.push('📍 ' + pickupLabel);
        L.push('     ↓' + (route.distance_km
            ? '  ' + route.distance_km + ' km · approx ' + humanDuration(route.duration_min) : ''));
        L.push('📍 ' + dropoffLabel);
        if (mountain) L.push('⛰️ Mountain route — 4x4 recommended');
        L.push('');
        L.push('🗓 ' + date + ' at ' + time);
        if (str(b.return_date, 20)) {
            L.push('↩️ Return ' + str(b.return_date, 20) + ' at ' + (str(b.return_time, 10) || '—'));
        }
        L.push('👥 ' + paxN + ' passenger' + (paxN === 1 ? '' : 's') +
               '  ·  🧳 ' + bagsN + ' bag' + (bagsN === 1 ? '' : 's'));
        L.push('🏷 ' + (str(b.transfer_type, 40) || 'airport'));
        L.push('');

        if (source === 'fleet') {
            L.push('🚗 ' + (str(b.vehicle_label, 120) || 'Vehicle') + '  (our own fleet)');
            L.push('💰 ' + (b.quoted_price != null ? '$' + Number(b.quoted_price) + ' / day' : 'no price'));
        } else if (source === 'partner') {
            L.push('🚗 ' + (str(b.vehicle_label, 120) || 'Vehicle') + '  (partner — confirm availability)');
            L.push('💰 Price on request');
        } else {
            L.push('🚗 Requested: ' + (str(b.requested_vehicle, 160) || 'not specified'));
            L.push('💰 Price on request — source from partners');
        }

        if (servicesTxt) L.push('➕ Services: ' + servicesTxt);
        L.push('');
        L.push('👤 ' + (str(b.contact_name, 100) || 'no name'));
        if (str(b.contact_phone, 40)) L.push('📞 ' + str(b.contact_phone, 40));
        if (str(b.contact_email, 160)) L.push('✉️ ' + str(b.contact_email, 160));
        L.push(req.user && req.user.id
            ? '🔓 Signed-in customer (id ' + req.user.id + ')'
            : '👋 Guest — not signed in');

        notifyOwner(L.join('\n'));

        res.status(201).json({
            reference: reference,
            kind: kind,
            status: 'open'
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
            'SELECT t.reference, t.kind, t.status, t.transfer_type, t.pickup_label, t.dropoff_label,' +
            ' t.pickup_date, t.pickup_time, t.passengers, t.luggage, t.vehicle_label,' +
            ' t.requested_vehicle, t.currency, t.created_at,' +
            ' q.price_car, q.fee_airport, q.fee_chauffeur, q.fee_dropoff, q.fee_luggage,' +
            ' q.fee_other, q.other_label, q.note AS quote_note, q.total AS quote_total,' +
            ' q.status AS quote_status, t.commission_due, t.payment_status' +
            ' FROM transfer_requests t' +
            ' LEFT JOIN LATERAL (SELECT * FROM transfer_quotes' +
            '   WHERE transfer_id = t.id ORDER BY created_at DESC, id DESC LIMIT 1) q ON true' +
            ' WHERE t.guest_id = $1 ORDER BY t.created_at DESC LIMIT 50',
            [req.user.id]
        );
        // Show the customer the commission-inclusive figures.
        rows.forEach(function (r) {
            if (r.quote_total == null) return;
            var g = customerFacingQuote(r);
            FEE_FIELDS.forEach(function (f) { r[f] = g[f]; });
            r.quote_total = g.quote_total;
        });
        res.json({ transfers: rows });
    } catch (e) {
        console.error('[transfers] mine error:', e.message);
        res.status(500).json({ error: 'Could not load your transfers' });
    }
});


// ---- quote workflow --------------------------------------------------------
//
// open -> claimed -> quoted -> confirmed
//                      \----> declined (customer rejects; partner may re-quote)
//
// Every transfer goes through it: prices here are negotiated, so even a car
// from our own fleet is priced by the partner who takes the job rather than
// billed at the listed day rate.


function money(v) {
    var n = parseFloat(v);
    if (isNaN(n) || n < 0) return 0;
    return Math.round(n * 100) / 100;
}

/** The live offer for a transfer is simply its newest quote. */
async function latestQuote(transferId) {
    return queryOne(
        'SELECT * FROM transfer_quotes WHERE transfer_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1',
        [transferId]
    );
}

/**
 * GET /api/transfers/open — the partner job board.
 * Broadcast model: every partner sees unclaimed transfers, first to claim wins.
 */
router.get('/open', authenticateToken, requireRole('partner'), async function (req, res) {
    try {
        var rows = await queryAll(
            'SELECT reference, transfer_type, pickup_label, dropoff_label, pickup_date, pickup_time,' +
            ' return_date, return_time, distance_km, duration_min, passengers, luggage, extras,' +
            ' vehicle_label, requested_vehicle, vehicle_source, created_at' +
            ' FROM transfer_requests WHERE partner_id IS NULL' +
            "  AND status = 'open'" +
            ' ORDER BY pickup_date ASC, created_at ASC LIMIT 100'
        );
        res.json({ transfers: rows });
    } catch (e) {
        console.error('[transfers] open error:', e.message);
        res.status(500).json({ error: 'Could not load open transfers' });
    }
});

/** GET /api/transfers/claimed — the transfers this partner has taken. */
router.get('/claimed', authenticateToken, requireRole('partner'), async function (req, res) {
    try {
        var rows = await queryAll(
            'SELECT t.*, q.total AS live_total, q.status AS quote_status' +
            ' FROM transfer_requests t' +
            ' LEFT JOIN LATERAL (SELECT total, status FROM transfer_quotes' +
            '   WHERE transfer_id = t.id ORDER BY created_at DESC, id DESC LIMIT 1) q ON true' +
            ' WHERE t.partner_id = $1 ORDER BY t.pickup_date ASC LIMIT 100',
            [req.user.id]
        );
        res.json({ transfers: rows });
    } catch (e) {
        console.error('[transfers] claimed error:', e.message);
        res.status(500).json({ error: 'Could not load your transfers' });
    }
});

/**
 * POST /api/transfers/:reference/claim
 * Race-free: the WHERE clause only matches while the transfer is unclaimed, so
 * if two partners press Accept at the same moment exactly one UPDATE affects a
 * row and the other is told it has gone.
 */
router.post('/:reference/claim', authenticateToken, requireRole('partner'), async function (req, res) {
    try {
        var ref = (str(req.params.reference, 20) || '').toUpperCase();
        var r = await execute(
            'UPDATE transfer_requests SET partner_id = $1, claimed_at = CURRENT_TIMESTAMP,' +
            "  status = 'claimed', updated_at = CURRENT_TIMESTAMP" +
            ' WHERE reference = $2 AND partner_id IS NULL' +
            "  AND status = 'open'",
            [req.user.id, ref]
        );
        if (!r.rowCount) {
            return res.status(409).json({ error: 'Another partner has already taken this transfer' });
        }
        notifyOwner('Transfer ' + ref + ' claimed by partner #' + req.user.id);
        res.json({ ok: true, reference: ref, status: 'claimed' });
    } catch (e) {
        console.error('[transfers] claim error:', e.message);
        res.status(500).json({ error: 'Could not claim this transfer' });
    }
});

/**
 * POST /api/transfers/:reference/quote — the partner's pricing form.
 * Only the holding partner may price it. Re-quoting after a rejection creates a
 * new row rather than overwriting, so the negotiation history survives.
 */
router.post('/:reference/quote', authenticateToken, requireRole('partner'), async function (req, res) {
    try {
        var ref = (str(req.params.reference, 20) || '').toUpperCase();
        var t = await queryOne(
            'SELECT id, partner_id, status FROM transfer_requests WHERE reference = $1', [ref]);
        if (!t) return res.status(404).json({ error: 'Not found' });
        if (t.partner_id !== req.user.id) return res.status(403).json({ error: 'This transfer is not yours' });
        if (['confirmed', 'cancelled'].indexOf(t.status) !== -1) {
            return res.status(409).json({ error: 'This transfer is already ' + t.status });
        }

        var b = req.body || {};
        // What the partner enters is what the partner receives.
        var vals = FEE_FIELDS.map(function (f) { return money(b[f]); });
        var partnerTotal = Math.round(vals.reduce(function (a, n) { return a + n; }, 0) * 100) / 100;
        if (partnerTotal <= 0) return res.status(400).json({ error: 'Enter at least a car price' });

        // What the customer pays is that plus our commission, spread across the
        // lines. Summing the grossed lines keeps the breakdown self-consistent.
        var grossed = {};
        vals.forEach(function (v, i) { grossed[FEE_FIELDS[i]] = grossUp(v); });
        var total = Math.round(FEE_FIELDS.reduce(function (a, f) { return a + grossed[f]; }, 0) * 100) / 100;

        await execute(
            'INSERT INTO transfer_quotes (transfer_id, partner_id, price_car, fee_airport, fee_chauffeur,' +
            ' fee_dropoff, fee_luggage, fee_other, other_label, note, total, currency,' +
            ' partner_total, commission_rate)' +
            ' VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',
            [t.id, req.user.id].concat(vals).concat([
                str(b.other_label, 80), str(b.note, 500), total, str(b.currency, 8) || 'USD',
                partnerTotal, PLATFORM_COMMISSION
            ])
        );
        await execute(
            "UPDATE transfer_requests SET status = 'quoted', quoted_total = $1," +
            " commission_due = $2, payment_status = 'unpaid'," +
            ' updated_at = CURRENT_TIMESTAMP WHERE id = $3',
            [total, Math.round((total - partnerTotal) * 100) / 100, t.id]
        );

        notifyOwner('Transfer ' + ref + ' quoted\nPartner receives ' + partnerTotal +
            '\nCustomer pays ' + total + '\nYour commission ' +
            (Math.round((total - partnerTotal) * 100) / 100) + ' (partner #' + req.user.id + ')');
        res.json({ ok: true, reference: ref, total: total, partner_total: partnerTotal, status: 'quoted' });
    } catch (e) {
        console.error('[transfers] quote submit error:', e.message);
        res.status(500).json({ error: 'Could not save the quote' });
    }
});

/**
 * POST /api/transfers/:reference/respond — the customer accepts or rejects.
 * A rejection hands the transfer back to the partner to re-quote rather than
 * killing the job outright.
 */
router.post('/:reference/respond', authenticateToken, async function (req, res) {
    try {
        var ref = (str(req.params.reference, 20) || '').toUpperCase();
        var accept = !!(req.body && req.body.accept === true);
        var t = await queryOne(
            'SELECT id, guest_id, status FROM transfer_requests WHERE reference = $1', [ref]);
        if (!t) return res.status(404).json({ error: 'Not found' });
        if (t.guest_id !== req.user.id) return res.status(403).json({ error: 'This transfer is not yours' });
        if (t.status !== 'quoted') return res.status(409).json({ error: 'There is no offer to respond to' });

        var q = await latestQuote(t.id);
        if (!q) return res.status(409).json({ error: 'There is no offer to respond to' });

        // Accepting is no longer a click — the customer confirms by paying our
        // commission (see /pay/create-order). This endpoint handles rejection
        // only, so nothing can reach 'confirmed' without money changing hands.
        if (accept) {
            return res.status(400).json({
                error: 'Accepting a price means paying the booking fee. Use the payment button.'
            });
        }

        await execute(
            "UPDATE transfer_quotes SET status = 'rejected', responded_at = CURRENT_TIMESTAMP WHERE id = $1",
            [q.id]
        );
        await execute(
            "UPDATE transfer_requests SET status = 'claimed', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
            [t.id]
        );

        notifyOwner('Transfer ' + ref + ' offer REJECTED by the customer (' + q.total + ')');
        res.json({ ok: true, status: 'declined' });
    } catch (e) {
        console.error('[transfers] respond error:', e.message);
        res.status(500).json({ error: 'Could not record your response' });
    }
});


// ---- admin approval --------------------------------------------------------
//
// Nothing reaches a partner until you have seen it. A submitted transfer sits
// at `pending_admin`; approving it either hands it to the partner who owns the
// car the guest chose, or puts it on the shared board when no specific car was
// picked.

/** GET /api/transfers/admin/list?status= — the admin queue. */
router.get('/admin/list', authenticateToken, requireRole('admin'), async function (req, res) {
    try {
        var status = str(req.query.status, 30);
        var params = [];
        var where = '';
        if (status === 'pending') {
            where = " WHERE t.status = 'pending_admin'";
        } else if (status) {
            params.push(status);
            where = ' WHERE t.status = $1';
        }
        var rows = await queryAll(
            'SELECT t.*, u.full_name AS guest_name, u.email AS guest_email,' +
            ' p.full_name AS partner_name,' +
            ' q.total AS quote_total, q.status AS quote_status' +
            ' FROM transfer_requests t' +
            ' LEFT JOIN users u ON u.id = t.guest_id' +
            ' LEFT JOIN users p ON p.id = t.partner_id' +
            ' LEFT JOIN LATERAL (SELECT total, status FROM transfer_quotes' +
            '   WHERE transfer_id = t.id ORDER BY created_at DESC, id DESC LIMIT 1) q ON true' +
            where +
            ' ORDER BY t.created_at DESC LIMIT 200',
            params
        );
        res.json({ transfers: rows });
    } catch (e) {
        console.error('[transfers] admin list error:', e.message);
        res.status(500).json({ error: 'Could not load transfers' });
    }
});

/**
 * POST /api/transfers/admin/:reference/approve
 * Releases the transfer. If a partner was auto-assigned from the chosen car it
 * goes to them (`claimed`); otherwise it lands on the shared board (`open`).
 */
router.post('/admin/:reference/approve', authenticateToken, requireRole('admin'), async function (req, res) {
    try {
        var ref = (str(req.params.reference, 20) || '').toUpperCase();
        var t = await queryOne('SELECT id, partner_id, status FROM transfer_requests WHERE reference = $1', [ref]);
        if (!t) return res.status(404).json({ error: 'Not found' });
        if (t.status !== 'pending_admin') {
            return res.status(409).json({ error: 'Already ' + t.status });
        }
        var next = t.partner_id ? 'claimed' : 'open';
        await execute(
            'UPDATE transfer_requests SET status = $1, claimed_at = CASE WHEN $2::int IS NULL' +
            ' THEN claimed_at ELSE CURRENT_TIMESTAMP END, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
            [next, t.partner_id, t.id]
        );
        res.json({ ok: true, status: next, assigned: !!t.partner_id });
    } catch (e) {
        console.error('[transfers] approve error:', e.message);
        res.status(500).json({ error: 'Could not approve' });
    }
});

/** POST /api/transfers/admin/:reference/decline */
router.post('/admin/:reference/decline', authenticateToken, requireRole('admin'), async function (req, res) {
    try {
        var ref = (str(req.params.reference, 20) || '').toUpperCase();
        var r = await execute(
            "UPDATE transfer_requests SET status = 'cancelled', admin_note = $1," +
            ' updated_at = CURRENT_TIMESTAMP WHERE reference = $2',
            [str(req.body && req.body.note, 500), ref]
        );
        if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
        res.json({ ok: true, status: 'cancelled' });
    } catch (e) {
        console.error('[transfers] decline error:', e.message);
        res.status(500).json({ error: 'Could not decline' });
    }
});


// ---- pre-created partner offers -------------------------------------------
//
// The mirror image of a request: the partner publishes a transfer or tour with
// a base price up front, and customers search and book it. Booking one still
// enters the same approval + quote lifecycle, because extras and fees are only
// known once the partner sees the specific journey.

function jsonList(v) {
    if (Array.isArray(v)) return JSON.stringify(v.slice(0, 30).map(function (x) { return String(x).slice(0, 80); }));
    return JSON.stringify([]);
}

function offerRow(o) {
    function parse(raw) {
        try { var a = JSON.parse(raw); return Array.isArray(a) ? a : []; } catch (e) { return []; }
    }
    return {
        id: o.id,
        kind: o.kind,
        title: o.title,
        from_label: o.from_label,
        to_label: o.to_label,
        from_code: o.from_code,
        to_code: o.to_code,
        offer_date: o.offer_date,
        offer_time: o.offer_time,
        vehicle_label: o.vehicle_label,
        seats: o.seats,
        luggage: o.luggage,
        included: parse(o.included_services),
        additional: parse(o.additional_services),
        base_price: o.base_price == null ? null : Number(o.base_price),
        currency: o.currency,
        conditions: o.conditions,
        // The partner is never named to the customer — the platform is the
        // single booking surface, the partner is the supply behind it.
        status: o.status
    };
}

/**
 * GET /api/transfers/offers — public search.
 * Filters are all optional so the page can show everything by default.
 */
router.get('/offers', async function (req, res) {
    try {
        var where = ["status = 'active'"];
        var params = [];
        var q = req.query || {};

        if (str(q.from, 40)) { params.push(str(q.from, 40)); where.push('from_code = $' + params.length); }
        if (str(q.to, 40)) { params.push(str(q.to, 40)); where.push('to_code = $' + params.length); }
        // An offer with no date is an "any date" standing offer, so it should
        // still surface when someone searches a specific day.
        if (str(q.date, 20)) {
            params.push(str(q.date, 20));
            where.push('(offer_date IS NULL OR offer_date = $' + params.length + ')');
        }
        if (int(q.passengers)) { params.push(int(q.passengers)); where.push('seats >= $' + params.length); }
        if (str(q.kind, 20) === 'tour' || str(q.kind, 20) === 'transfer') {
            params.push(str(q.kind, 20)); where.push('kind = $' + params.length);
        }

        var rows = await queryAll(
            'SELECT * FROM transfer_offers WHERE ' + where.join(' AND ') +
            ' ORDER BY base_price ASC, id DESC LIMIT 60', params);
        res.json({ offers: rows.map(offerRow) });
    } catch (e) {
        console.error('[transfers] offers search error:', e.message);
        res.status(500).json({ error: 'Could not load offers' });
    }
});

/** GET /api/transfers/offers/mine — the partner's own offers, any status. */
router.get('/offers/mine', authenticateToken, requireRole('partner'), async function (req, res) {
    try {
        var rows = await queryAll(
            'SELECT * FROM transfer_offers WHERE partner_id = $1 ORDER BY created_at DESC LIMIT 100',
            [req.user.id]);
        res.json({ offers: rows.map(offerRow) });
    } catch (e) {
        console.error('[transfers] offers mine error:', e.message);
        res.status(500).json({ error: 'Could not load your offers' });
    }
});

/** POST /api/transfers/offers — publish an offer. */
router.post('/offers', authenticateToken, requireRole('partner'), async function (req, res) {
    try {
        var b = req.body || {};
        var fromLabel = str(b.from_label, 160);
        var toLabel = str(b.to_label, 160);
        var price = parseFloat(b.base_price);

        if (!fromLabel || !toLabel) return res.status(400).json({ error: 'Departure and destination are required' });
        if (isNaN(price) || price <= 0) return res.status(400).json({ error: 'Enter a base price' });

        var kind = b.kind === 'tour' ? 'tour' : 'transfer';
        await execute(
            'INSERT INTO transfer_offers (partner_id, kind, title, from_code, from_label, to_code, to_label,' +
            ' offer_date, offer_time, vehicle_label, seats, luggage, included_services, additional_services,' +
            ' base_price, currency, conditions)' +
            ' VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)',
            [
                req.user.id, kind, str(b.title, 160),
                str(b.from_code, 40), fromLabel,
                str(b.to_code, 40), toLabel,
                str(b.offer_date, 20), str(b.offer_time, 10),
                str(b.vehicle_label, 120),
                Math.max(1, int(b.seats, 4)), Math.max(0, int(b.luggage, 2)),
                jsonList(b.included), jsonList(b.additional),
                Math.round(price * 100) / 100, str(b.currency, 8) || 'USD',
                str(b.conditions, 1000)
            ]
        );
        notifyOwner('New transfer offer published by partner #' + req.user.id + ': ' +
            fromLabel + ' -> ' + toLabel + ' from ' + price);
        res.status(201).json({ ok: true });
    } catch (e) {
        console.error('[transfers] offer create error:', e.message);
        res.status(500).json({ error: 'Could not publish the offer' });
    }
});

/** PATCH /api/transfers/offers/:id — pause, reactivate or retire an offer. */
router.patch('/offers/:id', authenticateToken, requireRole('partner'), async function (req, res) {
    try {
        var id = int(req.params.id);
        var status = str(req.body && req.body.status, 20);
        if (['active', 'paused', 'expired'].indexOf(status) === -1) {
            return res.status(400).json({ error: 'Unknown status' });
        }
        var r = await execute(
            'UPDATE transfer_offers SET status = $1, updated_at = CURRENT_TIMESTAMP' +
            ' WHERE id = $2 AND partner_id = $3',
            [status, id, req.user.id]);
        if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
        res.json({ ok: true, status: status });
    } catch (e) {
        console.error('[transfers] offer patch error:', e.message);
        res.status(500).json({ error: 'Could not update the offer' });
    }
});

/**
 * POST /api/transfers/offers/:id/book — a customer takes a published offer.
 * It becomes a normal transfer request pre-assigned to the offer's partner, so
 * it goes through the same admin approval and quote steps. The base price is
 * carried as a hint, not as a promise: extras and fees still get confirmed.
 */
router.post('/offers/:id/book', authenticateToken, async function (req, res) {
    try {
        var id = int(req.params.id);
        var o = await queryOne("SELECT * FROM transfer_offers WHERE id = $1 AND status = 'active'", [id]);
        if (!o) return res.status(404).json({ error: 'This offer is no longer available' });

        var b = req.body || {};
        if (!str(b.contact_name, 100) || !(str(b.contact_phone, 40) || str(b.contact_email, 160))) {
            return res.status(400).json({ error: 'A name and either a phone or an email are required' });
        }

        var reference = makeReference();
        var date = str(b.pickup_date, 20) || o.offer_date;
        var time = str(b.pickup_time, 10) || o.offer_time;
        if (!date || !time) return res.status(400).json({ error: 'Choose a date and time' });

        var route = estimateRoute(o.from_code, o.to_code) || {};

        await execute(
            'INSERT INTO transfer_requests (reference, guest_id, partner_id, offer_id, kind, transfer_type,' +
            ' contact_name, contact_email, contact_phone, pickup_code, pickup_label, dropoff_code, dropoff_label,' +
            ' pickup_date, pickup_time, distance_km, duration_min, passengers, luggage, requirements, extras,' +
            ' vehicle_source, vehicle_label, quoted_price, currency, status)' +
            ' VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)',
            [
                reference, req.user.id, o.partner_id, o.id, 'request',
                o.kind === 'tour' ? 'tour' : 'intercity',
                str(b.contact_name, 100), str(b.contact_email, 160), str(b.contact_phone, 40),
                o.from_code, o.from_label, o.to_code, o.to_label,
                date, time,
                route.distance_km || null, route.duration_min || null,
                Math.max(1, int(b.passengers, 1)), Math.max(0, int(b.luggage, 0)),
                JSON.stringify([]), jsonList(b.extras),
                'partner', o.vehicle_label || (o.title || 'Partner offer'),
                o.base_price, o.currency || 'USD',
                'pending_admin'
            ]
        );

        notifyOwner('Offer booked ' + reference + '\n' + o.from_label + ' -> ' + o.to_label +
            '\n' + date + ' ' + time + '\nfrom ' + o.base_price + ' (partner #' + o.partner_id + ')');
        res.status(201).json({ reference: reference, status: 'pending_admin' });
    } catch (e) {
        console.error('[transfers] offer book error:', e.message);
        res.status(500).json({ error: 'Could not book this offer' });
    }
});


// ---- paying the booking fee ------------------------------------------------
//
// The customer confirms a transfer by paying OUR commission online; the rest
// goes to the partner directly. Same shape as the rental reservation fee, so
// the same PayPal helper is reused.

/** The transfer, only if it belongs to the caller and is awaiting payment. */
async function payableTransfer(ref, userId) {
    var t = await queryOne(
        'SELECT id, reference, guest_id, status, commission_due, quoted_total, payment_status' +
        ' FROM transfer_requests WHERE reference = $1', [ref]);
    if (!t) return { error: 'Not found', code: 404 };
    if (t.guest_id !== userId) return { error: 'This transfer is not yours', code: 403 };
    if (t.status !== 'quoted') return { error: 'There is no offer to pay for', code: 409 };
    if (t.payment_status === 'paid') return { error: 'Already paid', code: 409 };
    if (!t.commission_due || Number(t.commission_due) <= 0) {
        return { error: 'Nothing to pay on this transfer', code: 409 };
    }
    return { transfer: t };
}

router.post('/:reference/pay/create-order', authenticateToken, async function (req, res) {
    try {
        if (!paypal.isConfigured()) {
            return res.status(503).json({ error: 'Online payment is not available right now' });
        }
        var ref = (str(req.params.reference, 20) || '').toUpperCase();
        var r = await payableTransfer(ref, req.user.id);
        if (r.error) return res.status(r.code).json({ error: r.error });

        var fee = Number(r.transfer.commission_due);
        var order = await paypal.createOrder(
            'TRANSFER-' + r.transfer.id, fee, 'USD', 'Booking fee for transfer ' + ref);

        await execute(
            'UPDATE transfer_requests SET paypal_order_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [order.id, r.transfer.id]);
        res.json({ orderId: order.id, amount: fee });
    } catch (e) {
        console.error('[transfers] pay create error:', e.message);
        res.status(500).json({ error: 'Could not start the payment' });
    }
});

router.post('/:reference/pay/capture', authenticateToken, async function (req, res) {
    try {
        var ref = (str(req.params.reference, 20) || '').toUpperCase();
        var r = await payableTransfer(ref, req.user.id);
        if (r.error) return res.status(r.code).json({ error: r.error });

        var orderId = str(req.body && req.body.order_id, 60);
        if (!orderId) return res.status(400).json({ error: 'Missing order id' });

        var capture = await paypal.captureOrder(orderId);
        if (!capture || capture.status !== 'COMPLETED') {
            return res.status(402).json({ error: 'Payment was not completed' });
        }
        var captureId = null;
        try {
            captureId = capture.purchase_units[0].payments.captures[0].id;
        } catch (e) { /* keep the booking even if the id shape changes */ }

        var q = await latestQuote(r.transfer.id);
        if (q) {
            await execute(
                "UPDATE transfer_quotes SET status = 'accepted', responded_at = CURRENT_TIMESTAMP WHERE id = $1",
                [q.id]);
        }
        await execute(
            "UPDATE transfer_requests SET status = 'confirmed', payment_status = 'paid'," +
            ' paypal_capture_id = $1, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP' +
            ' WHERE id = $2',
            [captureId, r.transfer.id]);

        notifyOwner('Transfer ' + ref + ' CONFIRMED and PAID\n' +
            'Booking fee received: ' + Number(r.transfer.commission_due) + '\n' +
            'Customer total: ' + Number(r.transfer.quoted_total) + '\n' +
            'Partner is owed the balance directly.');

        res.json({ ok: true, status: 'confirmed', paid: Number(r.transfer.commission_due) });
    } catch (e) {
        console.error('[transfers] pay capture error:', e.message);
        res.status(500).json({ error: 'Could not confirm the payment' });
    }
});

module.exports = router;
