# Workflow Review & Proposed Updates — SEO-WORKFLOW.md

> Review of `SEO-WORKFLOW.md` for completeness & correctness against repo reality (2026-06-08).
> **Proposed** edits only — `SEO-WORKFLOW.md` is unchanged pending approval. On approval I'll merge sections A–C into it.

---

## Overall assessment

`SEO-WORKFLOW.md` is a strong, well-structured doc — the phase/gate/effort model is sound and its Phase-1 status is accurate. Its weaknesses are **drift** (the code moved past the checkboxes) and **three blind spots** the audit also missed (cloaking, hreflang/sitemap conflict, thin localized content). It also needs a few **correctness fixes** in its "done-when" criteria.

**Verdict:** keep the structure; apply the corrections below before using it to drive Wave 1.

---

## A. Status corrections (factual)

| Task | Current | Correct to | Why |
|---|---|---|---|
| 1.1 | `[x]` "removed from **LocalBusiness** JSON-LD" | `[x]` "removed from **AutoRental** JSON-LD" | The homepage block is `@type:"AutoRental"`, not `LocalBusiness`. Outcome correct, label wrong. |
| 1.3 | `[x]` "ka/ru dropped until real localized URLs exist" | **`[~]` REOPEN** | Precondition ("until 2.5") is now met — `/ru//ka/` are live. English pages under-declaring hreflang now **conflicts** with the sitemap + localized pages (N2). |
| 1.9 | `[x]` `lastmod 2026-05-29` | `[x]` (lastmods staggered) **+ add note**: sitemap still carries ru/ka alternates → couples to N2 | Sitemap declares ru/ka for every URL; must match the final localized scope. |
| 2.1 | `[~]` done-when: "view-source:vehicles.html shows real cars" | `[~]` done-when: "served `/vehicles.html` shows real cars **to both Googlebot and browser UAs**" | Current criterion is misleading — prerender is UA-gated, so plain view-source never shows cars. Also flag cloaking (N1). |
| 2.2 | `[ ]` "reviews page empty; 4.8 unverified" | `[ ]` **+ flag:** a crawler-only fabricated-review fallback was added and must be removed (N1) | Work happened that introduced risk; the checkbox hides it. |
| 2.5 | `[ ]` "only JS toggle, no localized URLs" | **`[~]` INFRA BUILT** | `i18n-render.js` serves `/ru//ka/` with localized title/meta/canonical/hreflang for core pages. Remaining work = **content** localization (N3), not infrastructure. |
| 2.6 | `[ ]` | `[~]` partial | `PRETTY_REDIRECTS` (301s) for 10 clean paths already exist; param→path canonicalization still open. |

---

## B. New tasks to insert (blind spots — become Phase 1.5, pre-gate)

> These are **hard gate blockers.** Insert a **"Phase 1.5 · Pre-deploy corrections"** between Phase 1 and the GATE.

### 1.10 — Remove cloaking & fabricated reviews ⛔ CRITICAL *(= T-01)*
- **Status:** `[ ]` · **Impact/Effort:** High (avoids manual action) · **M** · **Depends on:** none
- **Files:** `server/seo-prerender.js`, `reviews.html`, `vehicles.html`
- **Do:** Serve the vehicles/reviews prerender blocks to **all** visitors (remove `if (!crawler) return next()`); delete `FEATURED_REVIEWS` + the fabricated `else` branch; honest-empty when DB empty; fix stale comment.
- **Done when:** Googlebot-UA and browser-UA `curl` of `/vehicles.html` and `/reviews.html` return equivalent main content; no "Sarah M./David L./Elena K." in any served HTML; Rich Results Test shows no review snippet.

### 1.11 — Reconcile hreflang (HTML ↔ sitemap ↔ localized) *(= T-02)*
- **Status:** `[ ]` · **Impact/Effort:** Med-High · **S–M** · **Depends on:** 1.13
- **Files:** localizable `.html` heads, `sitemap.xml`
- **Do:** Make the hreflang cluster identical/reciprocal everywhere; only declare ru/ka for pages that genuinely render localized content.
- **Done when:** HTML == sitemap == `/ru/` == `/ka/` cluster per URL; 0 hreflang errors in GSC; no alternate resolves to a non-localized page.

### 1.12 — Resolve thin localized pages *(= T-03)*
- **Status:** `[ ]` · **Impact/Effort:** High · **M** (de-scope) / **L** (translate) · **Depends on:** 1.13
- **Files:** `server/i18n-render.js` (`LOCALIZABLE`, `SEO`), `sitemap.xml`, `lang/*.json`
- **Do:** Either translate category/blog/city bodies or remove them from `LOCALIZABLE` + sitemap until translated. Extend the SEO title/meta map to blog posts if kept.
- **Done when:** Every in-scope `/ru//ka/` page has a localized title **and** body; no thin English-body page is advertised as a localized alternate.

### 1.13 — Localization scope decision *(= T-04)* — ✅ DECIDED 2026-06-08
- **Decision:** **Translate everything**, rolled out incrementally — a page joins the `/ru//ka/` cluster only once its body is translated. Gate cluster = `index, vehicles, reviews, about, contact`; city → category → blog added via 2.x/S-03. Feeds 1.11 + 1.12.

### Move to Phase 2 / housekeeping
- **2.8 — Remove dev artifacts (N5):** `_mock-data.js`, `_validate.js`, `_veh13.json`, `_preview-vehicle.html`, `RoyalCar_Guide_GEO.html`, `data/myrent.db` — strip from deploy or disallow in `robots.txt`. **XS.**

---

## C. Structural / correctness improvements to the workflow

1. **Add an "Invariants" preamble** the whole doc must respect (mirror `SEO-IMPLEMENTATION-CONTRACTS.md` §Cross-contract):
   - no bot/human divergence on indexable pages; hreflang cluster == sitemap == localized pages; no localized URL without localized body; no schema claim without real on-page data.
2. **Add a hard pre-deploy blocker to the GATE:** G.4 should explicitly include a **cloaking check** (`curl` two UAs, diff main content) and a **live `/ru/` render check**, not just Rich Results.
3. **B-2 — ✅ resolved:** production runs the Express app on a **Hetzner VPS under PM2** (`ecosystem.config.js`). Server-side SEO layer is live (so N1 cloaking is live too). Keep one deploy-time gate check: nginx forwards real `User-Agent` (moot after 1.10) + TLS on `eliteauto.rent`.
4. **Fix the "Reality check" counts:** JSON-LD is on **23** HTML files (not 11); hreflang on **26** (not 13) — and all 26 declare en+x-default only (the N2 root cause). Update the table so the single biggest correction (1.3/N2) is visible.
5. **Tighten done-when criteria** to be **observable from the served response** (curl/Rich Results/GSC), never from "view-source" alone, since the server transforms responses by UA and path.
6. **Re-point the critical path:** `1.1 → 1.2 → (rest of Phase 1) → **1.10–1.13 (Phase 1.5)** → GATE → 2.1 → …`.

---

## D. What the workflow gets right (keep)

- Phase/gate/effort structure and the "ship what exists, then make Google look" thesis.
- Accurate Phase-1 status for 1.1, 1.2, 1.4–1.8.
- Correct identification of indexation as the #1 unlock and the two original risk items (AggregateRating, hreflang) as pre-deploy.
- The dependency framing (inventory → reviews; translation → hreflang) is right — it just under-recorded how much is already built and missed the regressions that building it introduced.
