/* ========================================
   RESERVATION PAGE — JAVASCRIPT
   ======================================== */

(function () {
    var params = new URLSearchParams(window.location.search);
    var vehicleId = parseInt(params.get('id'), 10);
    var pickupStr = params.get('pickup');
    var dropoffStr = params.get('dropoff');
    var pickupTime = params.get('pickup_time') || '10:00';
    var dropoffTime = params.get('dropoff_time') || '10:00';

    if (!vehicleId || !pickupStr || !dropoffStr) {
        window.location.href = 'vehicles.html';
        return;
    }

    var token = localStorage.getItem('token') || sessionStorage.getItem('token');
    var user = null;
    try { user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')); } catch (e) {}
    if (!token || !user || user.role !== 'guest') {
        window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
        return;
    }

    var WEBSITE_FEE_PERCENT = 0.30;
    var EXTRA_ICONS = {
        baby_seat: '🍼',
        additional_driver: '👤',
        gps_controlled: '📍',
        android_auto_carplay: '📱'
    };

    var pickupDate = new Date(pickupStr + 'T' + pickupTime + ':00');
    var dropoffDate = new Date(dropoffStr + 'T' + dropoffTime + ':00');
    var vehicleData = null;
    var galleryImages = [];
    var currentImgIdx = 0;

    var fetchedVehicle = null;
    var i18nReady = false;
    var pageRendered = false;

    function tryRenderReservation() {
        if (fetchedVehicle && i18nReady && !pageRendered) {
            pageRendered = true;
            vehicleData = fetchedVehicle;
            document.getElementById('rvLoading').style.display = 'none';
            document.getElementById('rvContent').style.display = 'grid';
            renderReservation();
        }
    }

    fetch('/api/vehicles/' + vehicleId)
    .then(function (r) { return r.json(); })
    .then(function (data) {
        if (data.error || !data.vehicle) {
            window.location.href = 'vehicles.html';
            return;
        }
        fetchedVehicle = data.vehicle;
        tryRenderReservation();
    })
    .catch(function () {
        window.location.href = 'vehicles.html';
    });

    if (typeof I18n !== 'undefined' && I18n.onReady) {
        I18n.onReady(function() { i18nReady = true; tryRenderReservation(); });
    } else {
        i18nReady = true;
        tryRenderReservation();
    }

    function cap(s) {
        if (!s) return '';
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    function rvt(key, fallback) {
        if (typeof I18n !== 'undefined' && I18n.t) {
            var val = I18n.t(key);
            if (val && val !== key) return val;
        }
        return fallback;
    }

    function parseJsonArray(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        try {
            var parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function getRentalDays() {
        var start = new Date(pickupStr + 'T00:00:00Z');
        var end = new Date(dropoffStr + 'T00:00:00Z');
        var baseDays = Math.max(1, Math.round((end - start) / 86400000));

        // If return time exceeds pickup time by more than 2 hours, charge an extra day
        var pParts = pickupTime.split(':');
        var dParts = dropoffTime.split(':');
        var pickupMinutes = parseInt(pParts[0], 10) * 60 + parseInt(pParts[1] || '0', 10);
        var dropoffMinutes = parseInt(dParts[0], 10) * 60 + parseInt(dParts[1] || '0', 10);
        if (dropoffMinutes - pickupMinutes > 120) {
            baseDays += 1;
        }
        return baseDays;
    }

    function getDailyRateByTier(days) {
        if (!vehicleData) return 0;

        // Check custom date-based pricing first
        if (vehicleData.custom_pricing_enabled) {
            var ranges = vehicleData.custom_pricing_ranges;
            if (typeof ranges === 'string') { try { ranges = JSON.parse(ranges); } catch(e) { ranges = []; } }
            if (Array.isArray(ranges) && ranges.length > 0) {
                for (var i = 0; i < ranges.length; i++) {
                    var r = ranges[i];
                    if (r.start && r.end && pickupStr >= r.start && pickupStr <= r.end) {
                        return parseFloat(r.price) || 0;
                    }
                }
            }
        }

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

    function fmtDate(d) {
        return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    }

    function fmtDatetime(d) {
        var h = d.getHours();
        var m = d.getMinutes();
        var timeStr = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
        return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + timeStr;
    }

    function fmtMoney(value) {
        var v = parseFloat(value) || 0;
        return (typeof Currency !== 'undefined') ? Currency.formatPrice(v) : ('$' + v.toFixed(2));
    }

    function fmtD(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function getServiceOptions() {
        var raw = vehicleData && vehicleData.service_options;
        if (!raw) return {};
        if (typeof raw === 'string') {
            try { return JSON.parse(raw); } catch (e) { return {}; }
        }
        return raw;
    }

    function buildLocOption(name, radioName, value, address, price, isFirst) {
        var isFree = price === 0;
        var isDelivery = value.indexOf('Delivery') !== -1;
        var badgeClass = isFree ? 'free' : 'paid';
        var badgeText = isFree ? 'Free' : fmtMoney(price);
        return '<label class="rv-loc-option' + (isFirst ? ' selected' : '') + '">'
            + '<input type="radio" name="' + radioName + '" value="' + value + '"' + (isFirst ? ' checked' : '') + '>'
            + '<div class="rv-loc-option-inner">'
            + (!isFirst ? '<span class="rv-loc-plus">+</span>' : '')
            + '<div class="rv-loc-name">' + name + '</div>'
            + (address ? '<div class="rv-loc-address">' + address + '</div>' : '')
            + '</div>'
            + '<span class="rv-loc-badge ' + badgeClass + '">' + badgeText + '</span>'
            + '</label>';
    }

    function getPickupFees() {
        if (!vehicleData) return {};
        var pf = vehicleData.pickup_fees;
        if (typeof pf === 'string') { try { pf = JSON.parse(pf); } catch(e) { pf = {}; } }
        return pf || {};
    }

    function renderLocations() {
        var v = vehicleData;
        var pf = getPickupFees();
        var feesEnabled = !!v.pickup_fees_enabled;

        // Also try old service_options for backward compat
        var opts = getServiceOptions();
        var oldLoc = (opts.locations || {});
        var oldOffice = oldLoc.office || {};
        var oldAirport = oldLoc.airport || {};
        var oldDelivery = oldLoc.delivery || {};

        var officeAddr = pf.office_address || oldOffice.address || v.partner_location || 'Office';

        // For new structure: a fee is "offered" only if the value is a valid number (including 0 = free)
        var airportFeeRaw = feesEnabled ? pf.airport_fee : null;
        var deliveryFeeRaw = feesEnabled ? pf.delivery_fee : null;
        var airportFee = parseFloat(airportFeeRaw);
        var deliveryFee = parseFloat(deliveryFeeRaw);
        var hasAirport = feesEnabled ? (airportFeeRaw !== null && airportFeeRaw !== undefined && airportFeeRaw !== '' && !isNaN(airportFee)) : !!oldAirport.enabled;
        var hasDelivery = feesEnabled ? (deliveryFeeRaw !== null && deliveryFeeRaw !== undefined && deliveryFeeRaw !== '' && !isNaN(deliveryFee)) : !!oldDelivery.enabled;
        if (!hasAirport && oldAirport.enabled) { hasAirport = true; airportFee = parseFloat(oldAirport.price) || 0; }
        if (!hasDelivery && oldDelivery.enabled) { hasDelivery = true; deliveryFee = parseFloat(oldDelivery.price) || 0; }
        if (isNaN(airportFee)) airportFee = 0;
        if (isNaN(deliveryFee)) deliveryFee = 0;

        var pickupHtml = '';
        var dropoffHtml = '';

        // Office (always present)
        pickupHtml += buildLocOption(officeAddr + ' (Office)', 'pickupLoc', officeAddr + ' (Office)', 'Address: ' + officeAddr, 0, true);
        dropoffHtml += buildLocOption(officeAddr + ' (Office)', 'dropoffLoc', officeAddr + ' (Office)', 'Address: ' + officeAddr, 0, true);

        // Airport
        if (hasAirport) {
            pickupHtml += buildLocOption('Airport Pickup', 'pickupLoc', 'Airport', '', airportFee, false);
            dropoffHtml += buildLocOption('Airport Drop-off', 'dropoffLoc', 'Airport', '', airportFee, false);
        }

        // Delivery
        if (hasDelivery) {
            pickupHtml += buildLocOption('Delivery to your address', 'pickupLoc', 'Delivery to address', 'We\'ll bring the car to you', deliveryFee, false);
            dropoffHtml += buildLocOption('Delivery to your address', 'dropoffLoc', 'Delivery to address', 'We\'ll bring the car to you', deliveryFee, false);
        }

        document.getElementById('rvPickupLocations').innerHTML = pickupHtml;
        document.getElementById('rvDropoffLocations').innerHTML = dropoffHtml;

        setupLocationRadios('pickupLoc', 'rvPickupCustom');
        setupLocationRadios('dropoffLoc', 'rvDropoffCustom');
    }

    var PAYMENT_META = {
        cash:     { icon: '💵', name: 'Cash Payment',       desc: 'Pay on delivery' },
        card:     { icon: '💳', name: 'Credit/Debit Card',  desc: 'Online or at pickup' },
        transfer: { icon: '🏦', name: 'Bank Transfer',      desc: 'Wire transfer before pickup' }
    };

    function renderPaymentMethods() {
        var opts = getServiceOptions();
        var methods = opts.payment_methods || ['cash'];
        var html = '';
        var first = true;

        methods.forEach(function (m) {
            var meta = PAYMENT_META[m] || { icon: '💰', name: cap(m), desc: '' };
            html += '<label class="rv-payment-option' + (first ? ' selected' : '') + '">'
                + '<input type="radio" name="paymentMethod" value="' + m + '"' + (first ? ' checked' : '') + '>'
                + '<span class="rv-pm-icon">' + meta.icon + '</span>'
                + '<div>'
                + '<div class="rv-payment-name">' + meta.name + '</div>'
                + '<div class="rv-payment-desc">' + meta.desc + '</div>'
                + '</div>'
                + '<svg class="rv-pm-check" width="22" height="22" viewBox="0 0 24 24" fill="#22c55e"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4" stroke="#fff" stroke-width="2" fill="none"/></svg>'
                + '</label>';
            first = false;
        });

        html += '<div class="rv-payment-note">'
            + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
            + ' Full payment on delivery. Small booking fee charged now.'
            + '</div>';

        document.getElementById('rvPaymentBody').innerHTML = html;

        document.querySelectorAll('input[name="paymentMethod"]').forEach(function (radio) {
            radio.addEventListener('change', function () {
                var parent = radio.closest('.rv-payment-body');
                parent.querySelectorAll('.rv-payment-option').forEach(function (opt) { opt.classList.remove('selected'); });
                radio.closest('.rv-payment-option').classList.add('selected');
            });
        });
    }

    function getInsuranceItems() {
        return [
            { key: 'tpl', name: rvt('reservation_extras.tpl_name', 'TPL – Third Party Liability'), desc: rvt('reservation_extras.tpl_desc', 'Covers damage caused to other vehicles. Does not cover your rented vehicle.'), icon: '🛡️' },
            { key: 'cdw', name: rvt('reservation_extras.cdw_name', 'CDW – Collision Damage Waiver'), desc: rvt('reservation_extras.cdw_desc', 'Covers damage to the rented vehicle in case of an accident. Does not cover tires, glass, or interior.'), icon: '🔰' },
            { key: 'full_coverage', name: rvt('reservation_extras.full_coverage_name', 'Full Coverage'), desc: rvt('reservation_extras.full_coverage_desc', 'Covers all damages, theft, and roadside assistance. Includes TPL + CDW + full protection.'), icon: '✅' }
        ];
    }

    function getInsurancePricing() {
        if (!vehicleData) return {};
        var ins = vehicleData.insurance;
        if (typeof ins === 'string') { try { ins = JSON.parse(ins); } catch(e) { ins = {}; } }
        return ins || {};
    }

    function renderInsurance() {
        var ins = getInsurancePricing();

        // Backward compat: try old service_options.insurance or insurance_included
        if (!ins.tpl && !ins.cdw && !ins.full_coverage) {
            var opts = getServiceOptions();
            var oldIns = opts.insurance;
            if (oldIns) {
                ins = { tpl: oldIns.tpl ? 0 : null, cdw: oldIns.cdw ? 0 : null, full_coverage: oldIns.full_coverage ? 0 : null };
            } else if (vehicleData && vehicleData.insurance_included) {
                ins = { tpl: 0, cdw: 0, full_coverage: 0 };
            }
        }

        var days = getRentalDays();
        var anyOffered = false;
        var count = 0;
        var html = '<div class="rv-insurance-grid">';

        getInsuranceItems().forEach(function (item) {
            var price = ins[item.key];
            var offered = price !== null && price !== undefined && price !== '';
            var isFree = offered && parseFloat(price) === 0;
            var pricePerDay = offered ? parseFloat(price) : 0;
            if (offered) { anyOffered = true; count++; }
            var cls = offered ? 'rv-insurance-item included' : 'rv-insurance-item';
            if (item.key === 'full_coverage') cls += ' rv-full-coverage';
            html += '<div class="' + cls + '">'
                + '<div class="rv-ins-header-row">'
            var badgeText = !offered ? 'NOT OFFERED' : (isFree ? rvt('reservation_extras.included_free', 'INCLUDED FREE') : fmtMoney(pricePerDay) + rvt('reservation_extras.per_day', '/day'));
                html += '<span class="rv-ins-badge ' + (offered ? 'included' : '') + '">' + badgeText + '</span>';
            if (offered) {
                html += '<svg class="rv-ins-check" width="22" height="22" viewBox="0 0 24 24" fill="#22c55e"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4" stroke="#fff" stroke-width="2" fill="none"/></svg>';
            }
            html += '</div>'
                + '<div class="rv-ins-name">' + item.name + '</div>'
                + '<div class="rv-ins-desc">' + item.desc + '</div>'
                + '<div class="rv-ins-status">'
                + '<span>' + (offered ? (isFree ? rvt('reservation_extras.included_free_label', 'Included free') : fmtMoney(pricePerDay) + rvt('reservation_extras.per_day', '/day')) : 'Not offered') + '</span>'
                + (isFree ? '<span class="rv-ins-free">✓ ' + rvt('reservation_extras.free', 'Free') + '</span>' : '')
                + '</div>'
                + '</div>';
        });

        html += '</div>';
        document.getElementById('rvInsuranceGrid').innerHTML = html;

        if (anyOffered) {
            document.getElementById('rvInsuranceBadge').style.display = 'inline-block';
            document.getElementById('rvInsuranceBadge').textContent = count + ' ' + rvt('reservation_extras.available', 'AVAILABLE');
            document.getElementById('rvInsuranceSubtitle').textContent = '✓ ' + count + ' ' + (count !== 1 ? rvt('reservation_extras.protections_available', 'protections available') : rvt('reservation_extras.protection_available', 'protection available'));
        } else {
            document.getElementById('rvInsuranceBadge').style.display = 'none';
            document.getElementById('rvInsuranceSubtitle').textContent = rvt('reservation_extras.no_insurance', 'No insurance offered with this vehicle');
        }
    }

    function getLocationSurcharge(radioName) {
        var radio = document.querySelector('input[name="' + radioName + '"]:checked');
        if (!radio) return 0;
        var val = radio.value;
        if (val.indexOf('Office') !== -1) return 0;

        var pf = getPickupFees();
        var feesEnabled = !!(vehicleData && vehicleData.pickup_fees_enabled);

        if (val.indexOf('Delivery') !== -1) {
            if (feesEnabled) return parseFloat(pf.delivery_fee) || 0;
            var opts = getServiceOptions();
            return parseFloat(((opts.locations || {}).delivery || {}).price) || 0;
        }
        // Airport
        if (feesEnabled) return parseFloat(pf.airport_fee) || 0;
        var opts2 = getServiceOptions();
        var oldAirport = (opts2.locations || {}).airport || {};
        if (oldAirport.enabled) return parseFloat(oldAirport.price) || 0;
        return 0;
    }

    function getVehicleExtraServices() {
        // New structure: extras is a JSON object with named keys
        var ext = vehicleData ? vehicleData.extras : null;
        if (typeof ext === 'string') { try { ext = JSON.parse(ext); } catch(e) { ext = {}; } }
        ext = ext || {};

        var EXTRA_DEFS = [
            { code: 'child_seat', key: 'child_seat', availKey: 'child_seat_available', name: rvt('reservation_extras.child_seat', 'Child Seat (up to 5 years)'), icon: '🍼', perDay: true },
            { code: 'snow_chains', key: 'snow_chains', availKey: 'snow_chains_available', name: rvt('reservation_extras.snow_chains', 'Snow Chains'), icon: '⛓️', perDay: false },
            { code: 'roof_rack', key: 'roof_rack', availKey: 'roof_rack_available', name: rvt('reservation_extras.roof_rack', 'Roof Luggage Carrier'), icon: '🧳', perDay: true },
            { code: 'third_driver', key: 'third_driver', availKey: null, name: rvt('reservation_extras.additional_driver', 'Additional Driver'), icon: '👤', perDay: true },
            { code: 'svaneti_roads', key: 'svaneti_price', availKey: 'svaneti_roads', name: rvt('reservation_extras.svaneti_roads', 'Mestia / Mountain Svaneti Roads'), icon: '🏔️', perDay: false },
            { code: 'shatili_roads', key: 'shatili_price', availKey: 'shatili_roads', name: rvt('reservation_extras.shatili_roads', 'Shatili Mountain Roads'), icon: '🏔️', perDay: false }
        ];

        var services = [];
        EXTRA_DEFS.forEach(function(def) {
            var price = parseFloat(ext[def.key]);
            var isAvailable = def.availKey ? (ext[def.availKey] || price > 0) : (price > 0);
            if (isAvailable && price > 0) {
                services.push({
                    code: def.code,
                    name: def.name,
                    description: '',
                    price: price,
                    icon: def.icon,
                    perDay: def.perDay
                });
            }
        });

        // Backward compat: also check old extra_services array
        if (services.length === 0) {
            var old = parseJsonArray(vehicleData && vehicleData.extra_services);
            old.filter(function(item) { return item && item.enabled !== false; }).forEach(function(item) {
                var code = item.code || item.id || item.name;
                services.push({
                    code: code,
                    name: item.name || 'Extra Service',
                    description: item.description || '',
                    price: parseFloat(item.price) || 0,
                    icon: item.icon || EXTRA_ICONS[code] || '✨',
                    perDay: code === 'additional_driver'
                });
            });
        }

        return services.filter(function(item) { return !!item.code; });
    }

    function renderExtraServices() {
        var services = getVehicleExtraServices();
        var addonWrap = document.getElementById('rvAddonServices');
        var servicesGrid = document.getElementById('rvServicesGrid');
        var emptyEl = document.getElementById('rvServicesEmpty');
        var addonHtml = '';
        var gridHtml = '';

        services.forEach(function (service) {
            var priceLabel = service.perDay ? fmtMoney(service.price) + rvt('reservation_extras.per_day', '/day') : fmtMoney(service.price) + ' ' + rvt('reservation_extras.once', 'once');
            gridHtml += '<label class="rv-service-item">'
                + '<input type="checkbox" name="extras" value="' + service.code + '" data-price="' + service.price + '"' + (service.perDay ? ' data-perday="1"' : '') + '>'
                + '<div class="rv-service-info">'
                + '<span class="rv-service-icon">' + service.icon + '</span>'
                + '<div>'
                + '<div class="rv-service-name">' + service.name + '</div>'
                + '<div class="rv-service-price">' + priceLabel + (service.description ? ' · ' + service.description : '') + '</div>'
                + '</div>'
                + '</div>'
                + '</label>';
        });

        addonWrap.innerHTML = addonHtml;
        servicesGrid.innerHTML = gridHtml;
        emptyEl.style.display = services.length === 0 ? 'block' : 'none';

        addonWrap.querySelectorAll('input[name="extras"]').forEach(function (cb) {
            cb.addEventListener('change', updatePriceSummary);
        });
        servicesGrid.querySelectorAll('input[name="extras"]').forEach(function (cb) {
            cb.addEventListener('change', updatePriceSummary);
        });
    }

    function getSelectedExtras() {
        var services = getVehicleExtraServices();
        var selectedCodes = [];
        document.querySelectorAll('input[name="extras"]:checked').forEach(function (cb) {
            selectedCodes.push(cb.value);
        });
        return services.filter(function (service) {
            return selectedCodes.indexOf(service.code) !== -1;
        });
    }

    function renderReservation() {
        var v = vehicleData;
        var days = getRentalDays();

        document.title = 'Reservation — ' + v.name + ' — EliteAuto.rent';

        galleryImages = [];
        if (v.image_url) galleryImages.push(v.image_url);
        try {
            var gallery = JSON.parse(v.gallery || '[]');
            galleryImages = galleryImages.concat(gallery);
        } catch (e) {}
        galleryImages = galleryImages.filter(function (u, i, a) { return u && a.indexOf(u) === i; });

        var mainImg = document.getElementById('rvMainImg');
        if (galleryImages.length > 0) {
            mainImg.src = galleryImages[0];
            mainImg.alt = v.name;
        }

        var thumbsEl = document.getElementById('rvThumbs');
        thumbsEl.innerHTML = '';
        if (galleryImages.length > 1) {
            galleryImages.forEach(function (src, idx) {
                var img = document.createElement('img');
                img.src = src;
                img.alt = v.name + ' photo ' + (idx + 1);
                img.className = idx === 0 ? 'active' : '';
                img.addEventListener('click', function () {
                    currentImgIdx = idx;
                    mainImg.src = src;
                    document.querySelectorAll('.rv-thumbs img').forEach(function (t) { t.classList.remove('active'); });
                    img.classList.add('active');
                });
                thumbsEl.appendChild(img);
            });
        }
        if (galleryImages.length <= 1) {
            document.getElementById('rvGalleryPrev').style.display = 'none';
            document.getElementById('rvGalleryNext').style.display = 'none';
        }

        document.getElementById('rvVehicleName').textContent = v.name;

        var specs = [
            { label: 'Category', val: cap(v.category) },
            { label: 'Year', val: v.year },
            { label: 'Engine', val: cap(v.engine) },
            { label: 'Gearbox', val: cap(v.gearbox) },
            { label: 'Drive', val: (v.drive_type || '').toUpperCase() },
            { label: 'Seats', val: (v.seats || 5) + ' seats' },
            { label: 'Doors', val: (v.doors || 4) + ' doors' },
            { label: 'Interior', val: cap(v.interior_type || 'fabric') },
            { label: 'Steering', val: cap(v.steering_side || 'left') + ' Hand' },
            { label: 'Color', val: cap(v.color || '') },
            { label: 'Fuel Policy', val: cap((v.fuel_policy || 'full_to_full').replace(/_/g, ' ')) }
        ];
        if (v.fuel_consumption) specs.push({ label: 'Fuel Consumption', val: v.fuel_consumption });
        if (v.mileage_limit_enabled && v.mileage_km) specs.push({ label: 'Mileage Limit', val: v.mileage_km + ' km' });
        else if (!v.mileage_limit_enabled) specs.push({ label: 'Mileage', val: 'Unlimited' });
        specs.push({ label: 'Min Age', val: (v.min_age || 21) + ' years' });
        var specsGrid = document.getElementById('rvSpecsGrid');
        specsGrid.innerHTML = '';
        specs.forEach(function (s) {
            var div = document.createElement('div');
            div.className = 'rv-spec-item';
            div.innerHTML = '<span class="rv-spec-label">' + s.label + '</span><span class="rv-spec-val">' + s.val + '</span>';
            specsGrid.appendChild(div);
        });

        if (v.whatsapp) {
            document.getElementById('rvWhatsapp').href = 'https://wa.me/' + v.whatsapp.replace(/[^0-9]/g, '');
        }
        if (v.telegram) {
            document.getElementById('rvTelegram').href = 'https://t.me/' + v.telegram.replace('@', '');
        }

        // Dynamic driver age warning
        var minAge = v.min_age || 21;
        var driverWarning = document.querySelector('.rv-driver-warning-content p');
        if (driverWarning) {
            var driverMsg = rvt('reservation.driver_req_text', 'Driver must be at least {age} years old with a minimum of 2 years driving experience.').replace('{age}', minAge);
            driverWarning.textContent = driverMsg;
        }

        // Mountain destination badges
        var ext = v.extras;
        if (typeof ext === 'string') { try { ext = JSON.parse(ext); } catch(e) { ext = {}; } }
        ext = ext || {};
        var mountainHtml = '';
        if (ext.svaneti_roads) {
            var svPrice = parseFloat(ext.svaneti_price) || 0;
            mountainHtml += '<span style="display:inline-flex;align-items:center;gap:6px;background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;padding:6px 14px;border-radius:8px;font-size:13px;font-weight:600;">🏔️ ' + rvt('reservation_extras.svaneti_accepted', 'Mestia / Svaneti roads accepted') + (svPrice > 0 ? ' (+' + fmtMoney(svPrice) + ')' : '') + '</span>';
        }
        if (ext.shatili_roads) {
            var shPrice = parseFloat(ext.shatili_price) || 0;
            mountainHtml += '<span style="display:inline-flex;align-items:center;gap:6px;background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;padding:6px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-left:6px;">🏔️ ' + rvt('reservation_extras.shatili_accepted', 'Shatili roads accepted') + (shPrice > 0 ? ' (+' + fmtMoney(shPrice) + ')' : '') + '</span>';
        }
        if (mountainHtml) {
            var mountainEl = document.createElement('div');
            mountainEl.className = 'rv-mountain-badges';
            mountainEl.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;';
            mountainEl.innerHTML = mountainHtml;
            var insuranceCard = document.querySelector('.rv-insurance-card');
            if (insuranceCard) insuranceCard.parentNode.insertBefore(mountainEl, insuranceCard.nextSibling);
        }

        renderLocations();
        renderPaymentMethods();
        renderInsurance();
        renderExtraServices();

        document.getElementById('rvSumDays').textContent = days + ' ' + rvt('reservation.days', 'days');
        document.getElementById('rvSumCar').textContent = v.name;
        document.getElementById('rvSumPickupDate').textContent = fmtDatetime(pickupDate);
        document.getElementById('rvSumDropoffDate').textContent = fmtDatetime(dropoffDate);
        var effectiveDaily = getDailyRateByTier(days);
        document.getElementById('rvSumCarPrice').textContent = fmtMoney(effectiveDaily) + rvt('reservation_extras.per_day', '/day');
        document.getElementById('rvSumRentalLabel').textContent = rvt('reservation.car_rental', 'Car Rental') + ' (' + days + ' ' + rvt('reservation.days', 'days') + ')';
        document.getElementById('rvEditDates').href = 'vehicle.html?id=' + vehicleId;

        updatePriceSummary();
    }

    function updatePriceSummary() {
        if (!vehicleData) return;

        var days = getRentalDays();
        var dailyPrice = getDailyRateByTier(days);
        var rentalTotal = Math.round(days * dailyPrice * 100) / 100;
        var extrasTotal = Math.round(getSelectedExtras().reduce(function (sum, service) {
            var price = parseFloat(service.price) || 0;
            return sum + (service.perDay ? price * days : price);
        }, 0) * 100) / 100;
        var locationFee = getLocationSurcharge('pickupLoc') + getLocationSurcharge('dropoffLoc');
        var websiteFee = Math.round(dailyPrice * WEBSITE_FEE_PERCENT * 100) / 100;
        var deposit = parseFloat(vehicleData.deposit_amount) || 0;
        var grandTotal = Math.round((rentalTotal + extrasTotal + locationFee + deposit) * 100) / 100;
        var payNow = websiteFee;
        var payOnPickup = grandTotal;
        var pickupRadio = document.querySelector('input[name="pickupLoc"]:checked');
        var dropoffRadio = document.querySelector('input[name="dropoffLoc"]:checked');

        document.getElementById('rvSumPickupLoc').textContent = pickupRadio ? pickupRadio.value : 'Tbilisi';
        document.getElementById('rvSumDropoffLoc').textContent = dropoffRadio ? dropoffRadio.value : 'Tbilisi';
        document.getElementById('rvSumPayNow').textContent = fmtMoney(payNow);
        document.getElementById('rvSumPayPickup').textContent = fmtMoney(payOnPickup);
        document.getElementById('rvSumRentalTotal').textContent = fmtMoney(rentalTotal);
        document.getElementById('rvSumDeposit').textContent = deposit > 0 ? fmtMoney(deposit) : rvt('vehicle_page.val_none', 'None');

        var extrasRow = document.getElementById('rvSumExtrasRow');
        if (extrasTotal > 0) {
            extrasRow.style.display = 'flex';
            document.getElementById('rvSumExtrasTotal').textContent = fmtMoney(extrasTotal);
        } else {
            extrasRow.style.display = 'none';
        }

        var locationRow = document.getElementById('rvSumLocationRow');
        if (locationFee > 0) {
            locationRow.style.display = 'flex';
            document.getElementById('rvSumLocationTotal').textContent = fmtMoney(locationFee);
        } else {
            locationRow.style.display = 'none';
        }

        document.getElementById('rvSumGrandTotal').textContent = fmtMoney(grandTotal);
        document.getElementById('rvBookPrice').textContent = fmtMoney(payNow);
    }

    document.getElementById('rvGalleryPrev').addEventListener('click', function () {
        if (galleryImages.length <= 1) return;
        currentImgIdx = (currentImgIdx - 1 + galleryImages.length) % galleryImages.length;
        updateGalleryImage();
    });
    document.getElementById('rvGalleryNext').addEventListener('click', function () {
        if (galleryImages.length <= 1) return;
        currentImgIdx = (currentImgIdx + 1) % galleryImages.length;
        updateGalleryImage();
    });

    function updateGalleryImage() {
        document.getElementById('rvMainImg').src = galleryImages[currentImgIdx];
        var thumbs = document.querySelectorAll('.rv-thumbs img');
        thumbs.forEach(function (t, i) {
            t.classList.toggle('active', i === currentImgIdx);
        });
    }

    document.getElementById('rvSpecsToggle').addEventListener('click', function () {
        var body = document.getElementById('rvSpecsBody');
        var arrow = document.getElementById('rvExpandArrow');
        if (body.style.display === 'none') {
            body.style.display = 'block';
            arrow.classList.add('open');
        } else {
            body.style.display = 'none';
            arrow.classList.remove('open');
        }
    });

    function setupLocationRadios(name, customInputId) {
        document.querySelectorAll('input[name="' + name + '"]').forEach(function (radio) {
            radio.addEventListener('change', function () {
                var parent = radio.closest('.rv-loc-options');
                parent.querySelectorAll('.rv-loc-option').forEach(function (opt) { opt.classList.remove('selected'); });
                radio.closest('.rv-loc-option').classList.add('selected');

                var customInput = document.getElementById(customInputId);
                if (radio.value.indexOf('Delivery') !== -1) {
                    customInput.style.display = 'block';
                    customInput.focus();
                } else {
                    customInput.style.display = 'none';
                }

                updatePriceSummary();
            });
        });
    }
    // Collect form data for booking
    function collectBookingData() {
        var pickupLoc = document.querySelector('input[name="pickupLoc"]:checked');
        var dropoffLoc = document.querySelector('input[name="dropoffLoc"]:checked');
        var pickupLocation = pickupLoc ? pickupLoc.value : 'Tbilisi';
        var dropoffLocation = dropoffLoc ? dropoffLoc.value : 'Tbilisi';

        var pickupCustom = document.getElementById('rvPickupCustom');
        if (pickupCustom.style.display !== 'none' && pickupCustom.value.trim()) {
            pickupLocation += ' — ' + pickupCustom.value.trim();
        }
        var dropoffCustom = document.getElementById('rvDropoffCustom');
        if (dropoffCustom.style.display !== 'none' && dropoffCustom.value.trim()) {
            dropoffLocation += ' — ' + dropoffCustom.value.trim();
        }

        return {
            vehicle_id: vehicleId,
            pickup_date: fmtD(pickupDate),
            dropoff_date: fmtD(dropoffDate),
            pickup_time: pickupTime,
            dropoff_time: dropoffTime,
            pickup_location: pickupLocation,
            dropoff_location: dropoffLocation,
            selected_extras: getSelectedExtras().map(function (service) { return service.code; }),
            location_fee: getLocationSurcharge('pickupLoc') + getLocationSurcharge('dropoffLoc'),
            guest_notes: document.getElementById('rvNotes').value.trim()
        };
    }

    // Show Send Code confirmation modal
    function showSendCodeModal(bookingPayload, btn) {
        var phone = (user && user.phone) ? user.phone : '';
        var maskedPhone = phone ? '****' + phone.slice(-4) : '****';

        // Remove existing modal if any
        var existing = document.getElementById('sendCodeOverlay');
        if (existing) existing.remove();

        var t = function(key, fallback) {
            return (typeof I18n !== 'undefined' && I18n.t) ? (function() { var v = I18n.t(key); return (v && v !== key) ? v : fallback; })() : fallback;
        };

        var html = '<div id="sendCodeOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);">'
            + '<div style="background:#1C1E26;border:1px solid #3A3F4B;border-radius:20px;padding:40px;max-width:400px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5);">'
            + '<div style="width:64px;height:64px;background:linear-gradient(135deg,#D4AF37,#B8963F);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:28px;">'
            + '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>'
            + '</div>'
            + '<h2 style="color:#EAEAEA;font-size:20px;font-weight:700;margin-bottom:8px;">' + t('reservation.verify_title', 'Verify Your Phone') + '</h2>'
            + '<p style="color:#A0A3B0;font-size:14px;margin-bottom:24px;">' + t('reservation.verify_desc', 'We will send a verification code to') + '<br><strong style="color:#D4AF37;font-size:16px;">' + maskedPhone + '</strong></p>'
            + '<button id="sendCodeBtn" style="width:100%;padding:14px;background:linear-gradient(135deg,#C9A84C,#B8963F);border:none;border-radius:12px;color:#1C1E26;font-size:16px;font-weight:700;cursor:pointer;transition:all 0.2s;margin-bottom:12px;">' + t('reservation.send_code', 'Send Code') + '</button>'
            + '<button id="sendCodeCancel" style="width:100%;padding:12px;background:transparent;border:1px solid rgba(255,255,255,0.12);border-radius:12px;color:#A0A3B0;font-size:14px;cursor:pointer;transition:all 0.2s;">' + t('reservation.cancel', 'Cancel') + '</button>'
            + '</div></div>';

        document.body.insertAdjacentHTML('beforeend', html);

        document.getElementById('sendCodeCancel').addEventListener('click', function() {
            document.getElementById('sendCodeOverlay').remove();
            btn.disabled = false;
            btn.querySelector('span:nth-child(2)').textContent = (typeof I18n !== 'undefined' ? I18n.t('vehicle_page.book_now') : 'Book now');
        });
        document.getElementById('sendCodeOverlay').addEventListener('click', function(e) {
            if (e.target === this) {
                this.remove();
                btn.disabled = false;
                btn.querySelector('span:nth-child(2)').textContent = (typeof I18n !== 'undefined' ? I18n.t('vehicle_page.book_now') : 'Book now');
            }
        });

        document.getElementById('sendCodeBtn').addEventListener('click', function() {
            var sendBtn = this;
            sendBtn.disabled = true;
            sendBtn.textContent = t('reservation.sending', 'Sending...');
            submitBooking(bookingPayload, btn, function() {
                document.getElementById('sendCodeOverlay').remove();
            });
        });
    }

    // Submit booking to server
    function submitBooking(payload, bookBtn, onDone) {
        fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(payload)
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            bookBtn.disabled = false;
            bookBtn.querySelector('span:nth-child(2)').textContent = (typeof I18n !== 'undefined' ? I18n.t('vehicle_page.book_now') : 'Book now');
            if (onDone) onDone();
            if (data.error) {
                if (data.phoneRequired) {
                    var phoneMsg = (typeof I18n !== 'undefined' ? I18n.t('errors.phone_verify_required') : data.error);
                    var phonePrompt = (typeof I18n !== 'undefined' ? I18n.t('errors.phone_verify_prompt') : 'Would you like to verify your phone now?');
                    if (confirm(phoneMsg + '\n\n' + phonePrompt)) {
                        window.location.href = '/verify-phone.html';
                    }
                    return;
                }
                var errLabel = (typeof I18n !== 'undefined' ? I18n.t('errors.booking_failed') : 'Booking failed');
                alert(errLabel + ': ' + data.error);
                return;
            }

            // Check if OTP verification is required
            if (data.requiresVerification && data.booking_id) {
                if (typeof OTPModal !== 'undefined') {
                    OTPModal.show({
                        title: 'Confirm Your Booking',
                        subtitle: 'Enter the 6-digit code sent to <strong>****' + (data.phoneLast4 || '****') + '</strong>',
                        phoneLast4: data.phoneLast4,
                        expiresIn: data.expiresIn || 300,
                        resendCooldown: 60,
                        verifyUrl: '/api/bookings/verify',
                        resendUrl: '/api/bookings/resend-otp',
                        bookingId: data.booking_id,
                        token: token,
                        onSuccess: function(verifyData) {
                            // Booking verified - check if payment required
                            if (data.payment_required || data.service_fee > 0) {
                                sessionStorage.setItem('pending_booking_id', data.booking_id);
                                sessionStorage.setItem('pending_service_fee', data.service_fee);
                                document.getElementById('rvApprovalModal').style.display = 'flex';
                            } else {
                                document.getElementById('rvSuccessModal').style.display = 'flex';
                            }
                        },
                        onCancel: function() {
                            alert('Booking requires phone verification. Please try again.');
                        }
                    });
                } else {
                    alert('Verification required. Please check your phone for the code.');
                }
                return;
            }

            // Show approval modal before redirecting to payment
            if (data.booking_id && (data.payment_required || data.service_fee > 0)) {
                sessionStorage.setItem('pending_booking_id', data.booking_id);
                sessionStorage.setItem('pending_service_fee', data.service_fee);
                document.getElementById('rvApprovalModal').style.display = 'flex';
                return;
            }
            document.getElementById('rvSuccessModal').style.display = 'flex';
        })
        .catch(function () {
            bookBtn.disabled = false;
            bookBtn.querySelector('span:nth-child(2)').textContent = 'Book now';
            if (onDone) onDone();
            alert('Network error. Please try again.');
        });
    }

    document.getElementById('rvBookBtn').addEventListener('click', function () {
        var btn = this;
        btn.disabled = true;
        btn.querySelector('span:nth-child(2)').textContent = (typeof I18n !== 'undefined' ? I18n.t('reservation.sending', 'Submitting...') : 'Submitting...');
        var payload = collectBookingData();
        showSendCodeModal(payload, btn);
    });

    // Approval modal continue button
    document.getElementById('rvApprovalContinue').addEventListener('click', function () {
        var bookingId = sessionStorage.getItem('pending_booking_id');
        if (bookingId) {
            sessionStorage.removeItem('pending_booking_id');
            sessionStorage.removeItem('pending_service_fee');
            window.location.href = 'payment.html?booking_id=' + bookingId;
        }
    });

    document.getElementById('rvOrderWhatsapp').addEventListener('click', function () {
        if (!vehicleData) return;
        var v = vehicleData;
        var days = getRentalDays();
        var dailyRate = getDailyRateByTier(days);
        var extrasTotal = getSelectedExtras().reduce(function (sum, service) {
            return sum + (parseFloat(service.price) || 0);
        }, 0);
        var text = 'Hello! I would like to book:\n'
            + '\ud83d\ude97 ' + v.name + '\n'
            + '\ud83d\udcc5 ' + fmtDate(pickupDate) + ' ' + pickupTime + ' \u2192 ' + fmtDate(dropoffDate) + ' ' + dropoffTime + ' (' + days + ' days)\n'
            + '\ud83d\udcb0 ' + fmtMoney((days * dailyRate) + extrasTotal) + ' + website fee\n'
            + 'Please confirm availability!';
        var phone = (v.whatsapp || '').replace(/[^0-9]/g, '') || '995';
        window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(text), '_blank');
    });

    document.getElementById('rvSuccessModal').addEventListener('click', function (e) {
        if (e.target === this) this.style.display = 'none';
    });
})();
