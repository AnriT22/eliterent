/* ===========================================================================
   Transfers — multi-step booking flow.

   One state object drives everything; every step reads and writes it, so going
   back and editing never loses a selection. State is mirrored into
   sessionStorage so a refresh mid-flow does not wipe the journey.

   Vehicle supply and matching come from /api/transfers/* — this file never
   decides what is available, it only renders what the server matched.
   =========================================================================== */
(function () {
    'use strict';

    // -----------------------------------------------------------------------
    // OWNER CONFIG — extras.
    // `price: null` renders the extra as selectable with no price shown, which
    // is deliberate: inventing prices would put numbers on the page that you
    // never agreed to. Set a number here and the UI shows it and adds it to the
    // estimated total.
    // -----------------------------------------------------------------------
    var EXTRAS = [
        { id: 'meet_greet', label: 'Meet & greet', price: null },
        { id: 'child_seat', label: 'Child seat', price: null },
        { id: 'extra_luggage', label: 'Extra luggage', price: null },
        { id: 'trunk_service', label: 'Additional trunk service', price: null },
        { id: 'extra_stop', label: 'Additional stop', price: null },
        { id: 'waiting', label: 'Waiting time', price: null },
        { id: 'chauffeur', label: 'Chauffeur service', price: null },
        { id: 'occasion', label: 'Special occasion', price: null },
        { id: 'other_extra', label: 'Other request', price: null }
    ];

    var REQUIREMENTS = [
        { id: 'child_seat', label: 'Child seat' },
        { id: 'extra_luggage', label: 'Extra luggage' },
        { id: 'trunk_service', label: 'Additional trunk service' },
        { id: 'wheelchair', label: 'Wheelchair accessible' },
        { id: 'pet', label: 'Pet-friendly vehicle' },
        { id: 'meet_greet', label: 'Meet & greet' },
        { id: 'multi_stop', label: 'Multiple stops' },
        { id: 'chauffeur', label: 'Chauffeur service' },
        { id: 'other', label: 'Other request' }
    ];

    var STEPS = ['journey', 'guests', 'vehicle', 'extras', 'review'];
    var STORE_KEY = 'EliteAuto_transfer_draft';

    var state = {
        step: 0,
        transfer_type: 'airport',
        pickup_code: '', pickup_label: '',
        dropoff_code: '', dropoff_label: '',
        pickup_date: '', pickup_time: '',
        has_return: false, return_date: '', return_time: '',
        distance_km: null, duration_min: null,
        passengers: 2, luggage: 2,
        requirements: [],
        vehicle: null,          // the chosen offer object
        requested_vehicle: null, // {brand, model, year, vehicle_class} from Find My Car
        extras: [],
        contact_name: '', contact_email: '', contact_phone: ''
    };

    var locations = [];
    var currency = 'USD';

    // ---- utilities --------------------------------------------------------

    function $(sel, root) { return (root || document).querySelector(sel); }
    function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }

    function save() {
        try { sessionStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
    }
    function restore() {
        try {
            var raw = sessionStorage.getItem(STORE_KEY);
            if (!raw) return;
            var saved = JSON.parse(raw);
            Object.keys(saved).forEach(function (k) { if (k in state) state[k] = saved[k]; });
        } catch (e) { /* ignore a corrupt draft */ }
    }

    function money(n) {
        if (n == null || isNaN(n)) return null;
        return '$' + Number(n).toFixed(Number(n) % 1 ? 2 : 0);
    }

    function api(path, opts) {
        opts = opts || {};
        var headers = { 'Content-Type': 'application/json' };
        try {
            var t = localStorage.getItem('token') || localStorage.getItem('authToken');
            if (t) headers.Authorization = 'Bearer ' + t;
        } catch (e) { /* no token */ }
        return fetch('/api/transfers' + path, {
            method: opts.method || 'GET',
            headers: headers,
            body: opts.body ? JSON.stringify(opts.body) : undefined
        }).then(function (r) {
            return r.json().then(function (d) {
                if (!r.ok) throw new Error(d && d.error ? d.error : 'Request failed');
                return d;
            });
        });
    }

    // ---- step navigation --------------------------------------------------

    function openFlow(type) {
        if (type) state.transfer_type = type;
        $('.tr-landing').classList.add('is-hidden');
        $('.tr-flow').classList.add('is-open');
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    var lastQuoteKey = null;

    function goTo(i) {
        if (i < 0 || i >= STEPS.length) return;
        state.step = i;
        save();
        // Load whenever the Vehicle step becomes visible, not only when
        // advancing from Guests — "Request a specific car" jumps straight here
        // and would otherwise land on an empty grid. Refetch only when the
        // journey or the party actually changed.
        if (i === 2) {
            var key = [state.pickup_code, state.dropoff_code, state.passengers, state.luggage].join('|');
            if (key !== lastQuoteKey) {
                lastQuoteKey = key;
                loadVehicles();
            }
        }
        render();
        var flow = $('.tr-flow');
        if (flow) window.scrollTo({ top: flow.offsetTop - 20, behavior: 'smooth' });
    }

    /** Validation gates forward movement only — going back is always allowed. */
    function validate(step) {
        clearErrors();
        if (step === 0) {
            if (!state.pickup_code) return err('errPickup', 'Choose a pick-up point.');
            if (!state.dropoff_code) return err('errDropoff', 'Choose a drop-off point.');
            if (state.pickup_code === state.dropoff_code) return err('errDropoff', 'Pick-up and drop-off must differ.');
            if (!state.pickup_date) return err('errDate', 'Choose a date.');
            if (!state.pickup_time) return err('errTime', 'Choose a pick-up time.');
            if (state.has_return && (!state.return_date || !state.return_time)) {
                return err('errReturn', 'Add the return date and time, or switch the return off.');
            }
            return true;
        }
        if (step === 2) {
            if (!state.vehicle && !state.requested_vehicle) {
                return err('errVehicle', 'Choose a vehicle, or tell us which car you want.');
            }
            return true;
        }
        if (step === 4) {
            if (!state.contact_name.trim()) return err('errName', 'We need a name for the booking.');
            if (!state.contact_phone.trim() && !state.contact_email.trim()) {
                return err('errContact', 'Add a phone number or an email so we can reach you.');
            }
            return true;
        }
        return true;
    }

    function err(id, msg) {
        var el = document.getElementById(id);
        if (el) { el.textContent = msg; el.classList.add('is-shown'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        return false;
    }
    function clearErrors() { $$('.tr-error').forEach(function (e) { e.classList.remove('is-shown'); }); }

    function next() {
        if (!validate(state.step)) return;
        goTo(state.step + 1);
    }
    function back() { goTo(state.step - 1); }

    // ---- rendering --------------------------------------------------------

    function render() {
        $$('.tr-step-pip').forEach(function (pip, i) {
            pip.classList.toggle('is-active', i === state.step);
            pip.classList.toggle('is-done', i < state.step);
        });
        $$('.tr-panel').forEach(function (p, i) { p.classList.toggle('is-active', i === state.step); });
        if (state.step === 4) renderReview();
    }

    function renderRoute() {
        var box = $('#trRoute');
        if (!box) return;
        if (!state.pickup_code || !state.dropoff_code || state.pickup_code === state.dropoff_code) {
            box.classList.remove('is-shown');
            return;
        }
        api('/route?from=' + encodeURIComponent(state.pickup_code) + '&to=' + encodeURIComponent(state.dropoff_code))
            .then(function (r) {
                state.distance_km = r.distance_km;
                state.duration_min = r.duration_min;
                save();
                var h = Math.floor(r.duration_min / 60), m = r.duration_min % 60;
                box.innerHTML =
                    '<span class="tr-route-leg"><span class="tr-route-dot"></span>' + esc(state.pickup_label) + '</span>' +
                    '<span class="tr-route-arrow">&#8594;</span>' +
                    '<span class="tr-route-leg"><span class="tr-route-dot"></span>' + esc(state.dropoff_label) + '</span>' +
                    '<span class="tr-route-meta"><strong>' + r.distance_km + ' km</strong> &middot; approx <strong>' +
                    (h ? h + 'h ' : '') + m + 'm</strong></span>';
                box.classList.add('is-shown');
            })
            .catch(function () { box.classList.remove('is-shown'); });
    }

    function vehicleCard(v, selected) {
        var img = v.image
            ? '<img class="tr-vcard-img" src="' + esc(v.image) + '" alt="' + esc(v.brand + ' ' + v.model) + '" loading="lazy">'
            : '<div class="tr-vcard-img tr-vcard-img--none">&#128663;</div>';
        var badge = v.instant
            ? '<span class="tr-badge tr-badge-ok">Available now</span>'
            : '<span class="tr-badge tr-badge-wait">Via a trusted partner</span>';
        // Luggage is an estimate, so say so rather than quietly dropping the car.
        if (v.luggage_ok === false) {
            badge += '<span class="tr-badge tr-badge-wait">Tight for ' + state.luggage + ' bags — add trunk service</span>';
        }
        var price = v.instant
            ? '<span class="tr-vcard-price">' + money(v.price) + ' <small>/ day</small></span>'
            : '<span class="tr-vcard-price">from ' + money(v.price) + '</span>';
        return '<button type="button" class="tr-vcard' + (selected ? ' is-selected' : '') +
            '" data-vehicle=\'' + esc(JSON.stringify(v)) + '\'>' + img +
            '<div class="tr-vcard-body">' +
            '<span class="tr-vcard-brand">' + esc(v.brand) + '</span>' +
            '<h4 class="tr-vcard-name">' + esc(v.model || v.label) + '</h4>' +
            '<span class="tr-vcard-class">' + esc(v.label || v.category) + '</span>' +
            '<span class="tr-vcard-cap">' + v.passengers + ' passengers &middot; approx ' + v.luggage + ' bags' +
            (v.passengers >= 7 && state.passengers > 5 ? ' <em style="opacity:.75">(third row in use)</em>' : '') +
            '</span>' +
            badge +
            '<span class="tr-vcard-foot">' + price +
            '<span class="tr-btn tr-btn-ghost tr-btn-sm">' + (selected ? 'Selected' : 'Select') + '</span></span>' +
            '</div></button>';
    }

    function loadVehicles() {
        var fleetBox = $('#trFleet'), partnerBox = $('#trPartner');
        if (!fleetBox) return;
        var oldMore=document.querySelector('.tr-more'); if(oldMore) oldMore.remove();
        fleetBox.innerHTML = '<div class="tr-empty">Finding vehicles for your journey&hellip;</div>';
        if (partnerBox) partnerBox.innerHTML = '';

        api('/quote', {
            method: 'POST',
            body: {
                pickup_code: state.pickup_code, dropoff_code: state.dropoff_code,
                passengers: state.passengers, luggage: state.luggage
            }
        }).then(function (d) {
            var sel = state.vehicle;
            var same = function (v) { return sel && String(sel.id) === String(v.id) && sel.source === v.source; };

            // The whole fleet is ~80 cars. Dumping all of them here buries the
            // "Find my car" panel under a wall of cards and makes the step feel
            // like a search results page rather than a curated choice, so show a
            // first screenful and let people open the rest.
            var FIRST = 9;
            if (d.fleet && d.fleet.length) {
                var shown = d.fleet.slice(0, FIRST);
                fleetBox.innerHTML = shown.map(function (v) { return vehicleCard(v, same(v)); }).join('');
                if (d.fleet.length > FIRST) {
                    var more = document.createElement('div');
                    more.className = 'tr-more';
                    more.innerHTML = '<button type="button" class="tr-btn tr-btn-ghost">Show all ' +
                        d.fleet.length + ' vehicles</button>';
                    more.querySelector('button').addEventListener('click', function () {
                        fleetBox.innerHTML = d.fleet.map(function (v) { return vehicleCard(v, same(v)); }).join('');
                        more.remove();
                    });
                    fleetBox.parentNode.appendChild(more);
                }
            } else {
                fleetBox.innerHTML = '<div class="tr-empty">No vehicle in our own fleet seats ' + state.passengers +
                    ' passengers. Try the partner tab, or tell us the car you want below.</div>';
            }

            if (partnerBox) {
                partnerBox.innerHTML = d.partner && d.partner.length
                    ? d.partner.map(function (v) { return vehicleCard(v, same(v)); }).join('')
                    : '<div class="tr-empty">No partner vehicle matches this journey yet. Use &ldquo;Find my car&rdquo; and we will search for you.</div>';
            }
        }).catch(function () {
            fleetBox.innerHTML = '<div class="tr-empty">We could not load vehicles just now. You can still tell us which car you want below.</div>';
        });
    }

    function selectVehicle(v) {
        state.vehicle = v;
        state.requested_vehicle = null;
        save();
        $$('.tr-vcard').forEach(function (c) {
            var d = JSON.parse(c.getAttribute('data-vehicle'));
            var on = String(d.id) === String(v.id) && d.source === v.source;
            c.classList.toggle('is-selected', on);
            var btn = $('.tr-btn', c);
            if (btn) btn.textContent = on ? 'Selected' : 'Select';
        });
        clearErrors();
    }

    // ---- find my car ------------------------------------------------------

    function findMyCar() {
        var brand = $('#trFindBrand').value.trim();
        var model = $('#trFindModel').value.trim();
        var year = $('#trFindYear').value.trim();
        var klass = $('#trFindClass').value;
        var out = $('#trFindResult');

        if (!brand) { out.innerHTML = '<div class="tr-empty">Tell us at least a brand.</div>'; return; }
        out.innerHTML = '<div class="tr-empty">Searching our fleet and trusted partners&hellip;</div>';

        api('/find-vehicle', {
            method: 'POST',
            body: {
                brand: brand, model: model, vehicle_class: klass,
                passengers: state.passengers, luggage: state.luggage,
                pickup_code: state.pickup_code
            }
        }).then(function (d) {
            var wanted = [brand, model, year].filter(Boolean).join(' ');

            if (d.outcome === 'exact') {
                out.innerHTML =
                    '<h4 class="tr-panel-h" style="font-size:22px;">Your vehicle is available</h4>' +
                    '<p class="tr-panel-sub">Available for your selected journey.</p>' +
                    '<div class="tr-vehicles">' + d.vehicles.map(function (v) { return vehicleCard(v, false); }).join('') + '</div>';
                return;
            }
            if (d.outcome === 'similar') {
                out.innerHTML =
                    '<h4 class="tr-panel-h" style="font-size:22px;">We couldn’t find your exact vehicle</h4>' +
                    '<p class="tr-panel-sub">But we found some excellent alternatives.</p>' +
                    '<div class="tr-vehicles">' + d.vehicles.map(function (v) { return vehicleCard(v, false); }).join('') + '</div>' +
                    '<div class="tr-nav"><button type="button" class="tr-btn tr-btn-ghost" id="trKeepSearching">' +
                    'Keep searching for my car</button></div>';
                $('#trKeepSearching').addEventListener('click', function () { requestSpecific(wanted, klass); });
                return;
            }
            requestSpecific(wanted, klass);
        }).catch(function () {
            out.innerHTML = '<div class="tr-empty">Search failed. Please try again.</div>';
        });
    }

    /** The partner-sourcing state: we take the request rather than fake a price. */
    function requestSpecific(wanted, klass) {
        state.requested_vehicle = { label: wanted, vehicle_class: klass };
        state.vehicle = null;
        save();
        clearErrors();
        $('#trFindResult').innerHTML =
            '<h4 class="tr-panel-h" style="font-size:22px;">We’ll find it for you</h4>' +
            '<p class="tr-panel-sub">Your requested vehicle isn’t currently available for instant confirmation. ' +
            'We’ll check our trusted vehicle partners and find the best available option for your journey.</p>' +
            '<div class="tr-summary" style="margin-bottom:20px;">' +
            '<div class="tr-sum-block"><div class="tr-sum-k">Requested vehicle</div><div class="tr-sum-v">' + esc(wanted) + '</div></div>' +
            '<div class="tr-sum-block"><div class="tr-sum-k">Journey</div><div class="tr-sum-v">' +
            esc(state.pickup_label) + ' &#8594; ' + esc(state.dropoff_label) + '<br>' +
            esc(state.pickup_date) + ' at ' + esc(state.pickup_time) + '</div></div>' +
            '<div class="tr-sum-block"><div class="tr-sum-k">Party</div><div class="tr-sum-v">' +
            state.passengers + ' passengers &middot; ' + state.luggage + ' luggage</div></div>' +
            '</div>' +
            '<p class="tr-hint">Continue to review and we’ll send this to our partner network.</p>';
    }

    // ---- review + submit --------------------------------------------------

    function renderReview() {
        var v = state.vehicle;
        var extrasChosen = EXTRAS.filter(function (e) { return state.extras.indexOf(e.id) !== -1; });
        var extrasTotal = extrasChosen.reduce(function (s, e) { return s + (e.price || 0); }, 0);

        $('#trSumJourney').innerHTML =
            '<div class="tr-sum-when">' + esc(state.pickup_date) + ' &middot; ' + esc(state.pickup_time) + '</div>' +
            '<div class="tr-sum-journey">' +
            '<div class="tr-sum-leg"><span class="tr-route-dot"></span><span>' + esc(state.pickup_label) + '</span></div>' +
            '<div class="tr-sum-leg"><span class="tr-route-arrow">&#8595;</span></div>' +
            '<div class="tr-sum-leg"><span class="tr-route-dot"></span><span>' + esc(state.dropoff_label) + '</span></div>' +
            '</div>' +
            (state.has_return && state.return_date
                ? '<div class="tr-hint">Return ' + esc(state.return_date) + ' at ' + esc(state.return_time) + '</div>' : '') +
            (state.distance_km ? '<div class="tr-hint">' + state.distance_km + ' km &middot; approx ' +
                Math.round(state.duration_min / 60 * 10) / 10 + ' h</div>' : '');

        $('#trSumVehicle').innerHTML = v
            ? '<strong>' + esc(v.brand + ' ' + (v.model || v.label)) + '</strong><br>' +
              v.passengers + ' passengers &middot; ' + v.luggage + ' luggage' +
              (v.instant ? '' : '<br><span class="tr-badge tr-badge-wait" style="margin-top:8px;">Via a trusted partner</span>')
            : state.requested_vehicle
                ? '<strong>' + esc(state.requested_vehicle.label) + '</strong><br>' +
                  '<span class="tr-badge tr-badge-wait" style="margin-top:8px;">We’ll source this for you</span>'
                : '<span class="tr-muted">No vehicle selected</span>';

        $('#trSumGuests').textContent = state.passengers + ' passengers · ' + state.luggage + ' luggage';
        $('#trSumExtras').innerHTML = extrasChosen.length
            ? extrasChosen.map(function (e) { return esc(e.label) + (e.price ? ' — ' + money(e.price) : ''); }).join('<br>')
            : '<span style="color:var(--tr-muted)">None</span>';

        // Only our own fleet can be quoted. A partner or sourced vehicle is
        // priced once the partner confirms — never guessed here.
        var instant = v && v.instant;
        var total = instant ? Number(v.price) + extrasTotal : null;
        $('#trTotalValue').textContent = total != null ? money(total) : 'On request';
        $('#trTotalNote').textContent = total != null
            ? 'Estimated total for the vehicle and selected extras. We confirm the final price before you pay.'
            : 'We’ll confirm the price with our partner network and come back to you with a firm quote.';
        $('#trSubmit').textContent = instant ? 'Confirm transfer' : 'Send vehicle request';
    }

    function submit() {
        if (!validate(4)) return;
        var btn = $('#trSubmit');
        btn.disabled = true;
        btn.textContent = 'Sending…';

        var v = state.vehicle;
        api('', {
            method: 'POST',
            body: {
                transfer_type: state.transfer_type,
                contact_name: state.contact_name,
                contact_email: state.contact_email,
                contact_phone: state.contact_phone,
                pickup_code: state.pickup_code, pickup_label: state.pickup_label,
                dropoff_code: state.dropoff_code, dropoff_label: state.dropoff_label,
                pickup_date: state.pickup_date, pickup_time: state.pickup_time,
                return_date: state.has_return ? state.return_date : null,
                return_time: state.has_return ? state.return_time : null,
                passengers: state.passengers, luggage: state.luggage,
                requirements: state.requirements,
                extras: state.extras,
                vehicle_id: v && v.source === 'fleet' ? v.id : null,
                vehicle_source: v ? v.source : 'requested',
                vehicle_label: v ? (v.brand + ' ' + (v.model || v.label)) : null,
                requested_vehicle: state.requested_vehicle ? state.requested_vehicle.label : null,
                quoted_price: v && v.instant ? v.price : null,
                currency: currency
            }
        }).then(function (d) {
            try { sessionStorage.removeItem(STORE_KEY); } catch (e) {}
            var booked = d.kind === 'booking';
            $('.tr-flow').innerHTML =
                '<div class="tr-wrap"><div class="tr-result">' +
                '<div class="tr-result-ico">' + (booked ? '✅' : '🔎') + '</div>' +
                '<h2>' + (booked ? 'Transfer confirmed' : 'Request received') + '</h2>' +
                '<p>' + (booked
                    ? 'Your transfer is booked. We’ll be in touch shortly with your driver details.'
                    : 'We’re searching for your requested vehicle and will come back to you with the best available option.') +
                '</p>' +
                '<div class="tr-ref">' + esc(d.reference) + '</div>' +
                '<p>Keep this reference. You can quote it to us any time, and it appears in your account if you’re signed in.</p>' +
                '<div class="tr-nav" style="justify-content:center;">' +
                '<a class="tr-btn tr-btn-ghost" href="/transfers.html">Book another transfer</a>' +
                '<a class="tr-btn tr-btn-primary" href="/guest-profile.html">View my transfers</a>' +
                '</div></div></div>';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }).catch(function (e) {
            btn.disabled = false;
            btn.textContent = 'Try again';
            err('errContact', e.message || 'Something went wrong. Please try again.');
        });
    }

    // ---- wiring -----------------------------------------------------------

    function fillLocationSelects() {
        var groups = {};
        locations.forEach(function (l) { (groups[l.group] = groups[l.group] || []).push(l); });
        var html = '<option value="">Airport, hotel, address or city</option>' +
            Object.keys(groups).map(function (g) {
                return '<optgroup label="' + esc(g) + '">' +
                    groups[g].map(function (l) { return '<option value="' + esc(l.code) + '">' + esc(l.label) + '</option>'; }).join('') +
                    '</optgroup>';
            }).join('');
        ['#trPickup', '#trDropoff'].forEach(function (sel) {
            var el = $(sel);
            if (el) el.innerHTML = html;
        });
        if (state.pickup_code) $('#trPickup').value = state.pickup_code;
        if (state.dropoff_code) $('#trDropoff').value = state.dropoff_code;
    }

    function buildChips(host, items, selected, onChange) {
        host.innerHTML = items.map(function (it) {
            var on = selected.indexOf(it.id) !== -1;
            return '<label class="tr-chip"><input type="checkbox" value="' + esc(it.id) + '"' + (on ? ' checked' : '') + '>' +
                '<span>' + esc(it.label) +
                (it.price ? '<span class="tr-chip-price">' + money(it.price) + '</span>' : '') +
                '</span></label>';
        }).join('');
        host.addEventListener('change', function (e) {
            if (e.target.tagName !== 'INPUT') return;
            var v = e.target.value;
            var i = selected.indexOf(v);
            if (e.target.checked && i === -1) selected.push(v);
            if (!e.target.checked && i !== -1) selected.splice(i, 1);
            save();
            if (onChange) onChange();
        });
    }

    function stepper(rootSel, key, min) {
        var root = $(rootSel);
        if (!root) return;
        var out = $('output', root);
        function draw() {
            out.textContent = state[key];
            $$('button', root)[0].disabled = state[key] <= min;
        }
        $$('button', root).forEach(function (b) {
            b.addEventListener('click', function () {
                var d = b.dataset.dir === 'up' ? 1 : -1;
                state[key] = Math.max(min, Math.min(60, state[key] + d));
                save(); draw();
            });
        });
        draw();
    }

    function init() {
        if (!$('.tr-page')) return;
        restore();

        // Landing CTAs
        $$('[data-open-flow]').forEach(function (b) {
            b.addEventListener('click', function () { openFlow(b.dataset.openFlow || null); });
        });
        $$('[data-open-find]').forEach(function (b) {
            b.addEventListener('click', function () {
                openFlow(null);
                goTo(2);
                var f = $('#trFindForm');
                if (f) { f.classList.add('is-shown'); f.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            });
        });

        // Step pips — jump back to a completed step
        $$('.tr-step-pip').forEach(function (pip, i) {
            pip.addEventListener('click', function () { if (i < state.step) goTo(i); });
        });

        $$('[data-next]').forEach(function (b) { b.addEventListener('click', next); });
        $$('[data-back]').forEach(function (b) { b.addEventListener('click', back); });

        // Journey
        api('/locations').then(function (d) { locations = d.locations || []; fillLocationSelects(); renderRoute(); });

        $('#trPickup').addEventListener('change', function () {
            state.pickup_code = this.value;
            state.pickup_label = this.options[this.selectedIndex].text;
            save(); renderRoute();
        });
        $('#trDropoff').addEventListener('change', function () {
            state.dropoff_code = this.value;
            state.dropoff_label = this.options[this.selectedIndex].text;
            save(); renderRoute();
        });

        var today = new Date().toISOString().slice(0, 10);
        ['#trDate', '#trReturnDate'].forEach(function (s) { var e = $(s); if (e) e.min = today; });

        [['#trDate', 'pickup_date'], ['#trTime', 'pickup_time'],
         ['#trReturnDate', 'return_date'], ['#trReturnTime', 'return_time'],
         ['#trName', 'contact_name'], ['#trEmail', 'contact_email'], ['#trPhone', 'contact_phone']
        ].forEach(function (pair) {
            var el = $(pair[0]);
            if (!el) return;
            if (state[pair[1]]) el.value = state[pair[1]];
            el.addEventListener('input', function () { state[pair[1]] = this.value; save(); });
        });

        var ret = $('#trReturn');
        ret.checked = state.has_return;
        $('#trReturnFields').classList.toggle('is-shown', state.has_return);
        ret.addEventListener('change', function () {
            state.has_return = this.checked;
            $('#trReturnFields').classList.toggle('is-shown', this.checked);
            save();
        });

        // Guests
        stepper('#trPax', 'passengers', 1);
        stepper('#trBags', 'luggage', 0);
        buildChips($('#trRequirements'), REQUIREMENTS, state.requirements);
        // With four or more bags the boot is the real constraint, so point at
        // the trunk-service option rather than letting people hit an empty list.
        var bagHint = $('#trBagHint');
        function syncBagHint() {
            if (bagHint) bagHint.style.display = state.luggage >= 4 ? 'block' : 'none';
        }
        syncBagHint();
        $$('#trBags button').forEach(function (b) { b.addEventListener('click', syncBagHint); });

        // Vehicle
        $$('.tr-tab').forEach(function (tab) {
            tab.addEventListener('click', function () {
                $$('.tr-tab').forEach(function (t) { t.classList.remove('is-active'); });
                tab.classList.add('is-active');
                $$('[data-tabpanel]').forEach(function (p) {
                    p.style.display = p.dataset.tabpanel === tab.dataset.tab ? '' : 'none';
                });
            });
        });
        document.addEventListener('click', function (e) {
            var card = e.target.closest ? e.target.closest('.tr-vcard') : null;
            if (card) selectVehicle(JSON.parse(card.getAttribute('data-vehicle')));
        });
        $('#trFindToggle').addEventListener('click', function () {
            $('#trFindForm').classList.toggle('is-shown');
        });
        $('#trFindGo').addEventListener('click', findMyCar);

        // Extras
        buildChips($('#trExtras'), EXTRAS, state.extras);

        $('#trSubmit').addEventListener('click', submit);

        render();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
