/* ========================================
   GUEST PROFILE — JAVASCRIPT
   ======================================== */

(function () {
    // Auth check
    var token = localStorage.getItem('token') || sessionStorage.getItem('token');
    var user = null;
    try { user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')); } catch (e) {}

    if (!token || !user) {
        window.location.href = 'login.html';
        return;
    }

    // Set sidebar info
    var initials = getInitials(user.full_name || user.email);
    var avatarEl = document.getElementById('gpAvatar');
    var nameEl = document.getElementById('gpName');
    var emailEl = document.getElementById('gpEmail');

    if (avatarEl) avatarEl.textContent = initials;
    if (nameEl) nameEl.textContent = user.full_name || 'User';
    if (emailEl) emailEl.textContent = user.email || '';

    // Logout
    document.getElementById('gpLogoutBtn').addEventListener('click', function () {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('isLoggedIn');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        window.location.href = 'login.html';
    });

    // ========================================
    // TAB NAVIGATION
    // ========================================
    var navItems = document.querySelectorAll('.gp-nav-item');
    var tabs = document.querySelectorAll('.gp-tab');

    function switchTab(tabName) {
        navItems.forEach(function (n) { n.classList.remove('active'); });
        tabs.forEach(function (t) { t.classList.remove('active'); });

        var activeNav = document.querySelector('.gp-nav-item[data-tab="' + tabName + '"]');
        var activeTab = document.getElementById('tab-' + tabName);
        if (activeNav) activeNav.classList.add('active');
        if (activeTab) activeTab.classList.add('active');
    }

    navItems.forEach(function (item) {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            switchTab(this.dataset.tab);
            history.replaceState(null, '', '#' + this.dataset.tab);
        });
    });

    // Handle hash on load (e.g. guest-profile.html#bookings)
    var hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById('tab-' + hash)) {
        switchTab(hash);
    }

    // ========================================
    // LOAD PROFILE FROM API
    // ========================================
    fetch('/api/me', {
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
        var u = data.user;
        if (!u) return;

        document.getElementById('infoName').textContent = u.full_name || '—';
        document.getElementById('infoEmail').textContent = u.email || '—';
        document.getElementById('infoPhone').textContent = u.phone || '—';
        document.getElementById('infoRole').textContent = u.role === 'partner' ? 'Partner' : 'Guest';
        document.getElementById('infoDate').textContent = u.created_at ? new Date(u.created_at).toLocaleDateString() : '—';

        // Update sidebar too
        if (nameEl) nameEl.textContent = u.full_name || 'User';
        if (emailEl) emailEl.textContent = u.email || '';
        if (avatarEl) avatarEl.textContent = getInitials(u.full_name || u.email);

        // Phone verification card
        var pvCard = document.getElementById('phoneVerifyCard');
        var pvIcon = document.getElementById('pvIcon');
        var pvTitle = document.getElementById('pvTitle');
        var pvDesc = document.getElementById('pvDesc');
        var pvBtn = document.getElementById('pvActionBtn');
        if (pvCard) {
            pvCard.style.display = 'block';
            if (u.phone_verified === 1 || u.phone_verified === true) {
                pvIcon.style.background = 'rgba(34,197,94,0.1)';
                pvIcon.style.color = '#22c55e';
                pvTitle.style.color = '#22c55e';
                pvTitle.textContent = 'Phone Verified';
                pvDesc.textContent = 'Your phone number ' + (u.phone || '') + ' is verified. You can make reservations.';
                pvBtn.style.display = 'none';
            } else {
                pvIcon.style.background = 'rgba(249,115,22,0.1)';
                pvIcon.style.color = '#f97316';
                pvTitle.style.color = '#f97316';
                pvTitle.textContent = 'Phone Not Verified';
                pvDesc.textContent = 'Verify your phone number to make reservations on RoyalCar.rent.';
                pvBtn.style.display = 'inline-block';
                pvBtn.addEventListener('click', function () {
                    window.location.href = '/verify-phone.html';
                });
            }
        }
    })
    .catch(function (err) {
        console.error('Failed to load profile:', err);
    });

    // ========================================
    // LOAD FAVORITES
    // ========================================
    function loadFavorites() {
        fetch('/api/favorites', {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            var favorites = data.favorites || [];
            var statFavorites = document.getElementById('statFavorites');
            if (statFavorites) statFavorites.textContent = favorites.length;

            var favoritesTab = document.getElementById('tab-favorites');
            if (!favoritesTab) return;

            if (favorites.length === 0) {
                favoritesTab.innerHTML = `
                    <div class="gp-tab-header">
                        <h2>My Favorites</h2>
                    </div>
                    <div class="gp-empty-state">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#A0A3B0" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        <h3>No favorites yet</h3>
                        <p>Save vehicles you like by clicking the heart icon</p>
                        <a href="vehicles.html" class="btn btn-primary">Browse Vehicles</a>
                    </div>
                `;
                return;
            }

            var favoritesGrid = '<div class="gp-favorites-grid">';
            favorites.forEach(function (v) {
                var imgSrc = v.image_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 240'%3E%3Crect fill='%23e2e8f0' width='400' height='240'/%3E%3Ctext x='200' y='125' text-anchor='middle' fill='%2394a3b8' font-size='16' font-family='sans-serif'%3ENo Image%3C/text%3E%3C/svg%3E";
                var cat = (v.category || 'economy').toLowerCase();
                var price = v.price_per_day || 0;
                var year = v.year || 2020;
                var name = v.name || 'Vehicle';

                favoritesGrid += `
                    <div class="gp-fav-card">
                        <div class="gp-fav-image">
                            <img src="${imgSrc}" alt="${name}">
                            <span class="gp-fav-year">${year}</span>
                        </div>
                        <div class="gp-fav-body">
                            <h3 class="gp-fav-name">${name}</h3>
                            <div class="gp-fav-specs">
                                <span>${cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                                <span>${v.engine || 'N/A'}</span>
                                <span>${v.gearbox || 'N/A'}</span>
                            </div>
                            <div class="gp-fav-price">$${price}/day</div>
                            <div class="gp-fav-actions">
                                <a href="vehicle.html?id=${v.id}" class="btn btn-primary btn-sm">View Details</a>
                                <button class="btn btn-danger btn-sm" onclick="removeFavorite(${v.id})">Remove</button>
                            </div>
                        </div>
                    </div>
                `;
            });
            favoritesGrid += '</div>';

            favoritesTab.innerHTML = `
                <div class="gp-tab-header">
                    <h2>My Favorites</h2>
                </div>
                ${favoritesGrid}
            `;
        })
        .catch(function (err) {
            console.error('Load favorites error:', err);
        });
    }

    // Load favorites when tab is activated
    var favoritesNavItem = document.querySelector('.gp-nav-item[data-tab="favorites"]');
    if (favoritesNavItem) {
        favoritesNavItem.addEventListener('click', function () {
            loadFavorites();
        });
    }

    // Load favorites if hash is #favorites
    if (window.location.hash === '#favorites') {
        loadFavorites();
    }

    // ========================================
    // LOAD BOOKINGS
    // ========================================
    var STATUS_COLORS = { pending: '#f59e0b', accepted: '#22c55e', confirmed: '#22c55e', rejected: '#ef4444', cancelled: '#ef4444', cancel_requested: '#f97316', completed: '#C9A84C' };
    var STATUS_LABELS = { pending: 'Pending', accepted: 'Confirmed', confirmed: 'Confirmed', rejected: 'Rejected', cancelled: 'Cancelled', cancel_requested: 'Cancellation Requested', completed: 'Completed' };

    function loadBookings() {
        var tab = document.getElementById('tab-bookings');
        if (!tab) return;
        tab.innerHTML = '<div class="gp-tab-header"><h2>My Bookings</h2></div><div style="padding:40px;text-align:center;color:#A0A3B0;">Loading...</div>';

        fetch('/api/bookings/my', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var allBookings = data.bookings || [];
            // Hide cancelled bookings from guest view
            var bookings = allBookings.filter(function(b) { return b.status !== 'cancelled'; });

            var statBookings = document.getElementById('statBookings');
            if (statBookings) statBookings.textContent = allBookings.length;

            if (bookings.length === 0) {
                tab.innerHTML = '<div class="gp-tab-header"><h2>My Bookings</h2></div>'
                    + '<div class="gp-empty-state">'
                    + '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#A0A3B0" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
                    + '<h3>No bookings yet</h3><p>Your rental bookings will appear here</p>'
                    + '<a href="vehicles.html" class="btn btn-primary">Browse Vehicles</a></div>';
                return;
            }

            var html = '<div class="gp-tab-header"><h2>My Bookings</h2></div><div class="gp-bookings-list">';
            bookings.forEach(function(b) {
                var imgSrc = b.image_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 240'%3E%3Crect fill='%23e2e8f0' width='400' height='240'/%3E%3Ctext x='200' y='125' text-anchor='middle' fill='%2394a3b8' font-size='14'%3ENo Image%3C/text%3E%3C/svg%3E";
                var statusColor = STATUS_COLORS[b.status] || '#A0A3B0';
                var statusLabel = STATUS_LABELS[b.status] || b.status;
                var pickupTime = b.pickup_time || '10:00';
                var dropoffTime = b.dropoff_time || '10:00';
                var pickup  = new Date(b.pickup_date).toLocaleDateString('en-US',  { month:'short', day:'numeric', year:'numeric' });
                var dropoff = new Date(b.dropoff_date).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
                var days = Math.max(1, Math.round((new Date(b.dropoff_date) - new Date(b.pickup_date)) / 86400000));

                var payStatus = String(b.payment_status || 'unpaid');
                var actionBtn = '';
                var payBtn = '';
                if (b.status === 'pending') {
                    actionBtn = '<button class="gp-booking-cancel-btn" data-id="' + b.id + '" data-action="cancelled">Cancel</button>';
                    if (payStatus === 'unpaid' && parseFloat(b.service_fee) > 0) {
                        payBtn = '<a href="payment.html?booking_id=' + b.id + '" class="gp-booking-pay-btn">Pay Service Fee ($' + parseFloat(b.service_fee).toFixed(2) + ')</a>';
                    }
                } else if (b.status === 'accepted') {
                    actionBtn = '<button class="gp-booking-cancel-btn gp-booking-cancel-request" data-id="' + b.id + '" data-action="cancel_requested">Request Cancellation</button>';
                } else if (b.status === 'cancel_requested') {
                    actionBtn = '<span class="gp-booking-cancel-pending">Awaiting admin approval</span>';
                }
                var payBadge = '';
                if (payStatus === 'paid') {
                    payBadge = '<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;background:#dcfce7;color:#166534;margin-left:8px;">Paid</span>';
                } else if (payStatus === 'refunded') {
                    payBadge = '<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;background:#fef3c7;color:#92400e;margin-left:8px;">Refunded</span>';
                } else if (parseFloat(b.service_fee) > 0) {
                    payBadge = '<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;background:#fee2e2;color:#991b1b;margin-left:8px;">Unpaid</span>';
                }

                html += '<div class="gp-booking-card">'
                    + '<img class="gp-booking-img" src="' + imgSrc + '" alt="' + (b.vehicle_name||'') + '">'
                    + '<div class="gp-booking-info">'
                    + '<div class="gp-booking-header">'
                    + '<span class="gp-booking-name">' + (b.vehicle_name || 'Vehicle') + '</span>'
                    + '<span class="gp-booking-status" style="background:' + statusColor + '20;color:' + statusColor + ';border:1px solid ' + statusColor + '40;">' + statusLabel + '</span>'
                    + '</div>'
                    + '<div class="gp-booking-dates">' + pickup + ' ' + pickupTime + ' &rarr; ' + dropoff + ' ' + dropoffTime + ' &middot; ' + days + ' day' + (days!==1?'s':'') + '</div>'
                    + (b.pickup_location ? '<div class="gp-booking-loc">&#128205; ' + b.pickup_location + '</div>' : '')
                    + '<div class="gp-booking-price">Total: <strong>$' + (b.total_price || 0) + '</strong>' + payBadge
                    + (b.partner_company ? ' &middot; <span style="color:#A0A3B0;">' + b.partner_company + '</span>' : '') + '</div>'
                    + '</div>'
                    + '<div class="gp-booking-actions">' + payBtn + actionBtn + '</div>'
                    + '</div>';
            });
            html += '</div>';
            tab.innerHTML = html;

            // Wire cancel and cancel-request buttons
            tab.querySelectorAll('.gp-booking-cancel-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var bId = this.getAttribute('data-id');
                    var action = this.getAttribute('data-action');
                    var msg = action === 'cancel_requested'
                        ? 'Request cancellation for this booking? The admin will review your request.'
                        : 'Cancel this booking?';
                    if (!confirm(msg)) return;
                    fetch('/api/bookings/' + bId + '/status', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                        body: JSON.stringify({ status: action })
                    })
                    .then(function(r) { return r.json(); })
                    .then(function(d) {
                        if (d.error) { alert(d.error); return; }
                        if (action === 'cancel_requested') {
                            alert('Cancellation request sent. The admin will review it shortly.');
                        }
                        loadBookings();
                    })
                    .catch(function() { alert('Failed to process request'); });
                });
            });
        })
        .catch(function() {
            tab.innerHTML = '<div class="gp-tab-header"><h2>My Bookings</h2></div><div style="padding:40px;text-align:center;color:#ef4444;">Failed to load bookings.</div>';
        });
    }

    var bookingsNavItem = document.querySelector('.gp-nav-item[data-tab="bookings"]');
    if (bookingsNavItem) bookingsNavItem.addEventListener('click', loadBookings);
    if (window.location.hash === '#bookings') loadBookings();
    // Always load bookings count for stats
    loadBookings();

    // Global function to remove favorite
    window.removeFavorite = function (vehicleId) {
        if (!confirm('Remove this vehicle from favorites?')) return;
        
        fetch('/api/favorites/' + vehicleId, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            loadFavorites(); // Reload favorites
        })
        .catch(function (err) {
            console.error('Remove favorite error:', err);
            alert('Failed to remove favorite');
        });
    };

    // ========================================
    // CHANGE PASSWORD
    // ========================================
    var pwForm = document.getElementById('changePasswordForm');
    if (pwForm) {
        var pwMsg = document.createElement('div');
        pwMsg.style.cssText = 'font-size:13px;margin-top:8px;padding:8px 12px;border-radius:6px;display:none;';
        pwForm.appendChild(pwMsg);

        pwForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var curPw  = document.getElementById('currentPassword').value;
            var newPw  = document.getElementById('newPassword').value;
            var confPw = document.getElementById('confirmNewPassword').value;
            var btn    = pwForm.querySelector('button[type="submit"]');

            pwMsg.style.display = 'none';
            if (newPw.length < 6) {
                pwMsg.style.cssText = 'font-size:13px;margin-top:8px;padding:8px 12px;border-radius:6px;background:#fef2f2;color:#dc2626;display:block;';
                pwMsg.textContent = 'New password must be at least 6 characters';
                return;
            }
            if (newPw !== confPw) {
                pwMsg.style.cssText = 'font-size:13px;margin-top:8px;padding:8px 12px;border-radius:6px;background:#fef2f2;color:#dc2626;display:block;';
                pwMsg.textContent = 'Passwords do not match';
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Updating...';

            fetch('/api/me/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ current_password: curPw, new_password: newPw })
            })
            .then(function(r) { return r.json(); })
            .then(function(d) {
                btn.disabled = false;
                btn.textContent = 'Update Password';
                if (d.error) {
                    pwMsg.style.cssText = 'font-size:13px;margin-top:8px;padding:8px 12px;border-radius:6px;background:#fef2f2;color:#dc2626;display:block;';
                    pwMsg.textContent = d.error;
                } else {
                    pwMsg.style.cssText = 'font-size:13px;margin-top:8px;padding:8px 12px;border-radius:6px;background:#f0fdf4;color:#16a34a;display:block;';
                    pwMsg.textContent = 'Password updated successfully!';
                    pwForm.reset();
                }
            })
            .catch(function() {
                btn.disabled = false;
                btn.textContent = 'Update Password';
                pwMsg.style.cssText = 'font-size:13px;margin-top:8px;padding:8px 12px;border-radius:6px;background:#fef2f2;color:#dc2626;display:block;';
                pwMsg.textContent = 'Network error. Please try again.';
            });
        });
    }

    // ========================================
    // DELETE ACCOUNT
    // ========================================
    var deleteBtn = document.getElementById('deleteAccountBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function () {
            var pw = prompt('Enter your password to confirm account deletion:');
            if (!pw) return;
            fetch('/api/me', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ password: pw })
            })
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (d.error) { alert(d.error); return; }
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = 'index.html';
            })
            .catch(function() { alert('Network error. Please try again.'); });
        });
    }

    function getInitials(name) {
        if (!name) return '?';
        var parts = name.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.substring(0, 2).toUpperCase();
    }

})();
