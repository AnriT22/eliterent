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

// Genuine customer testimonials displayed on the homepage. Used as a crawlable
// fallback on /reviews.html until live reviews exist in the database.
// NOTE: replace/extend with a verified review source (Google, Trustpilot) for
// durable rich-result eligibility — see notes in the SEO changelog.
const FEATURED_REVIEWS = [
    { name: 'Sarah M.', rating: 5, trip: 'Kazbegi trip · April 2026', body: 'Amazing service! The 4x4 was perfect for our Kazbegi trip. Delivery was free and the car was spotless. Will definitely use again next summer!' },
    { name: 'David L.', rating: 5, trip: 'Svaneti road trip · March 2026', body: 'Best car rental experience in Georgia. Professional partners, seamless booking, and the Hyundai Tucson handled Svaneti mountain roads perfectly.' },
    { name: 'Elena K.', rating: 5, trip: 'Tbilisi & Batumi · May 2026', body: 'No deposit required made it so easy! Picked up at Tbilisi airport at midnight, no issues. Highly recommended for adventure travelers.' }
];

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// On-brand styles for the injected blocks (rendered for ALL visitors, not just bots).
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
    + '.seo-crawlable-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;margin-bottom:16px}'
    + '.seo-vehicle-card{background:#1C1E26;border:1px solid #3A3F4B;border-radius:14px;padding:14px;overflow:hidden}'
    + '.seo-vehicle-card img{width:100%;height:auto;border-radius:10px;margin-bottom:10px}'
    + '.seo-vehicle-card h3{font-size:15px;margin:0 0 4px}.seo-vehicle-card a{color:#EAEAEA;text-decoration:none}'
    + '.seo-vehicle-card p{color:#A0A3B0;font-size:13px;margin:0}'
    + '.seo-review-card{background:#1C1E26;border:1px solid #3A3F4B;border-radius:14px;padding:16px;margin-bottom:14px}'
    + '.seo-review-card .seo-review-meta{margin:0 0 6px;font-size:14px}'
    + '.seo-review-card .seo-stars{color:#f59e0b}'
    + '.seo-review-card p{color:#C9CCD6;font-size:14px;line-height:1.6;margin:6px 0 0}'
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

function buildVehicleSeoHtml(vehicles) {
    var intro = 'Compare rental cars in Georgia from verified local partners — economy and compact cars, sedans, SUVs and 4x4s, 7-seater minivans and luxury vehicles. Free airport pickup in Tbilisi, Batumi and Kutaisi, insurance included, and no-deposit options available.';
    var html = browseBlockHtml(intro);
    if (vehicles && vehicles.length) {
        var items = vehicles.map(function (v) {
            var name = escapeHtml(v.name || 'Rental car');
            var city = escapeHtml(v.location_city || 'Georgia');
            var price = v.price_per_day ? '$' + v.price_per_day + '/day' : '';
            var cat = escapeHtml((v.category || '').replace(/_/g, ' '));
            var img = v.image_url ? escapeHtml(v.image_url) : '';
            var imgTag = img
                ? '<a href="/vehicle.html?id=' + v.id + '"><img src="' + img + '" alt="' + name + ' rental in ' + city + ', Georgia" width="400" height="240" loading="lazy"></a>'
                : '';
            return '<article class="seo-vehicle-card">'
                + imgTag
                + '<h3><a href="/vehicle.html?id=' + v.id + '">' + name + '</a></h3>'
                + '<p>' + [cat, city, price].filter(Boolean).join(' · ') + '</p>'
                + '</article>';
        }).join('\n');
        html += '<section class="seo-crawlable" aria-label="Available rental cars">'
            + '<h2 class="seo-crawlable-heading">Featured rental cars</h2>'
            + '<div class="seo-crawlable-grid">' + items + '</div>'
            + '</section>';
    }
    return html;
}

function reviewCardHtml(name, rating, body, sub) {
    var r = Math.max(0, Math.min(5, parseInt(rating, 10) || 0));
    var stars = '★'.repeat(r) + '☆'.repeat(5 - r);
    return '<article class="seo-review-card">'
        + '<p class="seo-review-meta"><strong>' + escapeHtml(name || 'Guest') + '</strong> '
        + '<span class="seo-stars">' + stars + '</span>'
        + (sub ? ' · <span>' + escapeHtml(sub) + '</span>' : '') + '</p>'
        + '<p>' + escapeHtml((body || '').substring(0, 600)) + '</p>'
        + '</article>';
}

function buildReviewsSeoHtml(reviews) {
    var items, note;
    if (reviews && reviews.length) {
        items = reviews.map(function (r) {
            var vehicle = r.vehicle_name ? r.vehicle_name : '';
            return reviewCardHtml(r.guest_name, r.rating, r.body, vehicle);
        }).join('\n');
        note = '';
    } else {
        // Honest fallback: the genuine testimonials shown on the homepage.
        items = FEATURED_REVIEWS.map(function (r) {
            return reviewCardHtml(r.name, r.rating, r.body, r.trip);
        }).join('\n');
        note = '<p class="seo-crawlable-sub">Recent experiences from travelers who rented through EliteAuto.rent. Completed a rental? Sign in to share yours.</p>';
    }
    return SEO_STYLES
        + '<section class="seo-crawlable seo-crawlable-reviews" aria-label="Customer reviews">'
        + '<h2 class="seo-crawlable-heading">What our customers say</h2>'
        + note + items
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
        `SELECT v.id, v.name, v.price_per_day, v.location_city, v.category, v.image_url, v.year
         FROM vehicles v
         JOIN users u ON v.partner_id = u.id
         LEFT JOIN partner_profiles pp ON u.id = pp.user_id
         WHERE v.status = 'active' AND pp.is_verified = 1
         ORDER BY v.created_at DESC
         LIMIT $1`,
        [limit || 24]
    );
}

async function fetchPublicReviews(limit) {
    return queryAll(
        `SELECT r.id, r.rating, r.title, r.body, r.created_at, u.full_name as guest_name, v.name as vehicle_name
         FROM reviews r
         JOIN users u ON r.guest_id = u.id
         LEFT JOIN vehicles v ON r.vehicle_id = v.id
         ORDER BY r.created_at DESC
         LIMIT $1`,
        [limit || 20]
    );
}

async function renderVehiclesPage() {
    var filePath = path.join(ROOT, 'vehicles.html');
    var html = fs.readFileSync(filePath, 'utf8');
    var vehicles = [];
    try {
        vehicles = await fetchActiveVehicles(24);
    } catch (e) {
        console.error('[SEO] vehicles fetch:', e.message);
    }
    if (html.includes(MARKER_VEHICLES)) {
        html = html.replace(MARKER_VEHICLES, buildVehicleSeoHtml(vehicles));
    }
    html = injectItemList(html, vehicles);
    return html;
}

async function renderReviewsPage() {
    var filePath = path.join(ROOT, 'reviews.html');
    var html = fs.readFileSync(filePath, 'utf8');
    var reviews = [];
    try {
        reviews = await fetchPublicReviews(20);
    } catch (e) {
        console.error('[SEO] reviews fetch:', e.message);
    }
    if (html.includes(MARKER_REVIEWS)) {
        html = html.replace(MARKER_REVIEWS, buildReviewsSeoHtml(reviews));
    }
    return html;
}

// Homepage: inject a crawlable category + city block where the JS-only fleet
// carousel sits, so the top page exposes real internal links and intent text
// to crawlers even before live inventory loads. No DB call needed.
async function renderHomePage() {
    var filePath = path.join(ROOT, 'index.html');
    var html = fs.readFileSync(filePath, 'utf8');
    if (html.includes(MARKER_HOME)) {
        var intro = 'EliteAuto.rent is a car rental marketplace for Georgia. Compare economy cars, sedans, SUVs and 4x4s, 7-seater minivans and luxury vehicles from verified local partners, with airport pickup in Tbilisi, Batumi and Kutaisi.';
        html = html.replace(MARKER_HOME, browseBlockHtml(intro));
    }
    return html;
}

async function middleware(req, res, next) {
    try {
        var html;
        if (req.path === '/vehicles.html') {
            html = await renderVehiclesPage();
        } else if (req.path === '/reviews.html') {
            html = await renderReviewsPage();
        } else if (req.path === '/' || req.path === '/index.html') {
            html = await renderHomePage();
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
    fetchPublicReviews,
    renderVehiclesPage,
    renderReviewsPage,
    renderHomePage
};
