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
// Google Ads conversion tag (AW-…). Shares the SAME gtag.js library as GA4 —
// Google's rule is "one Google tag per page", so we load the library once and
// add a second config() line rather than a second <script src>. Optional.
const GOOGLE_ADS_ID = process.env.GOOGLE_ADS_ID || "AW-18229782833";

function headTags() {
  var out = "";

  if (GSC_VERIFICATION) {
    out += '<meta name="google-site-verification" content="' + GSC_VERIFICATION + '">';
  }

  // Load the gtag library once, off whichever Google id we have, then config
  // every destination (GA4 measurement + Google Ads conversion) on it.
  var libId = GA_MEASUREMENT_ID || GOOGLE_ADS_ID;
  if (libId) {
    var configs = "";
    if (GA_MEASUREMENT_ID) configs += "gtag('config','" + GA_MEASUREMENT_ID + "');";
    if (GOOGLE_ADS_ID) configs += "gtag('config','" + GOOGLE_ADS_ID + "');";
    out +=
      '<script async src="https://www.googletagmanager.com/gtag/js?id=' +
      libId +
      '"></script>' +
      "<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}" +
      "gtag('js',new Date());" +
      configs +
      "</script>";
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
