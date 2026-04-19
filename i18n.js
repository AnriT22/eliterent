/* ========================================
   i18n — Internationalization Engine
   Supports: EN (English), KA (Georgian)
   Uses data-i18n attributes + JSON translation files
   Persists language choice in localStorage
   ======================================== */

(function () {
    'use strict';

    var SUPPORTED_LANGS = ['en', 'ka'];
    var DEFAULT_LANG = 'en';
    var STORAGE_KEY = 'royalcar_lang';
    var translations = {};
    var currentLang = DEFAULT_LANG;
    var loadedLangs = {};
    var onReadyCallbacks = [];
    var isReady = false;

    // ── Public API ──
    window.I18n = {
        t: translate,
        lang: function () { return currentLang; },
        setLang: setLanguage,
        onReady: function (cb) {
            if (isReady) cb();
            else onReadyCallbacks.push(cb);
        },
        translatePage: translatePage,
        translateElement: translateElement
    };

    // ── Init ──
    function init() {
        var saved = localStorage.getItem(STORAGE_KEY);
        if (saved && SUPPORTED_LANGS.indexOf(saved) !== -1) {
            currentLang = saved;
        }
        // Set html lang attribute immediately
        document.documentElement.lang = currentLang;

        loadLanguage(currentLang, function () {
            // Also preload English as fallback
            if (currentLang !== 'en') {
                loadLanguage('en', function () {
                    markReady();
                });
            } else {
                markReady();
            }
        });
    }

    function markReady() {
        isReady = true;
        translatePage();
        for (var i = 0; i < onReadyCallbacks.length; i++) {
            onReadyCallbacks[i]();
        }
        onReadyCallbacks = [];
    }

    // ── Load language JSON ──
    function loadLanguage(lang, callback) {
        if (loadedLangs[lang]) {
            if (callback) callback();
            return;
        }
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/lang/' + lang + '.json?v=' + Date.now(), true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        translations[lang] = JSON.parse(xhr.responseText);
                        loadedLangs[lang] = true;
                    } catch (e) {
                        console.error('[i18n] Failed to parse ' + lang + '.json:', e);
                        translations[lang] = {};
                    }
                } else {
                    console.error('[i18n] Failed to load ' + lang + '.json — status ' + xhr.status);
                    translations[lang] = {};
                }
                if (callback) callback();
            }
        };
        xhr.send();
    }

    // ── Translate a key ──
    // Supports nested keys like "nav.home"
    function translate(key, replacements) {
        var val = resolveKey(currentLang, key);
        if (val === undefined || val === null) {
            // Fallback to English
            val = resolveKey('en', key);
        }
        if (val === undefined || val === null) {
            return key; // Return key itself as final fallback
        }
        // Handle {{variable}} replacements
        if (replacements && typeof val === 'string') {
            Object.keys(replacements).forEach(function (k) {
                val = val.replace(new RegExp('\\{\\{' + k + '\\}\\}', 'g'), replacements[k]);
            });
        }
        return val;
    }

    function resolveKey(lang, key) {
        if (!translations[lang]) return undefined;
        var parts = key.split('.');
        var obj = translations[lang];
        for (var i = 0; i < parts.length; i++) {
            if (obj === undefined || obj === null) return undefined;
            obj = obj[parts[i]];
        }
        return obj;
    }

    // ── Set language ──
    function setLanguage(lang, callback) {
        if (SUPPORTED_LANGS.indexOf(lang) === -1) return;
        currentLang = lang;
        localStorage.setItem(STORAGE_KEY, lang);
        document.documentElement.lang = lang;

        loadLanguage(lang, function () {
            translatePage();
            // Dispatch event so JS files can react
            var event;
            try {
                event = new CustomEvent('languageChanged', { detail: { lang: lang } });
            } catch (e) {
                event = document.createEvent('CustomEvent');
                event.initCustomEvent('languageChanged', true, true, { lang: lang });
            }
            document.dispatchEvent(event);
            if (callback) callback();
        });
    }

    // ── Translate entire page ──
    function translatePage(root) {
        root = root || document;

        // data-i18n="key" → sets textContent
        var nodes = root.querySelectorAll('[data-i18n]');
        for (var i = 0; i < nodes.length; i++) {
            applyTranslation(nodes[i]);
        }

        // data-i18n-placeholder="key" → sets placeholder
        var phNodes = root.querySelectorAll('[data-i18n-placeholder]');
        for (var j = 0; j < phNodes.length; j++) {
            var phKey = phNodes[j].getAttribute('data-i18n-placeholder');
            var phVal = translate(phKey);
            if (phVal !== phKey) phNodes[j].placeholder = phVal;
        }

        // data-i18n-title="key" → sets title attribute
        var titleNodes = root.querySelectorAll('[data-i18n-title]');
        for (var k = 0; k < titleNodes.length; k++) {
            var tKey = titleNodes[k].getAttribute('data-i18n-title');
            var tVal = translate(tKey);
            if (tVal !== tKey) titleNodes[k].title = tVal;
        }

        // data-i18n-html="key" → sets innerHTML (for content with markup)
        var htmlNodes = root.querySelectorAll('[data-i18n-html]');
        for (var h = 0; h < htmlNodes.length; h++) {
            var hKey = htmlNodes[h].getAttribute('data-i18n-html');
            var hVal = translate(hKey);
            if (hVal !== hKey) htmlNodes[h].innerHTML = hVal;
        }
    }

    function applyTranslation(el) {
        var key = el.getAttribute('data-i18n');
        if (!key) return;
        var val = translate(key);
        if (val !== key) {
            el.textContent = val;
        }
    }

    // ── Translate a single element + descendants ──
    function translateElement(el) {
        if (!el) return;
        if (el.hasAttribute && el.hasAttribute('data-i18n')) {
            applyTranslation(el);
        }
        translatePage(el);
    }

    // ── Auto-init ──
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
