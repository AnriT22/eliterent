# SEO Implementation Contracts — Critical & High

> One contract per Critical/High ticket. Each is a precise, testable spec — **not yet executed.** Awaiting approval.
> Severity map: T-01 🔴 Critical · T-02 🟠 High · T-03 🟠 High · T-04 🟠 High (decision) · S-01/S-02 operational High (audit's "make money pages real").
> Already-verified-done High (audit "trust stats"): **no contract needed** — confirmed reconciled across HTML + `lang/*.json`.

---

## Contract T-01 — Eliminate cloaking; remove fabricated reviews 🔴

**Finding:** N1 (+ N6). **Files:** `server/seo-prerender.js`, `reviews.html`, `vehicles.html` (markers already present).

**Objective.** Search engines and users must see the **same main content** on `/vehicles.html` and `/reviews.html`. Remove the fabricated 5★ testimonial fallback entirely.

**Exact change specification.**
1. **Stop crawler-gating** the injected blocks. In `seo-prerender.middleware` (`seo-prerender.js:288–303`), remove the two `if (!crawler) return next();` early-returns so the vehicles and reviews blocks render for **all** visitors (mirroring the already-everyone homepage block). Keep `isCrawler` only if still needed elsewhere; otherwise delete it (N6 cleanup).
   - Because the human pages also run their JS grids, ensure no **duplicate** rendering: the injected block sits at the marker and the JS list (`#reviewsList` / vehicles grid) remains below. Either (a) make the injected block the canonical content and have the JS enhance/replace it, or (b) keep the injected block as a labelled "Browse by type / city" nav section distinct from the live grid. **Decision:** treat the injected block as progressive-enhancement scaffolding visible to all; JS hydrates richer UI on top. Verify no jarring duplication in preview.
2. **Delete the fabricated-review fallback.** Remove `FEATURED_REVIEWS` (`seo-prerender.js:36–40`) and the `else` branch in `buildReviewsSeoHtml` (`:151–157`) that renders them. When the DB has no reviews, render an **honest empty state** identical to what humans see ("No reviews yet — be the first"), not testimonials.
3. **Fix the stale comment** (`:32–36`) — remove "displayed on the homepage."
4. Leave the **homepage** browse block unchanged (already served to all — not cloaking).

**Out of scope.** Adding real reviews (S-02); inventory onboarding (S-01); Review/AggregateRating schema (stays removed until S-02).

**Acceptance tests.**
- `curl -A "Googlebot" https://host/reviews.html` and `curl -A "Mozilla" https://host/reviews.html` return the **same** review section markup (both honest-empty until real data).
- No occurrence of "Sarah M.", "David L.", "Elena K." in any served HTML (`grep`).
- `/vehicles.html` main content equivalent for both UAs.
- Google Rich Results Test on `/reviews.html`: **no** Review/AggregateRating snippet.
- Preview QA: vehicles + reviews pages render cleanly with no duplicated/overlapping blocks.

**Rollback.** Revert `seo-prerender.js`; markers in HTML are inert without the injector, so no HTML rollback needed.

**Regression watch.** Layout/CLS shift from now-always-visible block (check O-03); ensure JS grids still mount below the injected block.

---

## Contract T-02 — Reconcile hreflang (HTML ↔ sitemap ↔ localized) 🟠

**Finding:** N2. **Depends on:** T-04 scope decision. **Files:** all localizable English `.html` heads, `sitemap.xml`, (reference) `i18n-render.js:170–178`.

**Objective.** For every URL, the hreflang cluster must be **identical and reciprocal** across the English page, the localized pages, and the sitemap.

**Exact change specification (gate cluster per T-04 = funnel translated-today; grows via S-03).**
1. Define the canonical localized set = pages **genuinely** localized right now: `index, vehicles, reviews, about, contact`. (City/category/blog join later, per page, as S-03 translates them.)
2. **For each English page in the set:** add static `<link rel="alternate" hreflang="ru" href="https://eliteauto.rent/ru/<page>">` and the `ka` equivalent next to the existing `en`/`x-default` (matching the exact set `i18n-render` emits at `:172–177`).
3. **For each English page NOT in the set:** keep `en` + `x-default` only **and** remove its `ru`/`ka` `<xhtml:link>` alternates from `sitemap.xml`.
4. **sitemap.xml:** every `<url>` lists ru/ka alternates **iff** that page is in the localized set; the alternates must point to URLs that actually render localized content.
5. Confirm bidirectionality: en→ru/ka, ru→en/ka, ka→en/ru, all with one `x-default`→en.

**Acceptance tests.**
- For 3 sample URLs, the hreflang set in (English HTML) == (sitemap entry) == (`/ru/` page HTML) == (`/ka/` page HTML).
- GSC International Targeting / a hreflang validator: **0 "no return tag" / 0 conflict errors**.
- No sitemap alternate resolves to a 404 or a non-localized page.

**Rollback.** Revert HTML head edits + `sitemap.xml`.

**Regression watch.** Must not declare an alternate to a thin page (couples to T-03). Don't introduce duplicate `<link>` lines (grep each page for exactly one `hreflang="ru"`).

---

## Contract T-03 — Resolve thin localized pages 🟠

**Finding:** N3. **Depends on:** T-04. **Files:** `server/i18n-render.js` (`LOCALIZABLE`, `SEO` map), `sitemap.xml`, (if translating) `lang/ru.json`, `lang/ka.json`, page bodies.

**Objective.** No localized URL is indexable unless its **body content** is actually localized. **Decision: translate everything (T-04), rolled out incrementally.** This contract has two parts: a **gate step** (de-scope the not-yet-translated pages so nothing thin is indexed now) and the **rolling translation** (`S-03`).

**Part 1 — Gate de-scope (Wave 1, effort M):**
1. In `i18n-render.js:32–44`, set `LOCALIZABLE` to the **translated-today** set only: `index, vehicles, reviews, about, contact`. Temporarily remove the 7 category pages, 8 blog posts, and 3 city pages (their bodies are English — `/ru/suv` = 245 Cyrillic chars chrome-only; `/ru/blog-tbilisi-to-kazbegi` = 0).
2. Remove the corresponding ru/ka `<xhtml:link>` alternates from `sitemap.xml` (couples to T-02). De-scoped `/ru/<page>` then falls through to the English page (acceptable) and is **not advertised** as a localized alternate.

**Part 2 — Rolling translation (Wave 3 = `S-03`, effort L–XL):** for each city → category → blog page:
1. Add `data-i18n` / `data-i18n-html` attributes to the body; add keys to `lang/ru.json` + `lang/ka.json`.
2. Extend the `SEO` title/meta map (`i18n-render.js:49–84`) to cover the page (blog posts currently leak English titles).
3. Re-run the isolation render test (require Cyrillic/Georgian in the main body, not just chrome); **then** add it back to `LOCALIZABLE` + the sitemap cluster + English-page hreflang — all in the same change, preserving the N2 invariant.

**Acceptance tests.**
- Isolation render of every in-scope `/ru/` and `/ka/` page: localized `<title>` **and** localized H1 + first paragraph (Cyrillic/Georgian present in main content, not just chrome).
- Every page in `LOCALIZABLE` has a localized body; every page removed from it has no ru/ka sitemap alternate.

**Rollback.** Revert `i18n-render.js` + `sitemap.xml` (+ lang files if option a).

**Regression watch.** `LOCALIZABLE` keys must stay in lockstep with sitemap alternates and T-02 HTML hreflang — a drift here re-creates N2/N3.

---

## Contract T-04 — Localization scope decision 🟠 — ✅ DECIDED 2026-06-08

**Decision:** **Translate everything**, rolled out incrementally. A page is advertised in the `/ru//ka/` hreflang + sitemap cluster **only once its body is translated**.
- **Gate cluster (Wave 1, translated today):** `index, vehicles, reviews, about, contact` (high `data-i18n` coverage).
- **Rolling additions (Wave 3, S-03):** city pages → category pages → blog posts, each joining the cluster when its body + title/meta are localized.
**This list is the single source of truth** that `LOCALIZABLE`, sitemap `<xhtml:link>` alternates, and English-page hreflang must all derive from (the N2 invariant).

---

## Contract S-01 — Make inventory crawlable & real 🟠 (operational, audit "money pages")

**Finding:** audit Critical (vehicles). **Files:** `server/seo-prerender.js` (`fetchActiveVehicles`), `server/routes/vehicles.js`, partner onboarding. **Depends on:** real partner inventory; G-01.

**Objective.** Real cars exist in the served HTML of `/vehicles.html` (to all visitors, per T-01) and individual `/vehicle.html?id=` pages return crawlable content; `ItemList` reflects real inventory.
**Spec.** Onboard verified partners + active vehicles so `fetchActiveVehicles` (`:209–220`, requires `status='active'` AND `pp.is_verified=1`) returns rows; confirm `buildItemListJson` switches from the category fallback to real cars; ensure individual vehicle pages are server-renderable/crawlable (or add to prerender).
**Acceptance.** Served `/vehicles.html` lists real cars for both UAs; `ItemList` `numberOfItems` > 0 with vehicle URLs; a sampled `/vehicle.html?id=N` returns indexable HTML.
**Risk.** Until inventory exists, the honest category fallback stands (acceptable). Do **not** fabricate cars.

---

## Contract S-02 — Genuine reviews, then re-enable schema 🟠 (operational)

**Finding:** audit Critical (reviews) + N1 tail. **Files:** `reviews.html`, `server/routes/reviews.js`, `seo-prerender.js`. **Depends on:** S-01, live bookings.

**Objective.** Replace the (now-removed) fabricated fallback with **real** reviews rendered server-side to all, then — and only then — re-introduce `Review`/`AggregateRating` with a rating that matches on-page + DB.
**Spec.** Collect reviews from completed bookings; `fetchPublicReviews` (`:222–232`) already exists — surface its output to all visitors; once ≥ a credible volume of real reviews is server-rendered, add `AggregateRating` whose `ratingValue`/`reviewCount` equal the DB aggregate (`/api/reviews/stats`).
**Acceptance.** Reviews in static/served HTML are real DB rows for both UAs; schema rating == visible rating == DB. Rich Results Test validates.
**Hard rule.** No schema rating before real, on-page, server-rendered reviews exist (this is the N1/Task-1.1 lesson).

---

## Cross-contract invariants (apply to all of the above)

1. **No bot/human divergence** on any indexable page (the cloaking invariant).
2. **hreflang cluster = sitemap cluster = localized-page cluster** for every URL (the N2 invariant).
3. **No localized URL without localized body** (the N3 invariant).
4. **No schema claim without on-page, server-rendered, real backing data** (the E-E-A-T invariant).
5. Every change is revertible in isolation; `i18n-render`/`seo-prerender` keep their `try/catch → next()` English-safe fallback.
