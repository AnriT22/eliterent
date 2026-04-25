/* ========================================
   ADMIN PANEL — JavaScript
   ======================================== */

function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

(function () {
    var token = localStorage.getItem('token') || sessionStorage.getItem('token');
    var user = null;
    try { user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')); } catch (e) {}

    if (!token || !user || user.role !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    var headerUser = document.getElementById('adminHeaderUser');
    if (headerUser) headerUser.textContent = user.full_name || user.email;

    // Tab navigation
    var navItems = document.querySelectorAll('.admin-nav-item');
    var tabs = document.querySelectorAll('.admin-tab');
    var pageTitle = document.getElementById('adminPageTitle');

    navItems.forEach(function (item) {
        item.addEventListener('click', function () {
            var tabName = this.dataset.tab;
            navItems.forEach(function (n) { n.classList.remove('active'); });
            tabs.forEach(function (t) { t.classList.remove('active'); });
            this.classList.add('active');
            var target = document.getElementById('tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
            if (target) target.classList.add('active');
            pageTitle.textContent = this.textContent.trim();

            if (tabName === 'dashboard') loadAnalytics();
            if (tabName === 'users') loadUsers();
            if (tabName === 'partners') loadPartners();
            if (tabName === 'vehicles') loadVehicles();
            if (tabName === 'bookings') loadBookings();
            if (tabName === 'financial') loadFinancial();
            if (tabName === 'promos') loadPromos();
            if (tabName === 'activity') loadActivity();
        });
    });

    // Logout
    document.getElementById('adminLogoutBtn').addEventListener('click', function () {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        window.location.href = 'login.html';
    });

    function apiGet(url) {
        return fetch(url, { headers: { 'Authorization': 'Bearer ' + token } }).then(function (r) { return r.json(); });
    }
    function apiPut(url, body) {
        return fetch(url, { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).then(function (r) { return r.json(); });
    }
    function apiPatch(url, body) {
        return fetch(url, { method: 'PATCH', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).then(function (r) { return r.json(); });
    }
    function apiDelete(url) {
        return fetch(url, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } }).then(function (r) { return r.json(); });
    }

    // ========================================
    // DASHBOARD / ANALYTICS
    // ========================================
    function loadAnalytics() {
        apiGet('/api/admin/analytics').then(function (data) {
            var grid = document.getElementById('statsGrid');
            grid.innerHTML = ''
                + statCard('Earnings This Month', fmtMoney(data.earnings.month), 'green', data.earnings.reservationsMonth + ' reservations')
                + statCard('Earnings Overall', fmtMoney(data.earnings.overall), 'blue', data.earnings.reservationsOverall + ' reservations')
                + statCard('Service Fee Revenue', fmtMoney(data.earnings.overall), 'orange', 'Accepted + completed bookings')
                + statCard('Total Users', data.users.total, 'purple', '+' + data.users.recentSignups + ' this week')
                + statCard('Vehicles', data.vehicles.total, 'blue', data.vehicles.active + ' active, ' + data.vehicles.pending + ' pending');

            renderBarChart('dailyUploadsChart', data.uploads.daily, 'date', 'count', 140);
            renderBarChart('monthlyUploadsChart', data.uploads.monthly, 'month', 'count', 140);
        }).catch(function () {
            document.getElementById('statsGrid').innerHTML = '<p style="color:#ef4444;">Failed to load analytics</p>';
        });
    }

    function fmtMoney(value) {
        return '$' + (parseFloat(value) || 0).toFixed(2);
    }

    function statCard(label, value, color, sub) {
        return '<div class="admin-stat-card ' + color + '">'
            + '<div class="stat-label">' + label + '</div>'
            + '<div class="stat-value">' + (value || 0) + '</div>'
            + (sub ? '<div class="stat-sub">' + sub + '</div>' : '')
            + '</div>';
    }

    function renderBarChart(containerId, data, labelKey, valueKey, maxHeight) {
        var el = document.getElementById(containerId);
        if (!el) return;
        if (!data || data.length === 0) {
            el.innerHTML = '<p style="color:#A0A3B0;font-size:13px;margin:auto;">No data yet</p>';
            return;
        }
        var maxVal = Math.max.apply(null, data.map(function (d) { return d[valueKey] || 0; }));
        if (maxVal === 0) maxVal = 1;
        el.innerHTML = '';
        el.style.paddingBottom = '24px';
        data.reverse().forEach(function (d) {
            var h = Math.max(8, ((d[valueKey] || 0) / maxVal) * (maxHeight - 40));
            var bar = document.createElement('div');
            bar.className = 'admin-bar';
            bar.style.height = h + 'px';
            var lbl = (d[labelKey] || '').replace(/^\d{4}-/, '');
            bar.innerHTML = '<span class="bar-value">' + (d[valueKey] || 0) + '</span><span class="bar-label">' + lbl + '</span>';
            el.appendChild(bar);
        });
    }

    // ========================================
    // USERS
    // ========================================
    function loadUsers() {
        var roleFilter = document.getElementById('userRoleFilter').value;
        var url = '/api/admin/users' + (roleFilter ? '?role=' + roleFilter : '');
        apiGet(url).then(function (data) {
            var tbody = document.getElementById('usersTableBody');
            var users = data.users || [];
            if (users.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#A0A3B0;padding:30px;">No users found</td></tr>';
                return;
            }
            tbody.innerHTML = users.map(function (u) {
                var date = u.created_at ? new Date(u.created_at).toLocaleDateString() : '-';
                var approvedBadge = u.is_approved
                    ? '<span class="admin-status" style="background:#dcfce7;color:#16a34a;">Approved</span>'
                    : '<span class="admin-status" style="background:#fef3c7;color:#d97706;">Pending</span>';
                var googleBadge = u.google_id
                    ? ' <span class="admin-status" style="background:#e8f0fe;color:#1a73e8;font-size:10px;" title="Signed up with Google">G</span>'
                    : '';
                var verifiedBadge = u.is_verified
                    ? ' <span class="admin-status" style="background:#dcfce7;color:#16a34a;font-size:10px;" title="Verified">✓</span>'
                    : ' <span class="admin-status" style="background:#fef3c7;color:#d97706;font-size:10px;" title="Not verified">?</span>';
                var phoneVerBadge = u.phone_verified
                    ? ' <span class="admin-status" style="background:#dcfce7;color:#16a34a;font-size:10px;" title="Phone verified">📱✓</span>'
                    : ' <span class="admin-status" style="background:#fef2f2;color:#dc2626;font-size:10px;" title="Phone not verified">📱✗</span>';
                var emailVerBadge = u.email_verified
                    ? ' <span class="admin-status" style="background:#dcfce7;color:#16a34a;font-size:10px;" title="Email verified">✉✓</span>'
                    : ' <span class="admin-status" style="background:#fef2f2;color:#dc2626;font-size:10px;" title="Email not verified">✉✗</span>';
                var approveBtn = !u.is_approved
                    ? '<button class="admin-action-btn success" onclick="adminApproveUser(' + u.id + ')">Approve</button>'
                      + '<button class="admin-action-btn danger" onclick="adminRejectUser(' + u.id + ')">Reject</button>'
                    : '';
                var suspendBtn = u.is_approved
                    ? '<button class="admin-action-btn" style="color:#d97706;border-color:#fcd34d;" onclick="adminSuspendUser(' + u.id + ')">Suspend</button>'
                    : '<button class="admin-action-btn success" onclick="adminUnsuspendUser(' + u.id + ')">Unsuspend</button>';
                return '<tr>'
                    + '<td>' + u.id + '</td>'
                    + '<td><strong><a href="#" onclick="adminViewUser(' + u.id + ');return false;" style="color:#C9A84C;text-decoration:none;">' + escHtml(u.full_name || '-') + '</a></strong>' + googleBadge + '</td>'
                    + '<td>' + escHtml(u.email || '-') + '</td>'
                    + '<td>' + escHtml(u.phone || '-') + '</td>'
                    + '<td><span class="admin-status ' + u.role + '">' + u.role + '</span>' + verifiedBadge + phoneVerBadge + emailVerBadge + '</td>'
                    + '<td>' + approvedBadge + '</td>'
                    + '<td>' + date + '</td>'
                    + '<td>'
                    + approveBtn
                    + suspendBtn
                    + '<button class="admin-action-btn danger" onclick="adminDeleteUser(' + u.id + ')">Delete</button>'
                    + '</td></tr>';
            }).join('');
        });
    }

    window.adminApproveUser = function (id) {
        if (!confirm('Approve this user?')) return;
        apiPut('/api/admin/users/' + id + '/approve').then(function (data) {
            if (data.error) { alert('Error: ' + data.error); return; }
            loadUsers();
        }).catch(function (err) { alert('Failed to approve user'); });
    };

    window.adminRejectUser = function (id) {
        if (!confirm('Reject and remove this user?')) return;
        apiPut('/api/admin/users/' + id + '/reject').then(function (data) {
            if (data.error) { alert('Error: ' + data.error); return; }
            loadUsers();
        }).catch(function (err) { alert('Failed to reject user'); });
    };

    window.adminDeleteUser = function (id) {
        if (!confirm('Delete this user? This cannot be undone.')) return;
        apiDelete('/api/admin/users/' + id).then(function (data) {
            if (data.error) { alert('Error: ' + data.error); return; }
            loadUsers();
            loadPartners();
        }).catch(function (err) { alert('Failed to delete user'); });
    };

    window.adminSuspendUser = function (id) {
        if (!confirm('Suspend this user? They will not be able to log in or make bookings.')) return;
        apiPut('/api/admin/users/' + id + '/suspend').then(function (data) {
            if (data.error) { alert('Error: ' + data.error); return; }
            loadUsers();
        }).catch(function () { alert('Failed to suspend user'); });
    };

    window.adminUnsuspendUser = function (id) {
        apiPut('/api/admin/users/' + id + '/unsuspend').then(function (data) {
            if (data.error) { alert('Error: ' + data.error); return; }
            loadUsers();
        }).catch(function () { alert('Failed to unsuspend user'); });
    };

    document.getElementById('userRoleFilter').addEventListener('change', loadUsers);
    document.getElementById('userSearch').addEventListener('input', function () {
        var q = this.value.toLowerCase();
        var rows = document.querySelectorAll('#usersTableBody tr');
        rows.forEach(function (r) {
            r.style.display = r.textContent.toLowerCase().indexOf(q) !== -1 ? '' : 'none';
        });
    });

    // ========================================
    // PARTNERS
    // ========================================
    function loadPartners() {
        apiGet('/api/admin/partners').then(function (data) {
            var tbody = document.getElementById('partnersTableBody');
            var partners = data.partners || [];
            if (partners.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#A0A3B0;padding:30px;">No partners found</td></tr>';
                return;
            }
            tbody.innerHTML = partners.map(function (p) {
                var date = p.created_at ? new Date(p.created_at).toLocaleDateString() : '-';
                var verified = p.is_verified ? 'verified' : 'unverified';
                var pPhoneBadge = p.phone_verified
                    ? '<span class="admin-status" style="background:#dcfce7;color:#16a34a;font-size:10px;margin-left:4px;" title="Phone verified">📱✓</span>'
                    : '<span class="admin-status" style="background:#fef2f2;color:#dc2626;font-size:10px;margin-left:4px;" title="Phone not verified">📱✗</span>';
                var verifyBtn = p.is_verified
                    ? '<button class="admin-action-btn" onclick="adminUnverifyPartner(' + p.id + ')">Unverify</button>'
                    : '<button class="admin-action-btn success" onclick="adminVerifyPartner(' + p.id + ')">Verify</button>';
                return '<tr>'
                    + '<td>' + p.id + '</td>'
                    + '<td><strong><a href="#" onclick="adminViewUser(' + p.id + ');return false;" style="color:#C9A84C;text-decoration:none;">' + escHtml(p.full_name || '-') + '</a></strong></td>'
                    + '<td><a href="#" onclick="adminViewUser(' + p.id + ');return false;" style="color:#C9A84C;text-decoration:none;">' + escHtml(p.company_name || '-') + '</a></td>'
                    + '<td>' + escHtml(p.email || '-') + '</td>'
                    + '<td>' + escHtml(p.phone || '-') + pPhoneBadge + '</td>'
                    + '<td><span class="admin-status ' + verified + '">' + verified + '</span></td>'
                    + '<td>' + date + '</td>'
                    + '<td>'
                    + verifyBtn
                    + '<button class="admin-action-btn danger" onclick="adminDeleteUser(' + p.id + ')">Delete</button>'
                    + '</td></tr>';
            }).join('');
        });
    }

    window.adminVerifyPartner = function (id) {
        apiPut('/api/admin/partners/' + id + '/verify').then(function () { loadPartners(); });
    };
    window.adminUnverifyPartner = function (id) {
        apiPut('/api/admin/partners/' + id + '/unverify').then(function () { loadPartners(); });
    };

    document.getElementById('partnerSearch').addEventListener('input', function () {
        var q = this.value.toLowerCase();
        var rows = document.querySelectorAll('#partnersTableBody tr');
        rows.forEach(function (r) {
            r.style.display = r.textContent.toLowerCase().indexOf(q) !== -1 ? '' : 'none';
        });
    });

    // ========================================
    // VEHICLES
    // ========================================
    var _adminVehicles = [];

    function loadVehicles() {
        apiGet('/api/admin/vehicles').then(function (data) {
            var tbody = document.getElementById('vehiclesTableBody');
            var vehicles = data.vehicles || [];
            _adminVehicles = vehicles;
            if (vehicles.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#A0A3B0;padding:30px;">No vehicles found</td></tr>';
                return;
            }
            tbody.innerHTML = vehicles.map(function (v) {
                var date = v.created_at ? new Date(v.created_at).toLocaleDateString() : '-';
                var imgSrc = v.image_url || '';
                var imgTag = imgSrc ? '<img src="' + imgSrc + '" class="vehicle-thumb">' : '<div class="vehicle-thumb" style="display:inline-flex;align-items:center;justify-content:center;background:#262A35;font-size:14px;">-</div>';
                var status = v.status || 'active';
                return '<tr>'
                    + '<td>' + v.id + '</td>'
                    + '<td>' + imgTag + '</td>'
                    + '<td><strong>' + escHtml(v.name || '-') + '</strong></td>'
                    + '<td>' + escHtml(v.company_name || v.partner_name || '-') + '</td>'
                    + '<td>$' + (v.price_per_day || 0) + '</td>'
                    + '<td><span class="admin-status ' + status + '">' + status + '</span></td>'
                    + '<td>' + date + '</td>'
                    + '<td>'
                    + '<button class="admin-action-btn primary" onclick="adminViewVehicle(' + v.id + ')">View</button>'
                    + (status === 'pending' ? '<button class="admin-action-btn success" onclick="adminSetVehicleStatus(' + v.id + ',\'active\')">Approve</button>' : '')
                    + (status === 'delete_requested' ? '<button class="admin-action-btn success" onclick="adminApproveDelete(' + v.id + ')">Approve Delete</button>' : '')
                    + (status === 'delete_requested' ? '<button class="admin-action-btn" onclick="adminRejectDelete(' + v.id + ')">Reject Delete</button>' : '')
                    + (status === 'active' ? '<button class="admin-action-btn" onclick="adminSetVehicleStatus(' + v.id + ',\'inactive\')">Deactivate</button>' : '')
                    + (status === 'inactive' ? '<button class="admin-action-btn success" onclick="adminSetVehicleStatus(' + v.id + ',\'active\')">Activate</button>' : '')
                    + (status !== 'delete_requested' ? '<button class="admin-action-btn danger" onclick="adminDeleteVehicle(' + v.id + ')">Delete</button>' : '')
                    + '</td></tr>';
            }).join('');

            applyVehicleFilters();
        });
    }

    window.adminSetVehicleStatus = function (id, status) {
        apiPut('/api/admin/vehicles/' + id + '/status', { status: status }).then(function () { loadVehicles(); });
    };
    window.adminDeleteVehicle = function (id) {
        if (!confirm('Delete this vehicle? This cannot be undone.')) return;
        apiDelete('/api/admin/vehicles/' + id).then(function () { loadVehicles(); });
    };
    window.adminApproveDelete = function (id) {
        if (!confirm('Approve deletion of this vehicle? This cannot be undone.')) return;
        apiDelete('/api/admin/vehicles/' + id + '/approve-delete').then(function () { loadVehicles(); });
    };
    window.adminRejectDelete = function (id) {
        apiPut('/api/admin/vehicles/' + id + '/reject-delete', {}).then(function () { loadVehicles(); });
    };

    window.adminViewVehicle = function (id) {
        var v = _adminVehicles.find(function (x) { return x.id === id; });
        if (!v) return;
        var modal = document.getElementById('vehicleDetailModal');
        var title = document.getElementById('vdTitle');
        var content = document.getElementById('vdContent');
        title.textContent = v.name || 'Vehicle #' + v.id;

        var extras = {}; try { extras = typeof v.extras === 'string' ? JSON.parse(v.extras || '{}') : (v.extras || {}); } catch(e) {}
        var features = {}; try { features = typeof v.features === 'string' ? JSON.parse(v.features || '{}') : (v.features || {}); } catch(e) {}
        var priceTiers = {}; try { priceTiers = typeof v.price_tiers === 'string' ? JSON.parse(v.price_tiers || '{}') : (v.price_tiers || {}); } catch(e) {}
        var insurance = {}; try { insurance = typeof v.insurance === 'string' ? JSON.parse(v.insurance || '{}') : (v.insurance || {}); } catch(e) {}

        var gallery = []; try { gallery = typeof v.gallery === 'string' ? JSON.parse(v.gallery || '[]') : (v.gallery || []); } catch(e) {}
        if (!Array.isArray(gallery)) gallery = [];
        var allImages = [];
        if (v.image_url) allImages.push(v.image_url);
        gallery.forEach(function(url) { if (url && allImages.indexOf(url) === -1) allImages.push(url); });

        var imgHtml = '';
        if (allImages.length > 0) {
            imgHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:20px;">'
                + allImages.map(function(url, i) {
                    return '<img src="' + url + '" style="width:100%;height:180px;object-fit:cover;border-radius:10px;cursor:pointer;border:1px solid #3A3F4B;" onclick="window.open(this.src)">';
                }).join('')
                + '</div>';
        }

        var row = function(label, val) { return val ? '<tr><td style="padding:6px 12px 6px 0;color:#A0A3B0;font-weight:600;white-space:nowrap;">' + label + '</td><td style="padding:6px 0;">' + val + '</td></tr>' : ''; };

        var specHtml = '<table style="width:100%;font-size:13px;border-collapse:collapse;">'
            + row('Category', v.category)
            + row('Year', v.year)
            + row('Engine', v.engine)
            + row('Gearbox', v.gearbox)
            + row('Drive Type', v.drive_type)
            + row('Interior', v.interior_type)
            + row('Steering', v.steering_side)
            + row('Payment', v.payment_method)
            + row('Price/Day', '$' + (v.price_per_day || 0))
            + row('Partner', v.company_name || v.partner_name || '-')
            + row('Status', '<span class="admin-status ' + (v.status || 'active') + '">' + (v.status || 'active') + '</span>')
            + '</table>';

        // Price tiers
        var tierHtml = '';
        if (priceTiers.price_1_3 || priceTiers.price_4_7 || priceTiers.price_8_14 || priceTiers.price_15_30) {
            tierHtml = '<h4 style="margin:16px 0 8px;font-size:14px;color:#EAEAEA;">Price Tiers</h4>'
                + '<div style="display:flex;gap:12px;flex-wrap:wrap;">'
                + (priceTiers.price_1_3 ? '<span style="padding:4px 12px;background:#262A35;border-radius:6px;font-size:12px;color:#A0A3B0;">1-3d: $' + priceTiers.price_1_3 + '</span>' : '')
                + (priceTiers.price_4_7 ? '<span style="padding:4px 12px;background:#262A35;border-radius:6px;font-size:12px;color:#A0A3B0;">4-7d: $' + priceTiers.price_4_7 + '</span>' : '')
                + (priceTiers.price_8_14 ? '<span style="padding:4px 12px;background:#262A35;border-radius:6px;font-size:12px;color:#A0A3B0;">8-14d: $' + priceTiers.price_8_14 + '</span>' : '')
                + (priceTiers.price_15_30 ? '<span style="padding:4px 12px;background:#262A35;border-radius:6px;font-size:12px;color:#A0A3B0;">15-30d: $' + priceTiers.price_15_30 + '</span>' : '')
                + '</div>';
        }

        // Features
        var featKeys = Object.keys(features).filter(function(k) { return features[k]; });
        var featHtml = '';
        if (featKeys.length) {
            featHtml = '<h4 style="margin:16px 0 8px;font-size:14px;color:#EAEAEA;">Features</h4>'
                + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
                + featKeys.map(function(k) { return '<span style="padding:4px 10px;background:#dcfce7;color:#16a34a;border-radius:6px;font-size:11px;font-weight:600;">' + k.replace(/_/g, ' ') + '</span>'; }).join('')
                + '</div>';
        }

        // Extras
        var extKeys = Object.keys(extras).filter(function(k) { return !k.endsWith('_available') && extras[k] && extras[k] !== '0'; });
        var extHtml = '';
        if (extKeys.length) {
            extHtml = '<h4 style="margin:16px 0 8px;font-size:14px;color:#EAEAEA;">Extras</h4>'
                + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
                + extKeys.map(function(k) {
                    var val = extras[k];
                    var label = k.replace(/_/g, ' ');
                    if (val === true || val === 1) return '<span style="padding:4px 10px;background:rgba(201,168,76,0.12);color:#C9A84C;border-radius:6px;font-size:11px;font-weight:600;">' + label + '</span>';
                    return '<span style="padding:4px 10px;background:rgba(201,168,76,0.12);color:#C9A84C;border-radius:6px;font-size:11px;font-weight:600;">' + label + ': $' + val + '</span>';
                }).join('')
                + '</div>';
        }

        // Tech Passport Photos
        var tpHtml = '';
        if (v.tech_passport_front || v.tech_passport_back) {
            tpHtml = '<h4 style="margin:20px 0 10px;font-size:14px;color:#EAEAEA;">Tech Passport</h4>'
                + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">';
            if (v.tech_passport_front) {
                tpHtml += '<div><p style="font-size:11px;color:#A0A3B0;margin:0 0 4px;font-weight:600;">Front</p>'
                    + '<img src="' + v.tech_passport_front + '" style="width:100%;border-radius:8px;border:1px solid #3A3F4B;cursor:pointer;" onclick="window.open(this.src)"></div>';
            }
            if (v.tech_passport_back) {
                tpHtml += '<div><p style="font-size:11px;color:#A0A3B0;margin:0 0 4px;font-weight:600;">Back</p>'
                    + '<img src="' + v.tech_passport_back + '" style="width:100%;border-radius:8px;border:1px solid #3A3F4B;cursor:pointer;" onclick="window.open(this.src)"></div>';
            }
            tpHtml += '</div>';
        } else {
            tpHtml = '<h4 style="margin:20px 0 10px;font-size:14px;color:#EAEAEA;">Tech Passport</h4>'
                + '<p style="color:#A0A3B0;font-size:13px;">No tech passport photos uploaded.</p>';
        }

        content.innerHTML = imgHtml + specHtml + tierHtml + featHtml + extHtml + tpHtml;
        modal.style.display = 'block';
    };

    function applyVehicleFilters() {
        var statusFilter = document.getElementById('vehicleStatusFilter').value;
        var q = document.getElementById('vehicleSearch').value.toLowerCase();
        var rows = document.querySelectorAll('#vehiclesTableBody tr');
        rows.forEach(function (r) {
            var matchText = !q || r.textContent.toLowerCase().indexOf(q) !== -1;
            var statusEl = r.querySelector('.admin-status');
            var matchStatus = !statusFilter || (statusEl && statusEl.textContent === statusFilter);
            r.style.display = (matchText && matchStatus) ? '' : 'none';
        });
    }

    document.getElementById('vehicleStatusFilter').addEventListener('change', applyVehicleFilters);
    document.getElementById('vehicleSearch').addEventListener('input', applyVehicleFilters);

    function loadBookings() {
        var statusFilter = document.getElementById('bookingStatusFilter').value;
        var url = '/api/admin/bookings' + (statusFilter ? '?status=' + encodeURIComponent(statusFilter) : '');
        apiGet(url).then(function (data) {
            var tbody = document.getElementById('bookingsTableBody');
            var bookings = data.bookings || [];
            if (bookings.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#A0A3B0;padding:30px;">No bookings found</td></tr>';
                return;
            }
            tbody.innerHTML = bookings.map(function (b) {
                var status = b.status || 'pending';
                var pickupTime = b.pickup_time || '10:00';
                var dropoffTime = b.dropoff_time || '10:00';
                var dateRange = (b.pickup_date || '-') + ' ' + pickupTime + ' → ' + (b.dropoff_date || '-') + ' ' + dropoffTime;
                var partnerLabel = b.partner_company || b.partner_name || '-';
                var actions = '';
                if (status === 'pending') {
                    actions = '<button class="admin-action-btn success" onclick="adminUpdateBookingStatus(' + b.id + ',\'accepted\')">Accept</button>'
                        + '<button class="admin-action-btn danger" onclick="adminUpdateBookingStatus(' + b.id + ',\'rejected\')">Reject</button>';
                } else if (status === 'accepted') {
                    actions = '<button class="admin-action-btn danger" onclick="adminUpdateBookingStatus(' + b.id + ',\'cancelled\')">Cancel</button>';
                } else if (status === 'cancel_requested') {
                    actions = '<button class="admin-action-btn danger" onclick="adminUpdateBookingStatus(' + b.id + ',\'cancelled\')">Approve Cancel</button>'
                        + '<button class="admin-action-btn" onclick="adminUpdateBookingStatus(' + b.id + ',\'accepted\')">Deny Cancel</button>';
                } else {
                    actions = '<span class="admin-muted">No actions</span>';
                }
                var statusLabel = status === 'cancel_requested' ? 'Cancel Requested' : status;
                var payStatus = String(b.payment_status || 'unpaid');
                var payBadge = '';
                if (payStatus === 'paid') {
                    payBadge = '<span class="admin-status accepted" style="font-size:10px;">Paid</span>';
                } else if (payStatus === 'refunded') {
                    payBadge = '<span class="admin-status pending" style="font-size:10px;">Refunded</span>';
                } else {
                    payBadge = '<span class="admin-status inactive" style="font-size:10px;">Unpaid</span>';
                }
                // Add refund button for paid bookings that are cancelled
                if (payStatus === 'paid' && (status === 'cancelled' || status === 'rejected')) {
                    actions += ' <button class="admin-action-btn" style="color:#7c3aed;border-color:#c4b5fd;" onclick="adminRefundBooking(' + b.id + ')">Refund</button>';
                }
                return '<tr>'
                    + '<td>' + b.id + '</td>'
                    + '<td><strong>' + escHtml(b.vehicle_name || '-') + '</strong></td>'
                    + '<td>' + escHtml(b.guest_name || '-') + '<br><span class="admin-subtle">' + escHtml(b.guest_email || '') + '</span></td>'
                    + '<td>' + escHtml(partnerLabel) + '</td>'
                    + '<td>' + dateRange + '</td>'
                    + '<td><strong>' + fmtMoney(b.total_price) + '</strong><br><span class="admin-subtle">Fee ' + fmtMoney(b.service_fee) + '</span> ' + payBadge + '</td>'
                    + '<td><span class="admin-status ' + status + '" data-status="' + status + '">' + statusLabel + '</span></td>'
                    + '<td>' + actions + '</td>'
                    + '</tr>';
            }).join('');
            applyBookingFilters();
        });
    }

    function applyBookingFilters() {
        var q = document.getElementById('bookingSearch').value.toLowerCase();
        var statusFilter = document.getElementById('bookingStatusFilter').value;
        var rows = document.querySelectorAll('#bookingsTableBody tr');
        rows.forEach(function (r) {
            var matchText = !q || r.textContent.toLowerCase().indexOf(q) !== -1;
            var badge = r.querySelector('.admin-status');
            var matchStatus = !statusFilter || (badge && (badge.getAttribute('data-status') || badge.textContent) === statusFilter);
            r.style.display = (matchText && matchStatus) ? '' : 'none';
        });
    }

    window.adminRefundBooking = function (id) {
        if (!confirm('Refund the service fee for booking #' + id + '? This will send money back to the customer via PayPal.')) return;
        fetch('/api/payments/refund', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ booking_id: id })
        }).then(function (r) { return r.json(); }).then(function (data) {
            if (data.error) { alert('Refund failed: ' + data.error); return; }
            alert('Refund processed successfully!');
            loadBookings();
            loadAnalytics();
        }).catch(function () { alert('Refund request failed'); });
    };

    window.adminUpdateBookingStatus = function (id, status) {
        var questions = {
            accepted: 'Accept this reservation?',
            rejected: 'Reject this reservation?',
            cancelled: 'Cancel this reservation? Dates will be unblocked.'
        };
        if (!confirm(questions[status] || 'Update this reservation?')) return;
        apiPatch('/api/admin/bookings/' + id + '/status', { status: status }).then(function (data) {
            if (data.error) {
                alert(data.error);
                return;
            }
            loadBookings();
            loadAnalytics();
        });
    };

    document.getElementById('bookingStatusFilter').addEventListener('change', loadBookings);
    document.getElementById('bookingSearch').addEventListener('input', applyBookingFilters);

    // ========================================
    // FINANCIAL TAB
    // ========================================
    var finData = [];

    function loadFinancial() {
        apiGet('/api/admin/financial').then(function(data) {
            finData = data.records || [];
            populateFinMonthFilter();
            renderFinancial();
        });
    }

    function populateFinMonthFilter() {
        var sel = document.getElementById('finMonthFilter');
        var months = {};
        finData.forEach(function(r) {
            var d = r.pickup_date || '';
            var m = d.substring(0, 7); // YYYY-MM
            if (m) months[m] = true;
        });
        var sorted = Object.keys(months).sort().reverse();
        sel.innerHTML = '<option value="">All Time</option>';
        sorted.forEach(function(m) {
            var parts = m.split('-');
            var label = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(parts[1])-1] + ' ' + parts[0];
            sel.innerHTML += '<option value="' + m + '">' + label + '</option>';
        });
    }

    function renderFinancial() {
        var monthFilter = document.getElementById('finMonthFilter').value;
        var statusFilter = document.getElementById('finStatusFilter').value;

        var filtered = finData.filter(function(r) {
            if (monthFilter && (r.pickup_date || '').indexOf(monthFilter) !== 0) return false;
            if (statusFilter === 'active' && !r.is_active) return false;
            if (statusFilter === 'cancelled' && r.is_active) return false;
            return true;
        });

        // Summary
        var totalIncome = 0;
        var cancelledIncome = 0;
        var activeCount = 0;
        filtered.forEach(function(r) {
            if (r.is_active) {
                totalIncome += r.service_fee;
                activeCount++;
            } else {
                cancelledIncome += r.service_fee;
            }
        });
        var avgFee = activeCount > 0 ? totalIncome / activeCount : 0;

        document.getElementById('finTotalIncome').textContent = '$' + totalIncome.toFixed(2);
        document.getElementById('finActiveCount').textContent = activeCount;
        document.getElementById('finCancelledIncome').textContent = '$' + cancelledIncome.toFixed(2);
        document.getElementById('finAvgFee').textContent = '$' + avgFee.toFixed(2);

        // Table
        var tbody = document.getElementById('finTableBody');
        tbody.innerHTML = '';
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:#A0A3B0;">No financial records found</td></tr>';
            return;
        }
        filtered.forEach(function(r) {
            var statusCls = r.is_active ? 'fin-status-active' : 'fin-status-cancelled';
            var statusLabel = r.is_active ? (r.status === 'cancel_requested' ? 'Pending Cancel' : 'Active') : 'Cancelled';
            var payCls = r.payment_status === 'paid' ? 'fin-status-active' : (r.payment_status === 'refunded' ? 'fin-status-cancelled' : '');
            var payLabel = r.payment_status === 'paid' ? 'Paid' : (r.payment_status === 'refunded' ? 'Refunded' : 'Unpaid');
            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td>#' + r.id + '</td>' +
                '<td>' + escHtml(r.vehicle_name || '') + '</td>' +
                '<td>' + escHtml(r.guest_name || r.guest_email || '') + '</td>' +
                '<td>' + (r.pickup_date || '') + ' → ' + (r.dropoff_date || '') + '</td>' +
                '<td>$' + r.rental_total.toFixed(2) + '</td>' +
                '<td>$' + r.extras_total.toFixed(2) + '</td>' +
                '<td><strong>$' + r.service_fee.toFixed(2) + '</strong></td>' +
                '<td>$' + r.total_price.toFixed(2) + '</td>' +
                '<td><span class="' + payCls + '" style="' + (payCls ? '' : 'color:#A0A3B0;font-size:11px;') + '">' + payLabel + '</span></td>' +
                '<td><span class="' + statusCls + '">' + statusLabel + '</span></td>';
            if (!r.is_active) tr.style.opacity = '0.6';
            tbody.appendChild(tr);
        });
    }

    document.getElementById('finMonthFilter').addEventListener('change', renderFinancial);
    document.getElementById('finStatusFilter').addEventListener('change', renderFinancial);

    // ========================================
    // BULK ACTIONS
    // ========================================
    window.adminBulkApproveVehicles = function () {
        if (!confirm('Approve ALL pending vehicles?')) return;
        fetch('/api/admin/bulk/approve-vehicles', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                alert(data.message || 'Done');
                loadVehicles();
                loadAnalytics();
            }).catch(function () { alert('Bulk approve failed'); });
    };

    window.adminBulkApprovePartners = function () {
        if (!confirm('Verify ALL unverified partners?')) return;
        fetch('/api/admin/bulk/approve-partners', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                alert(data.message || 'Done');
                loadPartners();
            }).catch(function () { alert('Bulk verify failed'); });
    };

    // ========================================
    // CSV EXPORT
    // ========================================
    window.adminExportBookingsCSV = function () {
        window.open('/api/admin/export/bookings?token=' + encodeURIComponent(token), '_blank');
    };

    window.adminExportFinancialCSV = function () {
        window.open('/api/admin/export/financial?token=' + encodeURIComponent(token), '_blank');
    };

    // ========================================
    // PROMO CODES
    // ========================================
    document.getElementById('showAddPromoBtn').addEventListener('click', function () {
        document.getElementById('addPromoForm').style.display = document.getElementById('addPromoForm').style.display === 'none' ? 'block' : 'none';
    });

    function loadPromos() {
        apiGet('/api/admin/promo-codes').then(function (data) {
            var tbody = document.getElementById('promosTableBody');
            var codes = data.codes || [];
            if (codes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#A0A3B0;padding:30px;">No promo codes yet</td></tr>';
                return;
            }
            tbody.innerHTML = codes.map(function (c) {
                var discountLabel = c.discount_type === 'percent' ? c.discount_value + '%' : '$' + c.discount_value;
                var usesLabel = c.used_count + (c.max_uses > 0 ? ' / ' + c.max_uses : ' / ∞');
                var validUntil = c.valid_until ? new Date(c.valid_until).toLocaleDateString() : 'No limit';
                var activeBadge = c.is_active
                    ? '<span class="admin-status" style="background:#dcfce7;color:#16a34a;">Active</span>'
                    : '<span class="admin-status" style="background:#fee2e2;color:#dc2626;">Inactive</span>';
                var toggleBtn = c.is_active
                    ? '<button class="admin-action-btn" style="color:#d97706;border-color:#fcd34d;" onclick="adminTogglePromo(' + c.id + ',false)">Disable</button>'
                    : '<button class="admin-action-btn success" onclick="adminTogglePromo(' + c.id + ',true)">Enable</button>';
                return '<tr>'
                    + '<td>' + c.id + '</td>'
                    + '<td><strong style="font-family:monospace;letter-spacing:1px;">' + c.code + '</strong></td>'
                    + '<td>' + discountLabel + '</td>'
                    + '<td>$' + (c.min_order || 0) + '</td>'
                    + '<td>' + usesLabel + '</td>'
                    + '<td>' + validUntil + '</td>'
                    + '<td>' + activeBadge + '</td>'
                    + '<td>' + toggleBtn + ' <button class="admin-action-btn danger" onclick="adminDeletePromo(' + c.id + ')">Delete</button></td>'
                    + '</tr>';
            }).join('');
        });
    }

    window.adminCreatePromo = function () {
        var code = document.getElementById('promoCode').value.trim();
        var type = document.getElementById('promoType').value;
        var value = document.getElementById('promoValue').value;
        var minOrder = document.getElementById('promoMinOrder').value;
        var maxUses = document.getElementById('promoMaxUses').value;
        var validUntil = document.getElementById('promoValidUntil').value;
        if (!code || !value) { alert('Code and value are required'); return; }
        fetch('/api/admin/promo-codes', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code, discount_type: type, discount_value: value, min_order: minOrder, max_uses: maxUses, valid_until: validUntil || null })
        }).then(function (r) { return r.json(); }).then(function (data) {
            if (data.error) { alert('Error: ' + data.error); return; }
            document.getElementById('addPromoForm').style.display = 'none';
            document.getElementById('promoCode').value = '';
            document.getElementById('promoValue').value = '';
            document.getElementById('promoMinOrder').value = '';
            document.getElementById('promoMaxUses').value = '';
            document.getElementById('promoValidUntil').value = '';
            loadPromos();
        }).catch(function () { alert('Failed to create promo code'); });
    };

    window.adminTogglePromo = function (id, active) {
        apiPut('/api/admin/promo-codes/' + id, { is_active: active }).then(function () { loadPromos(); });
    };

    window.adminDeletePromo = function (id) {
        if (!confirm('Delete this promo code?')) return;
        apiDelete('/api/admin/promo-codes/' + id).then(function () { loadPromos(); });
    };

    // ========================================
    // ACTIVITY FEED
    // ========================================
    function loadActivity() {
        apiGet('/api/admin/activity').then(function (data) {
            var feed = document.getElementById('activityFeed');
            var activities = data.activities || [];
            if (activities.length === 0) {
                feed.innerHTML = '<p style="color:#A0A3B0;text-align:center;padding:40px;">No recent activity</p>';
                return;
            }
            var iconMap = {
                user: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
                calendar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>',
                car: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
                check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
            };
            var colorMap = { registration: '#C9A84C', booking: '#f59e0b', vehicle: '#16a34a', status_change: '#8b5cf6' };
            feed.innerHTML = activities.map(function (a) {
                var icon = iconMap[a.icon] || iconMap.check;
                var color = colorMap[a.type] || '#A0A3B0';
                var timeAgo = getTimeAgo(a.time);
                return '<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #3A3F4B;">'
                    + '<div style="width:32px;height:32px;border-radius:50%;background:' + color + '10;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + icon + '</div>'
                    + '<div style="flex:1;min-width:0;">'
                    + '<p style="margin:0;font-size:13px;color:#EAEAEA;">' + a.text + '</p>'
                    + '<p style="margin:2px 0 0;font-size:11px;color:#A0A3B0;">' + timeAgo + '</p>'
                    + '</div></div>';
            }).join('');
        }).catch(function () {
            document.getElementById('activityFeed').innerHTML = '<p style="color:#ef4444;text-align:center;padding:40px;">Failed to load activity</p>';
        });
    }

    function getTimeAgo(dateStr) {
        if (!dateStr) return '';
        var now = new Date();
        var d = new Date(dateStr);
        var diff = Math.floor((now - d) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
        return d.toLocaleDateString();
    }

    // ========================================
    // USER / PARTNER DETAIL MODAL
    // ========================================
    function udStatCard(label, value, color) {
        return '<div style="background:' + color + '10;border:1px solid ' + color + '30;border-radius:10px;padding:12px 14px;text-align:center;">'
            + '<div style="font-size:18px;font-weight:700;color:' + color + ';">' + value + '</div>'
            + '<div style="font-size:11px;color:#A0A3B0;margin-top:2px;">' + label + '</div></div>';
    }

    window.adminViewUser = function (id) {
        var modal = document.getElementById('userDetailModal');
        var title = document.getElementById('udTitle');
        var content = document.getElementById('udContent');
        content.innerHTML = '<p style="color:#A0A3B0;text-align:center;padding:40px;">Loading...</p>';
        modal.style.display = 'block';
        title.textContent = 'User Details';

        apiGet('/api/admin/users/' + id + '/detail').then(function (data) {
            if (data.error) { content.innerHTML = '<p style="color:#ef4444;text-align:center;padding:40px;">' + data.error + '</p>'; return; }

            var u = data.user;
            var pp = data.partner_profile;
            var stats = data.stats;
            var vehicles = data.vehicles || [];
            var bookings = data.bookings || [];
            var reviews = data.reviews || [];

            title.textContent = (u.full_name || 'User #' + u.id) + (pp && pp.company_name ? ' — ' + pp.company_name : '');

            // Profile
            var roleBadge = '<span class="admin-status ' + u.role + '" style="font-size:11px;">' + u.role + '</span>';
            var approvedBadge = u.is_approved
                ? '<span class="admin-status" style="background:#dcfce7;color:#16a34a;font-size:11px;">Approved</span>'
                : '<span class="admin-status" style="background:#fef3c7;color:#d97706;font-size:11px;">Pending</span>';
            var googleBadge = u.google_id
                ? ' <span class="admin-status" style="background:#e8f0fe;color:#1a73e8;font-size:11px;">Google</span>'
                : '';
            var verifiedBadge = '';
            if (pp) {
                verifiedBadge = pp.is_verified
                    ? ' <span class="admin-status" style="background:#dcfce7;color:#16a34a;font-size:11px;">Verified</span>'
                    : ' <span class="admin-status" style="background:#fef3c7;color:#d97706;font-size:11px;">Unverified</span>';
            }
            var emailVerBadge = u.email_verified
                ? ' <span class="admin-status" style="background:#dcfce7;color:#16a34a;font-size:10px;">Email ✓</span>'
                : ' <span class="admin-status" style="background:#fef3c7;color:#d97706;font-size:10px;">Email ?</span>';
            var phoneVerBadge = u.phone_verified
                ? ' <span class="admin-status" style="background:#dcfce7;color:#16a34a;font-size:10px;">Phone ✓</span>'
                : ' <span class="admin-status" style="background:#fef3c7;color:#d97706;font-size:10px;">Phone ?</span>';
            var initials = (u.full_name || '?').split(' ').map(function(w){return w[0];}).join('').substring(0,2).toUpperCase();
            var avatarHtml = u.avatar_url
                ? '<img src="' + u.avatar_url + '" style="width:52px;height:52px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.style.display=\'none\'">'
                : '<div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#C9A84C,#A6832E);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:18px;flex-shrink:0;">' + initials + '</div>';

            var html = '<div style="display:flex;gap:16px;align-items:flex-start;margin-bottom:20px;padding-bottom:18px;border-bottom:1px solid #3A3F4B;">'
                + avatarHtml
                + '<div style="flex:1;">'
                + '<h4 style="margin:0 0 4px;font-size:16px;">' + escHtml(u.full_name || '-') + '</h4>'
                + '<p style="margin:0 0 6px;color:#A0A3B0;font-size:13px;">' + escHtml(u.email || '-') + (u.phone ? ' &middot; ' + escHtml(u.phone) : '') + '</p>'
                + '<div style="display:flex;gap:6px;flex-wrap:wrap;">' + roleBadge + ' ' + approvedBadge + googleBadge + verifiedBadge + emailVerBadge + phoneVerBadge + '</div>'
                + (pp && pp.location ? '<p style="margin:6px 0 0;color:#A0A3B0;font-size:12px;">📍 ' + escHtml(pp.location) + '</p>' : '')
                + (pp && pp.description ? '<p style="margin:4px 0 0;color:#A0A3B0;font-size:12px;">' + escHtml(pp.description) + '</p>' : '')
                + (pp && pp.whatsapp ? '<p style="margin:4px 0 0;color:#A0A3B0;font-size:12px;">WhatsApp: ' + escHtml(pp.whatsapp) + '</p>' : '')
                + (pp && pp.telegram ? '<p style="margin:4px 0 0;color:#A0A3B0;font-size:12px;">Telegram: ' + escHtml(pp.telegram) + '</p>' : '')
                + '<p style="margin:6px 0 0;color:#A0A3B0;font-size:11px;">Joined: ' + (u.created_at ? new Date(u.created_at).toLocaleDateString() : '-') + (u.updated_at ? ' &middot; Updated: ' + new Date(u.updated_at).toLocaleDateString() : '') + '</p>'
                + '</div></div>';

            // Legal & Contact Information
            var infoStyle = 'padding:6px 0;border-bottom:1px solid #3A3F4B;display:flex;justify-content:space-between;font-size:12px;';
            var labelStyle = 'color:#A0A3B0;font-weight:600;';
            var valueStyle = 'color:#EAEAEA;text-align:right;';
            var sectionTitle = 'margin:0 0 10px;font-size:14px;color:#EAEAEA;';

            html += '<div style="background:#262A35;border:1px solid #3A3F4B;border-radius:12px;padding:16px 20px;margin-bottom:20px;">'
                + '<h4 style="' + sectionTitle + '">Legal & Contact Information</h4>'
                + '<div style="' + infoStyle + '"><span style="' + labelStyle + '">Full Name</span><span style="' + valueStyle + '">' + escHtml(u.full_name || '-') + '</span></div>'
                + '<div style="' + infoStyle + '"><span style="' + labelStyle + '">Email</span><span style="' + valueStyle + '">' + escHtml(u.email || '-') + '</span></div>'
                + '<div style="' + infoStyle + '"><span style="' + labelStyle + '">Phone</span><span style="' + valueStyle + '">' + escHtml(u.phone || 'Not provided') + '</span></div>'
                + '<div style="' + infoStyle + '"><span style="' + labelStyle + '">Phone Verified</span><span style="' + valueStyle + '">' + (u.phone_verified ? '<span style="color:#16a34a;font-weight:700;">Yes ✓</span>' : '<span style="color:#dc2626;font-weight:700;">No ✗</span>') + '</span></div>'
                + '<div style="' + infoStyle + '"><span style="' + labelStyle + '">Email Verified</span><span style="' + valueStyle + '">' + (u.email_verified ? '<span style="color:#16a34a;font-weight:700;">Yes ✓</span>' : '<span style="color:#dc2626;font-weight:700;">No ✗</span>') + '</span></div>'
                + '<div style="' + infoStyle + '"><span style="' + labelStyle + '">Account Verified</span><span style="' + valueStyle + '">' + (u.is_verified ? '<span style="color:#16a34a;font-weight:700;">Yes ✓</span>' : '<span style="color:#dc2626;font-weight:700;">No ✗</span>') + '</span></div>'
                + '<div style="' + infoStyle + '"><span style="' + labelStyle + '">Account Status</span><span style="' + valueStyle + '">' + (u.is_approved ? '<span style="color:#16a34a;">Active</span>' : '<span style="color:#dc2626;">Suspended</span>') + '</span></div>'
                + '<div style="' + infoStyle + '"><span style="' + labelStyle + '">Role</span><span style="' + valueStyle + '">' + u.role + '</span></div>'
                + '<div style="' + infoStyle + '"><span style="' + labelStyle + '">Auth Method</span><span style="' + valueStyle + '">' + (u.google_id ? 'Google OAuth' : 'Email/Password') + '</span></div>'
                + '<div style="' + infoStyle + 'border:none;"><span style="' + labelStyle + '">User ID</span><span style="' + valueStyle + '">#' + u.id + '</span></div>';

            if (pp) {
                html += '<div style="border-top:1px solid #3A3F4B;margin-top:8px;padding-top:8px;">'
                    + '<h4 style="' + sectionTitle + 'margin-top:4px;">Partner Business Info</h4>'
                    + '<div style="' + infoStyle + '"><span style="' + labelStyle + '">Company Name</span><span style="' + valueStyle + '">' + escHtml(pp.company_name || '-') + '</span></div>'
                    + '<div style="' + infoStyle + '"><span style="' + labelStyle + '">Location</span><span style="' + valueStyle + '">' + escHtml(pp.location || 'Not provided') + '</span></div>'
                    + '<div style="' + infoStyle + '"><span style="' + labelStyle + '">Description</span><span style="' + valueStyle + 'max-width:260px;">' + escHtml(pp.description || 'Not provided') + '</span></div>'
                    + '<div style="' + infoStyle + '"><span style="' + labelStyle + '">WhatsApp</span><span style="' + valueStyle + '">' + escHtml(pp.whatsapp || 'Not provided') + '</span></div>'
                    + '<div style="' + infoStyle + '"><span style="' + labelStyle + '">Telegram</span><span style="' + valueStyle + '">' + escHtml(pp.telegram || 'Not provided') + '</span></div>'
                    + '<div style="' + infoStyle + 'border:none;"><span style="' + labelStyle + '">Partner Verified</span><span style="' + valueStyle + '">' + (pp.is_verified ? '<span style="color:#16a34a;font-weight:700;">Yes ✓</span>' : '<span style="color:#dc2626;font-weight:700;">No ✗</span>') + '</span></div>'
                    + '</div>';
            }
            html += '</div>';

            // Stats
            html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:20px;">'
                + udStatCard('Bookings', stats.total_bookings, '#C9A84C')
                + udStatCard('Active', stats.active_bookings, '#f59e0b')
                + udStatCard('Revenue', '$' + stats.total_revenue.toFixed(2), '#16a34a')
                + udStatCard('Fees', '$' + stats.total_service_fees.toFixed(2), '#8b5cf6');
            if (u.role === 'partner') {
                html += udStatCard('Vehicles', stats.total_vehicles, '#06b6d4')
                    + udStatCard('Active Cars', stats.active_vehicles, '#22c55e');
            }
            html += '</div>';

            // Vehicles (partner)
            if (vehicles.length > 0) {
                html += '<h4 style="margin:0 0 10px;font-size:14px;color:#EAEAEA;">Vehicles (' + vehicles.length + ')</h4>'
                    + '<div style="overflow-x:auto;margin-bottom:20px;"><table style="width:100%;border-collapse:collapse;font-size:12px;">'
                    + '<thead><tr style="background:#262A35;"><th style="padding:8px 10px;text-align:left;color:#A0A3B0;border-bottom:1px solid #3A3F4B;">Image</th><th style="padding:8px 10px;text-align:left;color:#A0A3B0;border-bottom:1px solid #3A3F4B;">Name</th><th style="padding:8px 10px;text-align:left;color:#A0A3B0;border-bottom:1px solid #3A3F4B;">Category</th><th style="padding:8px 10px;text-align:left;color:#A0A3B0;border-bottom:1px solid #3A3F4B;">Price/Day</th><th style="padding:8px 10px;text-align:left;color:#A0A3B0;border-bottom:1px solid #3A3F4B;">Year</th><th style="padding:8px 10px;text-align:left;color:#A0A3B0;border-bottom:1px solid #3A3F4B;">Status</th></tr></thead><tbody>';
                vehicles.forEach(function (v) {
                    var img = v.image_url ? '<img src="' + v.image_url + '" style="width:48px;height:32px;object-fit:cover;border-radius:4px;">' : '<span style="color:#A0A3B0;">—</span>';
                    html += '<tr style="border-bottom:1px solid #3A3F4B;">'
                        + '<td style="padding:6px 10px;">' + img + '</td>'
                        + '<td style="padding:6px 10px;font-weight:600;">' + (v.name || '-') + '</td>'
                        + '<td style="padding:6px 10px;">' + (v.category || '-') + '</td>'
                        + '<td style="padding:6px 10px;">$' + (v.price_per_day || 0) + '</td>'
                        + '<td style="padding:6px 10px;">' + (v.year || '-') + '</td>'
                        + '<td style="padding:6px 10px;"><span class="admin-status ' + (v.status || 'active') + '" style="font-size:10px;">' + (v.status || 'active') + '</span></td>'
                        + '</tr>';
                });
                html += '</tbody></table></div>';
            }

            // Bookings
            if (bookings.length > 0) {
                html += '<h4 style="margin:0 0 10px;font-size:14px;color:#EAEAEA;">Bookings (' + bookings.length + ')</h4>'
                    + '<div style="overflow-x:auto;margin-bottom:20px;"><table style="width:100%;border-collapse:collapse;font-size:12px;">'
                    + '<thead><tr style="background:#262A35;"><th style="padding:8px 10px;text-align:left;color:#A0A3B0;border-bottom:1px solid #3A3F4B;">#</th><th style="padding:8px 10px;text-align:left;color:#A0A3B0;border-bottom:1px solid #3A3F4B;">Vehicle</th><th style="padding:8px 10px;text-align:left;color:#A0A3B0;border-bottom:1px solid #3A3F4B;">' + (u.role === 'partner' ? 'Guest' : 'Partner') + '</th><th style="padding:8px 10px;text-align:left;color:#A0A3B0;border-bottom:1px solid #3A3F4B;">Dates</th><th style="padding:8px 10px;text-align:left;color:#A0A3B0;border-bottom:1px solid #3A3F4B;">Total</th><th style="padding:8px 10px;text-align:left;color:#A0A3B0;border-bottom:1px solid #3A3F4B;">Status</th><th style="padding:8px 10px;text-align:left;color:#A0A3B0;border-bottom:1px solid #3A3F4B;">Payment</th></tr></thead><tbody>';
                bookings.forEach(function (b) {
                    var otherParty = u.role === 'partner' ? (b.guest_name || b.guest_email || '-') : (b.partner_company || '-');
                    var payBadge = b.payment_status === 'paid' ? '<span style="color:#16a34a;font-weight:600;">Paid</span>' : (b.payment_status === 'refunded' ? '<span style="color:#d97706;">Refunded</span>' : '<span style="color:#A0A3B0;">Unpaid</span>');
                    html += '<tr style="border-bottom:1px solid #3A3F4B;">'
                        + '<td style="padding:6px 10px;">' + b.id + '</td>'
                        + '<td style="padding:6px 10px;font-weight:600;">' + (b.vehicle_name || '-') + '</td>'
                        + '<td style="padding:6px 10px;">' + otherParty + '</td>'
                        + '<td style="padding:6px 10px;font-size:11px;">' + (b.pickup_date || '') + ' → ' + (b.dropoff_date || '') + '</td>'
                        + '<td style="padding:6px 10px;">$' + (parseFloat(b.total_price) || 0).toFixed(2) + '</td>'
                        + '<td style="padding:6px 10px;"><span class="admin-status ' + b.status + '" style="font-size:10px;">' + b.status + '</span></td>'
                        + '<td style="padding:6px 10px;">' + payBadge + '</td>'
                        + '</tr>';
                });
                html += '</tbody></table></div>';
            } else {
                html += '<p style="color:#A0A3B0;font-size:13px;margin-bottom:16px;">No bookings yet.</p>';
            }

            // Reviews (guest only)
            if (reviews.length > 0) {
                html += '<h4 style="margin:0 0 10px;font-size:14px;color:#EAEAEA;">Reviews (' + reviews.length + ')</h4>';
                reviews.forEach(function (r) {
                    var stars = '★'.repeat(r.rating || 0) + '☆'.repeat(5 - (r.rating || 0));
                    html += '<div style="background:#262A35;border-radius:8px;padding:12px 14px;margin-bottom:8px;">'
                        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">'
                        + '<span style="color:#f59e0b;font-size:13px;">' + stars + '</span>'
                        + '<span style="color:#A0A3B0;font-size:11px;">' + (r.created_at ? new Date(r.created_at).toLocaleDateString() : '') + '</span>'
                        + '</div>'
                        + (r.title ? '<p style="margin:0 0 4px;font-weight:600;font-size:13px;color:#EAEAEA;">' + r.title + '</p>' : '')
                        + (r.body ? '<p style="margin:0;font-size:12px;color:#A0A3B0;">' + r.body + '</p>' : '')
                        + '</div>';
                });
            }

            // Edit User
            html += '<div style="border-top:1px solid #3A3F4B;padding-top:20px;margin-top:20px;">'
                + '<h4 style="margin:0 0 12px;font-size:14px;color:#EAEAEA;">Edit Profile</h4>'
                + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">'
                + '<div><label style="font-size:11px;color:#A0A3B0;font-weight:600;display:block;margin-bottom:3px;">Name</label>'
                + '<input type="text" id="udEditName" value="' + (u.full_name || '').replace(/"/g, '&quot;') + '" style="width:100%;padding:7px 10px;border:1px solid #3A3F4B;border-radius:6px;font-size:12px;box-sizing:border-box;"></div>'
                + '<div><label style="font-size:11px;color:#A0A3B0;font-weight:600;display:block;margin-bottom:3px;">Email</label>'
                + '<input type="email" id="udEditEmail" value="' + (u.email || '').replace(/"/g, '&quot;') + '" style="width:100%;padding:7px 10px;border:1px solid #3A3F4B;border-radius:6px;font-size:12px;box-sizing:border-box;"></div>'
                + '<div><label style="font-size:11px;color:#A0A3B0;font-weight:600;display:block;margin-bottom:3px;">Phone</label>'
                + '<input type="text" id="udEditPhone" value="' + (u.phone || '').replace(/"/g, '&quot;') + '" style="width:100%;padding:7px 10px;border:1px solid #3A3F4B;border-radius:6px;font-size:12px;box-sizing:border-box;"></div>'
                + '</div>'
                + '<button onclick="adminSaveUserEdit(' + u.id + ')" style="margin-top:10px;padding:7px 20px;background:#C9A84C;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">Save Changes</button>'
                + '</div>';

            // Admin Notes
            html += '<div style="border-top:1px solid #3A3F4B;padding-top:20px;margin-top:20px;">'
                + '<h4 style="margin:0 0 8px;font-size:14px;color:#EAEAEA;">Admin Notes</h4>'
                + '<p style="margin:0 0 8px;font-size:11px;color:#A0A3B0;">Internal notes — not visible to the user.</p>'
                + '<textarea id="udAdminNotes" rows="3" style="width:100%;padding:8px 10px;border:1px solid #3A3F4B;border-radius:6px;font-size:12px;resize:vertical;box-sizing:border-box;font-family:inherit;">' + (u.admin_notes || '') + '</textarea>'
                + '<button onclick="adminSaveNotes(' + u.id + ')" style="margin-top:8px;padding:7px 20px;background:#8b5cf6;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">Save Notes</button>'
                + '</div>';

            content.innerHTML = html;
        }).catch(function () {
            content.innerHTML = '<p style="color:#ef4444;text-align:center;padding:40px;">Failed to load user details</p>';
        });
    };

    // Close modal on backdrop click
    document.getElementById('userDetailModal').addEventListener('click', function(e) {
        if (e.target === this) this.style.display = 'none';
    });

    window.adminSaveUserEdit = function (userId) {
        var name = document.getElementById('udEditName').value.trim();
        var email = document.getElementById('udEditEmail').value.trim();
        var phone = document.getElementById('udEditPhone').value.trim();
        if (!name || !email) { alert('Name and email are required'); return; }
        apiPut('/api/admin/users/' + userId + '/edit', { full_name: name, email: email, phone: phone }).then(function (data) {
            if (data.error) { alert('Error: ' + data.error); return; }
            alert('Profile updated');
            loadUsers();
            loadPartners();
        }).catch(function () { alert('Failed to save'); });
    };

    window.adminSaveNotes = function (userId) {
        var notes = document.getElementById('udAdminNotes').value;
        apiPut('/api/admin/users/' + userId + '/notes', { notes: notes }).then(function (data) {
            if (data.error) { alert('Error: ' + data.error); return; }
            alert('Notes saved');
        }).catch(function () { alert('Failed to save notes'); });
    };

    // ========================================
    // SETTINGS — Change Password
    // ========================================
    window.adminChangePassword = function () {
        var current = document.getElementById('settingsCurrentPw').value;
        var newPw = document.getElementById('settingsNewPw').value;
        var confirm = document.getElementById('settingsConfirmPw').value;
        var msg = document.getElementById('settingsPwMsg');

        function showMsg(text, isError) {
            msg.textContent = text;
            msg.style.display = 'block';
            msg.style.background = isError ? '#fef2f2' : '#dcfce7';
            msg.style.color = isError ? '#dc2626' : '#16a34a';
        }

        if (!current || !newPw || !confirm) { showMsg('All fields are required', true); return; }
        if (newPw !== confirm) { showMsg('New passwords do not match', true); return; }
        if (newPw.length < 8) { showMsg('Password must be at least 8 characters', true); return; }

        apiPut('/api/admin/change-password', { current_password: current, new_password: newPw }).then(function (data) {
            if (data.error) { showMsg(data.error, true); return; }
            showMsg('Password changed successfully!', false);
            document.getElementById('settingsCurrentPw').value = '';
            document.getElementById('settingsNewPw').value = '';
            document.getElementById('settingsConfirmPw').value = '';
        }).catch(function () { showMsg('Failed to change password', true); });
    };

    // Initial load
    loadAnalytics();
})();
