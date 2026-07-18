// TEMP tool: property-aware replacement of hardcoded colors with theme tokens.
// Every replacement becomes var(--token, ORIGINAL) so dark mode is unchanged
// even if theme.css fails to load. Run:  node _theme_transform.js [--apply]
const fs = require('fs');
const APPLY = process.argv.includes('--apply');

// ---- token maps: hex(lower) -> token name. Fallback = original text. ----
// BG kind: background*, fill, accent-color, scrollbar-color
const BG = {
  '#0b0c10': '--th-bg', '#0c1117': '--th-bg2', '#0f0f0f': '--th-bg3', '#0a0a0a': '--th-bg4',
  '#111111': '--th-bg5', '#111': '--th-bg5', '#0e0f14': '--th-bg6', '#222530': '--th-surface2',
  '#0d1b2a': '--th-navy', '#0f172a': '--th-navy2', '#111827': '--th-navy3',
  '#15171f': '--th-panel', '#1c1e26': '--th-surface', '#262a35': '--th-raised',
  '#2a2f3a': '--th-raised2', '#2a2d3a': '--th-raised3', '#2e3340': '--th-raised4',
  '#3a3f4b': '--th-borderfill',
  '#151210': '--tw-bg', '#141210': '--tw-bg2', '#1a1814': '--tw-surface',
  '#2a2520': '--tw-raised', '#2a2318': '--tw-raised2', '#352f28': '--tw-raised3',
  '#3a3530': '--tw-raised4', '#3a3520': '--tw-raised5', '#2a2a2a': '--tn-raised',
  '#eaeaea': '--th-chip'
};
// TEXT kind: color, caret-color, -webkit-text-fill-color, text-decoration-color
const TEXT = {
  '#eaeaea': '--tt-text', '#f0ece2': '--tt-text2', '#f5f5f5': '--tt-text3',
  '#a0a3b0': '--tt-muted', '#94a3b8': '--tt-muted2', '#9a9082': '--tt-muted3',
  '#cbd5e1': '--tt-soft', '#e2e8f0': '--tt-soft2', '#c0c0c0': '--tt-soft3',
  '#b0b0b0': '--tt-soft4', '#d1d5db': '--tt-soft5', '#c4baa8': '--tt-warmsoft',
  '#bdddfc': '--tt-bluesoft', '#88bdf2': '--tt-blue',
  '#d4af37': '--tt-gold', '#c9a84c': '--tt-gold2', '#d4b86a': '--tt-gold3',
  '#e9c766': '--tt-gold4', '#f4e3b2': '--tt-gold5', '#b8963f': '--tt-gold6',
  '#c8a961': '--tt-gold7', '#ffd970': '--tt-gold8',
  '#4ade80': '--tt-green', '#22c55e': '--tt-green2', '#86efac': '--tt-green3',
  '#f87171': '--tt-redsoft', '#fca5a5': '--tt-redsoft2',
  '#fbbf24': '--tt-amber', '#f59e0b': '--tt-amber2', '#fcd34d': '--tt-amber3'
};
// BORDER kind: border*, outline*, stroke
const BORDER = {
  '#3a3f4b': '--tb-border', '#2a2d38': '--tb-border2', '#2a2f3a': '--tb-border3',
  '#2a2520': '--tb-borderw', '#1a1814': '--tb-borderw2', '#3a3a3a': '--tb-border4',
  '#0c1117': '--th-bg2', '#262a35': '--tb-border5', '#1c1e26': '--tb-border6',
  '#c9a84c': '--tb-gold', '#d4af37': '--tb-gold2',
  '#88bdf2': '--tb-blue'
};
// white-alpha fills (all kinds) -> tokens
const WALPHA = [
  [/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(?:0?\.03)\s*\)/g, '--tf-03', 'rgba(255,255,255,0.03)'],
  [/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(?:0?\.04)\s*\)/g, '--tf-04', 'rgba(255,255,255,0.04)'],
  [/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(?:0?\.05)\s*\)/g, '--tf-05', 'rgba(255,255,255,0.05)'],
  [/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(?:0?\.06)\s*\)/g, '--tf-06', 'rgba(255,255,255,0.06)'],
  [/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(?:0?\.07)\s*\)/g, '--tf-07', 'rgba(255,255,255,0.07)'],
  [/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(?:0?\.08)\s*\)/g, '--tf-08', 'rgba(255,255,255,0.08)'],
  [/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(?:0?\.1)\s*\)/g, '--tf-10', 'rgba(255,255,255,0.1)'],
  [/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(?:0?\.12)\s*\)/g, '--tf-12', 'rgba(255,255,255,0.12)'],
  [/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(?:0?\.15)\s*\)/g, '--tf-15', 'rgba(255,255,255,0.15)'],
  [/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(?:0?\.2)\s*\)/g, '--tf-20', 'rgba(255,255,255,0.2)']
];

function kindOf(prop) {
  const p = prop.toLowerCase();
  if (p.startsWith('--')) return null; // custom props handled manually in theme.css
  if (p === 'color' || p === 'caret-color' || p === '-webkit-text-fill-color' || p === 'text-decoration-color') return 'TEXT';
  if (p.startsWith('background') || p === 'fill' || p === 'accent-color' || p === 'scrollbar-color') return 'BG';
  if (p.startsWith('border') || p.startsWith('outline') || p === 'stroke') return 'BORDER';
  return null;
}

const HEXRE = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;
const stats = {};

function transformValue(val, kind, file) {
  const map = kind === 'TEXT' ? TEXT : kind === 'BG' ? BG : BORDER;
  let out = val.replace(HEXRE, (hex) => {
    const tok = map[hex.toLowerCase()];
    if (!tok) return hex;
    stats[tok] = (stats[tok] || 0) + 1;
    return 'var(' + tok + ', ' + hex + ')';
  });
  for (const [re, tok, orig] of WALPHA) {
    out = out.replace(re, () => { stats[tok] = (stats[tok] || 0) + 1; return 'var(' + tok + ', ' + orig + ')'; });
  }
  return out;
}

// Declaration matcher: prop : value   (value stops at ; } { quotes/backtick)
const DECLRE = /([a-zA-Z-][a-zA-Z0-9-]*)(\s*:\s*)([^;{}"'`]+)/g;

function processFile(f) {
  const src = fs.readFileSync(f, 'utf8');
  let count = 0;
  const out = src.replace(DECLRE, (m, prop, sep, val) => {
    // skip values already tokenized or without colors
    if (!/#[0-9a-fA-F]{3}/.test(val) && !/rgba\(\s*255\s*,\s*255\s*,\s*255/.test(val)) return m;
    const kind = kindOf(prop);
    if (!kind) return m;
    const nv = transformValue(val, kind, f);
    if (nv !== val) count++;
    return prop + sep + nv;
  });
  if (count > 0 && APPLY) fs.writeFileSync(f, out, 'utf8');
  return count;
}

const SKIP = new Set(['ecosystem.config.js', 'theme.js', 'theme.css', 'site-config.js',
  'RoyalCar_Guide_GEO.html', '85a9e1a5-97ae-4d57-8987-f00c8fd0da3e.html']);
const files = fs.readdirSync('.').filter(f =>
  /\.(css|html|js)$/.test(f) && !f.startsWith('_') && !SKIP.has(f));

let total = 0;
for (const f of files) {
  const n = processFile(f);
  if (n > 0) { console.log(String(n).padStart(5), f); total += n; }
}
console.log('---\nDeclarations changed:', total, APPLY ? '(APPLIED)' : '(dry run)');
console.log('\nToken usage:');
Object.entries(stats).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(String(v).padStart(5), k));
