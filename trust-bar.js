/* Renders the admin-managed trust bar. A page opts in by giving its
   .trust-bar-items container a data-trust-placement attribute (cars|drivers|
   vehicles|blog|checkout). The static markup inside stays as a fallback until
   the badges load. */
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
    function render(container, badges) {
        var lang = currentLang();
        container.innerHTML = badges.map(function (b) {
            var icon = b.icon ? '<span class="trust-icon">' + esc(b.icon) + '</span> ' : '';
            return '<div class="trust-item">' + icon + '<span>' + esc(loc(b, lang)) + '</span></div>';
        }).join('');
    }
    function load() {
        var container = document.querySelector('.trust-bar-items[data-trust-placement]');
        if (!container) return;
        var placement = container.getAttribute('data-trust-placement') || 'cars';
        fetch('/api/trust-badges?placement=' + encodeURIComponent(placement))
            .then(function (r) { return r.json(); })
            .then(function (d) { if (d && d.badges && d.badges.length) render(container, d.badges); })
            .catch(function () { /* keep the static fallback markup */ });
    }
    load();
    document.addEventListener('languageChanged', load);
})();
