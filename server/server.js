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
const { initTwilio } = require('./services/sms');
const { initRedis } = require('./services/otp');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize external services
initTwilio();
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

// Security headers
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Compression
app.use(compression());

// CORS — lock to real domain in production
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];
app.use(cors({
    origin: function (origin, cb) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) return cb(null, true);
        if (process.env.NODE_ENV === 'production') return cb(new Error('Not allowed by CORS'));
        cb(null, true); // allow all only in development
    },
    credentials: true
}));

// Body parsing with size limits
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Block access to sensitive files
app.use((req, res, next) => {
    const blocked = ['.env', '.git', 'package.json', 'package-lock.json', 'node_modules',
        'AUDIT-REPORT.md', 'SECURITY-AUDIT.md', 'README.md', '.gitignore'];
    const reqPath = req.path.toLowerCase();
    if (blocked.some(b => reqPath === '/' + b || reqPath.startsWith('/' + b + '/'))) {
        return res.status(404).send('Not found');
    }
    if (reqPath.startsWith('/server/') || reqPath.startsWith('/server\\')) {
        return res.status(404).send('Not found');
    }
    next();
});

// Serve static files with caching
app.use(express.static(path.join(__dirname, '..'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
    etag: true
}));

// Serve uploaded images with caching
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
    maxAge: '7d',
    etag: true
}));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);
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
    console.error('Unhandled error:', err.stack || err);
    res.status(500).json({ error: 'Internal server error' });
});

// Initialize DB then start server
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
        console.log(`Static files served from: ${path.join(__dirname, '..')}`);
    });
}).catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});
