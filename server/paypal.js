// PayPal REST API helper — no SDK, direct HTTP calls
// Your server NEVER sees card numbers. PayPal handles all payment data securely.

const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';

const BASE_URL = PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

let cachedToken = null;
let tokenExpiry = 0;

// Get OAuth2 access token from PayPal
async function getAccessToken() {
    if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

    const auth = Buffer.from(PAYPAL_CLIENT_ID + ':' + PAYPAL_CLIENT_SECRET).toString('base64');

    const res = await fetch(BASE_URL + '/v1/oauth2/token', {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + auth,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });

    if (!res.ok) {
        var errText = await res.text();
        throw new Error('PayPal auth failed: ' + res.status + ' ' + errText);
    }

    var data = await res.json();
    cachedToken = data.access_token;
    // Cache token for slightly less than its lifetime
    tokenExpiry = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
    return cachedToken;
}

// Create a PayPal order for the website service fee
async function createOrder(bookingId, amount, currency, description) {
    var token = await getAccessToken();

    var res = await fetch(BASE_URL + '/v2/checkout/orders', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [{
                reference_id: 'BOOKING-' + bookingId,
                description: description || 'EliteAuto.rent — Booking #' + bookingId + ' Service Fee',
                amount: {
                    currency_code: currency || 'USD',
                    value: parseFloat(amount).toFixed(2)
                }
            }],
            application_context: {
                shipping_preference: 'NO_SHIPPING'
            }
        })
    });

    if (!res.ok) {
        var errText = await res.text();
        throw new Error('PayPal create order failed: ' + res.status + ' ' + errText);
    }

    return await res.json();
}

// Capture payment after customer approves
async function captureOrder(orderId) {
    var token = await getAccessToken();

    var res = await fetch(BASE_URL + '/v2/checkout/orders/' + orderId + '/capture', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    });

    if (!res.ok) {
        var errText = await res.text();
        throw new Error('PayPal capture failed: ' + res.status + ' ' + errText);
    }

    return await res.json();
}

// Refund a captured payment
async function refundPayment(captureId, amount, currency) {
    var token = await getAccessToken();

    var body = {};
    if (amount) {
        body.amount = {
            value: parseFloat(amount).toFixed(2),
            currency_code: currency || 'USD'
        };
    }

    var res = await fetch(BASE_URL + '/v2/payments/captures/' + captureId + '/refund', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        var errText = await res.text();
        throw new Error('PayPal refund failed: ' + res.status + ' ' + errText);
    }

    return await res.json();
}

// Get order details
async function getOrder(orderId) {
    var token = await getAccessToken();

    var res = await fetch(BASE_URL + '/v2/checkout/orders/' + orderId, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    });

    if (!res.ok) {
        var errText = await res.text();
        throw new Error('PayPal get order failed: ' + res.status + ' ' + errText);
    }

    return await res.json();
}

function isConfigured() {
    return PAYPAL_CLIENT_ID && PAYPAL_CLIENT_ID !== 'YOUR_PAYPAL_CLIENT_ID_HERE'
        && PAYPAL_CLIENT_SECRET && PAYPAL_CLIENT_SECRET !== 'YOUR_PAYPAL_CLIENT_SECRET_HERE';
}

function getClientId() {
    return PAYPAL_CLIENT_ID;
}

function getMode() {
    return PAYPAL_MODE;
}

module.exports = {
    createOrder,
    captureOrder,
    refundPayment,
    getOrder,
    isConfigured,
    getClientId,
    getMode
};
