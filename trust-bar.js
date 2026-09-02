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
        // A logo image takes the place of the emoji icon when present.
        var visual = b.image_url
            ? '<img class="trust-logo" src="' + esc(b.image_url) + '" alt="' + esc(loc(b, lang)) + '" loading="lazy"> '
            : (b.icon ? '<span class="trust-icon">' + esc(b.icon) + '</span> ' : '');
        var label = loc(b, lang);
        var text = label ? '<span>' + esc(label) + '</span>' : '';
        var inner = visual + text;
        // Clickable when a link is set (advertisement); otherwise a plain item.
        if (b.link_url) {
            return '<a class="trust-item trust-item--link" href="' + esc(b.link_url) + '" target="_blank" rel="noopener">' + inner + '</a>';
        }
        return '<div class="trust-item">' + inner + '</div>';
    }
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    // Wrap a set of items so it repeats seamlessly. display:contents keeps each
    // .trust-item a direct flex child of the container. The duplicate exists only
    // to hide the seam in the marquee loop — with reduced motion there is no loop,
    // so rendering it twice would just show every badge twice on a wrapped row.
    function duplicated(oneSetHtml) {
        if (reduceMotion && reduceMotion.matches) return oneSetHtml;
        return oneSetHtml + '<span class="trust-dup" aria-hidden="true" style="display:contents;">' + oneSetHtml + '</span>';
    }
    function render(container, badges) {
        var lang = currentLang();
        var one = badges.map(function (b) { return itemHtml(b, lang); }).join('');
        container.innerHTML = duplicated(one);
        container.setAttribute('data-marquee-ready', '1');
    }
    // Fallback: duplicate whatever static markup is already there so the marquee
    // still loops when the API is unavailable. The pristine single set is kept so
    // this stays correct if it runs again (language switch, reduced-motion toggle)
    // rather than duplicating an already-duplicated list.
    var staticOneSet = null;
    function ensureFallbackDuplicated(container) {
        if (staticOneSet === null) staticOneSet = container.innerHTML;
        container.innerHTML = duplicated(staticOneSet);
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
    // Toggling the OS "reduce motion" setting changes whether the duplicate set
    // should be there at all, so re-render when it flips.
    if (reduceMotion && reduceMotion.addEventListener) {
        reduceMotion.addEventListener('change', load);
    }
})();
