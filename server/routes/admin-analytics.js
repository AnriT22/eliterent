// Admin analytics API — Visitors + SEO Analytics dashboards.
// Read-only aggregations over page_visits (enriched pageview log) and bookings
// (attributed via bookings.visitor_id). Everything is admin-only, bot-filtered
// and served through a small in-memory cache so heavy dashboard refreshes never
// touch the DB more than once a minute.
const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { queryAll, queryOne } = require('../db-helpers');
const seoAudit = require('../seo-audit');
const { countryName } = require('../visitor-tracking');

const router = express.Router();
router.use(authenticateToken, requireRole('admin'));

// A visit counts as HUMAN if it passed header checks (is_bot=0) OR the browser
// later proved itself by running JS (is_verified=1) — same rule as admin.js.
const HUMAN = '(is_verified = 1 OR is_bot = 0)';
const ORGANIC_SOURCES = "('google_organic','organic_other','google_maps')";
// Real booking attempts (guest passed OTP); revenue counts confirmed ones only.
const REAL_BOOKINGS = "status <> 'pending_verification'";
const REVENUE_FILTER = "status IN ('accepted','completed')";

// ---------- range filters (whitelisted SQL fragments, {col} substituted) ----------
const RANGES = {
    today:     "{col} >= CURRENT_DATE",
    yesterday: "{col} >= CURRENT_DATE - INTERVAL '1 day' AND {col} < CURRENT_DATE",
    '7d':      "{col} >= NOW() - INTERVAL '7 days'",
    '30d':     "{col} >= NOW() - INTERVAL '30 days'",
    '90d':     "{col} >= NOW() - INTERVAL '90 days'",
    month:     "{col} >= date_trunc('month', NOW())",
    lastmonth: "{col} >= date_trunc('month', NOW()) - INTERVAL '1 month' AND {col} < date_trunc('month', NOW())",
    year:      "{col} >= date_trunc('year', NOW())",
    all:       "TRUE"
};
// Previous equivalent window, for growth comparisons.
const PREV_RANGES = {
    today:     "{col} >= CURRENT_DATE - INTERVAL '1 day' AND {col} < CURRENT_DATE",
    yesterday: "{col} >= CURRENT_DATE - INTERVAL '2 days' AND {col} < CURRENT_DATE - INTERVAL '1 day'",
    '7d':      "{col} >= NOW() - INTERVAL '14 days' AND {col} < NOW() - INTERVAL '7 days'",
    '30d':     "{col} >= NOW() - INTERVAL '60 days' AND {col} < NOW() - INTERVAL '30 days'",
    '90d':     "{col} >= NOW() - INTERVAL '180 days' AND {col} < NOW() - INTERVAL '90 days'",
    month:     "{col} >= date_trunc('month', NOW()) - INTERVAL '1 month' AND {col} < date_trunc('month', NOW())",
    lastmonth: "{col} >= date_trunc('month', NOW()) - INTERVAL '2 months' AND {col} < date_trunc('month', NOW()) - INTERVAL '1 month'"
};

function rangeKey(req) {
    var r = String(req.query.range || '30d');
    return RANGES[r] ? r : '30d';
}
function rangeSql(key, col) { return RANGES[key].split('{col}').join(col); }
function prevRangeSql(key, col) {
    return PREV_RANGES[key] ? PREV_RANGES[key].split('{col}').join(col) : null;
}

// ---------- tiny response cache ----------
var _cache = new Map();
function cached(req, res, ttlMs, build) {
    var key = req.originalUrl;
    var hit = _cache.get(key);
    var now = Date.now();
    if (hit && (now - hit.ts) < ttlMs) return res.json(hit.data);
    Promise.resolve().then(build).then(function (data) {
        _cache.set(key, { ts: Date.now(), data: data });
        if (_cache.size > 300) _cache.clear();
        res.json(data);
    }).catch(function (err) {
        console.error('[Analytics] ' + req.path + ':', err);
        res.status(500).json({ error: 'Failed to load analytics data' });
    });
}

function num(v) { return parseFloat(v) || 0; }
function int(v) { return parseInt(v) || 0; }
function pct(part, whole) { return whole > 0 ? Math.round(part / whole * 1000) / 10 : 0; }

// Bookings attributed to a visitor dimension (latest pageview value of the
// booking's visitor). Dimension expressions are whitelisted — never user input.
const DIMS = {
    country: { expr: 'p.country_code', notNull: 'p.country_code IS NOT NULL' },
    city:    { expr: "p.city || '|' || p.country_code", notNull: 'p.city IS NOT NULL' },
    device:  { expr: 'p.device', notNull: 'p.device IS NOT NULL' },
    source:  { expr: "COALESCE(p.source, 'direct')", notNull: 'TRUE' },
    lang:    { expr: "LOWER(SPLIT_PART(p.language, '-', 1))", notNull: 'p.language IS NOT NULL' }
};
async function attributedBookings(dimName, rKey) {
    var dim = DIMS[dimName];
    var rows = await queryAll(
        `SELECT pv.dim AS key,
                COUNT(DISTINCT b.id) AS bookings,
                COALESCE(SUM(b.total_price) FILTER (WHERE b.${REVENUE_FILTER}), 0) AS revenue
         FROM bookings b
         JOIN LATERAL (
             SELECT ${dim.expr} AS dim FROM page_visits p
             WHERE p.visitor_id = b.visitor_id AND ${dim.notNull}
             ORDER BY p.created_at DESC LIMIT 1
         ) pv ON TRUE
         WHERE b.visitor_id IS NOT NULL AND b.${REAL_BOOKINGS} AND ${rangeSql(rKey, 'b.created_at')}
         GROUP BY 1`
    );
    var map = {};
    rows.forEach(function (r) { if (r.key) map[r.key] = { bookings: int(r.bookings), revenue: num(r.revenue) }; });
    return map;
}

// Per-group session stats (sessions, bounce, avg duration) keyed by a dimension.
async function sessionStatsBy(dimCol, rKey, extraWhere) {
    var rows = await queryAll(
        `SELECT key, COUNT(*) AS sessions,
                COUNT(*) FILTER (WHERE views = 1) AS bounces,
                COALESCE(AVG(dur) FILTER (WHERE views > 1), 0) AS avg_duration
         FROM (
             SELECT ${dimCol} AS key, session_id, COUNT(*) AS views,
                    EXTRACT(EPOCH FROM MAX(created_at) - MIN(created_at)) AS dur
             FROM page_visits
             WHERE ${HUMAN} AND session_id IS NOT NULL AND ${rangeSql(rKey, 'created_at')}${extraWhere || ''}
             GROUP BY 1, 2
         ) s GROUP BY key`
    );
    var map = {};
    rows.forEach(function (r) {
        if (r.key == null) return;
        map[r.key] = { sessions: int(r.sessions), bounces: int(r.bounces), avgDuration: Math.round(num(r.avg_duration)) };
    });
    return map;
}

// ========================================
// VISITORS — OVERVIEW CARDS
// ========================================
router.get('/va/overview', function (req, res) {
    cached(req, res, 60000, async function () {
        var rKey = rangeKey(req);
        var R = function (col) { return rangeSql(rKey, col); };

        var buckets = await queryOne(
            `SELECT
                COUNT(DISTINCT visitor_id) FILTER (WHERE created_at >= CURRENT_DATE) AS v_today,
                COUNT(*)                   FILTER (WHERE created_at >= CURRENT_DATE) AS pv_today,
                COUNT(DISTINCT visitor_id) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '1 day' AND created_at < CURRENT_DATE) AS v_yesterday,
                COUNT(DISTINCT visitor_id) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS v_week,
                COUNT(*)                   FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS pv_week,
                COUNT(DISTINCT visitor_id) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS v_month,
                COUNT(*)                   FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS pv_month,
                COUNT(DISTINCT visitor_id) FILTER (WHERE created_at >= date_trunc('year', NOW())) AS v_year,
                COUNT(DISTINCT visitor_id) AS v_total,
                COUNT(*) AS pv_total,
                COUNT(DISTINCT visitor_id) FILTER (WHERE created_at >= NOW() - INTERVAL '5 minutes') AS live
             FROM page_visits WHERE ${HUMAN}`
        );

        var rangeStats = await queryOne(
            `SELECT COUNT(DISTINCT visitor_id) AS visitors,
                    COUNT(*) AS pageviews,
                    COUNT(DISTINCT visitor_id) FILTER (WHERE is_new = 1) AS new_visitors
             FROM page_visits WHERE ${HUMAN} AND ${R('created_at')}`
        );

        var sess = await queryOne(
            `SELECT COUNT(*) AS sessions,
                    COUNT(*) FILTER (WHERE views = 1) AS bounces,
                    COALESCE(AVG(dur) FILTER (WHERE views > 1), 0) AS avg_duration
             FROM (
                 SELECT session_id, COUNT(*) AS views,
                        EXTRACT(EPOCH FROM MAX(created_at) - MIN(created_at)) AS dur
                 FROM page_visits
                 WHERE ${HUMAN} AND session_id IS NOT NULL AND ${R('created_at')}
                 GROUP BY session_id
             ) s`
        );

        var prevB = prevRangeSql(rKey, 'created_at');
        var bk = await queryOne(
            `SELECT COUNT(*) FILTER (WHERE ${R('created_at')} AND ${REAL_BOOKINGS}) AS bookings,
                    COALESCE(SUM(total_price) FILTER (WHERE ${R('created_at')} AND ${REVENUE_FILTER}), 0) AS revenue,
                    COALESCE(SUM(service_fee) FILTER (WHERE ${R('created_at')} AND ${REVENUE_FILTER}), 0) AS fees,
                    COUNT(*) FILTER (WHERE ${R('created_at')} AND ${REVENUE_FILTER}) AS confirmed
                    ${prevB ? `,
                    COUNT(*) FILTER (WHERE ${prevB} AND ${REAL_BOOKINGS}) AS prev_bookings,
                    COALESCE(SUM(total_price) FILTER (WHERE ${prevB} AND ${REVENUE_FILTER}), 0) AS prev_revenue` : ''}
             FROM bookings`
        );

        var prevV = prevRangeSql(rKey, 'created_at');
        var prevVisitors = null;
        if (prevV) {
            var pv = await queryOne(
                `SELECT COUNT(DISTINCT visitor_id) AS visitors FROM page_visits WHERE ${HUMAN} AND ${prevV}`
            );
            prevVisitors = int(pv.visitors);
        }

        var visitors = int(rangeStats.visitors);
        var newV = int(rangeStats.new_visitors);
        var sessions = int(sess.sessions);
        var bookings = int(bk.bookings);
        var revenue = num(bk.revenue);
        var prevRevenue = bk.prev_revenue != null ? num(bk.prev_revenue) : null;

        return {
            range: rKey,
            cards: {
                today: int(buckets.v_today), todayViews: int(buckets.pv_today),
                yesterday: int(buckets.v_yesterday),
                week: int(buckets.v_week), weekViews: int(buckets.pv_week),
                month: int(buckets.v_month), monthViews: int(buckets.pv_month),
                year: int(buckets.v_year),
                total: int(buckets.v_total), totalViews: int(buckets.pv_total),
                live: int(buckets.live)
            },
            rangeStats: {
                visitors: visitors,
                pageviews: int(rangeStats.pageviews),
                newVisitors: newV,
                returningVisitors: Math.max(0, visitors - newV),
                sessions: sessions,
                avgSessionDuration: Math.round(num(sess.avg_duration)),
                bounceRate: pct(int(sess.bounces), sessions),
                bookings: bookings,
                confirmedBookings: int(bk.confirmed),
                revenue: revenue,
                serviceFees: num(bk.fees),
                conversionRate: pct(bookings, sessions),
                visitorGrowth: prevVisitors != null ? pct(visitors - prevVisitors, prevVisitors || 1) : null,
                revenueGrowth: prevRevenue != null ? pct(revenue - prevRevenue, prevRevenue || 1) : null,
                bookingGrowth: bk.prev_bookings != null ? pct(bookings - int(bk.prev_bookings), int(bk.prev_bookings) || 1) : null
            }
        };
    });
});

// ========================================
// VISITORS — DAILY TIMESERIES (charts)
// ========================================
router.get('/va/timeseries', function (req, res) {
    cached(req, res, 60000, async function () {
        var days = { '14': 14, '30': 30, '60': 60, '90': 90 }[String(req.query.days)] || 30;
        var visits = await queryAll(
            `SELECT created_at::date AS date, COUNT(*) AS pageviews,
                    COUNT(DISTINCT visitor_id) AS visitors,
                    COUNT(DISTINCT session_id) AS sessions
             FROM page_visits
             WHERE ${HUMAN} AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
             GROUP BY 1 ORDER BY 1`
        );
        var books = await queryAll(
            `SELECT created_at::date AS date,
                    COUNT(*) FILTER (WHERE ${REAL_BOOKINGS}) AS bookings,
                    COALESCE(SUM(total_price) FILTER (WHERE ${REVENUE_FILTER}), 0) AS revenue
             FROM bookings
             WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
             GROUP BY 1 ORDER BY 1`
        );
        var byDate = {};
        books.forEach(function (b) {
            byDate[String(b.date).substring(0, 10)] = { bookings: int(b.bookings), revenue: num(b.revenue) };
        });
        return {
            days: days,
            series: visits.map(function (v) {
                var key = String(v.date).substring(0, 10);
                var b = byDate[key] || { bookings: 0, revenue: 0 };
                return {
                    date: key, pageviews: int(v.pageviews), visitors: int(v.visitors),
                    sessions: int(v.sessions), bookings: b.bookings, revenue: b.revenue
                };
            })
        };
    });
});

// ========================================
// VISITORS — FULL VISITOR TABLE
// ========================================
router.get('/va/visitors', function (req, res) {
    cached(req, res, 30000, async function () {
        var rKey = rangeKey(req);
        var limit = Math.min(int(req.query.limit) || 50, 200);
        var offset = Math.max(int(req.query.offset) || 0, 0);

        var where = [HUMAN, rangeSql(rKey, 'created_at')];
        var params = [];
        function add(cond, val) { params.push(val); where.push(cond.replace('?', '$' + params.length)); }

        if (req.query.country) add('country_code = ?', String(req.query.country).toUpperCase().substring(0, 2));
        if (req.query.device) add('device = ?', String(req.query.device).substring(0, 20));
        if (req.query.browser) add('browser = ?', String(req.query.browser).substring(0, 30));
        if (req.query.source) add('source = ?', String(req.query.source).substring(0, 30));
        if (req.query.lang) add('language ILIKE ?', String(req.query.lang).substring(0, 10) + '%');
        if (req.query.q) {
            params.push('%' + String(req.query.q).substring(0, 60) + '%');
            var p = '$' + params.length;
            where.push(`(ip ILIKE ${p} OR city ILIKE ${p} OR country ILIKE ${p} OR page ILIKE ${p})`);
        }
        var whereSql = where.join(' AND ');

        var totalRow = await queryOne(
            `SELECT COUNT(DISTINCT visitor_id) AS total FROM page_visits WHERE ${whereSql}`, params
        );

        var rows = await queryAll(
            `SELECT visitor_id,
                    MIN(created_at) AS first_seen, MAX(created_at) AS last_seen,
                    COUNT(*) AS views, COUNT(DISTINCT session_id) AS sessions,
                    (array_agg(ip ORDER BY created_at DESC))[1] AS ip,
                    (array_agg(country ORDER BY created_at DESC))[1] AS country,
                    (array_agg(country_code ORDER BY created_at DESC))[1] AS country_code,
                    (array_agg(city ORDER BY created_at DESC))[1] AS city,
                    (array_agg(region ORDER BY created_at DESC))[1] AS region,
                    (array_agg(timezone ORDER BY created_at DESC))[1] AS timezone,
                    (array_agg(browser ORDER BY created_at DESC))[1] AS browser,
                    (array_agg(browser_version ORDER BY created_at DESC))[1] AS browser_version,
                    (array_agg(os ORDER BY created_at DESC))[1] AS os,
                    (array_agg(device ORDER BY created_at DESC))[1] AS device,
                    (array_agg(language ORDER BY created_at DESC))[1] AS language,
                    (array_agg(screen ORDER BY created_at DESC))[1] AS screen,
                    (array_agg(source ORDER BY created_at ASC))[1] AS source,
                    (array_agg(referrer_host ORDER BY created_at ASC))[1] AS referrer_host,
                    (array_agg(page ORDER BY created_at ASC))[1] AS landing_page,
                    (array_agg(page ORDER BY created_at DESC))[1] AS last_page,
                    (array_agg(user_agent ORDER BY created_at DESC))[1] AS user_agent,
                    MAX(CASE WHEN page = '/reservation.html' THEN 1 ELSE 0 END) AS booking_started,
                    EXTRACT(EPOCH FROM MAX(created_at) - MIN(created_at)) AS span_seconds
             FROM page_visits
             WHERE ${whereSql}
             GROUP BY visitor_id
             ORDER BY last_seen DESC
             LIMIT ${limit} OFFSET ${offset}`, params
        );

        // Booking + registration flags for the visitors on this page
        var ids = rows.map(function (r) { return r.visitor_id; }).filter(Boolean);
        var bookedMap = {};
        if (ids.length > 0) {
            var booked = await queryAll(
                `SELECT visitor_id,
                        COUNT(*) FILTER (WHERE ${REAL_BOOKINGS}) AS bookings,
                        COUNT(*) FILTER (WHERE ${REVENUE_FILTER}) AS confirmed,
                        MAX(guest_id) AS guest_id
                 FROM bookings WHERE visitor_id = ANY($1) GROUP BY visitor_id`, [ids]
            );
            booked.forEach(function (b) {
                bookedMap[b.visitor_id] = { bookings: int(b.bookings), confirmed: int(b.confirmed), guest_id: b.guest_id };
            });
        }

        return {
            total: int(totalRow.total),
            limit: limit, offset: offset,
            visitors: rows.map(function (r) {
                var b = bookedMap[r.visitor_id] || { bookings: 0, confirmed: 0, guest_id: null };
                return Object.assign({}, r, {
                    views: int(r.views), sessions: int(r.sessions),
                    span_seconds: Math.round(num(r.span_seconds)),
                    booking_started: int(r.booking_started) === 1,
                    bookings: b.bookings, confirmed_bookings: b.confirmed,
                    registered: b.guest_id != null
                });
            })
        };
    });
});

// ========================================
// VISITORS — LIVE (last 5 minutes)
// ========================================
router.get('/va/live', function (req, res) {
    cached(req, res, 5000, async function () {
        var rows = await queryAll(
            `SELECT visitor_id,
                    MIN(created_at) AS entry_time, MAX(created_at) AS last_seen,
                    COUNT(*) AS views,
                    (array_agg(page ORDER BY created_at DESC))[1] AS current_page,
                    (array_agg(page ORDER BY created_at ASC))[1] AS entry_page,
                    (array_agg(country ORDER BY created_at DESC))[1] AS country,
                    (array_agg(country_code ORDER BY created_at DESC))[1] AS country_code,
                    (array_agg(city ORDER BY created_at DESC))[1] AS city,
                    (array_agg(device ORDER BY created_at DESC))[1] AS device,
                    (array_agg(browser ORDER BY created_at DESC))[1] AS browser,
                    (array_agg(source ORDER BY created_at ASC))[1] AS source,
                    EXTRACT(EPOCH FROM MAX(created_at) - MIN(created_at)) AS duration
             FROM page_visits
             WHERE ${HUMAN} AND created_at >= NOW() - INTERVAL '30 minutes'
             GROUP BY visitor_id
             HAVING MAX(created_at) >= NOW() - INTERVAL '5 minutes'
             ORDER BY last_seen DESC LIMIT 50`
        );
        var ids = rows.map(function (r) { return r.visitor_id; }).filter(Boolean);
        var bookedMap = {};
        if (ids.length > 0) {
            var bk = await queryAll(
                `SELECT visitor_id, COUNT(*) AS n FROM bookings
                 WHERE visitor_id = ANY($1) AND ${REAL_BOOKINGS} AND created_at >= NOW() - INTERVAL '1 day'
                 GROUP BY visitor_id`, [ids]
            );
            bk.forEach(function (b) { bookedMap[b.visitor_id] = int(b.n); });
        }
        return {
            count: rows.length,
            visitors: rows.map(function (r) {
                return Object.assign({}, r, {
                    views: int(r.views),
                    duration: Math.round(num(r.duration)),
                    booked_today: (bookedMap[r.visitor_id] || 0) > 0
                });
            })
        };
    });
});

// ========================================
// VISITORS — GEO (countries / cities)
// ========================================
router.get('/va/geo', function (req, res) {
    cached(req, res, 60000, async function () {
        var rKey = rangeKey(req);
        var by = req.query.by === 'city' ? 'city' : 'country';
        var limit = Math.min(int(req.query.limit) || 25, 300);

        var keyCol, extraWhere;
        if (by === 'city') {
            keyCol = "city || '|' || country_code";
            extraWhere = ' AND city IS NOT NULL';
        } else {
            keyCol = 'country_code';
            extraWhere = ' AND country_code IS NOT NULL';
        }

        var visits = await queryAll(
            `SELECT ${keyCol} AS key,
                    MAX(country) AS country,
                    COUNT(DISTINCT visitor_id) AS visitors,
                    COUNT(*) AS pageviews,
                    COUNT(DISTINCT visitor_id) FILTER (WHERE is_new = 0) AS returning
             FROM page_visits
             WHERE ${HUMAN} AND ${rangeSql(rKey, 'created_at')}${extraWhere}
             GROUP BY 1 ORDER BY visitors DESC LIMIT ${limit}`
        );
        var sessions = await sessionStatsBy(keyCol, rKey, extraWhere);
        var booked = await attributedBookings(by === 'city' ? 'city' : 'country', rKey);

        return {
            by: by, range: rKey,
            rows: visits.map(function (v) {
                var s = sessions[v.key] || { sessions: 0, bounces: 0, avgDuration: 0 };
                var b = booked[v.key] || { bookings: 0, revenue: 0 };
                var parts = by === 'city' ? String(v.key).split('|') : null;
                return {
                    key: v.key,
                    label: by === 'city' ? (parts[0] + (parts[1] ? ', ' + parts[1] : '')) : (v.country || v.key),
                    countryCode: by === 'city' ? (parts[1] || null) : v.key,
                    visitors: int(v.visitors), pageviews: int(v.pageviews),
                    returning: int(v.returning),
                    sessions: s.sessions,
                    bounceRate: pct(s.bounces, s.sessions),
                    avgSessionDuration: s.avgDuration,
                    bookings: b.bookings, revenue: b.revenue,
                    conversionRate: pct(b.bookings, s.sessions || int(v.visitors)),
                    avgBookingValue: b.bookings > 0 ? Math.round(b.revenue / b.bookings * 100) / 100 : 0
                };
            })
        };
    });
});

// ========================================
// VISITORS — WORLD MAP DATA
// ========================================
router.get('/va/map', function (req, res) {
    cached(req, res, 60000, async function () {
        var rKey = rangeKey(req);
        var visits = await queryAll(
            `SELECT country_code AS key, MAX(country) AS country,
                    COUNT(DISTINCT visitor_id) AS visitors, COUNT(*) AS pageviews
             FROM page_visits
             WHERE ${HUMAN} AND ${rangeSql(rKey, 'created_at')} AND country_code IS NOT NULL
             GROUP BY 1`
        );
        var sessions = await sessionStatsBy('country_code', rKey, ' AND country_code IS NOT NULL');
        var booked = await attributedBookings('country', rKey);

        var topLang = await queryAll(
            `SELECT DISTINCT ON (country_code) country_code AS key, LOWER(SPLIT_PART(language, '-', 1)) AS lang, COUNT(*) AS n
             FROM page_visits
             WHERE ${HUMAN} AND ${rangeSql(rKey, 'created_at')} AND country_code IS NOT NULL AND language IS NOT NULL
             GROUP BY country_code, LOWER(SPLIT_PART(language, '-', 1))
             ORDER BY country_code, n DESC`
        );
        var langMap = {};
        topLang.forEach(function (r) { langMap[r.key] = r.lang; });

        var topVehicles = await queryAll(
            `SELECT key, name FROM (
                 SELECT pv.dim AS key, v.name, COUNT(*) AS n,
                        ROW_NUMBER() OVER (PARTITION BY pv.dim ORDER BY COUNT(*) DESC) AS rn
                 FROM bookings b
                 JOIN vehicles v ON b.vehicle_id = v.id
                 JOIN LATERAL (
                     SELECT p.country_code AS dim FROM page_visits p
                     WHERE p.visitor_id = b.visitor_id AND p.country_code IS NOT NULL
                     ORDER BY p.created_at DESC LIMIT 1
                 ) pv ON TRUE
                 WHERE b.visitor_id IS NOT NULL AND b.${REAL_BOOKINGS} AND ${rangeSql(rKey, 'b.created_at')}
                 GROUP BY 1, 2
             ) t WHERE rn <= 3`
        );
        var vehMap = {};
        topVehicles.forEach(function (r) { (vehMap[r.key] = vehMap[r.key] || []).push(r.name); });

        var countries = {};
        visits.forEach(function (v) {
            var s = sessions[v.key] || { sessions: 0, bounces: 0, avgDuration: 0 };
            var b = booked[v.key] || { bookings: 0, revenue: 0 };
            countries[v.key] = {
                name: v.country || v.key,
                visitors: int(v.visitors), pageviews: int(v.pageviews),
                sessions: s.sessions,
                bounceRate: pct(s.bounces, s.sessions),
                bookings: b.bookings, revenue: b.revenue,
                conversionRate: pct(b.bookings, s.sessions || int(v.visitors)),
                topLanguage: langMap[v.key] || null,
                topVehicles: vehMap[v.key] || []
            };
        });
        return { range: rKey, countries: countries };
    });
});

// ========================================
// VISITORS — TRAFFIC SOURCES
// ========================================
router.get('/va/sources', function (req, res) {
    cached(req, res, 60000, async function () {
        var rKey = rangeKey(req);
        var keyCol = "COALESCE(source, 'direct')";
        var visits = await queryAll(
            `SELECT ${keyCol} AS key,
                    COUNT(DISTINCT visitor_id) AS visitors, COUNT(*) AS pageviews
             FROM page_visits
             WHERE ${HUMAN} AND ${rangeSql(rKey, 'created_at')}
             GROUP BY 1 ORDER BY visitors DESC`
        );
        var sessions = await sessionStatsBy(keyCol, rKey, '');
        var booked = await attributedBookings('source', rKey);

        var referrers = await queryAll(
            `SELECT referrer_host AS host, COUNT(DISTINCT visitor_id) AS visitors
             FROM page_visits
             WHERE ${HUMAN} AND ${rangeSql(rKey, 'created_at')} AND source = 'referral' AND referrer_host IS NOT NULL
             GROUP BY 1 ORDER BY visitors DESC LIMIT 15`
        );

        return {
            range: rKey,
            rows: visits.map(function (v) {
                var s = sessions[v.key] || { sessions: 0, bounces: 0, avgDuration: 0 };
                var b = booked[v.key] || { bookings: 0, revenue: 0 };
                return {
                    source: v.key, visitors: int(v.visitors), pageviews: int(v.pageviews),
                    sessions: s.sessions, bounceRate: pct(s.bounces, s.sessions),
                    avgSessionDuration: s.avgDuration,
                    bookings: b.bookings, revenue: b.revenue,
                    conversionRate: pct(b.bookings, s.sessions || int(v.visitors))
                };
            }),
            topReferrers: referrers.map(function (r) { return { host: r.host, visitors: int(r.visitors) }; })
        };
    });
});

// ========================================
// VISITORS — DEVICES / OS / BROWSERS
// ========================================
router.get('/va/devices', function (req, res) {
    cached(req, res, 60000, async function () {
        var rKey = rangeKey(req);
        async function grouped(col, notNull) {
            return queryAll(
                `SELECT ${col} AS key, COUNT(DISTINCT visitor_id) AS visitors,
                        COUNT(DISTINCT session_id) AS sessions, COUNT(*) AS pageviews
                 FROM page_visits
                 WHERE ${HUMAN} AND ${rangeSql(rKey, 'created_at')}${notNull ? ' AND ' + col + ' IS NOT NULL' : ''}
                 GROUP BY 1 ORDER BY visitors DESC LIMIT 20`
            );
        }
        var devices = await grouped('device', true);
        var oses = await grouped('os', true);
        var browsers = await grouped('browser', true);
        var screens = await grouped('screen', true);
        var deviceBookings = await attributedBookings('device', rKey);

        function shape(rows, bookings) {
            return rows.map(function (r) {
                var b = bookings ? (bookings[r.key] || { bookings: 0, revenue: 0 }) : null;
                var out = { key: r.key, visitors: int(r.visitors), sessions: int(r.sessions), pageviews: int(r.pageviews) };
                if (b) {
                    out.bookings = b.bookings; out.revenue = b.revenue;
                    out.conversionRate = pct(b.bookings, int(r.sessions) || int(r.visitors));
                }
                return out;
            });
        }
        return {
            range: rKey,
            devices: shape(devices, deviceBookings),
            os: shape(oses),
            browsers: shape(browsers),
            screens: shape(screens.slice(0, 8))
        };
    });
});

// ========================================
// VISITORS — LANGUAGES
// ========================================
router.get('/va/languages', function (req, res) {
    cached(req, res, 60000, async function () {
        var rKey = rangeKey(req);
        var keyCol = "LOWER(SPLIT_PART(language, '-', 1))";
        var rows = await queryAll(
            `SELECT ${keyCol} AS key,
                    COUNT(DISTINCT visitor_id) AS visitors,
                    COUNT(DISTINCT session_id) AS sessions, COUNT(*) AS pageviews
             FROM page_visits
             WHERE ${HUMAN} AND ${rangeSql(rKey, 'created_at')} AND language IS NOT NULL
             GROUP BY 1 ORDER BY visitors DESC LIMIT 25`
        );
        var booked = await attributedBookings('lang', rKey);
        return {
            range: rKey,
            rows: rows.map(function (r) {
                var b = booked[r.key] || { bookings: 0, revenue: 0 };
                return {
                    language: r.key, visitors: int(r.visitors), sessions: int(r.sessions),
                    pageviews: int(r.pageviews), bookings: b.bookings, revenue: b.revenue,
                    conversionRate: pct(b.bookings, int(r.sessions) || int(r.visitors))
                };
            })
        };
    });
});

// ========================================
// VISITORS — BOOKING FUNNEL / JOURNEY
// ========================================
router.get('/va/funnel', function (req, res) {
    cached(req, res, 60000, async function () {
        var rKey = rangeKey(req);
        async function funnelFor(deviceFilter) {
            var extra = deviceFilter ? ` AND device = '${deviceFilter}'` : '';
            var row = await queryOne(
                `SELECT COUNT(*) AS sessions,
                        COUNT(*) FILTER (WHERE saw_list) AS list,
                        COUNT(*) FILTER (WHERE saw_vehicle) AS vehicle,
                        COUNT(*) FILTER (WHERE saw_reservation) AS reservation,
                        COUNT(*) FILTER (WHERE saw_payment) AS payment
                 FROM (
                     SELECT session_id,
                            BOOL_OR(page = '/vehicles.html') AS saw_list,
                            BOOL_OR(page = '/vehicle.html') AS saw_vehicle,
                            BOOL_OR(page = '/reservation.html') AS saw_reservation,
                            BOOL_OR(page = '/payment.html') AS saw_payment
                     FROM page_visits
                     WHERE ${HUMAN} AND session_id IS NOT NULL AND ${rangeSql(rKey, 'created_at')}${extra}
                     GROUP BY session_id
                 ) t`
            );
            return {
                sessions: int(row.sessions), list: int(row.list), vehicle: int(row.vehicle),
                reservation: int(row.reservation), payment: int(row.payment)
            };
        }
        var all = await funnelFor(null);
        var mobile = await funnelFor('mobile');
        var desktop = await funnelFor('desktop');
        var bk = await queryOne(
            `SELECT COUNT(*) FILTER (WHERE ${REAL_BOOKINGS}) AS created,
                    COUNT(*) FILTER (WHERE payment_status = 'paid') AS paid,
                    COUNT(*) FILTER (WHERE ${REVENUE_FILTER}) AS confirmed
             FROM bookings WHERE ${rangeSql(rKey, 'created_at')}`
        );
        return {
            range: rKey,
            funnel: all, mobile: mobile, desktop: desktop,
            bookings: { created: int(bk.created), paid: int(bk.paid), confirmed: int(bk.confirmed) }
        };
    });
});

// ========================================
// SEO — OVERVIEW (organic + page performance)
// ========================================
router.get('/seo/overview', function (req, res) {
    cached(req, res, 60000, async function () {
        var rKey = rangeKey(req);
        var R = rangeSql(rKey, 'created_at');
        var organicWhere = `source IN ${ORGANIC_SOURCES}`;

        var organic = await queryOne(
            `SELECT COUNT(DISTINCT visitor_id) AS visitors, COUNT(*) AS pageviews,
                    COUNT(DISTINCT session_id) AS sessions,
                    COUNT(DISTINCT visitor_id) FILTER (WHERE is_new = 0) AS returning
             FROM page_visits WHERE ${HUMAN} AND ${R} AND ${organicWhere}`
        );
        var organicSess = await queryOne(
            `SELECT COUNT(*) AS sessions, COUNT(*) FILTER (WHERE views = 1) AS bounces,
                    COALESCE(AVG(dur) FILTER (WHERE views > 1), 0) AS avg_duration
             FROM (
                 SELECT session_id, COUNT(*) AS views,
                        EXTRACT(EPOCH FROM MAX(created_at) - MIN(created_at)) AS dur
                 FROM page_visits
                 WHERE ${HUMAN} AND session_id IS NOT NULL AND ${R} AND ${organicWhere}
                 GROUP BY session_id
             ) s`
        );
        var organicBookings = await queryOne(
            `SELECT COUNT(DISTINCT b.id) AS bookings,
                    COALESCE(SUM(b.total_price) FILTER (WHERE b.${REVENUE_FILTER}), 0) AS revenue
             FROM bookings b
             JOIN LATERAL (
                 SELECT p.source FROM page_visits p
                 WHERE p.visitor_id = b.visitor_id ORDER BY p.created_at ASC LIMIT 1
             ) pv ON TRUE
             WHERE b.visitor_id IS NOT NULL AND b.${REAL_BOOKINGS}
               AND ${rangeSql(rKey, 'b.created_at')} AND pv.source IN ${ORGANIC_SOURCES}`
        );

        // Landing (first page of session) + exit (last page of session)
        var landings = await queryAll(
            `SELECT page, COUNT(*) AS entrances,
                    COUNT(*) FILTER (WHERE organic) AS organic_entrances
             FROM (
                 SELECT DISTINCT ON (session_id) session_id, page, source IN ${ORGANIC_SOURCES} AS organic
                 FROM page_visits
                 WHERE ${HUMAN} AND session_id IS NOT NULL AND ${R}
                 ORDER BY session_id, created_at ASC
             ) t GROUP BY page ORDER BY entrances DESC LIMIT 15`
        );
        var exits = await queryAll(
            `SELECT page, COUNT(*) AS exits FROM (
                 SELECT DISTINCT ON (session_id) session_id, page
                 FROM page_visits
                 WHERE ${HUMAN} AND session_id IS NOT NULL AND ${R}
                 ORDER BY session_id, created_at DESC
             ) t GROUP BY page ORDER BY exits DESC LIMIT 15`
        );

        // Per-page: views, uniques, avg engagement (time to next pageview in session)
        var pages = await queryAll(
            `SELECT page, COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS uniques,
                    COALESCE(AVG(EXTRACT(EPOCH FROM (next_at - created_at))) FILTER (WHERE next_at IS NOT NULL), 0) AS avg_engagement
             FROM (
                 SELECT page, visitor_id, created_at,
                        LEAD(created_at) OVER (PARTITION BY session_id ORDER BY created_at) AS next_at
                 FROM page_visits
                 WHERE ${HUMAN} AND session_id IS NOT NULL AND ${R}
             ) t GROUP BY page ORDER BY views DESC LIMIT 30`
        );

        // Bounce per landing page
        var bounces = await queryAll(
            `SELECT landing AS page, COUNT(*) AS sessions, COUNT(*) FILTER (WHERE views = 1) AS bounces
             FROM (
                 SELECT session_id, (array_agg(page ORDER BY created_at ASC))[1] AS landing, COUNT(*) AS views
                 FROM page_visits
                 WHERE ${HUMAN} AND session_id IS NOT NULL AND ${R}
                 GROUP BY session_id
             ) t GROUP BY landing`
        );
        var bounceMap = {};
        bounces.forEach(function (b) { bounceMap[b.page] = { sessions: int(b.sessions), bounces: int(b.bounces) }; });

        var sessions = int(organicSess.sessions);
        var oBookings = int(organicBookings.bookings);
        var pageRows = pages.map(function (p) {
            var b = bounceMap[p.page] || { sessions: 0, bounces: 0 };
            return {
                page: p.page, views: int(p.views), uniques: int(p.uniques),
                avgEngagement: Math.round(num(p.avg_engagement)),
                landingSessions: b.sessions,
                bounceRate: pct(b.bounces, b.sessions)
            };
        });

        return {
            range: rKey,
            organic: {
                visitors: int(organic.visitors), pageviews: int(organic.pageviews),
                sessions: sessions, returningVisitors: int(organic.returning),
                bounceRate: pct(int(organicSess.bounces), sessions),
                avgSessionDuration: Math.round(num(organicSess.avg_duration)),
                bookings: oBookings, revenue: num(organicBookings.revenue),
                conversionRate: pct(oBookings, sessions)
            },
            landingPages: landings.map(function (l) {
                return { page: l.page, entrances: int(l.entrances), organicEntrances: int(l.organic_entrances) };
            }),
            exitPages: exits.map(function (e) { return { page: e.page, exits: int(e.exits) }; }),
            pages: pageRows,
            lowEngagement: pageRows
                .filter(function (p) { return p.views >= 10 && (p.bounceRate >= 60 || p.avgEngagement < 10); })
                .slice(0, 10)
        };
    });
});

// ========================================
// SEO — LOCATION / LANDING PAGE PERFORMANCE
// ========================================
const LOCATION_PAGES = [
    { label: 'Car Rental Georgia (homepage)', pages: ['/', '/index.html'] },
    { label: 'Car Rental Tbilisi', pages: ['/rent-car-tbilisi.html'] },
    { label: 'Tbilisi Airport', pages: ['/tbilisi-airport-car-rental.html'] },
    { label: 'Car Rental Batumi', pages: ['/rent-car-batumi.html'] },
    { label: 'Batumi Airport', pages: ['/batumi-airport-car-rental.html'] },
    { label: 'Car Rental Kutaisi', pages: ['/rent-car-kutaisi.html'] },
    { label: 'Kutaisi Airport', pages: ['/kutaisi-airport-car-rental.html'] },
    { label: 'Luxury Car Rental Tbilisi', pages: ['/luxury-car-rental-tbilisi.html'] },
    { label: 'SUV Rental Georgia', pages: ['/suv-rental-georgia.html'] },
    { label: 'Economy Car Rental', pages: ['/economy-car-rental-georgia.html'] },
    { label: 'Cheap Car Rental Georgia', pages: ['/cheap-car-rental-georgia.html'] },
    { label: 'Sedan Rental Georgia', pages: ['/sedan-rental-georgia.html'] },
    { label: 'Minivan 7-Seater', pages: ['/minivan-7-seater-rental-georgia.html'] },
    { label: 'No-Deposit Rental', pages: ['/no-deposit-car-rental-georgia.html'] },
    { label: 'Automatic Cars', pages: ['/automatic-car-rental-georgia.html'] },
    { label: 'Monthly / Long-Term Tbilisi', pages: ['/monthly-long-term-car-rental-tbilisi.html'] }
];

router.get('/seo/locations', function (req, res) {
    cached(req, res, 60000, async function () {
        var rKey = rangeKey(req);
        var R = rangeSql(rKey, 'created_at');
        var allPages = [];
        LOCATION_PAGES.forEach(function (g) { allPages = allPages.concat(g.pages); });

        var stats = await queryAll(
            `SELECT page, COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors,
                    COUNT(DISTINCT visitor_id) FILTER (WHERE source IN ${ORGANIC_SOURCES}) AS organic_visitors
             FROM page_visits
             WHERE ${HUMAN} AND ${R} AND (page = ANY($1) OR page LIKE '/he/%' OR page = '/he' OR page = '/he/')
             GROUP BY page`, [allPages]
        );
        var bounces = await queryAll(
            `SELECT landing AS page, COUNT(*) AS sessions, COUNT(*) FILTER (WHERE views = 1) AS bounces
             FROM (
                 SELECT session_id, (array_agg(page ORDER BY created_at ASC))[1] AS landing, COUNT(*) AS views
                 FROM page_visits
                 WHERE ${HUMAN} AND session_id IS NOT NULL AND ${R}
                 GROUP BY session_id
             ) t GROUP BY landing`
        );
        // Assisted bookings: the booking's visitor viewed the page during the range.
        // De-duped per (booking, page) first so revenue never double-counts.
        var assisted = await queryAll(
            `SELECT t.page, COUNT(*) AS bookings, COALESCE(SUM(t.rev), 0) AS revenue
             FROM (
                 SELECT DISTINCT b.id, p.page,
                        CASE WHEN b.${REVENUE_FILTER} THEN b.total_price ELSE 0 END AS rev
                 FROM bookings b
                 JOIN page_visits p ON p.visitor_id = b.visitor_id AND (p.page = ANY($1) OR p.page LIKE '/he/%')
                 WHERE b.visitor_id IS NOT NULL AND b.${REAL_BOOKINGS} AND ${rangeSql(rKey, 'b.created_at')}
             ) t GROUP BY t.page`, [allPages]
        );

        var statMap = {}, bounceMap = {}, bookMap = {};
        stats.forEach(function (s) { statMap[s.page] = s; });
        bounces.forEach(function (b) { bounceMap[b.page] = b; });
        assisted.forEach(function (a) { bookMap[a.page] = a; });

        function aggregate(label, pages) {
            var views = 0, visitors = 0, organic = 0, sessions = 0, bounced = 0, bookings = 0, revenue = 0;
            pages.forEach(function (p) {
                var s = statMap[p]; var b = bounceMap[p]; var k = bookMap[p];
                if (s) { views += int(s.views); visitors += int(s.visitors); organic += int(s.organic_visitors); }
                if (b) { sessions += int(b.sessions); bounced += int(b.bounces); }
                if (k) { bookings += int(k.bookings); revenue += num(k.revenue); }
            });
            return {
                label: label, pages: pages, views: views, visitors: visitors,
                organicVisitors: organic, landingSessions: sessions,
                bounceRate: pct(bounced, sessions),
                assistedBookings: bookings, revenue: revenue,
                conversionRate: pct(bookings, visitors)
            };
        }

        var rows = LOCATION_PAGES.map(function (g) { return aggregate(g.label, g.pages); });
        // Hebrew hub — every /he/ page rolled into one row
        var hePages = Object.keys(statMap).filter(function (p) { return p.indexOf('/he') === 0; });
        if (hePages.length > 0) rows.push(aggregate('Hebrew site (/he/)', hePages));
        rows.sort(function (a, b) { return b.visitors - a.visitors; });
        return { range: rKey, rows: rows };
    });
});

// ========================================
// SEO — TECHNICAL AUDIT
// ========================================
router.get('/seo/audit', function (req, res) {
    try {
        res.json(seoAudit.getReport(req.query.force === '1'));
    } catch (err) {
        console.error('[Analytics] seo/audit:', err);
        res.status(500).json({ error: 'Failed to run SEO audit' });
    }
});

// ========================================
// SEO — AI RECOMMENDATIONS & BUSINESS INSIGHTS
// ========================================
router.get('/seo/recommendations', function (req, res) {
    cached(req, res, 120000, async function () {
        var rKey = rangeKey(req);
        var R = rangeSql(rKey, 'created_at');
        var recs = [];
        function rec(priority, area, title, detail, impact) {
            recs.push({ priority: priority, area: area, title: title, detail: detail, impact: impact });
        }

        // --- Site-wide numbers for baselines
        var base = await queryOne(
            `SELECT COUNT(DISTINCT session_id) AS sessions, COUNT(DISTINCT visitor_id) AS visitors
             FROM page_visits WHERE ${HUMAN} AND ${R}`
        );
        var baseBk = await queryOne(
            `SELECT COUNT(*) FILTER (WHERE ${REAL_BOOKINGS}) AS bookings FROM bookings WHERE ${R}`
        );
        var sessions = int(base.sessions), bookings = int(baseBk.bookings);
        var siteConv = sessions > 0 ? bookings / sessions : 0;

        // --- 1. Technical SEO issues (from the audit)
        try {
            var audit = seoAudit.getReport(false);
            if (audit.summary.high > 0) {
                var worst = audit.pages.filter(function (p) {
                    return p.issues.some(function (i) { return i.severity === 'high'; });
                }).slice(0, 5).map(function (p) { return p.page; });
                rec('high', 'technical-seo',
                    'Fix ' + audit.summary.high + ' high-severity technical SEO issue(s)',
                    'Pages with critical issues: ' + worst.join(', ') + '. See the Technical SEO Audit below for details.',
                    'Directly improves how Google crawls, indexes and ranks these pages.');
            }
            audit.siteIssues.forEach(function (i) {
                if (i.severity === 'high') rec('high', 'technical-seo', 'Site-level issue: ' + i.type, i.detail, 'Site-wide indexing risk.');
            });
        } catch (e) { /* audit optional */ }

        // --- 2. High-bounce landing pages with real traffic
        var landings = await queryAll(
            `SELECT landing AS page, COUNT(*) AS sessions, COUNT(*) FILTER (WHERE views = 1) AS bounces
             FROM (
                 SELECT session_id, (array_agg(page ORDER BY created_at ASC))[1] AS landing, COUNT(*) AS views
                 FROM page_visits WHERE ${HUMAN} AND session_id IS NOT NULL AND ${R}
                 GROUP BY session_id
             ) t GROUP BY landing HAVING COUNT(*) >= 20 ORDER BY sessions DESC LIMIT 30`
        );
        landings.forEach(function (l) {
            var br = pct(int(l.bounces), int(l.sessions));
            if (br >= 65) {
                rec('high', 'conversion',
                    'High bounce on ' + l.page + ' (' + br + '%)',
                    int(l.sessions) + ' sessions landed here and ' + br + '% left without a second page. Strengthen the above-the-fold offer, add clear CTAs to the vehicles list, and check mobile load speed.',
                    'Recovering even 10% of these bounces adds ~' + Math.round(int(l.sessions) * 0.1 * siteConv * 10) / 10 + ' bookings per period.');
            }
        });

        // --- 3. Traffic pages with zero attributed bookings
        var pageTraffic = await queryAll(
            `SELECT page, COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors
             FROM page_visits WHERE ${HUMAN} AND ${R}
             GROUP BY page HAVING COUNT(*) >= 50 ORDER BY views DESC LIMIT 20`
        );
        var convertedPages = await queryAll(
            `SELECT DISTINCT p.page
             FROM bookings b JOIN page_visits p ON p.visitor_id = b.visitor_id
             WHERE b.visitor_id IS NOT NULL AND b.${REAL_BOOKINGS} AND ${rangeSql(rKey, 'b.created_at')}`
        );
        var convertedSet = new Set(convertedPages.map(function (r) { return r.page; }));
        pageTraffic.forEach(function (p) {
            if (!convertedSet.has(p.page) && p.page !== '/payment.html' && p.page !== '/booking.html') {
                rec('medium', 'conversion',
                    p.page + ' receives traffic but no bookings',
                    int(p.views) + ' views / ' + int(p.visitors) + ' visitors in this period, yet no visitor who saw this page went on to book. Add stronger internal links to the vehicle list and a booking CTA.',
                    'Turning this page into a converter monetizes existing traffic — no new marketing spend needed.');
            }
        });

        // --- 4. Country conversion outliers
        var countryConv = await queryAll(
            `SELECT pv.country_code AS key, COUNT(DISTINCT s.session_id) AS sessions
             FROM (SELECT DISTINCT session_id, visitor_id FROM page_visits
                   WHERE ${HUMAN} AND session_id IS NOT NULL AND ${R}) s
             JOIN LATERAL (
                 SELECT country_code FROM page_visits p
                 WHERE p.visitor_id = s.visitor_id AND p.country_code IS NOT NULL
                 ORDER BY p.created_at DESC LIMIT 1
             ) pv ON TRUE
             GROUP BY 1 HAVING COUNT(DISTINCT s.session_id) >= 15`
        );
        var countryBk = await attributedBookings('country', rKey);
        countryConv.forEach(function (c) {
            var b = countryBk[c.key] || { bookings: 0 };
            var conv = int(c.sessions) > 0 ? b.bookings / int(c.sessions) : 0;
            var name = countryName(c.key) || c.key;
            if (siteConv > 0 && conv >= siteConv * 2 && b.bookings >= 2) {
                rec('high', 'marketing',
                    'Visitors from ' + name + ' convert ' + Math.round(conv / siteConv * 10) / 10 + '× above average',
                    b.bookings + ' bookings from ' + int(c.sessions) + ' sessions. Double down: targeted content, ads and language coverage for this market.',
                    'Scaling this traffic source has the best revenue-per-visitor on the site.');
            } else if (conv === 0 && int(c.sessions) >= 30) {
                rec('medium', 'marketing',
                    'Traffic from ' + name + ' isn\'t converting',
                    int(c.sessions) + ' sessions, zero bookings. Check pricing display (currency), language support and trust signals for this market.',
                    'An untapped market that already finds the site.');
            }
        });

        // --- 5. Mobile vs desktop funnel
        var deviceFunnel = await queryAll(
            `SELECT device, COUNT(*) AS sessions,
                    COUNT(*) FILTER (WHERE saw_reservation) AS reservation,
                    COUNT(*) FILTER (WHERE saw_payment) AS payment
             FROM (
                 SELECT session_id, MAX(device) AS device,
                        BOOL_OR(page = '/reservation.html') AS saw_reservation,
                        BOOL_OR(page = '/payment.html') AS saw_payment
                 FROM page_visits
                 WHERE ${HUMAN} AND session_id IS NOT NULL AND ${R} AND device IN ('mobile','desktop')
                 GROUP BY session_id
             ) t GROUP BY device`
        );
        var mob = null, desk = null;
        deviceFunnel.forEach(function (d) { if (d.device === 'mobile') mob = d; if (d.device === 'desktop') desk = d; });
        if (mob && desk && int(mob.reservation) >= 5 && int(desk.reservation) >= 5) {
            var mobPass = int(mob.payment) / int(mob.reservation);
            var deskPass = int(desk.payment) / int(desk.reservation);
            if (deskPass > 0 && mobPass < deskPass * 0.6) {
                rec('high', 'conversion',
                    'Mobile users abandon the booking form far more than desktop',
                    'Only ' + Math.round(mobPass * 100) + '% of mobile sessions that open the booking form reach payment, vs ' + Math.round(deskPass * 100) + '% on desktop. Audit the reservation form on small screens (field count, OTP flow, payment buttons).',
                    'Mobile is usually >60% of travel traffic — fixing this directly lifts total bookings.');
            }
        }

        // --- 6. Source quality
        var sources = await queryAll(
            `SELECT COALESCE(source,'direct') AS key, COUNT(DISTINCT session_id) AS sessions
             FROM page_visits WHERE ${HUMAN} AND ${R}
             GROUP BY 1 HAVING COUNT(DISTINCT session_id) >= 10 ORDER BY sessions DESC`
        );
        var sourceBk = await attributedBookings('source', rKey);
        var bestSource = null, bestConv = 0;
        sources.forEach(function (s) {
            var b = sourceBk[s.key] || { bookings: 0 };
            var conv = int(s.sessions) > 0 ? b.bookings / int(s.sessions) : 0;
            if (conv > bestConv && b.bookings >= 2) { bestConv = conv; bestSource = s.key; }
        });
        if (bestSource) {
            rec('medium', 'marketing',
                'Best-converting traffic source: ' + bestSource,
                'Converts at ' + Math.round(bestConv * 1000) / 10 + '% per session — the strongest channel this period. Consider shifting budget/effort here.',
                'Reallocating spend to the proven channel raises overall ROI.');
        }

        // --- 7. Language / content opportunities
        var langs = await queryAll(
            `SELECT LOWER(SPLIT_PART(language,'-',1)) AS lang, COUNT(DISTINCT visitor_id) AS visitors
             FROM page_visits WHERE ${HUMAN} AND ${R} AND language IS NOT NULL
             GROUP BY 1 ORDER BY visitors DESC LIMIT 10`
        );
        var heVisitors = 0, ruVisitors = 0;
        langs.forEach(function (l) { if (l.lang === 'he') heVisitors = int(l.visitors); if (l.lang === 'ru') ruVisitors = int(l.visitors); });
        if (heVisitors >= 10) {
            rec('medium', 'content',
                heVisitors + ' Hebrew-language visitors this period',
                'Make sure they land on the /he/ pages (internal links, hreflang, GBP posts in Hebrew). Competitors have no Hebrew coverage — this is the wedge.',
                'Hebrew visitors convert best when served native-language pages.');
        }
        if (ruVisitors >= 10) {
            rec('low', 'content',
                ruVisitors + ' Russian-language visitors this period',
                'RU-language landing pages / prerender already exist — ensure new landing pages get RU variants too.',
                'Keeps the second-largest language segment engaged.');
        }

        // --- 8. Organic share reality check (off-page constraint)
        var organicShare = await queryOne(
            `SELECT COUNT(DISTINCT session_id) FILTER (WHERE source IN ${ORGANIC_SOURCES}) AS organic,
                    COUNT(DISTINCT session_id) AS total
             FROM page_visits WHERE ${HUMAN} AND ${R}`
        );
        var oShare = pct(int(organicShare.organic), int(organicShare.total));
        if (int(organicShare.total) >= 50 && oShare < 25) {
            rec('high', 'seo',
                'Organic search is only ' + oShare + '% of traffic',
                'Rankings are constrained off-page (domain age/authority), not by the code. Keep pushing Google Business Profile activity, real guest reviews and backlinks — those move the needle most right now.',
                'Every extra organic session is free, compounding traffic.');
        }

        var order = { high: 0, medium: 1, low: 2 };
        recs.sort(function (a, b) { return order[a.priority] - order[b.priority]; });
        return { range: rKey, generatedAt: new Date().toISOString(), recommendations: recs.slice(0, 25) };
    });
});

// ========================================
// SEO — GOOGLE SEARCH CONSOLE STATUS
// ========================================
router.get('/seo/gsc', function (req, res) {
    // Keyword-level data (queries, impressions, clicks, CTR, positions) can only
    // come from Google's Search Console API — it is not observable from our server.
    res.json({
        connected: false,
        message: 'Google Search Console API is not connected. Keyword analytics (queries, impressions, clicks, CTR, average position) live in Search Console.',
        dashboardUrl: 'https://search.google.com/search-console?resource_id=' + encodeURIComponent('sc-domain:eliteauto.rent'),
        howToConnect: [
            'Open Google Cloud Console and create a service account with the "Search Console API" enabled.',
            'Add the service account email as a user on the eliteauto.rent Search Console property.',
            'Save the service-account JSON key on the server and set GSC_KEY_FILE in .env.',
            'Ask your developer (or Claude) to wire the API — this panel will then populate automatically.'
        ]
    });
});

module.exports = router;
