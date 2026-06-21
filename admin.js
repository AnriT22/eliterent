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
            if (tabName === 'partners') { loadPartners(); loadInviteCodes(); }
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
    function apiRequest(url, method, body) {
        return fetch(url, {
            method: method,
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {})
        }).then(function (r) {
            return r.json().then(function (data) {
                if (!r.ok) throw new Error(data.error || 'Request failed (' + r.status + ')');
                return data;
            });
        });
    }
    function esc(s) {
        var d = document.createElement('div');
        d.textContent = s || '';
        return d.innerHTML;
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

        loadVisitors();
    }

    var _excludeBots = false;

    function loadVisitors() {
        var url = '/api/admin/visitors' + (_excludeBots ? '?excludeBots=1' : '');
        apiGet(url).then(function (data) {
            var vGrid = document.getElementById('visitorStatsGrid');
            if (!vGrid) return;

            var liveHtml = data.live > 0
                ? '<span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;background:#22c55e;border-radius:50%;display:inline-block;animation:livePulse 1.5s ease-in-out infinite;"></span>' + data.live + ' online now</span>'
                : '0 online now';

            // Bot stats indicator
            var botIndicator = '';
            if (data.botStats) {
                var total = data.botStats.bots + data.botStats.humans;
                var botPct = total > 0 ? Math.round(data.botStats.bots / total * 100) : 0;
                botIndicator = '<div style="font-size:11px;color:#A0A3B0;margin-top:4px;">'
                    + '<span style="color:#ef4444;font-weight:600;">' + data.botStats.bots + '</span> suspected bots / '
                    + '<span style="color:#22c55e;font-weight:600;">' + data.botStats.humans + '</span> humans this month</div>';
            }

            vGrid.innerHTML = ''
                + statCard('Visitors Today', data.unique.today, 'orange', data.views.today + ' page views')
                + statCard('Visitors This Week', data.unique.week, 'blue', data.views.week + ' page views')
                + statCard('Visitors This Month', data.unique.month, 'purple', data.views.month + ' page views' + botIndicator)
                + statCard('Live Now', data.live, 'green', liveHtml);

            // Daily visitors chart
            renderDualBarChart('dailyVisitorsChart', data.daily, 140);

            // Top pages table
            renderTopPages('topPagesTable', data.topPages);
        }).catch(function () {
            var vGrid = document.getElementById('visitorStatsGrid');
            if (vGrid) vGrid.innerHTML = '<p style="color:#A0A3B0;font-size:13px;">Visitor tracking will appear after some traffic</p>';
        });

        loadRecentVisitors();
    }

    function loadRecentVisitors() {
        var url = '/api/admin/visitors/recent?limit=100' + (_excludeBots ? '&excludeBots=1' : '');
        apiGet(url).then(function (data) {
            var el = document.getElementById('recentVisitorsTable');
            if (!el) return;
            var visitors = data.visitors || [];
            var callerIp = data.callerIp || '';
            var ipLabel = document.getElementById('recentVisitorsCallerIp');
            if (ipLabel && callerIp) {
                ipLabel.innerHTML = 'Your IP: ' + callerIp + ' (highlighted)'
                    + ' &nbsp;|&nbsp; <label style="cursor:pointer;font-size:12px;color:#EAEAEA;">'
                    + '<input type="checkbox" id="excludeBotsToggle" ' + (_excludeBots ? 'checked' : '') + ' style="vertical-align:middle;margin-right:4px;">'
                    + 'Hide suspected bots</label>';
                var toggle = document.getElementById('excludeBotsToggle');
                if (toggle) {
                    toggle.addEventListener('change', function () {
                        _excludeBots = toggle.checked;
                        loadVisitors();
                    });
                }
            }
            if (visitors.length === 0) {
                el.innerHTML = '<p style="color:#94a3b8;font-size:13px;padding:12px;">No visitors yet</p>';
                return;
            }
            function detectDevice(ua) {
                if (!ua) return '?';
                if (/iphone|ipad|ipod/i.test(ua)) return '📱 iOS';
                if (/android/i.test(ua)) return '📱 Android';
                if (/windows/i.test(ua)) return '🖥️ Windows';
                if (/mac os|macintosh/i.test(ua)) return '🖥️ Mac';
                if (/linux/i.test(ua)) return '🖥️ Linux';
                return '?';
            }
            function botBadge(v) {
                if (v.is_bot == 1) return ' <span class="admin-status" style="background:#ef4444;color:#fff;font-size:9px;">BOT</span>';
                if (v.is_verified == 1) return ' <span class="admin-status" style="background:#22c55e;color:#fff;font-size:9px;">HUMAN</span>';
                if (v.visits > 20) return ' <span class="admin-status" style="background:#f59e0b;color:#fff;font-size:9px;">LIKELY BOT</span>';
                return '';
            }
            function fmtTime(ts) {
                if (!ts) return '-';
                var d = new Date(ts);
                var now = new Date();
                var diffMin = Math.floor((now - d) / 60000);
                if (diffMin < 1) return 'just now';
                if (diffMin < 60) return diffMin + 'm ago';
                if (diffMin < 1440) return Math.floor(diffMin / 60) + 'h ago';
                return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            var html = '<table class="admin-table" style="font-size:12px;">'
                + '<thead><tr>'
                + '<th>IP</th>'
                + '<th>Device</th>'
                + '<th>Visits</th>'
                + '<th>Status</th>'
                + '<th class="hide-mobile">Pages</th>'
                + '<th>Last seen</th>'
                + '<th class="hide-mobile">First seen</th>'
                + '</tr></thead><tbody>';
            visitors.forEach(function (v) {
                var isYou = v.ip === callerIp;
                var rowStyle = isYou ? 'background:rgba(201,168,76,0.12);' : '';
                var youBadge = isYou ? ' <span class="admin-status" style="background:#C9A84C;color:#fff;font-size:9px;">YOU</span>' : '';
                var pages = (v.pages || []).map(function(p) { return escHtml(p); }).join(', ');
                html += '<tr style="' + rowStyle + '">'
                    + '<td style="font-family:monospace;font-size:11px;">' + escHtml(v.ip || '-') + youBadge + '</td>'
                    + '<td>' + detectDevice(v.user_agent || '') + '</td>'
                    + '<td><strong>' + v.visits + '</strong></td>'
                    + '<td>' + botBadge(v) + '</td>'
                    + '<td class="hide-mobile" style="font-size:11px;color:#64748b;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + pages + '">' + pages + '</td>'
                    + '<td>' + fmtTime(v.last_seen) + '</td>'
                    + '<td class="hide-mobile">' + fmtTime(v.first_seen) + '</td>'
                    + '</tr>';
            });
            html += '</tbody></table>';
            el.innerHTML = html;
        }).catch(function () {
            var el = document.getElementById('recentVisitorsTable');
            if (el) el.innerHTML = '<p style="color:#94a3b8;font-size:13px;padding:12px;">Failed to load visitor log</p>';
        });
    }

    function renderDualBarChart(containerId, data, maxHeight) {
        var el = document.getElementById(containerId);
        if (!el) return;
        if (!data || data.length === 0) {
            el.innerHTML = '<p style="color:#A0A3B0;font-size:13px;margin:auto;">No data yet — visitor tracking just started</p>';
            return;
        }

        // Parse + sort ascending (oldest left)
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        var parsed = data.map(function (d) {
            var dt = new Date(d.date);
            if (isNaN(dt.getTime())) {
                var parts = String(d.date).split(/[-T]/);
                if (parts.length >= 3) dt = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            }
            return {
                date: dt,
                views: parseInt(d.views) || 0,
                unique: parseInt(d.unique_visitors) || 0
            };
        }).sort(function (a, b) { return a.date - b.date; });

        var maxVal = Math.max.apply(null, parsed.map(function (d) { return d.views; }));
        if (maxVal === 0) maxVal = 1;

        el.innerHTML = '';
        el.className = 'admin-chart-placeholder dual-chart';

        var isMobile = window.innerWidth <= 768;
        var skip = (isMobile && parsed.length > 7) ? 2 : 1;

        parsed.forEach(function (d, idx) {
            var group = document.createElement('div');
            group.className = 'chart-day-group';
            group.title = months[d.date.getMonth()] + ' ' + d.date.getDate() + ': ' + d.unique + ' unique / ' + d.views + ' total views';

            var uniqueH = Math.max(4, (d.unique / maxVal) * (maxHeight - 50));
            var totalH  = Math.max(4, (d.views  / maxVal) * (maxHeight - 50));

            var valLbl = document.createElement('div');
            valLbl.className = 'chart-day-value';
            valLbl.textContent = String(d.unique);

            var wrap = document.createElement('div');
            wrap.className = 'chart-bars-wrap';
            wrap.innerHTML =
                '<div class="chart-bar total-bar" style="height:' + totalH + 'px;"></div>' +
                '<div class="chart-bar unique-bar" style="height:' + uniqueH + 'px;"></div>';

            var lbl = document.createElement('div');
            lbl.className = 'chart-day-label' + (idx % skip !== 0 ? ' muted' : '');
            lbl.textContent = months[d.date.getMonth()] + ' ' + d.date.getDate();

            group.appendChild(valLbl);
            group.appendChild(wrap);
            group.appendChild(lbl);
            el.appendChild(group);
        });

        // Average line
        var avg = parsed.reduce(function (s, d) { return s + d.unique; }, 0) / parsed.length;
        var line = document.createElement('div');
        line.className = 'chart-avg-line';
        line.style.bottom = Math.max(4, (avg / maxVal) * (maxHeight - 50)) + 'px';
        line.title = 'Avg unique: ' + Math.round(avg);
        el.appendChild(line);
    }

    function renderTopPages(containerId, pages) {
        var el = document.getElementById(containerId);
        if (!el) return;
        if (!pages || pages.length === 0) {
            el.innerHTML = '<p style="color:#A0A3B0;font-size:13px;">No data yet</p>';
            return;
        }
        var html = '<table style="width:100%;border-collapse:collapse;font-size:13px;">'
            + '<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.1);">'
            + '<th style="text-align:left;padding:8px;color:#A0A3B0;font-weight:600;">Page</th>'
            + '<th style="text-align:right;padding:8px;color:#A0A3B0;font-weight:600;">Views</th>'
            + '<th style="text-align:right;padding:8px;color:#A0A3B0;font-weight:600;">Unique</th>'
            + '</tr></thead><tbody>';
        pages.forEach(function (p) {
            var pageName = p.page === '/' ? 'Homepage' : p.page.replace(/^\//, '').replace(/\.html$/, '');
            html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">'
                + '<td style="padding:8px;color:#e2e8f0;">' + escHtml(pageName) + '</td>'
                + '<td style="padding:8px;color:#C9A84C;text-align:right;font-weight:600;">' + (parseInt(p.views) || 0) + '</td>'
                + '<td style="padding:8px;color:#94a3b8;text-align:right;">' + (parseInt(p.unique_visitors) || 0) + '</td>'
                + '</tr>';
        });
        html += '</tbody></table>';
        el.innerHTML = html;
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
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        data.slice().reverse().forEach(function (d) {
            var h = Math.max(8, ((d[valueKey] || 0) / maxVal) * (maxHeight - 40));
            var bar = document.createElement('div');
            bar.className = 'admin-bar';
            bar.style.height = h + 'px';
            var raw = d[labelKey] || '';
            var dt = new Date(raw);
            var lbl;
            if (isNaN(dt.getTime())) {
                var parts = String(raw).split(/[-T]/);
                if (parts.length >= 3) dt = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            }
            if (!isNaN(dt.getTime())) {
                lbl = months[dt.getMonth()] + ' ' + dt.getDate();
            } else {
                lbl = String(raw).replace(/^\d{4}-/, '');
            }
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
                    + '<td class="hide-mobile">' + escHtml(u.email || '-') + '</td>'
                    + '<td class="hide-mobile">' + escHtml(u.phone || '-') + '</td>'
                    + '<td><span class="admin-status ' + u.role + '">' + u.role + '</span>' + verifiedBadge + phoneVerBadge + emailVerBadge + '</td>'
                    + '<td>' + approvedBadge + '</td>'
                    + '<td class="hide-mobile">' + date + '</td>'
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
                var signupMethod = p.signup_method || 'paid';
                var typeBadge = signupMethod === 'invite'
                    ? '<span class="admin-status" style="background:rgba(212,175,55,0.15);color:#D4AF37;font-size:10px;" title="Registered with invite code">Invite</span>'
                    : (p.signup_paid
                        ? '<span class="admin-status" style="background:rgba(34,197,94,0.12);color:#22c55e;font-size:10px;" title="Paid $4.99 verification fee">Paid $4.99</span>'
                        : '<span class="admin-status" style="background:rgba(148,163,184,0.12);color:#94a3b8;font-size:10px;" title="Opened PayPal but has not completed payment">Unpaid</span>');
                return '<tr>'
                    + '<td>' + p.id + '</td>'
                    + '<td><strong><a href="#" onclick="adminViewUser(' + p.id + ');return false;" style="color:#C9A84C;text-decoration:none;">' + escHtml(p.full_name || '-') + '</a></strong></td>'
                    + '<td class="hide-mobile"><a href="#" onclick="adminViewUser(' + p.id + ');return false;" style="color:#C9A84C;text-decoration:none;">' + escHtml(p.company_name || '-') + '</a></td>'
                    + '<td class="hide-mobile">' + escHtml(p.email || '-') + '</td>'
                    + '<td class="hide-mobile">' + escHtml(p.phone || '-') + pPhoneBadge + '</td>'
                    + '<td><span class="admin-status ' + verified + '">' + verified + '</span></td>'
                    + '<td class="hide-mobile">' + typeBadge + '</td>'
                    + '<td class="hide-mobile">' + date + '</td>'
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
    // PARTNER INVITE CODES
    // ========================================
    function loadInviteCodes() {
        var tbody = document.getElementById('inviteCodesTableBody');
        if (!tbody) return;
        apiGet('/api/admin/partner-invite-codes').then(function (data) {
            var codes = data.codes || [];
            if (codes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#A0A3B0;padding:20px;">No invite codes yet. Create one above.</td></tr>';
                return;
            }
            tbody.innerHTML = codes.map(function (c) {
                var date = c.created_at ? new Date(c.created_at).toLocaleDateString() : '-';
                var usesText = (c.max_uses && c.max_uses > 0) ? (c.used_count + ' / ' + c.max_uses) : (c.used_count + ' / ∞');
                var statusBadge = c.is_active
                    ? '<span class="admin-status verified" style="font-size:11px;">Active</span>'
                    : '<span class="admin-status unverified" style="font-size:11px;">Inactive</span>';
                var toggleLabel = c.is_active ? 'Disable' : 'Enable';
                return '<tr>'
                    + '<td><strong style="font-family:monospace;letter-spacing:1px;color:#D4AF37;">' + escHtml(c.code) + '</strong></td>'
                    + '<td class="hide-mobile">' + escHtml(c.note || '—') + '</td>'
                    + '<td>' + usesText + '</td>'
                    + '<td>' + statusBadge + '</td>'
                    + '<td class="hide-mobile">' + date + '</td>'
                    + '<td>'
                    + '<button class="admin-action-btn" onclick="toggleInviteCode(' + c.id + ',' + (c.is_active ? 0 : 1) + ')">' + toggleLabel + '</button>'
                    + '<button class="admin-action-btn danger" onclick="deleteInviteCode(' + c.id + ',\'' + escHtml(c.code) + '\')">Delete</button>'
                    + '</td></tr>';
            }).join('');
        }).catch(function () {
            if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#ef4444;padding:20px;">Failed to load invite codes</td></tr>';
        });
    }

    window.showInviteCodeForm = function () {
        var el = document.getElementById('inviteCodeCreateForm');
        if (el) { el.style.display = 'block'; document.getElementById('newInviteCode').focus(); }
    };

    window.hideInviteCodeForm = function () {
        var el = document.getElementById('inviteCodeCreateForm');
        if (el) el.style.display = 'none';
        var errEl = document.getElementById('inviteCodeFormError');
        if (errEl) errEl.style.display = 'none';
    };

    window.createInviteCode = function () {
        var code = (document.getElementById('newInviteCode').value || '').trim().toUpperCase();
        var note = (document.getElementById('newInviteNote').value || '').trim();
        var maxUses = parseInt(document.getElementById('newInviteMaxUses').value) || 0;
        var errEl = document.getElementById('inviteCodeFormError');
        if (!code || !/^[A-Z0-9_-]+$/.test(code)) {
            errEl.textContent = 'Code must be A-Z, 0-9, hyphens or underscores.';
            errEl.style.display = 'block';
            return;
        }
        errEl.style.display = 'none';
        fetch('/api/admin/partner-invite-codes', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code, note: note || null, max_uses: maxUses })
        }).then(function (r) { return r.json(); }).then(function (data) {
            if (data.error) { errEl.textContent = data.error; errEl.style.display = 'block'; return; }
            document.getElementById('newInviteCode').value = '';
            document.getElementById('newInviteNote').value = '';
            document.getElementById('newInviteMaxUses').value = '1';
            window.hideInviteCodeForm();
            loadInviteCodes();
        }).catch(function (err) {
            errEl.textContent = err.message || 'Failed to create code';
            errEl.style.display = 'block';
        });
    };

    window.toggleInviteCode = function (id, newActive) {
        apiPut('/api/admin/partner-invite-codes/' + id, { is_active: newActive }).then(loadInviteCodes);
    };

    window.deleteInviteCode = function (id, code) {
        if (!confirm('Delete invite code "' + code + '"? This cannot be undone.')) return;
        apiDelete('/api/admin/partner-invite-codes/' + id).then(loadInviteCodes);
    };

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
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#A0A3B0;padding:30px;">No vehicles found</td></tr>';
                return;
            }
            tbody.innerHTML = vehicles.map(function (v) {
                var date = v.created_at ? new Date(v.created_at).toLocaleDateString() : '-';
                var imgSrc = v.image_url || '';
                var imgTag = imgSrc ? '<img src="' + imgSrc + '" class="vehicle-thumb">' : '<div class="vehicle-thumb" style="display:inline-flex;align-items:center;justify-content:center;background:#262A35;font-size:14px;">-</div>';
                var status = v.status || 'active';
                var locParts = [];
                if (v.location_city) locParts.push(v.location_city);
                if (v.region && v.region !== v.location_city) locParts.push(v.region);
                var locLabel = locParts.length ? locParts.join(', ') : '-';
                return '<tr draggable="true" data-id="' + v.id + '" class="vehicle-row">'
                    + '<td>' + v.id + '</td>'
                    + '<td class="hide-mobile">' + imgTag + '</td>'
                    + '<td><strong>' + escHtml(v.name || '-') + '</strong></td>'
                    + '<td class="hide-mobile">' + escHtml(v.company_name || v.partner_name || '-') + '</td>'
                    + '<td class="hide-mobile"><span style="font-size:12px;color:#A0A3B0;">' + escHtml(locLabel) + '</span></td>'
                    + '<td>$' + (v.price_per_day || 0) + '</td>'
                    + '<td><span class="admin-status ' + status + '">' + status + '</span></td>'
                    + '<td class="drag-handle" style="text-align:center;color:#A0A3B0;cursor:grab;font-size:20px;user-select:none;" title="Drag to reorder">\u2059</td>'
                    + '<td class="hide-mobile">' + date + '</td>'
                    + '<td>'
                    + '<button class="admin-action-btn primary" onclick="adminViewVehicle(' + v.id + ')">View</button>'
                    + '<button class="admin-action-btn" onclick="adminOpenPin(' + v.id + ')">' + ((parseInt(v.pin_page) > 0 && parseInt(v.pin_position) > 0) ? ('\uD83D\uDCCD P' + v.pin_page + '/' + v.pin_position) : 'Pin') + '</button>'
                    + '<button class="admin-action-btn" style="' + (parseInt(v.is_vip) ? 'background:#16a34a;border-color:#16a34a;color:#fff;' : '') + '" onclick="adminToggleVip(' + v.id + ',' + (parseInt(v.is_vip) ? 0 : 1) + ')">' + (parseInt(v.is_vip) ? '\u2605 VIP' : 'VIP') + '</button>'
                    + '<button class="admin-action-btn" style="' + (parseInt(v.homepage_vip_position) ? 'background:#22c55e;border-color:#22c55e;color:#fff;' : '') + '" onclick="adminSetHomepageVip(' + v.id + ',' + (parseInt(v.homepage_vip_position) || 0) + ')" title="Homepage VIP slot">' + (parseInt(v.homepage_vip_position) ? 'Home VIP ' + v.homepage_vip_position : 'Home VIP') + '</button>'
                    + (status === 'pending' ? '<button class="admin-action-btn success" onclick="adminSetVehicleStatus(' + v.id + ',\'active\')">Approve</button>' : '')
                    + (status === 'delete_requested' ? '<button class="admin-action-btn success" onclick="adminApproveDelete(' + v.id + ')">Approve Delete</button>' : '')
                    + (status === 'delete_requested' ? '<button class="admin-action-btn" onclick="adminRejectDelete(' + v.id + ')">Reject Delete</button>' : '')
                    + (status === 'active' ? '<button class="admin-action-btn" onclick="adminSetVehicleStatus(' + v.id + ',\'inactive\')">Deactivate</button>' : '')
                    + (status === 'inactive' ? '<button class="admin-action-btn success" onclick="adminSetVehicleStatus(' + v.id + ',\'active\')">Activate</button>' : '')
                    + (status !== 'delete_requested' ? '<button class="admin-action-btn danger" onclick="adminDeleteVehicle(' + v.id + ')">Delete</button>' : '')
                    + '</td></tr>';
            }).join('');

            applyVehicleFilters();
            setupVehicleDnd();
        });
    }

    var _dragSrcRow = null;
    function setupVehicleDnd() {
        var tbody = document.getElementById('vehiclesTableBody');
        if (!tbody) return;
        var rows = tbody.querySelectorAll('tr.vehicle-row');
        rows.forEach(function (row) {
            row.addEventListener('dragstart', function (e) {
                _dragSrcRow = row;
                row.style.opacity = '0.4';
                e.dataTransfer.effectAllowed = 'move';
                try { e.dataTransfer.setData('text/plain', row.getAttribute('data-id')); } catch (err) {}
            });
            row.addEventListener('dragend', function () {
                row.style.opacity = '';
            });
            row.addEventListener('dragover', function (e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (!_dragSrcRow || _dragSrcRow === row) return;
                var rect = row.getBoundingClientRect();
                var after = (e.clientY - rect.top) > rect.height / 2;
                if (after) {
                    row.parentNode.insertBefore(_dragSrcRow, row.nextSibling);
                } else {
                    row.parentNode.insertBefore(_dragSrcRow, row);
                }
            });
            row.addEventListener('drop', function (e) {
                e.preventDefault();
                persistVehicleOrder();
            });
        });
    }

    function persistVehicleOrder() {
        var rows = document.querySelectorAll('#vehiclesTableBody tr.vehicle-row');
        var ids = Array.prototype.map.call(rows, function (r) { return parseInt(r.getAttribute('data-id')); });
        ids = ids.filter(function (id) { return !isNaN(id); });
        if (ids.length === 0) return;
        apiPut('/api/admin/vehicles/reorder', { order: ids }).then(function () {
            // keep local cache in sync so re-renders preserve order
            _adminVehicles.sort(function (a, b) { return ids.indexOf(a.id) - ids.indexOf(b.id); });
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

    // ---- Toggle VIP green glow on a vehicle card ----
    window.adminToggleVip = function (id, vip) {
        apiPut('/api/admin/vehicles/' + id + '/vip', { vip: !!vip }).then(function () { loadVehicles(); })
            .catch(function () { alert('Failed to update VIP'); });
    };

    // ---- Set which VIP car appears in a homepage slot (1, 2, or 3) ----
    window.adminSetHomepageVip = function (id, currentPos) {
        var newPos = prompt('Set homepage VIP slot (1, 2, or 3). Leave empty or type 0 to remove.', currentPos || '');
        if (newPos === null) return;
        newPos = parseInt(newPos) || 0;
        if (newPos < 0 || newPos > 3) { alert('Slot must be between 1 and 3 (or 0 to clear).'); return; }
        apiPut('/api/admin/vehicles/' + id + '/homepage-vip', { position: newPos }).then(function () { loadVehicles(); })
            .catch(function () { alert('Failed to update homepage VIP slot'); });
    };

    // ---- Pin a vehicle to an exact page + position on vehicles.html ----
    window.adminOpenPin = function (id) {
        var v = _adminVehicles.find(function (x) { return x.id === id; });
        if (!v) return;
        var curPage = parseInt(v.pin_page) || '';
        var curPos = parseInt(v.pin_position) || '';

        var overlay = document.getElementById('vehiclePinModal');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'vehiclePinModal';
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;';
            overlay.innerHTML =
                '<div style="background:#1C1E26;border:1px solid #3A3F4B;border-radius:14px;padding:24px;width:340px;max-width:92vw;box-shadow:0 20px 60px rgba(0,0,0,0.5);">'
                + '<h3 style="margin:0 0 6px;font-size:17px;color:#EAEAEA;">Pin vehicle on page</h3>'
                + '<p id="pinVehName" style="margin:0 0 16px;font-size:13px;color:#A0A3B0;"></p>'
                + '<div style="display:flex;gap:12px;margin-bottom:8px;">'
                + '<div style="flex:1;"><label style="font-size:12px;color:#A0A3B0;display:block;margin-bottom:4px;">Page</label><input type="number" min="1" id="pinPageInput" style="width:100%;padding:10px 12px;border:1px solid #3A3F4B;border-radius:8px;background:#262A35;color:#EAEAEA;box-sizing:border-box;"></div>'
                + '<div style="flex:1;"><label style="font-size:12px;color:#A0A3B0;display:block;margin-bottom:4px;">Position (1-12)</label><input type="number" min="1" max="12" id="pinPositionInput" style="width:100%;padding:10px 12px;border:1px solid #3A3F4B;border-radius:8px;background:#262A35;color:#EAEAEA;box-sizing:border-box;"></div>'
                + '</div>'
                + '<p style="font-size:11px;color:#6b7280;margin:0 0 16px;">12 cards per page. Position 1 = top-left of that page. Leave blank to unpin.</p>'
                + '<div style="display:flex;gap:8px;justify-content:flex-end;">'
                + '<button class="admin-action-btn" id="pinClearBtn">Unpin</button>'
                + '<button class="admin-action-btn" id="pinCancelBtn">Cancel</button>'
                + '<button class="admin-action-btn success" id="pinSaveBtn">Save</button>'
                + '</div>'
                + '</div>';
            document.body.appendChild(overlay);
            overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.style.display = 'none'; });
        }

        overlay.style.display = 'flex';
        document.getElementById('pinVehName').textContent = '#' + v.id + ' — ' + (v.name || 'Vehicle');
        document.getElementById('pinPageInput').value = curPage;
        document.getElementById('pinPositionInput').value = curPos;

        function save(page, position) {
            apiPut('/api/admin/vehicles/' + id + '/pin', { page: page, position: position }).then(function () {
                overlay.style.display = 'none';
                loadVehicles();
            }).catch(function () { alert('Failed to update pin'); });
        }

        document.getElementById('pinSaveBtn').onclick = function () {
            var page = parseInt(document.getElementById('pinPageInput').value) || 0;
            var position = parseInt(document.getElementById('pinPositionInput').value) || 0;
            if (page > 0 && (position < 1 || position > 12)) { alert('Position must be between 1 and 12.'); return; }
            save(page, position);
        };
        document.getElementById('pinClearBtn').onclick = function () { save(0, 0); };
        document.getElementById('pinCancelBtn').onclick = function () { overlay.style.display = 'none'; };
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
                    + '<td class="hide-mobile">' + escHtml(b.guest_name || '-') + '<br><span class="admin-subtle">' + escHtml(b.guest_email || '') + '</span></td>'
                    + '<td class="hide-mobile">' + escHtml(partnerLabel) + '</td>'
                    + '<td class="hide-mobile">' + dateRange + '</td>'
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
                '<td class="hide-mobile">' + escHtml(r.guest_name || r.guest_email || '') + '</td>' +
                '<td class="hide-mobile">' + (r.pickup_date || '') + ' → ' + (r.dropoff_date || '') + '</td>' +
                '<td class="hide-mobile">$' + r.rental_total.toFixed(2) + '</td>' +
                '<td class="hide-mobile">$' + r.extras_total.toFixed(2) + '</td>' +
                '<td><strong>$' + r.service_fee.toFixed(2) + '</strong></td>' +
                '<td>$' + r.total_price.toFixed(2) + '</td>' +
                '<td class="hide-mobile"><span class="' + payCls + '" style="' + (payCls ? '' : 'color:#A0A3B0;font-size:11px;') + '">' + payLabel + '</span></td>' +
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
                    + '<td class="hide-mobile">$' + (c.min_order || 0) + '</td>'
                    + '<td class="hide-mobile">' + usesLabel + '</td>'
                    + '<td class="hide-mobile">' + validUntil + '</td>'
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
                return '<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #E2E5EB;">'
                    + '<div style="width:32px;height:32px;border-radius:50%;background:' + color + '10;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + icon + '</div>'
                    + '<div style="flex:1;min-width:0;">'
                    + '<p style="margin:0;font-size:13px;color:#1e293b;">' + a.text + '</p>'
                    + '<p style="margin:2px 0 0;font-size:11px;color:#64748b;">' + timeAgo + '</p>'
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

    // ========================================
    // DRIVERS MODERATION
    // ========================================
    var _adminDrivers = [];

    function loadAdminDrivers() {
        var status = document.getElementById('driverStatusFilter').value;
        var url = '/api/drivers/admin/all' + (status ? '?status=' + encodeURIComponent(status) : '');
        apiGet(url).then(function (data) {
            _adminDrivers = data.drivers || [];
            renderAdminDrivers();
        }).catch(function () {
            document.getElementById('driversTableBody').innerHTML = '<tr><td colspan="9" style="text-align:center;color:#ef4444;padding:40px;">Failed to load drivers</td></tr>';
        });
    }

    function renderAdminDrivers() {
        var tbody = document.getElementById('driversTableBody');
        var search = (document.getElementById('driverSearch').value || '').toLowerCase();
        var rows = _adminDrivers;
        if (search) {
            rows = rows.filter(function (d) {
                return (d.full_name || '').toLowerCase().indexOf(search) !== -1 ||
                       (d.partner_name || '').toLowerCase().indexOf(search) !== -1 ||
                       (d.location_city || '').toLowerCase().indexOf(search) !== -1;
            });
        }
        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#A0A3B0;padding:40px;">No drivers found</td></tr>';
            return;
        }
        tbody.innerHTML = rows.map(function (d) {
            var statusClass = d.status === 'approved' ? 'success' : d.status === 'pending' ? 'warning' : 'danger';
            var photo = d.photo_url ? '<img src="' + d.photo_url + '" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">' : '<div style="width:40px;height:40px;border-radius:50%;background:#3A3F4B;"></div>';
            return '<tr>'
                + '<td>' + d.id + '</td>'
                + '<td>' + photo + '</td>'
                + '<td><b>' + esc(d.full_name || '') + '</b><br><span style="font-size:11px;color:#A0A3B0;">' + (d.partner_name || '') + '</span></td>'
                + '<td>' + esc(d.company_name || d.partner_email || '') + '</td>'
                + '<td>' + esc(d.location_city || '') + '</td>'
                + '<td><span class="admin-status ' + statusClass + '">' + d.status + '</span></td>'
                + '<td>' + (d.is_verified ? '<span style="color:#22c55e;font-size:12px;">&#10003; Yes</span>' : '<span style="color:#A0A3B0;font-size:12px;">No</span>') + '</td>'
                + '<td>$' + (d.price_amount || 0) + ' / ' + (d.price_unit || 'day') + '</td>'
                + '<td style="white-space:nowrap;">'
                + '<button class="admin-action-btn small" onclick="adminDriverStatus(' + d.id + ',\'approved\')">Approve</button>'
                + '<button class="admin-action-btn small" onclick="adminDriverStatus(' + d.id + ',\'rejected\')">Reject</button>'
                + '<button class="admin-action-btn small" onclick="adminDriverVerify(' + d.id + ')">' + (d.is_verified ? 'Unverify' : 'Verify') + '</button>'
                + '<button class="admin-action-btn small danger" onclick="adminDriverDelete(' + d.id + ')">Delete</button>'
                + '</td></tr>';
        }).join('');
    }

    window.adminDriverStatus = function (id, status) {
        apiPut('/api/drivers/admin/' + id + '/status', { status: status }).then(function () { loadAdminDrivers(); });
    };
    window.adminDriverVerify = function (id) {
        var d = _adminDrivers.filter(function (x) { return x.id === id; })[0];
        var next = d && d.is_verified ? 0 : 1;
        apiPut('/api/drivers/admin/' + id + '/verify', { is_verified: next }).then(function () { loadAdminDrivers(); });
    };
    window.adminDriverDelete = function (id) {
        if (!confirm('Delete this driver?')) return;
        apiDelete('/api/drivers/admin/' + id).then(function () { loadAdminDrivers(); });
    };

    var driverStatusFilter = document.getElementById('driverStatusFilter');
    var driverSearch = document.getElementById('driverSearch');
    if (driverStatusFilter) driverStatusFilter.addEventListener('change', loadAdminDrivers);
    if (driverSearch) driverSearch.addEventListener('input', renderAdminDrivers);

    // ========================================
    // AD CARDS MANAGEMENT
    // ========================================
    var _adminAds = [];

    function loadAdminAds() {
        apiGet('/api/ads/admin/all').then(function (data) {
            _adminAds = data.ads || [];
            renderAdminAds();
        }).catch(function () {
            document.getElementById('adsTableBody').innerHTML = '<tr><td colspan="6" style="text-align:center;color:#ef4444;padding:40px;">Failed to load ad cards</td></tr>';
        });
    }

    function renderAdminAds() {
        var tbody = document.getElementById('adsTableBody');
        if (_adminAds.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#A0A3B0;padding:40px;">No ad cards yet</td></tr>';
            return;
        }
        tbody.innerHTML = _adminAds.map(function (a) {
            var clicks = a.clicks || 0;
            var clickBadge = clicks > 0 ? '<span style="background:rgba(34,197,94,0.15);color:#22c55e;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;">' + clicks + '</span>' : '<span style="color:#A0A3B0;font-size:11px;">0</span>';
            return '<tr>'
                + '<td>' + a.id + '</td>'
                + '<td><b>' + esc(a.title || 'Untitled') + '</b><br><span style="font-size:11px;color:#A0A3B0;">' + esc(a.target_link || '') + '</span></td>'
                + '<td>' + esc(a.placement || 'cars') + '</td>'
                + '<td>' + a.position + '</td>'
                + '<td>' + clickBadge + '</td>'
                + '<td>' + (a.is_active ? '<span style="color:#22c55e;font-size:12px;">Yes</span>' : '<span style="color:#ef4444;font-size:12px;">No</span>') + '</td>'
                + '<td style="white-space:nowrap;">'
                + '<button class="admin-action-btn small" onclick="adminEditAd(' + a.id + ')">Edit</button>'
                + '<button class="admin-action-btn small danger" onclick="adminDeleteAd(' + a.id + ')">Delete</button>'
                + '</td></tr>';
        }).join('');
    }

    var adFormWrap = document.getElementById('adCardFormWrap');
    var adEditId = document.getElementById('adCardEditId');

    // Iterate the 9 per-language ad fields: cb(payloadKey, elementId)
    var AD_TR_ID = { title: 'adTitle', description: 'adDescription', cta_text: 'adCtaText' };
    function adTrFields(cb) {
        ['title', 'description', 'cta_text'].forEach(function (base) {
            ['ru', 'ka', 'he'].forEach(function (lng) {
                cb(base + '_' + lng, AD_TR_ID[base] + '_' + lng);
            });
        });
    }

    function resetAdForm() {
        adEditId.value = '';
        document.getElementById('adCardFormTitle').textContent = 'New Ad Card';
        document.getElementById('adTitle').value = '';
        document.getElementById('adDescription').value = '';
        document.getElementById('adCoverUrl').value = '';
        document.getElementById('adCoverFile').value = '';
        var previewWrap = document.getElementById('adCoverPreviewWrap');
        if (previewWrap) previewWrap.style.display = 'none';
        var preview = document.getElementById('adCoverPreview');
        if (preview) preview.src = '';
        var status = document.getElementById('adCoverUploadStatus');
        if (status) status.textContent = '';
        document.getElementById('adTargetLink').value = '';
        document.getElementById('adCtaText').value = '';
        document.getElementById('adPlacement').value = 'cars';
        document.getElementById('adPosition').value = '4';
        document.getElementById('adIsActive').checked = true;
        adTrFields(function (key, id) { var el = document.getElementById(id); if (el) el.value = ''; });
    }

    // Ad cover image upload
    var adCoverFile = document.getElementById('adCoverFile');
    var adCoverUploadBtn = document.getElementById('adCoverUploadBtn');
    if (adCoverUploadBtn && adCoverFile) {
        adCoverUploadBtn.addEventListener('click', function () { adCoverFile.click(); });
        adCoverFile.addEventListener('change', function () {
            var file = adCoverFile.files[0];
            if (!file) return;
            var statusEl = document.getElementById('adCoverUploadStatus');
            if (statusEl) statusEl.textContent = 'Uploading...';
            var fd = new FormData();
            fd.append('image', file);
            fetch('/api/upload/ad-cover', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('token') || '') },
                body: fd
            })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.url) {
                    document.getElementById('adCoverUrl').value = data.url;
                    var preview = document.getElementById('adCoverPreview');
                    var previewWrap = document.getElementById('adCoverPreviewWrap');
                    if (preview) preview.src = data.url;
                    if (previewWrap) previewWrap.style.display = '';
                    if (statusEl) statusEl.textContent = 'Uploaded!';
                } else {
                    if (statusEl) statusEl.textContent = data.error || 'Upload failed';
                }
            })
            .catch(function () {
                if (statusEl) statusEl.textContent = 'Upload failed. Try again.';
            });
        });
    }

    document.getElementById('addAdCardBtn').addEventListener('click', function () {
        resetAdForm();
        adFormWrap.style.display = 'block';
    });
    document.getElementById('cancelAdCardBtn').addEventListener('click', function () {
        adFormWrap.style.display = 'none';
    });
    document.getElementById('saveAdCardBtn').addEventListener('click', function () {
        var payload = {
            title: document.getElementById('adTitle').value || null,
            description: document.getElementById('adDescription').value || null,
            cover_url: document.getElementById('adCoverUrl').value || null,
            target_link: document.getElementById('adTargetLink').value,
            cta_text: document.getElementById('adCtaText').value || null,
            placement: document.getElementById('adPlacement').value,
            position: parseInt(document.getElementById('adPosition').value) || 4,
            is_active: document.getElementById('adIsActive').checked
        };
        adTrFields(function (key, id) { var el = document.getElementById(id); payload[key] = (el && el.value) ? el.value : null; });
        if (!payload.target_link) { alert('Target link is required'); return; }
        var editId = adEditId.value;
        var url = editId ? '/api/ads/admin/' + editId : '/api/ads/admin';
        var method = editId ? 'PUT' : 'POST';
        apiRequest(url, method, payload).then(function () {
            adFormWrap.style.display = 'none';
            loadAdminAds();
        }).catch(function (err) {
            alert('Error saving ad card: ' + (err.message || 'Unknown error'));
        });
    });

    window.adminEditAd = function (id) {
        var a = _adminAds.filter(function (x) { return x.id === id; })[0];
        if (!a) return;
        adEditId.value = a.id;
        document.getElementById('adCardFormTitle').textContent = 'Edit Ad Card';
        document.getElementById('adTitle').value = a.title || '';
        document.getElementById('adDescription').value = a.description || '';
        document.getElementById('adCoverUrl').value = a.cover_url || '';
        var preview = document.getElementById('adCoverPreview');
        var previewWrap = document.getElementById('adCoverPreviewWrap');
        if (a.cover_url && preview && previewWrap) {
            preview.src = a.cover_url;
            previewWrap.style.display = '';
        } else if (previewWrap) {
            previewWrap.style.display = 'none';
        }
        document.getElementById('adTargetLink').value = a.target_link || '';
        document.getElementById('adCtaText').value = a.cta_text || '';
        document.getElementById('adPlacement').value = a.placement || 'cars';
        document.getElementById('adPosition').value = a.position || '4';
        document.getElementById('adIsActive').checked = !!a.is_active;
        adTrFields(function (key, id) { var el = document.getElementById(id); if (el) el.value = a[key] || ''; });
        var statusEl = document.getElementById('adCoverUploadStatus');
        if (statusEl) statusEl.textContent = '';
        adFormWrap.style.display = 'block';
    };
    window.adminDeleteAd = function (id) {
        if (!confirm('Delete this ad card?')) return;
        apiDelete('/api/ads/admin/' + id).then(function () { loadAdminAds(); });
    };

    // ========================================
    // DRIVER REVIEWS MODERATION
    // ========================================
    var _adminDriverReviews = [];

    function loadAdminDriverReviews() {
        apiGet('/api/driver-reviews/admin/all').then(function (data) {
            _adminDriverReviews = data.reviews || [];
            renderAdminDriverReviews();
        }).catch(function () {
            document.getElementById('driverReviewsTableBody').innerHTML = '<tr><td colspan="8" style="text-align:center;color:#ef4444;padding:40px;">Failed to load reviews</td></tr>';
        });
    }

    function renderAdminDriverReviews() {
        var tbody = document.getElementById('driverReviewsTableBody');
        if (_adminDriverReviews.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#A0A3B0;padding:40px;">No driver reviews yet</td></tr>';
            return;
        }
        tbody.innerHTML = _adminDriverReviews.map(function (r) {
            var stars = '';
            for (var i = 1; i <= 5; i++) {
                stars += '<span style="color:' + (i <= r.rating_score ? '#C9A84C' : '#3A3F4B') + ';">&#9733;</span>';
            }
            return '<tr>'
                + '<td>' + r.id + '</td>'
                + '<td>' + esc(r.driver_name || '') + '</td>'
                + '<td>' + esc(r.customer_name || '') + '<br><span style="font-size:11px;color:#A0A3B0;">' + esc(r.customer_email || '') + '</span></td>'
                + '<td>' + stars + '</td>'
                + '<td style="max-width:300px;font-size:13px;">' + esc((r.review_text || '').slice(0, 200)) + '</td>'
                + '<td>' + (r.created_at ? new Date(r.created_at).toLocaleDateString() : '') + '</td>'
                + '<td>' + (r.is_hidden ? '<span style="color:#ef4444;font-size:12px;">Hidden</span>' : '<span style="color:#22c55e;font-size:12px;">Visible</span>') + '</td>'
                + '<td style="white-space:nowrap;">'
                + '<button class="admin-action-btn small" onclick="adminToggleReviewHide(' + r.id + ')">' + (r.is_hidden ? 'Show' : 'Hide') + '</button>'
                + '<button class="admin-action-btn small danger" onclick="adminDeleteDriverReview(' + r.id + ')">Delete</button>'
                + '</td></tr>';
        }).join('');
    }

    window.adminToggleReviewHide = function (id) {
        apiPut('/api/driver-reviews/admin/' + id + '/hide', {}).then(function () { loadAdminDriverReviews(); });
    };
    window.adminDeleteDriverReview = function (id) {
        if (!confirm('Delete this review?')) return;
        apiDelete('/api/driver-reviews/' + id).then(function () { loadAdminDriverReviews(); });
    };

    // Wire tab clicks for new tabs
    var driversNavItem = document.querySelector('.admin-nav-item[data-tab="drivers"]');
    var adsNavItem = document.querySelector('.admin-nav-item[data-tab="ads"]');
    var reviewsNavItem = document.querySelector('.admin-nav-item[data-tab="reviews"]');
    if (driversNavItem) driversNavItem.addEventListener('click', loadAdminDrivers);
    if (adsNavItem) adsNavItem.addEventListener('click', loadAdminAds);
    if (reviewsNavItem) reviewsNavItem.addEventListener('click', loadAdminDriverReviews);

    // Initial load
    loadAnalytics();
})();
