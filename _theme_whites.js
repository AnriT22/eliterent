// TEMP tool: list selectors that set color:#fff / #ffffff so we can decide
// which need a dark equivalent in light mode.
const fs = require('fs');
for (const f of ['style.css', 'premium.css', 'vehicles.css', 'vehicle.css', 'dashboard.css', 'admin.css', 'navbar-auth.css', 'reservation.css', 'city-landing.css', 'blog.css', 'guest-profile.css', 'auth-luxury.css', 'partner-register.css']) {
  if (!fs.existsSync(f)) continue;
  const css = fs.readFileSync(f, 'utf8');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m; const hits = [];
  while ((m = re.exec(css))) {
    const body = m[2];
    if (/(^|;)\s*color\s*:\s*(#fff\b|#ffffff\b|white\b)/i.test(body)) {
      hits.push(m[1].trim().replace(/\s+/g, ' ').slice(0, 90));
    }
  }
  if (hits.length) { console.log('== ' + f + ' (' + hits.length + ')'); hits.forEach(h => console.log('   ' + h)); }
}
