// TEMP tool: gate legacy `@media (prefers-color-scheme: dark)` blocks so they
// never apply when the user explicitly chose Light Mode. Dark behavior is
// unchanged (theme.js always sets data-theme, so :not([data-theme="light"])
// matches exactly when dark is active).
const fs = require('fs');
for (const f of ['auth.css', 'otp-modal.css']) {
  let c = fs.readFileSync(f, 'utf8');
  const re = /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{/g;
  let out = '', last = 0, m;
  while ((m = re.exec(c))) {
    out += c.slice(last, m.index) + m[0];
    // find matching closing brace
    let depth = 1, i = re.lastIndex;
    while (i < c.length && depth > 0) {
      if (c[i] === '{') depth++;
      else if (c[i] === '}') depth--;
      i++;
    }
    let body = c.slice(re.lastIndex, i - 1);
    // prefix each top-level selector group with html:not([data-theme="light"])
    body = body.replace(/(^|\})(\s*)([^@{}\s][^{}]*)\{/g, (mm, close, ws, sel) => {
      const gated = sel.split(',').map(s => 'html:not([data-theme="light"]) ' + s.trim()).join(', ');
      return close + ws + gated + ' {';
    });
    out += body + '}';
    last = i;
    re.lastIndex = i;
  }
  out += c.slice(last);
  fs.writeFileSync(f, out, 'utf8');
  console.log('gated', f);
}
