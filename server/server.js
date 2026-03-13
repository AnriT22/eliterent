const express = require('express');
const path = require('path');
const cors = require('cors');
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

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from project root
app.use(express.static(path.join(__dirname, '..')));

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

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
