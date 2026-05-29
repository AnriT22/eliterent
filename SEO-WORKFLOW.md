# SEO Implementation Workflow — EliteAuto.rent

> Derived from **EliteAuto-SEO-Audit** (prepared 2026-05-29).
> This is a planning/tracking doc — **no code is changed by reading it.** Each task lists priority, effort, dependencies, exact files, and a "done when" acceptance test.

---

## How to use this doc

- `[ ]` → not started · `[~]` → in progress · `[x]` → done
- **Status** reflects what's *actually in the repo today* (verified 2026-05-29), which is **not** what the audit saw on the live site — see the reality check below.
- Work top-to-bottom: **Phase 1** (small fixes) → **DEPLOY & INDEX gate** → **Phase 2** (build) → **Phase 3** (ongoing).
- Effort: `XS` <30m · `S` <1h · `M` 1–4h · `L` multi-day · `XL` multi-week/ongoing.

---

## ⚠️ Reality check — read first

The audit was run against the **deployed** site and concluded "effectively unindexed; no structured data; no hreflang." Since then, the local codebase has moved ahead. Verified current state of the repo:

| Audit finding (live site) | Actual state in repo | Bucket |
|---|---|---|
| "No structured data detected" | JSON-LD on **11 pages** (LocalBusiness, FAQPage, BreadcrumbList, Article, Product, ItemList, WebSite) | **A — ship it** |
| "No hreflang" | hreflang on **13 pages** — but all point to the same URL (broken) | **B — fix it** |
| "Add OG tags / canonicals" | OG + Twitter + canonical present site-wide | **A — ship it** |
| "SUV/4x4 category page (new)" | `suv-rental-georgia.html` **exists** with Product + FAQ schema | **A — ship it** |
| "Kazbegi blog post" | `blog-tbilisi-to-kazbegi.html` **exists** | **A — ship it** |
| "Only add AggregateRating once real reviews exist" | `index.html` ships a **hardcoded 4.8 AggregateRating** | **B — fix (risk)** |
| "Reconcile inflated stats" | Still contradictory across `index/about/login/register/vehicles` | **B — fix it** |
| "vehicles title/H1/og mismatch" | Still mismatched; no static `<h1>` either | **B — fix it** |
| Indexation | Still the #1 blocker — nothing is live+indexed | **Gate** |

**Implication:** the single biggest lever isn't "do more SEO work" — it's **shipping the good work that already exists and getting it indexed.** Two items (AggregateRating, hreflang) must be *corrected before* deploy, or we index a penalty risk.

Buckets: **A** = done locally, just needs deploy · **B** = exists but wrong, fix before indexing · **C** = genuinely not built yet.

---

## Phase 1 · Quick wins & pre-deploy cleanup — *this week*

> Goal: get every cheap fix in, **correct the two risky items**, then trip the deploy gate. None of these depend on inventory or translation.

### 1.1 — Remove the fake `AggregateRating` schema ⛔ CRITICAL
- **Status:** `[x]` · removed from `index.html` LocalBusiness JSON-LD
- **Impact / Effort:** High (avoids manual action) · **XS**
- **Depends on:** none
- **Files:** `index.html` — `LocalBusiness` JSON-LD block (`aggregateRating` at ~L65–66, `"ratingValue": "4.8"`)
- **Do:** Delete the `aggregateRating` node. Keep the rest of `LocalBusiness`. Do **not** add `Review`/`AggregateRating` anywhere until first-party reviews are real, on-page, and server-rendered (see 2.2).
- **Done when:** No `AggregateRating` / `ratingValue` in any shipped JSON-LD; Google Rich Results Test shows **no** review star snippet for the homepage.

### 1.2 — Reconcile trust stats & soften the 4.8 claim
- **Status:** `[x]` · all fake ratings/counts removed across HTML + en/ka/ru.json (also caught login `4.9★`/`50K+`); register fallback + JSON BOM also fixed
- **Impact / Effort:** High (trust / E-E-A-T) · **M**
- **Depends on:** none
- **Files & current values:**
  - `index.html` — hero rating `4.8` (L281), footer trust badge "4.8/5 Google Rating" (L643), "Trusted by 2000+ vehicle owners" (L714)
  - `about.html` — `2,450+` travelers (L357), `350+` partners (L365), `1,200+` vehicles (L373)
  - `login.html` — `2,000+` (L115)
  - `register.html` — "Browse 2,000+ Vehicles" (L81)
  - `vehicles.html` — meta description "Browse 2,000+ rental cars" (L10)
- **Do:** Pick **one** honest figure set (or remove counts entirely while pre-launch). Remove the "Google Rating" wording unless it's a real, linkable Google profile. Make `index` and `about` agree.
- **Done when:** A repo-wide search for `2,000+ / 2000+ / 350+ / 1,200+ / 2,450+ / 4.8` returns only consistent, defensible numbers (or none).

### 1.3 — Fix hreflang (currently a no-op)
- **Status:** `[x]` · ka/ru dropped until real localized URLs exist
- **Impact / Effort:** Med · **S**
- **Depends on:** none (full fix depends on 2.5)
- **Files:** `index.html` L13–16 + the other 12 pages with hreflang
- **Do (short term):** Until real `/ru/` `/ka/` URLs exist (2.5), drop the `ka` and `ru` alternates and keep only a self-referencing `en` + `x-default`. Don't tell Google three language versions live at one URL.
- **Done when:** No two `hreflang` entries on a page share the same `href` unless that's genuinely intended (en/x-default).

### 1.4 — Align vehicles.html title / H1 / og:title
- **Status:** `[x]` · aligned + static `<h1>` in HTML
- **Impact / Effort:** Med · **S**
- **Depends on:** none
- **Files:** `vehicles.html` — `<title>` (L9: "Rent a Car in Tbilisi, Batumi, Kutaisi — From $25/day"), `og:title` (L17: "Browse Rental Cars"), and the **missing static `<h1>`** (currently JS-injected only)
- **Do:** Choose one benefit-driven, keyword-led string; set `<title>`, `og:title`, and a **static** `<h1>` to match. Add a server-rendered `<h1>` so crawlers see it without JS.
- **Done when:** title ≈ og:title ≈ visible H1, and the H1 is present in raw HTML (view-source, not devtools).

### 1.5 — Trim over-length titles to ≤60 chars
- **Status:** `[x]` · all titles ≤60 (home, vehicles, batumi, suv + both blogs trimmed; now match og:title)
- **Impact / Effort:** Low · **XS**
- **Depends on:** none
- **Files:** `index.html` L9 ("Car Rental Georgia | Tbilisi Airport Pickup 24/7 | EliteAuto.rent" ≈ 64 chars) and any title >60
- **Done when:** Every `<title>` is ≤60 chars and still leads with the primary keyword.

### 1.6 — Triage `#` placeholder links
- **Status:** `[x]` · verified: footer/nav use real hrefs; remaining 89 `#` are JS currency/language/auth controls (no crawlable dead-ends). Optional: convert to `<button>` for semantics
- **Impact / Effort:** Low–Med · **M**
- **Depends on:** none
- **Files:** site-wide; priority = footer "Contact" (should point to `contact.html`, which exists), then currency/language toggles
- **Do:** Real navigation → real `href`. Interactive toggles (currency/language) → keep as JS but convert to `<button>` so they aren't crawled as dead links. **Don't blind-replace** — many `#` are legitimate JS controls.
- **Done when:** No `href="#"` represents intended navigation; interactive controls are buttons, not anchors-to-nowhere.

### 1.7 — Remove obsolete meta-keywords tags
- **Status:** `[x]` · removed from all marketing pages
- **Impact / Effort:** Low (cosmetic; Google ignores them) · **XS**
- **Files:** `index, blog, blog-car-rental-georgia-guide, blog-tbilisi-to-kazbegi, suv-rental-georgia, rent-car-{tbilisi,batumi,kutaisi}`
- **Done when:** No `<meta name="keywords">` remains.

### 1.8 — Image alt text + per-page OG images
- **Status:** `[x]` · static alt 84/85; the 5 gaps are JS-hydrated images and `vehicle.js` already sets `alt` at runtime; city/blog/category/airport/no-deposit pages all have distinct OG (brand pages keep og-preview, which is appropriate)
- **Impact / Effort:** Low–Med · **M**
- **Depends on:** none (candidate images `images/1–4.png` already in repo)
- **Files:** site-wide `<img>`; `og:image` on the 13 pages currently pointing at `og-preview.jpg`
- **Do:** Descriptive, keyword-relevant alt text everywhere; give city/blog/category pages a unique OG image. Verify `.webp` use + lazy-loading.
- **Done when:** No empty/duplicate `alt`; key landing pages have distinct `og:image`.

### 1.9 — Verify sitemap.xml is complete & readable
- **Status:** `[x]` · updated with new pages + `lastmod` 2026-05-29
- **Impact / Effort:** Med · **S**
- **Files:** `sitemap.xml`, `robots.txt`
- **Do:** Confirm it lists every canonical URL **including** `suv-rental-georgia.html`, `blog.html`, both blog posts, all city pages; confirm honest `lastmod`; ensure it's fetchable as readable XML.
- **Done when:** `sitemap.xml` opens as plain XML listing all live canonical URLs; referenced correctly in `robots.txt`.

---

## 🚧 GATE · Deploy & Index — *the single biggest unlock*

> Everything in Phase 1 is invisible until this happens. The repo is ahead of production; **ship it, then make Google look.** App is Express (`npm start` → `server/server.js`) serving static HTML — deploy the current branch to the production host for `eliteauto.rent`.

- [ ] **G.1 — Deploy Phase 1 to production.** Confirm the live site source shows the new JSON-LD, corrected schema, and aligned titles. *(Impact High · Effort S–M · depends on Phase 1)*
- [ ] **G.2 — Google Search Console.** Verify the property, submit `sitemap.xml`, run URL Inspection + "Request indexing" on every key URL (home, 3 city pages, vehicles, blog ×2, suv, about, contact). *(Impact High · Effort S · depends on G.1)*
- [ ] **G.3 — Bing Webmaster Tools.** Import from GSC, submit sitemap. *(Impact Med · Effort XS · depends on G.1)*
- [ ] **G.4 — Confirm crawlability.** `robots.txt` doesn't block key pages; no stray `noindex`; Rich Results Test passes on schema pages (and shows **no** review snippet per 1.1). *(Impact High · Effort XS)*
- [ ] **G.5 — Baseline.** Record starting impressions/positions in GSC so Phase 2 impact is measurable. Optionally connect **Ahrefs/Semrush** (available in this workspace) for real volume/difficulty. *(Impact Med · Effort XS)*

---

## Phase 2 · Strategic investments — *this quarter*

> Bucket C: the parts that actually capture transactional demand. These need inventory, translation, or editorial time.

### 2.1 — Make inventory crawlable & real *(core growth lever)*
- **Status:** `[~]` · `server/seo-prerender.js` injects fleet/reviews when DB has data; still needs inventory onboarding
- **Impact / Effort:** High · **L (ongoing)**
- **Depends on:** real partner inventory onboarding
- **Files:** `server/server.js`, `server/routes/vehicles.js`, `vehicles.html`, `vehicle.html`, `vehicles.js`
- **Do:** Server-render the listings + each vehicle page from Postgres so cars exist in the initial HTML (the Express + `pg` stack to do this already exists). Onboard genuine inventory.
- **Done when:** `view-source:vehicles.html` shows real cars; individual vehicle pages return crawlable HTML; `ItemList` schema reflects actual inventory.

### 2.2 — Populate genuine reviews, then enable review schema
- **Status:** `[ ]` · reviews page empty; 4.8 unverified
- **Impact / Effort:** High · **XL**
- **Depends on:** live bookings
- **Files:** `reviews.html`, `server/routes/bookings.js`, review storage
- **Do:** Collect real reviews, render server-side. **Only then** re-introduce `Review`/`AggregateRating` (the node removed in 1.1) and the visible 4.8.
- **Done when:** Real reviews in static HTML; schema rating matches what's on the page and in the DB.

### 2.3 — Build category & high-intent landing pages
- **Status:** `[x]` · SUV + TBS airport + no-deposit + **economy + sedan + luxury + 7-seater/minivan** all live (Product+FAQ+Breadcrumb schema, cross-linked, in sitemap, linked from homepage footer)
- **Impact / Effort:** High · **L**
- **Depends on:** 2.1 (inventory data)
- **Build:** **TBS Tbilisi Airport** page, **No-deposit / no-card** page, plus **economy / sedan / luxury / minivan-7-seater** category pages (mirror the `suv-rental-georgia.html` pattern).
- **Done when:** Each target keyword from the audit's table has a dedicated, indexable page with FAQ schema and internal links.

### 2.4 — Georgia road-trip content cluster
- **Status:** `[x]` · 5 new interlinked posts added (itinerary **pillar** + Tbilisi→Batumi + Kakheti + Svaneti + safety/FAQ); staggered dates, distinct hero per new post, FAQPage schema on safety post, all in sitemap + blog index. Note: only 6 stock images exist, so the Svaneti post shares `svaneti.jpg` with the Kazbegi post — fully-unique heroes need a few real photos
- **Impact / Effort:** High · **XL (ongoing)**
- **Build:** 7–10 day itinerary pillar; Svaneti/Mestia; Tbilisi→Batumi; Kakheti wine; Gudauri winter; "is it safe to drive in Georgia" safety/FAQ. Interlink with city + category pages. Give each post a unique hero image + staggered real publish dates.
- **Done when:** ≥5 new interlinked posts live; no two posts share a hero image or publish date.

### 2.5 — Launch crawlable RU & KA localized pages
- **Status:** `[ ]` · `ru.json` exists; only JS toggle, no localized URLs
- **Impact / Effort:** High · **L**
- **Depends on:** translation
- **Do:** Publish real `/ru/` and `/ka/` URLs, then wire **correct** hreflang (closes 1.3 properly).
- **Done when:** Distinct localized URLs return localized HTML; hreflang maps each language to its own URL bidirectionally.

### 2.6 — Convert query-param locations to clean URLs
- **Status:** `[ ]`
- **Impact / Effort:** Med · **M–L**
- **Depends on:** templating work (2.1)
- **Do:** Replace `vehicles.html?location=Tbilisi` with crawlable path URLs (e.g. `/rent-a-car/tbilisi/`) that can rank independently; canonical + internal links updated.
- **Done when:** Location/category pages live at clean paths and are indexed as distinct pages.

### 2.7 — Link building & digital PR
- **Status:** `[ ]` · new domain, negligible authority
- **Impact / Effort:** High · **XL (ongoing)**
- **Do:** Travel roundups (Wander-Lush, ExpatHub), TripAdvisor forums, travel blogs; build a real Trustpilot presence (feeds 2.2).
- **Done when:** First referring domains appear in GSC/Ahrefs; Trustpilot profile live.

---

## Phase 3 · Ongoing / monitoring

- [ ] **3.1** — Publish cadence: ≥1 quality post every 1–2 weeks from the 2.4 backlog.
- [ ] **3.2** — Monthly GSC review: indexation coverage, top queries, CTR on the new titles/schema.
- [ ] **3.3** — Re-run this audit (or a competitor deep-dive vs. Localrent.com) once indexed, ideally with Ahrefs/Semrush connected for measured data.
- [ ] **3.4** — Core Web Vitals: run PageSpeed Insights on home + a JS-heavy page (vehicles); watch CLS from injected content.

---

## Progress at a glance

| Phase | Items | Theme |
|---|---|---|
| **1 · Quick wins** | 1.1 – 1.9 | Cheap fixes + correct the 2 risky items |
| **Gate · Deploy & Index** | G.1 – G.5 | Ship what's done; make Google look |
| **2 · Strategic** | 2.1 – 2.7 | Crawlable inventory, reviews, pages, content, localization, links |
| **3 · Ongoing** | 3.1 – 3.4 | Cadence + monitoring |

**Critical path:** 1.1 → 1.2 → (rest of Phase 1) → **Gate** → 2.1 → everything else.

---

## Next steps I can take on request
- Execute **Phase 1** now (it's all in-repo, no inventory/translation needed) — start with 1.1 (the schema risk).
- Draft the new pages for 2.3 (TBS airport, no-deposit) using the existing SUV-page template.
- Produce ready-to-paste corrected JSON-LD for 1.1/1.3.
- Build the content calendar for the 2.4 cluster.
