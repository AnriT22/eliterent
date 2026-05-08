let twilioClient = null;
let twilioVerifyServiceSid = null;
let smsReady = false;

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function normalizePhoneNumber(value) {
  let phone = String(value || "")
    .replace(/\s+/g, "")
    .replace(/-/g, "");
  if (phone && !phone.startsWith("+")) {
    phone = "+" + phone;
  }
  return phone;
}

function maskPhoneNumber(phone) {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return "unknown";
  if (normalized.length <= 4) return normalized;
  return `${"*".repeat(Math.max(normalized.length - 4, 0))}${normalized.slice(-4)}`;
}

// ========================================
// INIT — Twilio client + Verify service
// ========================================
function initSMS() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER || null;
  twilioVerifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID || null;

  if (!accountSid || !authToken) {
    console.warn("[SMS] Twilio not configured (missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN).");
    if (!isProduction()) {
      console.warn("[SMS] SMS delivery will be simulated in development.");
    }
    return false;
  }

  if (!phoneNumber && !twilioVerifyServiceSid) {
    console.warn("[SMS] Twilio configured but no TWILIO_PHONE_NUMBER or TWILIO_VERIFY_SERVICE_SID set. Only Verify or direct SMS will work if the other is set.");
  }

  try {
    const twilio = require("twilio");
    twilioClient = twilio(accountSid, authToken);
    smsReady = true;
    if (phoneNumber) {
      console.log(`[SMS] Twilio initialized from ${maskPhoneNumber(phoneNumber)}`);
    } else {
      console.log(`[SMS] Twilio initialized (Verify-only mode, no phone number for direct SMS)`);
    }
    if (twilioVerifyServiceSid) {
      console.log(`[SMS] Twilio Verify service: ${twilioVerifyServiceSid}`);
    }
    return true;
  } catch (err) {
    console.error("[SMS] Failed to initialize Twilio:", err.message);
    twilioClient = null;
    return false;
  }
}

// ========================================
// SEND SMS (direct message)
// ========================================
async function sendSMS(to, message) {
  const phone = normalizePhoneNumber(to);
  if (!phone) {
    return { success: false, error: "Invalid destination phone number" };
  }

  if (!twilioClient) {
    if (isProduction()) {
      console.error(`[SMS] Cannot send to ${maskPhoneNumber(phone)}: Twilio not configured`);
      return { success: false, error: "SMS service is not configured" };
    }
    console.log(`[SMS] Simulated delivery to ${maskPhoneNumber(phone)} (Twilio not configured)`);
    return { success: true, simulated: true };
  }

  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });
    console.log(`[SMS] Sent to ${maskPhoneNumber(phone)}. SID: ${result.sid}`);
    return { success: true, sid: result.sid, provider: "twilio" };
  } catch (err) {
    console.error(`[SMS] Failed to send to ${maskPhoneNumber(phone)}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ========================================
// SEND OTP via direct SMS (legacy fallback)
// ========================================
async function sendOTPSMS(phone, otp, type = "verification") {
  let message;
  switch (type) {
    case "registration":
      message = `EliteAuto.rent: Your verification code is ${otp}. Valid for 5 minutes. Do not share this code.`;
      break;
    case "reservation":
      message = `EliteAuto.rent: Confirm your booking with code ${otp}. Valid for 5 minutes. Do not share this code.`;
      break;
    case "login":
      message = `EliteAuto.rent: Your login code is ${otp}. Valid for 5 minutes. If you didn't request this, ignore it.`;
      break;
    default:
      message = `EliteAuto.rent: Your verification code is ${otp}. Valid for 5 minutes.`;
  }
  return sendSMS(phone, message);
}

// ========================================
// TWILIO VERIFY API — managed OTP service
// Twilio generates, sends, and checks the code for you.
// Requires TWILIO_VERIFY_SERVICE_SID in .env
// ========================================

async function startVerify(phone) {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) {
    return { success: false, error: "Invalid phone number" };
  }

  if (!twilioClient || !twilioVerifyServiceSid) {
    console.error("[Verify] Twilio Verify not available (missing client or TWILIO_VERIFY_SERVICE_SID)");
    return { success: false, error: "Verify service not available" };
  }

  try {
    const verification = await twilioClient.verify.v2
      .services(twilioVerifyServiceSid)
      .verifications.create({ to: normalized, channel: "sms" });

    console.log(`[Verify] Sent to ${maskPhoneNumber(normalized)}. SID: ${verification.sid}, status: ${verification.status}`);
    return { success: true, requestId: verification.sid };
  } catch (err) {
    console.error(`[Verify] Failed for ${maskPhoneNumber(normalized)}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function checkVerify(phone, code) {
  const normalized = normalizePhoneNumber(phone);
  if (!twilioClient || !twilioVerifyServiceSid) {
    return { success: false, error: "Verify service not available" };
  }

  try {
    const check = await twilioClient.verify.v2
      .services(twilioVerifyServiceSid)
      .verificationChecks.create({ to: normalized, code: code });

    if (check.status === "approved") {
      console.log(`[Verify] Code approved for ${maskPhoneNumber(normalized)}`);
      return { success: true, status: "approved" };
    }

    console.warn(`[Verify] Check failed for ${maskPhoneNumber(normalized)}: status=${check.status}`);
    return { success: false, error: "Invalid code" };
  } catch (err) {
    console.error(`[Verify] Check error for ${maskPhoneNumber(normalized)}: ${err.message}`);
    return { success: false, error: err.message || "Verification failed" };
  }
}

async function cancelVerify(phone) {
  // Twilio Verify doesn't require explicit cancellation — verifications auto-expire.
  // This is a no-op kept for backward compatibility.
}

module.exports = {
  initSMS,
  sendSMS,
  sendOTPSMS,
  startVerify,
  checkVerify,
  cancelVerify,
  normalizePhoneNumber,
};
