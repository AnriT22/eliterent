/* ========================================
   ADMIN PANEL — Visitors & SEO Analytics tabs
   (loaded after admin.js; exposes window.vaLoad / window.seoLoad)
   ======================================== */

(function () {
    var token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return; // admin.js handles the redirect

    // ---------- helpers ----------
    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function api(url) {
        return fetch(url, { headers: { 'Authorization': 'Bearer ' + token } }).then(function (r) {
            return r.json().then(function (data) {
                if (!r.ok) throw new Error(data.error || 'Request failed');
                return data;
            });
        });
    }
    function fmtNum(n) {
        n = parseFloat(n) || 0;
        return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }
    function fmtMoney(v) {
        return '$' + (parseFloat(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function fmtDur(sec) {
        sec = Math.round(sec || 0);
        if (sec < 60) return sec + 's';
        if (sec < 3600) return Math.floor(sec / 60) + 'm ' + (sec % 60) + 's';
        return Math.floor(sec / 3600) + 'h ' + Math.floor((sec % 3600) / 60) + 'm';
    }
    var _regionNames = null;
    try { _regionNames = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) {}
    function countryLabel(cc) {
        if (!cc) return '—';
        try { return _regionNames ? _regionNames.of(cc) : cc; } catch (e) { return cc; }
    }
    function flagEmoji(cc) {
        if (!cc || cc.length !== 2) return '🌐';
        var A = 0x1F1E6;
        return String.fromCodePoint(A + cc.charCodeAt(0) - 65, A + cc.charCodeAt(1) - 65);
    }
    function timeAgo(ts) {
        if (!ts) return '-';
        var d = new Date(ts), diff = Math.floor((Date.now() - d) / 60000);
        if (diff < 1) return 'just now';
        if (diff < 60) return diff + 'm ago';
        if (diff < 1440) return Math.floor(diff / 60) + 'h ago';
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    function pageLabel(p) {
        if (!p) return '—';
        if (p === '/' || p === '/index.html') return 'Homepage';
        return p.replace(/^\//, '').replace(/\.html$/, '');
    }
    function card(label, value, color, sub) {
        return '<div class="admin-stat-card ' + color + '">'
            + '<div class="stat-label">' + label + '</div>'
            + '<div class="stat-value">' + value + '</div>'
            + (sub ? '<div class="stat-sub">' + sub + '</div>' : '')
            + '</div>';
    }
    function growthBadge(g) {
        if (g == null) return '';
        var up = g >= 0;
        return ' <span style="color:' + (up ? '#22c55e' : '#ef4444') + ';font-weight:700;">' + (up ? '▲' : '▼') + ' ' + Math.abs(g) + '%</span>';
    }
    var SOURCE_LABELS = {
        direct: '🔗 Direct', google_organic: '🔍 Google Organic', google_ads: '💰 Google Ads',
        google_maps: '📍 Google Maps', organic_other: '🔎 Other Search', facebook: '📘 Facebook',
        instagram: '📸 Instagram', tiktok: '🎵 TikTok', twitter: '🐦 Twitter / X',
        whatsapp: '💬 WhatsApp', telegram: '✈️ Telegram', youtube: '▶️ YouTube',
        linkedin: '💼 LinkedIn', email: '✉️ Email', qr: '📱 QR Codes', partner: '🤝 Partner Sites',
        referral: '🌐 Referral', internal: '↩️ Internal'
    };
    function srcLabel(s) { return SOURCE_LABELS[s] || ('🌐 ' + esc(s || 'unknown')); }
    function deviceIcon(d) {
        if (d === 'mobile') return '📱';
        if (d === 'tablet') return '📲';
        if (d === 'desktop') return '🖥️';
        return '❓';
    }
    var LANG_NAMES = null;
    try { LANG_NAMES = new Intl.DisplayNames(['en'], { type: 'language' }); } catch (e) {}
    function langLabel(l) {
        if (!l) return '—';
        try { return LANG_NAMES ? (LANG_NAMES.of(l) + ' (' + l + ')') : l; } catch (e) { return l; }
    }
    function thead(cols) {
        return '<thead><tr>' + cols.map(function (c) { return '<th' + (c.cls ? ' class="' + c.cls + '"' : '') + (c.right ? ' style="text-align:right;"' : '') + '>' + c.t + '</th>'; }).join('') + '</tr></thead>';
    }
    function emptyMsg(msg) {
        return '<p style="color:var(--tt-muted, #A0A3B0);font-size:13px;padding:8px 0;">' + (msg || 'No data yet — will populate as visitors arrive') + '</p>';
    }
    function pctBar(value, max, color) {
        var w = max > 0 ? Math.max(2, Math.round(value / max * 100)) : 2;
        return '<div class="va-bar-track"><div class="va-bar-fill" style="width:' + w + '%;' + (color ? 'background:' + color + ';' : '') + '"></div></div>';
    }

    // ---------- SVG line/area chart ----------
    function svgLineChart(el, series, metrics) {
        if (!el) return;
        if (!series || series.length === 0) { el.innerHTML = emptyMsg(); return; }
        var w = Math.max(el.clientWidth || 560, 320), h = 200, padL = 8, padR = 8, padT = 26, padB = 22;
        var innerW = w - padL - padR, innerH = h - padT - padB;

        var maxes = metrics.map(function (m) {
            var mx = 0;
            series.forEach(function (d) { mx = Math.max(mx, parseFloat(d[m.key]) || 0); });
            return mx || 1;
        });
        function X(i) { return padL + (series.length === 1 ? innerW / 2 : i * innerW / (series.length - 1)); }
        function Y(v, mi) { return padT + innerH - ((parseFloat(v) || 0) / maxes[mi]) * innerH; }

        var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" preserveAspectRatio="none" style="display:block;">';
        // grid
        for (var g = 1; g <= 3; g++) {
            var gy = padT + innerH * g / 4;
            svg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (w - padR) + '" y2="' + gy + '" stroke="rgba(148,163,184,0.18)" stroke-width="1"/>';
        }
        metrics.forEach(function (m, mi) {
            var pts = series.map(function (d, i) { return X(i).toFixed(1) + ',' + Y(d[m.key], mi).toFixed(1); });
            if (m.area) {
                svg += '<polygon points="' + padL + ',' + (padT + innerH) + ' ' + pts.join(' ') + ' ' + (w - padR) + ',' + (padT + innerH) + '" fill="' + m.color + '" opacity="0.13"/>';
            }
            svg += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + m.color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
            series.forEach(function (d, i) {
                var val = parseFloat(d[m.key]) || 0;
                svg += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(val, mi).toFixed(1) + '" r="6" fill="transparent">'
                    + '<title>' + esc(d.date) + ' — ' + esc(m.label) + ': ' + (m.money ? fmtMoney(val) : fmtNum(val)) + '</title></circle>'
                    + '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(val, mi).toFixed(1) + '" r="2" fill="' + m.color + '"/>';
            });
        });
        // x labels (~5)
        var step = Math.max(1, Math.ceil(series.length / 5));
        for (var i = 0; i < series.length; i += step) {
            var lbl = String(series[i].date).substring(5); // MM-DD
            svg += '<text x="' + X(i).toFixed(1) + '" y="' + (h - 6) + '" font-size="10" fill="#94a3b8" text-anchor="middle">' + lbl + '</text>';
        }
        // legend
        var lx = padL;
        metrics.forEach(function (m) {
            svg += '<rect x="' + lx + '" y="6" width="10" height="10" rx="2" fill="' + m.color + '"/>'
                + '<text x="' + (lx + 14) + '" y="15" font-size="11" fill="#94a3b8">' + esc(m.label) + '</text>';
            lx += 14 + m.label.length * 6 + 18;
        });
        svg += '</svg>';
        el.innerHTML = svg;
    }

    // ========================================
    // VISITORS TAB
    // ========================================
    var vaRange = '30d';
    var geoBy = 'country', geoLimit = 25;
    var vFilters = { q: '', country: '', device: '', source: '' };
    var vOffset = 0, vLimit = 25;
    var liveTimer = null;
    var mapData = null, mapInstance = null;
    var countryOptionsLoaded = false;

    function vaActive() {
        var tab = document.getElementById('tabVisitors');
        return tab && tab.classList.contains('active') && document.visibilityState === 'visible';
    }

    function loadOverview() {
        api('/api/admin/va/overview?range=' + vaRange).then(function (data) {
            var el = document.getElementById('vaCards');
            if (!el) return;
            var c = data.cards, r = data.rangeStats;
            el.innerHTML = ''
                + card('Visitors Today', fmtNum(c.today), 'orange', fmtNum(c.todayViews) + ' page views · yesterday: ' + fmtNum(c.yesterday))
                + card('This Week', fmtNum(c.week), 'blue', fmtNum(c.weekViews) + ' page views')
                + card('This Month', fmtNum(c.month), 'purple', fmtNum(c.monthViews) + ' page views · this year: ' + fmtNum(c.year))
                + card('Total Visitors', fmtNum(c.total), 'green', fmtNum(c.totalViews) + ' total page views')
                + card('Live Right Now', fmtNum(c.live), 'green', c.live > 0 ? '<span class="va-live-dot"></span> active in last 5 min' : 'no one in last 5 min')
                + card('Sessions', fmtNum(r.sessions), 'blue', 'selected period' + growthBadge(r.visitorGrowth))
                + card('Avg Session', fmtDur(r.avgSessionDuration), 'purple', 'Bounce rate: ' + r.bounceRate + '%')
                + card('New vs Returning', fmtNum(r.newVisitors) + ' / ' + fmtNum(r.returningVisitors), 'orange', 'new / returning visitors')
                + card('Bookings', fmtNum(r.bookings), 'green', r.confirmedBookings + ' confirmed' + growthBadge(r.bookingGrowth))
                + card('Conversion Rate', r.conversionRate + '%', 'blue', 'bookings / sessions')
                + card('Booking Revenue', fmtMoney(r.revenue), 'green', 'gross, confirmed' + growthBadge(r.revenueGrowth))
                + card('Service Fees', fmtMoney(r.serviceFees), 'orange', 'platform earnings this period');
            var badge = document.getElementById('vaLiveBadge');
            if (badge) {
                badge.innerHTML = c.live > 0
                    ? '<span class="va-live-pill"><span class="va-live-dot"></span>' + c.live + ' online</span>' : '';
            }
        }).catch(function () {
            var el = document.getElementById('vaCards');
            if (el) el.innerHTML = '<p style="color:#ef4444;">Failed to load visitor overview</p>';
        });
    }

    function loadTimeseries() {
        var days = (vaRange === 'today' || vaRange === 'yesterday' || vaRange === '7d') ? 14
            : (vaRange === 'year' || vaRange === 'all') ? 90 : 30;
        api('/api/admin/va/timeseries?days=' + days).then(function (data) {
            var sub = ' last ' + data.days + ' days';
            var s1 = document.getElementById('vaTrafficChartSub'); if (s1) s1.textContent = sub;
            var s2 = document.getElementById('vaRevenueChartSub'); if (s2) s2.textContent = sub;
            svgLineChart(document.getElementById('vaTrafficChart'), data.series, [
                { key: 'pageviews', label: 'Page views', color: '#8b5cf6', area: true },
                { key: 'visitors', label: 'Visitors', color: '#C9A84C' }
            ]);
            svgLineChart(document.getElementById('vaRevenueChart'), data.series, [
                { key: 'revenue', label: 'Revenue $', color: '#22c55e', area: true, money: true },
                { key: 'bookings', label: 'Bookings', color: '#C9A84C' }
            ]);
        }).catch(function () {});
    }

    function loadGeo() {
        api('/api/admin/va/geo?range=' + vaRange + '&by=' + geoBy + '&limit=' + geoLimit).then(function (data) {
            var el = document.getElementById('vaGeoTable');
            if (!el) return;
            if (!data.rows || data.rows.length === 0) { el.innerHTML = emptyMsg('No geo data yet (fills in as new visitors arrive)'); return; }
            var maxV = data.rows[0] ? data.rows[0].visitors : 1;
            var html = '<table class="admin-table" style="font-size:13px;">'
                + thead([{ t: '#' }, { t: geoBy === 'city' ? 'City' : 'Country' }, { t: 'Visitors', right: 1 }, { t: '', cls: 'hide-mobile' },
                         { t: 'Sessions', right: 1, cls: 'hide-mobile' }, { t: 'Views', right: 1, cls: 'hide-mobile' },
                         { t: 'Bounce', right: 1, cls: 'hide-mobile' }, { t: 'Avg Session', right: 1, cls: 'hide-mobile' },
                         { t: 'Bookings', right: 1 }, { t: 'Revenue', right: 1 }, { t: 'Conv', right: 1 }, { t: 'Avg Value', right: 1, cls: 'hide-mobile' }])
                + '<tbody>';
            data.rows.forEach(function (r, i) {
                html += '<tr>'
                    + '<td style="color:#94a3b8;">' + (i + 1) + '</td>'
                    + '<td>' + flagEmoji(r.countryCode) + ' ' + esc(r.label) + '</td>'
                    + '<td style="text-align:right;font-weight:700;color:var(--tt-gold2, #C9A84C);">' + fmtNum(r.visitors) + '</td>'
                    + '<td class="hide-mobile" style="min-width:90px;">' + pctBar(r.visitors, maxV) + '</td>'
                    + '<td class="hide-mobile" style="text-align:right;">' + fmtNum(r.sessions) + '</td>'
                    + '<td class="hide-mobile" style="text-align:right;">' + fmtNum(r.pageviews) + '</td>'
                    + '<td class="hide-mobile" style="text-align:right;">' + r.bounceRate + '%</td>'
                    + '<td class="hide-mobile" style="text-align:right;">' + fmtDur(r.avgSessionDuration) + '</td>'
                    + '<td style="text-align:right;">' + fmtNum(r.bookings) + '</td>'
                    + '<td style="text-align:right;color:#22c55e;font-weight:600;">' + fmtMoney(r.revenue) + '</td>'
                    + '<td style="text-align:right;">' + r.conversionRate + '%</td>'
                    + '<td class="hide-mobile" style="text-align:right;">' + (r.avgBookingValue ? fmtMoney(r.avgBookingValue) : '—') + '</td>'
                    + '</tr>';
            });
            el.innerHTML = html + '</tbody></table>';

            // Populate the country filter for the visitor table (once, from the country view)
            if (geoBy === 'country' && !countryOptionsLoaded) {
                var sel = document.getElementById('vaCountryFilter');
                if (sel) {
                    data.rows.forEach(function (r) {
                        var opt = document.createElement('option');
                        opt.value = r.countryCode || '';
                        opt.textContent = flagEmoji(r.countryCode) + ' ' + r.label;
                        sel.appendChild(opt);
                    });
                    countryOptionsLoaded = true;
                }
            }
        }).catch(function () {
            var el = document.getElementById('vaGeoTable');
            if (el) el.innerHTML = emptyMsg('Failed to load geo data');
        });
    }

    // ---------- world map ----------
    function loadMap() {
        api('/api/admin/va/map?range=' + vaRange).then(function (data) {
            mapData = data.countries || {};
            renderMap();
        }).catch(function () {});
    }
    function renderMap() {
        var el = document.getElementById('vaWorldMap');
        if (!el || mapData == null) return;
        if (typeof jsVectorMap === 'undefined') {
            // Library still loading (defer) or blocked — retry once, then fall back.
            if (!renderMap._retried) {
                renderMap._retried = true;
                setTimeout(renderMap, 2500);
            } else {
                el.innerHTML = emptyMsg('World map library could not load — the country table below shows the same data.');
            }
            return;
        }
        var values = {};
        Object.keys(mapData).forEach(function (cc) { values[cc] = mapData[cc].visitors; });
        try {
            if (mapInstance && mapInstance.destroy) { try { mapInstance.destroy(); } catch (e) {} }
            el.innerHTML = '';
            mapInstance = new jsVectorMap({
                selector: '#vaWorldMap',
                map: 'world',
                zoomButtons: true,
                zoomOnScroll: false,
                backgroundColor: 'transparent',
                regionStyle: {
                    initial: { fill: 'rgba(148,163,184,0.25)', stroke: 'rgba(148,163,184,0.4)', strokeWidth: 0.3 },
                    hover: { fill: '#C9A84C' }
                },
                series: {
                    regions: [{
                        attribute: 'fill',
                        scale: ['#EAD9A6', '#8a6d1f'],
                        normalizeFunction: 'polynomial',
                        values: values
                    }]
                },
                onRegionTooltipShow: function (event, tooltip, code) {
                    try {
                        var c = mapData[code];
                        if (c) tooltip.text(c.name + ': ' + fmtNum(c.visitors) + ' visitors, ' + fmtNum(c.bookings) + ' bookings');
                    } catch (e) {}
                },
                onRegionClick: function (event, code) { showCountryDetail(code); }
            });
        } catch (e) {
            el.innerHTML = emptyMsg('World map failed to render — the country table below shows the same data.');
        }
    }
    function showCountryDetail(code) {
        var el = document.getElementById('vaMapDetail');
        if (!el) return;
        var c = mapData && mapData[code];
        if (!c) { el.innerHTML = '<p style="color:var(--tt-muted, #A0A3B0);font-size:13px;margin:12px 0 0;">' + flagEmoji(code) + ' ' + esc(countryLabel(code)) + ' — no visitors in this period.</p>'; return; }
        el.innerHTML = '<div class="va-map-detail">'
            + '<div class="va-map-detail-title">' + flagEmoji(code) + ' ' + esc(c.name) + '</div>'
            + '<div class="va-map-detail-grid">'
            + '<div><span>Visitors</span><strong>' + fmtNum(c.visitors) + '</strong></div>'
            + '<div><span>Sessions</span><strong>' + fmtNum(c.sessions) + '</strong></div>'
            + '<div><span>Page views</span><strong>' + fmtNum(c.pageviews) + '</strong></div>'
            + '<div><span>Bounce</span><strong>' + c.bounceRate + '%</strong></div>'
            + '<div><span>Bookings</span><strong>' + fmtNum(c.bookings) + '</strong></div>'
            + '<div><span>Revenue</span><strong>' + fmtMoney(c.revenue) + '</strong></div>'
            + '<div><span>Conversion</span><strong>' + c.conversionRate + '%</strong></div>'
            + '<div><span>Top language</span><strong>' + esc(c.topLanguage || '—') + '</strong></div>'
            + '</div>'
            + (c.topVehicles && c.topVehicles.length
                ? '<div class="va-map-detail-veh">🚗 Popular vehicles: ' + c.topVehicles.map(esc).join(', ') + '</div>' : '')
            + '</div>';
    }

    function loadLive(force) {
        // The 15s timer only refreshes while the tab is actually being watched;
        // direct loads (tab open / manual refresh) always run.
        if (!force && !vaActive()) return;
        api('/api/admin/va/live').then(function (data) {
            var el = document.getElementById('vaLiveTable');
            var cnt = document.getElementById('vaLiveCount');
            if (cnt) cnt.textContent = data.count > 0 ? data.count + ' online' : '';
            if (!el) return;
            if (!data.visitors || data.visitors.length === 0) { el.innerHTML = emptyMsg('No one on the site right now'); return; }
            var html = '<table class="admin-table" style="font-size:12px;">'
                + thead([{ t: 'Location' }, { t: 'Current Page' }, { t: 'Entry Page', cls: 'hide-mobile' },
                         { t: 'Device' }, { t: 'Browser', cls: 'hide-mobile' }, { t: 'Source', cls: 'hide-mobile' },
                         { t: 'Pages', right: 1 }, { t: 'Duration', right: 1 }, { t: 'Last Activity', right: 1 }])
                + '<tbody>';
            data.visitors.forEach(function (v) {
                html += '<tr>'
                    + '<td>' + flagEmoji(v.country_code) + ' ' + esc(v.city ? v.city + ', ' : '') + esc(v.country || '—')
                    + (v.booked_today ? ' <span class="admin-status" style="background:#22c55e;color:#fff;font-size:9px;">BOOKED</span>' : '') + '</td>'
                    + '<td style="color:var(--tt-gold2, #C9A84C);">' + esc(pageLabel(v.current_page)) + '</td>'
                    + '<td class="hide-mobile">' + esc(pageLabel(v.entry_page)) + '</td>'
                    + '<td>' + deviceIcon(v.device) + ' ' + esc(v.device || '?') + '</td>'
                    + '<td class="hide-mobile">' + esc(v.browser || '?') + '</td>'
                    + '<td class="hide-mobile">' + srcLabel(v.source) + '</td>'
                    + '<td style="text-align:right;font-weight:700;">' + v.views + '</td>'
                    + '<td style="text-align:right;">' + fmtDur(v.duration) + '</td>'
                    + '<td style="text-align:right;">' + timeAgo(v.last_seen) + '</td>'
                    + '</tr>';
            });
            el.innerHTML = html + '</tbody></table>';
        }).catch(function () {});
    }

    function loadSources() {
        api('/api/admin/va/sources?range=' + vaRange).then(function (data) {
            var el = document.getElementById('vaSourcesTable');
            if (el) {
                if (!data.rows || data.rows.length === 0) { el.innerHTML = emptyMsg(); }
                else {
                    var maxV = data.rows[0] ? data.rows[0].visitors : 1;
                    var html = '<table class="admin-table" style="font-size:13px;">'
                        + thead([{ t: 'Source' }, { t: 'Visitors', right: 1 }, { t: '', cls: 'hide-mobile' },
                                 { t: 'Sessions', right: 1, cls: 'hide-mobile' }, { t: 'Bounce', right: 1, cls: 'hide-mobile' },
                                 { t: 'Bookings', right: 1 }, { t: 'Revenue', right: 1 }, { t: 'Conv', right: 1 }])
                        + '<tbody>';
                    data.rows.forEach(function (r) {
                        html += '<tr>'
                            + '<td>' + srcLabel(r.source) + '</td>'
                            + '<td style="text-align:right;font-weight:700;color:var(--tt-gold2, #C9A84C);">' + fmtNum(r.visitors) + '</td>'
                            + '<td class="hide-mobile" style="min-width:80px;">' + pctBar(r.visitors, maxV) + '</td>'
                            + '<td class="hide-mobile" style="text-align:right;">' + fmtNum(r.sessions) + '</td>'
                            + '<td class="hide-mobile" style="text-align:right;">' + r.bounceRate + '%</td>'
                            + '<td style="text-align:right;">' + fmtNum(r.bookings) + '</td>'
                            + '<td style="text-align:right;color:#22c55e;">' + fmtMoney(r.revenue) + '</td>'
                            + '<td style="text-align:right;">' + r.conversionRate + '%</td>'
                            + '</tr>';
                    });
                    el.innerHTML = html + '</tbody></table>';
                }
            }
            var ref = document.getElementById('vaReferrers');
            if (ref) {
                if (!data.topReferrers || data.topReferrers.length === 0) { ref.innerHTML = emptyMsg('No referral traffic yet'); }
                else {
                    var maxR = data.topReferrers[0].visitors || 1;
                    var h = '<table class="admin-table" style="font-size:13px;">'
                        + thead([{ t: 'Website' }, { t: 'Visitors', right: 1 }, { t: '' }]) + '<tbody>';
                    data.topReferrers.forEach(function (r) {
                        h += '<tr><td>' + esc(r.host) + '</td>'
                            + '<td style="text-align:right;font-weight:700;">' + fmtNum(r.visitors) + '</td>'
                            + '<td style="min-width:80px;">' + pctBar(r.visitors, maxR) + '</td></tr>';
                    });
                    ref.innerHTML = h + '</tbody></table>';
                }
            }
        }).catch(function () {});
    }

    function loadDevices() {
        api('/api/admin/va/devices?range=' + vaRange).then(function (data) {
            var el = document.getElementById('vaDevices');
            if (el) {
                if (!data.devices || data.devices.length === 0) { el.innerHTML = emptyMsg(); }
                else {
                    var total = 0;
                    data.devices.forEach(function (d) { total += d.visitors; });
                    var html = '<table class="admin-table" style="font-size:13px;">'
                        + thead([{ t: 'Device' }, { t: 'Visitors', right: 1 }, { t: 'Share', right: 1 },
                                 { t: 'Bookings', right: 1 }, { t: 'Conv', right: 1 }]) + '<tbody>';
                    data.devices.forEach(function (d) {
                        html += '<tr><td>' + deviceIcon(d.key) + ' ' + esc(d.key) + '</td>'
                            + '<td style="text-align:right;font-weight:700;">' + fmtNum(d.visitors) + '</td>'
                            + '<td style="text-align:right;">' + (total ? Math.round(d.visitors / total * 100) : 0) + '%</td>'
                            + '<td style="text-align:right;">' + fmtNum(d.bookings || 0) + '</td>'
                            + '<td style="text-align:right;">' + (d.conversionRate || 0) + '%</td></tr>';
                    });
                    html += '</tbody></table>';
                    if (data.screens && data.screens.length) {
                        html += '<div style="margin-top:10px;font-size:12px;color:var(--tt-muted, #A0A3B0);">Top screens: '
                            + data.screens.map(function (s) { return esc(s.key) + ' (' + fmtNum(s.visitors) + ')'; }).join(' · ') + '</div>';
                    }
                    el.innerHTML = html;
                }
            }
            var el2 = document.getElementById('vaBrowsers');
            if (el2) {
                function miniTable(title, rows) {
                    if (!rows || rows.length === 0) return '';
                    var max = rows[0].visitors || 1;
                    var h = '<div style="font-size:12px;font-weight:700;color:var(--tt-muted, #A0A3B0);text-transform:uppercase;letter-spacing:.5px;margin:6px 0;">' + title + '</div>'
                        + '<table class="admin-table" style="font-size:13px;"><tbody>';
                    rows.slice(0, 7).forEach(function (r) {
                        h += '<tr><td>' + esc(r.key) + '</td>'
                            + '<td style="min-width:70px;">' + pctBar(r.visitors, max) + '</td>'
                            + '<td style="text-align:right;font-weight:600;">' + fmtNum(r.visitors) + '</td></tr>';
                    });
                    return h + '</tbody></table>';
                }
                el2.innerHTML = (miniTable('Browsers', data.browsers) + miniTable('Operating Systems', data.os)) || emptyMsg();
            }
        }).catch(function () {});
    }

    function loadLanguages() {
        api('/api/admin/va/languages?range=' + vaRange).then(function (data) {
            var el = document.getElementById('vaLanguages');
            if (!el) return;
            if (!data.rows || data.rows.length === 0) { el.innerHTML = emptyMsg(); return; }
            var maxV = data.rows[0].visitors || 1;
            var html = '<table class="admin-table" style="font-size:13px;">'
                + thead([{ t: 'Language' }, { t: 'Visitors', right: 1 }, { t: '' },
                         { t: 'Bookings', right: 1, cls: 'hide-mobile' }, { t: 'Conv', right: 1, cls: 'hide-mobile' }])
                + '<tbody>';
            data.rows.forEach(function (r) {
                html += '<tr><td>' + esc(langLabel(r.language)) + '</td>'
                    + '<td style="text-align:right;font-weight:700;">' + fmtNum(r.visitors) + '</td>'
                    + '<td style="min-width:80px;">' + pctBar(r.visitors, maxV) + '</td>'
                    + '<td class="hide-mobile" style="text-align:right;">' + fmtNum(r.bookings) + '</td>'
                    + '<td class="hide-mobile" style="text-align:right;">' + r.conversionRate + '%</td></tr>';
            });
            el.innerHTML = html + '</tbody></table>';
        }).catch(function () {});
    }

    function loadFunnel() {
        api('/api/admin/va/funnel?range=' + vaRange).then(function (data) {
            var el = document.getElementById('vaFunnel');
            if (!el) return;
            var f = data.funnel, b = data.bookings;
            var steps = [
                { label: '🏠 All sessions', value: f.sessions },
                { label: '🚗 Viewed vehicle list', value: f.list },
                { label: '🔍 Viewed vehicle details', value: f.vehicle },
                { label: '📝 Opened booking form', value: f.reservation },
                { label: '💳 Reached payment', value: f.payment },
                { label: '✅ Bookings created', value: b.created },
                { label: '💰 Confirmed / accepted', value: b.confirmed }
            ];
            if (f.sessions === 0) { el.innerHTML = emptyMsg(); return; }
            var html = '<div class="va-funnel">';
            steps.forEach(function (s, i) {
                var w = f.sessions > 0 ? Math.max(2, Math.round(s.value / f.sessions * 100)) : 2;
                var prev = i > 0 ? steps[i - 1].value : null;
                var passPct = (prev && prev > 0) ? Math.round(s.value / prev * 100) : null;
                html += '<div class="va-funnel-step">'
                    + '<div class="va-funnel-label">' + s.label + '</div>'
                    + '<div class="va-funnel-track"><div class="va-funnel-bar" style="width:' + w + '%;"></div></div>'
                    + '<div class="va-funnel-value">' + fmtNum(s.value)
                    + (passPct != null ? ' <span class="va-funnel-pct">' + passPct + '%</span>' : '')
                    + '</div></div>';
            });
            html += '</div>';
            // Mobile vs desktop pass-through
            function pass(x) { return x.reservation > 0 ? Math.round(x.payment / x.reservation * 100) : null; }
            var mp = pass(data.mobile), dp = pass(data.desktop);
            if (mp != null || dp != null) {
                html += '<div style="margin-top:12px;font-size:12px;color:var(--tt-muted, #A0A3B0);">'
                    + 'Booking form → payment: 📱 mobile ' + (mp != null ? mp + '%' : '—')
                    + ' · 🖥️ desktop ' + (dp != null ? dp + '%' : '—') + '</div>';
            }
            el.innerHTML = html;
        }).catch(function () {});
    }

    function loadVisitorsTable() {
        var params = ['range=' + vaRange, 'limit=' + vLimit, 'offset=' + vOffset];
        if (vFilters.q) params.push('q=' + encodeURIComponent(vFilters.q));
        if (vFilters.country) params.push('country=' + encodeURIComponent(vFilters.country));
        if (vFilters.device) params.push('device=' + encodeURIComponent(vFilters.device));
        if (vFilters.source) params.push('source=' + encodeURIComponent(vFilters.source));
        api('/api/admin/va/visitors?' + params.join('&')).then(function (data) {
            var el = document.getElementById('vaVisitorsTable');
            if (!el) return;
            if (!data.visitors || data.visitors.length === 0) {
                el.innerHTML = emptyMsg('No visitors match these filters');
                var pg0 = document.getElementById('vaVisitorsPager');
                if (pg0) pg0.innerHTML = '';
                return;
            }
            var html = '<table class="admin-table" style="font-size:12px;">'
                + thead([{ t: 'IP / Status' }, { t: 'Location' }, { t: 'Device' }, { t: 'Browser', cls: 'hide-mobile' },
                         { t: 'Lang', cls: 'hide-mobile' }, { t: 'Screen', cls: 'hide-mobile' }, { t: 'Source' },
                         { t: 'Landing → Last Page', cls: 'hide-mobile' }, { t: 'Pages', right: 1 },
                         { t: 'Sessions', right: 1, cls: 'hide-mobile' }, { t: 'Time', right: 1, cls: 'hide-mobile' }, { t: 'Last Seen', right: 1 }])
                + '<tbody>';
            data.visitors.forEach(function (v) {
                var badges = '';
                if (v.registered) badges += ' <span class="admin-status" style="background:#3b82f6;color:#fff;font-size:9px;">USER</span>';
                if (v.confirmed_bookings > 0) badges += ' <span class="admin-status" style="background:#22c55e;color:#fff;font-size:9px;">BOOKED ×' + v.confirmed_bookings + '</span>';
                else if (v.bookings > 0) badges += ' <span class="admin-status" style="background:#0ea5e9;color:#fff;font-size:9px;">BOOKING</span>';
                else if (v.booking_started) badges += ' <span class="admin-status" style="background:#f59e0b;color:#fff;font-size:9px;">STARTED</span>';
                var loc = (v.city ? esc(v.city) + ', ' : '') + esc(v.country || '—');
                html += '<tr>'
                    + '<td style="font-family:monospace;font-size:11px;white-space:nowrap;">' + esc(v.ip || '—') + badges + '</td>'
                    + '<td>' + flagEmoji(v.country_code) + ' ' + loc + '</td>'
                    + '<td>' + deviceIcon(v.device) + ' ' + esc(v.os || '?') + '</td>'
                    + '<td class="hide-mobile">' + esc(v.browser || '?') + (v.browser_version ? ' ' + esc(v.browser_version) : '') + '</td>'
                    + '<td class="hide-mobile">' + esc(v.language || '—') + '</td>'
                    + '<td class="hide-mobile">' + esc(v.screen || '—') + '</td>'
                    + '<td style="white-space:nowrap;">' + srcLabel(v.source) + '</td>'
                    + '<td class="hide-mobile" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(v.landing_page) + ' → ' + esc(v.last_page) + '">'
                    + esc(pageLabel(v.landing_page)) + ' → ' + esc(pageLabel(v.last_page)) + '</td>'
                    + '<td style="text-align:right;font-weight:700;">' + fmtNum(v.views) + '</td>'
                    + '<td class="hide-mobile" style="text-align:right;">' + fmtNum(v.sessions) + '</td>'
                    + '<td class="hide-mobile" style="text-align:right;">' + fmtDur(v.span_seconds) + '</td>'
                    + '<td style="text-align:right;white-space:nowrap;">' + timeAgo(v.last_seen) + '</td>'
                    + '</tr>';
            });
            el.innerHTML = html + '</tbody></table>';

            var pg = document.getElementById('vaVisitorsPager');
            if (pg) {
                var from = data.total === 0 ? 0 : data.offset + 1;
                var to = Math.min(data.offset + data.limit, data.total);
                pg.innerHTML = '<span>' + from + '–' + to + ' of ' + fmtNum(data.total) + ' visitors</span>'
                    + '<button class="admin-action-btn" id="vaPrevPage" ' + (data.offset <= 0 ? 'disabled' : '') + '>‹ Prev</button>'
                    + '<button class="admin-action-btn" id="vaNextPage" ' + (to >= data.total ? 'disabled' : '') + '>Next ›</button>';
                var prev = document.getElementById('vaPrevPage'), next = document.getElementById('vaNextPage');
                if (prev) prev.addEventListener('click', function () { vOffset = Math.max(0, vOffset - vLimit); loadVisitorsTable(); });
                if (next) next.addEventListener('click', function () { vOffset += vLimit; loadVisitorsTable(); });
            }
        }).catch(function () {
            var el = document.getElementById('vaVisitorsTable');
            if (el) el.innerHTML = emptyMsg('Failed to load visitors');
        });
    }

    window.vaLoad = function () {
        loadOverview();
        loadTimeseries();
        loadGeo();
        loadMap();
        loadLive(true);
        loadSources();
        loadDevices();
        loadLanguages();
        loadFunnel();
        loadVisitorsTable();
        if (!liveTimer) liveTimer = setInterval(loadLive, 15000);
    };

    // ---------- Visitors tab events ----------
    var rangeSel = document.getElementById('vaRange');
    if (rangeSel) rangeSel.addEventListener('change', function () { vaRange = this.value; vOffset = 0; window.vaLoad(); });
    var refreshBtn = document.getElementById('vaRefreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', function () { window.vaLoad(); });
    var geoBySel = document.getElementById('vaGeoBy');
    if (geoBySel) geoBySel.addEventListener('change', function () { geoBy = this.value; loadGeo(); });
    var geoLimitSel = document.getElementById('vaGeoLimit');
    if (geoLimitSel) geoLimitSel.addEventListener('change', function () { geoLimit = parseInt(this.value) || 25; loadGeo(); });
    var searchInput = document.getElementById('vaSearch');
    var searchTimer = null;
    if (searchInput) searchInput.addEventListener('input', function () {
        var val = this.value;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () { vFilters.q = val.trim(); vOffset = 0; loadVisitorsTable(); }, 400);
    });
    ['vaCountryFilter', 'vaDeviceFilter', 'vaSourceFilter'].forEach(function (id) {
        var sel = document.getElementById(id);
        if (sel) sel.addEventListener('change', function () {
            if (id === 'vaCountryFilter') vFilters.country = this.value;
            if (id === 'vaDeviceFilter') vFilters.device = this.value;
            if (id === 'vaSourceFilter') vFilters.source = this.value;
            vOffset = 0;
            loadVisitorsTable();
        });
    });

    // ========================================
    // SEO TAB
    // ========================================
    var seoRange = '30d';

    function loadSeoOverview() {
        api('/api/admin/seo/overview?range=' + seoRange).then(function (data) {
            var el = document.getElementById('seoCards');
            if (el) {
                var o = data.organic;
                el.innerHTML = ''
                    + card('Organic Visitors', fmtNum(o.visitors), 'green', fmtNum(o.pageviews) + ' organic page views')
                    + card('Organic Sessions', fmtNum(o.sessions), 'blue', 'Bounce: ' + o.bounceRate + '%')
                    + card('Avg Engagement', fmtDur(o.avgSessionDuration), 'purple', fmtNum(o.returningVisitors) + ' returning organic visitors')
                    + card('Organic Bookings', fmtNum(o.bookings), 'green', 'Conv rate: ' + o.conversionRate + '%')
                    + card('Organic Revenue', fmtMoney(o.revenue), 'orange', 'attributed to organic search');
            }
            function pageTable(elId, rows, cols) {
                var t = document.getElementById(elId);
                if (!t) return;
                if (!rows || rows.length === 0) { t.innerHTML = emptyMsg(); return; }
                var max = rows[0][cols.barKey] || 1;
                var html = '<table class="admin-table" style="font-size:13px;">' + thead(cols.head) + '<tbody>';
                rows.forEach(function (r) {
                    html += '<tr><td>' + esc(pageLabel(r.page)) + '</td>'
                        + '<td style="min-width:80px;">' + pctBar(r[cols.barKey], max) + '</td>'
                        + '<td style="text-align:right;font-weight:700;">' + fmtNum(r[cols.barKey]) + '</td>'
                        + (cols.extra ? '<td style="text-align:right;">' + fmtNum(r[cols.extra]) + '</td>' : '')
                        + '</tr>';
                });
                t.innerHTML = html + '</tbody></table>';
            }
            pageTable('seoLandingTable', data.landingPages, {
                barKey: 'entrances',
                head: [{ t: 'Page' }, { t: '' }, { t: 'Entrances', right: 1 }, { t: 'Organic', right: 1 }],
                extra: 'organicEntrances'
            });
            pageTable('seoExitTable', data.exitPages, {
                barKey: 'exits',
                head: [{ t: 'Page' }, { t: '' }, { t: 'Exits', right: 1 }]
            });

            var pt = document.getElementById('seoPagesTable');
            if (pt) {
                if (!data.pages || data.pages.length === 0) { pt.innerHTML = emptyMsg(); }
                else {
                    var lowSet = {};
                    (data.lowEngagement || []).forEach(function (p) { lowSet[p.page] = true; });
                    var html = '<table class="admin-table" style="font-size:13px;">'
                        + thead([{ t: 'Page' }, { t: 'Views', right: 1 }, { t: 'Unique', right: 1 },
                                 { t: 'Avg Engagement', right: 1, cls: 'hide-mobile' },
                                 { t: 'Landing Sessions', right: 1, cls: 'hide-mobile' }, { t: 'Bounce', right: 1 }, { t: '' }])
                        + '<tbody>';
                    data.pages.forEach(function (p) {
                        html += '<tr>'
                            + '<td>' + esc(pageLabel(p.page)) + '</td>'
                            + '<td style="text-align:right;font-weight:700;">' + fmtNum(p.views) + '</td>'
                            + '<td style="text-align:right;">' + fmtNum(p.uniques) + '</td>'
                            + '<td class="hide-mobile" style="text-align:right;">' + fmtDur(p.avgEngagement) + '</td>'
                            + '<td class="hide-mobile" style="text-align:right;">' + fmtNum(p.landingSessions) + '</td>'
                            + '<td style="text-align:right;' + (p.bounceRate >= 60 && p.landingSessions >= 10 ? 'color:#ef4444;font-weight:700;' : '') + '">'
                            + (p.landingSessions > 0 ? p.bounceRate + '%' : '—') + '</td>'
                            + '<td>' + (lowSet[p.page] ? '<span class="admin-status" style="background:#fef3c7;color:#d97706;font-size:9px;">NEEDS ATTENTION</span>' : '') + '</td>'
                            + '</tr>';
                    });
                    pt.innerHTML = html + '</tbody></table>';
                }
            }
        }).catch(function () {
            var el = document.getElementById('seoCards');
            if (el) el.innerHTML = '<p style="color:#ef4444;">Failed to load SEO overview</p>';
        });
    }

    function loadSeoLocations() {
        api('/api/admin/seo/locations?range=' + seoRange).then(function (data) {
            var el = document.getElementById('seoLocationsTable');
            if (!el) return;
            if (!data.rows || data.rows.length === 0) { el.innerHTML = emptyMsg(); return; }
            var html = '<table class="admin-table" style="font-size:13px;">'
                + thead([{ t: 'Landing Page' }, { t: 'Visitors', right: 1 }, { t: 'Organic', right: 1 },
                         { t: 'Views', right: 1, cls: 'hide-mobile' }, { t: 'Bounce', right: 1, cls: 'hide-mobile' },
                         { t: 'Assisted Bookings', right: 1 }, { t: 'Revenue', right: 1 }, { t: 'Conv', right: 1, cls: 'hide-mobile' }])
                + '<tbody>';
            data.rows.forEach(function (r) {
                html += '<tr>'
                    + '<td title="' + esc((r.pages || []).join(', ')) + '">' + esc(r.label) + '</td>'
                    + '<td style="text-align:right;font-weight:700;color:var(--tt-gold2, #C9A84C);">' + fmtNum(r.visitors) + '</td>'
                    + '<td style="text-align:right;">' + fmtNum(r.organicVisitors) + '</td>'
                    + '<td class="hide-mobile" style="text-align:right;">' + fmtNum(r.views) + '</td>'
                    + '<td class="hide-mobile" style="text-align:right;">' + (r.landingSessions > 0 ? r.bounceRate + '%' : '—') + '</td>'
                    + '<td style="text-align:right;">' + fmtNum(r.assistedBookings) + '</td>'
                    + '<td style="text-align:right;color:#22c55e;">' + fmtMoney(r.revenue) + '</td>'
                    + '<td class="hide-mobile" style="text-align:right;">' + r.conversionRate + '%</td>'
                    + '</tr>';
            });
            el.innerHTML = html + '</tbody></table>';
        }).catch(function () {});
    }

    function loadSeoRecs() {
        api('/api/admin/seo/recommendations?range=' + seoRange).then(function (data) {
            var el = document.getElementById('seoRecs');
            if (!el) return;
            var recs = data.recommendations || [];
            if (recs.length === 0) {
                el.innerHTML = '<p style="color:#22c55e;font-size:13px;">✅ Nothing urgent detected in this period. As traffic grows, insights will appear here.</p>';
                return;
            }
            var prColors = { high: '#ef4444', medium: '#f59e0b', low: '#64748b' };
            el.innerHTML = recs.map(function (r) {
                return '<div class="va-rec">'
                    + '<div class="va-rec-head">'
                    + '<span class="va-rec-pill" style="background:' + prColors[r.priority] + ';">' + r.priority.toUpperCase() + '</span>'
                    + '<span class="va-rec-area">' + esc(r.area) + '</span>'
                    + '<strong>' + esc(r.title) + '</strong>'
                    + '</div>'
                    + '<div class="va-rec-detail">' + esc(r.detail) + '</div>'
                    + (r.impact ? '<div class="va-rec-impact">💡 ' + esc(r.impact) + '</div>' : '')
                    + '</div>';
            }).join('');
        }).catch(function () {
            var el = document.getElementById('seoRecs');
            if (el) el.innerHTML = emptyMsg('Failed to generate recommendations');
        });
    }

    function loadSeoAudit(force) {
        api('/api/admin/seo/audit' + (force ? '?force=1' : '')).then(function (data) {
            var sm = document.getElementById('seoAuditSummary');
            if (sm) {
                var s = data.summary;
                sm.innerHTML = '<div class="va-audit-chips">'
                    + '<span class="va-audit-chip" style="border-color:#ef4444;color:#ef4444;">' + s.high + ' high</span>'
                    + '<span class="va-audit-chip" style="border-color:#f59e0b;color:#f59e0b;">' + s.medium + ' medium</span>'
                    + '<span class="va-audit-chip" style="border-color:#64748b;color:#94a3b8;">' + s.low + ' low</span>'
                    + '<span class="va-audit-chip" style="border-color:#22c55e;color:#22c55e;">' + s.healthy + ' healthy pages</span>'
                    + '<span style="font-size:12px;color:var(--tt-muted, #A0A3B0);margin-left:auto;">' + data.pagesScanned + ' pages scanned · ' + timeAgo(data.generatedAt) + '</span>'
                    + '</div>'
                    + (data.siteIssues && data.siteIssues.length
                        ? '<div style="margin:8px 0;font-size:13px;color:#ef4444;">' + data.siteIssues.map(function (i) { return '⚠ ' + esc(i.detail); }).join('<br>') + '</div>' : '');
            }
            var el = document.getElementById('seoAuditTable');
            if (el) {
                var withIssues = (data.pages || []).filter(function (p) { return p.issues.length > 0; });
                if (withIssues.length === 0) { el.innerHTML = '<p style="color:#22c55e;font-size:13px;">✅ No page-level issues found.</p>'; return; }
                var sevColor = { high: '#ef4444', medium: '#f59e0b', low: '#64748b' };
                var html = '<table class="admin-table" style="font-size:12px;">'
                    + thead([{ t: 'Page' }, { t: 'Title', cls: 'hide-mobile' }, { t: 'Issues' }]) + '<tbody>';
                withIssues.forEach(function (p) {
                    var chips = p.issues.map(function (i) {
                        return '<span class="va-issue" style="border-color:' + sevColor[i.severity] + ';" title="' + esc(i.detail) + '">'
                            + esc(i.type.replace(/_/g, ' ')) + '</span>';
                    }).join(' ');
                    html += '<tr>'
                        + '<td style="white-space:nowrap;">' + esc(p.page) + '</td>'
                        + '<td class="hide-mobile" style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--tt-muted, #A0A3B0);" title="' + esc(p.title || '') + '">' + esc(p.title || '—') + '</td>'
                        + '<td>' + chips + '</td>'
                        + '</tr>';
                });
                el.innerHTML = html + '</tbody></table>'
                    + '<p style="font-size:11px;color:var(--tt-muted, #A0A3B0);margin:8px 0 0;">Hover an issue for details. App/checkout pages are excluded on purpose — they are not SEO surfaces.</p>';
            }
        }).catch(function () {
            var el = document.getElementById('seoAuditTable');
            if (el) el.innerHTML = emptyMsg('Failed to run audit');
        });
    }

    function loadSeoGsc() {
        api('/api/admin/seo/gsc').then(function (data) {
            var el = document.getElementById('seoGsc');
            if (!el) return;
            if (data.connected) { el.innerHTML = ''; return; }
            el.innerHTML = '<p style="font-size:13px;color:var(--tt-muted, #A0A3B0);margin:0 0 10px;">' + esc(data.message) + '</p>'
                + '<a href="' + esc(data.dashboardUrl) + '" target="_blank" rel="noopener" class="admin-action-btn" style="display:inline-block;text-decoration:none;margin-bottom:12px;">Open Search Console ↗</a>'
                + '<div style="font-size:12px;color:var(--tt-muted, #A0A3B0);">To show keywords here later:</div>'
                + '<ol style="font-size:12px;color:var(--tt-muted, #A0A3B0);margin:6px 0 0;padding-left:18px;">'
                + (data.howToConnect || []).map(function (s) { return '<li style="margin:3px 0;">' + esc(s) + '</li>'; }).join('')
                + '</ol>';
        }).catch(function () {});
    }

    window.seoLoad = function () {
        loadSeoOverview();
        loadSeoLocations();
        loadSeoRecs();
        loadSeoAudit(false);
        loadSeoGsc();
    };

    // ---------- SEO tab events ----------
    var seoRangeSel = document.getElementById('seoRange');
    if (seoRangeSel) seoRangeSel.addEventListener('change', function () { seoRange = this.value; window.seoLoad(); });
    var seoRefresh = document.getElementById('seoRefreshBtn');
    if (seoRefresh) seoRefresh.addEventListener('click', function () { window.seoLoad(); });
    var auditBtn = document.getElementById('seoAuditRefresh');
    if (auditBtn) auditBtn.addEventListener('click', function () { loadSeoAudit(true); });
})();
