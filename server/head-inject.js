// ==========================================================================
// Central <head> injection for analytics + search-engine verification.
//
// This puts Google Analytics 4 (and optional Google Search Console meta
// verification) on EVERY html page from ONE place — no need to edit each
// html file. Set the two IDs below (or via env vars) and it applies site-wide.
//
//   GA_MEASUREMENT_ID  -> your GA4 id, looks like "G-XXXXXXXXXX"
//   GSC_VERIFICATION   -> the content value from Search Console's
//                         "HTML tag" method (just the token, not the whole tag)
//
// Leave a value empty ('') to disable that piece. When GA id is empty, no
// analytics code is emitted at all, so this is safe to ship before you have
// an account.
// ==========================================================================

const GA_MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID || "";
const GSC_VERIFICATION = process.env.GSC_VERIFICATION || "";

function headTags() {
  var out = "";

  if (GSC_VERIFICATION) {
    out += '<meta name="google-site-verification" content="' + GSC_VERIFICATION + '">';
  }

  if (GA_MEASUREMENT_ID) {
    out +=
      '<script async src="https://www.googletagmanager.com/gtag/js?id=' +
      GA_MEASUREMENT_ID +
      '"></script>' +
      "<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}" +
      "gtag('js',new Date());gtag('config','" +
      GA_MEASUREMENT_ID +
      "');</script>";
  }

  return out;
}

// Insert the tags right after the opening <head> tag. No-op if there is
// nothing to inject or no <head> is present.
function inject(html) {
  var tags = headTags();
  if (!tags || typeof html !== "string") return html;
  if (html.indexOf("google-site-verification") !== -1 || html.indexOf("googletagmanager.com/gtag") !== -1) {
    return html; // already injected — avoid duplicates
  }
  return html.replace(/<head([^>]*)>/i, function (m) {
    return m + tags;
  });
}

module.exports = { headTags, inject, isEnabled: !!(GA_MEASUREMENT_ID || GSC_VERIFICATION) };
