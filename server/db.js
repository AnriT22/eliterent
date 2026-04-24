const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

let pool = null;

async function initDB() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('FATAL: DATABASE_URL environment variable is not set.');
        process.exit(1);
    }

    pool = new Pool({
        connectionString,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
    });

    // Test connection
    const client = await pool.connect();
    console.log('Connected to PostgreSQL database');
    client.release();

    // Create tables
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            full_name TEXT NOT NULL,
            phone TEXT,
            role TEXT NOT NULL CHECK(role IN ('guest', 'partner', 'admin')),
            google_id TEXT,
            avatar_url TEXT,
            is_approved INTEGER DEFAULT 1,
            is_verified INTEGER DEFAULT 0,
            phone_verified INTEGER DEFAULT 0,
            email_verified INTEGER DEFAULT 0,
            admin_notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Add verification and Google columns if they don't exist (for existing databases)
    try {
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT`);
        await pool.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`);
    } catch (e) { /* columns may already exist */ }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS partner_profiles (
            id SERIAL PRIMARY KEY,
            user_id INTEGER UNIQUE NOT NULL,
            company_name TEXT,
            description TEXT,
            location TEXT,
            whatsapp TEXT,
            telegram TEXT,
            categories TEXT,
            engines TEXT,
            gearboxes TEXT,
            drive_types TEXT,
            interior_types TEXT,
            steering_sides TEXT,
            payment_methods TEXT,
            is_verified INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS vehicles (
            id SERIAL PRIMARY KEY,
            partner_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            engine TEXT NOT NULL,
            gearbox TEXT NOT NULL,
            drive_type TEXT NOT NULL,
            interior_type TEXT DEFAULT 'fabric',
            steering_side TEXT DEFAULT 'left',
            payment_method TEXT DEFAULT 'cash',
            price_per_day REAL NOT NULL,
            year INTEGER NOT NULL,
            seats INTEGER DEFAULT 5,
            doors INTEGER DEFAULT 4,
            fuel_consumption TEXT,
            image_url TEXT,
            gallery TEXT,
            description TEXT,
            features TEXT,
            insurance_included INTEGER DEFAULT 0,
            free_cancellation INTEGER DEFAULT 1,
            deposit_amount REAL DEFAULT 0,
            pickup_locations TEXT,
            extra_services TEXT,
            service_options TEXT,
            tech_passport_front TEXT,
            tech_passport_back TEXT,
            status TEXT DEFAULT 'pending' CHECK(status IN ('active', 'inactive', 'pending', 'delete_requested')),
            brand TEXT,
            model TEXT,
            color TEXT,
            min_age INTEGER DEFAULT 21,
            location_city TEXT,
            fuel_policy TEXT DEFAULT 'full_to_full',
            luggage TEXT,
            region TEXT,
            engine_cc INTEGER,
            horsepower INTEGER,
            mileage_limit_enabled INTEGER DEFAULT 0,
            mileage_km INTEGER,
            multimedia TEXT,
            price_tiers TEXT,
            extras TEXT,
            insurance TEXT,
            pickup_fees_enabled INTEGER DEFAULT 0,
            pickup_fees TEXT,
            visible_in_search INTEGER DEFAULT 1,
            block_after_payment INTEGER DEFAULT 0,
            custom_pricing_enabled INTEGER DEFAULT 0,
            custom_pricing_ranges TEXT,
            registration_number TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS bookings (
            id SERIAL PRIMARY KEY,
            guest_id INTEGER NOT NULL,
            vehicle_id INTEGER NOT NULL,
            partner_id INTEGER NOT NULL,
            pickup_date TEXT NOT NULL,
            dropoff_date TEXT NOT NULL,
            pickup_time TEXT DEFAULT '10:00',
            dropoff_time TEXT DEFAULT '10:00',
            rental_days INTEGER DEFAULT 1,
            pickup_location TEXT,
            dropoff_location TEXT,
            extras_json TEXT,
            extras_total REAL DEFAULT 0,
            location_fee REAL DEFAULT 0,
            service_fee REAL DEFAULT 0,
            total_price REAL NOT NULL,
            deposit_paid REAL DEFAULT 0,
            status TEXT DEFAULT 'pending_verification' CHECK(status IN ('pending_verification', 'pending', 'accepted', 'rejected', 'completed', 'cancelled', 'cancel_requested')),
            guest_notes TEXT,
            partner_notes TEXT,
            payment_status TEXT DEFAULT 'unpaid',
            paypal_order_id TEXT,
            paypal_capture_id TEXT,
            payment_date TIMESTAMP,
            promo_code TEXT,
            promo_discount REAL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (guest_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
            FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS favorites (
            id SERIAL PRIMARY KEY,
            guest_id INTEGER NOT NULL,
            vehicle_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(guest_id, vehicle_id),
            FOREIGN KEY (guest_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS reviews (
            id SERIAL PRIMARY KEY,
            guest_id INTEGER NOT NULL,
            vehicle_id INTEGER,
            booking_id INTEGER,
            rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
            title TEXT,
            body TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (guest_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
            FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS vehicle_availability (
            id SERIAL PRIMARY KEY,
            vehicle_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            status TEXT DEFAULT 'available' CHECK(status IN ('available', 'blocked', 'booked')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(vehicle_id, date),
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS password_resets (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS otp_codes (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            phone TEXT,
            email TEXT,
            code_hash TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('registration', 'reservation', 'login', 'phone_verify', 'email_verify')),
            reference_id TEXT,
            attempts INTEGER DEFAULT 0,
            max_attempts INTEGER DEFAULT 5,
            expires_at TIMESTAMP NOT NULL,
            verified INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Migrate reference_id from INTEGER to TEXT (for Verify API SIDs)
    try {
        await pool.query('ALTER TABLE otp_codes ALTER COLUMN reference_id TYPE TEXT USING reference_id::TEXT');
    } catch (e) { /* column already TEXT or doesn't exist */ }

    // Migrate bookings status CHECK constraint to include 'pending_verification' and 'cancel_requested'
    try {
        await pool.query('ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check');
        await pool.query(`ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK(status IN ('pending_verification', 'pending', 'accepted', 'rejected', 'completed', 'cancelled', 'cancel_requested'))`);
        console.log('bookings_status_check constraint updated');
    } catch (e) { console.warn('bookings_status_check migration skipped:', e.message); }

    // Migrate money columns from REAL (float) to NUMERIC(10,2) for accurate financial math
    try {
        var moneyMigrations = [
            'ALTER TABLE vehicles ALTER COLUMN price_per_day TYPE NUMERIC(10,2) USING price_per_day::NUMERIC(10,2)',
            'ALTER TABLE vehicles ALTER COLUMN deposit_amount TYPE NUMERIC(10,2) USING deposit_amount::NUMERIC(10,2)',
            'ALTER TABLE bookings ALTER COLUMN extras_total TYPE NUMERIC(10,2) USING extras_total::NUMERIC(10,2)',
            'ALTER TABLE bookings ALTER COLUMN location_fee TYPE NUMERIC(10,2) USING location_fee::NUMERIC(10,2)',
            'ALTER TABLE bookings ALTER COLUMN service_fee TYPE NUMERIC(10,2) USING service_fee::NUMERIC(10,2)',
            'ALTER TABLE bookings ALTER COLUMN total_price TYPE NUMERIC(10,2) USING total_price::NUMERIC(10,2)',
            'ALTER TABLE bookings ALTER COLUMN deposit_paid TYPE NUMERIC(10,2) USING deposit_paid::NUMERIC(10,2)',
            'ALTER TABLE bookings ALTER COLUMN promo_discount TYPE NUMERIC(10,2) USING promo_discount::NUMERIC(10,2)',
            'ALTER TABLE promo_codes ALTER COLUMN discount_value TYPE NUMERIC(10,2) USING discount_value::NUMERIC(10,2)',
            'ALTER TABLE promo_codes ALTER COLUMN min_order TYPE NUMERIC(10,2) USING min_order::NUMERIC(10,2)'
        ];
        for (var i = 0; i < moneyMigrations.length; i++) {
            await pool.query(moneyMigrations[i]);
        }
        console.log('Money columns migrated to NUMERIC(10,2)');
    } catch (e) { /* columns may already be NUMERIC or table not yet created */ }

    // Create indexes for OTP lookups
    try {
        await pool.query('CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_otp_user ON otp_codes(user_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_otp_type ON otp_codes(type)');
    } catch (e) { /* indexes may already exist */ }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS promo_codes (
            id SERIAL PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            discount_type TEXT NOT NULL CHECK(discount_type IN ('percent', 'fixed')),
            discount_value REAL NOT NULL,
            min_order REAL DEFAULT 0,
            max_uses INTEGER DEFAULT 0,
            used_count INTEGER DEFAULT 0,
            valid_from TIMESTAMP,
            valid_until TIMESTAMP,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create indexes
    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
        'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
        'CREATE INDEX IF NOT EXISTS idx_vehicles_partner ON vehicles(partner_id)',
        'CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status)',
        'CREATE INDEX IF NOT EXISTS idx_vehicles_category ON vehicles(category)',
        'CREATE INDEX IF NOT EXISTS idx_bookings_guest ON bookings(guest_id)',
        'CREATE INDEX IF NOT EXISTS idx_bookings_vehicle ON bookings(vehicle_id)',
        'CREATE INDEX IF NOT EXISTS idx_bookings_partner ON bookings(partner_id)',
        'CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)',
        'CREATE INDEX IF NOT EXISTS idx_favorites_guest ON favorites(guest_id)',
        'CREATE INDEX IF NOT EXISTS idx_favorites_vehicle ON favorites(vehicle_id)',
        'CREATE INDEX IF NOT EXISTS idx_availability_vehicle ON vehicle_availability(vehicle_id)',
        'CREATE INDEX IF NOT EXISTS idx_availability_date ON vehicle_availability(date)'
    ];
    for (const sql of indexes) {
        await pool.query(sql);
    }

    // Seed default admin account with a secure random password
    const adminCheck = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (adminCheck.rows.length === 0) {
        const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || crypto.randomBytes(16).toString('hex');
        const hash = bcrypt.hashSync(adminPassword, 12);
        await pool.query(
            "INSERT INTO users (email, password_hash, full_name, role, is_approved) VALUES ($1, $2, $3, 'admin', 1)",
            ['admin@royalcar.rent', hash, 'Admin']
        );
        console.log('=======================================================');
        console.log('DEFAULT ADMIN CREATED');
        console.log('Email:    admin@royalcar.rent');
        console.log('Password: ' + adminPassword);
        console.log('CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN!');
        console.log('=======================================================');
    }

    // Cleanup expired OTP codes and password resets
    try {
        const otpClean = await pool.query("DELETE FROM otp_codes WHERE expires_at < NOW() - INTERVAL '1 day'");
        const pwClean = await pool.query("DELETE FROM password_resets WHERE expires_at < NOW() - INTERVAL '1 day'");
        if (otpClean.rowCount > 0 || pwClean.rowCount > 0) {
            console.log('Cleanup: removed ' + otpClean.rowCount + ' expired OTPs, ' + pwClean.rowCount + ' expired password resets');
        }
    } catch (e) { /* table may not exist yet on first run */ }

    console.log('PostgreSQL database initialized');
    return pool;
}

function getPool() {
    return pool;
}

// No-op for backward compatibility — PostgreSQL auto-persists
function saveDB() {}

module.exports = { initDB, getPool, saveDB };
