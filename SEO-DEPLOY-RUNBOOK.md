# Deploy & Index Runbook — Wave 1 → Live (EliteAuto.rent)

> ## ✅ STATUS UPDATE (2026-06-10)
> | Step | Status |
> |---|---|
> | 0–2 · Commit, deploy, verify fixes live | ✅ Done (cloaking/fake reviews removed, hreflang fixed, artifacts sealed) |
> | 3 · Google Search Console | ✅ Done — verified, sitemap submitted ("Success", 27 pages), key URLs indexing requested. 3 indexed, ~15 "Discovered" (normal queue for a new site) |
> | 4 · Bing Webmaster Tools | ⬜ **STILL OPEN** — bing.com/webmasters → "Import from GSC" → submit sitemap (5 min, needs your login) |
> | 5 · Baseline | ✅ Indexing report reviewed 2026-06-08 |
> | Post-gate: S-01 inventory SEO | ✅ Done — 10 real cars server-rendered, per-car pages w/ unique titles, dynamic auto-sitemap |
> | Post-gate: CSS/UX fixes | ✅ Done — footer mobile, 7 category pages, city-page nav button |
> | Local SEO: brand + NAP | ✅ Done — "EliteAuto" in homepage title; real address (13 University St, Tbilisi) in schema + footer (matches Google Business listing) |
> | Local SEO: Google reviews badge | ✅ Done — reviews page links to the real 5.0★ Google listing; `hasMap` in schema |
> | ⚠️ Duplicate Google listing | ⬜ **OPEN — user action**: "ELITE RENTAL GEORGIA" (1 review, Kavtaradze st 53 / 15 University St, same phone) duplicates the main listing. In Google Business Profile: report/remove the duplicate so reviews consolidate |
> | Google Business rename | ⬜ In progress (user) — renaming "Elite Rental Georgia" → match website brand; also rename Facebook to match |
> | S-02 on-site review texts | ⬜ Waiting — display 3–4 real Google review quotes on reviews.html (need texts from the owner; do NOT invent) |
> | S-03 RU/KA full translation | ⬜ Deferred (approved, rolling) |

> Plain-language, step-by-step. Your host: **Hetzner VPS, Node app under PM2, PostgreSQL.**
> Pre-flight passed 2026-06-08: all 24 key URLs indexable, no fake review schema, no cloaking, hreflang consistent.
> ⚠️ Nothing here is auto-done — these steps need your server login and your Google account. Claude can commit the code and walk you through each step, but cannot SSH to your server or sign in to Google for you.

---

## Step 0 — Save the code changes (git)

The Wave 1 edits are in your working copy but **not committed yet**. From this project folder:

```bash
git checkout -b seo-wave1            # work on a branch, not master
git add -A
git commit -m "SEO Wave 1: remove cloaking + fake reviews, fix hreflang, de-scope untranslated RU/KA, secure artifacts"
git push -u origin seo-wave1
```

*(Or just ask Claude: "commit and push Wave 1" — it will do exactly this.)*
When you're happy, merge to `master` (or deploy the branch directly).

---

## Step 1 — Put the new code on the server & restart

SSH into your Hetzner server, pull the code, restart PM2:

```bash
ssh root@YOUR_SERVER_IP
cd /path/to/Myrent.com          # the folder where the app lives
git pull                        # (or: git fetch && git checkout seo-wave1)
npm install --production        # only if dependencies changed (they didn't this time)
pm2 restart eliteauto
pm2 logs eliteauto --lines 30   # watch for "Server running" + "PostgreSQL database initialized"
```

**Good result:** logs show the server started with no red error stack. Press `Ctrl+C` to stop tailing logs.

---

## Step 2 — Verify the fixes are actually live (copy-paste these)

Run these from your own computer (or the server). Each line says what "good" looks like.

**2a. No cloaking** — Google and a normal visitor must get the same page:
```bash
curl -s -A "Googlebot" https://eliteauto.rent/reviews.html | grep -c "Sarah M."
curl -s -A "Mozilla"   https://eliteauto.rent/reviews.html | grep -c "Sarah M."
```
✅ Good: **both print `0`** (the fake testimonials are gone for everyone).

**2b. Homepage shows the browse block to everyone:**
```bash
curl -s https://eliteauto.rent/ | grep -c "Browse rental cars by type"
```
✅ Good: prints `1`.

**2c. Localized pages work, untranslated ones are English-only:**
```bash
curl -s https://eliteauto.rent/ru/about.html   | grep -o '<html lang="[a-z]*"'   # expect lang="ru"
curl -s -o /dev/null -w "%{http_code}\n" https://eliteauto.rent/ru/suv-rental-georgia.html  # expect 200 (English page)
```
✅ Good: about shows `lang="ru"`; the category page still returns `200` (served in English, no broken link).

**2d. Private files are sealed:**
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://eliteauto.rent/data/myrent.db        # expect 404
curl -s -o /dev/null -w "%{http_code}\n" https://eliteauto.rent/SECURITY-AUDIT.md     # expect 404
```
✅ Good: **both return `404`** (database and internal docs are no longer downloadable).

**2e. Sitemap loads as plain XML:**
```bash
curl -s https://eliteauto.rent/sitemap.xml | head -3      # expect the <?xml …> line
```

If any check fails, **stop** and tell Claude the output — don't proceed to indexing.

---

## Step 3 — Google Search Console (the actual "get indexed" step)

1. Go to **search.google.com/search-console** → "Add property" → **URL prefix** → `https://eliteauto.rent`.
2. **Verify ownership.** Easiest for you: the **"HTML tag"** method — Google gives you a `<meta name="google-site-verification" …>` tag. Paste it into the `<head>` of `index.html` (Claude can do this in one edit), redeploy, click Verify. *(Or use the "Google Analytics" method — you already have GA4 `G-4XTKG24HN6` on the site, which can verify automatically.)*
3. **Submit the sitemap:** left menu → **Sitemaps** → enter `sitemap.xml` → Submit.
4. **Request indexing** for the top pages: use the search bar at the top ("Inspect any URL"), paste each URL, then click **"Request indexing"**. Do these first:
   - `https://eliteauto.rent/`
   - `https://eliteauto.rent/vehicles.html`
   - `https://eliteauto.rent/rent-car-tbilisi.html`
   - `https://eliteauto.rent/rent-car-batumi.html`
   - `https://eliteauto.rent/rent-car-kutaisi.html`
   - `https://eliteauto.rent/tbilisi-airport-car-rental.html`
   - `https://eliteauto.rent/suv-rental-georgia.html`
   - `https://eliteauto.rent/no-deposit-car-rental-georgia.html`
   - the two best blog posts (Kazbegi guide, road-trip itinerary)
5. **Check International Targeting** (left menu → Legacy tools, or the page indexing report): after a few days it should report **0 hreflang errors**.
6. **Rich Results check:** open **search.google.com/test/rich-results**, test `https://eliteauto.rent/` and `https://eliteauto.rent/suv-rental-georgia.html`. Expect FAQ/Product/Breadcrumb to validate and **no review stars** anywhere.

---

## Step 4 — Bing Webmaster Tools (5 minutes, free traffic)

1. Go to **bing.com/webmasters** → sign in.
2. Click **"Import from Google Search Console"** (one click, reuses your verification).
3. Submit `https://eliteauto.rent/sitemap.xml`.

---

## Step 5 — Record a baseline

In GSC → **Performance**, note today's date. Impressions/clicks start near zero — that's your "before" line so you can measure Wave 2/3 impact later.

---

## If something goes wrong — rollback

```bash
# On the server:
git checkout master        # back to the previous version
pm2 restart eliteauto
```
Then tell Claude what happened. The code changes are isolated and every server module falls back to the plain English page on error, so a bad deploy degrades gracefully rather than breaking the site.

---

## What's next after the site is indexed (Wave 3)

In priority order: **S-01** onboard real inventory → **S-02** collect real reviews (then re-enable review schema + a genuine testimonials section) → **S-03** the full RU/KA translation (each page rejoins the language cluster as it's translated) → **S-08** link building. Details in `SEO-REMEDIATION-PLAN.md`.
