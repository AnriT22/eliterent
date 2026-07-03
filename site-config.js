/* ============================================================
   SITE CONFIG — central client-side feature flags.
   Change values here to toggle behavior site-wide from one place.
   Loaded early (in <head>) so flags exist before other scripts run.
   ============================================================ */
window.SiteConfig = window.SiteConfig || {};

/* Automatic country-selection popups:
   - the entry popup shown on the homepage / vehicles page (country-popup.js)
   - the automatic "Select Country" modal on vehicles.html
   Set to true to re-enable them appearing automatically on load.
   The MANUAL country selector (the country button on vehicles.html) always
   works regardless of this flag. */
window.SiteConfig.autoCountryPopup = false;
