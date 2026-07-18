// TEMP tool: inventory hex colors by CSS property kind across client files.
const fs = require('fs');
const files = fs.readdirSync('.').filter(f => /\.(css|html|js)$/.test(f) && !f.startsWith('_') && f !== 'ecosystem.config.js');
const counts = {};
const declRe = /([a-zA-Z-]+)\s*:\s*([^;{}"'`]*)/g;
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = declRe.exec(c))) {
    const prop = m[1].toLowerCase();
    if (prop.startsWith('--')) continue;
    let kind;
    if (prop === 'color' || prop === 'caret-color' || prop === '-webkit-text-fill-color' || prop === 'text-decoration-color') kind = 'TEXT';
    else if (prop.startsWith('background') || prop === 'fill' || prop === 'accent-color' || prop === 'scrollbar-color') kind = 'BG';
    else if (prop.startsWith('border') || prop.startsWith('outline') || prop === 'stroke') kind = 'BORDER';
    else continue;
    for (const h of (m[2].match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || [])) {
      const k = h.toLowerCase() + ' ' + kind;
      counts[k] = (counts[k] || 0) + 1;
    }
  }
}
Object.entries(counts).sort((a, b) => b[1] - a[1]).filter(e => e[1] >= 2).forEach(([k, v]) => console.log(v + '\t' + k));
