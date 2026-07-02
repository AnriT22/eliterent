const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { initDB } = require('./db');
const authRoutes = require('./routes/auth');
const vehicleRoutes = require('./routes/vehicles');
const uploadRoutes = require('./routes/upload');
const adminRoutes = require('./routes/admin');
const favoritesRoutes = require('./routes/favorites');
const availabilityRoutes = require('./routes/availability');
const bookingsRoutes = require('./routes/bookings');
const reviewsRoutes = require('./routes/reviews');
const paymentsRoutes = require('./routes/payments');
const financialsRoutes = require('./routes/financials');
const contactRoutes = require('./routes/contact');
const otpRoutes = require('./routes/otp');
const driversRoutes = require('./routes/drivers');
const adsRoutes = require('./routes/ads');
const driverReviewsRoutes = require('./routes/driver-reviews');
const partnerRoutes = require('./routes/partner');
const { initSMS } = require('./services/sms');
const { initRedis } = require('./services/otp');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// Initialize external services
initSMS();
initRedis();

// Rate limiting
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false
});

const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { error: 'Too many messages. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

const passwordResetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3,
    message: { error: 'Too many password reset requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

const generalApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { error: 'Too many requests. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false
});

const otpLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { error: 'Too many OTP requests. Please wait.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Permissions-Policy: disable unused browser features
app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self), usb=(), magnetometer=(), gyroscope=(), accelerometer=()');
    next();
});

// Request ID for error tracing
const crypto = require('crypto');
app.use((req, res, next) => {
    req.requestId = crypto.randomBytes(8).toString('hex');
    res.setHeader('X-Request-Id', req.requestId);
    next();
});

// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://accounts.google.com",
                "https://www.paypal.com",
                "https://www.sandbox.paypal.com",
                "https://cdn.jsdelivr.net",
                "https://pay.google.com",
                "https://www.gstatic.com"
            ],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
            connectSrc: [
                "'self'",
                "https://www.googleapis.com",
                "https://accounts.google.com",
                "https://oauth2.googleapis.com",
                "https://www.paypal.com",
                "https://www.sandbox.paypal.com",
                "https://pay.google.com",
                "https://payments.google.com"
            ],
            frameSrc: [
                "https://accounts.google.com",
                "https://www.google.com",
                "https://www.paypal.com",
                "https://www.sandbox.paypal.com",
                "https://pay.google.com",
                "https://payments.google.com"
            ],
            fontSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'", "https://accounts.google.com"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));

// Compression
app.use(compression());

// CORS — lock to real domain in production
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];
app.use(cors({
    origin: function (origin, cb) {
        // Allow same-origin requests (no Origin header) and whitelisted origins
        if (!origin || allowedOrigins.indexOf(origin) !== -1) return cb(null, true);
        if (process.env.NODE_ENV !== 'production') return cb(null, true); // dev only
        console.warn('[CORS] Blocked origin:', origin);
        return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing with size limits
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Block access to sensitive files
app.use((req, res, next) => {
    const blocked = ['.env', '.git', 'package.json', 'package-lock.json', 'node_modules',
        'AUDIT-REPORT.md', 'SECURITY-AUDIT.md', 'README.md', '.gitignore',
        'ecosystem.config.js', '.windsurf', 'progress.txt', 'Dockerfile', 'docker-compose.yml'];
    const reqPath = req.path.toLowerCase();
    if (blocked.some(b => reqPath === '/' + b || reqPath.startsWith('/' + b + '/'))) {
        return res.status(404).send('Not found');
    }
    if (reqPath.startsWith('/server/') || reqPath.startsWith('/server\\')) {
        return res.status(404).send('Not found');
    }
    next();
});

// admin.html, partner-dashboard.html, partner-financials.html are protected
// client-side (admin.js, dashboard.js check localStorage token+role → redirect to login).
// All sensitive data/actions are protected server-side via API-level JWT auth middleware.

// ========== Visitor tracking with bot detection ==========
function isBot(req) {
    var ua = req.headers['user-agent'] || '';
    var lowerUa = ua.toLowerCase();

    // 1. Known bot/crawler strings
    if (/bot|crawl|spider|slurp|scrape|scan|fetch|libcurl|wget|curl|python-requests|httpclient| okhttp|axios|node-fetch|undici|phantomjs|headless|selenium|puppeteer|playwright|apifox|postman|insomnia|ahrefs|semrush|majestic|moz|blexbot|dotbot|rogerbot|bingpreview|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|slackbot|applebot|yandex|baidu|sogou|exabot|nutch|jakarta|guzzlehttp|java\//i.test(ua)) return true;

    // 2. Very short or empty UA (most real browsers send 80+ chars)
    if (!ua || ua.length < 30) return true;

    // 3. Missing critical headers real browsers always send
    if (!req.headers['accept-language']) return true;
    if (!req.headers['accept']) return true;

    // 4. No JS-capable indicators — real browsers send Accept: text/html, application/xhtml+xml
    var accept = req.headers['accept'] || '';
    if (!accept.includes('text/html')) return true;

    // 5. Known headless/browser automation markers
    if (lowerUa.includes('headless') || lowerUa.includes('selenium') || lowerUa.includes('webdriver')) return true;

    // 6. No referrer on non-first-page visits is suspicious but not conclusive — leave for client-side verification
    return false;
}

app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    var p = req.path;
    // Track root, .html pages — skip assets, API, uploads
    if (p !== '/' && !p.endsWith('.html')) return next();

    var bot = isBot(req);
    var ua = req.headers['user-agent'] || '';

    // Get or set visitor cookie
    var cookies = {};
    (req.headers.cookie || '').split(';').forEach(function(c) {
        var parts = c.trim().split('=');
        if (parts.length === 2) cookies[parts[0]] = parts[1];
    });
    var vid = cookies['vid'];
    if (!vid) {
        vid = crypto.randomBytes(12).toString('hex');
        res.setHeader('Set-Cookie', 'vid=' + vid + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000');
    }

    // Fire-and-forget insert (mark bot flag server-side)
    var { getPool } = require('./db');
    var pool = getPool();
    if (pool) {
        var ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        if (ip.includes(',')) ip = ip.split(',')[0].trim();
        pool.query(
            'INSERT INTO page_visits (page, ip, user_agent, referrer, visitor_id, is_bot) VALUES ($1, $2, $3, $4, $5, $6)',
            [p, ip, (ua || '').substring(0, 500), (req.headers['referer'] || '').substring(0, 500), vid, bot ? 1 : 0]
        ).catch(function() {});
    }
    next();
});

// Client-side human verification — lightweight JS ping after page load
app.post('/api/verify-human', (req, res) => {
    var cookies = {};
    (req.headers.cookie || '').split(';').forEach(function(c) {
        var parts = c.trim().split('=');
        if (parts.length === 2) cookies[parts[0]] = parts[1];
    });
    var vid = cookies['vid'];
    if (!vid) return res.json({ ok: false });

    var { getPool } = require('./db');
    var pool = getPool();
    if (pool) {
        // Mark recent visits from this visitor as verified human
        pool.query(
            "UPDATE page_visits SET is_verified = 1 WHERE visitor_id = $1 AND created_at > NOW() - INTERVAL '1 hour'",
            [vid]
        ).catch(function() {});
    }
    res.json({ ok: true });
});

// SEO: inject server-rendered content for ALL visitors (before static), with NO
// User-Agent branching — users and crawlers get identical HTML. Homepage gets the
// categories+cities browse block; /vehicles.html gets the real cars rendered into
// the grid (the page's JS rebuilds the interactive grid on load). /reviews.html is
// left as a plain static page (real reviews render client-side; S-02).
const seoPrerender = require('./seo-prerender');
app.get('/', seoPrerender.middleware);
app.get('/index.html', seoPrerender.middleware);
app.get('/vehicles.html', seoPrerender.middleware);
app.get('/vehicle.html', seoPrerender.middleware);

// SEO: dynamic sitemap — static marketing URLs + every active vehicle page,
// generated from the DB so new inventory is auto-submitted (before static so it
// wins over the sitemap.xml file, which remains a fallback if generation fails).
app.get('/sitemap.xml', async (req, res, next) => {
    try {
        const xml = await seoPrerender.renderSitemap();
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(xml);
    } catch (e) {
        console.error('[SEO] sitemap:', e.message);
        next();
    }
});

// SEO: server-render localized RU/KA pages for crawlers (before static).
// Self-guards on path and falls through to next() for everything else.
const i18nRender = require('./i18n-render');
app.use(i18nRender.middleware);

// SEO: pretty-URL aliases → 301 to the canonical landing pages.
// Gives clean, shareable URLs and consolidates link equity onto the real pages.
// Guarded: only GET + only known paths; everything else falls through.
const PRETTY_REDIRECTS = {
    '/rent-a-car/tbilisi': '/rent-car-tbilisi.html',
    '/rent-a-car/batumi': '/rent-car-batumi.html',
    '/rent-a-car/kutaisi': '/rent-car-kutaisi.html',
    '/rent-a-car/tbilisi-airport': '/tbilisi-airport-car-rental.html',
    '/car-rental/suv': '/suv-rental-georgia.html',
    '/car-rental/economy': '/economy-car-rental-georgia.html',
    '/car-rental/sedan': '/sedan-rental-georgia.html',
    '/car-rental/luxury': '/luxury-car-rental-tbilisi.html',
    '/car-rental/minivan': '/minivan-7-seater-rental-georgia.html',
    '/no-deposit': '/no-deposit-car-rental-georgia.html'
};
app.use((req, res, next) => {
    try {
        if (req.method !== 'GET') return next();
        var p = req.path.replace(/\/+$/, '') || '/';
        if (PRETTY_REDIRECTS[p]) return res.redirect(301, PRETTY_REDIRECTS[p]);
        next();
    } catch (e) { next(); }
});

// Security: never serve dev/test artifacts, internal docs, or raw data files as
// static assets. Blocks /_*.* dev files (e.g. _mock-data.js, _preview-vehicle.html),
// the /data/ dir, database files, and markdown docs (README, SECURITY-AUDIT,
// SEO-* planning notes). Returns 404 so they are neither fetchable nor indexable.
// Marketing/app pages are unaffected (none start with "_" or end in these types).
app.use((req, res, next) => {
    const p = req.path;
    if (/^\/_/.test(p) || p.startsWith('/data/') || /\.(db|sqlite|sqlite3|md)$/i.test(p)) {
        return res.status(404).sendFile(path.join(__dirname, '..', '404.html'), (err) => {
            if (err) res.status(404).end();
        });
    }
    next();
});

// Analytics: inject GA4 / Search-Console tags into the <head> of every html
// page from one place (server/head-inject.js). Runs before express.static so
// it owns html delivery for the non-prerendered pages; assets fall through.
// No-op when no IDs are configured, so it's safe until you add them.
const headInject = require('./head-inject');
if (headInject.isEnabled) {
    app.get(/.*/, (req, res, next) => {
        try {
            if (req.method !== 'GET') return next();
            var p = req.path;
            var isHtml = p === '/' || p.endsWith('.html');
            if (!isHtml) return next();
            var rel = p === '/' ? 'index.html' : p.replace(/^\/+/, '');
            var filePath = path.join(__dirname, '..', rel);
            // keep inside the site root
            if (filePath.indexOf(path.join(__dirname, '..')) !== 0) return next();
            fs.readFile(filePath, 'utf8', (err, html) => {
                if (err) return next();
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.setHeader('Cache-Control', 'no-cache');
                res.send(headInject.inject(html));
            });
        } catch (e) { next(); }
    });
}

// Serve static files with caching
app.use(express.static(path.join(__dirname, '..'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
    etag: true
}));

// Serve uploaded images with caching + security headers
app.use('/uploads', (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
}, express.static(path.join(__dirname, '..', 'uploads'), {
    maxAge: '7d',
    etag: true
}));

// Prevent caching of API responses (sensitive data)
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    next();
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Google Client ID config (public, no auth needed)
app.get('/api/config/google-client-id', (req, res) => {
    res.json({ clientId: process.env.GOOGLE_CLIENT_ID || null });
});

// Exchange rates proxy (NBG) — cached 1 hour
let ratesCache = { data: null, ts: 0 };
app.get('/api/exchange-rates', async (req, res) => {
    try {
        var now = Date.now();
        if (ratesCache.data && (now - ratesCache.ts) < 3600000) {
            return res.json(ratesCache.data);
        }
        const https = require('https');
        const url = 'https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/';
        const fetchRates = () => new Promise((resolve, reject) => {
            https.get(url, { timeout: 5000 }, (resp) => {
                let body = '';
                resp.on('data', (c) => body += c);
                resp.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
            }).on('error', reject);
        });
        const nbgData = await fetchRates();
        if (nbgData && nbgData[0] && nbgData[0].currencies) {
            var rates = {};
            nbgData[0].currencies.forEach(function(c) {
                rates[c.code] = c.rate / c.quantity;
            });
            rates['GEL'] = 1;
            ratesCache = { data: { rates: rates, date: nbgData[0].date }, ts: now };
            return res.json(ratesCache.data);
        }
        res.status(502).json({ error: 'Invalid NBG response' });
    } catch (e) {
        console.error('[Exchange rates] Error:', e.message);
        if (ratesCache.data) return res.json(ratesCache.data);
        res.status(502).json({ error: 'Failed to fetch rates' });
    }
});

// API Routes
app.use('/api/check-availability', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: 'Too many requests. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false
}));
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);
app.use('/api/auth/google', authLimiter);
app.use('/api/forgot-password', passwordResetLimiter);
app.use('/api/contact', contactLimiter);
app.use('/api', generalApiLimiter);
app.use('/api', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/financials', financialsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/otp', otpLimiter);
app.use('/api/otp', otpRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/driver-reviews', driverReviewsRoutes);
app.use('/api/partner', partnerRoutes);

// Fallback: serve index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// 404 handler — unknown API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

// 404 handler — unknown pages
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '..', '404.html'), (err) => {
        if (err) res.status(404).send('<h1>404 — Page Not Found</h1><p><a href="/">Go Home</a></p>');
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('[' + (req.requestId || 'no-id') + '] Unhandled error:', err.stack || err);
    res.status(500).json({ error: 'Internal server error', requestId: req.requestId });
});

// Initialize DB then start server
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
        console.log(`Static files served from: ${path.join(__dirname, '..')}`);
    });

    // Background task: auto-expire stale bookings every 1 minute
    const { getPool } = require('./db');
    setInterval(async () => {
        try {
            const pool = getPool();
            if (!pool) return;

            // Cancel pending_verification bookings older than 10 minutes (guest never completed OTP)
            const pvResult = await pool.query(
                "UPDATE bookings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE status = 'pending_verification' AND created_at < NOW() - INTERVAL '10 minutes'"
            );
            if (pvResult.rowCount > 0) {
                console.log('[Cleanup] Auto-cancelled ' + pvResult.rowCount + ' expired pending_verification bookings');
            }

            // Cancel unpaid pending bookings whose payment window has expired (6 min timer)
            // Unblock dates for these bookings
            const expiredPayment = await pool.query(
                "SELECT id, vehicle_id, pickup_date, dropoff_date FROM bookings WHERE status = 'pending' AND payment_expires_at IS NOT NULL AND payment_expires_at < NOW() AND (payment_status IS NULL OR payment_status != 'paid')"
            );
            if (expiredPayment.rows.length > 0) {
                for (var j = 0; j < expiredPayment.rows.length; j++) {
                    var ep = expiredPayment.rows[j];
                    await pool.query("UPDATE bookings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [ep.id]);
                    await pool.query(
                        "DELETE FROM vehicle_availability WHERE vehicle_id = $1 AND date >= $2 AND date <= $3 AND status = 'booked'",
                        [ep.vehicle_id, ep.pickup_date, ep.dropoff_date]
                    );
                }
                console.log('[Cleanup] Auto-cancelled ' + expiredPayment.rows.length + ' unpaid pending bookings (payment timer expired)');
            }

            // Cancel pending bookings older than 72 hours with no payment_expires_at (legacy, partner never responded)
            const staleBookings = await pool.query(
                "SELECT id, vehicle_id, pickup_date, dropoff_date FROM bookings WHERE status = 'pending' AND payment_expires_at IS NULL AND created_at < NOW() - INTERVAL '72 hours'"
            );
            if (staleBookings.rows.length > 0) {
                for (var i = 0; i < staleBookings.rows.length; i++) {
                    var bk = staleBookings.rows[i];
                    await pool.query("UPDATE bookings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [bk.id]);
                    await pool.query(
                        "DELETE FROM vehicle_availability WHERE vehicle_id = $1 AND date >= $2 AND date <= $3 AND status = 'booked'",
                        [bk.vehicle_id, bk.pickup_date, bk.dropoff_date]
                    );
                }
                console.log('[Cleanup] Auto-cancelled ' + staleBookings.rows.length + ' stale pending bookings (72h+ no response)');
            }
        } catch (e) {
            console.error('[Cleanup] Booking expiry error:', e.message);
        }
    }, 60 * 1000); // every 1 minute

    // Cleanup old page visits (older than 90 days) — runs every hour
    setInterval(async () => {
        try {
            const pool = getPool();
            if (!pool) return;
            const result = await pool.query("DELETE FROM page_visits WHERE created_at < NOW() - INTERVAL '90 days'");
            if (result.rowCount > 0) {
                console.log('[Cleanup] Removed ' + result.rowCount + ' old page visit records (90d+)');
            }
        } catch (e) { /* ignore */ }
    }, 3600 * 1000);

}).catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});
