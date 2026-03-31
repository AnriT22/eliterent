const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticateToken } = require('../middleware/auth');
const { queryAll, queryOne, execute } = require('../db-helpers');
const { sendOTPEmail } = require('../mailer');
const { sendOTPSMS } = require('../services/sms');
const otpService = require('../services/otp');

const router = express.Router();

// Generate 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/otp/send - Send OTP for various purposes
router.post('/send', async (req, res) => {
    try {
        const { phone, email, type, userId } = req.body;

        if (!type) {
            return res.status(400).json({ error: 'OTP type is required' });
        }

        if (!phone && !email) {
            return res.status(400).json({ error: 'Phone or email is required' });
        }

        const validTypes = ['registration', 'reservation', 'login', 'phone_verify', 'email_verify'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: 'Invalid OTP type' });
        }

        // Rate limiting key
        const rateLimitKey = phone || email;

        // Check if user is blocked
        const blockStatus = await otpService.checkBlocked(rateLimitKey);
        if (blockStatus.blocked) {
            return res.status(429).json({
                error: 'Too many attempts. Please try again later.',
                waitSeconds: blockStatus.remainingSeconds
            });
        }

        // Check rate limit (max 5 OTP requests per minute)
        const allowed = await otpService.checkRateLimit(rateLimitKey, 5, 60);
        if (!allowed) {
            return res.status(429).json({ error: 'Too many requests. Please wait before requesting another code.' });
        }

        // Check resend cooldown (60 seconds between resends)
        const cooldown = await otpService.checkResendCooldown(rateLimitKey);
        if (!cooldown.allowed) {
            return res.status(429).json({
                error: 'Please wait before requesting another code',
                waitSeconds: cooldown.waitSeconds
            });
        }

        // Check for disposable email
        if (email && otpService.isDisposableEmail(email)) {
            return res.status(400).json({ error: 'Disposable email addresses are not allowed' });
        }

        // Generate OTP
        const otp = generateOTP();
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Invalidate any existing OTPs for this phone/email and type
        if (phone) {
            await execute(
                "UPDATE otp_codes SET verified = -1 WHERE phone = $1 AND type = $2 AND verified = 0",
                [phone, type]
            );
        }
        if (email) {
            await execute(
                "UPDATE otp_codes SET verified = -1 WHERE email = $1 AND type = $2 AND verified = 0",
                [email, type]
            );
        }

        // Store OTP in database
        await execute(
            `INSERT INTO otp_codes (user_id, phone, email, code_hash, type, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId || null, phone || null, email || null, otpHash, type, expiresAt]
        );

        // Send OTP via SMS (primary) and Email (backup)
        let smsSent = false;
        let emailSent = false;

        if (phone) {
            const smsResult = await sendOTPSMS(phone, otp, type);
            smsSent = smsResult.success;
        }

        if (email) {
            const emailResult = await sendOTPEmail(email, otp, type);
            emailSent = emailResult.sent || emailResult.fallback;
        }

        // Log for debugging (remove in production)
        console.log(`[OTP] Generated for ${phone || email}: ${otp} (type: ${type})`);

        res.json({
            success: true,
            message: 'Verification code sent',
            expiresIn: 300, // 5 minutes in seconds
            channels: {
                sms: smsSent,
                email: emailSent
            }
        });

    } catch (err) {
        console.error('OTP send error:', err);
        res.status(500).json({ error: 'Failed to send verification code' });
    }
});

// POST /api/otp/verify - Verify OTP code
router.post('/verify', async (req, res) => {
    try {
        const { phone, email, code, type } = req.body;

        if (!code || !type) {
            return res.status(400).json({ error: 'Code and type are required' });
        }

        if (!phone && !email) {
            return res.status(400).json({ error: 'Phone or email is required' });
        }

        const rateLimitKey = phone || email;

        // Check if user is blocked
        const blockStatus = await otpService.checkBlocked(rateLimitKey);
        if (blockStatus.blocked) {
            return res.status(429).json({
                error: 'Too many failed attempts. Please try again later.',
                waitSeconds: blockStatus.remainingSeconds
            });
        }

        // Find the latest valid OTP
        let otpRecord;
        if (phone) {
            otpRecord = await queryOne(
                `SELECT * FROM otp_codes 
                 WHERE phone = $1 AND type = $2 AND verified = 0 AND expires_at > NOW()
                 ORDER BY created_at DESC LIMIT 1`,
                [phone, type]
            );
        } else {
            otpRecord = await queryOne(
                `SELECT * FROM otp_codes 
                 WHERE email = $1 AND type = $2 AND verified = 0 AND expires_at > NOW()
                 ORDER BY created_at DESC LIMIT 1`,
                [email, type]
            );
        }

        if (!otpRecord) {
            return res.status(400).json({ error: 'Code expired or invalid. Please request a new code.' });
        }

        // Check max attempts
        if (otpRecord.attempts >= otpRecord.max_attempts) {
            // Block user for 15 minutes
            await otpService.blockUser(rateLimitKey, 900);
            await execute("UPDATE otp_codes SET verified = -1 WHERE id = $1", [otpRecord.id]);
            return res.status(429).json({
                error: 'Too many failed attempts. Please try again in 15 minutes.',
                waitSeconds: 900
            });
        }

        // Verify the code
        const isValid = await bcrypt.compare(code, otpRecord.code_hash);

        if (!isValid) {
            // Increment attempts
            await execute(
                "UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1",
                [otpRecord.id]
            );

            const remainingAttempts = otpRecord.max_attempts - otpRecord.attempts - 1;

            return res.status(400).json({
                error: 'Invalid code',
                remainingAttempts: remainingAttempts
            });
        }

        // Mark OTP as verified
        await execute("UPDATE otp_codes SET verified = 1 WHERE id = $1", [otpRecord.id]);

        // If this was a registration or phone_verify, update user verification status
        if (otpRecord.user_id && (type === 'registration' || type === 'phone_verify')) {
            await execute(
                "UPDATE users SET phone_verified = 1, is_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
                [otpRecord.user_id]
            );
        }

        if (otpRecord.user_id && type === 'email_verify') {
            await execute(
                "UPDATE users SET email_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
                [otpRecord.user_id]
            );
        }

        res.json({
            success: true,
            message: 'Code verified successfully',
            userId: otpRecord.user_id,
            referenceId: otpRecord.reference_id
        });

    } catch (err) {
        console.error('OTP verify error:', err);
        res.status(500).json({ error: 'Verification failed' });
    }
});

// POST /api/otp/resend - Resend OTP with cooldown check
router.post('/resend', async (req, res) => {
    try {
        const { phone, email, type } = req.body;

        if (!type) {
            return res.status(400).json({ error: 'OTP type is required' });
        }

        if (!phone && !email) {
            return res.status(400).json({ error: 'Phone or email is required' });
        }

        const rateLimitKey = phone || email;

        // Check cooldown
        const cooldown = await otpService.checkResendCooldown(rateLimitKey);
        if (!cooldown.allowed) {
            return res.status(429).json({
                error: 'Please wait before requesting another code',
                waitSeconds: cooldown.waitSeconds
            });
        }

        // Forward to send endpoint
        req.body.userId = req.body.userId || null;
        
        // Generate new OTP
        const otp = generateOTP();
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        // Invalidate existing OTPs
        if (phone) {
            await execute(
                "UPDATE otp_codes SET verified = -1 WHERE phone = $1 AND type = $2 AND verified = 0",
                [phone, type]
            );
        }
        if (email) {
            await execute(
                "UPDATE otp_codes SET verified = -1 WHERE email = $1 AND type = $2 AND verified = 0",
                [email, type]
            );
        }

        // Store new OTP
        await execute(
            `INSERT INTO otp_codes (user_id, phone, email, code_hash, type, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.body.userId, phone || null, email || null, otpHash, type, expiresAt]
        );

        // Send OTP
        let smsSent = false;
        let emailSent = false;

        if (phone) {
            const smsResult = await sendOTPSMS(phone, otp, type);
            smsSent = smsResult.success;
        }

        if (email) {
            const emailResult = await sendOTPEmail(email, otp, type);
            emailSent = emailResult.sent || emailResult.fallback;
        }

        console.log(`[OTP] Resent for ${phone || email}: ${otp} (type: ${type})`);

        res.json({
            success: true,
            message: 'New verification code sent',
            expiresIn: 300
        });

    } catch (err) {
        console.error('OTP resend error:', err);
        res.status(500).json({ error: 'Failed to resend code' });
    }
});

// POST /api/otp/reservation/send - Send OTP for reservation verification (requires auth)
router.post('/reservation/send', authenticateToken, async (req, res) => {
    try {
        const { bookingId } = req.body;
        const userId = req.user.id;

        if (!bookingId) {
            return res.status(400).json({ error: 'Booking ID is required' });
        }

        // Get user's phone
        const user = await queryOne('SELECT phone FROM users WHERE id = $1', [userId]);
        if (!user || !user.phone) {
            return res.status(400).json({ error: 'Phone number is required for booking verification' });
        }

        // Verify booking belongs to user and is pending verification
        const booking = await queryOne(
            "SELECT id, status FROM bookings WHERE id = $1 AND guest_id = $2",
            [bookingId, userId]
        );

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        if (booking.status !== 'pending_verification') {
            return res.status(400).json({ error: 'Booking is not pending verification' });
        }

        const phone = user.phone;
        const rateLimitKey = `reservation:${bookingId}`;

        // Check cooldown
        const cooldown = await otpService.checkResendCooldown(rateLimitKey);
        if (!cooldown.allowed) {
            return res.status(429).json({
                error: 'Please wait before requesting another code',
                waitSeconds: cooldown.waitSeconds
            });
        }

        // Generate OTP
        const otp = generateOTP();
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        // Invalidate existing OTPs for this booking
        await execute(
            "UPDATE otp_codes SET verified = -1 WHERE reference_id = $1 AND type = 'reservation' AND verified = 0",
            [bookingId]
        );

        // Store OTP with booking reference
        await execute(
            `INSERT INTO otp_codes (user_id, phone, code_hash, type, reference_id, expires_at)
             VALUES ($1, $2, $3, 'reservation', $4, $5)`,
            [userId, phone, otpHash, bookingId, expiresAt]
        );

        // Send OTP via SMS only (mandatory for reservations)
        const smsResult = await sendOTPSMS(phone, otp, 'reservation');

        console.log(`[OTP] Reservation ${bookingId} code for ${phone}: ${otp}`);

        res.json({
            success: true,
            message: 'Verification code sent to your phone',
            expiresIn: 300,
            phoneLast4: phone.slice(-4)
        });

    } catch (err) {
        console.error('Reservation OTP send error:', err);
        res.status(500).json({ error: 'Failed to send verification code' });
    }
});

// POST /api/otp/reservation/verify - Verify reservation OTP
router.post('/reservation/verify', authenticateToken, async (req, res) => {
    try {
        const { bookingId, code } = req.body;
        const userId = req.user.id;

        if (!bookingId || !code) {
            return res.status(400).json({ error: 'Booking ID and code are required' });
        }

        // Verify booking belongs to user
        const booking = await queryOne(
            "SELECT id, status FROM bookings WHERE id = $1 AND guest_id = $2",
            [bookingId, userId]
        );

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        if (booking.status !== 'pending_verification') {
            return res.status(400).json({ error: 'Booking is not pending verification' });
        }

        // Find the OTP record
        const otpRecord = await queryOne(
            `SELECT * FROM otp_codes 
             WHERE reference_id = $1 AND type = 'reservation' AND verified = 0 AND expires_at > NOW()
             ORDER BY created_at DESC LIMIT 1`,
            [bookingId]
        );

        if (!otpRecord) {
            // Auto-cancel booking if OTP expired
            await execute(
                "UPDATE bookings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
                [bookingId]
            );
            return res.status(400).json({ 
                error: 'Verification code expired. Booking has been cancelled.',
                cancelled: true
            });
        }

        // Check max attempts
        if (otpRecord.attempts >= otpRecord.max_attempts) {
            await execute("UPDATE otp_codes SET verified = -1 WHERE id = $1", [otpRecord.id]);
            await execute(
                "UPDATE bookings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
                [bookingId]
            );
            return res.status(429).json({
                error: 'Too many failed attempts. Booking has been cancelled.',
                cancelled: true
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
                error: 'Invalid code',
                remainingAttempts: remainingAttempts
            });
        }

        // Mark OTP as verified
        await execute("UPDATE otp_codes SET verified = 1 WHERE id = $1", [otpRecord.id]);

        // Update booking status to pending (awaiting partner approval)
        await execute(
            "UPDATE bookings SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
            [bookingId]
        );

        res.json({
            success: true,
            message: 'Booking verified successfully',
            bookingId: bookingId
        });

    } catch (err) {
        console.error('Reservation OTP verify error:', err);
        res.status(500).json({ error: 'Verification failed' });
    }
});

module.exports = router;
