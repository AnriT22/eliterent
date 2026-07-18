// TEMP tool: add theme.js (early, no-FOUC) + theme.css (last, wins cascade)
// to every HTML page. Idempotent.
const fs = require('fs');
const SKIP = new Set(['RoyalCar_Guide_GEO.html', '85a9e1a5-97ae-4d57-8987-f00c8fd0da3e.html']);
const files = fs.readdirSync('.').filter(f => f.endsWith('.html') && !SKIP.has(f));
let changed = 0;
for (const f of files) {
  let c = fs.readFileSync(f, 'utf8');
  if (c.includes('theme.js')) { console.log('skip (has)', f); continue; }
  const before = c;
  // 1) theme.js right after <meta charset...> (first thing that runs, sets data-theme pre-paint)
  const mCharset = c.match(/<meta\s+charset[^>]*>/i);
  if (mCharset) {
    c = c.replace(mCharset[0], mCharset[0] + '\n    <script src="theme.js?v=1"></script>');
  } else {
    const mHead = c.match(/<head[^>]*>/i);
    if (!mHead) { console.log('NO <head>:', f); continue; }
    c = c.replace(mHead[0], mHead[0] + '\n    <script src="theme.js?v=1"></script>');
  }
  // 2) theme.css just before </head> so its light-mode overrides win the cascade
  if (/<\/head>/i.test(c)) {
    c = c.replace(/<\/head>/i, '    <link rel="stylesheet" href="theme.css?v=1">\n</head>');
  } else { console.log('NO </head>:', f); continue; }
  if (c !== before) { fs.writeFileSync(f, c, 'utf8'); changed++; console.log('ok  ', f); }
}
console.log('---\nPages updated:', changed);
