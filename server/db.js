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
            signup_method TEXT DEFAULT 'invite',
            signup_paid INTEGER DEFAULT 0,
            signup_paypal_order_id TEXT,
            signup_paypal_capture_id TEXT,
            invite_code_used TEXT,
            referral_code TEXT UNIQUE,
            referred_by_user_id INTEGER REFERENCES users(id),
            referral_balance REAL DEFAULT 0,
            referral_payout_method TEXT,
            referral_payout_details TEXT,
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
            country TEXT DEFAULT 'georgia',
            rent_with_driver_only INTEGER DEFAULT 0,
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
            priority INTEGER DEFAULT 0,
            is_vip INTEGER DEFAULT 0,
            vip_until TIMESTAMP,
            homepage_vip_position INTEGER,
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
            payment_expires_at TIMESTAMP,
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

    // Hour-level vehicle blocks — partner blocks a specific date+time range. A buffer
    // (default 2h) is added after end_ts automatically when computing customer-facing
    // availability, giving the partner time to receive/inspect/clean the vehicle.
    // Times are stored as naive local 'YYYY-MM-DD HH:MM' strings (Georgia local time).
    await pool.query(`
        CREATE TABLE IF NOT EXISTS vehicle_time_blocks (
            id SERIAL PRIMARY KEY,
            vehicle_id INTEGER NOT NULL,
            start_ts TEXT NOT NULL,
            end_ts TEXT NOT NULL,
            buffer_minutes INTEGER DEFAULT 120,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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

    // Add country column to vehicles for multi-country support (existing DBs)
    try {
        await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'georgia'`);
    } catch (e) { /* column may already exist or table not yet created */ }

    // Add rent_with_driver_only flag to vehicles (existing DBs)
    try {
        await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS rent_with_driver_only INTEGER DEFAULT 0`);
    } catch (e) { /* column may already exist or table not yet created */ }

    // Add payment_expires_at to bookings for the 8-minute payment countdown timer (existing DBs)
    try {
        await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMP`);
        // One-time flag so the post-rental "leave a Google review" request is sent once.
        await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS review_request_sent INTEGER DEFAULT 0`);
    } catch (e) { /* column may already exist or table not yet created */ }

    // Add priority column to vehicles so admin can pin/order vehicles on the page (existing DBs)
    try {
        await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0`);
    } catch (e) { /* column may already exist or table not yet created */ }

    // Add pin_page / pin_position so admin can place a vehicle at an exact slot
    // (page + position) in the public vehicles.html grid. 0 = not pinned.
    try {
        await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS pin_page INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS pin_position INTEGER DEFAULT 0`);
    } catch (e) { /* column may already exist or table not yet created */ }

    // Add is_vip flag so admin can highlight a vehicle card with a green VIP glow.
    try {
        await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS is_vip INTEGER DEFAULT 0`);
    } catch (e) { /* column may already exist or table not yet created */ }

    // Add vip_until so partner-paid VIP auto-expires after 30 days.
    try {
        await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vip_until TIMESTAMP DEFAULT NULL`);
    } catch (e) { /* column may already exist or table not yet created */ }

    // Add homepage_vip_position so admin can pick up to 3 VIP cars to show
    // in the second block of the homepage (positions 1, 2, 3). NULL = not featured.
    try {
        await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS homepage_vip_position INTEGER DEFAULT NULL`);
    } catch (e) { /* column may already exist or table not yet created */ }

    // Add clicks column to ad_cards for tracking ad engagement (existing DBs)
    try {
        await pool.query(`ALTER TABLE ad_cards ADD COLUMN IF NOT EXISTS clicks INTEGER DEFAULT 0`);
    } catch (e) { /* column may already exist or table not yet created */ }

    // Add page column to ad_cards — which results page a vehicles-placement ad shows on (existing DBs)
    try {
        await pool.query(`ALTER TABLE ad_cards ADD COLUMN IF NOT EXISTS page INTEGER DEFAULT 1`);
    } catch (e) { /* column may already exist or table not yet created */ }

    // Per-placement slot config (existing DBs): a JSON map letting one ad use a
    // different Position on each page, e.g. {"cars":3,"drivers":2,"vehicles":6,"vehicles_page":1,"blog":1,"checkout":1}.
    // Falls back to the generic position/page columns when a page has no entry.
    try {
        await pool.query(`ALTER TABLE ad_cards ADD COLUMN IF NOT EXISTS placement_positions TEXT`);
    } catch (e) { /* column may already exist or table not yet created */ }

    // Per-language ad card text (existing DBs): RU / KA / HE for title/description/cta
    try {
        var _adBases = ['title', 'description', 'cta_text'];
        var _adLangs = ['ru', 'ka', 'he'];
        for (var _bi = 0; _bi < _adBases.length; _bi++) {
            for (var _li = 0; _li < _adLangs.length; _li++) {
                await pool.query('ALTER TABLE ad_cards ADD COLUMN IF NOT EXISTS ' + _adBases[_bi] + '_' + _adLangs[_li] + ' TEXT');
            }
        }
    } catch (e) { /* columns may already exist or table not yet created */ }

    // placement is now a comma-separated list of surfaces (an ad can target several
    // pages at once), so the single-value CHECK constraint is dropped. Values are
    // validated in the API layer (sanitizeAd).
    try {
        await pool.query(`ALTER TABLE ad_cards DROP CONSTRAINT IF EXISTS ad_cards_placement_check`);
    } catch (e) { /* table not yet created */ }

    // Add partner signup method / paid columns (existing DBs)
    try {
        await pool.query(`ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS signup_method TEXT DEFAULT 'invite'`);
        await pool.query(`ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS signup_paid INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS signup_paypal_order_id TEXT`);
        await pool.query(`ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS signup_paypal_capture_id TEXT`);
        await pool.query(`ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS invite_code_used TEXT`);
    } catch (e) { /* columns may already exist or table not yet created */ }

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

    // Partner invite codes — admin hands these to trusted partners for free (admin-approved) signup
    await pool.query(`
        CREATE TABLE IF NOT EXISTS partner_invite_codes (
            id SERIAL PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            note TEXT,
            max_uses INTEGER DEFAULT 0,
            used_count INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Partner referral system — every partner gets a unique code and can earn from referrals
    try {
        await pool.query(`ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE`);
        await pool.query(`ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS referred_by_user_id INTEGER REFERENCES users(id)`);
        await pool.query(`ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS referral_balance REAL DEFAULT 0`);
        await pool.query(`ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS referral_payout_method TEXT`);
        await pool.query(`ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS referral_payout_details TEXT`);
    } catch (e) { /* columns may already exist or table not yet created */ }

    try {
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_partner_profiles_referral_code ON partner_profiles(referral_code)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_partner_profiles_referred_by ON partner_profiles(referred_by_user_id)`);
    } catch (e) { /* indexes may already exist */ }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS partner_referral_commissions (
            id SERIAL PRIMARY KEY,
            referrer_user_id INTEGER NOT NULL REFERENCES users(id),
            referred_user_id INTEGER NOT NULL REFERENCES users(id),
            booking_id INTEGER REFERENCES bookings(id),
            service_fee_amount REAL NOT NULL,
            commission_percent REAL NOT NULL,
            commission_amount REAL NOT NULL,
            tier_car_count INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    try {
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_referral_commissions_referrer ON partner_referral_commissions(referrer_user_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_referral_commissions_booking ON partner_referral_commissions(booking_id)`);
    } catch (e) { /* indexes may already exist */ }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS partner_payout_requests (
            id SERIAL PRIMARY KEY,
            partner_user_id INTEGER NOT NULL REFERENCES users(id),
            amount REAL NOT NULL,
            method TEXT NOT NULL,
            details TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed_at TIMESTAMP
        )
    `);

    // VIP wallet — a spend-only credit balance partners use to buy VIP for their
    // cars ($10 / 30 days). Kept separate from referral_balance (which is real,
    // payout-able cash). vip_first_bonus_used tracks the one-time first-VIP gift.
    try {
        await pool.query(`ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS vip_balance REAL DEFAULT 0`);
        await pool.query(`ALTER TABLE partner_profiles ADD COLUMN IF NOT EXISTS vip_first_bonus_used INTEGER DEFAULT 0`);
        // Flag so the "VIP expiring soon" reminder email is sent only once per VIP period.
        await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vip_expiry_reminded INTEGER DEFAULT 0`);
        // Vertical crop position (0-100%) for the main photo on cards. 50 = centered
        // (the previous/default behaviour), so existing vehicles are unaffected.
        await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS image_offset_y REAL DEFAULT 50`);
        // Per-language descriptions. The legacy `description` column stays as the
        // universal fallback, so existing vehicles keep working with no migration.
        await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS description_en TEXT`);
        await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS description_ka TEXT`);
        await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS description_ru TEXT`);
        await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS description_he TEXT`);
        // Georgia-only flag: vehicle may be driven on off-road / mountain routes.
        await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS offroad_allowed INTEGER DEFAULT 0`);
        // Admin flag for the "SUV 6-8 Seats" (3-row) homepage category, so existing
        // cars can be included without partners re-editing their listings.
        await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS suv_6_8 INTEGER DEFAULT 0`);
        // Partner-defined minimum rental duration (days). 1 = no minimum.
        await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS min_rental_days INTEGER DEFAULT 1`);
    } catch (e) { /* columns may already exist or table not yet created */ }

    // Extra pickup locations per vehicle (unlimited), each with its own fee. This
    // is additive: the vehicle's primary location_city/country is unchanged, so
    // existing filtering, cards and bookings keep working exactly as before.
    await pool.query(`
        CREATE TABLE IF NOT EXISTS vehicle_locations (
            id SERIAL PRIMARY KEY,
            vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
            country TEXT,
            city TEXT,
            airport TEXT,
            address TEXT,
            name TEXT,
            pickup_fee REAL DEFAULT 0,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    try {
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_vehicle_locations_vehicle ON vehicle_locations(vehicle_id)`);
    } catch (e) { /* index may already exist */ }

    // Audit log for every VIP-wallet movement: topup (card), spend (VIP buy),
    // bonus (first-VIP gift), referral_transfer (moved from referral earnings).
    await pool.query(`
        CREATE TABLE IF NOT EXISTS vip_wallet_transactions (
            id SERIAL PRIMARY KEY,
            partner_user_id INTEGER NOT NULL REFERENCES users(id),
            amount REAL NOT NULL,
            type TEXT NOT NULL,
            source TEXT,
            vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
            balance_after REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    try {
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_vip_wallet_tx_partner ON vip_wallet_transactions(partner_user_id)`);
    } catch (e) { /* index may already exist */ }

    // Page visits tracking
    await pool.query(`
        CREATE TABLE IF NOT EXISTS page_visits (
            id SERIAL PRIMARY KEY,
            page TEXT NOT NULL,
            ip TEXT,
            user_agent TEXT,
            referrer TEXT,
            visitor_id TEXT,
            is_bot INTEGER DEFAULT 0,
            is_verified INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Bot-detection columns for existing databases
    try {
        await pool.query(`ALTER TABLE page_visits ADD COLUMN IF NOT EXISTS is_bot INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE page_visits ADD COLUMN IF NOT EXISTS is_verified INTEGER DEFAULT 0`);
    } catch (e) { /* columns may already exist */ }

    // Drivers registry — partner-added driver profiles, admin-moderated.
    // Directory/contact model (no online booking). Hidden until approved.
    await pool.query(`
        CREATE TABLE IF NOT EXISTS drivers (
            id SERIAL PRIMARY KEY,
            partner_id INTEGER NOT NULL,
            full_name TEXT NOT NULL,
            photo_url TEXT,
            experience_years INTEGER DEFAULT 0,
            languages TEXT,
            has_own_vehicle INTEGER DEFAULT 0,
            vehicle_info TEXT,
            price_amount NUMERIC(10,2) DEFAULT 0,
            price_unit TEXT DEFAULT 'day' CHECK(price_unit IN ('day', 'hour')),
            phone TEXT,
            whatsapp TEXT,
            bio TEXT,
            location_city TEXT,
            country TEXT DEFAULT 'georgia',
            license_front TEXT,
            license_back TEXT,
            id_document TEXT,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
            is_verified INTEGER DEFAULT 0,
            rating NUMERIC(3,2) DEFAULT 0,
            reviews_count INTEGER DEFAULT 0,
            priority INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Promotional ad cards — admin-built banners injected into listing grids.
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ad_cards (
            id SERIAL PRIMARY KEY,
            title TEXT,
            description TEXT,
            cover_url TEXT,
            target_link TEXT NOT NULL,
            cta_text TEXT,
            title_ru TEXT, title_ka TEXT, title_he TEXT,
            description_ru TEXT, description_ka TEXT, description_he TEXT,
            cta_text_ru TEXT, cta_text_ka TEXT, cta_text_he TEXT,
            placement TEXT DEFAULT 'cars',
            page INTEGER DEFAULT 1,
            position INTEGER DEFAULT 4,
            clicks INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Trust badges — the admin-managed strip of trust signals (icon + label) shown on
    // pages. `placement` (comma list, same surfaces as ads) controls which pages each
    // badge appears on; `position` orders them.
    await pool.query(`
        CREATE TABLE IF NOT EXISTS trust_badges (
            id SERIAL PRIMARY KEY,
            icon TEXT,
            label TEXT,
            label_ru TEXT, label_ka TEXT, label_he TEXT,
            placement TEXT DEFAULT 'cars,drivers,vehicles,blog,checkout',
            position INTEGER DEFAULT 1,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    // Seed the current 5 badges once, so nothing is lost when the feature goes live.
    try {
        var tbCount = await pool.query('SELECT COUNT(*)::int AS n FROM trust_badges');
        if (tbCount.rows[0].n === 0) {
            var seed = [
                ['🛡️', 'Full Insurance Included', 'Страховка включена', 'სრული დაზღვევა ჩართულია', 'ביטוח מלא כלול'],
                ['✈️', 'Airport Pickup 24/7', 'Аэропорт 24/7', 'აეროპორტიდან აყვანა 24/7', 'איסוף משדה התעופה 24/7'],
                ['📱', 'Instant WhatsApp Support', 'WhatsApp поддержка', 'მყისიერი WhatsApp მხარდაჭერა', 'תמיכת וואטסאפ מיידית'],
                ['✅', 'Verified Local Partners', 'Проверенные местные партнёры', 'შემოწმებული ადგილობრივი პარტნიორები', 'שותפים מקומיים מאומתים'],
                ['🕐', '24/7 Service', 'Сервис 24/7', '24/7 მომსახურება', 'שירות 24/7']
            ];
            for (var s = 0; s < seed.length; s++) {
                await pool.query(
                    'INSERT INTO trust_badges (icon, label, label_ru, label_ka, label_he, placement, position, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,1)',
                    [seed[s][0], seed[s][1], seed[s][2], seed[s][3], seed[s][4], 'cars,drivers,vehicles,blog,checkout', s + 1]
                );
            }
            console.log('Seeded default trust badges');
        }
    } catch (e) { console.error('Trust badge seed error:', e.message); }

    // Driver reviews — customer ratings for driver profiles.
    await pool.query(`
        CREATE TABLE IF NOT EXISTS driver_reviews (
            id SERIAL PRIMARY KEY,
            driver_id INTEGER NOT NULL,
            customer_id INTEGER NOT NULL,
            rating_score INTEGER NOT NULL CHECK(rating_score BETWEEN 1 AND 5),
            review_text TEXT,
            is_hidden INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
            FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(driver_id, customer_id)
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
        'CREATE INDEX IF NOT EXISTS idx_availability_date ON vehicle_availability(date)',
        'CREATE INDEX IF NOT EXISTS idx_page_visits_created ON page_visits(created_at)',
        'CREATE INDEX IF NOT EXISTS idx_page_visits_visitor ON page_visits(visitor_id)',
        'CREATE INDEX IF NOT EXISTS idx_page_visits_bot ON page_visits(is_bot)',
        'CREATE INDEX IF NOT EXISTS idx_page_visits_verified ON page_visits(is_verified)',
        'CREATE INDEX IF NOT EXISTS idx_drivers_partner ON drivers(partner_id)',
        'CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status)',
        'CREATE INDEX IF NOT EXISTS idx_ad_cards_placement ON ad_cards(placement)',
        'CREATE INDEX IF NOT EXISTS idx_ad_cards_active ON ad_cards(is_active)',
        'CREATE INDEX IF NOT EXISTS idx_driver_reviews_driver ON driver_reviews(driver_id)',
        'CREATE INDEX IF NOT EXISTS idx_driver_reviews_customer ON driver_reviews(customer_id)'
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
            ['admin@EliteAuto.rent', hash, 'Admin']
        );
        console.log('=======================================================');
        console.log('DEFAULT ADMIN CREATED');
        console.log('Email:    admin@EliteAuto.rent');
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
