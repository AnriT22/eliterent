/* ========================================
   VEHICLE DETAIL PAGE — JAVASCRIPT
   ======================================== */

(function () {
    function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    var vehicleId = null;
    var vehicleData = null;
    var blockedDates = {};
    var vdPickupDate = null;
    var vdDropoffDate = null;
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

    // Load vehicle data
    fetch('/api/vehicles/' + vehicleId)
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.error || !data.vehicle) { showError(); return; }
        vehicleData = data.vehicle;
        renderPage(vehicleData);
        loadBlockedDates();
    })
    .catch(function() { showError(); });

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
            if (blockedDates[ds]) return ds;
            cur.setDate(cur.getDate() + 1);
        }
        return null;
    }

    function renderPage(v) {
        document.getElementById('vdLoading').style.display = 'none';
        document.getElementById('vdContent').style.display = 'grid';

        var name = v.name || 'Vehicle';
        document.title = name + ' — RoyalCar.rent';
        document.getElementById('vdBreadcrumbName').textContent = name;
        document.getElementById('vdVehicleName').textContent = name;

        // Meta
        var cat = (v.category || 'economy');
        var engine = v.engine || '';
        var gearbox = v.gearbox || '';
        var year = v.year || '';
        document.getElementById('vdVehicleMeta').textContent =
            [cap(cat), year, cap(engine), cap(gearbox)].filter(Boolean).join(' · ');

        // Price
        document.getElementById('vdPrice').textContent = '$' + (v.price_per_day || 0);

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
        if (imgs.length > 0) {
            mainImg.src = imgs[0];
            mainImg.alt = name;
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
            { label: vt('vehicle_page.deposit', 'Deposit'),   val: v.deposit_amount ? '$' + v.deposit_amount : vt('vehicle_page.val_none', 'None') },
            { label: vt('vehicle_page.min_age', 'Min Age'),   val: (v.min_age || 21) + ' ' + vt('vehicle_page.years_suffix', 'years') },
            { label: vt('vehicle_page.price_day', 'Price/Day'), val: '$' + (v.price_per_day || 0) }
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

        // Description
        if (v.description) {
            document.getElementById('vdDescription').textContent = v.description;
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
        if (v.insurance_included) badges.innerHTML += '<span class="vd-badge green">Insurance \u2713</span>';
        if (v.free_cancellation) badges.innerHTML += '<span class="vd-badge green">Free Cancel \u2713</span>';
        if (v.deposit_amount && v.deposit_amount > 0) badges.innerHTML += '<span class="vd-badge">Deposit $' + v.deposit_amount + '</span>';
        if (vdExtras.svaneti_roads) badges.innerHTML += '<span class="vd-badge green">Svaneti Roads \u2713</span>';

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
            } else if (blockedDates[dateStr]) {
                dayEl.classList.add('blocked');
            } else {
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

        var clearBtn = document.getElementById('vdClearBtn');
        if (vdPickupDate && vdDropoffDate && vehicleData) {
            var pTime = document.getElementById('vdPickupTime').value || '10:00';
            var dTime = document.getElementById('vdDropoffTime').value || '10:00';
            var days = vdDayCount(vdPickupDate, vdDropoffDate, pTime, dTime);
            var dailyRate = vdGetDailyRateByTier(days);
            var total = (days * dailyRate).toFixed(2);
            totalAmt.textContent = '$' + total + ' (' + days + ' day' + (days !== 1 ? 's' : '') + ' × $' + dailyRate.toFixed(2) + ')';
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

        if (!token || !user || user.role !== 'guest') {
            window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
            return;
        }

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

        // Navigate to reservation page with dates and times
        var pickupTime = document.getElementById('vdPickupTime').value;
        var dropoffTime = document.getElementById('vdDropoffTime').value;
        var params = 'id=' + vehicleId
            + '&pickup=' + vdFmt(vdPickupDate)
            + '&dropoff=' + vdFmt(vdDropoffDate)
            + '&pickup_time=' + encodeURIComponent(pickupTime)
            + '&dropoff_time=' + encodeURIComponent(dropoffTime);
        window.location.href = 'reservation.html?' + params;
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

    function cap(s) {
        if (!s) return '';
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

})();
