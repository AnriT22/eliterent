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
    // OWNER CONFIG — additional services.
    //
    // ONE list. There used to be two (Step 2 "requirements" and Step 4
    // "extras") that overlapped on almost every entry, so the same thing could
    // be asked for twice. Everything optional now lives on Step 2.
    //
    // `price: null` renders the service with no price, which is deliberate:
    // under the quote workflow the partner sets the real figure, and inventing
    // one here would put a number on the page nobody agreed to. Set a number
    // and it shows and feeds the estimate.
    // -----------------------------------------------------------------------
    var SERVICES = [
        { id: 'meet_greet', label: 'Meet & greet', price: null },
        { id: 'child_seat', label: 'Child seat', price: null },
        { id: 'extra_luggage', label: 'Extra luggage', price: null },
        { id: 'trunk_service', label: 'Additional trunk service', price: null },
        { id: 'extra_stop', label: 'Additional stop', price: null },
        { id: 'waiting', label: 'Waiting time', price: null },
        { id: 'chauffeur', label: 'Chauffeur service', price: null },
        { id: 'wheelchair', label: 'Wheelchair accessible', price: null },
        { id: 'pet', label: 'Pet-friendly vehicle', price: null },
        { id: 'occasion', label: 'Special occasion', price: null },
        { id: 'other', label: 'Other request', price: null }
    ];

    var STEPS = ['journey', 'guests', 'vehicle', 'review'];
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
        services: [],
        vehicle: null,          // the chosen offer object
        requested_vehicle: null, // {brand, model, year, vehicle_class} from Find My Car
        contact_name: '', contact_email: '', contact_phone: ''
    };

    var locations = [];
    var currency = 'USD';
    var terrain = null;      // 'mountain' when either end is Gudauri/Kazbegi/Mestia/etc
    var terrainLabel = null;

    function authToken() {
        try { return localStorage.getItem('token') || null; } catch (e) { return null; }
    }

    // ---- utilities --------------------------------------------------------

    function $(sel, root) { return (root || document).querySelector(sel); }
    function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }

    /* Translate a transfers.* key, falling back to the English written inline
       here. i18n.t() returns the key itself when a language file has no entry,
       so that is the signal to use the fallback — a half-translated language
       file shows English, never a raw key. {{vars}} interpolate either way. */
    function T(key, fallback, vars) {
        var full = 'transfers.' + key;
        var out = fallback;
        if (window.I18n && I18n.t) {
            var v = I18n.t(full, vars);
            if (v !== full) return v;
        }
        if (vars) {
            Object.keys(vars).forEach(function (k) {
                out = out.split('{{' + k + '}}').join(vars[k]);
            });
        }
        return out;
    }

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

    /* Display name for a location code. state.* keeps the English label the
       server sent, because that is what reaches the partner and the admin. */
    function locLabel(code, fallback) {
        return T('loc_' + code, fallback || code || '');
    }

    function locGroup(name) {
        return T('locgrp_' + String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_'), name);
    }

    /** Canonical English label for a code, from the server's location list. */
    function canonicalLabel(code) {
        for (var i = 0; i < locations.length; i++) {
            if (locations[i].code === code) return locations[i].label;
        }
        return '';
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
            if (!state.pickup_code) return err('errPickup', T('v_pickup', 'Choose a pick-up point.'));
            if (!state.dropoff_code) return err('errDropoff', T('v_dropoff', 'Choose a drop-off point.'));
            if (state.pickup_code === state.dropoff_code) return err('errDropoff', T('v_same', 'Pick-up and drop-off must differ.'));
            if (!state.pickup_date) return err('errDate', T('v_date', 'Choose a date.'));
            if (!state.pickup_time) return err('errTime', T('v_time', 'Choose a pick-up time.'));
            if (state.has_return && (!state.return_date || !state.return_time)) {
                return err('errReturn', T('v_return', 'Add the return date and time, or switch the return off.'));
            }
            return true;
        }
        if (step === 2) {
            if (!state.vehicle && !state.requested_vehicle) {
                return err('errVehicle', T('v_vehicle', 'Choose a vehicle, or tell us which car you want.'));
            }
            return true;
        }
        if (step === 3) {
            if (!state.contact_name.trim()) return err('errName', T('v_name', 'We need a name for the booking.'));
            if (!state.contact_phone.trim() && !state.contact_email.trim()) {
                return err('errContact', T('v_contact', 'Add a phone number or an email so we can reach you.'));
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
        if (state.step === 3) renderReview();
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
                    '<span class="tr-route-leg"><span class="tr-route-dot"></span>' +
                    esc(locLabel(state.pickup_code, state.pickup_label)) + '</span>' +
                    '<span class="tr-route-arrow">&#8594;</span>' +
                    '<span class="tr-route-leg"><span class="tr-route-dot"></span>' +
                    esc(locLabel(state.dropoff_code, state.dropoff_label)) + '</span>' +
                    '<span class="tr-route-meta"><strong>' + r.distance_km + ' ' + T('km', 'km') +
                    '</strong> &middot; ' + T('approx', 'approx') + ' <strong>' +
                    (h ? h + T('unit_h', 'h') + ' ' : '') + m + T('unit_m', 'm') + '</strong></span>';
                box.classList.add('is-shown');
            })
            .catch(function () { box.classList.remove('is-shown'); });
    }

    function vehicleCard(v, selected) {
        var img = v.image
            ? '<img class="tr-vcard-img" src="' + esc(v.image) + '" alt="' + esc(v.brand + ' ' + v.model) + '" loading="lazy">'
            : '<div class="tr-vcard-img tr-vcard-img--none">&#128663;</div>';
        var badge = v.instant
            ? '<span class="tr-badge tr-badge-ok">' + esc(T('badge_now', 'Available now')) + '</span>'
            : '<span class="tr-badge tr-badge-wait">' + esc(T('badge_partner', 'Via a trusted partner')) + '</span>';
        if (v.recommended) {
            badge = '<span class="tr-badge tr-badge-rec">' +
                esc(T('badge_4x4', '4x4 · recommended for this route')) + '</span>' + badge;
        }
        // Luggage is an estimate, so say so rather than quietly dropping the car.
        if (v.luggage_ok === false) {
            badge += '<span class="tr-badge tr-badge-wait">' +
                esc(T('badge_tight', 'Tight for {{n}} bags — add trunk service', { n: state.luggage })) + '</span>';
        }
        // Deliberately no number here. This is a transfer, not a rental: the
        // price is whatever the partner quotes for THIS journey, and showing
        // the car's daily rental rate first made the quote look like a rental
        // price with surcharges bolted on.
        var price = '<span class="tr-vcard-note">' +
            esc(T('vcard_priced', 'Full price quoted for this journey')) + '</span>';
        return '<button type="button" class="tr-vcard' + (selected ? ' is-selected' : '') +
            '" data-vehicle=\'' + esc(JSON.stringify(v)) + '\'>' + img +
            '<div class="tr-vcard-body">' +
            '<span class="tr-vcard-brand">' + esc(v.brand) + '</span>' +
            '<h4 class="tr-vcard-name">' + esc(v.model || v.label) + '</h4>' +
            '<span class="tr-vcard-class">' + esc(v.label || v.category) + '</span>' +
            '<span class="tr-vcard-cap">' + esc(T('cap_line', '{{p}} passengers · approx {{b}} bags',
                { p: v.passengers, b: v.luggage })) +
            (v.passengers >= 7 && state.passengers > 5
                ? ' <em style="opacity:.75">' + esc(T('third_row', '(third row in use)')) + '</em>' : '') +
            '</span>' +
            badge +
            '<span class="tr-vcard-foot">' + price +
            '<span class="tr-btn tr-btn-ghost tr-btn-sm">' +
            esc(selected ? T('selected', 'Selected') : T('select', 'Select')) + '</span></span>' +
            '</div></button>';
    }

    function loadVehicles() {
        var fleetBox = $('#trFleet'), partnerBox = $('#trPartner');
        if (!fleetBox) return;
        var oldMore=document.querySelector('.tr-more'); if(oldMore) oldMore.remove();
        fleetBox.innerHTML = '<div class="tr-empty">' +
            esc(T('finding_vehicles', 'Finding vehicles for your journey…')) + '</div>';
        if (partnerBox) partnerBox.innerHTML = '';

        api('/quote', {
            method: 'POST',
            body: {
                pickup_code: state.pickup_code, dropoff_code: state.dropoff_code,
                passengers: state.passengers, luggage: state.luggage
            }
        }).then(function (d) {
            terrain = d.terrain; terrainLabel = d.terrain_label;
            var note = $('#trTerrainNote');
            if (note) {
                if (terrain === 'mountain') {
                    var tCode = '';
                    for (var ti = 0; ti < locations.length; ti++) {
                        if (locations[ti].label === terrainLabel) { tCode = locations[ti].code; break; }
                    }
                    note.innerHTML = '<strong>' +
                        esc(tCode ? locLabel(tCode, terrainLabel) : (terrainLabel || T('this_route', 'This route'))) +
                        '</strong> ' +
                        esc(T('mountain_note',
                            'is a mountain road — steep, and snow-covered for much of the winter. ' +
                            'We’ve put SUVs and 4x4s first; a sedan can do it in summer, but it is not the car we would send.'));
                    note.style.display = 'block';
                } else {
                    note.style.display = 'none';
                }
            }
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
            if (btn) btn.textContent = on ? T('selected', 'Selected') : T('select', 'Select');
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

        if (!brand) {
            out.innerHTML = '<div class="tr-empty">' + esc(T('find_need_brand', 'Tell us at least a brand.')) + '</div>';
            return;
        }
        out.innerHTML = '<div class="tr-empty">' +
            esc(T('find_searching', 'Searching our fleet and trusted partners…')) + '</div>';

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
                    '<h4 class="tr-panel-h" style="font-size:22px;">' +
                    esc(T('find_exact_t', 'Your vehicle is available')) + '</h4>' +
                    '<p class="tr-panel-sub">' + esc(T('find_exact_d', 'Available for your selected journey.')) + '</p>' +
                    '<div class="tr-vehicles">' + d.vehicles.map(function (v) { return vehicleCard(v, false); }).join('') + '</div>';
                return;
            }
            if (d.outcome === 'similar') {
                out.innerHTML =
                    '<h4 class="tr-panel-h" style="font-size:22px;">' +
                    esc(T('find_similar_t', 'We couldn’t find your exact vehicle')) + '</h4>' +
                    '<p class="tr-panel-sub">' + esc(T('find_similar_d', 'But we found some excellent alternatives.')) + '</p>' +
                    '<div class="tr-vehicles">' + d.vehicles.map(function (v) { return vehicleCard(v, false); }).join('') + '</div>' +
                    '<div class="tr-nav"><button type="button" class="tr-btn tr-btn-ghost" id="trKeepSearching">' +
                    esc(T('find_keep', 'Keep searching for my car')) + '</button></div>';
                $('#trKeepSearching').addEventListener('click', function () { requestSpecific(wanted, klass); });
                return;
            }
            requestSpecific(wanted, klass);
        }).catch(function () {
            out.innerHTML = '<div class="tr-empty">' + esc(T('find_failed', 'Search failed. Please try again.')) + '</div>';
        });
    }

    /** The partner-sourcing state: we take the request rather than fake a price. */
    function requestSpecific(wanted, klass) {
        state.requested_vehicle = { label: wanted, vehicle_class: klass };
        state.vehicle = null;
        save();
        clearErrors();
        $('#trFindResult').innerHTML =
            '<h4 class="tr-panel-h" style="font-size:22px;">' + esc(T('src_title', 'We’ll find it for you')) + '</h4>' +
            '<p class="tr-panel-sub">' + esc(T('src_body',
                'Your requested vehicle isn’t currently available for instant confirmation. ' +
                'We’ll check our trusted vehicle partners and find the best available option for your journey.')) + '</p>' +
            '<div class="tr-summary" style="margin-bottom:20px;">' +
            '<div class="tr-sum-block"><div class="tr-sum-k">' + esc(T('src_requested', 'Requested vehicle')) +
            '</div><div class="tr-sum-v">' + esc(wanted) + '</div></div>' +
            '<div class="tr-sum-block"><div class="tr-sum-k">' + esc(T('sum_journey', 'Journey')) + '</div><div class="tr-sum-v">' +
            esc(locLabel(state.pickup_code, state.pickup_label)) + ' &#8594; ' +
            esc(locLabel(state.dropoff_code, state.dropoff_label)) + '<br>' +
            esc(state.pickup_date) + ' ' + esc(T('at', 'at')) + ' ' + esc(state.pickup_time) + '</div></div>' +
            '<div class="tr-sum-block"><div class="tr-sum-k">' + esc(T('src_party', 'Party')) + '</div><div class="tr-sum-v">' +
            esc(T('party_line', '{{p}} passengers · {{b}} luggage', { p: state.passengers, b: state.luggage })) + '</div></div>' +
            '</div>' +
            '<p class="tr-hint">' + esc(T('src_continue', 'Continue to review and we’ll send this to our partner network.')) + '</p>';
    }

    // ---- review + submit --------------------------------------------------

    function renderReview() {
        var v = state.vehicle;
        var extrasChosen = SERVICES.filter(function (e) { return state.services.indexOf(e.id) !== -1; });
        var extrasTotal = extrasChosen.reduce(function (s, e) { return s + (e.price || 0); }, 0);

        $('#trSumJourney').innerHTML =
            '<div class="tr-sum-when">' + esc(state.pickup_date) + ' &middot; ' + esc(state.pickup_time) + '</div>' +
            '<div class="tr-sum-journey">' +
            '<div class="tr-sum-leg"><span class="tr-route-dot"></span><span>' +
            esc(locLabel(state.pickup_code, state.pickup_label)) + '</span></div>' +
            '<div class="tr-sum-leg"><span class="tr-route-arrow">&#8595;</span></div>' +
            '<div class="tr-sum-leg"><span class="tr-route-dot"></span><span>' +
            esc(locLabel(state.dropoff_code, state.dropoff_label)) + '</span></div>' +
            '</div>' +
            (state.has_return && state.return_date
                ? '<div class="tr-hint">' + esc(T('return_line', 'Return {{d}} at {{t}}',
                    { d: state.return_date, t: state.return_time })) + '</div>' : '') +
            (state.distance_km ? '<div class="tr-hint">' + state.distance_km + ' ' + T('km', 'km') +
                ' &middot; ' + T('approx', 'approx') + ' ' +
                Math.round(state.duration_min / 60 * 10) / 10 + ' ' + T('unit_h', 'h') + '</div>' : '');

        $('#trSumVehicle').innerHTML = v
            ? '<strong>' + esc(v.brand + ' ' + (v.model || v.label)) + '</strong><br>' +
              esc(T('party_line', '{{p}} passengers · {{b}} luggage', { p: v.passengers, b: v.luggage })) +
              (v.instant ? '' : '<br><span class="tr-badge tr-badge-wait" style="margin-top:8px;">' +
                  esc(T('badge_partner', 'Via a trusted partner')) + '</span>')
            : state.requested_vehicle
                ? '<strong>' + esc(state.requested_vehicle.label) + '</strong><br>' +
                  '<span class="tr-badge tr-badge-wait" style="margin-top:8px;">' +
                  esc(T('badge_source', 'We’ll source this for you')) + '</span>'
                : '<span class="tr-muted">' + esc(T('no_vehicle', 'No vehicle selected')) + '</span>';

        $('#trSumGuests').textContent =
            T('party_line', '{{p}} passengers · {{b}} luggage', { p: state.passengers, b: state.luggage });
        $('#trSumExtras').innerHTML = extrasChosen.length
            ? extrasChosen.map(function (e) {
                  return esc(T('svc_' + e.id, e.label)) + (e.price ? ' — ' + money(e.price) : '');
              }).join('<br>')
            : '<span style="color:var(--tr-muted)">' + esc(T('none', 'None')) + '</span>';

        // Nothing is priced yet. Under the quote workflow the partner who takes
        // the job sets the figures, so Review shows the SHAPE of the quote —
        // which lines you will be charged for — rather than inventing numbers.
        var feeLines = [
            [T('fee_car', 'Car price'), T('fee_car_d', 'the vehicle for your journey')],
            [T('fee_airport', 'Airport fee'), T('fee_airport_d', 'if pick-up or drop-off is an airport')],
            [T('fee_chauffeur', 'Chauffeur fee'), T('fee_chauffeur_d', 'driver for the journey')],
            [T('fee_dropoff', 'Drop-off fee'), T('fee_dropoff_d', 'leaving the car at the destination')],
            [T('fee_luggage', 'Extra luggage'), T('fee_luggage_d', 'support vehicle or roof box')]
        ];
        if (extrasChosen.length) {
            feeLines.push([T('fee_services', 'Selected services'),
                extrasChosen.map(function (e) { return T('svc_' + e.id, e.label); }).join(', ')]);
        }
        $('#trSumFees').innerHTML = '<div class="tr-fees">' + feeLines.map(function (f) {
            return '<div class="tr-fee"><span class="tr-fee-name">' + esc(f[0]) + '</span>' +
                '<span class="tr-fee-dots"></span>' +
                '<span class="tr-fee-val">' + esc(f[1]) + '</span></div>';
        }).join('') + '</div>' +
        '<p class="tr-hint">' + esc(T('fees_note', 'Only the lines that apply to your journey are charged.')) + '</p>';

        $('#trTotalValue').textContent = T('on_request', 'On request');
        $('#trTotalNote').textContent = T('total_note',
            'Our partner prices your journey and sends you a full breakdown. ' +
            'Nothing is charged until you accept that price.');

        var signedIn = !!authToken();
        var gate = $('#trSignin');
        if (gate) {
            gate.style.display = signedIn ? 'none' : 'block';
            gate.innerHTML = signedIn ? '' :
                '<strong>' + esc(T('signin_t', 'Sign in to send this request.')) + '</strong><br>' +
                esc(T('signin_d', 'You need an account so we can send you the price and you can accept it. ' +
                    'Your journey is saved — you will come straight back here.')) +
                '<div style="margin-top:12px;"><a class="tr-btn tr-btn-primary tr-btn-sm" ' +
                'href="login.html?redirect=transfers.html">' + esc(T('signin_cta', 'Sign in or register')) + '</a></div>';
        }
        $('#trSubmit').disabled = !signedIn;
        $('#trSubmit').textContent = T('submit', 'Send transfer request');
    }

    function submit() {
        if (!validate(3)) return;
        var btn = $('#trSubmit');
        btn.disabled = true;
        btn.textContent = T('sending', 'Sending…');

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
                extras: state.services,
                vehicle_id: v && v.source === 'fleet' ? v.id : null,
                vehicle_source: v ? v.source : 'requested',
                vehicle_label: v ? (v.brand + ' ' + (v.model || v.label)) : null,
                requested_vehicle: state.requested_vehicle ? state.requested_vehicle.label : null,
                quoted_price: v && v.instant ? v.price : null,
                currency: currency
            }
        }).then(function (d) {
            try { sessionStorage.removeItem(STORE_KEY); } catch (e) {}
            var booked = false; // every transfer is priced by a partner first
            $('.tr-flow').innerHTML =
                '<div class="tr-wrap"><div class="tr-result">' +
                '<div class="tr-result-ico">' + (booked ? '✅' : '🔎') + '</div>' +
                '<h2>' + esc(T('done_title', 'Request received')) + '</h2>' +
                '<p>' + esc(T('done_body', 'One of our partners will price your journey and send you a full ' +
                    'breakdown — car price plus any airport, chauffeur, drop-off or luggage ' +
                    'fees. You can accept or reject it, and nothing is charged until you accept.')) + '</p>' +
                '<div class="tr-ref">' + esc(d.reference) + '</div>' +
                '<p>' + esc(T('done_ref', 'Keep this reference. You can quote it to us any time, ' +
                    'and it appears in your account if you’re signed in.')) + '</p>' +
                '<div class="tr-nav" style="justify-content:center;">' +
                '<a class="tr-btn tr-btn-ghost" href="/transfers.html">' + esc(T('done_again', 'Book another transfer')) + '</a>' +
                '<a class="tr-btn tr-btn-primary" href="/guest-profile.html">' + esc(T('done_view', 'View my transfers')) + '</a>' +
                '</div></div></div>';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }).catch(function (e) {
            btn.disabled = false;
            btn.textContent = T('submit', 'Send transfer request');
            var msg = e.message || T('generic_error', 'Something went wrong. Please try again.');
            if (/token|expired|Access/i.test(msg)) {
                msg = T('expired', 'Your session expired. Sign in again and your journey will still be here.');
                var gate = $('#trSignin');
                if (gate) { gate.style.display = 'block'; }
            }
            err('errContact', msg);
        });
    }

    // ---- wiring -----------------------------------------------------------

    function fillLocationSelects() {
        var groups = {};
        locations.forEach(function (l) { (groups[l.group] = groups[l.group] || []).push(l); });
        var html = '<option value="">' + esc(T('ph_location', 'Airport, hotel, address or city')) + '</option>' +
            Object.keys(groups).map(function (g) {
                return '<optgroup label="' + esc(locGroup(g)) + '">' +
                    groups[g].map(function (l) {
                        return '<option value="' + esc(l.code) + '">' + esc(locLabel(l.code, l.label)) + '</option>';
                    }).join('') +
                    '</optgroup>';
            }).join('');
        ['#trPickup', '#trDropoff'].forEach(function (sel) {
            var el = $(sel);
            if (el) el.innerHTML = html;
        });
        if (state.pickup_code) $('#trPickup').value = state.pickup_code;
        if (state.dropoff_code) $('#trDropoff').value = state.dropoff_code;
    }

    function fillOfferSelects() {
        var groups = {};
        locations.forEach(function (l) { (groups[l.group] = groups[l.group] || []).push(l); });
        var opts = Object.keys(groups).map(function (g) {
            return '<optgroup label="' + esc(locGroup(g)) + '">' +
                groups[g].map(function (l) {
                    return '<option value="' + esc(l.code) + '">' + esc(locLabel(l.code, l.label)) + '</option>';
                }).join('') + '</optgroup>';
        }).join('');
        ['#trOfFrom', '#trOfTo'].forEach(function (sel) {
            var el = $(sel);
            if (el) el.innerHTML = '<option value="">' + esc(T('opt_anywhere', 'Anywhere')) + '</option>' + opts;
        });
    }

    // Split in two so a language change can repaint the chips without
    // stacking a second change listener on the host.
    function paintChips(host, items, selected) {
        host.innerHTML = items.map(function (it) {
            var on = selected.indexOf(it.id) !== -1;
            return '<label class="tr-chip"><input type="checkbox" value="' + esc(it.id) + '"' + (on ? ' checked' : '') + '>' +
                '<span>' + esc(T('svc_' + it.id, it.label)) +
                (it.price ? '<span class="tr-chip-price">' + money(it.price) + '</span>' : '') +
                '</span></label>';
        }).join('');
    }

    function buildChips(host, items, selected, onChange) {
        paintChips(host, items, selected);
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


    /* ---------------------------------------------------------------------
       Partner offers + ad placements on the landing page.

       Offers are journeys a partner has already planned and priced. Booking
       one still goes through admin approval and the partner's final pricing,
       so the base price is shown as "from" — extras and fees are confirmed
       before anything is charged.
       --------------------------------------------------------------------- */

    /* What the price is made of. The partner entered these lines when they
       published the offer, so there is nothing left to add later — which is the
       whole point of showing them here rather than after a quote. */
    function offerBreakdown(o) {
        var lines = o.lines || [];
        if (!lines.length) return '';
        var names = {
            price_car: T('fee_car', 'Car price'),
            fee_airport: T('fee_airport', 'Airport fee'),
            fee_chauffeur: T('fee_chauffeur', 'Chauffeur fee'),
            fee_dropoff: T('fee_dropoff', 'Drop-off fee'),
            fee_luggage: T('fee_luggage', 'Extra luggage'),
            fee_other: o.other_label || T('fee_other', 'Other')
        };
        return '<div class="tr-offer-lines">' + lines.map(function (l) {
            return '<div class="tr-offer-line"><span>' + esc(names[l.field] || l.field) + '</span>' +
                '<span>' + money(l.amount) + '</span></div>';
        }).join('') + '</div>';
    }

    function offerCard(o) {
        var when = o.offer_date
            ? esc(o.offer_date) + (o.offer_time ? ' at ' + esc(o.offer_time) : '')
            : T('any_date', 'Any date');
        var inc = (o.included || []).length
            ? esc(T('includes', 'Includes:')) + ' ' + esc((o.included || []).join(', '))
            : '';
        return '<div class="tr-offer">' +
            '<span class="tr-offer-kind">' +
            esc(o.kind === 'tour' ? T('kind_tour', 'Tour') : T('kind_transfer', 'Transfer')) + '</span>' +
            '<div class="tr-offer-route">' + esc(o.title || (o.from_label + ' → ' + o.to_label)) + '</div>' +
            (o.title ? '<div class="tr-offer-meta">' + esc(o.from_label) + ' → ' + esc(o.to_label) + '</div>' : '') +
            '<div class="tr-offer-meta">' + when + ' · ' +
              esc(T('seats_bags', '{{s}} seats · {{b}} bags', { s: o.seats, b: o.luggage })) +
              (o.vehicle_label ? ' · ' + esc(o.vehicle_label) : '') + '</div>' +
            offerBreakdown(o) +
            (inc ? '<p class="tr-offer-inc">' + inc + '</p>' : '') +
            (o.conditions ? '<p class="tr-offer-inc">' + esc(o.conditions) + '</p>' : '') +
            '<div class="tr-offer-foot">' +
              '<span class="tr-offer-price">' + money(o.total) +
              '<small>' + esc(T('offer_all_in', 'all fees included')) + '</small></span>' +
              '<button type="button" class="tr-btn tr-btn-primary tr-btn-sm tr-offer-book" ' +
              'data-id="' + o.id + '">' + esc(T('book_this', 'Book this')) + '</button>' +
            '</div></div>';
    }

    function loadOffers() {
        var box = $('#trOffers');
        if (!box) return;
        box.innerHTML = '<div class="tr-empty">' + esc(T('offers_loading', 'Loading offers…')) + '</div>';

        var qs = [];
        var f = $('#trOfFrom').value, t = $('#trOfTo').value,
            dt = $('#trOfDate').value, px = $('#trOfPax').value, kd = $('#trOfKind').value;
        if (f) qs.push('from=' + encodeURIComponent(f));
        if (t) qs.push('to=' + encodeURIComponent(t));
        if (dt) qs.push('date=' + encodeURIComponent(dt));
        if (px) qs.push('passengers=' + encodeURIComponent(px));
        if (kd) qs.push('kind=' + encodeURIComponent(kd));

        api('/offers' + (qs.length ? '?' + qs.join('&') : ''))
            .then(function (d) {
                var list = (d && d.offers) || [];
                if (!list.length) {
                    box.innerHTML = '<div class="tr-empty">' + esc(T('offers_none',
                        'No ready-made journeys match that yet. ' +
                        'Create a transfer above and we will price it for you.')) + '</div>';
                    return;
                }
                box.innerHTML = list.map(offerCard).join('');
                box.querySelectorAll('.tr-offer-book').forEach(function (b) {
                    b.addEventListener('click', function () { bookOffer(list, b.dataset.id, b); });
                });
            })
            .catch(function () {
                box.innerHTML = '<div class="tr-empty">' + esc(T('offers_failed', 'Could not load offers just now.')) + '</div>';
            });
    }

    function bookOffer(list, id, btn) {
        var offer = null;
        for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) offer = list[i];
        if (!offer) return;

        if (!authToken()) {
            window.location.href = 'login.html?redirect=transfers.html';
            return;
        }
        var name = prompt(T('ask_name', 'Your name for this booking?'));
        if (!name) return;
        var phone = prompt(T('ask_phone', 'Phone or WhatsApp we can reach you on?'));
        if (!phone) return;
        var date = offer.offer_date || prompt(T('ask_date', 'Which date? (YYYY-MM-DD)'));
        if (!date) return;
        var time = offer.offer_time || prompt(T('ask_time', 'What time? (HH:MM)')) || '10:00';

        btn.disabled = true;
        btn.textContent = T('booking', 'Booking…');
        api('/offers/' + encodeURIComponent(id) + '/book', {
            method: 'POST',
            body: {
                contact_name: name, contact_phone: phone,
                pickup_date: date, pickup_time: time,
                passengers: parseInt($('#trOfPax').value, 10) || 1, luggage: 0
            }
        })
            .then(function (d) {
                alert(T('booked_ok', 'Booked — your reference is {{ref}}.', { ref: d.reference }) + '\n' +
                      T('booked_note', 'We will confirm the final price with you before anything is charged. ' +
                        'You can follow it in My Transfers.'));
                btn.textContent = T('requested', 'Requested');
            })
            .catch(function (e) {
                btn.disabled = false;
                btn.textContent = T('book_this', 'Book this');
                alert(e.message || T('book_failed', 'Could not book this offer.'));
            });
    }

    /** A partner landing here wants to publish an offer, not book a ride. */
    function showPartnerBand() {
        var band = document.getElementById('trPartnerBand');
        if (!band) return;
        var user = null;
        try { user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null'); }
        catch (e) { /* not signed in */ }
        if (user && user.role === 'partner') band.style.display = '';
    }

    function loadAds() {
        var box = $('#trAds'), section = $('#trAdsSection');
        if (!box || !section) return;
        fetch('/api/ads?placement=transfers')
            .then(function (r) { return r.json(); })
            .then(function (d) {
                var ads = (d && (d.ads || d.cards)) || [];
                if (!ads.length) return;                 // no ads: the section stays hidden
                box.innerHTML = ads.map(function (a) {
                    var inner =
                        (a.cover_url ? '<img src="' + esc(a.cover_url) + '" alt="" loading="lazy">' : '') +
                        '<div class="tr-ad-body">' +
                        '<h3>' + esc(a.title || '') + '</h3>' +
                        (a.description ? '<p>' + esc(a.description) + '</p>' : '') +
                        (a.cta_text ? '<span class="tr-ad-cta">' + esc(a.cta_text) + ' &rarr;</span>' : '') +
                        '</div>';
                    return a.target_link
                        ? '<a class="tr-ad" href="' + esc(a.target_link) + '" rel="noopener">' + inner + '</a>'
                        : '<div class="tr-ad">' + inner + '</div>';
                }).join('');
                section.style.display = '';
            })
            .catch(function () { /* ads are decoration — never block the page */ });
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
        api('/locations').then(function (d) {
            locations = d.locations || [];
            fillLocationSelects();
            fillOfferSelects();
            renderRoute();
        });

        $('#trPickup').addEventListener('change', function () {
            state.pickup_code = this.value;
            state.pickup_label = canonicalLabel(this.value) || this.options[this.selectedIndex].text;
            save(); renderRoute();
        });
        $('#trDropoff').addEventListener('change', function () {
            state.dropoff_code = this.value;
            state.dropoff_label = canonicalLabel(this.value) || this.options[this.selectedIndex].text;
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
        buildChips($('#trServices'), SERVICES, state.services);
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

        $('#trSubmit').addEventListener('click', submit);

        // Landing extras: partner offers and ad placements.
        var ofSearch = $('#trOfSearch');
        if (ofSearch) ofSearch.addEventListener('click', loadOffers);
        showPartnerBand();
        loadOffers();
        loadAds();

        // Switching language repaints everything this file drew by hand;
        // i18n.js only touches nodes carrying data-i18n attributes.
        document.addEventListener('languageChanged', function () {
            var svc = $('#trServices');
            if (svc) paintChips(svc, SERVICES, state.services);
            fillLocationSelects();
            fillOfferSelects();
            if (state.pickup_code) $('#trPickup').value = state.pickup_code;
            if (state.dropoff_code) $('#trDropoff').value = state.dropoff_code;
            renderRoute();
            loadOffers();
            if (state.step === 2) loadVehicles();
            render();
        });

        render();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
