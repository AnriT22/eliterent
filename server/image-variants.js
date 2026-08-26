/* Resize-on-demand for uploaded photos.
 *
 * A vehicle card shows an image at roughly 660 CSS px, but the stored file is up
 * to 1400px wide, so cards were downloading several times the bytes they render.
 * Storing a second copy per size in the database would mean touching every row
 * and every reference, so instead the SAME url gains an optional ?w= hint:
 *
 *     /uploads/vehicles/vehicle_3_123.jpg          -> original, untouched
 *     /uploads/vehicles/vehicle_3_123.jpg?w=700    -> 700px wide, cached variant
 *
 * Anything without ?w= (or with an unlisted width) falls straight through to the
 * normal static handler, so existing links and the admin panel are unaffected.
 *
 * Variants are generated once and cached on disk under uploads/.variants/<w>/.
 * Only a fixed set of widths is allowed — an open-ended ?w= would let anyone fill
 * the disk by requesting thousands of sizes.
 */
'use strict';

const fs = require('fs');
const path = require('path');

let sharp = null;
try { sharp = require('sharp'); } catch (e) { /* handled below */ }

const UPLOADS = path.join(__dirname, '..', 'uploads');
const CACHE = path.join(UPLOADS, '.variants');
const ALLOWED_WIDTHS = [400, 700, 1000];
const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

function variantMiddleware(req, res, next) {
    if (!sharp) return next();

    const w = parseInt(req.query.w, 10);
    if (!w || ALLOWED_WIDTHS.indexOf(w) === -1) return next();

    // req.path here is relative to the /uploads mount, e.g. /vehicles/file.jpg
    const rel = req.path.replace(/^\/+/, '');
    const parts = rel.split('/');
    if (parts.length !== 2) return next();
    const [dir, name] = parts;
    if (dir !== 'vehicles' && dir !== 'drivers') return next();
    if (!SAFE_NAME.test(name) || name.indexOf('..') !== -1) return next();
    if (!/\.(jpe?g|png|webp)$/i.test(name)) return next();

    const source = path.join(UPLOADS, dir, name);
    if (!fs.existsSync(source)) return next();

    const outDir = path.join(CACHE, String(w), dir);
    const outFile = path.join(outDir, name.replace(/\.[^.]+$/, '') + '.webp');

    const sendCached = () => {
        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('Cache-Control', 'public, max-age=2592000, immutable'); // 30d
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.sendFile(outFile, (err) => { if (err) next(); });
    };

    // Reuse the cached variant unless the source has since been replaced.
    try {
        if (fs.existsSync(outFile) &&
            fs.statSync(outFile).mtimeMs >= fs.statSync(source).mtimeMs) {
            return sendCached();
        }
    } catch (e) { /* fall through and regenerate */ }

    fs.mkdirSync(outDir, { recursive: true });
    const tmp = outFile + '.' + process.pid + '.tmp';
    sharp(source, { failOnError: false })
        .resize(w, null, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 74 })
        .toFile(tmp)
        .then(() => {
            try { fs.renameSync(tmp, outFile); } catch (e) {}
            sendCached();
        })
        .catch(() => {
            try { fs.unlinkSync(tmp); } catch (e) {}
            next();   // any failure: serve the original rather than an error
        });
}

module.exports = { variantMiddleware, ALLOWED_WIDTHS };
