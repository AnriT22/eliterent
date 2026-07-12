/* Renders the admin-managed trust bar as a seamless right-to-left marquee.
   A page opts in by giving its .trust-bar-items container a data-trust-placement
   attribute (cars|drivers|vehicles|blog|checkout). The set of badges is rendered
   twice (the duplicate is aria-hidden) so the CSS marquee (translateX to -50%)
   loops with no gap. The static markup inside stays as a fallback until badges load. */
(function () {
    'use strict';
    function esc(s) { var d = document.createElement('div'); d.textContent = (s == null ? '' : s); return d.innerHTML; }
    function loc(b, lang) {
        if (lang && lang !== 'en' && b['label_' + lang]) return b['label_' + lang];
        return b.label || '';
    }
    function currentLang() {
        return (window.I18n && I18n.lang && I18n.lang()) || localStorage.getItem('EliteAuto_lang') || 'en';
    }
    function itemHtml(b, lang) {
        var icon = b.icon ? '<span class="trust-icon">' + esc(b.icon) + '</span> ' : '';
        return '<div class="trust-item">' + icon + '<span>' + esc(loc(b, lang)) + '</span></div>';
    }
    // Wrap a set of items so it repeats seamlessly. display:contents keeps each
    // .trust-item a direct flex child of the container.
    function duplicated(oneSetHtml) {
        return oneSetHtml + '<span class="trust-dup" aria-hidden="true" style="display:contents;">' + oneSetHtml + '</span>';
    }
    function render(container, badges) {
        var lang = currentLang();
        var one = badges.map(function (b) { return itemHtml(b, lang); }).join('');
        container.innerHTML = duplicated(one);
        container.setAttribute('data-marquee-ready', '1');
    }
    // Fallback: duplicate whatever static markup is already there so the marquee
    // still loops when the API is unavailable.
    function ensureFallbackDuplicated(container) {
        if (container.getAttribute('data-marquee-ready')) return;
        container.innerHTML = duplicated(container.innerHTML);
        container.setAttribute('data-marquee-ready', '1');
    }
    function load() {
        var container = document.querySelector('.trust-bar-items[data-trust-placement]');
        if (!container) return;
        var placement = container.getAttribute('data-trust-placement') || 'cars';
        fetch('/api/trust-badges?placement=' + encodeURIComponent(placement))
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (d && d.badges && d.badges.length) render(container, d.badges);
                else ensureFallbackDuplicated(container);
            })
            .catch(function () { ensureFallbackDuplicated(container); });
    }
    load();
    document.addEventListener('languageChanged', load);
})();
