/* ========================================
   VEHICLE DETAIL PAGE — JAVASCRIPT
   ======================================== */

(function () {
    function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    var vehicleId = null;
    var vehicleData = null;
    var blockedDates = {};
    var vdBlockIntervals = []; // hour-level blocks (buffer already applied): [{startMs, endMs}]
    var vdPickupDate = null;
    var vdDropoffDate = null;
    var vdMinRentalDays = 1; // partner-defined minimum rental duration
    var vdCalTarget = null; // 'pickup' or 'dropoff'
    var vdCalDisplay = null; // current month in calendar
    var vdTempPickupDate = null;
    var vdTempDropoffDate = null;

    // Translation helper
    function vt(key, fallback) {
        if (typeof I18n !== 'undefined' && I18n.t) {
            var val = I18n.t(key);
            if (val && val !== key) return val;
        }
        return fallback;
    }

    // Translate a spec value (e.g. "automatic" -> "ავტომატური")
    function vtVal(raw) {
        if (!raw) return '';
        var key = 'vehicle_page.val_' + String(raw).toLowerCase().replace(/[\s\/]+/g, '_').replace(/[^a-z0-9_]/g, '');
        var translated = vt(key, null);
        return translated || cap(String(raw).replace(/_/g, ' '));
    }

    // Parse ?id= from URL
    var params = new URLSearchParams(window.location.search);
    vehicleId = parseInt(params.get('id'));

    if (!vehicleId) {
        showError();
        return;
    }

    // Load vehicle data — wait for both fetch and I18n to be ready
    var fetchedData = null;
    var i18nReady = false;
    var pageRendered = false;

    function tryRender() {
        if (fetchedData && i18nReady && !pageRendered) {
            pageRendered = true;
            vehicleData = fetchedData;
            renderPage(vehicleData);
            loadBlockedDates();
            loadTimeBlocks();
        }
    }

    // Naive local 'YYYY-MM-DDTHH:MM' -> ms (treated as UTC for safe arithmetic)
    function vdLocalMs(s) {
        var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
        return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
    }
    // Load hour-level blocks (buffer already applied server-side via effective_end)
    function loadTimeBlocks() {
        fetch('/api/availability/' + vehicleId + '/time-blocks')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            vdBlockIntervals = (data.blocks || []).map(function (b) {
                return { startMs: vdLocalMs(b.effective_start), endMs: vdLocalMs(b.effective_end) };
            }).filter(function (b) { return b.startMs != null && b.endMs != null; });
            if (vdCalDisplay) renderCalendar();
            updateDateDisplay();
        })
        .catch(function () {});
    }
    // Is the clock hour `hour` on date `dateStr` (YYYY-MM-DD) inside any block?
    function vdHourBlocked(dateStr, hour) {
        var m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return false;
        var slot = Date.UTC(+m[1], +m[2] - 1, +m[3], hour, 0);
        for (var i = 0; i < vdBlockIntervals.length; i++) {
            if (slot >= vdBlockIntervals[i].startMs && slot < vdBlockIntervals[i].endMs) return true;
        }
        return false;
    }
    // Every bookable hour (0..23) on this date blocked?
    function vdDateFullyBlocked(dateStr) {
        if (!vdBlockIntervals.length) return false;
        for (var h = 0; h < 24; h++) { if (!vdHourBlocked(dateStr, h)) return false; }
        return true;
    }
    // Does this date intersect any hour block (incl. buffer)? Used to flag
    // partially-blocked days so the customer sees them like the partner's yellow.
    function vdDateHasBlock(dateStr) {
        if (!vdBlockIntervals.length) return false;
        var m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return false;
        var dayStart = Date.UTC(+m[1], +m[2] - 1, +m[3], 0, 0);
        var dayEnd = dayStart + 24 * 3600000;
        for (var i = 0; i < vdBlockIntervals.length; i++) {
            if (vdBlockIntervals[i].startMs < dayEnd && vdBlockIntervals[i].endMs > dayStart) return true;
        }
        return false;
    }

    fetch('/api/vehicles/' + vehicleId)
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.error || !data.vehicle) { showError(); return; }
        fetchedData = data.vehicle;
        tryRender();
    })
    .catch(function() { showError(); });

    if (typeof I18n !== 'undefined' && I18n.onReady) {
        I18n.onReady(function() { i18nReady = true; tryRender(); });
    } else {
        i18nReady = true;
        tryRender();
    }

    // Re-render specs & features when language changes
    document.addEventListener('languageChanged', function() {
        if (vehicleData) {
            var specsGrid = document.getElementById('vdSpecsGrid');
            if (specsGrid) specsGrid.innerHTML = '';
            var featEl = document.getElementById('vdFeatures');
            if (featEl) featEl.innerHTML = '';
            renderPage(vehicleData);
        }
    });

    // Load blocked/booked dates for this vehicle
    function loadBlockedDates() {
        var now = new Date();
        // Load 6 months ahead
        var fetches = [0, 1, 2, 3, 4, 5].map(function(offset) {
            var d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
            var monthStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            return fetch('/api/availability/' + vehicleId + '?month=' + monthStr)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                var avail = data.availability || [];
                avail.forEach(function(entry) {
                    if (entry.status === 'blocked' || entry.status === 'booked') {
                        blockedDates[entry.date] = entry.status;
                    }
                });
            })
            .catch(function() {});
        });
        Promise.all(fetches).then(function() {
            if (vdCalDisplay) {
                renderCalendar();
            }
        });
    }

    // Check if any blocked date falls between two dates (exclusive)
    function hasBlockedInRange(startDate, endDate) {
        var cur = new Date(startDate);
        cur.setDate(cur.getDate() + 1);
        while (cur < endDate) {
            var ds = vdFmt(cur);
            if (blockedDates[ds] || vdDateFullyBlocked(ds)) return ds;
            cur.setDate(cur.getDate() + 1);
        }
        return null;
    }

    function renderPage(v) {
        document.getElementById('vdLoading').style.display = 'none';
        document.getElementById('vdContent').style.display = 'grid';

        var name = v.name || 'Vehicle';
        document.title = name + ' — EliteAuto.rent';
        document.getElementById('vdBreadcrumbName').textContent = name;
        document.getElementById('vdVehicleName').textContent = name;

        // Conversion tracking: a specific car was viewed (funnel entry + retargeting).
        try {
            if (typeof gtag === 'function') {
                gtag('event', 'view_item', {
                    currency: 'USD',
                    value: parseFloat(v.price_per_day) || 0,
                    items: [{ item_id: String(v.id), item_name: name, item_category: v.category || 'car' }]
                });
            }
        } catch (e) {}

        // Meta
        var cat = (v.category || 'economy');
        var engine = v.engine || '';
        var gearbox = v.gearbox || '';
        var year = v.year || '';
        var locParts = [];
        if (v.location_city) locParts.push(v.location_city);
        if (v.region && v.region !== v.location_city) locParts.push(v.region);
        var locLabel = locParts.length ? locParts.join(', ') : 'Tbilisi';
        document.getElementById('vdVehicleMeta').textContent =
            [vtVal(cat), year, vtVal(engine), vtVal(gearbox)].filter(Boolean).join(' · ');

        // Location (update or create — avoid duplicates on re-render)
        var locEl = document.querySelector('.vd-location');
        if (locEl) {
            locEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' + esc(locLabel);
        } else {
            document.getElementById('vdVehicleMeta').insertAdjacentHTML('afterend',
                '<div class="vd-location" style="font-size:13px;color:#A0A3B0;margin-top:4px;display:flex;align-items:center;gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' + esc(locLabel) + '</div>');
        }

        // Price — for "rent with driver only" cars, show rent + driver service total.
        var vdDriverOnly = (v.rent_with_driver_only === 1 || v.rent_with_driver_only === true);
        var vdDriverPrice = 0;
        if (vdDriverOnly) {
            var vdEx = v.extras;
            if (typeof vdEx === 'string') { try { vdEx = JSON.parse(vdEx); } catch (e) { vdEx = {}; } }
            vdEx = vdEx || {};
            vdDriverPrice = parseFloat(vdEx.driver_service) || 0;
        }
        var vdHeadlinePrice = (parseFloat(v.price_per_day) || 0) + vdDriverPrice;
        var priceEl = document.getElementById('vdPrice');
        priceEl.setAttribute('data-price-usd', vdHeadlinePrice);
        priceEl.classList.add('vd-price-amount');
        priceEl.textContent = (typeof Currency !== 'undefined') ? Currency.formatPrice(vdHeadlinePrice) : ('$' + vdHeadlinePrice);
        var vdPriceBreakdownEl = document.getElementById('vdPriceBreakdown');
        if (!vdPriceBreakdownEl && vdDriverOnly && vdDriverPrice > 0) {
            vdPriceBreakdownEl = document.createElement('div');
            vdPriceBreakdownEl.id = 'vdPriceBreakdown';
            vdPriceBreakdownEl.style.cssText = 'font-size:12px;color:#A0A3B0;margin-top:2px;';
            if (priceEl.parentNode) priceEl.parentNode.appendChild(vdPriceBreakdownEl);
        }
        if (vdPriceBreakdownEl) {
            vdPriceBreakdownEl.style.display = (vdDriverOnly && vdDriverPrice > 0) ? '' : 'none';
            if (vdDriverOnly && vdDriverPrice > 0) {
                var rentStr = (typeof Currency !== 'undefined') ? Currency.formatPrice(v.price_per_day || 0) : ('$' + (v.price_per_day || 0));
                var drvStr = (typeof Currency !== 'undefined') ? Currency.formatPrice(vdDriverPrice) : ('$' + vdDriverPrice);
                vdPriceBreakdownEl.textContent = rentStr + ' ' + vt('fleet.rent', 'rent') + ' + ' + drvStr + ' ' + vt('fleet.driver', 'driver');
            }
        }

        // Partner
        if (v.company_name) {
            document.getElementById('vdPartnerName').textContent = v.company_name;
            document.getElementById('vdPartnerInfo').style.display = 'flex';
        }

        // Year badge
        if (year) document.getElementById('vdYearBadge').textContent = year;

        // Main image
        var imgs = [];
        if (v.image_url) imgs.push(v.image_url);
        try { var gallery = JSON.parse(v.gallery || '[]'); imgs = imgs.concat(gallery); } catch(e) {}
        imgs = imgs.filter(function(u, i, a) { return u && a.indexOf(u) === i; });

        var mainImg = document.getElementById('vdMainImg');
        // Saved vertical crop position for the main photo (default 50 = centered).
        var offY = (v.image_offset_y == null ? 50 : v.image_offset_y);
        if (imgs.length > 0) {
            mainImg.src = imgs[0];
            mainImg.alt = name;
            mainImg.style.objectPosition = '50% ' + offY + '%';
        } else {
            mainImg.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 480'%3E%3Crect fill='%23e2e8f0' width='800' height='480'/%3E%3Ctext x='400' y='245' text-anchor='middle' fill='%2394a3b8' font-size='20' font-family='sans-serif'%3ENo Image%3C/text%3E%3C/svg%3E";
        }

        // Thumbnails
        if (imgs.length > 1) {
            var thumbsEl = document.getElementById('vdThumbs');
            imgs.forEach(function(src, idx) {
                var img = document.createElement('img');
                img.src = src;
                img.alt = name + ' photo ' + (idx + 1);
                img.className = 'vd-thumb' + (idx === 0 ? ' active' : '');
                img.addEventListener('click', function() {
                    mainImg.src = src;
                    // Apply the saved crop only to the main photo; center the others.
                    mainImg.style.objectPosition = (idx === 0) ? ('50% ' + offY + '%') : '50% 50%';
                    document.querySelectorAll('.vd-thumb').forEach(function(t) { t.classList.remove('active'); });
                    img.classList.add('active');
                });
                thumbsEl.appendChild(img);
            });
        }

        // Specs grid
        var specs = [
            { label: vt('vehicle_page.category', 'Category'),  val: vtVal(cat) },
            { label: vt('vehicle_page.year', 'Year'),      val: year },
            { label: vt('vehicle_page.engine', 'Engine'),    val: vtVal(engine) },
            { label: vt('vehicle_page.gearbox', 'Gearbox'),   val: vtVal(gearbox) },
            { label: vt('vehicle_page.drive', 'Drive'),     val: vtVal(v.drive_type || '') },
            { label: vt('vehicle_page.seats', 'Seats'),     val: (v.seats || 5) + ' ' + vt('vehicle_page.seats_suffix', 'seats') },
            { label: vt('vehicle_page.doors', 'Doors'),     val: (v.doors || 4) + ' ' + vt('vehicle_page.doors_suffix', 'doors') },
            { label: vt('vehicle_page.interior', 'Interior'),  val: vtVal(v.interior_type || 'fabric') },
            { label: vt('vehicle_page.steering', 'Steering'),  val: vtVal(v.steering_side || 'left') },
            { label: vt('vehicle_page.color', 'Color'),     val: vtVal(v.color || '') },
            { label: vt('vehicle_page.fuel_policy', 'Fuel Policy'), val: vtVal(v.fuel_policy || 'full_to_full') },
            { label: vt('vehicle_page.deposit', 'Deposit'),   val: v.deposit_amount ? ((typeof Currency !== 'undefined') ? Currency.formatPrice(v.deposit_amount) : ('$' + v.deposit_amount)) : vt('vehicle_page.val_none', 'None') },
            { label: vt('vehicle_page.min_age', 'Min Age'),   val: (v.min_age || 21) + ' ' + vt('vehicle_page.years_suffix', 'years') },
            { label: vt('vehicle_page.price_day', 'Price/Day'), val: (typeof Currency !== 'undefined') ? Currency.formatPrice(v.price_per_day || 0) : ('$' + (v.price_per_day || 0)) }
        ];
        if (v.fuel_consumption) specs.push({ label: vt('vehicle_page.fuel', 'Fuel'), val: v.fuel_consumption });
        if (v.mileage_limit_enabled && v.mileage_km) specs.push({ label: vt('vehicle_page.mileage_limit', 'Mileage Limit'), val: v.mileage_km + ' km' });
        else if (!v.mileage_limit_enabled) specs.push({ label: vt('vehicle_page.mileage', 'Mileage'), val: vt('vehicle_page.unlimited', 'Unlimited') });
        var specsGrid = document.getElementById('vdSpecsGrid');
        specs.forEach(function(s) {
            var div = document.createElement('div');
            div.className = 'vd-spec-item';
            div.innerHTML = '<span class="vd-spec-label">' + esc(s.label) + '</span><span class="vd-spec-val">' + esc(s.val) + '</span>';
            specsGrid.appendChild(div);
        });

        // Description — show it in the visitor's CURRENT language only; fall back to
        // the partner's default text if that language has none (never show another
        // language's text, e.g. Russian on a Georgian page).
        vdMinRentalDays = Math.max(1, parseInt(v.min_rental_days, 10) || 1);
        var _dlang = ((typeof I18n !== 'undefined' && I18n.lang) ? I18n.lang() : (document.documentElement.lang || 'en')).slice(0, 2);
        var _desc = v['description_' + _dlang] || v.description || '';
        if (_desc) {
            document.getElementById('vdDescription').textContent = _desc;
            document.getElementById('vdDescSection').style.display = 'block';
        }

        // Features — handle both old array and new object format
        var features = [];
        var rawFeatures = v.features;
        if (typeof rawFeatures === 'string') { try { rawFeatures = JSON.parse(rawFeatures); } catch(e) { rawFeatures = []; } }
        if (Array.isArray(rawFeatures)) {
            features = rawFeatures;
        } else if (rawFeatures && typeof rawFeatures === 'object') {
            var featureLabels = { ac: vt('vehicle_page.ac','Air Conditioning'), cruise_control: vt('vehicle_page.cruise_control','Cruise Control'), rear_camera: vt('vehicle_page.rear_camera','Rear Camera'), parking_assist: vt('vehicle_page.parking_assist','Parking Assist'), abs: 'ABS', esp: 'ESP', heated_seats: vt('vehicle_page.heated_seats','Heated Seats'), sunroof: vt('vehicle_page.sunroof','Sunroof') };
            Object.keys(rawFeatures).forEach(function(key) {
                if (rawFeatures[key]) features.push(featureLabels[key] || cap(key.replace(/_/g, ' ')));
            });
        }

        // Multimedia features
        var rawMm = v.multimedia;
        if (typeof rawMm === 'string') { try { rawMm = JSON.parse(rawMm); } catch(e) { rawMm = {}; } }
        if (rawMm && typeof rawMm === 'object') {
            var mmLabels = { android_auto: vt('vehicle_page.android_auto','Android Auto'), apple_carplay: vt('vehicle_page.apple_carplay','Apple CarPlay'), bluetooth: vt('vehicle_page.bluetooth','Bluetooth'), touch_screen: vt('vehicle_page.touch_screen','Touch Screen') };
            Object.keys(rawMm).forEach(function(key) {
                if (rawMm[key]) features.push(mmLabels[key] || cap(key.replace(/_/g, ' ')));
            });
        }

        // Svaneti roads from extras
        var vdExtras = v.extras;
        if (typeof vdExtras === 'string') { try { vdExtras = JSON.parse(vdExtras); } catch(e) { vdExtras = {}; } }
        vdExtras = vdExtras || {};
        if (vdExtras.svaneti_roads) features.push(vt('vehicle_page.svaneti_accepted','Svaneti Roads Accepted'));
        if (v.offroad_allowed) features.push(vt('vehicle_page.offroad_allowed','Off-road / mountain roads allowed'));

        if (v.insurance_included) features.unshift(vt('vehicle_page.insurance_included','Insurance Included'));
        if (v.free_cancellation) features.unshift(vt('vehicle_page.free_cancellation','Free Cancellation'));
        if (features.length > 0) {
            var featEl = document.getElementById('vdFeatures');
            features.forEach(function(f) {
                var tag = document.createElement('span');
                tag.className = 'vd-feature-tag';
                tag.textContent = f;
                featEl.appendChild(tag);
            });
            document.getElementById('vdFeaturesSection').style.display = 'block';
        }

        // Badges in booking panel
        var badges = document.getElementById('vdBadges');
        if (v.insurance_included) badges.innerHTML += '<span class="vd-badge green">' + esc(vt('vehicle_page.badge_insurance','Insurance')) + ' \u2713</span>';
        if (v.free_cancellation) badges.innerHTML += '<span class="vd-badge green">' + esc(vt('vehicle_page.badge_free_cancel','Free Cancel')) + ' \u2713</span>';
        if (v.deposit_amount && v.deposit_amount > 0) badges.innerHTML += '<span class="vd-badge">' + esc(vt('vehicle_page.badge_deposit','Deposit')) + ' ' + ((typeof Currency !== 'undefined') ? Currency.formatPrice(v.deposit_amount) : ('$' + v.deposit_amount)) + '</span>';
        if (vdExtras.svaneti_roads) badges.innerHTML += '<span class="vd-badge green">' + esc(vt('vehicle_page.badge_svaneti','Svaneti Roads')) + ' \u2713</span>';
        if (v.rent_with_driver_only === 1 || v.rent_with_driver_only === true) badges.innerHTML += '<span class="vd-badge" style="color:#ff3b3b;border-color:rgba(255,59,59,0.5);font-weight:800;text-shadow:0 0 8px rgba(255,59,59,0.7);">&#128663; ' + esc(vt('fleet.driver_only','Only rent out with driver')) + '</span>';

        // Fav button
        var favBtn = document.getElementById('vdFavBtn');
        var token = localStorage.getItem('token') || sessionStorage.getItem('token');
        var user = null;
        try { user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')); } catch(e) {}

        if (token && user && user.role === 'guest') {
            fetch('/api/favorites/check/' + vehicleId, { headers: { 'Authorization': 'Bearer ' + token } })
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (d.isFavorite) { favBtn.classList.add('active'); favBtn.innerHTML = '&#9829;'; }
            }).catch(function(){});
        }

        favBtn.addEventListener('click', function() {
            var t = localStorage.getItem('token') || sessionStorage.getItem('token');
            var u = null;
            try { u = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')); } catch(e) {}
            if (!t || !u || u.role !== 'guest') {
                window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
                return;
            }
            var isFav = favBtn.classList.contains('active');
            fetch('/api/favorites/' + vehicleId, {
                method: isFav ? 'DELETE' : 'POST',
                headers: { 'Authorization': 'Bearer ' + t }
            })
            .then(function(r) { return r.json(); })
            .then(function() {
                if (isFav) { favBtn.classList.remove('active'); favBtn.innerHTML = '&#9825;'; favBtn.style.color = ''; }
                else { favBtn.classList.add('active'); favBtn.innerHTML = '&#9829;'; favBtn.style.color = '#ef4444'; }
            })
            .catch(function(e) { console.error(e); });
        });

        // ---- Share button: copy car link (+ partner referral code) ----
        setupShareButton(v);
    }

    // Fetch the current user's partner referral code (only partners have one).
    // Cached so we don't refetch on every share click.
    var _refCodePromise = null;
    function getMyReferralCode() {
        if (_refCodePromise) return _refCodePromise;
        var t = localStorage.getItem('token') || sessionStorage.getItem('token');
        var u = null;
        try { u = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')); } catch (e) {}
        if (!t || !u || u.role !== 'partner') {
            _refCodePromise = Promise.resolve(null);
            return _refCodePromise;
        }
        _refCodePromise = fetch('/api/partner/referral-stats', { headers: { 'Authorization': 'Bearer ' + t } })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) { return (d && d.my_code) ? d.my_code : null; })
            .catch(function () { return null; });
        return _refCodePromise;
    }

    function showShareToast(msg) {
        var toast = document.getElementById('vdShareToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'vdShareToast';
            toast.className = 'vd-share-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toast._t);
        toast._t = setTimeout(function () { toast.classList.remove('show'); }, 2200);
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise(function (resolve, reject) {
            try {
                var ta = document.createElement('textarea');
                ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta); ta.focus(); ta.select();
                document.execCommand('copy'); document.body.removeChild(ta);
                resolve();
            } catch (e) { reject(e); }
        });
    }

    function setupShareButton(v) {
        var btn = document.getElementById('vdShareBtn');
        if (!btn) return;
        btn.addEventListener('click', function () {
            getMyReferralCode().then(function (code) {
                var base = window.location.origin + '/vehicle.html?id=' + vehicleId;
                var url = code ? (base + '&ref=' + encodeURIComponent(code)) : base;
                var title = (v && v.name) ? v.name : 'Car rental';
                var copiedMsg = vt('vehicle_page.link_copied', 'Link copied!');
                if (navigator.share) {
                    navigator.share({ title: title, url: url }).catch(function () {
                        copyToClipboard(url).then(function () { showShareToast(copiedMsg); }).catch(function () {});
                    });
                } else {
                    copyToClipboard(url).then(function () { showShareToast(copiedMsg); }).catch(function () {
                        showShareToast(url);
                    });
                }
            });
        });
    }

    function showError() {
        document.getElementById('vdLoading').style.display = 'none';
        document.getElementById('vdError').classList.add('visible');
    }

    // ========================================
    // MINI CALENDAR
    // ========================================
    var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    function vdFmt(d) {
        return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    }
    function vdUtcFmt(d) {
        return d.getUTCFullYear() + '-' + String(d.getUTCMonth()+1).padStart(2,'0') + '-' + String(d.getUTCDate()).padStart(2,'0');
    }
    function vdFmtDisplay(d) {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    function vdDayCount(startDate, endDate, pickupTime, dropoffTime) {
        var start = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()));
        var end = new Date(Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()));
        var baseDays = Math.max(1, Math.round((end - start) / 86400000));

        // If return time exceeds pickup time by more than 2 hours, charge an extra day
        if (pickupTime && dropoffTime) {
            var pParts = pickupTime.split(':');
            var dParts = dropoffTime.split(':');
            var pickupMinutes = parseInt(pParts[0], 10) * 60 + parseInt(pParts[1] || '0', 10);
            var dropoffMinutes = parseInt(dParts[0], 10) * 60 + parseInt(dParts[1] || '0', 10);
            if (dropoffMinutes - pickupMinutes > 120) {
                baseDays += 1;
            }
        }
        return baseDays;
    }

    function vdGetDailyRateByTier(days) {
        if (!vehicleData) return 0;
        var pt = vehicleData.price_tiers;
        if (typeof pt === 'string') { try { pt = JSON.parse(pt); } catch(e) { pt = {}; } }
        pt = pt || {};
        var fallback = parseFloat(vehicleData.price_per_day) || 0;
        if (days <= 3 && pt.price_1_3 > 0) return parseFloat(pt.price_1_3);
        if (days <= 7 && pt.price_4_7 > 0) return parseFloat(pt.price_4_7);
        if (days <= 14 && pt.price_8_14 > 0) return parseFloat(pt.price_8_14);
        if (days <= 30 && pt.price_15_30 > 0) return parseFloat(pt.price_15_30);
        return fallback;
    }

    window.vdOpenCalendar = function(target) {
        vdCalTarget = target;
        vdCalDisplay = target === 'dropoff' && vdDropoffDate ? new Date(vdDropoffDate) : (vdPickupDate ? new Date(vdPickupDate) : new Date());
        vdCalDisplay.setDate(1);
        vdCalDisplay.setHours(0,0,0,0);
        vdTempPickupDate = vdPickupDate ? new Date(vdPickupDate) : null;
        vdTempDropoffDate = vdDropoffDate ? new Date(vdDropoffDate) : null;
        renderCalendar();
        document.getElementById('vdCalModal').style.display = 'flex';
    };

    function renderCalendar() {
        if (!vdCalDisplay) return;
        var year = vdCalDisplay.getFullYear();
        var month = vdCalDisplay.getMonth();
        var today = new Date();
        var firstDay = new Date(year, month, 1).getDay();
        var daysInMonth = new Date(year, month + 1, 0).getDate();
        var grid = document.getElementById('vdCalGrid');
        var instructionEl = document.getElementById('vdCalInstruction');

        if (!grid || !instructionEl) return;

        today.setHours(0,0,0,0);
        document.getElementById('vdCalMonthLabel').textContent = MONTHS[month] + ' ' + year;
        grid.innerHTML = '';

        for (var i = 0; i < firstDay; i++) {
            var empty = document.createElement('div');
            empty.className = 'vd-cal-day empty';
            grid.appendChild(empty);
        }

        for (var d = 1; d <= daysInMonth; d++) {
            var date = new Date(year, month, d);
            var dateStr = vdFmt(date);
            var activeDate = vdCalTarget === 'pickup' ? vdTempPickupDate : vdTempDropoffDate;
            var dayEl = document.createElement('div');
            dayEl.className = 'vd-cal-day';
            dayEl.textContent = d;

            if (date < today) {
                dayEl.classList.add('past');
            } else if (blockedDates[dateStr] || vdDateFullyBlocked(dateStr)) {
                dayEl.classList.add('blocked');
            } else {
                if (vdDateHasBlock(dateStr)) dayEl.classList.add('partial');
                if (activeDate && vdFmt(activeDate) === dateStr) dayEl.classList.add('selected');
                if (date.toDateString() === today.toDateString()) dayEl.classList.add('today');

                (function(date) {
                    dayEl.addEventListener('click', function() {
                        if (vdCalTarget === 'pickup') {
                            vdTempPickupDate = new Date(date);
                            if (vdTempDropoffDate && vdTempDropoffDate <= vdTempPickupDate) vdTempDropoffDate = null;
                            if (vdTempDropoffDate && hasBlockedInRange(vdTempPickupDate, vdTempDropoffDate)) vdTempDropoffDate = null;
                        } else {
                            var pickupBase = vdTempPickupDate || vdPickupDate;
                            if (pickupBase && date <= pickupBase) {
                                instructionEl.textContent = 'Must be after pick-up date';
                                instructionEl.style.color = '#ef4444';
                                return;
                            }
                            if (pickupBase) {
                                var blockedDate = hasBlockedInRange(pickupBase, date);
                                if (blockedDate) {
                                    instructionEl.textContent = 'Blocked date ' + blockedDate + ' is in your range';
                                    instructionEl.style.color = '#ef4444';
                                    return;
                                }
                            }
                            vdTempDropoffDate = new Date(date);
                        }
                        renderCalendar();
                    });
                })(new Date(date));
            }

            grid.appendChild(dayEl);
        }

        if (vdCalTarget === 'pickup') {
            instructionEl.textContent = vdTempPickupDate ? 'Pick-up date selected' : 'Select pick-up date';
        } else {
            instructionEl.textContent = vdTempDropoffDate ? 'Drop-off date selected' : 'Select drop-off date';
        }
        instructionEl.style.color = '';
    }

    document.getElementById('vdCalPrev').addEventListener('click', function() {
        vdCalDisplay.setMonth(vdCalDisplay.getMonth() - 1);
        renderCalendar();
    });
    document.getElementById('vdCalNext').addEventListener('click', function() {
        vdCalDisplay.setMonth(vdCalDisplay.getMonth() + 1);
        renderCalendar();
    });
    document.getElementById('vdCalClose').addEventListener('click', function() {
        document.getElementById('vdCalModal').style.display = 'none';
    });
    document.getElementById('vdCalApply').addEventListener('click', function() {
        if (vdCalTarget === 'pickup') {
            if (!vdTempPickupDate) return;
            vdPickupDate = new Date(vdTempPickupDate);
            if (vdDropoffDate && vdDropoffDate <= vdPickupDate) vdDropoffDate = null;
            if (vdDropoffDate && hasBlockedInRange(vdPickupDate, vdDropoffDate)) vdDropoffDate = null;
        } else {
            if (!vdTempDropoffDate) return;
            vdDropoffDate = new Date(vdTempDropoffDate);
        }
        document.getElementById('vdCalModal').style.display = 'none';
        updateDateDisplay();
    });
    document.getElementById('vdCalModal').addEventListener('click', function(e) {
        if (e.target === this) this.style.display = 'none';
    });

    // Group ['00:00','01:00',...,'11:00'] -> '00:00–12:00'
    function vdSummariseHours(list) {
        var hours = list.map(function (v) { return parseInt(v.split(':')[0], 10); }).sort(function (a, b) { return a - b; });
        var ranges = [], s = null, prev = null;
        hours.forEach(function (h) {
            if (s === null) { s = h; prev = h; }
            else if (h === prev + 1) { prev = h; }
            else { ranges.push([s, prev]); s = h; prev = h; }
        });
        if (s !== null) ranges.push([s, prev]);
        function p(n) { return String(n).padStart(2, '0'); }
        return ranges.map(function (r) {
            var endH = r[1] + 1;
            return p(r[0]) + ':00–' + (endH >= 24 ? '24:00' : p(endH) + ':00');
        }).join(', ');
    }

    // Disable blocked hour options on the time selects for the chosen dates, and
    // show a small note of the unavailable hours. Called from updateDateDisplay.
    function vdApplyTimeBlocks() {
        applyForSelect('vdPickupTime', vdPickupDate, 'vdPickupTimeNote');
        applyForSelect('vdDropoffTime', vdDropoffDate, 'vdDropoffTimeNote');

        function applyForSelect(selId, dateObj, noteId) {
            var sel = document.getElementById(selId);
            if (!sel) return;
            var dateStr = dateObj ? vdFmt(dateObj) : null;
            var blockedList = [], availableList = [], firstEnabled = null;
            for (var i = 0; i < sel.options.length; i++) {
                var opt = sel.options[i];
                var hour = parseInt(opt.value.split(':')[0], 10);
                var blocked = dateStr ? vdHourBlocked(dateStr, hour) : false;
                opt.disabled = blocked;
                // Draw a strikethrough line through blocked hours (combining overlay
                // U+0336 — renders reliably in native <option>s where CSS does not).
                opt.textContent = blocked ? opt.value.split('').map(function (c) { return c + '̶'; }).join('') : opt.value;
                if (blocked) blockedList.push(opt.value);
                else { availableList.push(opt.value); if (firstEnabled === null) firstEnabled = opt.value; }
            }
            var curOpt = sel.options[sel.selectedIndex];
            if (curOpt && curOpt.disabled && firstEnabled !== null) sel.value = firstEnabled;

            var note = document.getElementById(noteId);
            if (!note) {
                note = document.createElement('div');
                note.id = noteId;
                note.style.cssText = 'font-size:11px;color:#ef4444;margin-top:4px;line-height:1.4;';
                sel.parentNode.appendChild(note);
            }
            if (dateStr && blockedList.length) {
                note.innerHTML = '<span style="color:#ef4444;">' + vt('vehicle_page.hours_unavailable', 'Unavailable') + ': ' + vdSummariseHours(blockedList) + '</span>'
                    + (availableList.length ? '<br><span style="color:#16a34a;">' + vt('vehicle_page.legend_available', 'Available') + ': ' + vdSummariseHours(availableList) + '</span>' : '');
                note.style.display = '';
            } else {
                note.style.display = 'none';
            }
        }
    }

    function updateDateDisplay() {
        var pickupEl = document.getElementById('vdPickupVal');
        var dropoffEl = document.getElementById('vdDropoffVal');
        var totalRow = document.getElementById('vdTotalRow');
        var totalAmt = document.getElementById('vdTotalAmount');

        if (vdPickupDate) {
            pickupEl.textContent = vdFmtDisplay(vdPickupDate);
            document.getElementById('vdPickupBox').classList.add('active');
        } else {
            pickupEl.textContent = 'Select date';
            document.getElementById('vdPickupBox').classList.remove('active');
        }
        if (vdDropoffDate) {
            dropoffEl.textContent = vdFmtDisplay(vdDropoffDate);
            document.getElementById('vdDropoffBox').classList.add('active');
        } else {
            dropoffEl.textContent = 'Select date';
            document.getElementById('vdDropoffBox').classList.remove('active');
        }

        // Disable hours blocked by the partner (incl. buffer) for the chosen dates
        vdApplyTimeBlocks();

        var clearBtn = document.getElementById('vdClearBtn');
        if (vdPickupDate && vdDropoffDate && vehicleData) {
            var pTime = document.getElementById('vdPickupTime').value || '10:00';
            var dTime = document.getElementById('vdDropoffTime').value || '10:00';
            var days = vdDayCount(vdPickupDate, vdDropoffDate, pTime, dTime);
            var dailyRate = vdGetDailyRateByTier(days);
            var total = (days * dailyRate).toFixed(2);
            var fmtTotal = (typeof Currency !== 'undefined') ? Currency.formatPrice(parseFloat(total)) : ('$' + total);
            var fmtDaily = (typeof Currency !== 'undefined') ? Currency.formatPrice(dailyRate) : ('$' + dailyRate.toFixed(2));
            totalAmt.textContent = fmtTotal + ' (' + days + ' day' + (days !== 1 ? 's' : '') + ' × ' + fmtDaily + ')';
            totalRow.style.display = 'flex';
        } else {
            totalRow.style.display = 'none';
        }
        // Show/hide clear button
        if (clearBtn) {
            clearBtn.style.display = (vdPickupDate || vdDropoffDate) ? 'block' : 'none';
        }
    }

    // Recalculate price when time changes
    document.getElementById('vdPickupTime').addEventListener('change', updateDateDisplay);
    document.getElementById('vdDropoffTime').addEventListener('change', updateDateDisplay);

    // Clear Dates button
    document.getElementById('vdClearBtn').addEventListener('click', function() {
        vdPickupDate = null;
        vdDropoffDate = null;
        vdTempPickupDate = null;
        vdTempDropoffDate = null;
        document.getElementById('vdPickupTime').value = '10:00';
        document.getElementById('vdDropoffTime').value = '10:00';
        updateDateDisplay();
    });

    // ========================================
    // BOOK NOW
    // ========================================
    document.getElementById('vdBookBtn').addEventListener('click', function() {
        var token = localStorage.getItem('token') || sessionStorage.getItem('token');
        var user = null;
        try { user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')); } catch(e) {}

        // NOTE: date validation happens BEFORE the login check so a logged-out guest
        // can pick car + dates, and we carry that selection through login (below).
        if (!vdPickupDate) {
            document.getElementById('vdPickupBox').style.borderColor = '#ef4444';
            setTimeout(function() { document.getElementById('vdPickupBox').style.borderColor = ''; }, 2000);
            vdOpenCalendar('pickup');
            return;
        }
        if (!vdDropoffDate) {
            document.getElementById('vdDropoffBox').style.borderColor = '#ef4444';
            setTimeout(function() { document.getElementById('vdDropoffBox').style.borderColor = ''; }, 2000);
            vdOpenCalendar('dropoff');
            return;
        }

        // Enforce the partner's minimum rental duration before proceeding.
        var _selDays = Math.max(1, Math.round((vdDropoffDate - vdPickupDate) / 86400000));
        if (_selDays < vdMinRentalDays) {
            var _msg = ((typeof I18n !== 'undefined' && I18n.t && I18n.t('vehicle_page.min_rental_days') !== 'vehicle_page.min_rental_days')
                ? I18n.t('vehicle_page.min_rental_days') : 'This car is available for rental for {n} days or more').replace('{n}', vdMinRentalDays);
            alert(_msg);
            return;
        }

        // Navigate to reservation page with dates and times
        var pickupTime = document.getElementById('vdPickupTime').value;
        var dropoffTime = document.getElementById('vdDropoffTime').value;
        var params = 'id=' + vehicleId
            + '&pickup=' + vdFmt(vdPickupDate)
            + '&dropoff=' + vdFmt(vdDropoffDate)
            + '&pickup_time=' + encodeURIComponent(pickupTime)
            + '&dropoff_time=' + encodeURIComponent(dropoffTime);
        var resUrl = 'reservation.html?' + params;

        // Not logged in? Send the guest to login/register with the RESERVATION url
        // (car + dates included) as the return target — so after auth they resume
        // the same reservation and continue straight to payment.
        if (!token || !user || user.role !== 'guest') {
            window.location.href = 'login.html?redirect=' + encodeURIComponent(resUrl);
            return;
        }
        window.location.href = resUrl;
    });

    document.getElementById('vdBookingClose').addEventListener('click', function() {
        document.getElementById('vdBookingModal').style.display = 'none';
    });
    document.getElementById('vdBookingModal').addEventListener('click', function(e) {
        if (e.target === this) this.style.display = 'none';
    });

    document.getElementById('vdBkSubmit').addEventListener('click', function() {
        var token = localStorage.getItem('token') || sessionStorage.getItem('token');
        var btn = this;
        var errEl = document.getElementById('vdBkError');

        errEl.style.display = 'none';
        btn.disabled = true;
        btn.textContent = 'Submitting...';

        fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({
                vehicle_id:       vehicleId,
                pickup_date:      vdFmt(vdPickupDate),
                dropoff_date:     vdFmt(vdDropoffDate),
                pickup_location:  document.getElementById('vdBkPickupLoc').value.trim(),
                dropoff_location: document.getElementById('vdBkDropoffLoc').value.trim(),
                guest_notes:      document.getElementById('vdBkNotes').value.trim()
            })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            btn.disabled = false;
            btn.textContent = 'Confirm Booking';
            if (data.error) {
                errEl.textContent = data.error;
                errEl.style.display = 'block';
                return;
            }
            document.getElementById('vdBookingModal').style.display = 'none';
            document.getElementById('vdSuccessModal').style.display = 'flex';
        })
        .catch(function() {
            btn.disabled = false;
            btn.textContent = 'Confirm Booking';
            errEl.textContent = 'Network error. Please try again.';
            errEl.style.display = 'block';
        });
    });

    document.getElementById('vdSuccessModal').addEventListener('click', function(e) {
        if (e.target === this) this.style.display = 'none';
    });

    // Re-render prices on currency change
    document.addEventListener('currencyChanged', function() {
        if (vehicleData) {
            var priceEl = document.getElementById('vdPrice');
            if (priceEl) {
                var ccDriverOnly = (vehicleData.rent_with_driver_only === 1 || vehicleData.rent_with_driver_only === true);
                var ccDriverPrice = 0;
                if (ccDriverOnly) {
                    var ccEx = vehicleData.extras;
                    if (typeof ccEx === 'string') { try { ccEx = JSON.parse(ccEx); } catch (e) { ccEx = {}; } }
                    ccEx = ccEx || {};
                    ccDriverPrice = parseFloat(ccEx.driver_service) || 0;
                }
                var ccHeadline = (parseFloat(vehicleData.price_per_day) || 0) + ccDriverPrice;
                priceEl.textContent = (typeof Currency !== 'undefined') ? Currency.formatPrice(ccHeadline) : ('$' + ccHeadline);
                var ccBreakdown = document.getElementById('vdPriceBreakdown');
                if (ccBreakdown && ccDriverOnly && ccDriverPrice > 0) {
                    var rStr = (typeof Currency !== 'undefined') ? Currency.formatPrice(vehicleData.price_per_day || 0) : ('$' + (vehicleData.price_per_day || 0));
                    var dStr = (typeof Currency !== 'undefined') ? Currency.formatPrice(ccDriverPrice) : ('$' + ccDriverPrice);
                    ccBreakdown.textContent = rStr + ' ' + vt('fleet.rent', 'rent') + ' + ' + dStr + ' ' + vt('fleet.driver', 'driver');
                }
            }
            if (typeof Currency !== 'undefined') Currency.refresh();
            // Re-calc booking total if dates selected
            if (vdPickupDate && vdDropoffDate) {
                var totalRow = document.getElementById('vdTotalRow');
                var totalAmt = document.getElementById('vdTotalAmt');
                if (totalRow && totalAmt) {
                    var pTime = document.getElementById('vdPickupTime').value || '10:00';
                    var dTime = document.getElementById('vdDropoffTime').value || '10:00';
                    var days = vdDayCount(vdPickupDate, vdDropoffDate, pTime, dTime);
                    var dailyRate = vdGetDailyRateByTier(days);
                    var total = (days * dailyRate).toFixed(2);
                    var fmtTotal = Currency.formatPrice(parseFloat(total));
                    var fmtDaily = Currency.formatPrice(dailyRate);
                    totalAmt.textContent = fmtTotal + ' (' + days + ' day' + (days !== 1 ? 's' : '') + ' × ' + fmtDaily + ')';
                }
            }
        }
    });

    function cap(s) {
        if (!s) return '';
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

})();
