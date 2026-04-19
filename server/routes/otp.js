const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { authenticateToken } = require("../middleware/auth");
const { queryOne, execute } = require("../db-helpers");
const { sendOTPEmail } = require("../mailer");
const { sendOTPSMS, startVerify, checkVerify, cancelVerify } = require("../services/sms");
const otpService = require("../services/otp");

const router = express.Router();

// Generate 6-digit OTP (cryptographically secure)
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

function getDeliveryErrorMessage(phone, email) {
  if (phone && !email) return "Failed to send SMS verification code";
  if (email && !phone) return "Failed to send email verification code";
  return "Failed to send verification code";
}

async function invalidateOtpRecord(id) {
  if (!id) return;
  await execute("UPDATE otp_codes SET verified = -1 WHERE id = $1", [id]);
}

async function insertOtpRecord({
  userId,
  phone,
  email,
  otpHash,
  type,
  expiresAt,
  referenceId = null,
}) {
  const result = await execute(
    `INSERT INTO otp_codes (user_id, phone, email, code_hash, type, reference_id, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
    [
      userId || null,
      phone || null,
      email || null,
      otpHash,
      type,
      referenceId,
      expiresAt,
    ],
  );

  return result.rows && result.rows[0] ? result.rows[0].id : null;
}

async function deliverOtp({ phone, email, otp, type }) {
  let smsSent = false;
  let emailSent = false;

  if (phone) {
    const smsResult = await sendOTPSMS(phone, otp, type);
    smsSent = Boolean(smsResult && smsResult.success);
  }

  if (email) {
    const emailResult = await sendOTPEmail(email, otp, type);
    emailSent = Boolean(
      emailResult && (emailResult.sent || emailResult.fallback),
    );
  }

  return {
    smsSent,
    emailSent,
    delivered: smsSent || emailSent,
  };
}

// POST /api/otp/send - Send OTP for various purposes
router.post("/send", async (req, res) => {
  try {
    const { phone, email, type, userId } = req.body;

    if (!type) {
      return res.status(400).json({ error: "OTP type is required" });
    }

    if (!phone && !email) {
      return res.status(400).json({ error: "Phone or email is required" });
    }

    const validTypes = [
      "registration",
      "reservation",
      "login",
      "phone_verify",
      "email_verify",
    ];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: "Invalid OTP type" });
    }

    const rateLimitKey = phone || email;

    const blockStatus = await otpService.checkBlocked(rateLimitKey);
    if (blockStatus.blocked) {
      return res.status(429).json({
        error: "Too many attempts. Please try again later.",
        waitSeconds: blockStatus.remainingSeconds,
      });
    }

    const allowed = await otpService.checkRateLimit(rateLimitKey, 5, 60);
    if (!allowed) {
      return res.status(429).json({
        error: "Too many requests. Please wait before requesting another code.",
      });
    }

    const cooldown = await otpService.checkResendCooldown(rateLimitKey);
    if (!cooldown.allowed) {
      return res.status(429).json({
        error: "Please wait before requesting another code",
        waitSeconds: cooldown.waitSeconds,
      });
    }

    if (email && otpService.isDisposableEmail(email)) {
      return res
        .status(400)
        .json({ error: "Disposable email addresses are not allowed" });
    }

    const otp = generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    if (phone) {
      await execute(
        "UPDATE otp_codes SET verified = -1 WHERE phone = $1 AND type = $2 AND verified = 0",
        [phone, type],
      );
    }
    if (email) {
      await execute(
        "UPDATE otp_codes SET verified = -1 WHERE email = $1 AND type = $2 AND verified = 0",
        [email, type],
      );
    }

    const otpRecordId = await insertOtpRecord({
      userId,
      phone,
      email,
      otpHash,
      type,
      expiresAt,
    });

    const delivery = await deliverOtp({ phone, email, otp, type });

    if (!delivery.delivered) {
      await invalidateOtpRecord(otpRecordId);
      return res.status(502).json({
        error: getDeliveryErrorMessage(phone, email),
        channels: {
          sms: delivery.smsSent,
          email: delivery.emailSent,
        },
      });
    }

    res.json({
      success: true,
      message: "Verification code sent",
      expiresIn: 300,
      channels: {
        sms: delivery.smsSent,
        email: delivery.emailSent,
      },
    });
  } catch (err) {
    console.error("OTP send error:", err);
    res.status(500).json({ error: "Failed to send verification code" });
  }
});

// POST /api/otp/verify - Verify OTP code
router.post("/verify", async (req, res) => {
  try {
    const { phone, email, code, type } = req.body;

    if (!code || !type) {
      return res.status(400).json({ error: "Code and type are required" });
    }

    if (!phone && !email) {
      return res.status(400).json({ error: "Phone or email is required" });
    }

    const rateLimitKey = phone || email;

    const blockStatus = await otpService.checkBlocked(rateLimitKey);
    if (blockStatus.blocked) {
      return res.status(429).json({
        error: "Too many failed attempts. Please try again later.",
        waitSeconds: blockStatus.remainingSeconds,
      });
    }

    let otpRecord;
    if (phone) {
      otpRecord = await queryOne(
        `SELECT * FROM otp_codes
                 WHERE phone = $1 AND type = $2 AND verified = 0 AND expires_at > NOW()
                 ORDER BY created_at DESC LIMIT 1`,
        [phone, type],
      );
    } else {
      otpRecord = await queryOne(
        `SELECT * FROM otp_codes
                 WHERE email = $1 AND type = $2 AND verified = 0 AND expires_at > NOW()
                 ORDER BY created_at DESC LIMIT 1`,
        [email, type],
      );
    }

    if (!otpRecord) {
      return res
        .status(400)
        .json({ error: "Code expired or invalid. Please request a new code." });
    }

    if (otpRecord.attempts >= otpRecord.max_attempts) {
      await otpService.blockUser(rateLimitKey, 900);
      await execute("UPDATE otp_codes SET verified = -1 WHERE id = $1", [
        otpRecord.id,
      ]);
      return res.status(429).json({
        error: "Too many failed attempts. Please try again in 15 minutes.",
        waitSeconds: 900,
      });
    }

    const isValid = await bcrypt.compare(code, otpRecord.code_hash);

    if (!isValid) {
      await execute(
        "UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1",
        [otpRecord.id],
      );

      const remainingAttempts = otpRecord.max_attempts - otpRecord.attempts - 1;

      return res.status(400).json({
        error: "Invalid code",
        remainingAttempts: remainingAttempts,
      });
    }

    await execute("UPDATE otp_codes SET verified = 1 WHERE id = $1", [
      otpRecord.id,
    ]);

    if (
      otpRecord.user_id &&
      (type === "registration" || type === "phone_verify")
    ) {
      await execute(
        "UPDATE users SET phone_verified = 1, is_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [otpRecord.user_id],
      );
    }

    if (otpRecord.user_id && type === "email_verify") {
      await execute(
        "UPDATE users SET email_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [otpRecord.user_id],
      );
    }

    res.json({
      success: true,
      message: "Code verified successfully",
      userId: otpRecord.user_id,
      referenceId: otpRecord.reference_id,
    });
  } catch (err) {
    console.error("OTP verify error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

// POST /api/otp/resend - Resend OTP with cooldown check
router.post("/resend", async (req, res) => {
  try {
    const { phone, email, type } = req.body;

    if (!type) {
      return res.status(400).json({ error: "OTP type is required" });
    }

    if (!phone && !email) {
      return res.status(400).json({ error: "Phone or email is required" });
    }

    const rateLimitKey = phone || email;

    const cooldown = await otpService.checkResendCooldown(rateLimitKey);
    if (!cooldown.allowed) {
      return res.status(429).json({
        error: "Please wait before requesting another code",
        waitSeconds: cooldown.waitSeconds,
      });
    }

    const otp = generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    if (phone) {
      await execute(
        "UPDATE otp_codes SET verified = -1 WHERE phone = $1 AND type = $2 AND verified = 0",
        [phone, type],
      );
    }
    if (email) {
      await execute(
        "UPDATE otp_codes SET verified = -1 WHERE email = $1 AND type = $2 AND verified = 0",
        [email, type],
      );
    }

    const otpRecordId = await insertOtpRecord({
      userId: req.body.userId || null,
      phone,
      email,
      otpHash,
      type,
      expiresAt,
    });

    const delivery = await deliverOtp({ phone, email, otp, type });

    if (!delivery.delivered) {
      await invalidateOtpRecord(otpRecordId);
      return res.status(502).json({
        error: getDeliveryErrorMessage(phone, email),
        channels: {
          sms: delivery.smsSent,
          email: delivery.emailSent,
        },
      });
    }

    res.json({
      success: true,
      message: "New verification code sent",
      expiresIn: 300,
      channels: {
        sms: delivery.smsSent,
        email: delivery.emailSent,
      },
    });
  } catch (err) {
    console.error("OTP resend error:", err);
    res.status(500).json({ error: "Failed to resend code" });
  }
});

// POST /api/otp/reservation/send - Send OTP for reservation verification (requires auth)
router.post("/reservation/send", authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.body;
    const userId = req.user.id;

    if (!bookingId) {
      return res.status(400).json({ error: "Booking ID is required" });
    }

    const user = await queryOne("SELECT phone FROM users WHERE id = $1", [
      userId,
    ]);
    if (!user || !user.phone) {
      return res
        .status(400)
        .json({ error: "Phone number is required for booking verification" });
    }

    const booking = await queryOne(
      "SELECT id, status FROM bookings WHERE id = $1 AND guest_id = $2",
      [bookingId, userId],
    );

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.status !== "pending_verification") {
      return res
        .status(400)
        .json({ error: "Booking is not pending verification" });
    }

    const phone = user.phone;
    const rateLimitKey = `reservation:${bookingId}`;

    const cooldown = await otpService.checkResendCooldown(rateLimitKey);
    if (!cooldown.allowed) {
      return res.status(429).json({
        error: "Please wait before requesting another code",
        waitSeconds: cooldown.waitSeconds,
      });
    }

    const otp = generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await execute(
      "UPDATE otp_codes SET verified = -1 WHERE reference_id = $1 AND type = 'reservation' AND verified = 0",
      [bookingId],
    );

    const otpRecordId = await insertOtpRecord({
      userId,
      phone,
      email: null,
      otpHash,
      type: "reservation",
      expiresAt,
      referenceId: bookingId,
    });

    const smsResult = await sendOTPSMS(phone, otp, "reservation");
    const smsSent = Boolean(smsResult && smsResult.success);

    if (!smsSent) {
      await invalidateOtpRecord(otpRecordId);
      return res.status(502).json({
        error: "Failed to send SMS verification code",
        channels: {
          sms: false,
          email: false,
        },
      });
    }

    res.json({
      success: true,
      message: "Verification code sent to your phone",
      expiresIn: 300,
      phoneLast4: phone.slice(-4),
      channels: {
        sms: true,
        email: false,
      },
    });
  } catch (err) {
    console.error("Reservation OTP send error:", err);
    res.status(500).json({ error: "Failed to send verification code" });
  }
});

// POST /api/otp/reservation/verify - Verify reservation OTP
router.post("/reservation/verify", authenticateToken, async (req, res) => {
  try {
    const { bookingId, code } = req.body;
    const userId = req.user.id;

    if (!bookingId || !code) {
      return res
        .status(400)
        .json({ error: "Booking ID and code are required" });
    }

    const booking = await queryOne(
      "SELECT id, status FROM bookings WHERE id = $1 AND guest_id = $2",
      [bookingId, userId],
    );

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.status !== "pending_verification") {
      return res
        .status(400)
        .json({ error: "Booking is not pending verification" });
    }

    const otpRecord = await queryOne(
      `SELECT * FROM otp_codes
             WHERE reference_id = $1 AND type = 'reservation' AND verified = 0 AND expires_at > NOW()
             ORDER BY created_at DESC LIMIT 1`,
      [bookingId],
    );

    if (!otpRecord) {
      await execute(
        "UPDATE bookings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [bookingId],
      );
      return res.status(400).json({
        error: "Verification code expired. Booking has been cancelled.",
        cancelled: true,
      });
    }

    if (otpRecord.attempts >= otpRecord.max_attempts) {
      await execute("UPDATE otp_codes SET verified = -1 WHERE id = $1", [
        otpRecord.id,
      ]);
      await execute(
        "UPDATE bookings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [bookingId],
      );
      return res.status(429).json({
        error: "Too many failed attempts. Booking has been cancelled.",
        cancelled: true,
      });
    }

    const isValid = await bcrypt.compare(code, otpRecord.code_hash);

    if (!isValid) {
      await execute(
        "UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1",
        [otpRecord.id],
      );

      const remainingAttempts = otpRecord.max_attempts - otpRecord.attempts - 1;

      return res.status(400).json({
        error: "Invalid code",
        remainingAttempts: remainingAttempts,
      });
    }

    await execute("UPDATE otp_codes SET verified = 1 WHERE id = $1", [
      otpRecord.id,
    ]);

    await execute(
      "UPDATE bookings SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [bookingId],
    );

    res.json({
      success: true,
      message: "Booking verified successfully",
      bookingId: bookingId,
    });
  } catch (err) {
    console.error("Reservation OTP verify error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

// POST /api/otp/phone-verify/send - Save phone number for Google user and send verification OTP
router.post("/phone-verify/send", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { phone } = req.body;

    if (!phone || phone.trim().length < 8) {
      return res.status(400).json({ error: "Valid phone number is required" });
    }

    const cleanPhone = phone.trim().replace(/[^+\d]/g, "");
    if (!/^\+?\d{8,15}$/.test(cleanPhone)) {
      return res.status(400).json({ error: "Invalid phone number format. Use international format: +995XXXXXXXXX" });
    }

    // Check if this phone is already used by another user
    const existingUser = await queryOne(
      "SELECT id FROM users WHERE phone = $1 AND id != $2",
      [cleanPhone, userId]
    );
    if (existingUser) {
      return res.status(400).json({ error: "This phone number is already registered to another account" });
    }

    // Save phone number to user (but don't mark as verified yet)
    await execute(
      "UPDATE users SET phone = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [cleanPhone, userId]
    );

    // Rate limit check
    const rateLimitKey = `phone_verify:${cleanPhone}`;
    const cooldown = await otpService.checkResendCooldown(rateLimitKey);
    if (!cooldown.allowed) {
      return res.status(429).json({
        error: "Please wait before requesting another code",
        waitSeconds: cooldown.waitSeconds,
      });
    }

    // Invalidate old OTPs
    await execute(
      "UPDATE otp_codes SET verified = -1 WHERE user_id = $1 AND type = 'phone_verify' AND verified = 0",
      [userId]
    );

    // Try Twilio Verify API first (managed OTP — Twilio generates & sends the code)
    const verifyResult = await startVerify(cleanPhone);

    if (verifyResult.success) {
      await execute(
        `INSERT INTO otp_codes (user_id, phone, code_hash, type, expires_at, reference_id)
         VALUES ($1, $2, $3, 'phone_verify', $4, $5)`,
        [userId, cleanPhone, 'twilio_verify', new Date(Date.now() + 10 * 60 * 1000), verifyResult.requestId]
      );

      return res.json({
        success: true,
        message: "Verification code sent to " + cleanPhone.substring(0, 4) + "****" + cleanPhone.slice(-2),
        channel: "sms",
        expiresIn: 600,
      });
    }

    // Fallback to direct SMS if Twilio Verify is not configured
    console.warn('[Phone Verify] Twilio Verify failed, falling back to direct SMS:', verifyResult.error);
    const otp = generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await insertOtpRecord({
      userId,
      phone: cleanPhone,
      email: null,
      otpHash,
      type: "phone_verify",
      expiresAt,
    });

    const smsResult = await sendOTPSMS(cleanPhone, otp, "phone_verify");
    const smsSent = Boolean(smsResult && smsResult.success);

    if (!smsSent) {
      return res.status(502).json({ error: "Failed to send verification code. Please try again." });
    }

    res.json({
      success: true,
      message: "Verification code sent to " + cleanPhone.substring(0, 4) + "****" + cleanPhone.slice(-2),
      channel: "sms",
      expiresIn: 300,
    });
  } catch (err) {
    console.error("Phone verify send error:", err);
    res.status(500).json({ error: "Failed to send verification code" });
  }
});

// POST /api/otp/phone-verify/verify - Verify phone OTP for Google user
router.post("/phone-verify/verify", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code || code.length !== 6) {
      return res.status(400).json({ error: "6-digit verification code is required" });
    }

    const user = await queryOne("SELECT phone FROM users WHERE id = $1", [userId]);
    if (!user || !user.phone) {
      return res.status(400).json({ error: "No phone number on file. Please enter your phone number first." });
    }

    const rateLimitKey = `phone_verify:${user.phone}`;
    const blockStatus = await otpService.checkBlocked(rateLimitKey);
    if (blockStatus.blocked) {
      return res.status(429).json({
        error: "Too many failed attempts. Please try again later.",
        waitSeconds: blockStatus.remainingSeconds,
      });
    }

    const otpRecord = await queryOne(
      `SELECT * FROM otp_codes
       WHERE user_id = $1 AND type = 'phone_verify' AND verified = 0 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (!otpRecord) {
      return res.status(400).json({ error: "Code expired or invalid. Please request a new code." });
    }

    // Twilio Verify API flow — check by phone number
    if (otpRecord.code_hash === 'twilio_verify') {
      const verifyCheck = await checkVerify(user.phone, code);
      if (!verifyCheck.success) {
        await execute("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1", [otpRecord.id]);
        const remainingAttempts = otpRecord.max_attempts - otpRecord.attempts - 1;
        return res.status(400).json({ error: "Invalid code", remainingAttempts: Math.max(remainingAttempts, 0) });
      }
      await execute("UPDATE otp_codes SET verified = 1 WHERE id = $1", [otpRecord.id]);
    } else {
      // Legacy flow: bcrypt compare
      if (otpRecord.attempts >= otpRecord.max_attempts) {
        await otpService.blockUser(rateLimitKey, 900);
        await execute("UPDATE otp_codes SET verified = -1 WHERE id = $1", [otpRecord.id]);
        return res.status(429).json({
          error: "Too many failed attempts. Please try again in 15 minutes.",
          waitSeconds: 900,
        });
      }

      const isValid = await bcrypt.compare(code, otpRecord.code_hash);
      if (!isValid) {
        await execute("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1", [otpRecord.id]);
        const remainingAttempts = otpRecord.max_attempts - otpRecord.attempts - 1;
        return res.status(400).json({ error: "Invalid code", remainingAttempts });
      }

      await execute("UPDATE otp_codes SET verified = 1 WHERE id = $1", [otpRecord.id]);
    }

    // Update user as phone verified
    await execute(
      "UPDATE users SET phone_verified = 1, is_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [userId]
    );

    res.json({
      success: true,
      message: "Phone number verified successfully",
    });
  } catch (err) {
    console.error("Phone verify error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

// POST /api/otp/phone-verify/skip - Skip phone verification (allow user to do it later)
router.post("/phone-verify/skip", authenticateToken, async (req, res) => {
  res.json({ success: true, message: "Phone verification skipped. You can verify later in your profile settings." });
});

module.exports = router;
