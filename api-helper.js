// Centralized API helper with automatic environment detection
// When deployed to Render, frontend + backend share the same origin
// so all fetch('/api/...') calls work without modification.
(function() {
    var isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.hostname.includes('192.168.');

    // Same origin for both local and production (Render serves everything)
    var API_BASE = isLocalhost 
        ? 'http://localhost:3000'
        : window.location.origin;

    window.apiUrl = function(path) {
        var cleanPath = path.startsWith('/') ? path : '/' + path;
        return API_BASE + cleanPath;
    };

    // Override fetch to prepend API_BASE for /api/* calls (needed for localhost)
    if (isLocalhost) {
        var originalFetch = window.fetch;
        window.fetch = function(url, options) {
            if (typeof url === 'string' && url.startsWith('/api/')) {
                url = API_BASE + url;
            }
            return originalFetch(url, options);
        };
    }

    window.API_BASE_URL = API_BASE;

    // Capture a shared referral code from the URL (?ref=CODE) on any page and
    // persist it, so a visitor who arrives via a partner's shared car link has
    // the code auto-applied when they register as a partner.
    try {
        var _ref = new URLSearchParams(window.location.search).get('ref');
        if (_ref) {
            _ref = _ref.trim().toUpperCase();
            if (_ref) localStorage.setItem('pendingReferralCode', _ref);
        }
    } catch (e) { /* ignore */ }

    // Human verification ping — proves the browser runs JavaScript (crawlers mostly
    // don't), and reports screen size + clock timezone for the admin analytics.
    // Lives here (not script.js) because every page loads this file; fires soon after
    // load, or on leave, so quick bouncers still count as real visitors.
    var _humanSent = false;
    function sendHuman(onLeave) {
        if (_humanSent) return;
        _humanSent = true;
        var info = {};
        try {
            info.screen = window.screen.width + 'x' + window.screen.height;
            info.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        } catch (e) {}
        var body = JSON.stringify(info);
        if (onLeave && navigator.sendBeacon) {
            navigator.sendBeacon(API_BASE + '/api/verify-human', new Blob([body], { type: 'application/json' }));
            return;
        }
        fetch('/api/verify-human', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: body,
            keepalive: true
        }).catch(function () {});
    }
    function scheduleHuman() { setTimeout(function () { sendHuman(false); }, 600); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleHuman);
    else scheduleHuman();
    window.addEventListener('pagehide', function () { sendHuman(true); });
})();
