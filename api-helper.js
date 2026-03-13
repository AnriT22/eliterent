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
})();
