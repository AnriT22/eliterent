const fs = require('fs');
const path = require('path');
const { queryAll } = require('./db-helpers');

const ROOT = path.join(__dirname, '..');
const MARKER_VEHICLES = '<!-- SEO_PRERENDER_VEHICLES -->';
const MARKER_REVIEWS = '<!-- SEO_PRERENDER_REVIEWS -->';

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
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

function buildVehicleSeoHtml(vehicles) {
    if (!vehicles.length) {
        return '<p class="seo-crawlable-empty">Browse verified rental cars in Tbilisi, Batumi, and Kutaisi from local partners. Listings update as partners add vehicles.</p>';
    }
    var items = vehicles.map(function (v) {
        var name = escapeHtml(v.name || 'Rental car');
        var city = escapeHtml(v.location_city || 'Georgia');
        var price = v.price_per_day ? '$' + v.price_per_day + '/day' : '';
        var cat = escapeHtml((v.category || '').replace(/_/g, ' '));
        var img = v.image_url ? escapeHtml(v.image_url) : '';
        var imgTag = img
            ? '<img src="' + img + '" alt="' + name + ' rental in ' + city + ', Georgia" width="400" height="240" loading="lazy">'
            : '';
        return '<article class="seo-vehicle-card">'
            + (imgTag ? '<a href="/vehicle.html?id=' + v.id + '">' + imgTag + '</a>' : '')
            + '<h2><a href="/vehicle.html?id=' + v.id + '">' + name + '</a></h2>'
            + '<p>' + [cat, city, price].filter(Boolean).join(' · ') + '</p>'
            + '</article>';
    }).join('\n');
    return '<div class="seo-crawlable-fleet" aria-label="Available rental cars">'
        + '<h2 class="seo-crawlable-heading">Available rental cars in Georgia</h2>'
        + '<div class="seo-crawlable-grid">' + items + '</div>'
        + '</div>';
}

function buildReviewsSeoHtml(reviews) {
    if (!reviews.length) {
        return '<p class="seo-crawlable-empty">Customer reviews appear here after completed rentals. Book a car and share your experience.</p>';
    }
    var items = reviews.map(function (r) {
        var stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
        var title = r.title ? '<h3>' + escapeHtml(r.title) + '</h3>' : '';
        var vehicle = r.vehicle_name ? '<p class="seo-review-vehicle">Vehicle: ' + escapeHtml(r.vehicle_name) + '</p>' : '';
        return '<article class="seo-review-card">'
            + '<p class="seo-review-meta"><strong>' + escapeHtml(r.guest_name || 'Guest') + '</strong> · ' + stars + '</p>'
            + title
            + '<p>' + escapeHtml((r.body || '').substring(0, 500)) + '</p>'
            + vehicle
            + '</article>';
    }).join('\n');
    return '<div class="seo-crawlable-reviews" aria-label="Customer reviews">'
        + '<h2 class="seo-crawlable-heading">Customer reviews</h2>'
        + items
        + '</div>';
}

function buildItemListJson(vehicles) {
    var elements = vehicles.slice(0, 10).map(function (v, i) {
        return {
            '@type': 'ListItem',
            position: i + 1,
            name: v.name || 'Rental car',
            url: 'https://eliteauto.rent/vehicle.html?id=' + v.id
        };
    });
    return JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Rental Cars in Georgia',
        description: 'Browse rental cars in Georgia from verified partners.',
        url: 'https://eliteauto.rent/vehicles.html',
        numberOfItems: vehicles.length,
        itemListElement: elements
    });
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
    var fleetHtml = buildVehicleSeoHtml(vehicles);
    if (html.includes(MARKER_VEHICLES)) {
        html = html.replace(MARKER_VEHICLES, fleetHtml);
    }
    var itemListJson = buildItemListJson(vehicles);
    html = html.replace(
        /<script type="application\/ld\+json">\s*\{[^<]*"@type":\s*"ItemList"[^<]*\}\s*<\/script>/,
        '<script type="application/ld+json">' + itemListJson + '</script>'
    );
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

async function middleware(req, res, next) {
    try {
        var html;
        if (req.path === '/vehicles.html') {
            html = await renderVehiclesPage();
        } else if (req.path === '/reviews.html') {
            html = await renderReviewsPage();
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

module.exports = { middleware, fetchActiveVehicles, fetchPublicReviews };
