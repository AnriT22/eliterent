let twilioClient = null;

// Initialize Twilio client
function initTwilio() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !phoneNumber) {
        console.warn('Twilio credentials not configured. SMS will be logged only.');
        return false;
    }

    try {
        const twilio = require('twilio');
        twilioClient = twilio(accountSid, authToken);
        console.log('Twilio SMS service initialized');
        return true;
    } catch (err) {
        console.error('Failed to initialize Twilio:', err.message);
        return false;
    }
}

// Send SMS via Twilio
async function sendSMS(to, message) {
    // Normalize phone number format
    let phone = to.replace(/\s+/g, '').replace(/-/g, '');
    if (!phone.startsWith('+')) {
        phone = '+' + phone;
    }

    // Log for debugging (remove in production)
    console.log(`[SMS] To: ${phone}, Message: ${message}`);

    if (!twilioClient) {
        console.log('[SMS] Twilio not configured - message logged only');
        return { success: true, simulated: true };
    }

    try {
        const result = await twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phone
        });

        console.log(`[SMS] Sent successfully. SID: ${result.sid}`);
        return { success: true, sid: result.sid };
    } catch (err) {
        console.error('[SMS] Failed to send:', err.message);
        return { success: false, error: err.message };
    }
}

// Send OTP via SMS
async function sendOTPSMS(phone, otp, type = 'verification') {
    let message;

    switch (type) {
        case 'registration':
            message = `RoyalCar.rent: Your verification code is ${otp}. Valid for 5 minutes. Do not share this code.`;
            break;
        case 'reservation':
            message = `RoyalCar.rent: Confirm your booking with code ${otp}. Valid for 5 minutes. Do not share this code.`;
            break;
        case 'login':
            message = `RoyalCar.rent: Your login code is ${otp}. Valid for 5 minutes. If you didn't request this, ignore it.`;
            break;
        default:
            message = `RoyalCar.rent: Your verification code is ${otp}. Valid for 5 minutes.`;
    }

    return sendSMS(phone, message);
}

module.exports = {
    initTwilio,
    sendSMS,
    sendOTPSMS
};
