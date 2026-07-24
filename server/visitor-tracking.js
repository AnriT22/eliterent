// Visitor tracking — enriched pageview capture for the admin analytics dashboards.
// Every tracked pageview stores geo (offline IP lookup, no external calls), parsed
// device/browser/OS, browser language, classified traffic source and a rolling
// 30-minute session id. Inserts are fire-and-forget so tracking adds ~0ms to
// page delivery; parsing happens once at insert time so dashboards only aggregate.
const crypto = require('crypto');

// geoip-lite is optional at runtime: if the dependency is missing (e.g. deploy
// without npm install) tracking still works, just without geo fields.
let geoip = null;
try { geoip = require('geoip-lite'); } catch (e) {
    console.warn('[Tracking] geoip-lite not installed — visitor geo lookup disabled');
}

// ISO-3166 alpha-2 → English name via Node's built-in ICU data.
let regionNames = null;
try { regionNames = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) { /* older Node */ }

function countryName(code) {
    if (!code) return null;
    try { return regionNames ? regionNames.of(code) : code; } catch (e) { return code; }
}

// ========== Bot detection (moved from server.js, unchanged logic) ==========
function isBot(req) {
    var ua = req.headers['user-agent'] || '';
    var lowerUa = ua.toLowerCase();

    // 1. Known bot/crawler strings
    if (/bot|crawl|spider|slurp|scrape|scan|fetch|libcurl|wget|curl|python-requests|httpclient| okhttp|axios|node-fetch|undici|phantomjs|headless|selenium|puppeteer|playwright|apifox|postman|insomnia|ahrefs|semrush|majestic|moz|blexbot|dotbot|rogerbot|bingpreview|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|slackbot|applebot|yandex|baidu|sogou|exabot|nutch|jakarta|guzzlehttp|java\//i.test(ua)) return true;

    // 2. Very short or empty UA (most real browsers send 80+ chars)
    if (!ua || ua.length < 30) return true;

    // 3. Missing critical headers real browsers always send
    if (!req.headers['accept-language']) return true;
    if (!req.headers['accept']) return true;

    // 4. Real browsers send Accept: text/html, application/xhtml+xml
    var accept = req.headers['accept'] || '';
    if (!accept.includes('text/html')) return true;

    // 5. Known headless/browser automation markers
    if (lowerUa.includes('headless') || lowerUa.includes('selenium') || lowerUa.includes('webdriver')) return true;

    return false;
}

// ========== User-Agent parsing ==========
function parseUserAgent(ua) {
    ua = String(ua || '');
    var browser = 'Other', version = null, os = 'Other', device = 'desktop';
    var m;

    // Browser — order matters (Chrome UA contains "Safari", Edge contains "Chrome"…)
    if ((m = ua.match(/Edg(?:e|A|iOS)?\/([\d.]+)/))) { browser = 'Edge'; version = m[1]; }
    else if ((m = ua.match(/SamsungBrowser\/([\d.]+)/))) { browser = 'Samsung Internet'; version = m[1]; }
    else if ((m = ua.match(/(?:OPR|Opera)\/([\d.]+)/))) { browser = 'Opera'; version = m[1]; }
    else if ((m = ua.match(/YaBrowser\/([\d.]+)/))) { browser = 'Yandex'; version = m[1]; }
    else if ((m = ua.match(/Firefox\/([\d.]+)/))) { browser = 'Firefox'; version = m[1]; }
    else if ((m = ua.match(/FxiOS\/([\d.]+)/))) { browser = 'Firefox'; version = m[1]; }
    else if ((m = ua.match(/CriOS\/([\d.]+)/))) { browser = 'Chrome'; version = m[1]; }
    else if ((m = ua.match(/Chrome\/([\d.]+)/))) { browser = 'Chrome'; version = m[1]; }
    else if (/Safari\//.test(ua) && (m = ua.match(/Version\/([\d.]+)/))) { browser = 'Safari'; version = m[1]; }
    else if ((m = ua.match(/MSIE ([\d.]+)|Trident\/.*rv:([\d.]+)/))) { browser = 'IE'; version = m[1] || m[2]; }

    // OS
    if (/Windows NT 10/.test(ua)) os = 'Windows 10/11';
    else if (/Windows NT 6\.3/.test(ua)) os = 'Windows 8.1';
    else if (/Windows NT 6\.1/.test(ua)) os = 'Windows 7';
    else if (/Windows/.test(ua)) os = 'Windows';
    else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
    else if (/Mac OS X/.test(ua)) os = 'macOS';
    else if (/Android/.test(ua)) os = 'Android';
    else if (/CrOS/.test(ua)) os = 'ChromeOS';
    else if (/Linux/.test(ua)) os = 'Linux';

    // Device class
    if (/iPad/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) || /Tablet/i.test(ua)) device = 'tablet';
    else if (/Mobi|iPhone|iPod/.test(ua) || (/Android/.test(ua) && /Mobile/.test(ua))) device = 'mobile';

    if (version) version = version.split('.').slice(0, 2).join('.');
    return { browser: browser, version: version, os: os, device: device };
}

// ========== Traffic source classification ==========
function referrerHost(referrer) {
    if (!referrer) return null;
    try { return new URL(referrer).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return null; }
}

function classifySource(referrer, query) {
    query = query || {};
    var utmSource = String(query.utm_source || '').toLowerCase();
    var utmMedium = String(query.utm_medium || '').toLowerCase();
    var host = referrerHost(referrer) || '';

    // Explicit campaign tags win
    if (query.gclid || (utmMedium && /cpc|ppc|paid/.test(utmMedium) && /google/.test(utmSource))) return 'google_ads';
    if (utmSource === 'qr' || utmMedium === 'qr') return 'qr';
    if (utmMedium === 'email' || /mail\.google|outlook\.|mail\.yahoo/.test(host)) return 'email';
    if (/^(gbp|gmb|maps|google_maps)$/.test(utmSource)) return 'google_maps';
    if (utmSource === 'partner' || utmMedium === 'partner') return 'partner';

    if (!host) {
        if (utmSource) return 'referral';
        return 'direct';
    }
    if (/(^|\.)google\./.test(host)) {
        if (/\/maps/.test(referrer)) return 'google_maps';
        return 'google_organic';
    }
    if (/facebook\.com$|^fb\.me$|^fb\.com$/.test(host)) return 'facebook';
    if (/instagram\.com$/.test(host)) return 'instagram';
    if (/tiktok\.com$/.test(host)) return 'tiktok';
    if (/^t\.co$|twitter\.com$|^x\.com$/.test(host)) return 'twitter';
    if (/whatsapp\.com$|^wa\.me$/.test(host)) return 'whatsapp';
    if (/^t\.me$|telegram\.(org|me)$/.test(host)) return 'telegram';
    if (/youtube\.com$|^youtu\.be$/.test(host)) return 'youtube';
    if (/linkedin\.com$|^lnkd\.in$/.test(host)) return 'linkedin';
    if (/bing\.com$|yahoo\.com$|duckduckgo\.com$|yandex\.|baidu\.com$/.test(host)) return 'organic_other';
    if (/eliteauto\.rent$/.test(host)) return 'internal';
    return 'referral';
}

// ========== Helpers ==========
function parseCookies(req) {
    var cookies = {};
    (req.headers.cookie || '').split(';').forEach(function (c) {
        var idx = c.indexOf('=');
        if (idx > 0) cookies[c.slice(0, idx).trim()] = c.slice(idx + 1).trim();
    });
    return cookies;
}

function clientIp(req) {
    var ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    if (ip.includes(',')) ip = ip.split(',')[0].trim();
    return ip.replace(/^::ffff:/, '');
}

function lookupGeo(ip) {
    if (!geoip || !ip) return null;
    try {
        var g = geoip.lookup(ip);
        if (!g) return null;
        return {
            country_code: g.country || null,
            country: countryName(g.country),
            region: g.region || null,
            city: g.city || null,
            timezone: g.timezone || null,
            latitude: (g.ll && g.ll[0]) != null ? g.ll[0] : null,
            longitude: (g.ll && g.ll[1]) != null ? g.ll[1] : null
        };
    } catch (e) { return null; }
}

function primaryLanguage(req) {
    var al = req.headers['accept-language'] || '';
    var first = al.split(',')[0].trim();
    if (!first) return null;
    return first.split(';')[0].substring(0, 12) || null;
}

// Pages we track: real page loads, not assets/API.
function isTrackablePath(p) {
    return p === '/' || p === '/he' || p === '/he/' || p.endsWith('.html');
}

// ========== Middleware ==========
function middleware(getPool) {
    return function (req, res, next) {
        try {
            if (req.method !== 'GET') return next();
            var p = req.path;
            if (!isTrackablePath(p)) return next();

            var bot = isBot(req);
            var ua = req.headers['user-agent'] || '';
            var cookies = parseCookies(req);

            var setCookies = [];
            var vid = cookies['vid'];
            var isNew = 0;
            if (!vid) {
                vid = crypto.randomBytes(12).toString('hex');
                isNew = 1;
                setCookies.push('vid=' + vid + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000');
            }
            // Rolling 30-minute session — refreshed on every pageview.
            var sid = cookies['sid'];
            if (!sid || !/^[a-f0-9]{16,32}$/.test(sid)) sid = crypto.randomBytes(10).toString('hex');
            setCookies.push('sid=' + sid + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=1800');
            for (var i = 0; i < setCookies.length; i++) res.append('Set-Cookie', setCookies[i]);

            var pool = getPool();
            if (pool) {
                var ip = clientIp(req);
                var geo = bot ? null : lookupGeo(ip);
                var parsed = parseUserAgent(ua);
                var referrer = req.headers['referer'] || '';
                pool.query(
                    `INSERT INTO page_visits
                        (page, ip, user_agent, referrer, visitor_id, is_bot, session_id,
                         country, country_code, city, region, timezone, latitude, longitude,
                         browser, browser_version, os, device, language, source, referrer_host, is_new)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
                    [
                        p, ip, ua.substring(0, 500), referrer.substring(0, 500), vid, bot ? 1 : 0, sid,
                        geo ? geo.country : null, geo ? geo.country_code : null, geo ? geo.city : null,
                        geo ? geo.region : null, geo ? geo.timezone : null, geo ? geo.latitude : null,
                        geo ? geo.longitude : null,
                        parsed.browser, parsed.version, parsed.os, bot ? 'bot' : parsed.device,
                        primaryLanguage(req), classifySource(referrer, req.query), referrerHost(referrer), isNew
                    ]
                ).catch(function () {});
            }
        } catch (e) { /* tracking must never break page delivery */ }
        next();
    };
}

// ========== /api/verify-human ==========
// Client-side JS ping after page load: proves a real browser (bots rarely run JS)
// and enriches recent rows with screen size / client timezone / UI language.
function verifyHumanHandler(getPool) {
    return function (req, res) {
        var cookies = parseCookies(req);
        var vid = cookies['vid'];
        if (!vid) return res.json({ ok: false });

        var screen = null, tz = null;
        if (req.body && typeof req.body === 'object') {
            if (typeof req.body.screen === 'string' && /^\d{2,5}x\d{2,5}$/.test(req.body.screen)) screen = req.body.screen;
            if (typeof req.body.tz === 'string' && req.body.tz.length <= 64 && /^[\w+\-\/ ]+$/.test(req.body.tz)) tz = req.body.tz;
        }

        var pool = getPool();
        if (pool) {
            pool.query(
                `UPDATE page_visits SET is_verified = 1,
                        screen = COALESCE($2, screen),
                        timezone = COALESCE($3, timezone)
                 WHERE visitor_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
                [vid, screen, tz]
            ).catch(function () {});
        }
        res.json({ ok: true });
    };
}

// For routes that want to attribute an action (e.g. a booking) to the visitor.
function getVisitorId(req) {
    var vid = parseCookies(req)['vid'];
    return (vid && /^[a-f0-9]{16,32}$/.test(vid)) ? vid : null;
}

module.exports = {
    isBot, parseUserAgent, classifySource, lookupGeo, countryName,
    middleware, verifyHumanHandler, getVisitorId, clientIp
};
