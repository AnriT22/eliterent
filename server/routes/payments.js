const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { queryOne, execute } = require('../db-helpers');
const paypal = require('../paypal');

const router = express.Router();

// GET /api/payments/config — return PayPal client ID for frontend SDK
router.get('/config', (req, res) => {
    res.json({
        clientId: paypal.getClientId(),
        mode: paypal.getMode(),
        configured: paypal.isConfigured()
    });
});

// POST /api/payments/create-order — create PayPal order for a booking's service fee
router.post('/create-order', authenticateToken, requireRole('guest'), async (req, res) => {
    try {
        var bookingId = parseInt(req.body.booking_id);
        if (!bookingId || isNaN(bookingId)) return res.status(400).json({ error: 'booking_id required' });

        var booking = await queryOne('SELECT * FROM bookings WHERE id = $1', [bookingId]);
        if (!booking) return res.status(404).json({ error: 'Booking not found' });
        if (booking.guest_id !== req.user.id) return res.status(403).json({ error: 'Not your booking' });

        var pStatus = String(booking.payment_status || 'unpaid');
        if (pStatus === 'paid') return res.status(400).json({ error: 'Already paid' });

        var serviceFee = parseFloat(booking.service_fee) || 0;
        if (serviceFee <= 0) return res.status(400).json({ error: 'No service fee to pay' });

        if (!paypal.isConfigured()) {
            return res.status(503).json({ error: 'Payment system not configured. Contact admin.' });
        }

        var vehicle = await queryOne('SELECT name FROM vehicles WHERE id = $1', [booking.vehicle_id]);
        var desc = 'EliteAuto.rent — ' + (vehicle ? vehicle.name : 'Vehicle') + ' booking #' + bookingId;

        var order = await paypal.createOrder(bookingId, serviceFee, 'USD', desc);

        await execute('UPDATE bookings SET paypal_order_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [order.id, bookingId]);

        res.json({ orderId: order.id });
    } catch (err) {
        console.error('Create PayPal order error:', err);
        res.status(500).json({ error: 'Failed to create payment order' });
    }
});

// POST /api/payments/capture-order — capture payment after customer approves on PayPal
router.post('/capture-order', authenticateToken, requireRole('guest'), async (req, res) => {
    try {
        var orderId = req.body.order_id;
        var bookingId = parseInt(req.body.booking_id);
        if (!orderId || !bookingId || isNaN(bookingId)) return res.status(400).json({ error: 'order_id and booking_id required' });

        var booking = await queryOne('SELECT * FROM bookings WHERE id = $1', [bookingId]);
        if (!booking) return res.status(404).json({ error: 'Booking not found' });
        if (booking.guest_id !== req.user.id) return res.status(403).json({ error: 'Not your booking' });

        if (!paypal.isConfigured()) {
            return res.status(503).json({ error: 'Payment system not configured' });
        }

        var capture = await paypal.captureOrder(orderId);

        if (capture.status === 'COMPLETED') {
            var captureId = '';
            var capturedAmount = 0;
            try {
                var capData = capture.purchase_units[0].payments.captures[0];
                captureId = capData.id;
                capturedAmount = parseFloat(capData.amount.value) || 0;
            } catch (e) {}

            var expectedFee = parseFloat(booking.service_fee) || 0;
            if (Math.abs(capturedAmount - expectedFee) > 0.01) {
                console.error('PAYMENT MISMATCH: booking #' + bookingId + ' expected $' + expectedFee.toFixed(2) + ' but PayPal captured $' + capturedAmount.toFixed(2));
                return res.status(400).json({
                    error: 'Payment amount mismatch. Expected $' + expectedFee.toFixed(2) + ' but received $' + capturedAmount.toFixed(2) + '. Please contact support.',
                    status: 'MISMATCH'
                });
            }

            await execute(
                `UPDATE bookings SET
                    payment_status = 'paid',
                    paypal_order_id = $1,
                    paypal_capture_id = $2,
                    payment_date = CURRENT_TIMESTAMP,
                    deposit_paid = $3,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $4`,
                [orderId, captureId, capturedAmount, bookingId]
            );

            res.json({
                status: 'COMPLETED',
                message: 'Payment successful! Your booking service fee has been paid.',
                captureId: captureId
            });
        } else {
            res.status(400).json({
                status: capture.status,
                error: 'Payment not completed. Status: ' + capture.status
            });
        }
    } catch (err) {
        console.error('Capture PayPal order error:', err);
        res.status(500).json({ error: 'Failed to capture payment' });
    }
});

// POST /api/payments/refund — admin refunds a booking's payment
router.post('/refund', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        var bookingId = parseInt(req.body.booking_id);
        if (!bookingId || isNaN(bookingId)) return res.status(400).json({ error: 'booking_id required' });

        var booking = await queryOne('SELECT * FROM bookings WHERE id = $1', [bookingId]);
        if (!booking) return res.status(404).json({ error: 'Booking not found' });

        var pStatus = String(booking.payment_status || 'unpaid');
        if (pStatus !== 'paid') return res.status(400).json({ error: 'Booking is not paid (status: ' + pStatus + ')' });

        var captureId = booking.paypal_capture_id;
        if (!captureId) return res.status(400).json({ error: 'No PayPal capture ID found — cannot refund' });

        if (!paypal.isConfigured()) {
            return res.status(503).json({ error: 'Payment system not configured' });
        }

        var refund = await paypal.refundPayment(captureId, booking.service_fee, 'USD');

        await execute(
            `UPDATE bookings SET
                payment_status = 'refunded',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1`,
            [bookingId]
        );

        res.json({
            message: 'Refund processed successfully',
            refundId: refund.id,
            status: refund.status
        });
    } catch (err) {
        console.error('PayPal refund error:', err);
        res.status(500).json({ error: 'Failed to process refund: ' + err.message });
    }
});

// GET /api/payments/status/:bookingId — check payment status for a booking
router.get('/status/:bookingId', authenticateToken, async (req, res) => {
    try {
        var bookingId = parseInt(req.params.bookingId);
        var booking = await queryOne('SELECT id, guest_id, partner_id, service_fee, payment_status, paypal_order_id, payment_date FROM bookings WHERE id = $1', [bookingId]);
        if (!booking) return res.status(404).json({ error: 'Booking not found' });

        if (booking.guest_id != req.user.id && booking.partner_id != req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({
            booking_id: booking.id,
            service_fee: parseFloat(booking.service_fee) || 0,
            payment_status: booking.payment_status || 'unpaid',
            payment_date: booking.payment_date || null
        });
    } catch (err) {
        console.error('Payment status error:', err);
        res.status(500).json({ error: 'Failed to check payment status' });
    }
});

// ============================================================
// PARTNER SIGNUP FEE ($4.99) — auto-verifies a partner after payment
// ============================================================
var PARTNER_SIGNUP_FEE = 4.99;

// POST /api/payments/partner/create-order — create PayPal order for the $4.99 partner verification fee
router.post('/partner/create-order', authenticateToken, requireRole('partner'), async (req, res) => {
    try {
        var profile = await queryOne('SELECT * FROM partner_profiles WHERE user_id = $1', [req.user.id]);
        if (!profile) return res.status(404).json({ error: 'Partner profile not found' });
        if (profile.is_verified || profile.signup_paid) {
            return res.status(400).json({ error: 'Your account is already verified.' });
        }
        if (!paypal.isConfigured()) {
            return res.status(503).json({ error: 'Payment system not configured. Contact admin.' });
        }

        // Default to Georgia ('GE') since most partners are based there
        var countryCode = 'GE';
        if (profile.location) {
            var loc = profile.location.toLowerCase();
            if (loc.includes('georgia') || loc.includes('tbilisi') || loc.includes('batumi') || loc.includes('kutaisi')) {
                countryCode = 'GE';
            }
        }
        var order = await paypal.createOrder(req.user.id, PARTNER_SIGNUP_FEE, 'USD', 'EliteAuto.rent — Partner verification fee', countryCode);

        await execute('UPDATE partner_profiles SET signup_paypal_order_id = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
            [order.id, req.user.id]);

        res.json({ orderId: order.id });
    } catch (err) {
        console.error('Partner create-order error:', err);
        res.status(500).json({ error: 'Failed to create payment order' });
    }
});

// POST /api/payments/partner/capture-order — capture $5 and auto-verify the partner
router.post('/partner/capture-order', authenticateToken, requireRole('partner'), async (req, res) => {
    try {
        var orderId = req.body.order_id;
        if (!orderId) return res.status(400).json({ error: 'order_id required' });

        var profile = await queryOne('SELECT * FROM partner_profiles WHERE user_id = $1', [req.user.id]);
        if (!profile) return res.status(404).json({ error: 'Partner profile not found' });
        if (profile.is_verified || profile.signup_paid) {
            return res.json({ status: 'COMPLETED', message: 'Already verified' });
        }
        if (!paypal.isConfigured()) {
            return res.status(503).json({ error: 'Payment system not configured' });
        }

        var capture = await paypal.captureOrder(orderId);

        if (capture.status === 'COMPLETED') {
            var captureId = '';
            var capturedAmount = 0;
            try {
                var capData = capture.purchase_units[0].payments.captures[0];
                captureId = capData.id;
                capturedAmount = parseFloat(capData.amount.value) || 0;
            } catch (e) {}

            if (Math.abs(capturedAmount - PARTNER_SIGNUP_FEE) > 0.01) {
                console.error('PARTNER PAYMENT MISMATCH: user #' + req.user.id + ' expected $' + PARTNER_SIGNUP_FEE.toFixed(2) + ' but PayPal captured $' + capturedAmount.toFixed(2));
                return res.status(400).json({
                    error: 'Payment amount mismatch. Please contact support.',
                    status: 'MISMATCH'
                });
            }

            // Payment good — auto-verify the partner (no admin approval needed)
            await execute(
                `UPDATE partner_profiles SET
                    is_verified = 1,
                    signup_paid = 1,
                    signup_paypal_order_id = $1,
                    signup_paypal_capture_id = $2,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $3`,
                [orderId, captureId, req.user.id]
            );
            await execute('UPDATE users SET is_verified = 1, is_approved = 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [req.user.id]);

            res.json({
                status: 'COMPLETED',
                message: 'Payment successful! Your partner account is now verified.',
                captureId: captureId
            });
        } else {
            res.status(400).json({
                status: capture.status,
                error: 'Payment not completed. Status: ' + capture.status
            });
        }
    } catch (err) {
        console.error('Partner capture-order error:', err);
        res.status(500).json({ error: 'Failed to capture payment' });
    }
});

// ============================================================
// VEHICLE VIP UPGRADE ($10.00) — 30 days green glow badge
// ============================================================
var VEHICLE_VIP_FEE = 10.00;

// POST /api/payments/vehicle/:vehicleId/vip/create-order
router.post('/vehicle/:vehicleId/vip/create-order', authenticateToken, requireRole('partner'), async (req, res) => {
    try {
        var vehicleId = parseInt(req.params.vehicleId);
        if (!vehicleId || isNaN(vehicleId)) return res.status(400).json({ error: 'vehicle_id required' });

        var vehicle = await queryOne('SELECT id, partner_id, name, vip_until FROM vehicles WHERE id = $1', [vehicleId]);
        if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
        if (vehicle.partner_id !== req.user.id) return res.status(403).json({ error: 'Not your vehicle' });

        // Active VIP may be extended — buying again stacks another 30 days.

        if (!paypal.isConfigured()) {
            return res.status(503).json({ error: 'Payment system not configured. Contact admin.' });
        }

        var desc = 'EliteAuto.rent — VIP highlight for ' + (vehicle.name || 'Vehicle') + ' (30 days)';
        var order = await paypal.createOrder(vehicleId, VEHICLE_VIP_FEE, 'USD', desc, 'GE');

        res.json({ orderId: order.id });
    } catch (err) {
        console.error('Vehicle VIP create-order error:', err);
        res.status(500).json({ error: 'Failed to create VIP payment order' });
    }
});

// POST /api/payments/vehicle/:vehicleId/vip/capture-order
router.post('/vehicle/:vehicleId/vip/capture-order', authenticateToken, requireRole('partner'), async (req, res) => {
    try {
        var vehicleId = parseInt(req.params.vehicleId);
        var orderId = req.body.order_id;
        if (!vehicleId || isNaN(vehicleId)) return res.status(400).json({ error: 'vehicle_id required' });
        if (!orderId) return res.status(400).json({ error: 'order_id required' });

        var vehicle = await queryOne('SELECT id, partner_id, name, vip_until FROM vehicles WHERE id = $1', [vehicleId]);
        if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
        if (vehicle.partner_id !== req.user.id) return res.status(403).json({ error: 'Not your vehicle' });

        if (!paypal.isConfigured()) {
            return res.status(503).json({ error: 'Payment system not configured' });
        }

        var capture = await paypal.captureOrder(orderId);

        if (capture.status === 'COMPLETED') {
            var captureId = '';
            var capturedAmount = 0;
            try {
                var capData = capture.purchase_units[0].payments.captures[0];
                captureId = capData.id;
                capturedAmount = parseFloat(capData.amount.value) || 0;
            } catch (e) {}

            if (Math.abs(capturedAmount - VEHICLE_VIP_FEE) > 0.01) {
                console.error('VEHICLE VIP PAYMENT MISMATCH: vehicle #' + vehicleId + ' expected $' + VEHICLE_VIP_FEE.toFixed(2) + ' but PayPal captured $' + capturedAmount.toFixed(2));
                return res.status(400).json({ error: 'Payment amount mismatch. Please contact support.', status: 'MISMATCH' });
            }

            // Activate VIP for 30 days + apply the one-time first-VIP wallet bonus.
            var partnerRoutes = require('./partner');
            await partnerRoutes.logVipTx(vehicle.partner_id, -VEHICLE_VIP_FEE, 'spend', 'card', vehicleId, null);
            await partnerRoutes.activateVehicleVip(vehicleId, vehicle.partner_id);

            res.json({
                status: 'COMPLETED',
                message: 'VIP badge activated for 30 days!',
                captureId: captureId,
                vehicleId: vehicleId
            });
        } else {
            res.status(400).json({
                status: capture.status,
                error: 'Payment not completed. Status: ' + capture.status
            });
        }
    } catch (err) {
        console.error('Vehicle VIP capture-order error:', err);
        res.status(500).json({ error: 'Failed to capture VIP payment' });
    }
});

// ============================================================
// VIP WALLET TOP-UP — load spend-only VIP credit by card ($10 steps)
// ============================================================
var VIP_TOPUP_AMOUNTS = [10, 20, 30, 50];

// POST /api/payments/vip-wallet/topup/create-order  body: { amount }
router.post('/vip-wallet/topup/create-order', authenticateToken, requireRole('partner'), async (req, res) => {
    try {
        var amount = parseInt(req.body.amount, 10);
        if (VIP_TOPUP_AMOUNTS.indexOf(amount) === -1) {
            return res.status(400).json({ error: 'Invalid top-up amount' });
        }
        if (!paypal.isConfigured()) {
            return res.status(503).json({ error: 'Payment system not configured. Contact admin.' });
        }
        var desc = 'EliteAuto.rent — VIP wallet top-up ($' + amount + ')';
        var order = await paypal.createOrder('vipwallet-' + req.user.id, amount, 'USD', desc, 'GE');
        res.json({ orderId: order.id, amount: amount });
    } catch (err) {
        console.error('VIP wallet topup create-order error:', err);
        res.status(500).json({ error: 'Failed to create top-up order' });
    }
});

// POST /api/payments/vip-wallet/topup/capture-order  body: { order_id, amount }
router.post('/vip-wallet/topup/capture-order', authenticateToken, requireRole('partner'), async (req, res) => {
    try {
        var orderId = req.body.order_id;
        var amount = parseInt(req.body.amount, 10);
        if (!orderId) return res.status(400).json({ error: 'order_id required' });
        if (VIP_TOPUP_AMOUNTS.indexOf(amount) === -1) return res.status(400).json({ error: 'Invalid amount' });
        if (!paypal.isConfigured()) return res.status(503).json({ error: 'Payment system not configured' });

        var capture = await paypal.captureOrder(orderId);
        if (capture.status !== 'COMPLETED') {
            return res.status(400).json({ status: capture.status, error: 'Payment not completed. Status: ' + capture.status });
        }

        var capturedAmount = 0;
        try { capturedAmount = parseFloat(capture.purchase_units[0].payments.captures[0].amount.value) || 0; } catch (e) {}
        if (Math.abs(capturedAmount - amount) > 0.01) {
            console.error('VIP TOPUP MISMATCH: partner #' + req.user.id + ' expected $' + amount + ' but captured $' + capturedAmount);
            return res.status(400).json({ error: 'Payment amount mismatch. Please contact support.', status: 'MISMATCH' });
        }

        var partnerRoutes = require('./partner');
        var updated = await queryOne(
            'UPDATE partner_profiles SET vip_balance = COALESCE(vip_balance,0) + $1 WHERE user_id = $2 RETURNING vip_balance',
            [amount, req.user.id]
        );
        var newBalance = updated ? parseFloat(updated.vip_balance) || 0 : 0;
        await partnerRoutes.logVipTx(req.user.id, amount, 'topup', 'card', null, newBalance);

        res.json({ status: 'COMPLETED', message: 'Wallet topped up with $' + amount, vip_balance: newBalance });
    } catch (err) {
        console.error('VIP wallet topup capture error:', err);
        res.status(500).json({ error: 'Failed to capture top-up' });
    }
});

module.exports = router;
