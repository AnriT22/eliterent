// Technical SEO monitor — audits the site's public HTML pages on demand.
// Pure regex scanning of the static files (no DOM library, no network), cached
// for 10 minutes so the admin tab can refresh freely without disk churn.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// App/auth/checkout pages are intentionally excluded: they are not SEO surfaces
// and several are client-side gated, so "missing description" there is noise.
const EXCLUDE = new Set([
    'admin.html', 'login.html', 'register.html', 'register-partner.html',
    'reset-password.html', 'verify-phone.html', 'guest-profile.html',
    'partner-dashboard.html', 'partner-financials.html', 'payment.html',
    'booking.html', 'reservation.html', 'google-auth-success.html',
    'leave-a-review.html', '404.html', 'RoyalCar_Guide_GEO.html',
    '85a9e1a5-97ae-4d57-8987-f00c8fd0da3e.html'
]);

// Pretty URLs served by redirects in server.js — valid link targets.
const KNOWN_ROUTES = new Set([
    '/', '/sitemap.xml', '/robots.txt',
    '/rent-a-car/tbilisi', '/rent-a-car/batumi', '/rent-a-car/kutaisi',
    '/rent-a-car/tbilisi-airport', '/car-rental/suv', '/car-rental/economy',
    '/car-rental/sedan', '/car-rental/luxury', '/car-rental/minivan', '/no-deposit'
]);

// Localized routes served dynamically by i18n-render (/ru/, /ka/, /he/ funnel
// pages) — valid link targets even though no file exists on disk.
try {
    const i18n = require('./i18n-render');
    (i18n.LANGS || []).forEach(function (lang) {
        KNOWN_ROUTES.add('/' + lang);
        KNOWN_ROUTES.add('/' + lang + '/');
        Object.keys(i18n.LOCALIZABLE || {}).forEach(function (p) {
            if (p) KNOWN_ROUTES.add('/' + lang + '/' + p);
        });
    });
} catch (e) { /* audit still works without the localizer */ }

let cache = { report: null, ts: 0 };
const CACHE_MS = 10 * 60 * 1000;

function attr(tag, name) {
    var m = tag.match(new RegExp(name + '\\s*=\\s*(["\'])([\\s\\S]*?)\\1', 'i'));
    return m ? m[2].trim() : null;
}

function listPublicPages() {
    var pages = [];
    fs.readdirSync(ROOT).forEach(function (f) {
        if (f.endsWith('.html') && !f.startsWith('_') && !EXCLUDE.has(f)) pages.push(f);
    });
    var heDir = path.join(ROOT, 'he');
    if (fs.existsSync(heDir)) {
        fs.readdirSync(heDir).forEach(function (f) {
            if (f.endsWith('.html') && !f.startsWith('_')) pages.push('he/' + f);
        });
    }
    return pages;
}

function auditPage(rel, allFiles) {
    var html;
    try { html = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { return null; }

    var page = { page: '/' + rel.replace(/\\/g, '/'), issues: [] };

    var tm = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    page.title = tm ? tm[1].replace(/\s+/g, ' ').trim() : null;
    if (!page.title) page.issues.push({ type: 'missing_title', severity: 'high', detail: 'No <title> tag' });
    else if (page.title.length < 25) page.issues.push({ type: 'short_title', severity: 'medium', detail: 'Title only ' + page.title.length + ' chars (aim for 30–60)' });
    else if (page.title.length > 65) page.issues.push({ type: 'long_title', severity: 'low', detail: 'Title ' + page.title.length + ' chars — may truncate in results (aim for 30–60)' });

    var dm = html.match(/<meta\b[^>]*name\s*=\s*["']description["'][^>]*>/i);
    page.description = dm ? (attr(dm[0], 'content') || '') : null;
    if (!page.description) page.issues.push({ type: 'missing_description', severity: 'high', detail: 'No meta description' });
    else if (page.description.length < 70) page.issues.push({ type: 'short_description', severity: 'medium', detail: 'Description only ' + page.description.length + ' chars (aim for 70–160)' });
    else if (page.description.length > 170) page.issues.push({ type: 'long_description', severity: 'low', detail: 'Description ' + page.description.length + ' chars — will truncate (aim for 70–160)' });

    var h1s = html.match(/<h1[\s>]/gi) || [];
    page.h1Count = h1s.length;
    if (h1s.length === 0) page.issues.push({ type: 'missing_h1', severity: 'high', detail: 'No <h1> heading' });
    else if (h1s.length > 1) page.issues.push({ type: 'multiple_h1', severity: 'low', detail: h1s.length + ' <h1> headings (best practice: exactly one)' });

    var cm = html.match(/<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*>/i);
    page.canonical = cm ? attr(cm[0], 'href') : null;
    if (!page.canonical) page.issues.push({ type: 'missing_canonical', severity: 'medium', detail: 'No canonical link' });

    var rm = html.match(/<meta\b[^>]*name\s*=\s*["']robots["'][^>]*>/i);
    page.robotsMeta = rm ? attr(rm[0], 'content') : null;
    if (page.robotsMeta && /noindex/i.test(page.robotsMeta)) {
        page.issues.push({ type: 'noindex', severity: 'high', detail: 'Page is set to noindex — it cannot rank' });
    }

    page.hasViewport = /<meta\b[^>]*name\s*=\s*["']viewport["']/i.test(html);
    if (!page.hasViewport) page.issues.push({ type: 'missing_viewport', severity: 'medium', detail: 'No viewport meta — fails mobile usability' });

    page.hasStructuredData = /application\/ld\+json/i.test(html);

    var imgs = html.match(/<img\b[^>]*>/gi) || [];
    var missingAlt = 0;
    imgs.forEach(function (tag) { if (!/\balt\s*=/i.test(tag)) missingAlt++; });
    page.images = imgs.length;
    page.imagesMissingAlt = missingAlt;
    if (missingAlt > 0) page.issues.push({ type: 'missing_alt', severity: 'medium', detail: missingAlt + ' of ' + imgs.length + ' images missing alt text' });

    // Internal links → do the targets exist?
    var broken = [];
    var linkRe = /href\s*=\s*["']([^"']+)["']/gi, lm;
    var seen = new Set();
    while ((lm = linkRe.exec(html)) !== null) {
        var href = lm[1].split('#')[0].split('?')[0].trim();
        if (!href || seen.has(href)) continue;
        seen.add(href);
        if (/^(https?:|mailto:|tel:|javascript:|data:|\/\/)/i.test(href)) continue;
        if (!/\.html$/i.test(href) && !KNOWN_ROUTES.has(href)) continue;
        if (KNOWN_ROUTES.has(href)) continue;
        // Resolve relative to the page's directory
        var target = href.startsWith('/') ? href.slice(1) : path.posix.join(path.posix.dirname(rel.replace(/\\/g, '/')), href);
        if (!allFiles.has(target)) broken.push(href);
    }
    page.brokenLinks = broken;
    if (broken.length > 0) page.issues.push({ type: 'broken_links', severity: 'high', detail: broken.length + ' broken internal link(s): ' + broken.slice(0, 5).join(', ') });

    return page;
}

function runAudit() {
    var pages = listPublicPages();

    // Every real file (any dir depth we care about: root + he/)
    var allFiles = new Set();
    fs.readdirSync(ROOT).forEach(function (f) { if (f.endsWith('.html')) allFiles.add(f); });
    var heDir = path.join(ROOT, 'he');
    if (fs.existsSync(heDir)) fs.readdirSync(heDir).forEach(function (f) { if (f.endsWith('.html')) allFiles.add('he/' + f); });

    var results = [];
    pages.forEach(function (rel) {
        var p = auditPage(rel, allFiles);
        if (p) results.push(p);
    });

    // Duplicate titles / descriptions across pages
    var byTitle = {}, byDesc = {};
    results.forEach(function (p) {
        if (p.title) (byTitle[p.title] = byTitle[p.title] || []).push(p);
        if (p.description) (byDesc[p.description] = byDesc[p.description] || []).push(p);
    });
    Object.keys(byTitle).forEach(function (t) {
        if (byTitle[t].length > 1) {
            byTitle[t].forEach(function (p) {
                p.issues.push({ type: 'duplicate_title', severity: 'high', detail: 'Same title as ' + (byTitle[t].length - 1) + ' other page(s)' });
            });
        }
    });
    Object.keys(byDesc).forEach(function (d) {
        if (byDesc[d].length > 1) {
            byDesc[d].forEach(function (p) {
                p.issues.push({ type: 'duplicate_description', severity: 'medium', detail: 'Same description as ' + (byDesc[d].length - 1) + ' other page(s)' });
            });
        }
    });

    // Site-level checks
    var site = [];
    var robotsPath = path.join(ROOT, 'robots.txt');
    if (!fs.existsSync(robotsPath)) {
        site.push({ type: 'missing_robots', severity: 'high', detail: 'robots.txt not found' });
    } else {
        var robots = fs.readFileSync(robotsPath, 'utf8');
        if (!/sitemap\s*:/i.test(robots)) site.push({ type: 'robots_no_sitemap', severity: 'medium', detail: 'robots.txt has no Sitemap: line' });
        if (/disallow:\s*\/\s*$/im.test(robots)) site.push({ type: 'robots_blocks_all', severity: 'high', detail: 'robots.txt disallows the whole site!' });
    }
    if (!fs.existsSync(path.join(ROOT, 'sitemap.xml'))) {
        site.push({ type: 'missing_sitemap_fallback', severity: 'low', detail: 'No static sitemap.xml fallback (dynamic sitemap route still serves it)' });
    }

    var totalIssues = 0, high = 0, medium = 0, low = 0;
    results.forEach(function (p) {
        p.issues.forEach(function (i) {
            totalIssues++;
            if (i.severity === 'high') high++;
            else if (i.severity === 'medium') medium++;
            else low++;
        });
    });
    site.forEach(function (i) {
        totalIssues++;
        if (i.severity === 'high') high++; else if (i.severity === 'medium') medium++; else low++;
    });

    results.sort(function (a, b) { return b.issues.length - a.issues.length; });

    return {
        generatedAt: new Date().toISOString(),
        pagesScanned: results.length,
        summary: { total: totalIssues, high: high, medium: medium, low: low,
                   healthy: results.filter(function (p) { return p.issues.length === 0; }).length },
        siteIssues: site,
        pages: results
    };
}

function getReport(force) {
    var now = Date.now();
    if (!force && cache.report && (now - cache.ts) < CACHE_MS) return cache.report;
    cache = { report: runAudit(), ts: now };
    return cache.report;
}

module.exports = { getReport };
