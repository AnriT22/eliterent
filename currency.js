/* ========================================
   Currency Converter
   Fetches NBG rates, converts displayed prices
   Supports: USD (base), EUR, GEL
   ======================================== */

(function () {
    'use strict';

    var STORAGE_KEY = 'royalcar_currency';
    var SUPPORTED = ['USD', 'EUR', 'GEL'];
    var SYMBOLS = { USD: '$', EUR: '€', GEL: '₾' };
    var currentCurrency = 'USD';
    var rates = null; // rates relative to GEL (1 unit = X GEL)
    var ratesLoaded = false;
    var onReadyCallbacks = [];

    // Public API
    window.Currency = {
        current: function () { return currentCurrency; },
        symbol: function (c) { return SYMBOLS[c || currentCurrency] || c; },
        set: setCurrency,
        convert: convert,
        formatPrice: formatPrice,
        onReady: function (cb) {
            if (ratesLoaded) cb();
            else onReadyCallbacks.push(cb);
        },
        refresh: applyToPage
    };

    // Init
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED.indexOf(saved) !== -1) {
        currentCurrency = saved;
    }

    // Fetch rates
    fetchRates();

    function fetchRates() {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/api/exchange-rates', true);
        xhr.timeout = 8000;
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        if (data && data.rates) {
                            rates = data.rates;
                            ratesLoaded = true;
                            for (var i = 0; i < onReadyCallbacks.length; i++) {
                                onReadyCallbacks[i]();
                            }
                            onReadyCallbacks = [];
                            // Apply if not USD
                            if (currentCurrency !== 'USD') {
                                applyToPage();
                            }
                            updateSelectorUI();
                        }
                    } catch (e) {
                        console.error('[Currency] Parse error:', e);
                    }
                }
            }
        };
        xhr.send();
    }

    // Convert USD amount to target currency
    function convert(usdAmount, toCurrency) {
        if (!rates) return usdAmount;
        var to = toCurrency || currentCurrency;
        if (to === 'USD') return usdAmount;

        var usdToGel = rates['USD'] || 2.69;

        if (to === 'GEL') {
            return usdAmount * usdToGel;
        }
        if (to === 'EUR') {
            var eurToGel = rates['EUR'] || 3.15;
            return usdAmount * usdToGel / eurToGel;
        }
        return usdAmount;
    }

    // Format price with symbol
    function formatPrice(usdAmount, toCurrency) {
        var to = toCurrency || currentCurrency;
        var converted = convert(usdAmount, to);
        var sym = SYMBOLS[to] || '$';
        // GEL: show after number, others before
        if (to === 'GEL') {
            return converted.toFixed(2) + ' ' + sym;
        }
        return sym + converted.toFixed(2);
    }

    function setCurrency(currency) {
        if (SUPPORTED.indexOf(currency) === -1) return;
        currentCurrency = currency;
        localStorage.setItem(STORAGE_KEY, currency);
        updateSelectorUI();
        applyToPage();
        // Dispatch event
        var event;
        try {
            event = new CustomEvent('currencyChanged', { detail: { currency: currency } });
        } catch (e) {
            event = document.createEvent('CustomEvent');
            event.initCustomEvent('currencyChanged', true, true, { currency: currency });
        }
        document.dispatchEvent(event);
    }

    // Update button text in navbar
    function updateSelectorUI() {
        var btn = document.getElementById('currencyBtn');
        if (btn) {
            var textEl = btn.querySelector('.selector-text');
            if (textEl) textEl.textContent = currentCurrency;
            var iconEl = btn.querySelector('.selector-icon');
            if (iconEl) iconEl.textContent = SYMBOLS[currentCurrency] || '💵';
        }
        // Mark active item
        var dropdown = document.getElementById('currencyDropdown');
        if (dropdown) {
            dropdown.querySelectorAll('.dropdown-item').forEach(function (item) {
                if (item.dataset.currency === currentCurrency) {
                    item.style.background = 'rgba(201,168,76,0.15)';
                    item.style.color = '#C9A84C';
                } else {
                    item.style.background = '';
                    item.style.color = '';
                }
            });
        }
    }

    // Find and convert all price elements on the page
    function applyToPage() {
        if (!rates) return;

        // Elements with data-price-usd attribute (explicit)
        document.querySelectorAll('[data-price-usd]').forEach(function (el) {
            var usd = parseFloat(el.getAttribute('data-price-usd'));
            if (isNaN(usd)) return;
            el.textContent = formatPrice(usd);
        });

        // Auto-detect price patterns: $XX.XX or $XX
        // Only for elements with class 'vc-price-amount' or similar known price containers
        var priceSelectors = [
            '.vc-price-amount',
            '.price-amount',
            '.hero-price-amount',
            '.vd-price-amount'
        ];
        priceSelectors.forEach(function (sel) {
            document.querySelectorAll(sel).forEach(function (el) {
                // Store original USD price
                if (!el.hasAttribute('data-price-usd')) {
                    var text = el.textContent.trim();
                    var match = text.match(/\$?\s*([\d,]+\.?\d*)/);
                    if (match) {
                        var val = parseFloat(match[1].replace(/,/g, ''));
                        if (!isNaN(val)) {
                            el.setAttribute('data-price-usd', val);
                        }
                    }
                }
                var usd = parseFloat(el.getAttribute('data-price-usd'));
                if (!isNaN(usd)) {
                    el.textContent = formatPrice(usd);
                }
            });
        });
    }

    // Wire up dropdown clicks
    document.addEventListener('DOMContentLoaded', function () {
        var dropdown = document.getElementById('currencyDropdown');
        if (dropdown) {
            dropdown.querySelectorAll('.dropdown-item').forEach(function (item) {
                item.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var currency = item.dataset.currency;
                    if (currency) setCurrency(currency);
                    // Close dropdown
                    dropdown.style.display = 'none';
                    var btn = document.getElementById('currencyBtn');
                    if (btn) btn.classList.remove('active');
                });
            });
        }
        updateSelectorUI();
    });
})();
