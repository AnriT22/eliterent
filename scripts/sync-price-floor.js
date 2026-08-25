#!/usr/bin/env node
/* ============================================================================
 * sync-price-floor.js — keep advertised "from $X/day" claims true.
 *
 * WHY THIS EXISTS
 * The site shipped "from $25/day" across 30+ HTML files, four language packs
 * and the server-side SEO renderer while the cheapest live car was $39. Every
 * ad, snippet and Google Business product built on that number broke the
 * moment a visitor clicked. It is also the fastest route to a Google Ads
 * "misleading pricing" disapproval. Hardcoded price claims go stale silently —
 * this script makes them fail loudly instead.
 *
 * WHAT IT DOES
 *   node scripts/sync-price-floor.js          → report only (exit 1 if a claim
 *                                               is below the real floor)
 *   node scripts/sync-price-floor.js --write  → rewrite the offending claims
 *
 * It reads MIN(price_per_day) from the live vehicles table (overall and per
 * category), then scans every .html plus lang/*.json for "$N/day"-style claims
 * and flags any that promise less than the fleet can deliver. Claims are only
 * ever raised, never lowered — an over-cautious claim is a marketing choice,
 * an under-cautious one is a trust and compliance problem.
 *
 * Run it in CI, or before any campaign launch.
 * ========================================================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WRITE = process.argv.includes('--write');

// Landing pages whose headline claim is about ONE category, not the whole fleet.
const CATEGORY_PAGES = {
    'suv-rental-georgia.html': 'suv',
    'sedan-rental-georgia.html': 'sedan',
    'luxury-car-rental-tbilisi.html': 'luxury',
    'minivan-7-seater-rental-georgia.html': 'minivan',
    'economy-car-rental-georgia.html': 'economy',
    'cheap-car-rental-georgia.html': 'economy',
    'automatic-car-rental-georgia.html': 'economy'
};

// Money phrases we police. Anything matching is a public price promise.
const CLAIM = /\$(\d{1,4})(?=\s*(?:\/\s*day|\s*\/\s*дн|\s*ליום|\s*\/\s*день|\s*\/\s*დღე|<\/strong>\s*<span>\s*\/day))/g;

function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', '.git', '.seo-engine', 'uploads', 'data'].includes(e.name)) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.name.endsWith('.html') || (e.name.endsWith('.json') && p.includes(`${path.sep}lang${path.sep}`))) out.push(p);
    }
    return out;
}

async function readFloors() {
    let pool;
    try { pool = require('../server/db').getPool(); } catch (e) { /* no db module */ }
    if (!pool) throw new Error('No database pool — run this on the server, or set DATABASE_URL.');
    const overall = await pool.query(
        "SELECT MIN(price_per_day)::numeric AS floor FROM vehicles WHERE is_active = true AND price_per_day > 0"
    );
    const byCat = await pool.query(
        "SELECT LOWER(category) AS category, MIN(price_per_day)::numeric AS floor FROM vehicles " +
        "WHERE is_active = true AND price_per_day > 0 GROUP BY LOWER(category)"
    );
    const cats = {};
    for (const r of byCat.rows) cats[r.category] = Math.ceil(Number(r.floor));
    return { overall: Math.ceil(Number(overall.rows[0].floor)), cats };
}

(async () => {
    const { overall, cats } = await readFloors();
    console.log(`Live floor: $${overall}/day overall`);
    Object.entries(cats).sort().forEach(([c, v]) => console.log(`             $${v}/day  ${c}`));
    console.log('');

    let violations = 0, fixed = 0;
    for (const file of walk(ROOT)) {
        const rel = path.relative(ROOT, file);
        const base = path.basename(file);
        const floor = cats[CATEGORY_PAGES[base]] || overall;
        const src = fs.readFileSync(file, 'utf8');
        const hits = [];
        const next = src.replace(CLAIM, (m, n) => {
            const v = parseInt(n, 10);
            if (v >= floor) return m;
            hits.push(`$${v} → $${floor}`);
            return `$${floor}`;
        });
        if (!hits.length) continue;
        violations += hits.length;
        console.log(`${WRITE ? 'FIXED ' : 'BELOW '} ${rel}  (floor $${floor})  ${hits.join(', ')}`);
        if (WRITE) { fs.writeFileSync(file, next); fixed += hits.length; }
    }

    console.log('');
    if (!violations) { console.log('✓ every advertised price is supported by live inventory'); process.exit(0); }
    if (WRITE) { console.log(`✓ raised ${fixed} claim(s) to the real floor. Review the diff, then commit + deploy.`); process.exit(0); }
    console.log(`✗ ${violations} price claim(s) promise less than the fleet offers. Re-run with --write to fix.`);
    process.exit(1);
})().catch(e => { console.error('sync-price-floor:', e.message); process.exit(2); });
