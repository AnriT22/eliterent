(function () {
    var token = localStorage.getItem('token') || sessionStorage.getItem('token');
    var user = null;
    try { user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')); } catch (e) {}

    if (!token || !user || user.role !== 'guest') {
        window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
        return;
    }

    var params = new URLSearchParams(window.location.search);
    var bookingId = params.get('booking_id');
    if (!bookingId) {
        document.getElementById('payBody').innerHTML = '<div class="pay-error">No booking specified.</div>';
        return;
    }

    document.getElementById('payBookingLabel').textContent = 'Booking #' + bookingId;

    var payBody = document.getElementById('payBody');

    // 1. Load booking details and payment config
    Promise.all([
        fetch('/api/bookings/' + bookingId, { headers: { 'Authorization': 'Bearer ' + token } }).then(function (r) { return r.json(); }),
        fetch('/api/payments/config').then(function (r) { return r.json(); })
    ]).then(function (results) {
        var bookingData = results[0];
        var config = results[1];

        if (bookingData.error) {
            payBody.innerHTML = '<div class="pay-error">' + bookingData.error + '</div>';
            return;
        }
        if (!config.configured) {
            payBody.innerHTML = '<div class="pay-error">Payment system is not configured yet. Please contact support.</div>';
            return;
        }

        if (config.mode === 'sandbox') {
            var warn = document.createElement('div');
            warn.style.cssText = 'background:#fef3c7;color:#92400e;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:16px;text-align:center;border:1px solid #fcd34d;';
            warn.textContent = '⚠ SANDBOX MODE — payments are not real. Switch to live before launch.';
            payBody.parentNode.insertBefore(warn, payBody);
        }

        var booking = bookingData.booking;
        var serviceFee = parseFloat(booking.service_fee) || 0;
        var pStatus = String(booking.payment_status || 'unpaid');

        if (pStatus === 'paid') {
            payBody.innerHTML =
                '<div class="pay-already">'
                + '<div class="pay-success-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>'
                + '<h2>Already Paid</h2>'
                + '<p>The service fee for this booking has been paid on ' + (booking.payment_date || 'N/A') + '.</p>'
                + '<a href="guest-profile.html" class="pay-success-btn">Go to My Bookings</a>'
                + '</div>';
            return;
        }

        if (pStatus === 'refunded') {
            payBody.innerHTML =
                '<div class="pay-already">'
                + '<h2>Payment Refunded</h2>'
                + '<p>The service fee for this booking has been refunded.</p>'
                + '<a href="guest-profile.html" class="pay-success-btn">Go to My Bookings</a>'
                + '</div>';
            return;
        }

        if (serviceFee <= 0) {
            payBody.innerHTML = '<div class="pay-error">No service fee required for this booking.</div>';
            return;
        }

        var totalPrice = parseFloat(booking.total_price) || 0;
        var extrasTotal = parseFloat(booking.extras_total) || 0;
        var locationFee = parseFloat(booking.location_fee) || 0;
        var rentalTotal = totalPrice - extrasTotal - locationFee;
        var pickup = booking.pickup_date || '';
        var dropoff = booking.dropoff_date || '';
        var days = parseInt(booking.rental_days) || 1;

        // Render payment summary
        payBody.innerHTML =
            '<div class="pay-summary">'
            + '<div class="pay-row"><span class="pay-row-label">' + (booking.vehicle_name || 'Vehicle') + '</span><span class="pay-row-value">' + days + ' day' + (days !== 1 ? 's' : '') + '</span></div>'
            + '<div class="pay-row"><span class="pay-row-label">Dates</span><span class="pay-row-value">' + pickup + ' → ' + dropoff + '</span></div>'
            + '<div class="pay-divider"></div>'
            + '<div class="pay-row"><span class="pay-row-label">Car rental (' + days + ' days)</span><span class="pay-row-value">$' + rentalTotal.toFixed(2) + '</span></div>'
            + (extrasTotal > 0 ? '<div class="pay-row"><span class="pay-row-label">Extras & services</span><span class="pay-row-value">$' + extrasTotal.toFixed(2) + '</span></div>' : '')
            + (locationFee > 0 ? '<div class="pay-row"><span class="pay-row-label">Location fees</span><span class="pay-row-value">$' + locationFee.toFixed(2) + '</span></div>' : '')
            + '<div class="pay-row"><span class="pay-row-label">Pay at pickup</span><span class="pay-row-value">$' + totalPrice.toFixed(2) + '</span></div>'
            + '<div class="pay-divider"></div>'
            + '<div class="pay-row pay-total"><span class="pay-row-label">Website fee (pay now)</span><span class="pay-row-value">$' + serviceFee.toFixed(2) + '</span></div>'
            + '</div>'
            + '<div class="pay-security">'
            + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#166534" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
            + 'Your payment is secured by PayPal. We never store your card details.'
            + '</div>'
            + '<div id="paypal-button-container"></div>';

        // Load PayPal JS SDK dynamically
        var sdkUrl = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(config.clientId) + '&currency=USD&intent=capture';
        var script = document.createElement('script');
        script.src = sdkUrl;
        script.setAttribute('data-csp-nonce', '');
        script.onload = function () {
            renderPayPalButtons(bookingId, serviceFee);
        };
        script.onerror = function () {
            document.getElementById('paypal-button-container').innerHTML =
                '<div class="pay-error">Failed to load PayPal. Please refresh and try again.</div>';
        };
        document.head.appendChild(script);
    }).catch(function () {
        payBody.innerHTML = '<div class="pay-error">Failed to load booking details. Please try again.</div>';
    });

    function renderPayPalButtons(bookingId, serviceFee) {
        if (!window.paypal) {
            document.getElementById('paypal-button-container').innerHTML =
                '<div class="pay-error">PayPal SDK not loaded. Please refresh.</div>';
            return;
        }

        window.paypal.Buttons({
            style: {
                layout: 'vertical',
                color: 'blue',
                shape: 'rect',
                label: 'pay',
                height: 45
            },

            createOrder: function () {
                return fetch('/api/payments/create-order', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ booking_id: bookingId })
                })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.error) throw new Error(data.error);
                    return data.orderId;
                });
            },

            onApprove: function (data) {
                // Customer approved the payment on PayPal — capture it
                var container = document.getElementById('paypal-button-container');
                container.innerHTML = '<div class="pay-loading">Processing payment...</div>';

                return fetch('/api/payments/capture-order', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        order_id: data.orderID,
                        booking_id: bookingId
                    })
                })
                .then(function (r) { return r.json(); })
                .then(function (result) {
                    if (result.status === 'COMPLETED') {
                        payBody.innerHTML =
                            '<div class="pay-success">'
                            + '<div class="pay-success-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>'
                            + '<h2>Payment Successful!</h2>'
                            + '<p>Service fee of $' + serviceFee.toFixed(2) + ' has been paid.<br>Your booking is now confirmed and awaiting admin approval.</p>'
                            + '<a href="guest-profile.html" class="pay-success-btn">View My Bookings</a>'
                            + '</div>';
                    } else {
                        container.innerHTML = '<div class="pay-error">Payment issue: ' + (result.error || result.status) + '</div>';
                    }
                })
                .catch(function (err) {
                    container.innerHTML = '<div class="pay-error">Payment failed: ' + err.message + '</div>';
                });
            },

            onCancel: function () {
                // Customer closed PayPal popup without paying
                var container = document.getElementById('paypal-button-container');
                container.innerHTML =
                    '<div style="text-align:center;padding:16px;color:#f59e0b;font-size:14px;font-weight:600;">'
                    + 'Payment cancelled. You can try again below.'
                    + '</div>';
                setTimeout(function () {
                    container.innerHTML = '';
                    renderPayPalButtons(bookingId, serviceFee);
                }, 2000);
            },

            onError: function (err) {
                console.error('PayPal error:', err);
                document.getElementById('paypal-button-container').innerHTML =
                    '<div class="pay-error">Payment error. Please try again or contact support.</div>';
            }

        }).render('#paypal-button-container');
    }
})();
