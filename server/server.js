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

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many attempts, please try again later' },
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
        cb(null, true); // allow all in dev; in production set strict list
    },
    credentials: true
}));

// Body parsing with size limits
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

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

// API Routes
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);
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
