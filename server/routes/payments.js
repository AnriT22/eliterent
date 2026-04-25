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
        var desc = 'RoyalCar.rent — ' + (vehicle ? vehicle.name : 'Vehicle') + ' booking #' + bookingId;

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

module.exports = router;
