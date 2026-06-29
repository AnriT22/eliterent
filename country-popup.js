/* ============================================================
   COUNTRY CHOOSER — small modal shown on entry (homepage + vehicles)
   until the visitor picks a country. Choosing saves it and opens the
   vehicles page filtered to that country. Closing leaves it, so it
   shows again on the next page until a country is actually chosen.
   Included on index.html and vehicles.html.
   ============================================================ */
(function () {
    var COUNTRIES = [
        { code: 'georgia',    name: 'Georgia',    flag: '🇬🇪', live: true },
        { code: 'armenia',    name: 'Armenia',    flag: '🇦🇲', live: false },
        { code: 'azerbaijan', name: 'Azerbaijan', flag: '🇦🇿', live: false },
        { code: 'turkey',     name: 'Turkey',     flag: '🇹🇷', live: false },
        { code: 'usa',        name: 'USA',        flag: '🇺🇸', live: false }
    ];
    var POP_ID = 'cpopOverlay', STYLE_ID = 'cpopStyle';

    function getChosen() { try { return localStorage.getItem('selectedCountry'); } catch (e) { return null; } }

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var css =
            '.cpop-overlay{position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:20px;'
            + 'background:rgba(5,6,10,0.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity .25s ease;}'
            + '.cpop-overlay.open{opacity:1;pointer-events:auto;}'
            + '.cpop-card{position:relative;width:100%;max-width:380px;background:linear-gradient(160deg,#15171f,#1c1e26);'
            + 'border:1px solid rgba(212,175,55,0.3);border-radius:20px;padding:30px 24px 24px;box-shadow:0 24px 60px rgba(0,0,0,.55);'
            + 'transform:translateY(14px) scale(.95);transition:transform .3s cubic-bezier(.2,.8,.2,1);text-align:center;}'
            + '.cpop-overlay.open .cpop-card{transform:translateY(0) scale(1);}'
            + '.cpop-close{position:absolute;top:12px;right:12px;width:30px;height:30px;border:none;border-radius:50%;'
            + 'background:rgba(255,255,255,.08);color:#cbd0dc;font-size:18px;line-height:1;cursor:pointer;transition:background .15s,transform .2s;}'
            + '.cpop-close:hover{background:rgba(255,255,255,.16);transform:rotate(90deg);}'
            + '.cpop-globe{font-size:34px;line-height:1;margin-bottom:8px;}'
            + '.cpop-title{margin:0 0 4px;font-size:19px;font-weight:800;color:#F4E3B2;letter-spacing:.2px;}'
            + '.cpop-sub{margin:0 0 18px;font-size:13px;color:#A0A3B0;}'
            + '.cpop-grid{display:flex;flex-direction:column;gap:9px;}'
            + '.cpop-country{display:flex;align-items:center;gap:12px;width:100%;padding:11px 14px;background:rgba(255,255,255,.04);'
            + 'border:1px solid #2A2D38;border-radius:12px;cursor:pointer;transition:border-color .15s,background .15s,transform .15s;text-align:left;}'
            + '.cpop-country:hover{border-color:#D4AF37;background:rgba(212,175,55,.08);transform:translateY(-1px);}'
            + '.cpop-flag{font-size:22px;line-height:1;}'
            + '.cpop-name{flex:1;font-size:15px;font-weight:600;color:#EAEAEA;}'
            + '.cpop-soon{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#D4AF37;'
            + 'background:rgba(212,175,55,.14);padding:3px 8px;border-radius:20px;}'
            + '[dir="rtl"] .cpop-close{right:auto;left:12px;}[dir="rtl"] .cpop-country{text-align:right;}';
        var s = document.createElement('style'); s.id = STYLE_ID; s.textContent = css;
        document.head.appendChild(s);
    }

    function build() {
        var existing = document.getElementById(POP_ID);
        if (existing) return existing;
        injectStyles();
        var ov = document.createElement('div');
        ov.id = POP_ID; ov.className = 'cpop-overlay';
        ov.innerHTML =
            '<div class="cpop-card" role="dialog" aria-modal="true">'
            + '<button class="cpop-close" type="button" aria-label="Close">&times;</button>'
            + '<div class="cpop-globe">🌍</div>'
            + '<h3 class="cpop-title" data-i18n="country_popup.title">Choose your country</h3>'
            + '<p class="cpop-sub" data-i18n="country_popup.subtitle">Where would you like to rent a car?</p>'
            + '<div class="cpop-grid">'
            + COUNTRIES.map(function (c) {
                return '<button class="cpop-country" type="button" data-code="' + c.code + '">'
                    + '<span class="cpop-flag">' + c.flag + '</span>'
                    + '<span class="cpop-name">' + c.name + '</span>'
                    + (c.live ? '' : '<span class="cpop-soon" data-i18n="country_popup.soon">Soon</span>')
                    + '</button>';
            }).join('')
            + '</div></div>';
        document.body.appendChild(ov);
        ov.querySelector('.cpop-close').addEventListener('click', hide);
        ov.addEventListener('click', function (e) { if (e.target === ov) hide(); });
        ov.querySelectorAll('.cpop-country').forEach(function (b) {
            b.addEventListener('click', function () { choose(b.getAttribute('data-code')); });
        });
        if (window.I18n && I18n.translatePage) I18n.translatePage(ov);
        return ov;
    }

    function show() {
        var ov = build();
        setTimeout(function () { ov.classList.add('open'); }, 20);
    }
    function hide() {
        var ov = document.getElementById(POP_ID);
        if (ov) ov.classList.remove('open');
    }
    function choose(code) {
        try { localStorage.setItem('selectedCountry', code); sessionStorage.setItem('selectedCountry', code); } catch (e) {}
        hide();
        window.location.href = 'vehicles.html?country=' + encodeURIComponent(code);
    }

    window.openCountryPopup = show;

    // Auto-show on entry (after a short beat so the page renders first) — only if
    // the visitor hasn't picked a country yet. Closing without choosing leaves it,
    // so it appears again on the next page until a country is selected.
    function maybeAuto() { if (!getChosen()) setTimeout(show, 700); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', maybeAuto);
    else maybeAuto();
})();
