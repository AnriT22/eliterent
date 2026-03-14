const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'myrent.db');
const dataDir = path.join(__dirname, '..', 'data');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;

async function initDB() {
    if (db) return db;

    const SQL = await initSqlJs();

    // Load existing DB file if it exists
    if (fs.existsSync(dbPath)) {
        const fileBuffer = fs.readFileSync(dbPath);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    db.run('PRAGMA foreign_keys = ON');

    // Create tables
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            phone TEXT,
            role TEXT NOT NULL CHECK(role IN ('guest', 'partner', 'admin')),
            avatar_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS partner_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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
            status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'pending')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Add new vehicle columns for existing databases
    var newVehicleCols = [
        "brand TEXT",
        "model TEXT",
        "color TEXT",
        "min_age INTEGER DEFAULT 21",
        "location_city TEXT",
        "fuel_policy TEXT DEFAULT 'full_to_full'",
        "luggage TEXT",
        "region TEXT",
        "engine_cc INTEGER",
        "horsepower INTEGER",
        "mileage_limit_enabled INTEGER DEFAULT 0",
        "mileage_km INTEGER",
        "multimedia TEXT",
        "price_tiers TEXT",
        "extras TEXT",
        "insurance TEXT",
        "pickup_fees_enabled INTEGER DEFAULT 0",
        "pickup_fees TEXT",
        "visible_in_search INTEGER DEFAULT 1",
        "block_after_payment INTEGER DEFAULT 0",
        "custom_pricing_enabled INTEGER DEFAULT 0",
        "custom_pricing_ranges TEXT",
        "registration_number TEXT"
    ];
    newVehicleCols.forEach(function(colDef) {
        try { db.run("ALTER TABLE vehicles ADD COLUMN " + colDef); } catch(e) { /* column already exists */ }
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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
            service_fee REAL DEFAULT 0,
            total_price REAL NOT NULL,
            deposit_paid REAL DEFAULT 0,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled', 'cancel_requested')),
            guest_notes TEXT,
            partner_notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (guest_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
            FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guest_id INTEGER NOT NULL,
            vehicle_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(guest_id, vehicle_id),
            FOREIGN KEY (guest_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guest_id INTEGER NOT NULL,
            vehicle_id INTEGER,
            booking_id INTEGER,
            rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
            title TEXT,
            body TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (guest_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
            FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS vehicle_availability (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            status TEXT DEFAULT 'available' CHECK(status IN ('available', 'blocked', 'booked')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(vehicle_id, date),
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
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
    indexes.forEach(function (sql) { db.run(sql); });

    // Migrate: update role constraint to include 'admin'
    try {
        var tableInfo = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
        if (tableInfo.length > 0) {
            var createSql = tableInfo[0].values[0][0];
            if (createSql && createSql.indexOf("'admin'") === -1) {
                // Need to recreate table with updated constraint
                db.run("ALTER TABLE users RENAME TO users_old");
                db.run(`
                    CREATE TABLE users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        email TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        full_name TEXT NOT NULL,
                        phone TEXT,
                        role TEXT NOT NULL CHECK(role IN ('guest', 'partner', 'admin')),
                        avatar_url TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                db.run("INSERT INTO users SELECT * FROM users_old");
                db.run("DROP TABLE users_old");
            }
        }
    } catch (e) { console.log('Role migration note:', e.message); }

    // Migrate: add is_approved column to users table
    try {
        var userCols = db.exec("PRAGMA table_info(users)");
        if (userCols.length > 0) {
            var userColNames = userCols[0].values.map(function (r) { return r[1]; });
            if (userColNames.indexOf('is_approved') === -1) {
                db.run("ALTER TABLE users ADD COLUMN is_approved INTEGER DEFAULT 0");
                // Auto-approve all existing users and admins
                db.run("UPDATE users SET is_approved = 1");
                saveDB();
                console.log('Migration: added is_approved column, approved all existing users');
            }
        }
    } catch (e) { console.log('is_approved migration note:', e.message); }

    // Migrate: add tech_passport columns if missing
    try {
        var cols = db.exec("PRAGMA table_info(vehicles)");
        if (cols.length > 0) {
            var colNames = cols[0].values.map(function (r) { return r[1]; });
            if (colNames.indexOf('tech_passport_front') === -1) {
                db.run("ALTER TABLE vehicles ADD COLUMN tech_passport_front TEXT");
            }
            if (colNames.indexOf('tech_passport_back') === -1) {
                db.run("ALTER TABLE vehicles ADD COLUMN tech_passport_back TEXT");
            }
            if (colNames.indexOf('extra_services') === -1) {
                db.run("ALTER TABLE vehicles ADD COLUMN extra_services TEXT");
            }
            if (colNames.indexOf('service_options') === -1) {
                db.run("ALTER TABLE vehicles ADD COLUMN service_options TEXT");
            }
        }
    } catch (e) { /* columns already exist */ }

    // Migrate: bookings schema to support accepted/rejected and pricing breakdown fields
    try {
        var bookingsTableInfo = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='bookings'");
        if (bookingsTableInfo.length > 0) {
            var bookingsCreateSql = bookingsTableInfo[0].values[0][0] || '';
            var needsBookingRebuild = bookingsCreateSql.indexOf("'accepted'") === -1
                || bookingsCreateSql.indexOf('service_fee') === -1
                || bookingsCreateSql.indexOf('extras_json') === -1
                || bookingsCreateSql.indexOf('rental_days') === -1;

            if (needsBookingRebuild) {
                db.run("ALTER TABLE bookings RENAME TO bookings_old");
                db.run(`
                    CREATE TABLE bookings (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        guest_id INTEGER NOT NULL,
                        vehicle_id INTEGER NOT NULL,
                        partner_id INTEGER NOT NULL,
                        pickup_date TEXT NOT NULL,
                        dropoff_date TEXT NOT NULL,
                        rental_days INTEGER DEFAULT 1,
                        pickup_location TEXT,
                        dropoff_location TEXT,
                        extras_json TEXT,
                        extras_total REAL DEFAULT 0,
                        service_fee REAL DEFAULT 0,
                        total_price REAL NOT NULL,
                        deposit_paid REAL DEFAULT 0,
                        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
                        guest_notes TEXT,
                        partner_notes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (guest_id) REFERENCES users(id) ON DELETE CASCADE,
                        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
                        FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE CASCADE
                    )
                `);
                db.run(`
                    INSERT INTO bookings (
                        id, guest_id, vehicle_id, partner_id, pickup_date, dropoff_date,
                        rental_days, pickup_location, dropoff_location, extras_json,
                        extras_total, service_fee, total_price, deposit_paid, status,
                        guest_notes, partner_notes, created_at, updated_at
                    )
                    SELECT
                        id,
                        guest_id,
                        vehicle_id,
                        partner_id,
                        pickup_date,
                        dropoff_date,
                        CASE
                            WHEN julianday(dropoff_date) - julianday(pickup_date) >= 1 THEN CAST(julianday(dropoff_date) - julianday(pickup_date) AS INTEGER)
                            ELSE 1
                        END,
                        pickup_location,
                        dropoff_location,
                        NULL,
                        0,
                        0,
                        total_price,
                        deposit_paid,
                        CASE
                            WHEN status = 'confirmed' THEN 'accepted'
                            WHEN status = 'active' THEN 'accepted'
                            ELSE status
                        END,
                        guest_notes,
                        partner_notes,
                        created_at,
                        updated_at
                    FROM bookings_old
                `);
                db.run("DROP TABLE bookings_old");
            }
        }
    } catch (e) { console.log('Bookings migration note:', e.message); }

    // Migrate: expand bookings CHECK to include cancel_requested, add pickup_time/dropoff_time
    try {
        var bookingsInfo2 = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='bookings'");
        if (bookingsInfo2.length > 0) {
            var bSql2 = bookingsInfo2[0].values[0][0] || '';
            var needsStatusExpand = bSql2.indexOf("'cancel_requested'") === -1;
            var bCols = db.exec("PRAGMA table_info(bookings)");
            var bColNames = bCols.length > 0 ? bCols[0].values.map(function (r) { return r[1]; }) : [];
            var needsTimeCols = bColNames.indexOf('pickup_time') === -1;

            if (needsStatusExpand || needsTimeCols) {
                db.run("PRAGMA foreign_keys = OFF");
                db.run("ALTER TABLE bookings RENAME TO bookings_old2");
                db.run(`
                    CREATE TABLE bookings (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
                        service_fee REAL DEFAULT 0,
                        total_price REAL NOT NULL,
                        deposit_paid REAL DEFAULT 0,
                        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled', 'cancel_requested')),
                        guest_notes TEXT,
                        partner_notes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (guest_id) REFERENCES users(id) ON DELETE CASCADE,
                        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
                        FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE CASCADE
                    )
                `);
                var hasOldTimeCols = bColNames.indexOf('pickup_time') !== -1;
                var timeSrc = hasOldTimeCols ? "pickup_time, dropoff_time," : "'10:00', '10:00',";
                db.run(`
                    INSERT INTO bookings (
                        id, guest_id, vehicle_id, partner_id, pickup_date, dropoff_date,
                        pickup_time, dropoff_time,
                        rental_days, pickup_location, dropoff_location, extras_json,
                        extras_total, service_fee, total_price, deposit_paid, status,
                        guest_notes, partner_notes, created_at, updated_at
                    )
                    SELECT
                        id, guest_id, vehicle_id, partner_id, pickup_date, dropoff_date,
                        ${timeSrc}
                        rental_days, pickup_location, dropoff_location, extras_json,
                        extras_total, service_fee, total_price, deposit_paid, status,
                        guest_notes, partner_notes, created_at, updated_at
                    FROM bookings_old2
                `);
                db.run("DROP TABLE bookings_old2");
                db.run("PRAGMA foreign_keys = ON");
            }
        }
    } catch (e) { console.log('Bookings cancel_requested migration note:', e.message); }

    // Migration: add location_fee column to bookings
    try {
        var locCols = db.exec("PRAGMA table_info(bookings)");
        var locColNames = locCols.length > 0 ? locCols[0].values.map(function(c) {
            var n = c[1]; return n instanceof Uint8Array ? new TextDecoder().decode(n) : n;
        }) : [];
        if (locColNames.indexOf('location_fee') === -1) {
            db.run("ALTER TABLE bookings ADD COLUMN location_fee REAL DEFAULT 0");
            saveDB();
            console.log('Migration: added location_fee column to bookings');
        }
    } catch (e) { console.log('Location fee migration note:', e.message); }

    // Create password_resets table for forgot password flow
    db.run(`
        CREATE TABLE IF NOT EXISTS password_resets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expires_at DATETIME NOT NULL,
            used INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Migration: add is_approved column to users if missing
    try {
        var uCols = db.exec("PRAGMA table_info(users)");
        var uColNames = uCols.length > 0 ? uCols[0].values.map(function(c) {
            var n = c[1]; return n instanceof Uint8Array ? new TextDecoder().decode(n) : n;
        }) : [];
        if (uColNames.indexOf('is_approved') === -1) {
            db.run("ALTER TABLE users ADD COLUMN is_approved INTEGER DEFAULT 1");
            saveDB();
            console.log('Migration: added is_approved column to users');
        }
    } catch (e) { console.log('is_approved migration note:', e.message); }

    // Migration: add PayPal payment columns to bookings
    try {
        var cols = db.exec("PRAGMA table_info(bookings)");
        var colNames = cols.length > 0 ? cols[0].values.map(function(c) {
            var n = c[1]; return n instanceof Uint8Array ? new TextDecoder().decode(n) : n;
        }) : [];
        if (colNames.indexOf('payment_status') === -1) {
            db.run("ALTER TABLE bookings ADD COLUMN payment_status TEXT DEFAULT 'unpaid'");
            db.run("ALTER TABLE bookings ADD COLUMN paypal_order_id TEXT");
            db.run("ALTER TABLE bookings ADD COLUMN paypal_capture_id TEXT");
            db.run("ALTER TABLE bookings ADD COLUMN payment_date DATETIME");
            saveDB();
            console.log('Migration: added payment columns to bookings');
        }
    } catch (e) { console.log('Payment columns migration note:', e.message); }

    // Migration: expand vehicles status constraint to include 'delete_requested'
    try {
        var vTableInfo = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='vehicles'");
        if (vTableInfo.length > 0) {
            var vSqlRaw = vTableInfo[0].values[0][0] || '';
            var vSql = (vSqlRaw instanceof Uint8Array) ? new TextDecoder().decode(vSqlRaw) : String(vSqlRaw);
            if (vSql.indexOf("'delete_requested'") === -1) {
                db.run("PRAGMA foreign_keys = OFF");
                db.run("ALTER TABLE vehicles RENAME TO vehicles_old_mig");
                db.run(`
                    CREATE TABLE vehicles (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE CASCADE
                    )
                `);
                // Copy all columns that exist in both tables
                var oldCols = db.exec("PRAGMA table_info(vehicles_old_mig)");
                var newCols = db.exec("PRAGMA table_info(vehicles)");
                var oldColNames = oldCols.length > 0 ? oldCols[0].values.map(function(c) { var n = c[1]; return n instanceof Uint8Array ? new TextDecoder().decode(n) : n; }) : [];
                var newColNames = newCols.length > 0 ? newCols[0].values.map(function(c) { var n = c[1]; return n instanceof Uint8Array ? new TextDecoder().decode(n) : n; }) : [];
                var commonCols = oldColNames.filter(function(c) { return newColNames.indexOf(c) !== -1; });
                var colList = commonCols.join(', ');
                db.run("INSERT INTO vehicles (" + colList + ") SELECT " + colList + " FROM vehicles_old_mig");
                db.run("DROP TABLE vehicles_old_mig");
                db.run("PRAGMA foreign_keys = ON");
                // Re-add new columns that may have been added via ALTER TABLE
                var newVehicleColsMig = [
                    "brand TEXT", "model TEXT", "color TEXT", "min_age INTEGER DEFAULT 21",
                    "location_city TEXT", "fuel_policy TEXT DEFAULT 'full_to_full'", "luggage TEXT",
                    "region TEXT", "engine_cc INTEGER", "horsepower INTEGER",
                    "mileage_limit_enabled INTEGER DEFAULT 0", "mileage_km INTEGER",
                    "multimedia TEXT", "price_tiers TEXT", "extras TEXT", "insurance TEXT",
                    "pickup_fees_enabled INTEGER DEFAULT 0", "pickup_fees TEXT",
                    "visible_in_search INTEGER DEFAULT 1", "block_after_payment INTEGER DEFAULT 0",
                    "custom_pricing_enabled INTEGER DEFAULT 0", "custom_pricing_ranges TEXT",
                    "registration_number TEXT"
                ];
                newVehicleColsMig.forEach(function(colDef) {
                    try { db.run("ALTER TABLE vehicles ADD COLUMN " + colDef); } catch(e) { /* already exists */ }
                });
                saveDB();
                console.log('Migration: expanded vehicles status constraint to include delete_requested');
            }
        }
    } catch (e) { console.log('Vehicles status migration note:', e.message); }

    // Migration: fix stale FK references in vehicle_availability and bookings after vehicles table rebuild
    try {
        var vaInfo = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='vehicle_availability'");
        if (vaInfo.length > 0) {
            var vaSqlRaw = vaInfo[0].values[0][0] || '';
            var vaSql = (vaSqlRaw instanceof Uint8Array) ? new TextDecoder().decode(vaSqlRaw) : String(vaSqlRaw);
            if (vaSql.indexOf('vehicles_old_mig') !== -1) {
                console.log('Fixing stale FK in vehicle_availability...');
                db.run("PRAGMA foreign_keys = OFF");
                db.run("ALTER TABLE vehicle_availability RENAME TO vehicle_availability_old_fk");
                db.run(`CREATE TABLE vehicle_availability (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    vehicle_id INTEGER NOT NULL,
                    date TEXT NOT NULL,
                    status TEXT DEFAULT 'available' CHECK(status IN ('available', 'blocked', 'booked')),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(vehicle_id, date),
                    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
                )`);
                db.run("INSERT INTO vehicle_availability (id, vehicle_id, date, status, created_at, updated_at) SELECT id, vehicle_id, date, status, created_at, updated_at FROM vehicle_availability_old_fk");
                db.run("DROP TABLE vehicle_availability_old_fk");
                db.run("PRAGMA foreign_keys = ON");
                saveDB();
                console.log('Fixed vehicle_availability FK references');
            }
        }
    } catch (e) { console.log('vehicle_availability FK fix note:', e.message); }

    try {
        var bkInfo = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='bookings'");
        if (bkInfo.length > 0) {
            var bkSqlRaw = bkInfo[0].values[0][0] || '';
            var bkSql = (bkSqlRaw instanceof Uint8Array) ? new TextDecoder().decode(bkSqlRaw) : String(bkSqlRaw);
            if (bkSql.indexOf('vehicles_old_mig') !== -1) {
                console.log('Fixing stale FK in bookings...');
                db.run("PRAGMA foreign_keys = OFF");
                // Get existing bookings columns
                var bkCols = db.exec("PRAGMA table_info(bookings)");
                var bkColNames = bkCols.length > 0 ? bkCols[0].values.map(function(c) { var n = c[1]; return (n instanceof Uint8Array) ? new TextDecoder().decode(n) : n; }) : [];
                db.run("ALTER TABLE bookings RENAME TO bookings_old_fk");
                db.run(`CREATE TABLE bookings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
                    service_fee REAL DEFAULT 0,
                    total_price REAL NOT NULL,
                    deposit_paid REAL DEFAULT 0,
                    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled', 'cancel_requested')),
                    guest_notes TEXT,
                    partner_notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (guest_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
                    FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE CASCADE
                )`);
                // Add extra columns that were added via ALTER TABLE
                var extraBkCols = ["payment_status TEXT DEFAULT 'unpaid'", "paypal_order_id TEXT", "paypal_capture_id TEXT", "payment_date DATETIME"];
                extraBkCols.forEach(function(cd) { try { db.run("ALTER TABLE bookings ADD COLUMN " + cd); } catch(e) {} });
                // Get new columns list
                var newBkCols = db.exec("PRAGMA table_info(bookings)");
                var newBkColNames = newBkCols.length > 0 ? newBkCols[0].values.map(function(c) { var n = c[1]; return (n instanceof Uint8Array) ? new TextDecoder().decode(n) : n; }) : [];
                var commonBkCols = bkColNames.filter(function(c) { return newBkColNames.indexOf(c) !== -1; });
                var bkColList = commonBkCols.join(', ');
                db.run("INSERT INTO bookings (" + bkColList + ") SELECT " + bkColList + " FROM bookings_old_fk");
                db.run("DROP TABLE bookings_old_fk");
                db.run("PRAGMA foreign_keys = ON");
                saveDB();
                console.log('Fixed bookings FK references');
            }
        }
    } catch (e) { console.log('bookings FK fix note:', e.message); }

    // Cleanup: rebuild booked dates from scratch based on active bookings
    // Pending + accepted + completed + cancel_requested all block dates
    try {
        // 1. Remove ALL 'booked' entries
        db.run("DELETE FROM vehicle_availability WHERE status = 'booked'");
        // 2. Re-block dates — only for bookings whose vehicle still exists
        var activeBookings = db.exec(
            "SELECT b.vehicle_id, b.pickup_date, b.dropoff_date FROM bookings b " +
            "JOIN vehicles v ON b.vehicle_id = v.id " +
            "WHERE b.status IN ('pending', 'accepted', 'completed', 'cancel_requested')"
        );
        var rebuildCount = 0;
        if (activeBookings.length > 0) {
            activeBookings[0].values.forEach(function(row) {
                try {
                    var vid = row[0];
                    var startStr = row[1]; if (startStr instanceof Uint8Array) startStr = new TextDecoder().decode(startStr);
                    var endStr = row[2]; if (endStr instanceof Uint8Array) endStr = new TextDecoder().decode(endStr);
                    if (!startStr || !endStr) return;
                    var cur = new Date(startStr + 'T00:00:00Z');
                    var end = new Date(endStr + 'T00:00:00Z');
                    if (isNaN(cur.getTime()) || isNaN(end.getTime())) return;
                    while (cur <= end) {
                        var ds = cur.getUTCFullYear() + '-' + String(cur.getUTCMonth() + 1).padStart(2, '0') + '-' + String(cur.getUTCDate()).padStart(2, '0');
                        var exists = db.exec("SELECT id FROM vehicle_availability WHERE vehicle_id = " + vid + " AND date = '" + ds + "'");
                        if (exists.length > 0 && exists[0].values.length > 0) {
                            db.run("UPDATE vehicle_availability SET status = 'booked', updated_at = CURRENT_TIMESTAMP WHERE vehicle_id = ? AND date = ?", [vid, ds]);
                        } else {
                            db.run("INSERT INTO vehicle_availability (vehicle_id, date, status) VALUES (?, ?, 'booked')", [vid, ds]);
                        }
                        rebuildCount++;
                        cur.setUTCDate(cur.getUTCDate() + 1);
                    }
                } catch (rowErr) {
                    console.log('Availability rebuild skip booking for vehicle', row[0], ':', rowErr.message);
                }
            });
        }
        saveDB();
        console.log('Availability rebuild: blocked', rebuildCount, 'date(s) from active bookings');
    } catch (e) { console.log('Availability rebuild error:', e.message); }

    // Seed default admin account (password: admin123)
    const bcrypt = require('bcryptjs');
    const adminStmt = db.prepare('SELECT id FROM users WHERE role = ?');
    adminStmt.bind(['admin']);
    const hasAdmin = adminStmt.step();
    adminStmt.free();
    if (!hasAdmin) {
        const hash = bcrypt.hashSync('admin123', 12);
        db.run(
            "INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, 'admin')",
            ['admin@eliterent.ge', hash, 'Admin']
        );
        console.log('Default admin created: admin@eliterent.ge / admin123');
    }

    // Save to disk
    saveDB();

    console.log('Database initialized at:', dbPath);
    return db;
}

function saveDB() {
    if (!db) return;
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
}

function getDB() {
    return db;
}

module.exports = { initDB, getDB, saveDB };
