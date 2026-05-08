/* ========================================
   Currency Converter — Multi-currency support
   Supports: USD, EUR, GEL, ILS, RUB, TRY, AED
   Uses fallback rates + optional live fetch
   ======================================== */

(function () {
    'use strict';

    var STORAGE_KEY = 'EliteAuto_currency';
    var SUPPORTED = ['USD', 'EUR', 'GEL', 'ILS', 'RUB', 'TRY', 'AED'];
    var SYMBOLS = { USD: '$', EUR: '€', GEL: '₾', ILS: '₪', RUB: '₽', TRY: '₺', AED: 'د.إ' };

    // Fallback rates (1 USD = X currency) — updated periodically
    var fallbackRates = { USD: 1, EUR: 0.92, GEL: 2.72, ILS: 3.62, RUB: 96.5, TRY: 38.4, AED: 3.67 };
    var rates = Object.assign({}, fallbackRates);
    var currentCurrency = 'USD';
    var readyCallbacks = [];
    var isReady = false;

    function init() {
        var saved = localStorage.getItem(STORAGE_KEY);
        if (saved && SUPPORTED.indexOf(saved) !== -1) {
            currentCurrency = saved;
        }
        fetchRates(function () {
            isReady = true;
            readyCallbacks.forEach(function (cb) { try { cb(); } catch (e) {} });
            readyCallbacks = [];
        });
    }

    function fetchRates(done) {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', 'https://open.er-api.com/v6/latest/USD', true);
            xhr.timeout = 5000;
            xhr.onload = function () {
                if (xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        if (data && data.rates) {
                            SUPPORTED.forEach(function (c) {
                                if (data.rates[c]) rates[c] = data.rates[c];
                            });
                        }
                    } catch (e) {}
                }
                done();
            };
            xhr.onerror = xhr.ontimeout = function () { done(); };
            xhr.send();
        } catch (e) { done(); }
    }

    function convert(usdAmount) {
        var n = Number(usdAmount) || 0;
        return n * (rates[currentCurrency] || 1);
    }

    function formatPrice(usdAmount) {
        var converted = convert(usdAmount);
        var sym = SYMBOLS[currentCurrency] || currentCurrency;
        if (currentCurrency === 'RUB' || currentCurrency === 'TRY') {
            return sym + Math.round(converted).toLocaleString();
        }
        return sym + converted.toFixed(2);
    }

    function setCurrency(code) {
        code = (code || 'USD').toUpperCase();
        if (SUPPORTED.indexOf(code) === -1) return;
        currentCurrency = code;
        try { localStorage.setItem(STORAGE_KEY, code); } catch (e) {}
        updateAllPrices();
        document.dispatchEvent(new CustomEvent('currencyChanged', { detail: { currency: code } }));
    }

    function updateAllPrices() {
        document.querySelectorAll('[data-price-usd]').forEach(function (el) {
            var usd = parseFloat(el.getAttribute('data-price-usd'));
            if (!isNaN(usd)) {
                el.textContent = formatPrice(usd);
            }
        });
    }

    window.Currency = {
        current: function () { return currentCurrency; },
        symbol: function () { return SYMBOLS[currentCurrency] || '$'; },
        set: setCurrency,
        convert: convert,
        formatPrice: formatPrice,
        onReady: function (cb) {
            if (isReady) cb();
            else readyCallbacks.push(cb);
        },
        refresh: function () { fetchRates(updateAllPrices); },
        supported: SUPPORTED,
        symbols: SYMBOLS
    };

    init();
})();
