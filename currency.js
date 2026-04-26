/* ========================================
   Currency Converter — DISABLED (USD only)
   ======================================== */

(function () {
    'use strict';

    // Clear any saved currency preference
    try { localStorage.removeItem('royalcar_currency'); } catch (e) {}

    // Stub API — always USD
    window.Currency = {
        current: function () { return 'USD'; },
        symbol: function () { return '$'; },
        set: function () {},
        convert: function (usd) { return Number(usd) || 0; },
        formatPrice: function (usd) { return '$' + (Number(usd) || 0).toFixed(2); },
        onReady: function (cb) { if (typeof cb === 'function') cb(); },
        refresh: function () {}
    };
})();
