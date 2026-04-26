const express = require('express');
const path = require('path');
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
                "https://cdn.jsdelivr.net"
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
                "https://www.sandbox.paypal.com"
            ],
            frameSrc: [
                "https://accounts.google.com",
                "https://www.google.com",
                "https://www.paypal.com",
                "https://www.sandbox.paypal.com"
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
                        "DELETE FROM vehicle_availability WHERE vehicle_id = $1 AND date >= $2 AND date < $3 AND status = 'booked'",
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
                        "DELETE FROM vehicle_availability WHERE vehicle_id = $1 AND date >= $2 AND date < $3 AND status = 'booked'",
                        [bk.vehicle_id, bk.pickup_date, bk.dropoff_date]
                    );
                }
                console.log('[Cleanup] Auto-cancelled ' + staleBookings.rows.length + ' stale pending bookings (72h+ no response)');
            }
        } catch (e) {
            console.error('[Cleanup] Booking expiry error:', e.message);
        }
    }, 60 * 1000); // every 1 minute

}).catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});
