(function () {
    'use strict';

    var STATUS_COLORS = { pending: '#f59e0b', accepted: '#22c55e', confirmed: '#22c55e', rejected: '#ef4444', cancelled: '#ef4444', cancel_requested: '#f97316', completed: '#C9A84C' };
    var STATUS_LABELS = { pending: 'Pending', accepted: 'Confirmed', confirmed: 'Confirmed', rejected: 'Rejected', cancelled: 'Cancelled', cancel_requested: 'Cancellation Requested', completed: 'Completed' };

    var root = document.getElementById('bkContent');
    var token = null, user = null;
    try { token = localStorage.getItem('token') || sessionStorage.getItem('token'); } catch (e) {}

    function state(msg, withLogin) {
        root.innerHTML = '<div class="bk-state">' + msg +
            (withLogin ? '<br><br><a class="bk-pay" href="login.html?redirect=' + encodeURIComponent(location.href) + '">Sign in</a>' : '') + '</div>';
    }

    var id = parseInt((new URLSearchParams(location.search)).get('id'), 10);
    if (!token) { state('Please sign in to view this booking.', true); return; }
    if (!id) { state('Booking not found.'); return; }

    function money(n) { return '$' + (parseFloat(n) || 0).toFixed(2); }
    function fdate(d) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function spec(emoji, label) { return label ? '<span class="bk-spec">' + emoji + ' ' + esc(label) + '</span>' : ''; }

    fetch('/api/bookings/' + id, { headers: { 'Authorization': 'Bearer ' + token } })
        .then(function (r) {
            if (r.status === 401 || r.status === 403) throw { soft: 'You don’t have access to this booking.' };
            if (r.status === 404) throw { soft: 'Booking not found.' };
            if (!r.ok) throw { soft: 'Could not load this booking. Please try again.' };
            return r.json();
        })
        .then(function (data) {
            var b = data.booking || {};
            var statusColor = STATUS_COLORS[b.status] || '#A0A3B0';
            var statusLabel = STATUS_LABELS[b.status] || b.status || '';
            var days = b.rental_days || Math.max(1, Math.round((new Date(b.dropoff_date) - new Date(b.pickup_date)) / 86400000));
            var dailyPrice = parseFloat(b.price_per_day) || 0;
            var rentalBase = dailyPrice * days;
            var extras = parseFloat(b.extras_total) || 0;
            var locationFee = parseFloat(b.location_fee) || 0;
            var serviceFee = parseFloat(b.service_fee) || 0;
            var deposit = parseFloat(b.deposit_amount) || 0;
            var total = parseFloat(b.total_price) || (rentalBase + extras + locationFee);
            var payStatus = String(b.payment_status || 'unpaid');
            var paid = payStatus === 'paid';

            var imgSrc = b.image_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 240'%3E%3Crect fill='%230e0f14' width='400' height='240'/%3E%3Ctext x='200' y='125' text-anchor='middle' fill='%2394a3b8' font-size='14'%3ENo Image%3C/text%3E%3C/svg%3E";

            var html = '';
            // Top bar
            html += '<div class="bk-topbar">'
                + '<div class="bk-ref"><h1>Booking #' + b.id + '</h1>'
                + '<span class="bk-chip" style="background:' + statusColor + '22;color:' + statusColor + ';border:1px solid ' + statusColor + '55;">' + esc(statusLabel) + '</span></div>'
                + '<a class="bk-back" href="guest-profile.html#bookings">&larr; My Bookings</a>'
                + '</div>';

            // Summary
            html += '<div class="bk-summary">'
                + '<div><p class="lbl">Total</p><p class="val">' + money(total) + '</p></div>'
                + '<div><p class="lbl">Duration</p><p class="val">' + days + ' day' + (days !== 1 ? 's' : '') + '</p></div>'
                + '<div><p class="lbl">Reservation fee</p><p class="val sm">' + money(serviceFee) + ' <span style="font-size:11px;opacity:.85;">' + (paid ? 'paid' : 'due') + '</span></p></div>'
                + '<div><p class="lbl">Deposit</p><p class="val sm accent">' + (deposit > 0 ? money(deposit) : 'None') + '</p></div>'
                + '</div>';

            // Grid: period + vehicle
            html += '<div class="bk-grid">';
            html += '<div class="bk-card"><h3>Rental period &amp; locations</h3>'
                + '<div class="bk-leg"><span class="dot" style="background:#22c55e;"></span><div>'
                + '<div class="when">' + fdate(b.pickup_date) + ' &middot; ' + esc(b.pickup_time || '10:00') + '</div>'
                + '<div class="where">&#128205; ' + esc(b.pickup_location || 'Tbilisi') + '</div></div></div>'
                + '<div class="bk-leg"><span class="dot" style="background:' + statusColor + ';"></span><div>'
                + '<div class="when">' + fdate(b.dropoff_date) + ' &middot; ' + esc(b.dropoff_time || '10:00') + '</div>'
                + '<div class="where">&#128205; ' + esc(b.dropoff_location || 'Tbilisi') + '</div></div></div>'
                + '</div>';

            html += '<div class="bk-card"><h3>Your car</h3>'
                + '<img class="bk-veh-img" src="' + imgSrc + '" alt="' + esc(b.vehicle_name) + '">'
                + '<div class="bk-veh-name">' + esc(b.vehicle_name || 'Vehicle') + (b.year ? ' <span style="color:var(--bk-mut);font-weight:600;">' + esc(b.year) + '</span>' : '') + '</div>'
                + '<div class="bk-specs">'
                + spec('&#9881;', b.gearbox) + spec('&#9981;', b.engine) + spec('&#128100;', b.seats ? b.seats + ' seats' : '') + spec('&#128682;', b.doors ? b.doors + ' doors' : '') + spec('&#128663;', b.drive_type)
                + '</div>'
                + (b.partner_company ? '<div class="bk-row" style="margin-top:12px;border-top:1px solid var(--bk-line);padding-top:12px;"><span class="k">Host</span><span>' + esc(b.partner_company) + '</span></div>' : '')
                + '</div>';
            html += '</div>';

            // Price details
            html += '<div class="bk-card" style="margin-top:18px;"><h3>Price details</h3>'
                + '<div class="bk-row"><span class="k">Rental (' + days + ' &times; ' + money(dailyPrice) + ')</span><span>' + money(rentalBase) + '</span></div>'
                + (extras > 0 ? '<div class="bk-row"><span class="k">Extras</span><span>' + money(extras) + '</span></div>' : '')
                + (locationFee > 0 ? '<div class="bk-row"><span class="k">Pickup / drop-off fee</span><span>' + money(locationFee) + '</span></div>' : '')
                + '<div class="bk-row" style="border-top:1px solid var(--bk-line);margin-top:6px;padding-top:12px;font-weight:800;"><span>Total</span><span>' + money(total) + '</span></div>'
                + '<div class="bk-row"><span class="k">Reservation fee (' + (paid ? 'paid online' : 'pay online now') + ')</span><span>' + money(serviceFee) + '</span></div>'
                + (deposit > 0 ? '<div class="bk-row"><span class="k">Refundable deposit (at pickup)</span><span>' + money(deposit) + '</span></div>' : '')
                + '</div>';

            // Pay CTA
            if (!paid && serviceFee > 0 && b.status !== 'cancelled' && b.status !== 'rejected') {
                html += '<div style="margin-top:18px;text-align:center;"><a class="bk-pay" href="payment.html?booking_id=' + b.id + '">Pay reservation fee &middot; ' + money(serviceFee) + '</a></div>';
            }

            root.innerHTML = html;
        })
        .catch(function (err) {
            state((err && err.soft) || 'Something went wrong loading this booking.');
        });
})();
