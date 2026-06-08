# SEO Remediation Plan — EliteAuto.rent

> Companion to `SEO-FINDINGS-VALIDATION.md`. Defines the prioritized backlog, dependency graph, execution order, and risk register.
> **No code changes are made by this document.** Implementation contracts for every Critical/High ticket are in `SEO-IMPLEMENTATION-CONTRACTS.md`.

### Decisions locked (2026-06-08)
1. **Localization scope (T-04):** **Translate everything** — all category, blog, and city bodies into RU + KA. To avoid blocking indexation on a multi-day translation effort, this rolls out **incrementally**: a page enters the `/ru//ka/` hreflang + sitemap cluster **only once its body is translated**. The gate ships with the already-localized funnel (`index, vehicles, reviews, about, contact`); city → category → blog are translated and added in subsequent passes.
2. **Production host (B-2):** **Resolved — Node/Express on a Hetzner VPS under PM2** (`ecosystem.config.js`, `package.json start`, `.env DATABASE_URL`). The server-side SEO layer is live. ⇒ N1 cloaking is **currently live** for crawlers; T-01 is top priority. Confirm at deploy: nginx forwards real `User-Agent` (moot after T-01) and serves TLS for `eliteauto.rent`.
3. **Reviews (T-01):** **Remove the fabricated testimonials now.** The reviews page stays honestly empty for everyone until real reviews exist (re-enabled with real data + schema via S-02). Rationale: showing invented 5★ reviews — to anyone — is a fake-review/trust risk Google can penalize; an honest empty state is safer and recovers fully once real bookings produce reviews.

---

## 1. Guiding principle

The repo is **ahead of the audit** and most cheap wins are done. The lever is no longer "do more SEO" — it is:

1. **Stop the bleeding before indexing** — fix the cloaking/fabricated-review risk (N1) and the hreflang inconsistency (N2) so we don't index a penalty.
2. **Don't index thin duplicates** — either localize content or de-scope `/ru/`+`/ka/` thin pages (N3).
3. **Then deploy + index** (the unchanged #1 unlock).
4. **Then** grow inventory, reviews, content, and links.

> ⚠️ **Gate rule:** N1 and N2 are **hard pre-deploy blockers**. N3 must be **resolved or de-scoped** before the sitemap is submitted to GSC.

---

## 2. Prioritized ticket backlog

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low.
Effort: XS <30m · S <1h · M 1–4h · L multi-day · XL multi-week.
Status reflects repo reality 2026-06-08.

### Pre-deploy blockers (must clear the gate)

| ID | Title | Sev | Eff | Depends on | Status |
|---|---|---|---|---|---|
| **T-01** | Remove cloaking: serve prerender blocks to **all** visitors; drop fabricated-review fallback (N1, N6) | 🔴 | M | — | new |
| **T-02** | Reconcile hreflang across HTML + sitemap + localized pages (N2) | 🟠 | S–M | T-04 decision | new |
| **T-03** | Resolve thin localized pages: localize content **or** de-scope `LOCALIZABLE`+sitemap (N3) | 🟠 | M (de-scope) / L (translate) | T-02 | new |
| **T-04** | Decide localization scope (which pages are genuinely localized) — *decision ticket feeding T-02/T-03* | 🟠 | XS | — | new |

### Deploy & index gate (operational — unchanged from workflow)

| ID | Title | Sev | Eff | Depends on |
|---|---|---|---|---|
| **G-01** | Deploy corrected branch to production `eliteauto.rent` | 🔴 | S–M | T-01..T-03 |
| **G-02** | GSC: verify property, submit sitemap, URL-inspect + request-index key URLs | 🔴 | S | G-01 |
| **G-03** | Bing Webmaster: import from GSC, submit sitemap | 🟡 | XS | G-01 |
| **G-04** | Crawl/QA: Rich Results Test on schema pages (**no** review snippet), live `/ru/` render check, `curl` UA spot-checks confirm no human/bot divergence | 🟠 | S | G-01 |
| **G-05** | Baseline impressions/positions in GSC; optionally connect Ahrefs/Semrush | 🟡 | XS | G-02 |

### Post-deploy strategic (capture demand)

| ID | Title | Sev | Eff | Depends on |
|---|---|---|---|---|
| **S-01** | Onboard genuine partner inventory; verify DB-driven prerender shows real cars to all | 🟠 | L/XL | G-01 |
| **S-02** | Collect real reviews → render server-side to all → only then re-introduce Review/AggregateRating | 🟠 | XL | S-01, live bookings |
| **S-03** | **Translate everything (rolling):** localize city → category → blog **bodies** into RU+KA; extend SEO title/meta map to blog; each page rejoins the ru/ka hreflang+sitemap cluster as it's done | 🟠 | L–XL | T-02/T-03 |
| **S-04** | Param→path canonical location URLs (`/rent-a-car/tbilisi/`) as primary, not just 301 aliases | 🟡 | M–L | S-01 |
| **S-05** | Per-post unique hero images (replace 1.png/3.png reuse + gudauri og-preview) | 🔵 | S | real photos |
| **S-06** | Convert currency/language `#` anchors → `<button>`; deepen internal links | 🔵 | M | — |
| **S-07** | Remove dev artifacts from deploy / disallow in robots (N5) | 🔵 | XS | — |
| **S-08** | Link building & digital PR; Trustpilot profile (feeds S-02) | 🟠 | XL | content live |

### Ongoing

| ID | Title | Eff |
|---|---|---|
| O-01 | Publish cadence ≥1 post / 1–2 weeks | XL |
| O-02 | Monthly GSC review (coverage, queries, CTR) | — |
| O-03 | CWV: PageSpeed on home + vehicles; watch CLS from injected content | S |
| O-04 | Re-run audit/competitor deep-dive once indexed (Ahrefs/Semrush) | M |

---

## 3. Dependency graph

```
                 ┌──────────────────────────────────────────────┐
                 │  T-04  Decide localization scope (decision)   │
                 └───────────────┬───────────────┬──────────────┘
                                 │               │
        T-01  Remove cloaking    │               │
        (independent)            ▼               ▼
            │            T-02 Reconcile      T-03 Thin pages:
            │            hreflang             localize OR de-scope
            │                 │               │
            └──────┬──────────┴───────┬───────┘
                   ▼                  ▼
              ╔════════════════════════════╗
              ║  GATE: G-01 Deploy         ║
              ╚════════════╤═══════════════╝
                           ├──► G-02 GSC ──► G-05 Baseline
                           ├──► G-03 Bing
                           └──► G-04 Crawl/cloaking QA
                                       │
              ┌────────────────────────┼─────────────────────────┐
              ▼            ▼            ▼            ▼             ▼
           S-01 Inventory  S-04 URLs   S-03 i18n   S-05/06/07   S-08 Links
              │                                     (parallel,    │
              ▼                                      independent)  ▼
           S-02 Reviews ──────────────────────────────────────► (re-enable
              (needs real bookings)                               Review schema)
```

**Critical path:** `T-04 → T-02/T-03` ∥ `T-01` → **G-01 → G-02 → G-05** → `S-01 → S-02`.

---

## 4. Execution order (waves)

**Wave 0 — Decision.** ✅ Done — see "Decisions locked": translate-everything (rolling), Node host confirmed, remove fabricated reviews.

**Wave 1 — Pre-deploy fixes (this week).**
`T-01` (cloaking — remove UA-gating + delete fabricated reviews) and `T-02` (hreflang reconciled to the **funnel cluster only**: index, vehicles, reviews, about, contact). `T-03` here = **de-scope** city/category/blog from the ru/ka sitemap+hreflang cluster so nothing thin is advertised at the gate; their full translation proceeds in Wave 3 (`S-03`) and each page rejoins the cluster as it's translated. All code-local, no inventory/translation blocking the gate. Each has an Implementation Contract.

**Wave 2 — Gate (immediately after Wave 1 merges).**
`G-01 → G-02 → G-03 → G-04 → G-05`. The single biggest unlock; nothing ranks until this happens.

**Wave 3 — Strategic (this quarter, mostly parallel).**
`S-01` inventory (core growth) → unblocks `S-02` reviews and `S-04` URLs. `S-03`, `S-05`, `S-06`, `S-07`, `S-08` run in parallel as capacity allows.

**Wave 4 — Ongoing.** `O-01..O-04`.

---

## 5. Risk, blocker & regression register

| Risk | Type | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **N1 ships → cloaking/fake-review manual action** | Regression | High if deployed as-is | Severe (deindex/penalty) | T-01 before G-01; G-04 verifies bot==human content |
| Removing crawler-gating exposes the SEO blocks to users → visual/UX change on vehicles/reviews | Regression | Med | Low–Med | T-01 styles the block on-brand (already themed); QA in preview before deploy |
| Dropping the review fallback leaves reviews page empty for bots | Trade-off | High | Low | Intended — empty-but-honest beats fabricated; restore via S-02 with real data |
| hreflang fix makes English pages point to thin RU/KA (N3 unresolved) | Regression | Med | Med | Sequence T-03 with/just-after T-02; never declare an alternate to a thin page |
| De-scoping `/ru//ka/` pages 404s URLs already in sitemap | Regression | Low | Med | Remove from sitemap **in the same change**; add 301 or keep page, just drop from cluster |
| Inventory still empty at deploy → `ItemList`/featured cars fall back to categories | Known limitation | High | Low | Acceptable; category fallback is honest; S-01 fills it |
| `i18n-render` regex localizer corrupts markup on an edge page | Latent bug | Low | Med | Module is try/catch→next() (English fallback safe); add per-page render smoke test in G-04 |
| Re-introducing Review schema too early (S-02) | Regression | Med | Severe | Hard rule: schema rating only after real, on-page, server-rendered reviews exist |
| GA4 loads render-blocking before `<title>` on every page | Perf (CWV) | Med | Low–Med | O-03; consider deferring/async-after-LCP |
| Dev artifacts (N5) indexed or leak data | Exposure | Low | Low | S-07 before/at deploy |
| N1 cloaking is **already live** in production (Node host confirmed) | Active exposure | Certain (if app deployed) | Severe | Limited blast radius while unindexed; fix via T-01 before requesting indexing (G-02) |

**Hard blockers / preconditions:**
- **B-1 (operational):** Indexation needs a live deploy + GSC access — outside the repo.
- **B-2 — ✅ RESOLVED:** Production runs the **Express app on a Hetzner VPS under PM2** (`ecosystem.config.js`). Server-side SEO layer is live. Deploy-time check only: nginx forwards real `User-Agent` (moot post-T-01) + TLS on `eliteauto.rent`.
- **B-3:** Real inventory (S-01) and real bookings/reviews (S-02) are external dependencies that gate the highest-value transactional pages.

---

## 6. Open decisions — ✅ resolved 2026-06-08

See "Decisions locked" at top: **(1)** translate everything, rolling rollout; **(2)** Node host confirmed; **(3)** remove fabricated reviews now. No open decisions remain before Wave 1 — awaiting **go/no-go approval to implement.**

---

## 7. Success metrics

- **Gate:** all key URLs "Indexed" in GSC within 2–4 weeks of G-02; Rich Results Test shows valid schema and **no** review star snippet.
- **Integrity:** `curl` as Googlebot vs browser returns equivalent main content on `/vehicles.html` and `/reviews.html` (no cloaking).
- **International:** GSC International Targeting reports **0 hreflang errors**; `/ru/`,`/ka/` impressions begin accruing.
- **Growth:** first non-brand impressions on city/airport/category terms; referring domains appear (S-08).
