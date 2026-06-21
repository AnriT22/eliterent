const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HERO_IMAGES = ['s-class.webp']; // above-fold, do not lazy-load

function shouldLazyLoad(imgTag) {
  if (/loading\s*=/.test(imgTag)) return false; // already has loading attr
  for (const hero of HERO_IMAGES) {
    if (imgTag.includes(hero)) return false;
  }
  return true;
}

function addLazyLoading(html) {
  return html.replace(/<img\s+([^>]*)>/gi, function (match, attrs) {
    if (shouldLazyLoad(match)) {
      return '<img ' + attrs + ' loading="lazy">';
    }
    return match;
  });
}

function bumpVersions(html) {
  // Bump CSS version: v=9 -> v=10, v=5 -> v=6, v=6 -> v=7, v=4 -> v=5, v=3 -> v=4
  html = html.replace(/style\.css\?v=9/g, 'style.css?v=10');
  html = html.replace(/premium\.css\?v=5/g, 'premium.css?v=6');
  html = html.replace(/vehicles\.css\?v=6/g, 'vehicles.css?v=7');
  html = html.replace(/vehicle\.css\?v=4/g, 'vehicle.css?v=5');
  html = html.replace(/navbar-auth\.css\?v=5/g, 'navbar-auth.css?v=6');
  html = html.replace(/admin\.css\?v=4/g, 'admin.css?v=5');
  html = html.replace(/script\.js\?v=12/g, 'script.js?v=13');
  html = html.replace(/navbar-auth\.js\?v=3/g, 'navbar-auth.js?v=4');
  html = html.replace(/currency\.js\?v=3/g, 'currency.js?v=4');
  html = html.replace(/i18n\.js\?v=5/g, 'i18n.js?v=6');
  html = html.replace(/api-helper\.js/g, 'api-helper.js?v=2'); // add version if missing
  html = html.replace(/premium-animations\.js/g, 'premium-animations.js?v=2');
  return html;
}

function processFile(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  const original = html;
  html = addLazyLoading(html);
  html = bumpVersions(html);
  if (html !== original) {
    fs.writeFileSync(filePath, html, 'utf8');
    console.log('Updated:', path.relative(ROOT, filePath));
    return true;
  }
  return false;
}

function walk(dir) {
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'server' && entry.name !== 'scripts') {
      count += walk(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      if (processFile(fullPath)) count++;
    }
  }
  return count;
}

const updated = walk(ROOT);
console.log('Total files updated:', updated);
