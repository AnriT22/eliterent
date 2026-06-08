const fs = require('fs');
const path = require('path');
const { queryAll } = require('./db-helpers');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://eliteauto.rent';
const MARKER_VEHICLES = '<!-- SEO_PRERENDER_VEHICLES -->';
const MARKER_REVIEWS = '<!-- SEO_PRERENDER_REVIEWS -->';
const MARKER_HOME = '<!-- SEO_PRERENDER_HOME_FLEET -->';

// ---------------------------------------------------------------------------
// Source-of-truth data for crawlable fallbacks.
// "from" prices and URLs MUST stay in sync with the type/city landing pages
// (economy $25, sedan $30, suv $50, minivan $45, luxury $80). No invented numbers.
//
// IMPORTANT (anti-cloaking): every block produced here is rendered for ALL
// visitors, never only for crawlers. Search engines and users must see the
// same content. There is NO fabricated-review fallback — reviews come solely
// from real database rows, rendered client-side identically for bots and users.
// ---------------------------------------------------------------------------
const CATEGORIES = [
    { name: 'Economy cars', url: '/economy-car-rental-georgia.html', from: 25, blurb: 'Fuel-efficient hatchbacks & compacts' },
    { name: 'Sedans', url: '/sedan-rental-georgia.html', from: 30, blurb: 'Comfortable cars for business & highways' },
    { name: 'SUV & 4x4', url: '/suv-rental-georgia.html', from: 50, blurb: 'Mountain-ready for Kazbegi & Svaneti' },
    { name: '7-seater & minivan', url: '/minivan-7-seater-rental-georgia.html', from: 45, blurb: 'Space for families & groups' },
    { name: 'Luxury & executive', url: '/luxury-car-rental-tbilisi.html', from: 80, blurb: 'Mercedes, BMW & Range Rover' }
];

const CITIES = [
    { name: 'Tbilisi', url: '/rent-car-tbilisi.html' },
    { name: 'Tbilisi Airport (TBS)', url: '/tbilisi-airport-car-rental.html' },
    { name: 'Batumi', url: '/rent-car-batumi.html' },
    { name: 'Kutaisi', url: '/rent-car-kutaisi.html' },
    { name: 'No-deposit rentals', url: '/no-deposit-car-rental-georgia.html' }
];

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// On-brand styles for the injected homepage browse block (rendered for ALL visitors).
const SEO_STYLES = '<style>'
    + '.seo-crawlable{max-width:1200px;margin:0 auto;padding:0 16px;color:#EAEAEA;font-family:inherit}'
    + '.seo-crawlable-heading{font-size:20px;font-weight:800;margin:24px 0 4px;color:#EAEAEA}'
    + '.seo-crawlable-sub{color:#A0A3B0;font-size:14px;line-height:1.6;margin:0 0 16px;max-width:820px}'
    + '.seo-cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin:0 0 8px}'
    + '.seo-cat-card{display:block;background:#1C1E26;border:1px solid #3A3F4B;border-radius:14px;padding:16px 18px;text-decoration:none;color:#EAEAEA;transition:border-color .2s}'
    + '.seo-cat-card:hover{border-color:#D4AF37}'
    + '.seo-cat-card .t{font-weight:700;font-size:15px;margin-bottom:4px}'
    + '.seo-cat-card .p{color:#D4AF37;font-weight:700;font-size:14px}'
    + '.seo-cat-card .b{color:#A0A3B0;font-size:12.5px;margin-top:4px}'
    + '.seo-city-links{display:flex;flex-wrap:wrap;gap:10px;margin:8px 0 24px;list-style:none;padding:0}'
    + '.seo-city-links a{display:inline-block;background:#262A35;border:1px solid #3A3F4B;border-radius:999px;padding:8px 16px;color:#EAEAEA;text-decoration:none;font-size:13.5px}'
    + '.seo-city-links a:hover{border-color:#D4AF37;color:#D4AF37}'
    + '</style>';

function categoryGridHtml() {
    var cards = CATEGORIES.map(function (c) {
        return '<a class="seo-cat-card" href="' + c.url + '">'
            + '<div class="t">' + escapeHtml(c.name) + '</div>'
            + '<div class="p">from $' + c.from + '/day</div>'
            + '<div class="b">' + escapeHtml(c.blurb) + '</div>'
            + '</a>';
    }).join('');
    return '<div class="seo-cat-grid">' + cards + '</div>';
}

function cityLinksHtml() {
    return '<ul class="seo-city-links">'
        + CITIES.map(function (c) { return '<li><a href="' + c.url + '">Rent a car in ' + escapeHtml(c.name) + '</a></li>'; }).join('')
        + '</ul>';
}

// A reusable, always-present crawlable block: intro + category cards + city links.
// Used on the homepage and served to EVERY visitor (not cloaking).
function browseBlockHtml(introText) {
    return SEO_STYLES
        + '<section class="seo-crawlable" aria-label="Browse rental cars in Georgia">'
        + '<p class="seo-crawlable-sub">' + introText + '</p>'
        + '<h2 class="seo-crawlable-heading">Browse rental cars by type</h2>'
        + categoryGridHtml()
        + '<h2 class="seo-crawlable-heading">Rent a car by city</h2>'
        + cityLinksHtml()
        + '</section>';
}

// ItemList for /vehicles.html. Uses live vehicles when available, otherwise
// lists the category landing pages so the page is never "0 items".
function buildItemListJson(vehicles) {
    var elements, name;
    if (vehicles && vehicles.length) {
        name = 'Rental Cars in Georgia';
        elements = vehicles.slice(0, 10).map(function (v, i) {
            return {
                '@type': 'ListItem',
                position: i + 1,
                name: v.name || 'Rental car',
                url: SITE + '/vehicle.html?id=' + v.id
            };
        });
    } else {
        name = 'Rental car categories in Georgia';
        elements = CATEGORIES.map(function (c, i) {
            return {
                '@type': 'ListItem',
                position: i + 1,
                name: c.name + ' rental in Georgia',
                url: SITE + c.url
            };
        });
    }
    return JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: name,
        description: 'Browse rental cars in Georgia from verified partners.',
        url: SITE + '/vehicles.html',
        numberOfItems: elements.length,
        itemListElement: elements
    });
}

function injectItemList(html, vehicles) {
    var itemListJson = buildItemListJson(vehicles);
    return html.replace(
        /<script type="application\/ld\+json">\s*\{[^<]*"@type":\s*"ItemList"[^<]*\}\s*<\/script>/,
        '<script type="application/ld+json">' + itemListJson + '</script>'
    );
}

async function fetchActiveVehicles(limit) {
    return queryAll(
        `SELECT v.id, v.name, v.price_per_day, v.location_city, v.category, v.image_url,
                v.year, v.seats, v.engine, v.gearbox, v.drive_type, v.interior_type,
                v.steering_side, v.payment_method, v.priority, v.created_at,
                pp.company_name
         FROM vehicles v
         JOIN users u ON v.partner_id = u.id
         LEFT JOIN partner_profiles pp ON u.id = pp.user_id
         WHERE v.status = 'active' AND pp.is_verified = 1
         ORDER BY COALESCE(v.priority, 0) DESC, v.created_at DESC
         LIMIT $1`,
        [limit || 24]
    );
}

// Server-rendered car cards injected INTO #vpGrid. The page's own inline JS does
// `grid.innerHTML = ''` and rebuilds the interactive cards from /api/vehicles on
// load, so these are cleanly replaced for JS users (no duplication, booking/filters
// untouched). For crawlers and no-JS users they ARE the content: real car data +
// real <a href="/vehicle.html?id=N"> links so each vehicle page is discoverable.
// Markup mirrors the JS `.vc-card` (incl. data-* filter attributes) so the page's
// applyFilters() treats them correctly if it runs before hydration.
function buildVehicleCardsHtml(vehicles) {
    if (!vehicles || !vehicles.length) return '';
    return vehicles.map(function (v) {
        var name = escapeHtml(v.name || 'Rental car');
        var city = escapeHtml(v.location_city || 'Georgia');
        var cat = escapeHtml(String(v.category || 'economy').toLowerCase());
        var engine = String(v.engine || '').toLowerCase();
        var gearbox = String(v.gearbox || '').toLowerCase();
        var drive = String(v.drive_type || '').toLowerCase();
        var price = v.price_per_day || 0;
        var year = v.year || '';
        var seats = v.seats || 5;
        var partner = v.company_name ? escapeHtml(v.company_name) : '';
        var href = '/vehicle.html?id=' + encodeURIComponent(v.id);
        var img = v.image_url ? escapeHtml(v.image_url) : '';
        var imgTag = img
            ? '<img src="' + img + '" alt="' + name + ' rental in ' + city + ', Georgia" width="400" height="240" loading="lazy">'
            : '';
        function spec(s) { return s ? '<span class="vc-spec">' + escapeHtml(s.replace(/_/g, ' ')) + '</span>' : ''; }
        return '<div class="vc-card" data-id="' + v.id + '"'
            + ' data-category="' + cat + '" data-engine="' + escapeHtml(engine) + '"'
            + ' data-gearbox="' + escapeHtml(gearbox) + '" data-drive="' + escapeHtml(drive) + '"'
            + ' data-interior="' + escapeHtml(String(v.interior_type || 'fabric').toLowerCase()) + '"'
            + ' data-steering="' + escapeHtml(String(v.steering_side || 'left').toLowerCase()) + '"'
            + ' data-payment="' + escapeHtml(String(v.payment_method || 'cash').toLowerCase()) + '"'
            + ' data-year="' + year + '" data-price="' + price + '" data-name="' + name + '"'
            + ' data-priority="' + (v.priority || 0) + '" data-created="' + escapeHtml(String(v.created_at || '')) + '">'
            + '<a class="vc-image-wrap" href="' + href + '">' + imgTag + (year ? '<span class="vc-year-badge">' + year + '</span>' : '') + '</a>'
            + '<div class="vc-body">'
            + '<div class="vc-title-row"><a class="vc-name" href="' + href + '">' + name + '</a><span class="vc-category-tag ' + cat + '">' + cat + '</span></div>'
            + '<div class="vc-specs">' + spec(engine) + spec(gearbox) + '<span class="vc-spec">' + seats + ' Seats</span>' + spec(drive) + '</div>'
            + '<div class="vc-price-section">'
            + '<div class="vc-price-row"><span class="vc-price-label">Price per day:</span> <span class="vc-price-amount" data-price-usd="' + price + '">$' + price + '</span><span class="vc-price-unit">/day</span></div>'
            + '<a class="vc-book-btn" href="' + href + '">Book Now</a>'
            + (partner ? '<div class="vc-partner-name">by ' + partner + '</div>' : '')
            + '</div></div>';
    }).join('');
}

// /vehicles.html — the live car grid renders client-side from /api/vehicles for
// everyone. We do NOT inject a bot-only listing (no cloaking); we only strip the
// marker and keep the ItemList schema accurate to real inventory when it exists.
// (Full server-rendering of the grid for all visitors is tracked as S-01.)
async function renderVehiclesPage() {
    var filePath = path.join(ROOT, 'vehicles.html');
    var html = fs.readFileSync(filePath, 'utf8');
    var vehicles = [];
    try {
        vehicles = await fetchActiveVehicles(24);
    } catch (e) {
        console.error('[SEO] vehicles fetch:', e.message);
    }
    // Inject real cars into #vpGrid (the marker sits inside it). The page's JS
    // wipes + rebuilds the grid on load, so this is identical for bots and users.
    html = html.replace(MARKER_VEHICLES, buildVehicleCardsHtml(vehicles));
    html = injectItemList(html, vehicles);
    return html;
}

// /reviews.html — reviews render client-side from real /api/reviews rows for
// everyone (bots and users alike). There is NO fabricated fallback and no
// bot-only content. Real server-rendered reviews are tracked as S-02.
async function renderReviewsPage() {
    var filePath = path.join(ROOT, 'reviews.html');
    var html = fs.readFileSync(filePath, 'utf8');
    return html.replace(MARKER_REVIEWS, '');
}

// Homepage: inject a crawlable category + city block where the JS-only fleet
// carousel sits, so the top page exposes real internal links and intent text.
// Served to ALL visitors (navigation, not duplicative) — not cloaking.
async function renderHomePage() {
    var filePath = path.join(ROOT, 'index.html');
    var html = fs.readFileSync(filePath, 'utf8');
    if (html.includes(MARKER_HOME)) {
        var intro = 'EliteAuto.rent is a car rental marketplace for Georgia. Compare economy cars, sedans, SUVs and 4x4s, 7-seater minivans and luxury vehicles from verified local partners, with airport pickup in Tbilisi, Batumi and Kutaisi.';
        html = html.replace(MARKER_HOME, browseBlockHtml(intro));
    }
    return html;
}

// Middleware: serves the homepage browse block and the vehicles listing (with
// real cars server-rendered into #vpGrid) — both IDENTICAL for every visitor,
// no User-Agent branching anywhere (no cloaking). /reviews.html is intentionally
// NOT handled (real reviews render client-side; S-02). renderReviewsPage remains
// exported for i18n-render's /ru//ka/ path.
async function middleware(req, res, next) {
    try {
        var html;
        if (req.path === '/' || req.path === '/index.html') {
            html = await renderHomePage();
        } else if (req.path === '/vehicles.html') {
            // Real cars server-rendered into the grid for ALL visitors (not cloaking);
            // the page's JS rebuilds the interactive grid on load.
            html = await renderVehiclesPage();
        } else {
            return next();
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.send(html);
    } catch (err) {
        console.error('[SEO] prerender error:', err.message);
        next();
    }
}

module.exports = {
    middleware,
    fetchActiveVehicles,
    renderVehiclesPage,
    renderReviewsPage,
    renderHomePage
};
