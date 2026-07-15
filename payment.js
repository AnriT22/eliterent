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

    // Conversion tracking: the website fee was PAID — this is real revenue and the
    // conversion ad platforms should optimise toward. Fires once per successful pay.
    var _purchaseTracked = false;
    function trackPurchase(bId, fee) {
        if (_purchaseTracked) return;
        _purchaseTracked = true;
        try {
            if (typeof gtag === 'function') {
                gtag('event', 'purchase', {
                    transaction_id: 'booking-' + bId,
                    currency: 'USD',
                    value: parseFloat(fee) || 0
                });
            }
        } catch (e) {}
    }

    var payBody = document.getElementById('payBody');

    // Session expired mid-payment → re-login and return to this payment page.
    function handleSessionExpired() {
        try { localStorage.removeItem('token'); sessionStorage.removeItem('token'); } catch (e) {}
        alert((typeof I18n !== 'undefined' && I18n.t && I18n.t('errors.session_expired') !== 'errors.session_expired') ? I18n.t('errors.session_expired') : 'Your session has expired. Please sign in again to complete your payment.');
        window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
    }

    // 1. Load booking details and payment config
    Promise.all([
        fetch('/api/bookings/' + bookingId, { headers: { 'Authorization': 'Bearer ' + token } }).then(function (r) { return r.json().then(function (d) { d.__status = r.status; return d; }, function () { return { __status: r.status }; }); }),
        fetch('/api/payments/config').then(function (r) { return r.json(); })
    ]).then(function (results) {
        var bookingData = results[0];
        var config = results[1];

        if (bookingData.__status === 401 || bookingData.__status === 403) { handleSessionExpired(); return; }
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
                + '<p>Your reservation payment for this booking was received on ' + (booking.payment_date || 'N/A') + '.</p>'
                + '<a href="guest-profile.html" class="pay-success-btn">Go to My Bookings</a>'
                + '</div>';
            return;
        }

        if (pStatus === 'refunded') {
            payBody.innerHTML =
                '<div class="pay-already">'
                + '<h2>Payment Refunded</h2>'
                + '<p>Your reservation payment for this booking has been refunded.</p>'
                + '<a href="guest-profile.html" class="pay-success-btn">Go to My Bookings</a>'
                + '</div>';
            return;
        }

        // Check if booking is cancelled (expired timer)
        if (String(booking.status) === 'cancelled') {
            payBody.innerHTML =
                '<div class="pay-error" style="text-align:center;padding:32px;">'
                + '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" style="margin:0 auto 16px;display:block;"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>'
                + '<h2 style="color:#ef4444;margin-bottom:8px;">Reservation Expired</h2>'
                + '<p style="color:#A0A3B0;">Your payment window has expired and the reservation has been cancelled. Please create a new booking.</p>'
                + '<a href="vehicles.html" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#C9A84C;color:#1C1E26;border-radius:10px;text-decoration:none;font-weight:700;">Browse Vehicles</a>'
                + '</div>';
            return;
        }

        if (serviceFee <= 0) {
            payBody.innerHTML = '<div class="pay-error">No payment required for this booking.</div>';
            return;
        }

        // Check payment timer
        var paymentExpiresAt = booking.payment_expires_at ? new Date(booking.payment_expires_at) : null;
        var remainingMs = paymentExpiresAt ? (paymentExpiresAt.getTime() - Date.now()) : null;

        if (paymentExpiresAt && remainingMs <= 0) {
            payBody.innerHTML =
                '<div class="pay-error" style="text-align:center;padding:32px;">'
                + '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" style="margin:0 auto 16px;display:block;"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>'
                + '<h2 style="color:#ef4444;margin-bottom:8px;">Payment Time Expired</h2>'
                + '<p style="color:#A0A3B0;">Your 8-minute payment window has expired. The reservation will be cancelled automatically. Please create a new booking.</p>'
                + '<a href="vehicles.html" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#C9A84C;color:#1C1E26;border-radius:10px;text-decoration:none;font-weight:700;">Browse Vehicles</a>'
                + '</div>';
            return;
        }

        var totalPrice = parseFloat(booking.total_price) || 0;
        var extrasTotal = parseFloat(booking.extras_total) || 0;
        var locationFee = parseFloat(booking.location_fee) || 0;
        var rentalTotal = totalPrice - extrasTotal - locationFee;
        var pickup = booking.pickup_date || '';
        var dropoff = booking.dropoff_date || '';
        var days = parseInt(booking.rental_days) || 1;

        // Timer HTML
        var timerHTML = '';
        if (paymentExpiresAt) {
            timerHTML = '<div id="payTimer" style="text-align:center;padding:16px 20px;margin-bottom:16px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:12px;">'
                + '<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:4px;">'
                + '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
                + '<span style="color:#ef4444;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">Complete payment within</span>'
                + '</div>'
                + '<div id="payCountdown" style="font-size:32px;font-weight:800;color:#ef4444;font-family:monospace;letter-spacing:2px;">--:--</div>'
                + '<div style="color:#A0A3B0;font-size:12px;margin-top:4px;">Reservation will be cancelled if not paid in time</div>'
                + '</div>';
        }

        // Render payment summary
        payBody.innerHTML =
            timerHTML
            + '<div class="pay-summary">'
            + '<div class="pay-row"><span class="pay-row-label">' + (booking.vehicle_name || 'Vehicle') + '</span><span class="pay-row-value">' + days + ' day' + (days !== 1 ? 's' : '') + '</span></div>'
            + '<div class="pay-row"><span class="pay-row-label">Dates</span><span class="pay-row-value">' + pickup + ' → ' + dropoff + '</span></div>'
            + '<div class="pay-divider"></div>'
            + '<div class="pay-row"><span class="pay-row-label">Car rental (' + days + ' days)</span><span class="pay-row-value">$' + rentalTotal.toFixed(2) + '</span></div>'
            + (extrasTotal > 0 ? '<div class="pay-row"><span class="pay-row-label">Extras & services</span><span class="pay-row-value">$' + extrasTotal.toFixed(2) + '</span></div>' : '')
            + (locationFee > 0 ? '<div class="pay-row"><span class="pay-row-label">Location fees</span><span class="pay-row-value">$' + locationFee.toFixed(2) + '</span></div>' : '')
            + '<div class="pay-row"><span class="pay-row-label">Total price</span><span class="pay-row-value">$' + (totalPrice + serviceFee).toFixed(2) + '</span></div>'
            + '<div class="pay-divider"></div>'
            + '<div class="pay-row pay-total"><span class="pay-row-label">Pay now to reserve</span><span class="pay-row-value">$' + serviceFee.toFixed(2) + '</span></div>'
            + '<div class="pay-row"><span class="pay-row-label">Pay at pickup</span><span class="pay-row-value">$' + totalPrice.toFixed(2) + '</span></div>'
            + '</div>'
            + '<div class="pay-security">'
            + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#166534" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
            + 'Your payment is secured by PayPal. We never store your card details.'
            + '</div>'
            + '<div id="paypal-button-container"></div>'
            + '<div id="google-pay-container"></div>';

        // Start countdown timer
        if (paymentExpiresAt) {
            var countdownEl = document.getElementById('payCountdown');
            var timerEl = document.getElementById('payTimer');
            var payTimerInterval = setInterval(function() {
                var now = Date.now();
                var diff = paymentExpiresAt.getTime() - now;
                if (diff <= 0) {
                    clearInterval(payTimerInterval);
                    payBody.innerHTML =
                        '<div style="text-align:center;padding:32px;">'
                        + '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" style="margin:0 auto 16px;display:block;"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>'
                        + '<h2 style="color:#ef4444;margin-bottom:8px;">Time Expired</h2>'
                        + '<p style="color:#A0A3B0;">Your payment window has expired. The reservation has been cancelled.</p>'
                        + '<a href="vehicles.html" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#C9A84C;color:#1C1E26;border-radius:10px;text-decoration:none;font-weight:700;">Browse Vehicles</a>'
                        + '</div>';
                    return;
                }
                var mins = Math.floor(diff / 60000);
                var secs = Math.floor((diff % 60000) / 1000);
                countdownEl.textContent = (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;

                // Color transitions: yellow under 2 min, red pulse under 1 min
                if (diff < 60000) {
                    timerEl.style.background = 'rgba(239,68,68,0.15)';
                    timerEl.style.borderColor = '#ef4444';
                    countdownEl.style.animation = 'payTimerPulse 1s ease-in-out infinite';
                } else if (diff < 120000) {
                    timerEl.style.background = 'rgba(245,158,11,0.1)';
                    timerEl.style.borderColor = 'rgba(245,158,11,0.4)';
                    countdownEl.style.color = '#f59e0b';
                }
            }, 1000);
        }

        // Load PayPal JS SDK dynamically (with Google Pay component)
        var sdkUrl = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(config.clientId) + '&currency=USD&intent=capture&components=buttons,googlepay&disable-funding=credit,paylater';
        var script = document.createElement('script');
        script.src = sdkUrl;
        script.onload = function () {
            renderPayPalButtons(bookingId, serviceFee);
            setupGooglePay(bookingId, serviceFee);
        };
        script.onerror = function () {
            // Retry without googlepay component (buttons only)
            var s2 = document.createElement('script');
            s2.src = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(config.clientId) + '&currency=USD&intent=capture&disable-funding=credit,paylater';
            s2.onload = function () { renderPayPalButtons(bookingId, serviceFee); };
            s2.onerror = function () {
                document.getElementById('paypal-button-container').innerHTML =
                    '<div class="pay-error">Failed to load PayPal. Please refresh and try again.</div>';
            };
            document.head.appendChild(s2);
        };
        document.head.appendChild(script);
    }).catch(function () {
        payBody.innerHTML = '<div class="pay-error">Failed to load booking details. Please try again.</div>';
    });

    function setupGooglePay(bookingId, serviceFee) {
        if (!window.paypal || !paypal.Googlepay) {
            console.log('PayPal Google Pay component not available');
            var gc = document.getElementById('google-pay-container');
            if (gc) gc.style.display = 'none';
            return;
        }
        if (typeof google === 'undefined' || !google.payments) {
            // Google Pay JS not loaded yet, wait a bit
            setTimeout(function () { setupGooglePay(bookingId, serviceFee); }, 500);
            return;
        }

        var container = document.getElementById('google-pay-container');
        if (!container) return;

        paypal.Googlepay().config().then(function (config) {
            if (!config.isEligible) {
                container.style.display = 'none';
                return;
            }

            var paymentsClient = new google.payments.api.PaymentsClient({
                environment: config.environment || 'PRODUCTION',
                merchantInfo: config.merchantInfo,
                paymentDataCallbacks: {
                    onPaymentAuthorized: function () {
                        return { transactionState: 'SUCCESS' };
                    }
                }
            });

            paymentsClient.isReadyToPay({
                apiVersion: 2,
                apiVersionMinor: 0,
                allowedPaymentMethods: config.allowedPaymentMethods
            }).then(function (response) {
                if (!response.result) {
                    container.style.display = 'none';
                    return;
                }

                var button = paymentsClient.createButton({
                    onClick: function () {
                        onGooglePayClick(paymentsClient, config, bookingId, serviceFee);
                    },
                    buttonColor: 'black',
                    buttonType: 'pay',
                    buttonSizeMode: 'fill'
                });

                container.innerHTML = '';
                container.style.height = '45px';
                container.appendChild(button);
            }).catch(function (err) {
                console.log('Google Pay ready check failed:', err);
                container.style.display = 'none';
            });
        }).catch(function (err) {
            console.log('PayPal Google Pay config failed:', err);
            container.style.display = 'none';
        });
    }

    function onGooglePayClick(paymentsClient, config, bookingId, serviceFee) {
        var gc = document.getElementById('google-pay-container');
        if (gc) gc.innerHTML = '<div class="pay-loading">Processing Google Pay...</div>';

        // 1. Create PayPal order first
        fetch('/api/payments/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ booking_id: bookingId })
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.error) throw new Error(data.error);
            var orderId = data.orderId;

            // 2. Load Google Pay payment data
            return paymentsClient.loadPaymentData({
                apiVersion: 2,
                apiVersionMinor: 0,
                allowedPaymentMethods: config.allowedPaymentMethods,
                merchantInfo: config.merchantInfo,
                transactionInfo: {
                    totalPriceStatus: 'FINAL',
                    totalPrice: serviceFee.toFixed(2),
                    currencyCode: 'USD',
                    countryCode: 'US'
                }
            }).then(function (paymentData) {
                // 3. Confirm order with PayPal using the Google Pay token
                return paypal.Googlepay().confirmOrder({
                    orderId: orderId,
                    paymentMethodData: paymentData.paymentMethodData
                });
            }).then(function (order) {
                // 4. Handle order status
                if (order.status === 'COMPLETED') {
                    return { status: 'COMPLETED' };
                } else if (order.status === 'APPROVED') {
                    // Capture the approved order
                    return fetch('/api/payments/capture-order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                        body: JSON.stringify({ order_id: orderId, booking_id: bookingId })
                    }).then(function (r) { return r.json(); });
                } else {
                    throw new Error('Unexpected order status: ' + order.status);
                }
            });
        })
        .then(function (result) {
            if (result.status === 'COMPLETED') {
                trackPurchase(bookingId, serviceFee);
                document.getElementById('payBody').innerHTML =
                    '<div class="pay-success">'
                    + '<div class="pay-success-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>'
                    + '<h2>Payment Successful!</h2>'
                    + '<p>Your reservation payment of $' + serviceFee.toFixed(2) + ' has been received.<br>Your booking is now confirmed and awaiting admin approval.</p>'
                    + '<a href="guest-profile.html" class="pay-success-btn">View My Bookings</a>'
                    + '</div>';
            } else {
                throw new Error(result.error || 'Payment failed');
            }
        })
        .catch(function (err) {
            if (err.statusCode === 'CANCELED') return;
            console.error('Google Pay error:', err);
            if (gc) gc.innerHTML = '<div class="pay-error">Google Pay error. Try PayPal instead.</div>';
        });
    }

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
                        trackPurchase(bookingId, serviceFee);
                        payBody.innerHTML =
                            '<div class="pay-success">'
                            + '<div class="pay-success-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>'
                            + '<h2>Payment Successful!</h2>'
                            + '<p>Your reservation payment of $' + serviceFee.toFixed(2) + ' has been received.<br>Your booking is now confirmed and awaiting admin approval.</p>'
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
