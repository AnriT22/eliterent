const express = require('express');
const bcrypt = require('bcryptjs');
const dns = require('dns').promises;
const { authenticateToken, generateToken } = require('../middleware/auth');
const { queryAll, queryOne, execute } = require('../db-helpers');
const { sendOTPEmail } = require('../mailer');
const { sendOTPSMS } = require('../services/sms');
const otpService = require('../services/otp');

const router = express.Router();

// Email format validation
function isValidEmail(email) {
    if (!email || email.length > 254) return false;
    var re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return re.test(email);
}

// Password strength validation
function validatePassword(password) {
    if (!password || password.length < 8) return { valid: false, error: 'Password must be at least 8 characters' };
    if (!/[A-Z]/.test(password)) return { valid: false, error: 'Password must contain at least one uppercase letter' };
    if (!/[0-9]/.test(password)) return { valid: false, error: 'Password must contain at least one number' };
    if (!/[^A-Za-z0-9]/.test(password)) return { valid: false, error: 'Password must contain at least one special character' };
    return { valid: true };
}

// Escape LIKE wildcards
function escapeLikeWildcards(str) {
    return String(str || '').replace(/%/g, '').replace(/_/g, '');
}

// Per-country phone digit rules (local digits only, excluding country code)
const PHONE_RULES = {
    '+995': 9, '+1': 10, '+44': 10, '+49': 11, '+33': 9, '+34': 9, '+39': 10,
    '+90': 10, '+7': 10, '+380': 9, '+48': 9, '+31': 9, '+46': 9, '+41': 9,
    '+43': 10, '+32': 9, '+351': 9, '+30': 10, '+972': 9, '+971': 9, '+966': 9,
    '+91': 10, '+86': 11, '+81': 10, '+82': 10, '+61': 9, '+55': 11, '+374': 8, '+994': 9
};

function validatePhone(phone) {
    if (!phone) return { valid: true };
    // Phone is stored as "+CODE LOCALDIGITS" e.g. "+995 592522299"
    var parts = phone.trim().split(/\s+/);
    var code = parts[0] || '';
    var local = parts.slice(1).join('').replace(/\D/g, '');
    var expectedDigits = PHONE_RULES[code];
    if (expectedDigits && local.length !== expectedDigits) {
        return { valid: false, error: 'Phone number must be exactly ' + expectedDigits + ' digits for ' + code };
    }
    // Fallback: accept 7-15 digits total for unknown codes
    var allDigits = phone.replace(/\D/g, '');
    if (allDigits.length < 7 || allDigits.length > 15) {
        return { valid: false, error: 'Invalid phone number format' };
    }
    return { valid: true };
}

// GET /api/verify-email?email=test@example.com — check if email domain has valid MX records
router.get('/verify-email', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email || !email.includes('@')) {
            return res.json({ valid: false, reason: 'Invalid email format' });
        }
        const domain = email.split('@')[1];
        if (!domain) {
            return res.json({ valid: false, reason: 'Invalid email domain' });
        }
        try {
            const records = await dns.resolveMx(domain);
            if (records && records.length > 0) {
                return res.json({ valid: true });
            }
            return res.json({ valid: false, reason: 'Email domain cannot receive emails' });
        } catch (dnsErr) {
            return res.json({ valid: false, reason: 'Email domain does not exist' });
        }
    } catch (err) {
        console.error('Verify email error:', err);
        res.status(500).json({ valid: false, reason: 'Verification failed' });
    }
});

// GET /api/check-availability?field=email&value=test@test.com
router.get('/check-availability', async (req, res) => {
    try {
        const { field, value } = req.query;
        if (!field || !value) {
            return res.status(400).json({ error: 'field and value are required' });
        }
        const allowed = ['email', 'phone', 'full_name'];
        if (!allowed.includes(field)) {
            return res.status(400).json({ error: 'Invalid field' });
        }
        let existing;
        if (field === 'phone') {
            const digits = value.replace(/\D/g, '');
            if (digits.length < 7) return res.json({ available: true });
            existing = await queryOne(
                "SELECT id FROM users WHERE REPLACE(REPLACE(REPLACE(phone, ' ', ''), '+', ''), '-', '') LIKE '%' || $1",
                [digits.slice(-9)]
            );
        } else {
            existing = await queryOne('SELECT id FROM users WHERE ' + field + ' = $1', [value.trim()]);
        }
        res.json({ available: !existing });
    } catch (err) {
        console.error('Check availability error:', err);
        res.status(500).json({ error: 'Check failed' });
    }
});

// POST /api/register/guest
router.post('/register/guest', async (req, res) => {
    try {
        const { email, password, full_name, phone } = req.body;

        if (!email || !password || !full_name) {
            return res.status(400).json({ error: 'Email, password, and full name are required' });
        }

        // Phone is now REQUIRED for 2FA
        if (!phone) {
            return res.status(400).json({ error: 'Phone number is required for account verification' });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Check for disposable email
        if (otpService.isDisposableEmail(email)) {
            return res.status(400).json({ error: 'Disposable email addresses are not allowed' });
        }

        var pwCheck = validatePassword(password);
        if (!pwCheck.valid) {
            return res.status(400).json({ error: pwCheck.error });
        }

        // Validate phone format per country rules
        var phoneCheck = validatePhone(phone);
        if (!phoneCheck.valid) {
            return res.status(400).json({ error: phoneCheck.error });
        }

        const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email.trim()]);
        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const phoneDigits = phone.replace(/\D/g, '');
        const safeLast9 = escapeLikeWildcards(phoneDigits.slice(-9));
        const phoneExists = await queryOne(
            "SELECT id FROM users WHERE REPLACE(REPLACE(REPLACE(phone, ' ', ''), '+', ''), '-', '') LIKE '%' || $1",
            [safeLast9]
        );
        if (phoneExists) {
            return res.status(409).json({ error: 'Phone number already registered' });
        }

        const nameExists = await queryOne('SELECT id FROM users WHERE full_name = $1', [full_name.trim()]);
        if (nameExists) {
            return res.status(409).json({ error: 'Username already taken' });
        }

        const password_hash = await bcrypt.hash(password, 12);

        // Create user with is_verified = 0 (pending OTP verification)
        await execute(
            'INSERT INTO users (email, password_hash, full_name, phone, role, is_approved, is_verified) VALUES ($1, $2, $3, $4, $5, 1, 0)',
            [email.trim(), password_hash, full_name.trim(), phone, 'guest']
        );

        const newUser = await queryOne('SELECT id, email, full_name, phone, role, is_approved, is_verified FROM users WHERE email = $1', [email.trim()]);

        // Generate and send OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        await execute(
            `INSERT INTO otp_codes (user_id, phone, email, code_hash, type, expires_at)
             VALUES ($1, $2, $3, $4, 'registration', $5)`,
            [newUser.id, phone, email.trim(), otpHash, expiresAt]
        );

        // Send OTP via SMS (primary) and Email (backup)
        await sendOTPSMS(phone, otp, 'registration');
        await sendOTPEmail(email.trim(), otp, 'registration');

        console.log(`[OTP] Registration code for ${phone}: ${otp}`);

        res.status(201).json({
            message: 'Account created! Please verify your phone number.',
            requiresVerification: true,
            userId: newUser.id,
            phoneLast4: phone.slice(-4),
            expiresIn: 300
        });
    } catch (err) {
        console.error('Guest registration error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// POST /api/register/verify - Verify registration OTP and activate account
router.post('/register/verify', async (req, res) => {
    try {
        const { userId, code } = req.body;

        if (!userId || !code) {
            return res.status(400).json({ error: 'User ID and verification code are required' });
        }

        // Get user
        const user = await queryOne('SELECT * FROM users WHERE id = $1', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.is_verified === 1) {
            return res.status(400).json({ error: 'Account already verified' });
        }

        // Find the OTP record
        const otpRecord = await queryOne(
            `SELECT * FROM otp_codes 
             WHERE user_id = $1 AND type = 'registration' AND verified = 0 AND expires_at > NOW()
             ORDER BY created_at DESC LIMIT 1`,
            [userId]
        );

        if (!otpRecord) {
            return res.status(400).json({ error: 'Verification code expired. Please request a new one.' });
        }

        // Check max attempts
        if (otpRecord.attempts >= otpRecord.max_attempts) {
            await execute("UPDATE otp_codes SET verified = -1 WHERE id = $1", [otpRecord.id]);
            return res.status(429).json({
                error: 'Too many failed attempts. Please request a new code.',
                needsResend: true
            });
        }

        // Verify the code
        const isValid = await bcrypt.compare(code, otpRecord.code_hash);

        if (!isValid) {
            await execute(
                "UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1",
                [otpRecord.id]
            );

            const remainingAttempts = otpRecord.max_attempts - otpRecord.attempts - 1;

            return res.status(400).json({
                error: 'Invalid verification code',
                remainingAttempts: remainingAttempts
            });
        }

        // Mark OTP as verified
        await execute("UPDATE otp_codes SET verified = 1 WHERE id = $1", [otpRecord.id]);

        // Activate user account
        await execute(
            "UPDATE users SET is_verified = 1, phone_verified = 1, email_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
            [userId]
        );

        // Generate token for auto-login
        const token = generateToken({
            id: user.id,
            email: user.email,
            role: user.role
        });

        res.json({
            success: true,
            message: 'Account verified successfully!',
            token,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                role: user.role,
                is_approved: user.is_approved,
                is_verified: 1
            }
        });

    } catch (err) {
        console.error('Registration verify error:', err);
        res.status(500).json({ error: 'Verification failed' });
    }
});

// POST /api/register/resend-otp - Resend registration OTP
router.post('/register/resend-otp', async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const user = await queryOne('SELECT * FROM users WHERE id = $1', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.is_verified === 1) {
            return res.status(400).json({ error: 'Account already verified' });
        }

        if (!user.phone) {
            return res.status(400).json({ error: 'No phone number on file' });
        }

        // Check cooldown
        const cooldown = await otpService.checkResendCooldown(`reg:${userId}`);
        if (!cooldown.allowed) {
            return res.status(429).json({
                error: 'Please wait before requesting another code',
                waitSeconds: cooldown.waitSeconds
            });
        }

        // Invalidate existing OTPs
        await execute(
            "UPDATE otp_codes SET verified = -1 WHERE user_id = $1 AND type = 'registration' AND verified = 0",
            [userId]
        );

        // Generate new OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await execute(
            `INSERT INTO otp_codes (user_id, phone, email, code_hash, type, expires_at)
             VALUES ($1, $2, $3, $4, 'registration', $5)`,
            [userId, user.phone, user.email, otpHash, expiresAt]
        );

        // Send OTP
        await sendOTPSMS(user.phone, otp, 'registration');
        await sendOTPEmail(user.email, otp, 'registration');

        console.log(`[OTP] Resent registration code for ${user.phone}: ${otp}`);

        res.json({
            success: true,
            message: 'New verification code sent',
            expiresIn: 300,
            phoneLast4: user.phone.slice(-4)
        });

    } catch (err) {
        console.error('Resend OTP error:', err);
        res.status(500).json({ error: 'Failed to resend code' });
    }
});

// POST /api/register/partner
router.post('/register/partner', async (req, res) => {
    try {
        const {
            email, password, full_name, phone,
            company_name, description, location,
            telegram
        } = req.body;

        if (!email || !password || !full_name) {
            return res.status(400).json({ error: 'Email, password, and full name are required' });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        var pwCheck = validatePassword(password);
        if (!pwCheck.valid) {
            return res.status(400).json({ error: pwCheck.error });
        }

        if (!company_name) {
            return res.status(400).json({ error: 'Company name is required for partners' });
        }

        // Validate phone format per country rules
        if (phone) {
            var phoneCheck = validatePhone(phone);
            if (!phoneCheck.valid) {
                return res.status(400).json({ error: phoneCheck.error });
            }
        }

        const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email.trim()]);
        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        if (phone) {
            const phoneDigits = phone.replace(/\D/g, '');
            const safeLast9 = escapeLikeWildcards(phoneDigits.slice(-9));
            const phoneExists = await queryOne(
                "SELECT id FROM users WHERE REPLACE(REPLACE(REPLACE(phone, ' ', ''), '+', ''), '-', '') LIKE '%' || $1",
                [safeLast9]
            );
            if (phoneExists) {
                return res.status(409).json({ error: 'Phone number already registered' });
            }
        }

        const nameExists = await queryOne('SELECT id FROM users WHERE full_name = $1', [full_name.trim()]);
        if (nameExists) {
            return res.status(409).json({ error: 'Username already taken' });
        }

        const password_hash = await bcrypt.hash(password, 12);

        // Auto-approve login (is_approved=1), but partner actions need is_verified via admin Partners section
        await execute(
            'INSERT INTO users (email, password_hash, full_name, phone, role, is_approved) VALUES ($1, $2, $3, $4, $5, 1)',
            [email.trim(), password_hash, full_name.trim(), phone || null, 'partner']
        );

        const newUser = await queryOne('SELECT id, email, full_name, role, is_approved FROM users WHERE email = $1', [email.trim()]);
        const userId = newUser.id;

        // Insert partner profile (is_verified=0, needs admin approval in Partners section)
        await execute(`
            INSERT INTO partner_profiles 
            (user_id, company_name, description, location, whatsapp, telegram)
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                userId,
                company_name,
                description || null,
                location || null,
                phone || null,
                telegram || null
            ]
        );

        const token = generateToken(newUser);

        // Notify admin about new partner registration
        try {
            const { sendEmail } = require('../mailer');
            const adminUser = await queryOne("SELECT email FROM users WHERE role = 'admin' LIMIT 1");
            if (adminUser && adminUser.email) {
                await sendEmail({
                    to: adminUser.email,
                    subject: 'New Partner Registration — ' + company_name,
                    text: 'A new partner just registered:\n\nName: ' + full_name + '\nCompany: ' + company_name + '\nEmail: ' + email + '\nPhone: ' + (phone || 'N/A') + '\nLocation: ' + (location || 'N/A') + '\n\nPlease verify them in the admin panel.',
                    html: '<h3>New Partner Registration</h3><table style="font-size:14px;"><tr><td style="padding:4px 12px 4px 0;font-weight:600;">Name:</td><td>' + full_name + '</td></tr><tr><td style="padding:4px 12px 4px 0;font-weight:600;">Company:</td><td>' + company_name + '</td></tr><tr><td style="padding:4px 12px 4px 0;font-weight:600;">Email:</td><td>' + email + '</td></tr><tr><td style="padding:4px 12px 4px 0;font-weight:600;">Phone:</td><td>' + (phone || 'N/A') + '</td></tr><tr><td style="padding:4px 12px 4px 0;font-weight:600;">Location:</td><td>' + (location || 'N/A') + '</td></tr></table><p><a href="' + (process.env.BASE_URL || 'http://localhost:3000') + '/admin.html">Open Admin Panel</a></p>'
                });
            }
        } catch (emailErr) {
            console.error('Admin notification email error:', emailErr.message);
        }

        res.status(201).json({
            message: 'Partner account created! An admin will verify your account shortly.',
            token,
            user: {
                id: newUser.id,
                email: newUser.email,
                full_name: newUser.full_name,
                role: newUser.role,
                company_name: company_name,
                is_verified: 0
            },
            pending_approval: true
        });
    } catch (err) {
        console.error('Partner registration error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// POST /api/login
router.post('/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await queryOne('SELECT * FROM users WHERE email = $1', [email]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Admins always pass. For others, is_approved must be 1 to log in.
        // (New registrations auto-set is_approved=1, so this only blocks manually revoked accounts)
        if (user.role !== 'admin' && !user.is_approved) {
            return res.status(403).json({ error: 'Your account has been suspended. Please contact support.' });
        }

        // Enforce role separation: guest cannot login as partner and vice versa
        // Admin accounts bypass this check
        if (role && role !== user.role && user.role !== 'admin') {
            if (role === 'guest') {
                return res.status(403).json({ error: 'This account is registered as a Partner. Please select "Login as Partner".' });
            } else {
                return res.status(403).json({ error: 'This account is registered as a Guest. Please select "Login as Guest".' });
            }
        }

        const token = generateToken(user);

        const responseUser = {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            is_approved: user.is_approved
        };

        if (user.role === 'partner') {
            const profile = await queryOne('SELECT company_name, is_verified FROM partner_profiles WHERE user_id = $1', [user.id]);
            if (profile) {
                responseUser.company_name = profile.company_name;
                responseUser.is_verified = profile.is_verified;
            }
        }

        res.json({
            message: 'Login successful',
            token,
            user: responseUser
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

// GET /api/me — get current user profile
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await queryOne(
            'SELECT id, email, full_name, phone, role, avatar_url, created_at FROM users WHERE id = $1',
            [req.user.id]
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.role === 'partner') {
            const profile = await queryOne('SELECT * FROM partner_profiles WHERE user_id = $1', [user.id]);
            if (profile) {
                user.partner_profile = {
                    company_name: profile.company_name,
                    description: profile.description,
                    location: profile.location,
                    whatsapp: profile.whatsapp,
                    telegram: profile.telegram,
                    categories: JSON.parse(profile.categories || '[]'),
                    engines: JSON.parse(profile.engines || '[]'),
                    gearboxes: JSON.parse(profile.gearboxes || '[]'),
                    drive_types: JSON.parse(profile.drive_types || '[]'),
                    interior_types: JSON.parse(profile.interior_types || '[]'),
                    steering_sides: JSON.parse(profile.steering_sides || '[]'),
                    payment_methods: JSON.parse(profile.payment_methods || '[]'),
                    is_verified: profile.is_verified
                };
            }
        }

        res.json({ user });
    } catch (err) {
        console.error('Get profile error:', err);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// PUT /api/me/password — change password
router.put('/me/password', authenticateToken, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'current_password and new_password are required' });
        }
        var pwCheck = validatePassword(new_password);
        if (!pwCheck.valid) {
            return res.status(400).json({ error: pwCheck.error });
        }
        const user = await queryOne('SELECT * FROM users WHERE id = $1', [req.user.id]);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const valid = await bcrypt.compare(current_password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

        const new_hash = await bcrypt.hash(new_password, 12);
        await execute('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [new_hash, req.user.id]);
        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('Password change error:', err);
        res.status(500).json({ error: 'Failed to update password' });
    }
});

// PUT /api/me — update profile (name, phone)
router.put('/me', authenticateToken, async (req, res) => {
    try {
        const { full_name, phone } = req.body;
        if (!full_name) return res.status(400).json({ error: 'full_name is required' });
        await execute('UPDATE users SET full_name = $1, phone = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
            [full_name, phone || null, req.user.id]);
        const user = await queryOne('SELECT id, email, full_name, phone, role FROM users WHERE id = $1', [req.user.id]);
        res.json({ message: 'Profile updated', user });
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// DELETE /api/me — delete own account
router.delete('/me', authenticateToken, async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) return res.status(400).json({ error: 'password is required to confirm deletion' });
        const user = await queryOne('SELECT * FROM users WHERE id = $1', [req.user.id]);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Password is incorrect' });
        await execute('DELETE FROM users WHERE id = $1', [req.user.id]);
        res.json({ message: 'Account deleted successfully' });
    } catch (err) {
        console.error('Delete account error:', err);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

// POST /api/forgot-password — request password reset email
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const user = await queryOne('SELECT id, email, full_name FROM users WHERE email = $1', [email.trim()]);
        // Always return success to prevent email enumeration
        if (!user) return res.json({ message: 'If that email exists, a reset link has been sent.' });

        // Generate a secure random token
        const crypto = require('crypto');
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

        // Invalidate any previous tokens for this user
        await execute('UPDATE password_resets SET used = 1 WHERE user_id = $1 AND used = 0', [user.id]);
        await execute('INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)', [user.id, token, expiresAt]);

        // Build reset URL
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const resetUrl = baseUrl + '/reset-password.html?token=' + token;

        const { sendEmail } = require('../mailer');
        await sendEmail({
            to: user.email,
            subject: 'Password Reset — Eliterent.ge',
            text: 'Hello ' + (user.full_name || '') + ',\n\nYou requested a password reset. Click the link below to set a new password:\n\n' + resetUrl + '\n\nThis link expires in 1 hour.\n\nIf you did not request this, please ignore this email.\n\nEliterent.ge Team',
            html: '<p>Hello ' + (user.full_name || '') + ',</p><p>You requested a password reset. Click the link below to set a new password:</p><p><a href="' + resetUrl + '" style="display:inline-block;padding:12px 28px;background:#c8a961;color:#0f172a;border-radius:8px;text-decoration:none;font-weight:700;">Reset Password</a></p><p>This link expires in 1 hour.</p><p>If you did not request this, please ignore this email.</p><p>Eliterent.ge Team</p>'
        });

        res.json({ message: 'If that email exists, a reset link has been sent.' });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

// POST /api/reset-password — set new password using token
router.post('/reset-password', async (req, res) => {
    try {
        const { token, new_password } = req.body;
        if (!token || !new_password) return res.status(400).json({ error: 'Token and new_password are required' });
        var pwCheck = validatePassword(new_password);
        if (!pwCheck.valid) return res.status(400).json({ error: pwCheck.error });

        const reset = await queryOne('SELECT * FROM password_resets WHERE token = $1 AND used = 0', [token]);
        if (!reset) return res.status(400).json({ error: 'Invalid or expired reset link' });

        const now = new Date().toISOString();
        if (now > reset.expires_at) {
            await execute('UPDATE password_resets SET used = 1 WHERE id = $1', [reset.id]);
            return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
        }

        const password_hash = await bcrypt.hash(new_password, 12);
        await execute('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [password_hash, reset.user_id]);
        await execute('UPDATE password_resets SET used = 1 WHERE id = $1', [reset.id]);

        res.json({ message: 'Password has been reset successfully. You can now log in.' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

module.exports = router;
