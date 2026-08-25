# CHAPTER 2 — EliteAuto.rent: Customer Acquisition, SEO, Marketing & Revenue Growth

> **Prepared:** 23 August 2026 · **Market:** Georgia (country) · **Business model:** marketplace + own fleet
> **Interactive version:** <https://claude.ai/code/artifact/fa57e63f-6f46-4503-8603-acb3965035ae>
>
> Built WITHOUT Chapter 1 financial data, at the owner's instruction. Every financial section is a scenario
> model grounded in (a) live eliteauto.rent prices, (b) the live reservation-fee matrix in
> `server/services/reservation-fee.js`, and (c) published Georgian tourism and aviation statistics.
> Anything that would require the books is marked **[Data unavailable — do not assume]**.
>
> **INTERNAL** — the server returns 404 for `.md`, but keep this out of public repos and deploys.

---
# Turning 94 cars into a booking engine

EliteAuto.rent sits in a market that added **7.8 million international visits in 2025** and moved **8.5 million air passengers** through three airports — and it is losing that traffic to aggregators on price, to Google on authority, and to itself at checkout. This chapter is the operating plan to fix that, in the order the money says to fix it.

- **94** — Cars live on site
- **\$39–\$2,000** — Daily price range
- **7.5–22.5%** — Platform fee band
- **0** — Vehicle URLs in sitemap
- **7.8M** — 2025 visits to Georgia
- **+29.4%** — Israeli visitors, 2025

------------------------------------------------------------------------

## 0 — How to read this, and what it is built on

Every recommendation below carries the same eight-part spine you asked for — **what → why → how → cost → time → expected impact → KPI → priority**. Priority is scored 1–10, where 1 is "this week" and 10 is "only after everything above it works."

#### Business model this chapter optimises

EliteAuto.rent is **both a marketplace and a storefront for your own fleet**. Two revenue lines, and they behave differently:

- **Own-fleet rental revenue** — the full daily rate on cars you own (the Highlander, Palisade, RAV4, Camry and the rest of Elite Rental Georgia's cars listed on the platform). High margin per booking, capped by how many cars you have.
- **Marketplace reservation fee** — a percentage of the base rental cost, charged `on top` of the rental and paid online by the guest. Scales with booking volume, not with capital. Governed by `server/services/reservation-fee.js`.
- **Partner signup** — \$4.99 PayPal or invite code. Not a revenue line; treat it as a supply-side qualification filter.

**⚑ Data boundary — read this before trusting any number**

You asked to skip Chapter 1 and run Chapter 2 standalone. So: **no figure in this document comes from your books.** There is no revenue, utilisation, cost, average-booking-value, expense or historical-conversion data in this session. The local database in your project folder is a development copy holding 20 test bookings and 4 test cars — it is not your business.

What *is* real here: your live site (94 cars and their prices, page source, schema, sitemap, translations), your fee matrix as coded, competitor pricing and terms read off their live sites, and published Georgian tourism and aviation statistics. Everything else is either arithmetic on those facts, or a clearly labelled scenario. Where a number would need your books, you will see \*\*\[Data unavailable — do not assume\]\*\*.

#### What was actually inspected

| Source                               | What it gave                                                                             | Status                     |
|--------------------------------------|------------------------------------------------------------------------------------------|----------------------------|
| eliteauto.rent live pages            | Fleet count, prices, titles, meta, canonicals, hreflang, JSON-LD, RU/KA/HE renders       | Verified                   |
| Project source (Myrent.com folder)   | Fee matrix, robots.txt, sitemap.xml, page HTML, SEO-engine data files, off-page playbook | Verified                   |
| Competitor sites                     | Localrent, DiscoverCars, Naniko, RentCarsGeorgia, cardrive.ge pricing & terms            | Read 23 Aug 2026           |
| GNTA / Civil Aviation Agency / press | Arrivals, source markets, seasonality, airport passenger volumes                         | Published stats            |
| Keyword volumes, CPC, difficulty     | —                                                                                        | Unavailable                |
| Your GA4 / Search Console figures    | —                                                                                        | Unavailable                |
| Your revenue, costs, utilisation     | —                                                                                        | Unavailable (Ch.1 skipped) |

**⚑ The three findings that change everything**

**1. The "\$25/day" claim is false against your own inventory.** Your cheapest live car is \$39/day. That claim is in your homepage title area, meta descriptions, landing pages, blog copy and Google Business Profile plan. Every visitor who clicks it and sees \$39 has been mis-sold before you say a word.

**2. The reservation fee makes you structurally more expensive than every aggregator, and worst on the cheapest cars.** A \$39/day car for 7 days costs the guest \$322.14 — an effective **\$46.02/day**, 62% above DiscoverCars' cheapest Georgian economy rate. The fee is 22.5% on budget short rentals and 7.5% on luxury long ones: highest exactly where price sensitivity is highest.

**3. Your most defensible asset is invisible to Google.** You list a Ferrari 296 GTB, a Mercedes G63 and a BMW M8 Competition. No aggregator in Georgia has that inventory. All 94 vehicle pages carry zero structured data and none of them are in your sitemap.

------------------------------------------------------------------------

## 2.1 — Market research and customer segments

Georgia's inbound market is large, still growing, and — crucially for a rental company — increasingly arriving *by air*, which is the only arrival mode that reliably converts into a car rental.

### The demand picture, verified

- **7,803,239** — International visits 2025 (+5.9%)

8.5MAir passengers, 3 airports 2025 41.2%Entries arriving by air \$3.6BTourism revenue Jan–Sep 2025 +17.2%Air arrivals growth \>2MVisitors in Jul–Sep alone

#### Source markets — where your customers physically come from

| Market     | Jan–Sep 2025 visits | Growth | What it means for a rental marketplace                                                                                                        |
|------------|---------------------|--------|-----------------------------------------------------------------------------------------------------------------------------------------------|
| Russia     | 1,250,000           | +12.1% | Largest volume and highest spend (\$823M). Russian-language SEO and Yandex/2GIS listings reach them; Google reaches them less well.           |
| Turkey     | 963,633             | −9.1%  | Mostly land-border, short-stay, low rental propensity. **Do not build for this segment.**                                                     |
| Armenia    | 720,114             | −1.7%  | Land border, own cars. Low rental propensity.                                                                                                 |
| Israel     | 293,699             | +27.8% | **The wedge.** Air-only, high self-drive culture, family groups, needs automatic transmission, books in Hebrew. Full-year 2025 growth +29.4%. |
| Azerbaijan | 220,168             | +34.9% | Land border mostly; some air. Secondary.                                                                                                      |
| EU + UK    | 499,890 (FY)        | +14%   | Air-only, highest ABV, longest itineraries, English-language search. UK +39.1%, Spain +48.6%, Italy +39.4%.                                   |
| China      | —                   | +44.4% | Fastest growth rate but small base and low self-drive rate. Watch, don't build.                                                               |

*Source: Georgian National Tourism Administration figures reported by Civil.ge and 1TV, 2025. Turkey/Armenia/Azerbaijan volumes include land-border same-day crossings, which is why their rental propensity is far below their headline share.*

#### Airports — your three physical funnels

| Airport       | Jan–Sep 2025 pax | Growth | Rental character                                                                                                                                                     | Your page            |
|---------------|------------------|--------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------|
| Tbilisi (TBS) | ~4,100,000       | +12%   | Business + leisure mix, year-round, longest rentals, highest ABV. Turkish/Georgian Airways/Pegasus feed it.                                                          | Live                 |
| Kutaisi (KUT) | ~1,400,000       | +10%   | Wizz Air budget gateway (Wizz = 17% of all Georgian air traffic, 1,065,618 pax). Price-sensitive, young, Svaneti-bound, needs a car because there is nothing at KUT. | Live                 |
| Batumi (BUS)  | 995,099          | +32%   | **Fastest-growing airport in the country.** Summer-concentrated, coastal, high family/group share. Your weakest content coverage.                                    | Live, no Hebrew twin |

*Source: Georgian Civil Aviation Agency data reported by Georgia Today, Jan–Sep 2025. Full-year total across all three: 8.5 million.*

### Seasonality — and the two shoulder seasons nobody is fighting for

Over two million of Georgia's visitors arrive in July–September. That is where the aggregators spend their budget and where prices compress. Two windows are structurally under-served:

- **December–March (ski).** Gudauri and Bakuriani drive winter demand; the season opens around 20 December. This is a 4×4/AWD demand pocket, and your SUV content is already the strongest cluster on your site. Winter rentals also carry a legitimate premium (snow tyres, chains, mountain-road risk).
- **April–May and October (shoulder).** Kakheti harvest in September–October, wildflowers and green Svaneti in May. Longer average stays, older/wealthier travellers, less price-shopping.

\*\*\[Data unavailable — do not assume\]\*\* — your own monthly booking distribution and utilisation by season are Chapter 1 figures and are not in this session. The seasonal *pricing* tiers in §2.17 are built on market seasonality, and must be re-cut against your real booking curve before you deploy them.

### Segment ranking by business value

Ranked by **platform fee per booking × realistic acquisition volume × conversion difficulty**. Booking values below are computed from your live prices and your live fee matrix, not estimated.

<table>
<colgroup>
<col style="width: 12%" />
<col style="width: 12%" />
<col style="width: 12%" />
<col style="width: 12%" />
<col style="width: 12%" />
<col style="width: 12%" />
<col style="width: 12%" />
<col style="width: 12%" />
</colgroup>
<thead>
<tr class="header">
<th>#</th>
<th>Segment</th>
<th class="num">Typical booking</th>
<th class="num">Platform fee</th>
<th class="num">Days</th>
<th>Price sensitivity</th>
<th>Best channel</th>
<th>Difficulty</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>1</td>
<td><strong>Luxury &amp; exotic self-drive</strong><br />
<em>Gulf/Russian/EU visitors, weddings, photo shoots, "drive a Ferrari in Tbilisi"</em></td>
<td class="num">$2,100–$6,000</td>
<td class="num">$252–$720</td>
<td class="num">2–4</td>
<td>Very low</td>
<td>Instagram/TikTok reels, GBP photos, concierge partnerships</td>
<td>Medium</td>
</tr>
<tr class="even">
<td>2</td>
<td><strong>Long-stay expats &amp; nomads (Tbilisi monthly)</strong></td>
<td class="num">$1,100–$1,300</td>
<td class="num">$84–$95</td>
<td class="num">14–30</td>
<td>Medium</td>
<td>SEO (monthly/long-term), expat Facebook groups</td>
<td>Low</td>
</tr>
<tr class="odd">
<td>3</td>
<td><strong>EU/UK road-trippers</strong><br />
<em>7–10 day itineraries, SUV, TBS in / TBS out</em></td>
<td class="num">$560–$650</td>
<td class="num">$50–$56</td>
<td class="num">7–10</td>
<td>Medium</td>
<td>SEO (route guides → SUV pages), travel-blog links</td>
<td>Medium</td>
</tr>
<tr class="even">
<td>4</td>
<td><strong>Israeli families</strong><br />
<em>Automatic, 7-seater, Hebrew, TBS</em></td>
<td class="num">$400–$650</td>
<td class="num">$50–$60</td>
<td class="num">6–8</td>
<td>Medium</td>
<td>Hebrew SEO + Israeli travel Facebook groups</td>
<td>Medium</td>
</tr>
<tr class="odd">
<td>5</td>
<td><strong>Ski-season 4×4 (Gudauri/Bakuriani)</strong></td>
<td class="num">$300–$500</td>
<td class="num">$40–$60</td>
<td class="num">4–7</td>
<td>Medium</td>
<td>Seasonal SEO + ski-hotel partnerships</td>
<td>Low</td>
</tr>
<tr class="even">
<td>6</td>
<td><strong>Corporate / business travel Tbilisi</strong></td>
<td class="num">$225–$525</td>
<td class="num">$30–$55</td>
<td class="num">3–7</td>
<td>Low</td>
<td>Direct B2B outreach, LinkedIn, hotel corporate desks</td>
<td>High</td>
</tr>
<tr class="odd">
<td>7</td>
<td><strong>Russian-speaking leisure</strong></td>
<td class="num">$250–$450</td>
<td class="num">$35–$55</td>
<td class="num">5–8</td>
<td>Medium</td>
<td>Yandex, 2GIS, RU-language pages, Telegram</td>
<td>Medium</td>
</tr>
<tr class="even">
<td>8</td>
<td><strong>Kutaisi budget flyers (Wizz Air)</strong></td>
<td class="num">$195–$275</td>
<td class="num">$35–$49</td>
<td class="num">5–7</td>
<td>Very high</td>
<td>SEO (KUT airport), price-led</td>
<td>High</td>
</tr>
<tr class="odd">
<td>9</td>
<td><strong>Local Georgian customers</strong></td>
<td class="num">$120–$250</td>
<td class="num">$26–$40</td>
<td class="num">2–5</td>
<td>Very high</td>
<td>Georgian-language SEO, Facebook, word of mouth</td>
<td>Medium</td>
</tr>
<tr class="even">
<td>10</td>
<td><strong>Turkish / Armenian land-border</strong></td>
<td class="num">—</td>
<td class="num">—</td>
<td class="num">—</td>
<td>Very high</td>
<td><strong>None — do not target</strong></td>
<td>Very high</td>
</tr>
</tbody>
</table>

*Booking values computed from live EliteAuto prices × typical duration; platform fee from the live matrix in server/services/reservation-fee.js. Acquisition volume is a judgement call informed by arrivals data, not a measured figure.*

**⚑ The conclusion the numbers force**

A single 3-day Ferrari booking pays you **\$720** in platform fee. A 3-day Ford Fusion booking pays you **\$26.32**. That is 27× the revenue from one transaction, in a segment where you have inventory nobody else in Georgia has, against competitors whose entire Georgian catalogue tops out around \$43/day. Segments 8, 9 and 10 are where the aggregators are strongest and your fee structure is most punishing. **Stop competing there and let those bookings arrive as overflow.**

------------------------------------------------------------------------

## 2.2 — Competitive intelligence

Read on 23 August 2026 from the competitors' own live pages. Anything marked unverified stays unverified — the internal `competitors.yaml` in your SEO engine still carries June 2026 assumptions that this pass corrects.

### Pricing — the comparison that matters most

The critical column is the last one. Aggregators charge the guest the advertised rate; EliteAuto adds a reservation fee on top. Compare like with like:

| Provider                         | Model                       | Headline economy        | SUV from | Prepayment                               | Deposit                        | Guest cost, 7-day cheapest car       |
|----------------------------------|-----------------------------|-------------------------|----------|------------------------------------------|--------------------------------|--------------------------------------|
| **EliteAuto.rent**               | Marketplace, guest-paid fee | \$39/day claims \$25    | \$45     | Reservation fee online, rental at pickup | Varies; no-deposit page exists | **\$322.14** (\$46.02/day effective) |
| Localrent                        | Regional aggregator         | \$15                    | \$19     | 15–20% by card, balance in cash          | None or up to \$100            | \$105.00                             |
| DiscoverCars                     | Global aggregator           | \$26.95–\$37.89         | \$35.23  | Prepaid online                           | Supplier card block typical    | \$188.65–\$198.94                    |
| RentCarsGeorgia                  | Marketplace (closest twin)  | \$17                    | —        | Not stated                               | Not stated                     | ~\$119                               |
| Naniko                           | Own fleet, multi-country    | 74 GEL (~\$27)          | —        | Booking form / callback                  | Not stated                     | ~\$189                               |
| cardrive.ge                      | Own fleet, 9 languages      | 120 GEL (~\$45)         | —        | Not stated                               | Not stated                     | ~\$315                               |
| Sixt / Hertz / Europcar / Dollar | International, TBS counters | from ~\$34 (Skyscanner) | —        | Prepaid or at counter                    | Credit card mandatory          | ~\$238+                              |

*Read from live pages 23 Aug 2026. EliteAuto column computed: \$39 × 7 = \$273 base + 18% medium-duration budget-tier fee = \$49.14 → \$322.14. Rates are not perfectly like-for-like (car age, insurance depth, mileage, season all vary) — but the gap is far too wide to be explained by those.*

**⚑ Structural pricing problem**

On the segment you currently advertise hardest — cheap cars, short-to-medium rentals — you are the most expensive option on the page, and the fee is invisible until checkout. Localrent shows a Trustpilot score of **4.8/5 from 4,509 reviews** and takes a 15–20% card deposit with the balance in cash; you take a 22.5% non-refundable-feeling fee up front on a \$117 booking. That is a losing fight, and no amount of SEO fixes it. §2.17 has the two ways out.

### Website, SEO and conversion comparison

| Dimension                   | EliteAuto.rent                                                                  | Localrent                             | DiscoverCars                                               | RentCarsGeorgia                        | Trent.ge                    |
|-----------------------------|---------------------------------------------------------------------------------|---------------------------------------|------------------------------------------------------------|----------------------------------------|-----------------------------|
| Indexable landing pages     | 34 EN + 15 HE = 49                                                              | Hundreds (city × category × supplier) | Thousands                                                  | ~15–20 + guides                        | Few                         |
| Vehicle pages indexable     | Not in sitemap, no schema                                                       | Yes, per car per city                 | Yes                                                        | Yes                                    | Yes                         |
| Languages                   | EN / RU / KA / HE — RU & KA partially translated                                | **22 languages**                      | Many                                                       | EN only                                | KA only                     |
| Hebrew presence             | 15 hand-authored RTL pages                                                      | Unverified                            | Unverified                                                 | None                                   | None                        |
| Public review volume        | Near zero                                                                       | Trustpilot 4.8, 4,509                 | Trustpilot 282,717 overall; 8.7/10 from 28 Georgia reviews | Claims "5.0 Google", "1200+ customers" | ~412 Google (June 2026)     |
| Domain age / authority      | New (May 2026), near-zero backlinks                                             | Years                                 | Years, global                                              | Older than EliteAuto                   | Aged                        |
| Booking mechanics           | Reservation → OTP → PayPal fee → partner accepts                                | Instant, voucher emailed              | Instant confirmation                                       | Booking form                           | Instant + WhatsApp/Telegram |
| Free cancellation           | Claimed on homepage                                                             | Yes                                   | **Displayed on every listing**                             | Not stated                             | Unverified                  |
| Structured data             | AutoRental, FAQPage, Product, Breadcrumb on landing pages; **none on vehicles** | Extensive                             | Extensive                                                  | Unverified                             | Unverified                  |
| Exotic / supercar inventory | Ferrari, G63, M8 — unique                                                       | Luxury from \$30/day (ordinary)       | Standard classes only                                      | Claims "premium"                       | No                          |
| Chauffeur / driver service  | Page exists but ~57 words, no H2s                                               | No                                    | No                                                         | No                                     | No                          |

### Where EliteAuto can actually outperform

#### 1 · Exotic & supercar rental

No aggregator in Georgia lists a Ferrari. DiscoverCars' Georgian catalogue tops out near \$43/day. You have three cars nobody can match, and they generate 10–27× the platform fee of a budget booking. **This is the only category where you are the market, not a participant.**

#### 2 · Chauffeur / with-driver rental

Structurally impossible for a self-drive aggregator to offer. Your `drivers.html` exists but is ~57 words with zero H2s. Russian, Gulf and older EU travellers frequently want a car *with* a driver — and it converts at a far higher day rate.

#### 3 · Hebrew, done properly

The Hebrew SERP is **not** empty — Avis Israel, Ofran, travel-tbilisi.co.il and cardrive.ge/il all rank. But cardrive's Hebrew is a thin translation with no FAQ, no terms, and no Israeli phone number. Your 15 hand-authored RTL pages already beat that on depth. The gap is a native proofread and Israeli-market trust signals.

#### 4 · Georgian-language market

Trent.ge owns Georgian with an aged domain, but the international players ignore Georgian entirely. Your `/ka/` exists — it is just half-translated. Fixing it is cheap and there is no aggregator competing.

#### 5 · Route-guide content depth

Aggregators write generic destination pages. You can write "the Zugdidi–Mestia road in April, from someone who drives it" — but only if you actually add operator experience. Every one of your 9 guides currently has `has_eeat_signals: false`.

#### 6 · Delivery to hotel / Airbnb

Aggregator suppliers hand over at a counter or a lot. Delivering to the guest's actual address in Tbilisi, Batumi or Gudauri is a real operational advantage you already have coded (`pickup_fees` with airport and delivery fees per vehicle) — and it is barely marketed.

**⚑ Where you cannot win, and should stop trying**

**Head terms.** "car rental georgia", "car rental tbilisi", "rent a car tbilisi" are held by Localrent, DiscoverCars, KAYAK, Skyscanner, Expedia, Sixt and Hertz. Your domain is ~15 months old with near-zero backlinks and a brand name that collides with Elite Rent a Car in Montenegro, Nice and Houston, and Elite Auto Rentals in St Lucia. Searching your own brand surfaces those companies. Chasing head terms with a \$0 link budget is the most expensive way to achieve nothing.

------------------------------------------------------------------------

## 2.3 — Website audit — technical, on-page, structured data

### Findings, ranked by revenue consequence

#### The "\$25/day" claim is unsupported by inventory

— **Priority 1**

**What:** Homepage meta description, `vehicles.html`, the economy and cheap landing pages, blog copy, the GBP product plan and the RU/KA/HE translations all say "from \$25/day". The cheapest live vehicle is a 2018 Ford Fusion at **\$39/day**. The SUV page says "from \$50/day" while the cheapest SUV is \$45 — that one is merely wrong in your favour.

**Why it matters:** Every ad, snippet and listing built on \$25 sets an expectation the site breaks in one click. It inflates bounce, kills trust before the funnel starts, and is the kind of claim that gets a Google Ads account disapproved for misleading pricing.

  
**How:** Global find-and-replace of "\$25" price claims to the true floor, in EN/RU/KA/HE plus GBP products. Then either (a) restate honestly as "from \$39/day", or (b) list one genuine sub-\$30 economy car and keep the claim.  
**Cost:** \$0 — 2–3 hours of editing  
**Time:** 1 day  
**Impact:** High — removes the single largest trust breakage  
**KPI:** Landing-page bounce rate; booking-start rate

#### 94 vehicle pages are invisible to search

— **Priority 2**

**What:** `vehicle.html?id=N` is server-prerendered correctly — title, meta, canonical and H1 all resolve per car (verified: "Rent Toyota Highlander 2017 in Tbilisi — \$80.00/day"). But **zero vehicle URLs appear in sitemap.xml** (50 URLs total: 34 root HTML, 15 Hebrew, 1 root) and **no vehicle page carries any JSON-LD**.

**Why it matters:** These are your highest-intent pages — a person searching "Hyundai Palisade rental Tbilisi" is ready to book. Without sitemap inclusion they rely entirely on internal-link discovery through a JS-rendered listing. Without Product/Offer schema they cannot show price, availability or rating in the SERP.

  
**How:** Generate sitemap vehicle entries from the DB at build/deploy; emit `Product` + `Offer` (and `Car` where accurate) JSON-LD in the prerenderer; add a static HTML fallback link block on vehicles.html  
**Cost:** \$0 in-house — ~1 developer day  
**Time:** 1–2 days  
**Impact:** Very high — 94 new indexable commercial pages  
**KPI:** Indexed pages in GSC; impressions on model-name queries

#### Russian and Georgian pages are half-translated

— **Priority 3**

**What:** `/ru/` and `/ka/` render with correct localised title, description, H1 and canonical — then leak English throughout: navigation labels, feature blocks ("No Hidden Fees", "Economy cars from \$25/day", "24/7 Service"), FAQ answers and the entire footer.

**Why it matters:** Russia is your largest source market by both volume and spend. A half-English page reads as untrustworthy to exactly the audience least likely to give you a second chance, and mixed-language pages are weak candidates for ranking in either language.

  
**How:** Diff `lang/en.json` against ru.json and ka.json for missing keys; audit for hardcoded English strings without `data-i18n` attributes; have a native speaker review each language once  
**Cost:** \$150–\$400 for native review of both  
**Time:** 3–5 days  
**Impact:** High for RU market  
**KPI:** Sessions and CVR on /ru/ and /ka/

#### Homepage ships 442 KB of text across 18 requests, 10 of them render-blocking

— **Priority 4**

**What (measured from source):** 58 KB HTML + 189 KB CSS in 4 files + 131 KB JS in 12 files + a 64 KB `lang/en.json` fetched by i18n.js. Only `api-helper.js` and `i18n.js` use `defer`; ten scripts block rendering, including `script.js` (63 KB) and `navbar-auth.js` (20 KB). The `images/` folder is ~28 MB across 20 files, 16 of them over 300 KB — including 6.2 MB (`vip.jpeg`), 4.7 MB (`logo4.png`), 2.3 MB (`logo3.png`) and a 1.4 MB Open Graph image.

**Why it matters:** Mobile tourists on Georgian roaming data are your core audience. Every render-blocking script pushes Largest Contentful Paint out. A 1.4 MB OG image also degrades every social share preview.

  
**How:** Add `defer` to all 10; merge style.css + premium.css + theme.css; inline critical CSS; convert every PNG over 300 KB to WebP (you already have `logo.webp` at 40 KB vs `logo.png` at 1.5 MB — the pattern exists, apply it everywhere); regenerate og-preview.jpg under 300 KB  
**Cost:** \$0 — script already exists at scripts/optimize-images.js  
**Time:** 1 day  
**Impact:** Medium-high on mobile CVR  
**KPI:** LCP, INP, CLS in CrUX; mobile bounce

\*\*\[Data unavailable — do not assume\]\*\* Actual Core Web Vitals field values. Run PageSpeed Insights and read the CrUX panel in Search Console before and after; the payload figures above are from source files and are exact, the resulting LCP is not.

#### hreflang is inconsistent across page types

— **Priority 5**

**What:** The homepage and `vehicles.html` declare en / ru / ka / he / x-default. Every commercial landing page declares only en / he / x-default. `vehicle.html` declares en / x-default. `drivers.html` the same.

**Why:** hreflang must be reciprocal and complete. Partial sets cause Google to ignore the cluster, so your Russian and Georgian versions of commercial pages get no locale targeting at all.

  
**How:** Emit the full 5-way hreflang set from the head-injector for every public page, including the /ru/ and /ka/ prerendered paths and vehicle pages  
**Cost:** \$0 — server/head-inject.js already exists  
**Time:** Half a day  
**Impact:** Medium  
**KPI:** GSC International Targeting errors → 0

#### Reviews page has no review schema, and almost no reviews

— **Priority 6**

**What:** `reviews.html` carries only `BreadcrumbList` — no `Review`, no `AggregateRating`. Meanwhile Trent.ge holds ~412 Google reviews and Localrent shows 4,509 on Trustpilot.

**Why:** Review count is the strongest trust signal in the rental category and the biggest single ranking factor in the local pack. This is your largest competitive deficit and it costs nothing but persistence to close.

  
**How:** Ship the review-collection loop in §2.7 first; add `AggregateRating` to the organisation and `Review` markup only once real reviews exist — never before  
**Cost:** \$0  
**Time:** Ongoing  
**Impact:** Very high, slow-building  
**KPI:** Google review count & velocity

#### Thin and orphaned content

— **Priority 7**

**What:** Against your own 1,200-word minimum: `explore-georgia` 275 words, `svaneti-mestia-road-trip` 454, `kakheti-wine-region-by-car` 472, `tbilisi-to-batumi-drive` 486, `is-it-safe-to-drive-in-georgia` 608, `tbilisi-to-gudauri` 680, `georgia-road-trip-itinerary` 725 (and it is a *pillar*). Every single guide is flagged `has_eeat_signals: false`. `drivers.html` has ~57 words and zero H2 headings.

  
**How:** Expand the four thinnest to 1,200–1,800 words with genuine operator detail (road surface by season, fuel-stop spacing, where the phone signal dies, actual parking costs). Rebuild drivers.html as a real service page.  
**Cost:** \$0 in-house / ~\$60–100 per piece outsourced  
**Time:** 2 weeks  
**Impact:** Medium  
**KPI:** Avg. position & impressions per guide

#### Two pages competing for the same intent

— **Priority 8**

**What:** `cheap-car-rental-georgia.html` and `economy-car-rental-georgia.html` target near-identical intent, both flagged in your own keyword registry as a cannibalisation risk. Your own data file already says "watch cannibalization in GSC".

  
**How:** Check GSC: if both pages rank for the same queries, 301 the weaker into the stronger and keep one. If they genuinely split ("cheap" = price intent, "economy" = car-class intent), rewrite each to serve only its own intent and cross-link.  
**Cost:** \$0  
**Time:** Half a day  
**Impact:** Low-medium  
**KPI:** Combined clicks for the surviving URL

#### What is already correct — do not touch

- **robots.txt** — correctly allows crawl, blocks `/api/`, admin, partner dashboards, `/uploads/`, `/data/`, and declares the sitemap. Keep `/uploads/` disallowed: vehicle tech-passport documents live there.
- **HTTPS, canonicals, 301 pretty-URL redirects, 404 page** — all in place.
- **Server-side prerendering for crawlers** — genuinely well built. It makes the JS-heavy vehicle pages crawlable and gives you the /ru/ and /ka/ paths.
- **Homepage structured data** — `AutoRental`, `WebSite` + `SearchAction`, `FAQPage`, `OfferCatalog`, `OpeningHoursSpecification`. Appropriate and compliant.
- **Noindex on funnel pages** — reservation, booking, login, register, leave-a-review are correctly excluded.
- **Title and meta lengths** — within limits everywhere except `tbilisi-airport-car-rental.html` at 166 characters (trim to ≤160).

#### Structured data to add — and what to avoid

| Schema                             | Where                 | Status              | Note                                                                                                                                                                            |
|------------------------------------|-----------------------|---------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Organization / AutoRental          | Homepage, about       | Present             | Add `sameAs` for Facebook, Instagram, GBP once live                                                                                                                             |
| LocalBusiness (AutoRental subtype) | Homepage + city pages | Partial             | Needs real `address`, `geo`, `openingHours` matching GBP exactly                                                                                                                |
| Product + Offer                    | Every vehicle page    | Missing             | **Highest-value addition.** Requires `image`, `price`, `priceCurrency`, `availability`                                                                                          |
| Car / Vehicle                      | Vehicle pages         | Missing             | Use alongside Product only where `vehicleTransmission`, `seatingCapacity`, `fuelType` are real DB values                                                                        |
| AggregateOffer                     | Category pages        | Present on SUV page | Roll out to all category pages — **must reflect true low price** (see the \$25 issue)                                                                                           |
| BreadcrumbList                     | All landing/blog      | Present             | Extend to vehicle pages                                                                                                                                                         |
| FAQPage                            | Landing pages         | Present             | Questions must be visible on the page. Rich-result eligibility is now limited to authoritative sites — keep it for clarity, not for stars                                       |
| Article                            | Blog guides           | Present             | Add real `author` with a bio page once E-E-A-T signals exist                                                                                                                    |
| Review / AggregateRating           | Reviews page          | Missing             | **Only after real reviews exist.** Self-serving review markup on your own organisation is not eligible for rich results and marking up invented reviews is a manual-action risk |

------------------------------------------------------------------------

## 2.4 — Keyword research and roadmap

**⚑ Volume, CPC and difficulty are unavailable — and you must not let anyone invent them**

\*\*\[Data unavailable — do not assume\]\*\* This session has no Ahrefs, Semrush, or Keyword Planner access, and your own `.seo-engine/data/seo-keywords.csv` has **0 in every volume, difficulty and CPC field** — the registry was seeded but never populated. Any number you have seen presented as "1,900 searches/month for car rental Georgia" was fabricated.

**Get the real numbers this week, free:** (1) Google Ads → Tools → Keyword Planner gives volume and top-of-page bid ranges for Georgia; a live campaign unlocks exact volumes. (2) Search Console → Performance → Queries already holds your *actual* impression counts, which beat any third-party estimate for your own site. (3) Google Trends for relative seasonality. Fill the CSV from those three and re-rank the table below by measured volume.

What follows is ranked by **business value and winnability**, which is what you can actually judge without volume data. Business value is computed from your live prices and fee matrix. Difficulty is judged from the SERP as it stood on 23 August 2026.

### Group A — Exotic & luxury (highest value, lowest competition)

| Keyword                           | Intent        | SERP difficulty | Fee per booking | Target page                               | Priority |
|-----------------------------------|---------------|-----------------|-----------------|-------------------------------------------|----------|
| rent ferrari tbilisi / georgia    | Transactional | Low             | \$720           | New: /supercar-rental-tbilisi             | 1        |
| supercar rental georgia           | Transactional | Low             | \$252–720       | New: /supercar-rental-tbilisi             | 1        |
| rent mercedes g63 tbilisi         | Transactional | Low             | \$288           | Vehicle page + supercar hub               | 1        |
| luxury car rental tbilisi         | Commercial    | Medium          | \$84–252        | luxury-car-rental-tbilisi.html *(exists)* | 2        |
| wedding car rental tbilisi        | Transactional | Low             | \$252+          | New: /wedding-car-rental-tbilisi          | 3        |
| exotic car rental georgia country | Commercial    | Low             | \$252–720       | Supercar hub                              | 3        |

*Fee per booking computed at 3 days from live prices via the reservation-fee matrix. These terms have low volume — that is fine: one Ferrari booking equals 27 Ford Fusion bookings in platform revenue.*

### Group B — Vehicle model terms (94 pages, currently unindexed)

| Keyword pattern                            | Intent        | Difficulty | Live price | Target page              | Priority |
|--------------------------------------------|---------------|------------|------------|--------------------------|----------|
| toyota highlander rental georgia / tbilisi | Transactional | Low        | \$80/day   | vehicle.html?id=1        | 1        |
| hyundai palisade rental georgia            | Transactional | Low        | \$85/day   | Vehicle page             | 1        |
| toyota rav4 rental georgia                 | Transactional | Medium     | \$45/day   | Vehicle page             | 2        |
| toyota camry rental tbilisi                | Transactional | Medium     | \$75/day   | Vehicle page             | 2        |
| mitsubishi outlander rental georgia        | Transactional | Low        | —          | Vehicle page if in fleet | 3        |
| toyota prius rental tbilisi                | Transactional | Low        | \$39/day   | Vehicle page             | 3        |
| \[brand\] \[model\] rent georgia × 94      | Transactional | Low        | varies     | One vehicle page each    | 1        |

*This entire group is unreachable today: no vehicle URL is in the sitemap and no vehicle page has structured data. Fixing §2.3 finding \#2 unlocks all of it at once.*

### Group C — Airport terms (highest commercial intent)

| Keyword                                        | Intent                   | Difficulty | Notes on the live SERP                                                                             | Target page                     | Priority |
|------------------------------------------------|--------------------------|------------|----------------------------------------------------------------------------------------------------|---------------------------------|----------|
| tbilisi airport car rental / TBS car rental    | Transactional            | High       | Sixt, Hertz, Europcar, Dollar, Skyscanner, Expedia all hold positions                              | tbilisi-airport-car-rental.html | 2        |
| kutaisi airport car rental / KUT               | Transactional            | Medium     | Weaker field — no major brand counter at KUT. **Winnable.** Wizz Air = 17% of Georgian air traffic | kutaisi-airport-car-rental.html | 1        |
| batumi airport car rental / BUS                | Transactional            | Low-med    | Weakest field of the three, and BUS grew +32% — the fastest in the country                         | batumi-airport-car-rental.html  | 1        |
| car rental tbilisi airport arrivals / terminal | Transactional            | Low        | Long-tail with real intent; almost nobody writes the practical "where do I meet you" content       | TBS page section                | 2        |
| kutaisi airport to mestia / svaneti by car     | Informational→commercial | Low        | Perfect KUT → SUV bridge; nobody owns it                                                           | New guide → SUV page            | 3        |

### Group D — Terms & policy (differentiator intent)

| Keyword                                        | Intent        | Difficulty | SERP reality                                                                                                                           | Target page                        | Priority |
|------------------------------------------------|---------------|------------|----------------------------------------------------------------------------------------------------------------------------------------|------------------------------------|----------|
| no deposit car rental georgia                  | Commercial    | Medium     | **Contested** — rentiocars.com, rentalcartbilisi.com, fstarentcar.com, clarifycarhire.co.uk all target it. Field is weak but not empty | no-deposit-car-rental-georgia.html | 1        |
| car rental georgia without credit card         | Commercial    | Low        | Under-served variant of the above                                                                                                      | Same page, new H2                  | 2        |
| car rental insurance georgia what's covered    | Informational | Low        | Already queued as q_003 in your engine. Strong angle: aggregator insurance upsell vs included                                          | New guide                          | 2        |
| automatic car rental georgia                   | Commercial    | Medium     | Matters enormously to US and Israeli renters                                                                                           | automatic-car-rental-georgia.html  | 2        |
| international driving permit georgia           | Informational | Medium     | Queued as q_008. Cannibalises is-it-safe unless given a country-table angle                                                            | New guide, distinct angle          | 4        |
| one way car rental georgia (tbilisi to batumi) | Transactional | Low        | Real unmet need on a 6-hour drive. Nobody markets it                                                                                   | New: /one-way-car-rental-georgia   | 3        |

### Group E — Location & route terms

| Keyword                                   | Intent     | Difficulty | Target page                                                        | Priority |
|-------------------------------------------|------------|------------|--------------------------------------------------------------------|----------|
| car rental gudauri / gudauri ski car hire | Commercial | Low        | New: /car-rental-gudauri (seasonal, build by October)              | 2        |
| car rental kazbegi / stepantsminda        | Commercial | Low        | New: /car-rental-kazbegi                                           | 3        |
| car rental kakheti / wine region          | Commercial | Low        | New: /car-rental-kakheti                                           | 3        |
| car rental borjomi / bakuriani            | Commercial | Low        | New: /car-rental-bakuriani (winter pair to Gudauri)                | 4        |
| car rental svaneti / mestia               | Commercial | Low        | New: /car-rental-svaneti — highest 4×4 intent of any location term | 3        |
| rent a car tbilisi / batumi / kutaisi     | Commercial | High       | Existing city pages — maintain, don't over-invest                  | 5        |
| car rental georgia / rent a car georgia   | Commercial | Very high  | Homepage. **Do not chase directly.** Earn it through the long tail | 9        |

### Group F — Hebrew and Russian

| Keyword                        | Language | Difficulty | SERP reality                                                                                                                                                                                                                                       | Priority |
|--------------------------------|----------|------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|
| השכרת רכב בגאורגיה             | Hebrew   | Medium     | **Correction to your internal assumption:** the Hebrew SERP is contested — Avis Israel, Ofran, travel-tbilisi.co.il, paapmpaapm.com and cardrive.ge/il all rank. But cardrive's Hebrew is a thin translation with no FAQ or terms. Depth wins here | 1        |
| השכרת רכב בטביליסי             | Hebrew   | Medium     | Hebrew city page exists                                                                                                                                                                                                                            | 2        |
| השכרת רכב אוטומטי גאורגיה      | Hebrew   | Low        | Automatic matters more to Israeli renters than almost any other attribute                                                                                                                                                                          | 2        |
| аренда авто в грузии / тбилиси | Russian  | High       | Largest source market. Yandex matters as much as Google here                                                                                                                                                                                       | 2        |
| аренда авто без залога грузия  | Russian  | Medium     | No-deposit angle translated into the highest-volume market                                                                                                                                                                                         | 2        |
| прокат внедорожника грузия     | Russian  | Low        | SUV + Russian = your strongest content cluster in your largest market                                                                                                                                                                              | 3        |

### Prioritised roadmap

| Wave       | When        | Keyword groups                                        | Work required                                                                                   | Why this order                                                                                            |
|------------|-------------|-------------------------------------------------------|-------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|
| **Wave 1** | Days 1–30   | Group B (all 94 models) + Group A (exotic)            | Sitemap + Product schema for vehicles; build the supercar hub page                              | Unlocks 94 existing pages with one engineering change, and opens the only uncontested high-value category |
| **Wave 2** | Days 31–60  | Group C (KUT + BUS) + Group D (no-deposit, insurance) | Rewrite the two weaker airport pages with practical arrival detail; publish the insurance guide | Highest commercial intent in the weakest fields; airports convert best                                    |
| **Wave 3** | Days 61–90  | Group E (Gudauri, Svaneti, Kazbegi, Kakheti)          | 4 new location pages, live before the December ski season opens                                 | Seasonal — Gudauri content published in January is a year late                                            |
| **Wave 4** | Months 4–6  | Group F (Hebrew pillar + Russian rebuild)             | Native proofread of Hebrew; complete RU translation; Yandex Business + 2GIS                     | Requires the RU/KA translation fix from §2.3 to land first                                                |
| **Wave 5** | Months 7–12 | Group C (TBS) + Group E city terms + head terms       | Link building, digital PR, review volume                                                        | These need authority, and authority is the slowest input                                                  |

------------------------------------------------------------------------

## 2.5 — Website architecture

Your existing structure is flat: everything is a root-level `.html` file. That works and you have server-side pretty-URL redirects already (`/rent-a-car/tbilisi` → `rent-car-tbilisi.html`). **Do not rewrite what already ranks.** Add the missing branches and give new pages clean URLs from day one.

| Section                                     | URL                                                       | Status           | Job                                                                                                          |
|---------------------------------------------|-----------------------------------------------------------|------------------|--------------------------------------------------------------------------------------------------------------|
| Homepage                                    | `/`                                                       | Live             | Search widget + trust + category entry points                                                                |
| Fleet index                                 | `/cars` → vehicles.html                                   | Live             | Filterable listing, 94 cars                                                                                  |
| **Vehicle detail**                          | `/car/toyota-highlander-2017`                             | Query-param only | **Add slug URLs** with 301 from `?id=`. See §2.6                                                             |
| Category — SUV                              | `/suv-rental-georgia`                                     | Live             | Best-supported category; keep as the flagship                                                                |
| Category — economy                          | `/economy-car-rental-georgia`                             | Cannibalising    | Resolve against /cheap-car-rental-georgia                                                                    |
| Category — sedan                            | `/sedan-rental-georgia`                                   | Live             | Low priority                                                                                                 |
| Category — 7-seater                         | `/minivan-7-seater-rental-georgia`                        | Live             | Israeli + family segment                                                                                     |
| Category — luxury                           | `/luxury-car-rental-tbilisi`                              | Live             | Rework as the funnel into supercar                                                                           |
| **Category — supercar**                     | `/supercar-rental-tbilisi`                                | Missing          | **Build first.** Ferrari, G63, M8 — highest fee per booking in the business                                  |
| Category — automatic                        | `/automatic-car-rental-georgia`                           | Live             | US/IL intent                                                                                                 |
| Airports ×3                                 | `/{tbilisi,kutaisi,batumi}-airport-car-rental`            | Live             | KUT and BUS need rewriting, not creating                                                                     |
| Cities ×3                                   | `/rent-a-car/{tbilisi,batumi,kutaisi}`                    | Live             | Maintain                                                                                                     |
| **Destinations ×5**                         | `/car-rental-{gudauri,kazbegi,kakheti,svaneti,bakuriani}` | Missing          | Commercial pages, distinct from the blog route guides that link into them                                    |
| Duration — monthly                          | `/monthly-long-term-car-rental-tbilisi`                   | Live             | Expat/nomad segment; second-highest-value segment                                                            |
| **Duration — weekly**                       | `/weekly-car-rental-georgia`                              | Missing          | Only if you commit to a real 7-day tier price. Otherwise skip — a page with no distinct offer is a thin page |
| No-deposit                                  | `/no-deposit-car-rental-georgia`                          | Live             | Legitimate: your DB has per-vehicle `deposit_amount`. Only list cars where it is genuinely \$0               |
| **One-way**                                 | `/one-way-car-rental-georgia`                             | Missing          | Tbilisi→Batumi is a 6-hour drive people do one-way. Unclaimed                                                |
| **With driver**                             | `/car-with-driver-georgia`                                | Thin (57 words)  | Rebuild drivers.html properly — aggregators structurally cannot offer this                                   |
| Blog hub + 9 guides                         | `/blog` + slugs                                           | Thin             | Expand the four thinnest; every guide must link its commercial page                                          |
| About / Contact / Reviews / Terms / Privacy | —                                                         | Live             | About needs real E-E-A-T: named people, address, registration number                                         |
| Partner program                             | `/partner-program`                                        | Live             | Supply side — keep out of the guest funnel                                                                   |

#### Rules for the architecture

- **One page per intent, never per keyword variant.** "cheap" and "economy" is already one collision too many.
- **Filters stay filters.** Your `vehicles.html` facets (engine, gearbox, drive type, interior, steering side, payment method, year, price band) must never generate indexable URLs. Their combinatorial space is enormous and 99% of the combinations are worthless pages. Keep them client-side or `noindex`; build a dedicated landing page only where there is a real search intent — which is exactly the category pages you already have.
- **Every commercial page links to at least two vehicle pages** and every vehicle page links back to its category and city. That is how the 94 new pages get crawled and how authority flows.
- **Blog guides feed commercial pages, never the reverse.** A Kazbegi guide links to `/suv-rental-georgia` and `/car-rental-kazbegi`; those pages do not link back into the blog above the fold.

------------------------------------------------------------------------

## 2.6 — Vehicle page SEO — the reusable template

This is the single highest-leverage engineering task in the whole chapter: 94 pages that already render correctly but cannot be found. Your database already holds nearly every field the template needs — `brand, model, year, category, seats, doors, gearbox, drive_type, engine, engine_cc, horsepower, fuel_consumption, luggage, deposit_amount, insurance, pickup_fees, price_tiers, min_age, mileage_km, multimedia, gallery`.

#### Template — every vehicle page, generated from DB fields

| Element             | Pattern                                                                                                                                                                  | Source                         |
|---------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------|
| URL                 | `/car/{brand}-{model}-{year}` with numeric fallback on collision; 301 from `?id=`                                                                                        | brand, model, year             |
| Title (≤60)         | Rent {Brand} {Model} {Year} in {City} — \${price}/day                                                                                                                    | Already correct in prerenderer |
| Meta (≤160)         | {Brand} {Model} {Year} for rent in {City}: {seats} seats, {gearbox}, {drive}. From \${price}/day, {deposit clause}, airport delivery available.                          | DB                             |
| H1                  | Rent {Brand} {Model} {Year} in {City}                                                                                                                                    | Already correct                |
| H2 block            | Specifications · What it costs · Where you can pick it up · What's included · Rental requirements · Reviews · Questions about this car · Similar cars                    | Fixed template                 |
| Photos              | Full gallery, WebP, descriptive alt: "{Brand} {Model} {Year} — {angle} — rental car in {City}"                                                                           | gallery                        |
| Price block         | Daily rate + **the duration tiers** from `price_tiers` (1–3 / 4–7 / 8–14 / 15–30) shown as a table, with the reservation fee stated before checkout                      | price_per_day, price_tiers     |
| Availability        | Live calendar from `vehicle_availability`; "Available from {date}" when the next 7 days are blocked                                                                      | vehicle_availability           |
| Specs table         | Seats · doors · gearbox · drive · engine + cc + hp · fuel type · consumption · luggage · year · multimedia · min age                                                     | DB                             |
| Deposit & insurance | Exact `deposit_amount`, exact `insurance` JSON (tpl/cdw/full). **Never a generic "insurance included"**                                                                  | deposit_amount, insurance      |
| Pickup & delivery   | Office address, airport fee, delivery fee — actual numbers from `pickup_fees`                                                                                            | pickup_fees                    |
| Unique copy         | 80–150 words per car written for that car: what it's good for, which roads it handles, who it suits. **Not a template with the model name swapped in**                   | Manual, one-off                |
| FAQ                 | 3–5 questions genuinely specific to the car ("Can the Highlander handle the Ushguli road?"). Visible on page                                                             | Manual                         |
| Reviews             | Real reviews for this vehicle only, once they exist                                                                                                                      | reviews table                  |
| Similar cars        | 3–4 same category, similar price. Internal linking engine                                                                                                                | Query                          |
| CTAs                | Primary "Check availability" (sticky on mobile) · WhatsApp with car name pre-filled · phone · "Ask about this car"                                                       | —                              |
| Schema              | `Product` + `Offer` (price, priceCurrency USD, availability, priceValidUntil) + `Car` (vehicleTransmission, seatingCapacity, fuelType, vehicleEngine) + `BreadcrumbList` | DB                             |
| Sitemap             | Auto-generated entry per approved, visible vehicle; removed when status ≠ approved                                                                                       | Build step                     |

**⚑ The line between 94 useful pages and 94 doorway pages**

Google's guidance on scaled content is explicit: pages generated at scale that add no value for the user are spam, regardless of how they were produced. The difference is entirely in the **unique copy** and **FAQ** rows above. A page that is a spec table plus a stock paragraph with the model name substituted is a doorway page. A page that says "the 2017 Highlander is the one we send to Ushguli — the ground clearance handles the last 12 km of gravel, and the third row folds flat for luggage" is a genuine page.

**Practical sequencing:** ship schema + sitemap + specs for all 94 at once (that part is legitimately automated — it is structured factual data), then write the unique 80–150 words at roughly 10 cars a week, highest-value first: the exotics, then your own fleet, then partners' cars by price descending. Do not publish a car to the sitemap until its unique block exists.

------------------------------------------------------------------------

## 2.7 — Local SEO and Google Business Profile

Your review count is near zero. Trent.ge holds ~412. Localrent shows 4,509 on Trustpilot. **This gap, not your code, is what keeps you out of the local pack.** Your existing `OFFPAGE-PLAYBOOK.md` already gets the mechanics right — this section builds on it rather than repeating it, and corrects the parts that reference the false \$25 price.

### Profile configuration

| Field            | Set it to                                                                                                                                                                                | Why                                                                                                                                                                                                     |
|------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Business name    | **EliteAuto.rent** — with the .rent                                                                                                                                                      | Your brand collides with Elite Rent a Car (Montenegro, Nice, Houston) and Elite Auto Rentals (St Lucia). The TLD is what makes you findable. Never add keywords to the name — that is a suspension risk |
| Primary category | Car rental agency                                                                                                                                                                        | Single most important local ranking field                                                                                                                                                               |
| Secondary        | Car leasing service · Van rental agency · Luxury car rental (if offered) · Chauffeur service (only if drivers.html reflects a real operating service)                                    | Each opens a different query set. Do not add categories for services you cannot deliver                                                                                                                 |
| NAP              | 13 University St, Tbilisi 0186, Georgia · +995 591 522 299 · elite.rental25@gmail.com                                                                                                    | Character-identical across every citation. Your playbook already fixes this as canonical                                                                                                                |
| Hours            | Your *real* hours. If you genuinely do 24/7 airport pickup by arrangement, set staffed hours and describe 24/7 pickup as a service                                                       | "24/7" that nobody answers at 03:00 generates one-star reviews                                                                                                                                          |
| Service area     | Tbilisi, Batumi, Kutaisi, Gudauri, Kazbegi, Kakheti, Bakuriani, Mestia                                                                                                                   | Extends reach without fake locations                                                                                                                                                                    |
| Products         | One per category page with **corrected** prices: Economy from \$39 · Sedan from \$39 · SUV from \$45 · 7-seater · Luxury from \$80 · Supercar from \$700 · Monthly                       | Products show in the profile with photos and link straight to the landing page. **Your playbook currently lists "\$25/day" — fix before publishing**                                                    |
| Services         | Airport delivery (TBS/KUT/BUS) · hotel & Airbnb delivery · one-way rental · no-deposit rental · long-term rental · child seat · snow chains · with driver                                | Each becomes a matchable query                                                                                                                                                                          |
| Photos           | 20+ at launch, one per week after. Office exterior with signage and street number, counter, real staff faces, one per car class, cars at airport arrivals, a 30-second walk-around video | Photo count and freshness correlate strongly with local pack placement                                                                                                                                  |
| Q&A              | Seed 5 real questions and answer them from the business account: deposit, licence/IDP, airport meeting point, winter tyres, cross-border to Armenia                                      | Free real estate that also pre-answers objections                                                                                                                                                       |

### 90-day Google Business Profile plan

| Days      | Actions                                                                                                                                                                                                                                                                                        | Target                        | KPI                                                                |
|-----------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------|--------------------------------------------------------------------|
| **1–7**   | Remove the duplicate "Elite Rental Georgia" listing (Maps → Suggest an edit → Remove → Duplicate). Verify the surviving listing. Set name, categories, NAP, hours, service area. Upload 20 photos. Write the business description. Seed 5 Q&As.                                                | One clean verified listing    | Verification complete                                              |
| **8–30**  | Launch the review loop below with every customer at key handback. Publish 2 Google Posts a week (a car, a route, a seasonal offer). Add all Products with corrected prices. Claim Yandex Business, 2GIS, Bing Places, Apple Business Connect, Trustpilot, Tripadvisor — NAP identical on each. | 10+ reviews, 8 citations live | Review count; citation count                                       |
| **31–60** | Reply to every review within 24 hours, personally, referencing the actual car and trip. Weekly photo. Add seasonal Products (ski-ready 4×4, snow chains). Monitor Insights for which queries surface you.                                                                                      | 25+ reviews, 4.6+ average     | Discovery vs direct searches; calls; direction requests            |
| **61–90** | Sustain 8–12 new reviews per month. Post the winter/Gudauri offer. Add photos from real customer trips (with permission). Answer new Q&As within a day. Review the Insights → query report and feed new terms into the keyword registry.                                                       | 40+ reviews                   | Local pack position for "car rental Tbilisi"; GBP → website clicks |

### Getting reviews without breaking Google's rules

**⚑ The three rules that get profiles suspended**

**Never offer anything in exchange for a review** — no discount, no free day, no entry into a draw. This includes "leave a review and get 10% off your next rental". **Never gate** — you cannot ask how the trip went and route only the happy ones to Google. **Never bulk-request** — 30 review links sent in one hour reads as a review-gating campaign and can trigger a filter that removes them all. Ask everyone, ask individually, ask at the moment of handback.

- **The moment matters more than the message.** Ask at key handback, in person, while the customer is still standing there and the trip is fresh — not by email three days later.
- **Use the QR card you already built.** `leave-a-review.html` exists with a QR CTA; set the real Google review link in it and print it as a counter card and a glovebox card.
- **Send the follow-up 2–4 hours after return**, by WhatsApp, one at a time, from a person not a system.
- **Reply to every review within 24 hours**, including bad ones. Response rate is itself a ranking and trust signal, and a calm reply to a one-star review converts more readers than the review costs you.
- **Realistic target:** at a 20–30% response rate you need roughly 35–50 completed rentals to reach 10 reviews. \*\*\[Data unavailable — do not assume\]\*\* your actual monthly rental count, so the timeline is yours to compute.

### Review request messages

Send by WhatsApp, individually, 2–4 hours after the car comes back. Replace the bracketed fields. No incentive is offered in any version — that is deliberate.

#### English

Hi \[Name\] — thanks for renting the \[Car\] with us, and I hope \[Kazbegi / Batumi / your trip\] was everything you wanted.

If you have a spare minute, a short Google review would genuinely help other travellers find us — we're a small local team and reviews are how people decide whether to trust us with their trip.

\[review link\]

Either way, thank you for choosing us. Safe travels — \[Your name\], EliteAuto.rent

#### ქართული

გამარჯობა, \[სახელი\]! გმადლობთ, რომ ჩვენთან იქირავეთ \[მანქანა\] — იმედია, \[ყაზბეგში / ბათუმში\] მოგზაურობა კარგად ჩაიარა.

თუ ერთი წუთი მოიცლით, ძალიან დაგვეხმარებოდით Google-ზე მოკლე შეფასების დატოვებით. ჩვენ პატარა ადგილობრივი გუნდი ვართ და სწორედ შეფასებებით ირჩევენ ადამიანები, ვის ანდონ თავიანთი მოგზაურობა.

\[შეფასების ბმული\]

ყველა შემთხვევაში, გმადლობთ არჩევანისთვის. კარგ გზას გისურვებთ — \[თქვენი სახელი\], EliteAuto.rent

#### Русский

Здравствуйте, \[Имя\]! Спасибо, что арендовали у нас \[автомобиль\] — надеюсь, поездка \[в Казбеги / в Батуми\] прошла отлично.

Если найдётся свободная минута, короткий отзыв в Google очень нам поможет. Мы небольшая местная команда, и именно по отзывам путешественники решают, кому доверить свою поездку.

\[ссылка на отзыв\]

В любом случае — спасибо, что выбрали нас. Хорошей дороги! — \[Ваше имя\], EliteAuto.rent

#### עברית — bonus, for your fastest-growing market

שלום \[שם\], תודה שהשכרתם אצלנו את ה\[רכב\] — מקווה שהטיול \[לקזבגי / לבטומי\] היה מוצלח.

אם יש לכם דקה פנויה, ביקורת קצרה בגוגל תעזור מאוד למטיילים אחרים למצוא אותנו. אנחנו צוות מקומי קטן, וביקורות הן הדרך שבה אנשים מחליטים למי לתת אמון.

\[קישור לביקורת\]

תודה שבחרתם בנו, ונסיעה טובה — \[השם שלך\], EliteAuto.rent

Have a native speaker read the Georgian, Russian and Hebrew versions once before you start sending them at volume — machine-adjacent phrasing in a review request undermines the exact trust you are asking for.

------------------------------------------------------------------------

## 2.8 — International SEO

You run four languages. Two of them are broken, one is your genuine competitive edge, and one is your largest market. Fix in that order.

| Language                  | Market                                                            | Current state                                                   | Justified?              | Action                                                                                                                                                                   |
|---------------------------|-------------------------------------------------------------------|-----------------------------------------------------------------|-------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **English**               | EU/UK (499,890, +14%), US, global                                 | 34 landing pages, complete                                      | Yes — primary           | Maintain; this is the default and x-default target                                                                                                                       |
| **Russian**               | Russia (1.25M visits, \$823M spend — largest by both measures)    | Half-translated — /ru/ leaks English nav, features, FAQ, footer | Yes — highest volume    | Complete the translation, then build RU versions of the top 8 commercial pages, then Yandex Business + 2GIS listings                                                     |
| **Hebrew**                | Israel (293,699, +27.8% / +29.4% FY — fastest-growing air market) | 15 hand-authored RTL pages — **your deepest non-English asset** | Yes — best ROI          | Native proofread (outstanding since Wave 2 shipped), add Israeli trust signals, build the Hebrew pillar                                                                  |
| **Georgian**              | Domestic (5.5M domestic tourists, +8.4%)                          | Half-translated                                                 | Yes, but lower priority | Complete translation. Low booking value per customer, but zero aggregator competition and it signals local legitimacy                                                    |
| Arabic                    | Gulf visitors — high luxury propensity                            | None                                                            | Only for supercar       | **Not a full site.** One Arabic supercar/chauffeur landing page, if and only if the exotic segment proves out. Gulf travellers are the natural buyers of a \$800/day G63 |
| Turkish / Armenian        | Land-border, low rental propensity                                | None                                                            | No                      | **Do not build.** Turkey is declining (−9.1%) and both markets arrive in their own cars                                                                                  |
| Polish / German / Chinese | Growing but small bases                                           | None                                                            | Not yet                 | Revisit at month 12 with GSC country data. Localrent runs 22 languages — you cannot and should not match that                                                            |

#### Technical design

| Element           | Decision                                                                                                       | Reason                                                                                                                                                       |
|-------------------|----------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
| URL structure     | Subdirectory: `/` (en) · `/ru/` · `/ka/` · `/he/`                                                              | Already built and correct. Subdirectories inherit domain authority; subdomains and ccTLDs would split it — fatal for a 15-month-old domain                   |
| hreflang          | Full reciprocal 5-way set (en, ru, ka, he, x-default) on **every** public page from the head-injector          | Currently only the homepage and vehicles.html carry the full set. Partial sets get ignored entirely                                                          |
| x-default         | Points to the English version                                                                                  | English is the widest-reach fallback for unmatched locales                                                                                                   |
| Metadata          | Translated, not transliterated — and **written to the target-language search intent**                          | Israelis search השכרת רכב אוטומטי (automatic) far more than English speakers search "automatic". A literal translation of an English title misses the intent |
| Landing pages     | Translate the 8 highest-value commercial pages per language, not all 34                                        | Depth in 8 pages beats thin coverage of 34. Intent differs by market — Hebrew needs automatic/7-seater emphasis; Russian needs no-deposit and SUV            |
| Vehicle pages     | Localised metadata only; specs are language-neutral                                                            | 94 × 4 hand-written descriptions is unaffordable and would create thin duplicates                                                                            |
| Language switcher | Real `<a href>` links, always visible, labelled in the target language (Русский, ქართული, עברית) — never flags | Crawlable links let Google discover locale versions. Flags map to countries, not languages                                                                   |
| Internal linking  | Links stay within the locale; only the switcher crosses languages                                              | Prevents authority leaking across clusters and stops users being dumped into a language they cannot read                                                     |
| RTL               | `rtl.css` + `dir="rtl"`, already implemented for /he/                                                          | Correct as built                                                                                                                                             |
| Currency          | USD default; GEL, EUR, ILS, RUB, TRY, AED already in the switcher                                              | Default the currency by detected locale — an Israeli visitor seeing ₪ converts better than one doing mental arithmetic                                       |

**⚑ Do not machine-translate the whole site**

Search intent is not translation-stable. "No deposit car rental" is a strong Russian query (аренда авто без залога — deposits are a real friction point for Russian travellers using cards abroad) and a weak Georgian one. "7-seater" matters enormously in Hebrew and barely in Russian. Translate the *page*, then re-do keyword selection natively for that market and drop the pages that have no intent behind them.

------------------------------------------------------------------------

## 2.9 — Content marketing

You have nine guides. Seven are below your own 1,200-word minimum and **all nine carry `has_eeat_signals: false`**. Before writing anything new: the fastest content win available to you is adding real operator experience to what already exists. You drive these roads. Nobody writing a Georgia road-trip listicle from London does.

### Clusters

| Cluster             | Pillar                                                         | Cluster pages                                                                               | Feeds                      | State                                      |
|---------------------|----------------------------------------------------------------|---------------------------------------------------------------------------------------------|----------------------------|--------------------------------------------|
| Renting in Georgia  | Complete Guide to Renting a Car in Georgia (1,490w)            | Insurance · IDP/licence · no-deposit · payment & deposits · one-way                         | All category pages         | Pillar OK, 3 of 5 clusters missing         |
| Road trips          | Georgia Road Trip Itinerary (725w — **too thin for a pillar**) | Kazbegi · Batumi · Gudauri · Kakheti · Svaneti · Borjomi · day trips                        | SUV, sedan, 7-seater pages | Pillar needs doubling; 3 clusters thin     |
| Airports            | **Missing**                                                    | TBS · KUT · BUS practical arrival guides                                                    | 3 airport landing pages    | Landing pages exist, no supporting content |
| **Luxury & exotic** | **Missing**                                                    | Driving a supercar in Tbilisi · best roads for a performance car · wedding cars · chauffeur | Supercar + luxury pages    | Entirely absent — highest-value gap        |
| Winter & ski        | **Missing**                                                    | Gudauri drive · Bakuriani · winter tyres law · snow chains · road closures                  | SUV page, new Gudauri page | One guide exists (Gudauri, 680w)           |
| Long-stay Tbilisi   | **Missing**                                                    | Monthly rental vs buying · parking in Tbilisi · expat driving admin                         | Monthly page               | Absent — segment \#2 by value              |
| Hebrew              | Queued (q_007)                                                 | Hebrew twins of the top guides                                                              | 15 Hebrew pages            | Landing pages live, no Hebrew content      |

### Priority articles

<table style="width:100%;">
<colgroup>
<col style="width: 16%" />
<col style="width: 16%" />
<col style="width: 16%" />
<col style="width: 16%" />
<col style="width: 16%" />
<col style="width: 16%" />
</colgroup>
<thead>
<tr class="header">
<th>#</th>
<th>Title / target keyword</th>
<th>Intent</th>
<th>Links to</th>
<th>Schema</th>
<th>Business value</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>1</td>
<td><strong>Driving a Supercar in Georgia: Roads, Rules and What It Actually Costs</strong><br />
<em>kw: supercar rental georgia</em></td>
<td>Commercial investigation</td>
<td>/supercar-rental-tbilisi, Ferrari + G63 + M8 vehicle pages</td>
<td>Article + FAQPage</td>
<td>Very high — $252–720/booking</td>
</tr>
<tr class="even">
<td>2</td>
<td><strong>Car Rental Insurance in Georgia: What's Actually Covered</strong><br />
<em>kw: car rental insurance georgia</em></td>
<td>Informational→consideration</td>
<td>no-deposit page, all category pages</td>
<td>Article + FAQPage</td>
<td>High — kills the #1 objection</td>
</tr>
<tr class="odd">
<td>3</td>
<td><strong>Renting a Car at Kutaisi Airport: The Complete Wizz Air Arrival Guide</strong><br />
<em>kw: kutaisi airport car rental</em></td>
<td>Transactional support</td>
<td>kutaisi-airport-car-rental, SUV</td>
<td>Article + FAQPage</td>
<td>High — weakest airport SERP</td>
</tr>
<tr class="even">
<td>4</td>
<td><strong>Batumi by Car: Airport Pickup, Parking and Coastal Routes</strong><br />
<em>kw: batumi airport car rental</em></td>
<td>Transactional support</td>
<td>batumi-airport, rent-car-batumi</td>
<td>Article + FAQPage</td>
<td>High — BUS +32%</td>
</tr>
<tr class="odd">
<td>5</td>
<td><strong>Gudauri Ski Season by Car: Snow Tyres, Chains and the Road Up</strong><br />
<em>kw: car rental gudauri</em></td>
<td>Commercial investigation</td>
<td>New /car-rental-gudauri, SUV</td>
<td>Article + FAQPage</td>
<td>High — publish by October</td>
</tr>
<tr class="even">
<td>6</td>
<td><strong>Living in Tbilisi Without Buying a Car: Monthly Rental Maths</strong><br />
<em>kw: monthly car rental tbilisi</em></td>
<td>Commercial investigation</td>
<td>monthly-long-term page</td>
<td>Article + FAQPage</td>
<td>High — 14–30 day bookings</td>
</tr>
<tr class="odd">
<td>7</td>
<td><strong>Booking Direct vs Booking Through an Aggregator in Georgia</strong><br />
<em>kw: localrent alternative georgia</em></td>
<td>Commercial investigation</td>
<td>Homepage, no-deposit</td>
<td>Article</td>
<td>Medium — <em>only</em> with verified competitor facts</td>
</tr>
<tr class="even">
<td>8</td>
<td><strong>MAINTENANCE: expand Kakheti (472w), Svaneti (454w), Batumi drive (486w), Itinerary pillar (725w)</strong></td>
<td>Informational</td>
<td>Existing cluster links</td>
<td>Article</td>
<td>Medium — cheapest ranking gain available</td>
</tr>
<tr class="odd">
<td>9</td>
<td><strong>Hiring a Car with a Driver in Georgia: When It Beats Self-Drive</strong><br />
<em>kw: car with driver georgia</em></td>
<td>Commercial investigation</td>
<td>Rebuilt drivers.html</td>
<td>Article + Service</td>
<td>Medium — aggregators cannot compete</td>
</tr>
<tr class="even">
<td>10</td>
<td><strong>השכרת רכב בגאורגיה — המדריך המלא</strong> (Hebrew pillar)</td>
<td>Commercial</td>
<td>All 15 Hebrew pages</td>
<td>Article + FAQPage</td>
<td>High — fastest-growing market</td>
</tr>
</tbody>
</table>

### 12-month content calendar

Four pieces a month, matching your own `max_posts_per_month: 4`. Seasonal pieces publish **8–12 weeks before** the demand they target — Gudauri content in January is worthless.

| Month    | Piece 1                                | Piece 2                           | Piece 3                             | Piece 4                          | Season served                     |
|----------|----------------------------------------|-----------------------------------|-------------------------------------|----------------------------------|-----------------------------------|
| Sep 2026 | Supercar guide                         | Insurance guide                   | Expand Kakheti to 1,400w            | Kutaisi arrival guide            | Autumn shoulder + Kakheti harvest |
| Oct      | **Gudauri ski guide**                  | Winter tyres & chains: the law    | Expand Svaneti to 1,400w            | Batumi by car                    | **Ski season prep**               |
| Nov      | Bakuriani vs Gudauri                   | Monthly rental maths              | Rebuild drivers.html as a real page | Winter road conditions by region | Ski + winter long-stay            |
| Dec      | Christmas & New Year in Georgia by car | Expand road-trip pillar to 1,600w | Hebrew pillar                       | Aggregator vs direct comparison  | Peak ski + holiday                |
| Jan 2027 | 7-day winter itinerary                 | Hebrew: Tbilisi city guide        | Expand Tbilisi–Batumi drive         | One-way rental guide             | Ski peak + early spring planning  |
| Feb      | Spring road-trip planning              | Russian: SUV guide                | Day trips from Tbilisi              | IDP & licence country table      | **Summer booking starts here**    |
| Mar      | 10-day Georgia itinerary               | Best SUV for Georgian roads       | Russian: no-deposit guide           | Kazbegi in spring                | Summer planning peak              |
| Apr      | Best car for Georgian road trips       | Wine route by car (expanded)      | Hebrew: automatic rental            | Parking in Tbilisi               | Shoulder + summer bookings        |
| May      | Black Sea coast road trip              | Family road trip with kids        | Best 7-seater for Georgia           | Borjomi & Vardzia                | Peak summer bookings              |
| Jun      | Svaneti in summer                      | Tusheti: what you actually need   | Hebrew: family road trip            | Georgia in 5 days                | Peak season                       |
| Jul      | Beat the heat: mountain routes         | Russian: Batumi guide             | Refresh top 5 by traffic            | Cross-border to Armenia          | Peak season                       |
| Aug      | Autumn wine harvest guide              | Refresh next 5 by traffic         | Best luxury cars for Tbilisi        | Annual content audit             | Autumn shoulder                   |

#### Non-negotiables for every piece

- **One real operator detail per article, minimum.** A photo you took, a price you paid, a road condition you saw. This is what your engine's `has_eeat_signals` flag is asking for and what nine of nine pieces currently lack.
- **Cannibalisation check before writing**, against `content-map.yaml` — 16 landing pages and 9 guides already claim most commercial terms.
- **Every guide links its commercial page** above the fold and at the end, with a real CTA rather than a generic "browse cars".
- **Publish means published:** root file + blog.html card + sitemap entry + inbound links + deploy + GSC indexing request. Your own checklist already says this.

------------------------------------------------------------------------

## 2.10 — Link building and digital PR

Your own project notes identify near-zero backlinks as the binding constraint on ranking — not code, not content. That diagnosis is correct. What follows is the acquisition plan; the outreach templates in your `OFFPAGE-PLAYBOOK.md` are good and should be used as written.

| Tier | Target                                                                                                                                                 | What you offer                                                         | Realistic yield                                                        | Effort                          | Priority |
|------|--------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------|------------------------------------------------------------------------|---------------------------------|----------|
| 1    | **Citations & directories** — Yandex Business, 2GIS, Trustpilot, Tripadvisor, Bing Places, Apple Business Connect, Foursquare, Yell.ge, Companyinfo.ge | Accurate NAP                                                           | 9–12 links, mostly nofollow but real trust signals                     | 1 day total                     | 1        |
| 2    | **Hotels, guesthouses, Airbnb hosts** in Tbilisi, Batumi, Gudauri, Kazbegi                                                                             | Guest discount code + commission + window cards + QR                   | 5–15 links from guest-services pages                                   | Ongoing outreach                | 1        |
| 3    | **Georgia travel blogs** — wander-lush.org and the long tail of "renting a car in Georgia" guides                                                      | Reader discount code, affiliate commission, complimentary press rental | 3–8 editorial links — **the highest-authority links available to you** | High — personalised pitches     | 1        |
| 4    | **Tour operators & guides**                                                                                                                            | Cross-referral: you send guided-tour requests, they send self-drive    | 3–8 reciprocal links                                                   | Medium                          | 2        |
| 5    | **Israeli travel media & Facebook communities** (מטיילים בגאורגיה and similar)                                                                         | Hebrew-language service, Hebrew support, honest answers in-group       | 2–5 links + direct bookings                                            | Medium — needs a Hebrew speaker | 1        |
| 6    | **Ski & outdoor sites** — Gudauri and Bakuriani lodges, ski schools, snowboard schools                                                                 | Winter 4×4 package, seasonal partnership                               | 3–6 seasonal links                                                     | Medium — pitch in October       | 2        |
| 7    | **Expat & nomad resources** — Tbilisi expat sites, nomad guides, relocation blogs                                                                      | Monthly rental offer                                                   | 2–5 links                                                              | Low                             | 2        |
| 8    | **Automotive & supercar media**                                                                                                                        | "Where to drive a Ferrari in the Caucasus" — genuinely novel story     | 1–3 high-authority links                                               | High                            | 3        |
| 9    | **Georgia tourism portals** — georgia.travel, visitgeorgia.ge                                                                                          | Verified local operator listing                                        | 1–2 authoritative links                                                | Medium — slow bureaucracy       | 3        |
| 10   | **Aggregator supplier listings** — Localrent, DiscoverCars, EconomyBookings                                                                            | Your inventory                                                         | Referral bookings + brand exposure (not link equity)                   | Low                             | 2        |

### Digital PR campaigns worth running

#### "The Caucasus Supercar Run"

Take the Ferrari or the G63 up the Georgian Military Highway to Gudauri, photograph it properly against the Caucasus, and pitch the story to automotive and travel media. Novel enough to be genuinely newsworthy — there is no supercar rental scene in the Caucasus. Costs you one day of a car that is otherwise idle. Links from automotive media carry more authority than anything a hotel page will give you.

#### "Road Condition Report" — the annual asset

A seasonal, genuinely useful page: which mountain roads are open, what surface, what vehicle you need, updated monthly. It is the kind of resource travel bloggers cite because it is the only current source. Requires real maintenance — do not launch it unless you will update it.

#### Press fleet for creators

Two complimentary rental days a month, allocated to travel creators and bloggers with genuine Georgia audiences. Not a paid link — a real rental in exchange for honest coverage. Disclose it. Track which ones produce links and bookings.

#### Affiliate program via Travelpayouts

Gives bloggers a self-serve financial reason to link. The commission comes out of the platform fee — see §2.15 for why that is tight at budget price points and comfortable at premium ones. Restrict affiliate commission to bookings over a GMV threshold so the economics hold.

**⚑ Never**

No PBNs, no paid link packages, no "1,000 backlinks for \$50", no automated directory blasts, no comment or forum spam, no link exchanges at scale, no guest posts on sites that exist only to host guest posts. Your domain is 15 months old with no link history — a link-spam manual action at this stage would be close to fatal. Twelve accurate citations and five real editorial links beat two hundred purchased ones, and that is not a moral point, it is the actual maths of how link-based ranking now works.

------------------------------------------------------------------------

## 2.11 — The customer acquisition funnel

Mapped against your actual booking flow: `vehicles.html → vehicle.html → reservation.html → POST /api/bookings (pending) → phone OTP → payment.html (PayPal fee) → partner accepts`.

| Stage                      | Leak                                                                                                                                                     | KPI                                         | Tool                 | Fix                                                                                                                                                        |
|----------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------|----------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **1 · Search**             | You do not appear. Head terms owned by aggregators; 94 vehicle pages unindexed; brand name collides globally                                             | Impressions, avg position                   | Search Console       | §2.4 long-tail waves; §2.6 vehicle indexing; consistent "EliteAuto.rent" branding everywhere                                                               |
| **2 · Landing**            | The \$25 lie. Visitor arrives expecting \$25, sees \$39. Also: 442 KB payload, 10 render-blocking scripts                                                | Bounce rate, LCP                            | GA4 + CrUX           | Fix the price claim first; then defer scripts, compress images                                                                                             |
| **3 · Vehicle selection**  | 94 cars behind a JS listing; filters are client-side; no comparison; availability not visible until the reservation step                                 | Vehicle-page views / session                | GA4 events           | Availability badge on every card; sort by "available on my dates"; comparison tool                                                                         |
| **4 · Availability check** | Discovering a car is unavailable *after* choosing it is the classic rental funnel killer                                                                 | Availability-check → reservation-start rate | Custom GA4 event     | Date-first search; grey out unavailable cars in the listing; suggest 3 available alternatives immediately                                                  |
| **5 · Reservation**        | Form length, extras selection, location fees appearing late                                                                                              | Reservation-start → OTP rate                | GA4 funnel           | Show the full price including reservation fee **on the vehicle page**, never first at checkout                                                             |
| **6 · Phone OTP**          | Highest-risk step in the entire funnel. A tourist mid-flight, on roaming, with a foreign number, is asked for an SMS code before they have paid anything | OTP-sent → OTP-verified rate                | Twilio logs + GA4    | Measure this first. If verification is under ~85%, move OTP *after* payment, or offer WhatsApp/email verification as an alternative                        |
| **7 · Payment**            | PayPal only. Not universal in Georgia, Russia or Israel. And the reservation fee is a charge the guest has not seen on any competitor                    | Payment-start → capture rate                | PayPal + GA4         | Add card payment (Bank of Georgia / TBC / Stripe). Explain the fee in one plain sentence before the button                                                 |
| **8 · Partner acceptance** | Guest has paid and is now waiting for a human. A slow or absent partner response destroys the booking and the review                                     | Median accept time; rejection rate          | DB query on bookings | Auto-accept for verified partners with reliable history; SLA with auto-escalation; Telegram alerts (code deployed, token not yet configured on the server) |
| **9 · Confirmation**       | Confirmation email is transactional and stops there                                                                                                      | Email open rate                             | Resend/nodemailer    | Send a pickup guide: exact meeting point, what to bring, driver's WhatsApp, a 3-line route suggestion                                                      |
| **10 · Pickup**            | The trust moment. Also your best upsell window                                                                                                           | Upsell attach rate                          | Partner report       | Offer child seat, snow chains, extra driver, full-coverage upgrade at handover. Hand over the QR review card here                                          |
| **11 · During rental**     | Silence until something goes wrong                                                                                                                       | Support contact rate                        | WhatsApp             | One day-2 WhatsApp check-in. Costs nothing, converts complaints into conversations                                                                         |
| **12 · Return**            | Deposit disputes, fuel arguments, damage claims                                                                                                          | Dispute rate                                | Partner report       | Photo protocol at both ends, shared with the guest. Removes 90% of disputes                                                                                |
| **13 · Review**            | Near-zero reviews vs Trent's ~412                                                                                                                        | Reviews / completed rentals                 | GBP                  | Ask at handback, in person, every time. §2.7                                                                                                               |
| **14 · Repeat**            | No CRM, no segmentation, no re-marketing                                                                                                                 | Repeat rate                                 | Your own DB          | §2.18 — the users and bookings tables already hold everything needed                                                                                       |
| **15 · Referral**          | No program exists                                                                                                                                        | Referred bookings                           | promo_codes table    | §2.16 — `promo_codes` already supports codes, limits and expiry                                                                                            |

**⚑ Instrument before you optimise**

\*\*\[Data unavailable — do not assume\]\*\* You have no measured conversion rate at any of these 15 stages. Every "leak" above is diagnosed from the flow's structure, not from data. **Week one's job is to instrument stages 4–8 in GA4** so that by week three you are fixing the stage that is actually bleeding rather than the one that looks worst on paper. My structural prediction: **stage 6 (phone OTP) and stage 8 (partner acceptance) are the two biggest losses** — but verify.

------------------------------------------------------------------------

## 2.12 — Conversion rate optimisation

### Changes ranked by expected effect

| \#  | Change                                                                                                               | Why                                                                                                                                                                                                         | Effort                       | Expected effect |
|-----|----------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------|-----------------|
| 1   | **Honest total price on the vehicle card and page** — show "\$39/day · \$322 total for 7 days incl. reservation fee" | The fee is your biggest conversion risk. Discovering a 22.5% surcharge at checkout after choosing a car is the classic abandonment trigger. Shown early it becomes a fact; shown late it feels like a trick | Medium                       | Very high       |
| 2   | **Fix the \$25 claim**                                                                                               | Removes the mismatch between ad/snippet and page                                                                                                                                                            | Low                          | Very high       |
| 3   | **Availability shown in the listing**, date-first search                                                             | Stops the "I chose a car that isn't available" dead end                                                                                                                                                     | Medium                       | High            |
| 4   | **Sticky mobile CTA bar** — price + "Check availability" + WhatsApp, always visible                                  | Most of your traffic is mobile tourists. A CTA that requires scrolling back up is a CTA half your visitors never use                                                                                        | Low                          | High            |
| 5   | **WhatsApp on every vehicle page, pre-filled** with the car name and dates                                           | WhatsApp is the default channel in Georgia, Israel and Russia. Removes the whole friction of the booking form for high-value or uncertain customers                                                         | Low                          | High            |
| 6   | **Real reviews on vehicle and landing pages**                                                                        | Trust is the entire deficit versus Trent and Localrent                                                                                                                                                      | Low (build) / high (collect) | High            |
| 7   | **Deposit stated per car, in a badge**                                                                               | `deposit_amount` is already in the DB and it is a top-three decision factor for this market                                                                                                                 | Low                          | Medium-high     |
| 8   | **Insurance explained in plain language** per car — the real tpl/cdw/full values, not "insurance included"           | The \#1 objection in every rental funnel, and where aggregators are weakest                                                                                                                                 | Medium                       | Medium-high     |
| 9   | **Real photos of the actual car**, not stock or press shots                                                          | Renters in emerging markets specifically fear "the car in the photo isn't the car you get"                                                                                                                  | Medium (operational)         | Medium-high     |
| 10  | **Airport delivery stated with the real fee** from `pickup_fees`                                                     | Removes uncertainty on the highest-intent segment                                                                                                                                                           | Low                          | Medium          |
| 11  | **Card payment alongside PayPal**                                                                                    | PayPal is not the default in three of your four markets                                                                                                                                                     | High                         | Medium          |
| 12  | **Abandoned-booking recovery** — WhatsApp/email 1 hour after a `pending` booking with no payment                     | The `bookings` table already records exactly this state. Free revenue sitting in your database                                                                                                              | Medium                       | Medium          |
| 13  | **Truthful scarcity only** — "1 of 2 available for your dates", driven by `vehicle_availability`                     | Real scarcity converts. Fabricated scarcity ("3 people viewing!") destroys trust and, in the EU, is an unfair commercial practice                                                                           | Low                          | Medium          |
| 14  | **Exit-intent — desktop only, one offer, dismissible**: "Send this quote to WhatsApp"                                | Capturing the quote is worth more than a discount pop-up, and it does not train customers to wait for discounts                                                                                             | Low                          | Low-medium      |

### A/B test program

**⚑ Statistical reality check**

A/B testing needs volume. At a plausible early-stage figure of a few hundred sessions a month, detecting a 20% relative lift at 95% confidence takes months per test — by which time the season has changed and the test is invalid. \*\*\[Data unavailable — do not assume\]\*\* your current traffic. **Until you clear roughly 3,000 sessions and 50 bookings a month, do not run A/B tests.** Ship the obvious fixes above, measure before/after, and accept the seasonality noise. The tests below are for when the volume exists.

| Test                          | Hypothesis                                                                                                                                      | Change                                                                           | Primary KPI                           | Expected         | Duration                      | Success                                                                                   |
|-------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------|---------------------------------------|------------------|-------------------------------|-------------------------------------------------------------------------------------------|
| T1 · Price transparency       | Showing the all-in total on the card increases completed bookings even though it raises the visible price, because it eliminates checkout shock | A: \$39/day. B: \$39/day · \$322 total for 7 days, all fees included             | Booking completion rate               | +15–30% relative | 4 weeks / 400 per arm         | B wins at p\<0.05, or B loses less than 5% on booking starts while winning on completions |
| T2 · Sticky mobile CTA        | A persistent CTA bar lifts booking starts on mobile                                                                                             | A: inline CTA. B: sticky bottom bar with price + CTA + WhatsApp                  | Booking-start rate (mobile)           | +10–20%          | 3 weeks                       | +8% or better                                                                             |
| T3 · OTP position             | Moving phone verification after payment reduces drop-off more than it increases fraud                                                           | A: OTP before payment. B: OTP after capture                                      | Reservation-start → paid              | +10–25%          | 4 weeks                       | +8% with no measurable rise in fraudulent bookings                                        |
| T4 · Reviews on vehicle pages | Per-car social proof lifts conversion on that car                                                                                               | A: no reviews. B: 3 real reviews + rating                                        | Vehicle → booking start               | +10–20%          | 4 weeks (needs reviews first) | +8%                                                                                       |
| T5 · WhatsApp prominence      | A prominent pre-filled WhatsApp CTA increases total enquiries more than it cannibalises online bookings                                         | A: footer link. B: pinned button + inline CTA                                    | Total enquiries (bookings + WhatsApp) | +15–25%          | 3 weeks                       | Combined total up, even if online bookings dip                                            |
| T6 · Deposit badge            | Surfacing "\$0 deposit" as a filter and badge raises conversion on qualifying cars                                                              | A: deposit at checkout. B: badge + listing filter                                | Conversion on \$0-deposit cars        | +15–25%          | 4 weeks                       | +10%                                                                                      |
| T7 · Hero message             | Airport-and-delivery framing beats price framing for this audience                                                                              | A: "From \$39/day". B: "Your car waiting at arrivals — Tbilisi, Batumi, Kutaisi" | Search-widget engagement              | +5–15%           | 4 weeks                       | +5%                                                                                       |

------------------------------------------------------------------------

## 2.13 — Paid advertising

**⚑ Do not switch on Google Ads until three things are true**

**1.** The \$25 claim is fixed — sending paid traffic to a page that contradicts the ad is the fastest way to a misleading-pricing disapproval and a wasted budget. **2.** Conversion tracking works end-to-end, so a "conversion" means a captured payment, not a form view. **3.** You can state a maximum CAC — and you cannot, because that requires Chapter 1's margin data (§2.21). Until then, treat any ad spend as paid market research with a hard monthly cap, not as a growth channel.

### Campaign structure

| Campaign                                                                                                                                                                                                                                                                                                       | Ad groups                                                                                                       | Match          | Landing page                         | Budget share | Rationale                                                                                                                    |
|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------|----------------|--------------------------------------|--------------|------------------------------------------------------------------------------------------------------------------------------|
| **1 · Brand**                                                                                                                                                                                                                                                                                                  | eliteauto rent · elite auto rent georgia                                                                        | Exact + phrase | Homepage                             | 5%           | Cheap, and **necessary** — your brand name collides with four unrelated companies. Defend the term                           |
| **2 · Supercar & luxury**                                                                                                                                                                                                                                                                                      | ferrari rental tbilisi · supercar rental georgia · g63 rental · luxury car rental tbilisi · wedding car tbilisi | Phrase + exact | /supercar-rental-tbilisi             | **30%**      | \$252–720 fee per booking supports a CAC no competitor can match. Low volume, low competition, extreme value. **Start here** |
| **3 · Kutaisi Airport**                                                                                                                                                                                                                                                                                        | kutaisi airport car rental · KUT car hire · rent car kutaisi airport                                            | Phrase + exact | kutaisi-airport-car-rental           | 15%          | Weakest competitive field of the three airports; Wizz Air feeds it 17% of national air traffic                               |
| **4 · Batumi Airport**                                                                                                                                                                                                                                                                                         | batumi airport car rental · BUS car hire                                                                        | Phrase + exact | batumi-airport-car-rental            | 10%          | Fastest-growing airport (+32%), weakest ad competition                                                                       |
| **5 · Long-term Tbilisi**                                                                                                                                                                                                                                                                                      | monthly car rental tbilisi · long term car rental georgia                                                       | Phrase         | monthly-long-term-car-rental-tbilisi | 15%          | \$84–95 fee per booking, low competition, expat audience that searches in English                                            |
| **6 · SUV & 4×4**                                                                                                                                                                                                                                                                                              | suv rental georgia · 4x4 rental georgia · jeep rental tbilisi                                                   | Phrase         | suv-rental-georgia                   | 15%          | Your best-supported category with the strongest content behind it                                                            |
| **7 · Tbilisi Airport**                                                                                                                                                                                                                                                                                        | tbilisi airport car rental · TBS car rental                                                                     | Exact only     | tbilisi-airport-car-rental           | 10%          | Sixt, Hertz, Europcar, Dollar and every OTA bid here. **Exact match only, tight budget cap** — this is where budget dies     |
| 8 · Ski seasonal                                                                                                                                                                                                                                                                                               | gudauri car rental · 4x4 rental gudauri · bakuriani car rental                                                  | Phrase         | /car-rental-gudauri                  | Nov–Mar only | Seasonal surge campaign, off the rest of the year                                                                            |
| 9 · Hebrew                                                                                                                                                                                                                                                                                                     | השכרת רכב בגאורגיה · השכרת רכב אוטומטי גאורגיה                                                                  | Phrase         | /he/ pages                           | Test only    | Fastest-growing market. Test small — needs the native proofread first                                                        |
| **Do not run:** broad match on any term, "car rental georgia" (competing with Localrent and every OTA on their own ground), Performance Max (it will spend your budget on the cheapest impressions, not the most valuable ones), or Display/remarketing before you have retargeting audiences worth targeting. |                                                                                                                 |                |                                      |              |                                                                                                                              |

#### Negative keyword list — build this before day one

`atlanta · savannah · augusta · macon · "georgia usa" · usa · america · "state of georgia" · jobs · salary · career · buy · sale · "for sale" · used cars · dealership · insurance quote · driving school · taxi · bolt · yandex go · uber · free · cheap*(on premium campaigns) · loan · lease to own · car wash · parts · repair · towing`

The USA/Georgia collision is the single largest source of wasted spend for any Georgian rental advertiser. Build the negative list first, review the search-terms report weekly for the first month, and add to it every week.

#### Conversion tracking and targets

- **Primary conversion:** payment captured (PayPal capture webhook → GA4 → Ads import). Not form submit, not page view, not booking created.
- **Secondary:** WhatsApp click, phone click, availability check. Track them, but do not bid to them.
- **Value-based bidding:** pass the actual `service_fee` as the conversion value. Because your fee ranges from \$10 to \$720 per booking, a bidding strategy that treats all conversions equally will systematically overspend on budget bookings and underspend on the ones that pay.
- **Target CPA:** \*\*\[Data unavailable — do not assume\]\*\*. Set it from §2.21's ceilings once you have margins. Interim discipline: **never bid above 50% of the platform fee for that campaign's typical booking** — roughly \$23 on budget campaigns, \$32 on the target mix, \$120–360 on supercar.
- **Target ROAS:** start at 300% of platform fee (not GMV — GMV mostly belongs to the partner). Raise as data accumulates.

### Other paid channels

| Channel                                                            | Verdict                      | Why                                                                                                                                                                                          | If used                                                                                                                                                                   |
|--------------------------------------------------------------------|------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Meta — Instagram**                                               | Yes, for supercar and luxury | Exotic cars are natively visual and the audience is reachable by interest and location. This is the one place where Meta's targeting fits your highest-value segment                         | Reels of the Ferrari/G63 on Georgian mountain roads. Interest targeting: luxury cars, supercars + travel to Georgia. Small daily budget, optimise for messages not clicks |
| **Meta — Facebook**                                                | Organic yes, paid limited    | Where the Russian-speaking and Israeli travel communities actually are. Group participation beats ad spend here by a wide margin                                                             | Retargeting only: people who viewed a vehicle page and did not book. Plus genuine (non-spammy) presence in Georgia travel groups                                          |
| **TikTok**                                                         | Organic yes, paid no         | Organic reach for car and travel content is still exceptional and costs only time. Paid TikTok converts poorly for considered high-value purchases booked weeks ahead                        | Post organically. Do not buy TikTok ads                                                                                                                                   |
| **YouTube**                                                        | Organic Shorts yes, paid no  | Long-tail search value from route videos ("Tbilisi to Kazbegi drive"). Paid YouTube is an awareness channel and you need bookings, not awareness                                             | Shorts of routes and cars; embed them on the matching landing pages — video on page also helps dwell time                                                                 |
| **Yandex Direct**                                                  | Yes — under-considered       | Russia is your largest source market by volume *and* spend, and Yandex is where those users search. Far cheaper than Google and almost nobody in Georgian car rental competes properly there | Only after /ru/ is fully translated. Pair with a free Yandex Business listing                                                                                             |
| **Aggregator listings** (Localrent, DiscoverCars, EconomyBookings) | Yes — as a supply channel    | You cannot outrank them, so sell through them. Their commission is a customer acquisition cost with guaranteed volume, and it fills otherwise-idle cars                                      | List the fleet. Treat aggregator bookings as utilisation filler and direct bookings as margin. Use the first rental to convert them into a direct repeat customer         |
| Programmatic display / native                                      | No                           | No intent, high fraud, unmeasurable at your scale                                                                                                                                            | —                                                                                                                                                                         |
| Influencer paid posts                                              | No — barter instead          | Cash sponsorships at this scale rarely return. A complimentary rental costs you an idle car-day                                                                                              | Press-fleet model in §2.10                                                                                                                                                |

------------------------------------------------------------------------

## 2.14 — Social media

One rule governs all of it: **the supercars are the content.** A Ferrari on the Georgian Military Highway is a video people watch and share; a Ford Fusion in a car park is not. The exotic fleet gets you the reach; the ordinary fleet takes the bookings that reach produces.

| Platform           | Job                                                                  | Cadence                              | Format                                                                                                     | Success metric                                    |
|--------------------|----------------------------------------------------------------------|--------------------------------------|------------------------------------------------------------------------------------------------------------|---------------------------------------------------|
| **Instagram**      | Primary. Luxury positioning, trust building, direct DM bookings      | 4–5/week + daily stories             | Reels (cars on real roads), carousels (route guides), stories (handovers, arrivals, behind the scenes)     | Profile → website clicks; DM enquiries            |
| **TikTok**         | Reach. Discovery by people who have not yet decided to visit Georgia | 3–4/week                             | 15–40s vertical: POV drives, "renting a supercar in the country of Georgia", price reveals, road reactions | Views; saves; profile visits                      |
| **YouTube Shorts** | Search longevity. Shorts surface for route queries months later      | 2–3/week (repurpose TikToks)         | Same vertical content, titled for search: "Tbilisi to Kazbegi — the whole drive in 40 seconds"             | Views from search; embeds driving page dwell time |
| **Facebook**       | Russian-speaking and Israeli communities. Groups, not the page       | 2/week + genuine group participation | Route posts, practical answers, seasonal offers                                                            | Group-sourced enquiries                           |

### 90-day social calendar

| Weeks     | Theme                | Instagram                                                                                                                                                                      | TikTok / Shorts                                           | Facebook                                                   |
|-----------|----------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------|------------------------------------------------------------|
| **1–2**   | Establish the fleet  | Walk-around of each supercar; "what \$700/day actually gets you"; office and team                                                                                              | POV: starting the Ferrari; G63 on a mountain road         | Introduce the business honestly in 2 Georgia travel groups |
| **3–4**   | Autumn & Kakheti     | Kakheti harvest drive carousel; which car for wine roads                                                                                                                       | Wine-region drive; "the road nobody tells you about"      | Autumn road-trip post + link to the Kakheti guide          |
| **5–6**   | Airport experience   | Real handover at TBS arrivals; what the meeting point looks like                                                                                                               | "Landing in Georgia at 3am — this is what happens"        | Practical KUT arrival post for Wizz Air travellers         |
| **7–8**   | Winter prep          | Snow tyres explained; the Gudauri road; what a 4×4 actually changes                                                                                                            | Snow-chain fitting in 30 seconds; the road up to Gudauri  | Ski-season announcement + Gudauri guide                    |
| **9–10**  | Trust & proof        | Customer handover moments (with permission); review screenshots; before/after cleaning                                                                                         | "Is the car the same as the photo?" — answer it on camera | Reviews round-up                                           |
| **11–12** | Routes & comparison  | SUV vs sedan for Georgian roads; 7-day itinerary carousel                                                                                                                      | Kazbegi in 40 seconds; "don't take a sedan here"          | Itinerary post + itinerary guide link                      |
| **13**    | Review & double down | Audit which posts drove profile → site clicks and enquiries. Kill what didn't work; make five more of whatever did. Do not keep posting a format because the calendar says so. |                                                           |                                                            |

**⚑ The content types that earn their slot**

In order of proven return for rental businesses: **(1) supercar and exotic footage on recognisable roads** — the reach engine; **(2) POV route videos** — genuine search and save value; **(3) real customer handovers** — the trust content that converts; **(4) practical driving tips** — saved and shared, builds authority; **(5) new fleet arrivals** — for followers who already know you. Before/after cleaning videos and generic "rental tips" are filler; post them only when you have nothing better.

------------------------------------------------------------------------

## 2.15 — Hotel and tourism partnerships

**⚑ The maths that decides your whole partnership design**

Marketplace revenue is **only the reservation fee** — the rental itself belongs to the partner supplying the car. So a commission paid to a hotel comes out of a fee of \$26–\$96, not out of the \$333–\$834 the guest spends.

| Booking type                       | GMV     | Your fee | 10% of fee | 15% of fee | 20% of fee | Will a hotel care? |
|------------------------------------|---------|----------|------------|------------|------------|--------------------|
| Budget 3-day (\$39/day)            | \$117   | \$26.32  | \$2.63     | \$3.95     | \$5.26     | No                 |
| Mixed blended booking              | \$333   | \$46.43  | \$4.64     | \$6.96     | \$9.29     | Barely             |
| Premium-tilted booking             | \$550   | \$64.58  | \$6.46     | \$9.69     | \$12.92    | Marginal           |
| Palisade 10 days                   | \$850   | \$63.75  | \$6.38     | \$9.56     | \$12.75    | Marginal           |
| **Supercar 3 days (M8 \$700/day)** | \$2,100 | \$252.00 | \$25.20    | \$37.80    | \$50.40    | Yes                |
| **Ferrari 3 days**                 | \$6,000 | \$720.00 | \$72.00    | \$108.00   | \$144.00   | Absolutely         |

*Fee computed from the live matrix. A commission on GMV instead — the model hotels expect — would be \$33–\$67 on ordinary bookings, which exceeds your entire fee. That model only works on your own fleet, where you keep the rental revenue.*

### The recommended structure — three different deals, not one

| Partner type                                           | Model                                                                   | They get                            | You keep                                                     | Why this shape                                                                                                                                                                                                                                            |
|--------------------------------------------------------|-------------------------------------------------------------------------|-------------------------------------|--------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Hotels, guesthouses, Airbnb hosts**                  | **Flat fee per completed rental: \$15**, plus a 10% guest discount code | \$15 per booking, regardless of car | Fee minus \$15 — thin on budget cars, comfortable above \$65 | A percentage of a \$26 fee is an insult; a flat \$15 is a number a concierge will remember and act on. Costs you money on the cheapest bookings, which is acceptable — those bookings are worth little anyway and the relationship is what you are buying |
| **Same, own-fleet cars**                               | **15% of rental revenue**                                               | \$50–\$130 per booking              | 85% of the rental, which you keep entirely                   | On your own cars you own the whole margin. Route partner referrals to your own fleet first — this is the only model that pays a hotel properly                                                                                                            |
| **Tour operators & travel agencies**                   | **20% of the fee, or reciprocal referral at zero cost**                 | \$5–\$144, or guaranteed customers  | 80%, or 100% under reciprocal                                | Reciprocal usually beats cash: they get self-drive customers, you get their guided-tour customers. No money moves, no invoicing                                                                                                                           |
| **Luxury concierge, wedding planners, event agencies** | **15% of the fee** on supercar bookings only                            | **\$38–\$108 per booking**          | \$214–\$612                                                  | The one channel where percentage commission genuinely works. Real money for them, large margin for you, and exactly the audience for the fleet nobody else has                                                                                            |
| **Airport transfer companies**                         | **\$10 flat + reciprocal**                                              | \$10 + your transfer referrals      | Rest of fee                                                  | They meet every arriving passenger — precisely your highest-intent moment                                                                                                                                                                                 |
| **Corporate accounts**                                 | **Negotiated rate, no commission**                                      | 5–10% off list for volume           | Full fee, higher utilisation                                 | Corporates want a discount and an invoice, not a commission. Predictable weekday demand fills the days tourists don't                                                                                                                                     |

**⚑ Which model maximises profit**

**Flat \$15 for accommodation partners, 15% of fee for luxury concierges, reciprocal for tour operators.** Percentage-of-fee commissions on ordinary bookings are simultaneously too small to motivate the partner and too large a share of your margin — the worst of both. The flat fee is legible, budgetable, and it makes the partner's decision easy. And route every accommodation referral to your *own* cars where you can: that turns a \$15 cost into a 15%-of-rental deal that actually pays them.

#### Partner onboarding — a process that takes under a week

1.  **Identify:** 4–5★ hotels and guesthouses in Tbilisi Old Town, Vera and Vake; Batumi seafront; Gudauri ski lodges; Kazbegi guesthouses. Prioritise properties whose guests do day trips.
2.  **Pitch:** use template 3a/3b from your off-page playbook — the framing is already right.
3.  **Agree:** one-page terms — flat fee, payment monthly, guest discount code, reciprocal link on their guest-services page.
4.  **Equip:** unique promo code in the `promo_codes` table (it already supports code, discount, max uses, expiry), QR window card, printed glovebox cards, a one-page "what to tell guests" sheet.
5.  **Track:** the promo code *is* the attribution. No new infrastructure needed.
6.  **Pay:** monthly, on time, with a statement listing each booking. Late or opaque payment is how these relationships die.
7.  **Review at 90 days:** partners producing nothing get dropped; producers get a better rate and a co-marketing push.

------------------------------------------------------------------------

## 2.16 — Referral program

Your `promo_codes` table already supports codes, percentage or fixed discounts, minimum order, usage caps and expiry, and your partner system already has `partner_referral_commissions`. The infrastructure exists; the program does not.

### What you can afford

| Booking type          | Fee to you | Break-even total reward | Sustainable (50% of fee) | Recommended split           |
|-----------------------|------------|-------------------------|--------------------------|-----------------------------|
| Budget 3-day          | \$26.32    | \$26.32                 | \$13.16                  | \$5 referrer + \$5 friend   |
| Blended (today's mix) | \$46.43    | \$46.43                 | \$23.21                  | \$10 referrer + \$10 friend |
| Blended (target mix)  | \$64.58    | \$64.58                 | \$32.29                  | \$15 referrer + \$15 friend |
| Supercar 3-day        | \$252.00   | \$252.00                | \$126.00                 | \$50 referrer + \$50 friend |

*Break-even ignores the referred customer's future value. If a customer books twice, the affordable reward roughly doubles — but you have no repeat-rate data yet, so do not spend against a repeat rate you have not measured.*

**⚑ Launch setting**

**\$10 credit to the referrer, 10% off (capped at \$15) for the friend, valid on bookings of 3+ days.** Both sides get something, the cap protects you on cheap bookings, the minimum duration keeps out one-day gaming, and the total cost lands inside the 50%-of-fee ceiling on the blended mix. Raise it once you can measure repeat rate.

#### Mechanics

- **Reward type:** future rental credit for the referrer, discount for the friend. Credit is strictly better than cash — it costs you less (some is never redeemed, and redemption drives another booking), it does not attract fraud the way cash does, and it converts a referrer into a repeat customer.
- **Codes:** auto-generate a personal code per guest account (`ANRI-4K2P`) at first completed booking. Distinguish these from partner codes with a prefix so attribution never blurs.
- **Trigger:** reward pays out on **rental completion**, not on booking. Prevents book-cancel-collect fraud entirely.
- **Tracking:** `promo_code` and `promo_discount` columns already exist on `bookings`. Add a `referrer_user_id` column and you are done.
- **Fraud prevention:** one code per verified phone (you already have OTP); no self-referral (block matching phone, email domain, payment instrument or device); cap at 5 successful referrals per person per year; manual review above 3 in a month; credit expires after 12 months.
- **Where to ask:** in the completion email, on the review card handed over with the keys, and in the guest profile. Never in the booking flow — it distracts from converting the booking you already have.

------------------------------------------------------------------------

## 2.17 — Pricing and revenue management

**⚑ The reservation fee is the central pricing decision in this business**

Your fee matrix is **regressive**: 22.5% on budget short rentals falling to 7.5% on luxury long ones. The logic (protect a \$10 minimum on tiny bookings) is sound, but the effect is that you tax hardest exactly where customers are most price-sensitive and where you compete most directly with Localrent and DiscoverCars — and lightest where you have no competition at all.

| Price tier           | 1–4 days | 5–9 days | 10+ days | Applies to                             |
|----------------------|----------|----------|----------|----------------------------------------|
| Budget (\<\$50/day)  | 22.5%    | 18.0%    | 15.0%    | Fusion, Prius, RAV4, Camry 2012        |
| Economy (\$50–59.99) | 18.0%    | 15.0%    | 12.0%    | Mid-fleet                              |
| Mid (\$60–69.99)     | 15.0%    | 12.0%    | 10.5%    | Mid-fleet                              |
| Premium (\$70–79.99) | 13.5%    | 10.5%    | 9.0%     | Camry 2022                             |
| Luxury (\$80+)       | 12.0%    | 9.0%     | 7.5%     | Highlander, Palisade, M8, G63, Ferrari |

*Live matrix from server/services/reservation-fee.js, with a \$10 minimum. Fee is added on top of the rental and paid online by the guest.*

### Two ways out — pick one

#### Option A — Flatten the budget tier Recommended

Cut budget-tier short rentals from 22.5% to **15%** and medium from 18% to **13%**. On a \$39 × 7-day booking your fee drops from \$49.14 to \$35.49 — the guest pays \$308.49 instead of \$322.14, an effective \$44.07/day.

**You lose \$13.65 per budget booking. You need a 39% lift in budget booking volume to break even.** Given you are currently 62% above the cheapest comparable competitor on this segment, that is a plausible but not guaranteed trade. Keep the higher rates on premium and luxury, where you have no price competition.

#### Option B — Stop competing on budget entirely

Leave the matrix alone. Accept that budget short rentals are a losing fight and deliberately redirect marketing, content and ad spend to premium, luxury and exotic — where the 7.5–12% fee is invisible next to a \$700/day rate and no aggregator has inventory.

**This is the higher-margin path and it needs no code change.** The risk is volume: fewer bookings, more concentrated, more seasonal. It also means telling your budget partners honestly that the platform is positioning upmarket.

**The honest recommendation:** do both — A on the budget tier to stop the bleeding, B in where you spend your attention. What you must not do is keep a 22.5% surcharge on budget cars *and* keep marketing yourself as the cheap option.

### Rental duration tiers for the cars themselves

Your `vehicles.price_tiers` field already supports `price_1_3 / price_4_7 / price_8_14 / price_15_30`. Most cars have it null — meaning a 30-day renter pays the same daily rate as a 1-day renter, which leaves money on the table in both directions.

| Duration   | Discount off day rate | Reasoning                                                                                                                           | Example: \$80 Highlander | Your fee        |
|------------|-----------------------|-------------------------------------------------------------------------------------------------------------------------------------|--------------------------|-----------------|
| 1–2 days   | +10% **premium**      | Highest turnaround cost per rental day — cleaning, handover, admin, dead time. Short rentals should cost more per day, not the same | \$88/day                 | \$21.12 (2d)    |
| 3–6 days   | Base rate             | The reference price and your most common tourist booking                                                                            | \$80/day                 | \$38.40 (4d)    |
| 7–13 days  | −10%                  | One handover amortised over a fortnight. The classic road-trip length                                                               | \$72/day                 | \$45.36 (7d)    |
| 14–29 days | −20%                  | Near-guaranteed utilisation with minimal handling                                                                                   | \$64/day                 | \$67.20 (14d)   |
| 30+ days   | −30 to −35%           | Expat/nomad segment. Competes against buying a car, not against other rentals — a different, less price-elastic comparison          | \$52–56/day              | \$117–126 (30d) |

*Percentages are the standard shape for rental duration curves. \*\*\[Data unavailable — do not assume\]\*\* your actual elasticity: re-cut these against your real booking-duration distribution before deploying.*

### Seasonal pricing

| Season          | Months                                                                  | Index   | Demand driver                                                                  | Fleet emphasis                                                  |
|-----------------|-------------------------------------------------------------------------|---------|--------------------------------------------------------------------------------|-----------------------------------------------------------------|
| **Peak summer** | Jul–Sep                                                                 | 130–150 | \>2M visitors in this quarter alone; Batumi coast; family travel               | 7-seaters, SUVs, automatics — price these hardest               |
| **Peak winter** | Late Dec – Feb                                                          | 120–140 | Gudauri and Bakuriani ski; season opens ~20 Dec                                | 4×4/AWD only. Sedans stay at base — nobody wants one in January |
| Shoulder        | May–Jun, Oct                                                            | 100–115 | Kakheti harvest (Sep–Oct), green Svaneti (May). Longer stays, older travellers | Mixed; push 7+ day rates                                        |
| Low             | Mar–Apr, Nov                                                            | 75–85   | Mud season in the mountains, cold on the coast                                 | Monthly and long-term. **Sell duration, not day rate**          |
| Holiday spikes  | 31 Dec–7 Jan, Orthodox Easter, Israeli school holidays (Sukkot, Pesach) | 150–180 | Fixed-date, inelastic demand                                                   | Everything. Set minimum rental lengths                          |

*Index 100 = base rate. \*\*\[Data unavailable — do not assume\]\*\* your own monthly booking curve. Built on market seasonality; validate against your data before deploying.*

#### Dynamic pricing rules worth automating

| Trigger                                             | Rule                                                           | Why                                                                            |
|-----------------------------------------------------|----------------------------------------------------------------|--------------------------------------------------------------------------------|
| Category utilisation \> 80% for the requested dates | +15%                                                           | Scarcity is real and the market will bear it                                   |
| Category utilisation \< 40% within 7 days of pickup | −10 to −15%                                                    | An idle car earns zero. A discounted rental beats no rental                    |
| Booking made \> 60 days ahead                       | −5%, non-refundable                                            | Locks in demand and gives you a forward book to plan against                   |
| Booking made \< 48 hours ahead                      | +10%                                                           | Late bookers have no alternative and the highest willingness to pay            |
| Friday–Sunday pickup                                | +10%                                                           | Weekend demand from locals and business travellers extending                   |
| Airport pickup                                      | Keep as an explicit fee (already in `pickup_fees.airport_fee`) | Cleaner than burying it in the rate, and honest pricing converts better        |
| Last car in a category                              | +20% and show truthful scarcity                                | Real scarcity, real premium — and it is verifiable from `vehicle_availability` |

**⚑ Underpricing and over-discounting**

\*\*\[Data unavailable — do not assume\]\*\* Identifying specific underpriced vehicles requires per-car utilisation and revenue — Chapter 1 data that is not in this session. What can be said from the live site: **the 2018 RAV4 at \$45/day sits just under the \$50 budget/economy boundary**, so it carries the 22.5% fee band while a \$50 price would drop it to 18% — a \$50 RAV4 could cost the guest *less in total* than the \$45 one on a short rental while paying the partner more. That is a pricing-boundary artefact worth checking across the whole fleet. **The general rule: any car whose utilisation exceeds 70% is underpriced; any car below 30% is either overpriced or in the wrong category.** You can compute both from your production database today.

------------------------------------------------------------------------

## 2.18 — Customer retention and CRM

You already store everything a CRM needs. `users` holds email, phone, name, verification state and creation date; `bookings` holds vehicle, partner, dates, duration, extras, totals, status and promo code; `favorites` holds stated preference; `reviews` holds satisfaction. What is missing is **country** and **acquisition source** — add two columns and you have a complete customer record without buying a CRM.

| Field                                     | Where it lives                      | Action                                                                                                                              |
|-------------------------------------------|-------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------|
| Name, email, phone                        | `users`                             | Present                                                                                                                             |
| Country                                   | —                                   | **Add.** Derive from phone prefix and IP at registration; it drives language, currency and campaign targeting                       |
| Acquisition source                        | —                                   | **Add.** Capture first-touch UTM at registration. Without this you cannot compute CAC by channel and every ad decision is guesswork |
| Rental history, spend, count, last rental | `bookings`                          | Computed — no schema change                                                                                                         |
| Vehicle preference                        | `bookings.vehicle_id` + `favorites` | Computed                                                                                                                            |

### Segments and the campaign each one gets

| Segment               | Definition                                           | Campaign                                                                       | Timing                                           | Offer                                                                                                   |
|-----------------------|------------------------------------------------------|--------------------------------------------------------------------------------|--------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| **VIP**               | 3+ rentals or lifetime GMV \> \$2,000                | Personal WhatsApp from a named person, not a system. Early access to new fleet | Quarterly                                        | Guaranteed availability, free upgrade when possible, no automated marketing ever                        |
| **Repeat**            | 2+ completed rentals                                 | "Welcome back" with their previous car pre-selected                            | On next site visit + 11 months after last rental | 10% returning-customer rate                                                                             |
| **High-value single** | One rental, GMV \> \$800                             | Referral invitation — this person has friends who travel like they do          | 2 weeks post-rental                              | \$10 credit per referral                                                                                |
| **Price-sensitive**   | Used a promo code, booked the cheapest available car | Low-season and off-peak offers only                                            | Nov, Mar–Apr                                     | Long-duration discounts, not day-rate cuts                                                              |
| **Corporate**         | Repeat weekday, 2–5 day, same billing details        | Direct account offer with monthly invoicing                                    | After 3 bookings                                 | Negotiated rate, no deposit, priority                                                                   |
| **Tourist**           | Foreign phone prefix, single trip                    | "Coming back to Georgia?" seasonal campaign                                    | 10–12 months after rental                        | Returning-visitor rate + a new route suggestion                                                         |
| **Local**             | +995 phone                                           | Weekend and event offers, Georgian language                                    | Monthly                                          | Weekend rates, occasion cars                                                                            |
| **Dormant**           | No booking in 18 months                              | One reactivation attempt, then stop                                            | Once, then suppress                              | Best available offer. If it fails, let them go — repeated mail to the dormant only harms deliverability |

#### Automated campaigns worth building, in build order

1.  **Abandoned booking** — `pending` with no payment after 1 hour → WhatsApp; after 24 hours → email. **Highest immediate return of anything in this section**: these people already chose a car.
2.  **Post-rental review request** — 2–4 hours after return, WhatsApp, individually (§2.7).
3.  **Return-to-Georgia** — 11 months after a completed rental. Israeli, Russian and EU visitors repeat Georgia at high rates, and 11 months lands just before the planning window for the same season.
4.  **Seasonal** — winter 4×4 to anyone who has rented an SUV; summer 7-seater to anyone who rented with a family-size booking. Segment on what they actually rented, not on everyone.
5.  **Long-term renewal** — 5 days before a 14+ day rental ends: "extend at the same rate?" Cheapest revenue in the business — no acquisition, no handover, no cleaning.
6.  **Referral activation** — after the second completed rental, when goodwill is highest.
7.  **Birthday** — only if you collect the date honestly and only with something real. A generic birthday email from a car rental company is noise; skip it rather than send it badly.

------------------------------------------------------------------------

## 2.19 — Analytics and tracking

GA4 (`G-4XTKG24HN6`) is installed and Search Console is verified. What is missing is **conversion measurement that ties revenue to source** — without it every recommendation in §2.13 and §2.21 stays untestable.

| Tool                    | Status                | Priority job                                                                                                                                                    |
|-------------------------|-----------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Google Analytics 4      | Installed             | Define the funnel events below; mark `payment_captured` as the key conversion with `service_fee` as its value                                                   |
| Search Console          | Verified              | **Your only real keyword data source.** Export Queries monthly and populate the empty volume columns in `seo-keywords.csv`                                      |
| Google Tag Manager      | Unknown               | Install it. Without GTM every tracking change is a code deploy on a static site with cache-busting versions to bump                                             |
| GBP Insights            | Profile not optimised | Track calls, direction requests, website clicks, and the discovery-vs-direct search split                                                                       |
| Meta Pixel + CAPI       | Not present           | Only when Meta ads start. CAPI matters because iOS blocks a large share of browser-side events                                                                  |
| Call tracking           | None                  | A distinct number on the site vs GBP vs print, or a call-tracking service. Otherwise phone bookings are attributed to nothing                                   |
| WhatsApp click tracking | None                  | GA4 event on every `wa.me` click, with the source page. In this market WhatsApp may well be your largest conversion path and you currently cannot see it at all |
| Yandex Metrika          | None                  | Add for /ru/ — it also gives session recordings free, which GA4 does not                                                                                        |

#### Events to define, in this order

`search_performed` (location, dates, category) → `vehicle_viewed` (id, category, price) → `availability_checked` (result) → `reservation_started` → `otp_sent` → `otp_verified` → `payment_started` → **`payment_captured`** (value = service_fee, GMV as a parameter) → `booking_accepted` · plus `whatsapp_click`, `phone_click`, `partner_signup`.

The pair that matters most is `otp_sent` → `otp_verified`. That single ratio tells you whether phone verification is quietly killing a fifth of your bookings, and it is the cheapest high-value measurement you can add this week.

### The dashboard

| Panel           | Metrics                                                                                                         | Frequency | Decision it drives                                          |
|-----------------|-----------------------------------------------------------------------------------------------------------------|-----------|-------------------------------------------------------------|
| **Revenue**     | Platform fee revenue · GMV · bookings · average fee per booking · average GMV per booking · average rental days | Weekly    | Is the fleet mix moving upmarket?                           |
| **Acquisition** | Sessions by channel · organic sessions · CVR by channel · CAC by channel · cost per booking · ROAS              | Weekly    | Where the next marketing dollar goes                        |
| **Funnel**      | Search → vehicle → availability → reservation → OTP → payment, with drop-off at each step                       | Weekly    | Which single stage to fix next                              |
| **SEO**         | Impressions · clicks · avg position · indexed pages · top 20 queries · vehicle-page impressions                 | Monthly   | Which content wave is working                               |
| **Local**       | GBP views · calls · direction requests · review count · review velocity · average rating                        | Monthly   | Local pack progress                                         |
| **Fleet**       | Utilisation by car and category · revenue per available car-day · fee per car · idle days                       | Weekly    | Pricing, promotion and acquisition decisions (§2.26, §2.27) |
| **Retention**   | Repeat rate · time between rentals · referral bookings · dormant count                                          | Monthly   | How much CAC you can actually afford                        |
| **Supply**      | Active partners · cars live · pending approvals · median partner accept time · rejection rate                   | Weekly    | Whether supply or demand is the binding constraint          |

Your `admin.html` already has an analytics tab and a visitors tracker. Extend that rather than buying a BI tool — the data all lives in one Postgres database and the panels above are eight SQL queries.

------------------------------------------------------------------------

## 2.20 — SEO → revenue model

Organic revenue = **organic sessions × conversion rate × revenue per booking**. Two of those three inputs are unknown for your business; the third is computable exactly from your live prices and fee matrix.

**⚑ What is and is not known**

\*\*\[Data unavailable — do not assume\]\*\* **Current organic sessions** (read from GA4), **current conversion rate** (read from GA4 once §2.19 events exist), **current bookings and revenue** (Chapter 1). Everything below is a scenario, not a forecast. **Known exactly:** revenue per booking, because it is arithmetic on live prices and the live fee matrix.

#### Revenue per booking by fleet mix

| Mix          | Composition                                        | GMV / booking | Platform fee / booking | Take rate |
|--------------|----------------------------------------------------|---------------|------------------------|-----------|
| Budget-heavy | 55% budget · 30% premium · 13% luxury · 2% exotic  | \$333.10      | \$46.43                | 13.9%     |
| Premium tilt | 35% budget · 30% premium · 25% luxury · 10% exotic | \$550.00      | \$64.58                | 11.7%     |
| Exotic push  | 25% budget · 25% premium · 30% luxury · 20% exotic | \$834.00      | \$95.93                | 11.5%     |

*Computed from live vehicle prices via the reservation-fee matrix. The mix percentages are assumptions; the resulting fees are exact given those mixes. Note the take rate *falls* as the mix improves — but the dollars roughly double.*

### Scenarios

<table style="width:100%;">
<colgroup>
<col style="width: 14%" />
<col style="width: 14%" />
<col style="width: 14%" />
<col style="width: 14%" />
<col style="width: 14%" />
<col style="width: 14%" />
<col style="width: 14%" />
</colgroup>
<thead>
<tr class="header">
<th>Scenario</th>
<th>Month</th>
<th class="num">Organic sessions</th>
<th class="num">CVR</th>
<th class="num">Bookings</th>
<th class="num">Platform revenue / mo</th>
<th class="num">GMV / mo</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td rowspan="4"><strong>Conservative</strong><br />
<em>Technical fixes only. No link building, no reviews, budget-heavy mix, 0.8% CVR</em></td>
<td>3</td>
<td class="num">400</td>
<td class="num">0.8%</td>
<td class="num">3.2</td>
<td class="num">$149</td>
<td class="num">$1,066</td>
</tr>
<tr class="even">
<td>6</td>
<td class="num">700</td>
<td class="num">0.8%</td>
<td class="num">5.6</td>
<td class="num">$260</td>
<td class="num">$1,865</td>
</tr>
<tr class="odd">
<td>12</td>
<td class="num">1,200</td>
<td class="num">0.8%</td>
<td class="num">9.6</td>
<td class="num">$446</td>
<td class="num">$3,198</td>
</tr>
<tr class="even">
<td>24</td>
<td class="num">2,000</td>
<td class="num">0.8%</td>
<td class="num">16.0</td>
<td class="num">$743</td>
<td class="num">$5,330</td>
</tr>
<tr class="odd">
<td rowspan="4"><strong>Base</strong><br />
<em>94 vehicle pages indexed, price claim fixed, reviews growing, RU/KA fixed, content shipping, premium tilt, 1.5% CVR</em></td>
<td>3</td>
<td class="num">700</td>
<td class="num">1.5%</td>
<td class="num">10.5</td>
<td class="num">$678</td>
<td class="num">$5,775</td>
</tr>
<tr class="even">
<td>6</td>
<td class="num">1,500</td>
<td class="num">1.5%</td>
<td class="num">22.5</td>
<td class="num">$1,453</td>
<td class="num">$12,375</td>
</tr>
<tr class="odd">
<td>12</td>
<td class="num">3,500</td>
<td class="num">1.5%</td>
<td class="num">52.5</td>
<td class="num"><strong>$3,390</strong></td>
<td class="num">$28,875</td>
</tr>
<tr class="even">
<td>24</td>
<td class="num">7,000</td>
<td class="num">1.5%</td>
<td class="num">105.0</td>
<td class="num"><strong>$6,781</strong></td>
<td class="num">$57,750</td>
</tr>
<tr class="odd">
<td rowspan="4"><strong>Aggressive</strong><br />
<em>Everything above + supercar category owned + digital PR links + 40+ reviews + Hebrew and Russian live + exotic push mix, 2.5% CVR</em></td>
<td>3</td>
<td class="num">1,200</td>
<td class="num">2.5%</td>
<td class="num">30.0</td>
<td class="num">$2,878</td>
<td class="num">$25,020</td>
</tr>
<tr class="even">
<td>6</td>
<td class="num">3,000</td>
<td class="num">2.5%</td>
<td class="num">75.0</td>
<td class="num">$7,195</td>
<td class="num">$62,550</td>
</tr>
<tr class="odd">
<td>12</td>
<td class="num">8,000</td>
<td class="num">2.5%</td>
<td class="num">200.0</td>
<td class="num"><strong>$19,186</strong></td>
<td class="num">$166,800</td>
</tr>
<tr class="even">
<td>24</td>
<td class="num">18,000</td>
<td class="num">2.5%</td>
<td class="num">450.0</td>
<td class="num"><strong>$43,168</strong></td>
<td class="num">$375,300</td>
</tr>
</tbody>
</table>

***These are scenarios, not forecasts.** Session counts are illustrative growth curves for a 15-month-old domain doing the work described; conversion rates are plausible industry-shaped assumptions. Replace both with your GA4 numbers the moment you have them and the model becomes real.*

**⚑ What the model actually tells you**

The gap between Conservative and Base at month 12 is **7.6× the platform revenue** — and almost all of it comes from three things that are engineering and honesty, not marketing: **indexing the 94 vehicle pages, fixing the price claim, and getting the conversion rate from 0.8% to 1.5%.** The gap between Base and Aggressive is another 5.7×, and that one is bought with the supercar category, links and reviews — slower, harder, but far more valuable per unit of effort than any additional budget-car booking.

Note also: **the exotic segment shifts revenue per booking more than traffic growth does.** Moving from a budget-heavy to an exotic-push mix doubles revenue per booking at identical traffic. Twenty percent of bookings being exotic is roughly equivalent, in revenue terms, to doubling your organic traffic.

------------------------------------------------------------------------

## 2.21 — Customer acquisition cost

**⚑ CAC profitability cannot be fully calculated**

\*\*\[Data unavailable — do not assume\]\*\* True CAC ceilings need gross margin, and gross margin needs your operating costs — hosting, PayPal fees, support time, insurance, partner management, and for your own fleet: depreciation, maintenance, insurance and financing per car. None of that is in this session. **What follows are revenue ceilings, not profit ceilings.** Your real maximum CAC is lower than every number below, by exactly the amount your costs consume. Do not treat these as spend permissions.

#### Marketplace side — ceilings against the reservation fee

| Booking type             | Fee (revenue) | Break-even CAC | 50%-margin CAC | 3:1 target CAC |
|--------------------------|---------------|----------------|----------------|----------------|
| Budget 3-day             | \$26.32       | \$26.32        | \$13.16        | \$8.77         |
| Blended, today's mix     | \$46.43       | \$46.43        | \$23.21        | \$15.48        |
| Blended, target mix      | \$64.58       | \$64.58        | \$32.29        | \$21.53        |
| Supercar 3-day (M8)      | \$252.00      | \$252.00       | \$126.00       | \$84.00        |
| Supercar 3-day (Ferrari) | \$720.00      | \$720.00       | \$360.00       | \$240.00       |

*Fees exact from the live matrix. The 3:1 column is the conventional healthy ratio for a single transaction with no assumed repeat value.*

#### Own-fleet side — a completely different ceiling

On your own cars you keep the rental revenue, not just the fee. A 7-day Highlander at \$80/day is \$560 of revenue, not \$50. Even at a conservative 50% gross margin after fuel, cleaning, depreciation and insurance, that supports a CAC around **\$140 per booking** — roughly **six times** what a marketplace booking supports.

**Strategic consequence:** paid acquisition is far more affordable when it lands on your own fleet. Every ad campaign should route to a landing page where your own cars appear first. And it means own-fleet expansion (§2.27) buys you a marketing budget that marketplace growth alone does not.

#### Channel ceilings

| Channel                               | Max cost per booking            | Basis                                                                                                                |
|---------------------------------------|---------------------------------|----------------------------------------------------------------------------------------------------------------------|
| Google Ads — budget campaigns         | \$13–23                         | 50% of a budget/blended fee. Tight, which is why budget campaigns are last in §2.13's priority order                 |
| Google Ads — supercar campaigns       | \$84–360                        | Enormous headroom nobody else in the market can match                                                                |
| Google Ads — own-fleet landing pages  | up to ~\$140                    | Rental margin, not fee                                                                                               |
| Meta Ads                              | \$10–20 blended, \$80+ supercar | Lower intent than search, so discount the ceiling accordingly                                                        |
| Partner commission — accommodation    | \$15 flat                       | §2.15. Below the 50% ceiling on the blended mix; loss-making on the cheapest bookings, accepted as relationship cost |
| Partner commission — luxury concierge | \$38–144                        | 15% of fee on supercar bookings                                                                                      |
| Referral reward (both sides combined) | \$20                            | \$10 + \$10; inside the 50% ceiling on the blended mix                                                               |
| Aggregator commission                 | Their rate                      | Accept it as fill for otherwise-idle cars. Judge it on incremental utilisation, not on margin per booking            |
| SEO investment                        | See below                       | Fixed cost against a compounding return, not a per-booking cost                                                      |

#### Maximum sensible SEO investment

SEO is a fixed monthly cost recovered against cumulative bookings. Using the Base scenario (52.5 bookings/month at \$64.58 fee = \$3,390/month platform revenue by month 12):

- **Months 1–3:** \$300–600/month. Mostly your own time plus a native translator. Almost everything critical is engineering you can do in-house.
- **Months 4–6:** \$500–900/month. Content production and outreach.
- **Months 7–12:** \$800–1,500/month, **capped at 30% of trailing platform revenue.**
- **Never** commit to a retainer larger than one month's platform revenue. And for the own-fleet side, remember the return is 6× higher — SEO that drives bookings to your own cars justifies proportionally more spend.

------------------------------------------------------------------------

## 2.22 — Website feature roadmap

| \#  | Feature                                                                | Revenue impact | Difficulty       | Cost                 | Expected ROI                                   | Priority |
|-----|------------------------------------------------------------------------|----------------|------------------|----------------------|------------------------------------------------|----------|
| 1   | **Vehicle sitemap + Product/Offer schema**                             | Very high      | Low              | 1 dev-day            | Extreme — unlocks 94 pages                     | 1        |
| 2   | **Honest all-in price display** on cards and vehicle pages             | Very high      | Low-med          | 1–2 dev-days         | Extreme                                        | 1        |
| 3   | **Real-time availability in the listing** + date-first search          | Very high      | Medium           | 3–5 dev-days         | Very high                                      | 2        |
| 4   | **Sticky mobile CTA + pre-filled WhatsApp** on every vehicle page      | High           | Low              | 1 dev-day            | Extreme                                        | 1        |
| 5   | **Abandoned-booking recovery**                                         | High           | Medium           | 2–3 dev-days         | Very high — recovers bookings already made     | 2        |
| 6   | **Vehicle slug URLs** (/car/toyota-highlander-2017) with 301s          | Medium-high    | Medium           | 2 dev-days           | High                                           | 3        |
| 7   | **Review system wired to the funnel** (auto-request post-rental)       | High           | Low-med          | 2 dev-days           | Very high — closes the biggest competitive gap | 2        |
| 8   | **Card payment** (Bank of Georgia / TBC / Stripe) alongside PayPal     | High           | High             | 5–10 dev-days + fees | High                                           | 3        |
| 9   | **Telegram owner alerts** — code deployed, token not configured        | Medium         | Trivial          | 15 minutes           | Extreme — faster partner acceptance            | 1        |
| 10  | **Duration price tiers populated** across the fleet                    | High           | Low (data entry) | 1 day                | Very high — longer rentals                     | 2        |
| 11  | **Deposit / no-deposit filter and badge**                              | Medium         | Low              | 1 dev-day            | High                                           | 3        |
| 12  | **Vehicle comparison tool**                                            | Medium         | Medium           | 3 dev-days           | Medium                                         | 5        |
| 13  | **Referral system** (referrer_user_id + code generation)               | Medium         | Medium           | 3–4 dev-days         | Medium-high                                    | 4        |
| 14  | **Delivery calculator** (address → fee, live)                          | Medium         | Medium           | 3 dev-days           | Medium                                         | 4        |
| 15  | **Dynamic pricing engine** (§2.17 rules)                               | High           | High             | 8–12 dev-days        | Medium-high — needs booking volume to matter   | 6        |
| 16  | **Email/WhatsApp automation** (the §2.18 sequences)                    | Medium         | Medium           | 4–6 dev-days         | Medium-high                                    | 4        |
| 17  | **Coupon codes surfaced in the UI** (table exists, no UI)              | Medium         | Low              | 1 dev-day            | Medium — required by §2.15                     | 3        |
| 18  | **Customer dashboard improvements** (rebook previous car in one click) | Medium         | Low-med          | 2 dev-days           | Medium                                         | 5        |
| 19  | **Partner dashboard analytics** (their utilisation, their revenue)     | Low direct     | Medium           | 4 dev-days           | Medium — supply-side retention                 | 6        |
| 20  | **Instant booking / auto-accept** for trusted partners                 | High           | Medium           | 3–4 dev-days         | High — removes the worst funnel wait           | 3        |
| 21  | **Location selector improvements**                                     | Low            | Low              | 1 dev-day            | Low                                            | 7        |
| 22  | **Full CRM**                                                           | Medium         | High             | 10+ dev-days         | Low — SQL on your existing DB does 90% of it   | 8        |

**⚑ The four-day sprint that moves the most money**

Items **1, 2, 4 and 9** total roughly four developer-days and one 15-minute config change. Together they index 94 pages, remove the checkout price shock, put a working CTA in front of every mobile visitor, and cut the partner-acceptance delay. **Do these before anything else in this document.**

------------------------------------------------------------------------

## 2.23 — 30 / 60 / 90 day plan

Owner roles: **You** (Anri — decisions, outreach, reviews) · **Dev** (you or a contractor) · **Writer** (you or freelance) · **Native** (RU/KA/HE translator).

### Days 1–30 — stop the bleeding, unlock what exists

| \#  | Task                                                                              | Pri | Impact      | Difficulty | Cost  | Time     | Owner     | KPI                            |
|-----|-----------------------------------------------------------------------------------|-----|-------------|------------|-------|----------|-----------|--------------------------------|
| 1   | Fix every "\$25/day" claim across EN/RU/KA/HE + GBP plan                          | 1   | Very high   | Easy       | \$0   | 1 day    | You       | Zero false price claims        |
| 2   | Configure Telegram alert token on the server                                      | 1   | High        | Trivial    | \$0   | 15 min   | Dev       | Alerts arriving                |
| 3   | Vehicle sitemap generation + Product/Offer/Car schema                             | 1   | Very high   | Medium     | \$0   | 1–2 days | Dev       | 94 pages indexed in GSC        |
| 4   | GA4 funnel events, especially otp_sent → otp_verified                             | 1   | High        | Medium     | \$0   | 2 days   | Dev       | Funnel visible in GA4          |
| 5   | Remove the duplicate GBP listing; optimise the survivor; 20 photos; 5 Q&As        | 1   | Very high   | Easy       | \$0   | 1 day    | You       | One verified listing           |
| 6   | Start asking every customer for a Google review at handback                       | 1   | Very high   | Easy       | \$0   | Ongoing  | You       | 10+ reviews by day 30          |
| 7   | Sticky mobile CTA + pre-filled WhatsApp on vehicle pages                          | 1   | High        | Easy       | \$0   | 1 day    | Dev       | Mobile booking-start rate      |
| 8   | Show all-in price (rental + reservation fee) on cards and vehicle pages           | 1   | Very high   | Medium     | \$0   | 2 days   | Dev       | Payment-step drop-off          |
| 9   | Defer 10 render-blocking scripts; merge CSS; WebP every image over 300 KB         | 2   | Medium-high | Easy       | \$0   | 1 day    | Dev       | LCP / mobile bounce            |
| 10  | Build **/supercar-rental-tbilisi** — the highest-value page you don't have        | 1   | Very high   | Medium     | \$0   | 2 days   | You + Dev | Impressions for supercar terms |
| 11  | Full 5-way hreflang from the head-injector on every page                          | 2   | Medium      | Easy       | \$0   | ½ day    | Dev       | GSC hreflang errors → 0        |
| 12  | Claim Yandex Business, 2GIS, Trustpilot, Tripadvisor, Bing, Apple — identical NAP | 2   | Medium      | Easy       | \$0   | 1 day    | You       | 8 citations live               |
| 13  | Populate duration price tiers across the fleet                                    | 2   | High        | Easy       | \$0   | 1 day    | You       | Average rental days            |
| 14  | Set the real Google review link inside leave-a-review.html; print QR cards        | 2   | Medium      | Easy       | ~\$30 | 1 day    | You       | Scan rate                      |
| 15  | Fill seo-keywords.csv from Keyword Planner + GSC (replace the zeros)              | 2   | Medium      | Easy       | \$0   | 1 day    | You       | Registry has real numbers      |
| 16  | Resolve cheap vs economy cannibalisation using GSC data                           | 3   | Low-medium  | Easy       | \$0   | ½ day    | You       | Clicks on surviving URL        |

### Days 31–60 — content, language, partners

| \#  | Task                                                                              | Pri | Impact      | Difficulty | Cost             | Time         | Owner        | KPI                             |
|-----|-----------------------------------------------------------------------------------|-----|-------------|------------|------------------|--------------|--------------|---------------------------------|
| 17  | Complete RU translation; native review of RU and KA                               | 1   | High        | Medium     | \$150–400        | 1 week       | Native + Dev | /ru/ sessions and CVR           |
| 18  | Native Hebrew proofread of all 15 /he/ pages                                      | 1   | High        | Easy       | \$100–250        | 3 days       | Native       | /he/ sessions                   |
| 19  | Rewrite Kutaisi and Batumi airport pages with real arrival detail                 | 1   | High        | Medium     | \$0              | 3 days       | Writer       | Airport-term impressions        |
| 20  | Publish: supercar guide · insurance guide · Kutaisi arrival guide · Batumi by car | 1   | High        | Medium     | \$0–400          | 2 weeks      | Writer       | 4 published + indexed           |
| 21  | Sign 5–10 hotel/guesthouse partners at \$15 flat + promo codes                    | 1   | High        | Medium     | \$0              | 3 weeks      | You          | Partners signed; coded bookings |
| 22  | Pitch 15 Georgia travel blogs for inclusion + affiliate                           | 1   | High        | Hard       | \$0              | 3 weeks      | You          | 3+ editorial links              |
| 23  | Launch Google Ads: brand + supercar + Kutaisi only                                | 2   | Medium-high | Medium     | \$300–600/mo     | 1 week setup | You/Dev      | Cost per booking vs §2.21       |
| 24  | Instagram + TikTok launch — supercar content first                                | 2   | Medium      | Medium     | \$0              | Ongoing      | You          | Profile → site clicks           |
| 25  | Abandoned-booking recovery automation                                             | 2   | High        | Medium     | \$0              | 3 days       | Dev          | Recovered bookings              |
| 26  | Rebuild drivers.html as a real chauffeur service page                             | 2   | Medium      | Easy       | \$0              | 1 day        | Writer       | Chauffeur enquiries             |
| 27  | Expand the 4 thinnest guides to 1,200–1,600 words with real operator detail       | 2   | Medium      | Medium     | \$0–300          | 2 weeks      | Writer       | Position per guide              |
| 28  | Referral program live (referrer_user_id + code generation)                        | 3   | Medium      | Medium     | \$0              | 4 days       | Dev          | Referred bookings               |
| 29  | List the fleet on Localrent as a supplier                                         | 2   | Medium      | Easy       | Their commission | 2 days       | You          | Incremental utilisation         |

### Days 61–90 — scale what worked, prepare for winter

| \#  | Task                                                                                         | Pri | Impact      | Difficulty | Cost         | Time    | Owner        | KPI                            |
|-----|----------------------------------------------------------------------------------------------|-----|-------------|------------|--------------|---------|--------------|--------------------------------|
| 30  | **Build /car-rental-gudauri, /car-rental-svaneti, /car-rental-kazbegi, /car-rental-kakheti** | 1   | High        | Medium     | \$0          | 1 week  | Writer + Dev | Destination-term impressions   |
| 31  | Publish the Gudauri ski guide + winter tyre law guide **before November**                    | 1   | High        | Medium     | \$0          | 1 week  | Writer       | Winter-term rankings by Dec    |
| 32  | Unique 80–150 word blocks for the top 40 vehicles                                            | 1   | High        | Medium     | \$0          | 4 weeks | Writer       | Vehicle-page clicks            |
| 33  | Vehicle slug URLs with 301s from ?id=                                                        | 2   | Medium-high | Medium     | \$0          | 2 days  | Dev          | CTR on vehicle results         |
| 34  | Instant booking / auto-accept for verified partners with good history                        | 2   | High        | Medium     | \$0          | 4 days  | Dev          | Median accept time             |
| 35  | Digital PR: "Caucasus Supercar Run" pitch to automotive and travel media                     | 2   | High        | Hard       | 1 car-day    | 3 weeks | You          | 1–3 high-authority links       |
| 36  | Retargeting on Meta for vehicle-page viewers who did not book                                | 2   | Medium      | Medium     | \$150–300/mo | 1 week  | You          | Retargeting ROAS               |
| 37  | Deploy duration + seasonal pricing; instrument the dynamic rules                             | 2   | High        | Medium     | \$0          | 1 week  | Dev + You    | Revenue per available car-day  |
| 38  | Sign 3–5 ski-lodge partners in Gudauri and Bakuriani                                         | 2   | Medium      | Medium     | \$0          | 3 weeks | You          | Winter partner bookings        |
| 39  | Hebrew pillar + Israeli Facebook community presence                                          | 2   | Medium-high | Medium     | \$150        | 2 weeks | Native + You | Israeli bookings               |
| 40  | Build the KPI dashboard in admin.html (the 8 panels in §2.19)                                | 2   | Medium      | Medium     | \$0          | 1 week  | Dev          | Weekly review actually happens |
| 41  | Card payment integration (Bank of Georgia / TBC)                                             | 3   | High        | Hard       | Setup + fees | 2 weeks | Dev          | Payment completion rate        |

------------------------------------------------------------------------

## 2.24 — 12-month roadmap

Targets are **relative to your own baseline**, because the baseline is unknown. Set month 1 as your index and measure against it.

<table>
<colgroup>
<col style="width: 11%" />
<col style="width: 11%" />
<col style="width: 11%" />
<col style="width: 11%" />
<col style="width: 11%" />
<col style="width: 11%" />
<col style="width: 11%" />
<col style="width: 11%" />
<col style="width: 11%" />
</colgroup>
<thead>
<tr class="header">
<th>Month</th>
<th>SEO</th>
<th>Content</th>
<th>Paid</th>
<th>Social</th>
<th>Partners</th>
<th>Dev</th>
<th>Pricing / fleet</th>
<th>Targets</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Sep '26</strong><br />
M1</td>
<td>Vehicle sitemap + schema; hreflang; speed; GBP</td>
<td>Supercar + insurance guides</td>
<td>—</td>
<td>IG/TikTok launch, supercar-led</td>
<td>GBP + 8 citations</td>
<td>Price transparency; sticky CTA; GA4 events; Telegram</td>
<td>Duration tiers populated</td>
<td>94 indexed · 10 reviews · funnel measurable</td>
</tr>
<tr class="even">
<td><strong>Oct</strong><br />
M2</td>
<td>KUT + BUS pages rewritten; keyword registry filled</td>
<td>Gudauri ski · winter tyres · expand Svaneti · Batumi by car</td>
<td>Ads: brand + supercar + KUT</td>
<td>Winter prep content</td>
<td>5 hotels signed; 15 blogs pitched</td>
<td>Abandoned-booking recovery</td>
<td>Winter 4×4 pricing set</td>
<td>25 reviews · 3 links · first ad bookings</td>
</tr>
<tr class="odd">
<td><strong>Nov</strong><br />
M3</td>
<td>4 destination pages live</td>
<td>Bakuriani · monthly maths · drivers page · road conditions</td>
<td>Add Batumi + long-term campaigns</td>
<td>Ski content push</td>
<td>3 ski lodges; tour operators</td>
<td>Slug URLs; instant booking</td>
<td>Seasonal pricing live</td>
<td>40 reviews · 5 links · dashboard live</td>
</tr>
<tr class="even">
<td><strong>Dec</strong><br />
M4</td>
<td>RU pages complete; Yandex Business</td>
<td>Holiday guide · Hebrew pillar · expand pillar · comparison</td>
<td>Ski campaign peak</td>
<td>Winter reels</td>
<td>Ski partners active</td>
<td>Card payment</td>
<td>Holiday premium pricing</td>
<td>Winter bookings up · RU traffic starting</td>
</tr>
<tr class="odd">
<td><strong>Jan '27</strong><br />
M5</td>
<td>Hebrew pillar + Israeli outreach</td>
<td>Winter itinerary · Hebrew Tbilisi · one-way guide</td>
<td>Ski + Hebrew test</td>
<td>Ski + customer content</td>
<td>Israeli communities</td>
<td>Referral system live</td>
<td>Review Q4 utilisation by car</td>
<td>Israeli bookings measurable</td>
</tr>
<tr class="even">
<td><strong>Feb</strong><br />
M6</td>
<td>Russian commercial pages; 2GIS</td>
<td>Spring planning · RU SUV guide · day trips · IDP table</td>
<td>Shift to summer terms</td>
<td>Spring routes</td>
<td>Airbnb hosts</td>
<td>Delivery calculator</td>
<td><strong>Fleet decision point</strong> (§2.27)</td>
<td>6-month review: which channel actually paid</td>
</tr>
<tr class="odd">
<td><strong>Mar</strong><br />
M7</td>
<td>Scale what ranked; kill what didn't</td>
<td>10-day itinerary · best SUV · RU no-deposit · Kazbegi spring</td>
<td>Summer campaigns live</td>
<td>Summer teasers</td>
<td>Corporate outreach</td>
<td>Email/WhatsApp automation</td>
<td>Spring pricing; low-season long-term push</td>
<td>Summer forward bookings</td>
</tr>
<tr class="even">
<td><strong>Apr</strong><br />
M8</td>
<td>Digital PR round 2</td>
<td>Best road-trip car · wine route · Hebrew automatic · Tbilisi parking</td>
<td>Scale winners</td>
<td>Route content</td>
<td>Wedding &amp; concierge partners</td>
<td>Comparison tool</td>
<td>Summer rates set</td>
<td>Peak-season book filling</td>
</tr>
<tr class="odd">
<td><strong>May</strong><br />
M9</td>
<td>Head-term push begins (authority now exists)</td>
<td>Coast trip · family trip · 7-seater · Borjomi</td>
<td>Peak budget</td>
<td>Peak content</td>
<td>Partner review at 90 days</td>
<td>Dynamic pricing engine</td>
<td>Peak pricing live</td>
<td>Highest-volume month</td>
</tr>
<tr class="even">
<td><strong>Jun</strong><br />
M10</td>
<td>Maintain; monitor cannibalisation</td>
<td>Svaneti summer · Tusheti · Hebrew family · 5-day Georgia</td>
<td>Peak budget</td>
<td>Peak content</td>
<td>Renew winners, drop non-producers</td>
<td>Partner analytics</td>
<td>Peak pricing; monitor utilisation</td>
<td>Peak revenue</td>
</tr>
<tr class="odd">
<td><strong>Jul</strong><br />
M11</td>
<td>Refresh top-performing pages</td>
<td>Mountain routes · RU Batumi · refresh top 5 · Armenia crossing</td>
<td>Maintain</td>
<td>Peak content</td>
<td>Corporate accounts</td>
<td>Customer dashboard</td>
<td>Peak pricing</td>
<td>Peak revenue</td>
</tr>
<tr class="even">
<td><strong>Aug</strong><br />
M12</td>
<td><strong>Annual audit</strong>; plan year 2</td>
<td>Autumn harvest · refresh next 5 · luxury guide · content audit</td>
<td>Shift to autumn/winter</td>
<td>Autumn transition</td>
<td>Annual partner review</td>
<td>Consolidate</td>
<td><strong>Full-year fleet review</strong></td>
<td>Full-year vs §2.20 scenarios</td>
</tr>
</tbody>
</table>

Realistic for a small operator: roughly one developer working part-time, one writer producing four pieces a month, and your own time on outreach and reviews. Total external cash requirement over 12 months, excluding ad spend: approximately \$2,000–\$5,000 (translation, freelance writing, print, payment setup). Ad spend as scoped: \$300–900/month from month 2.

------------------------------------------------------------------------

## 2.25 — How to make more money — ranked by financial impact

| \#  | Opportunity                                     | Current situation                                                                                              | Proposed change                                                                         | Expected revenue effect                                                                                | Difficulty          | Time                    | Risk                                                     |
|-----|-------------------------------------------------|----------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|---------------------|-------------------------|----------------------------------------------------------|
| 1   | **Shift the mix toward exotic & luxury**        | Ferrari, G63, M8 listed but unmarketed, unindexed, with no dedicated page                                      | Supercar landing page, IG/TikTok content, concierge partnerships, dedicated ad campaign | Very high — each booking pays \$252–720 vs \$26–46. 20% exotic mix roughly doubles revenue per booking | Medium              | 1–3 months              | Low — inventory already exists                           |
| 2   | **Index the 94 vehicle pages**                  | Zero in sitemap, zero schema                                                                                   | Sitemap generation + Product/Offer schema + unique copy                                 | Very high — 94 high-intent pages from a fixed cost                                                     | Low                 | 1–2 days + rolling copy | Low, if copy is genuinely unique                         |
| 3   | **Fix the price claim and show all-in pricing** | \$25 claimed, \$39 real; fee hidden until checkout                                                             | Honest floor price, total shown on card                                                 | Very high — a conversion-rate change multiplies every other effort                                     | Low                 | 3 days                  | Low — visible price rises, but abandonment falls further |
| 4   | **Increase rental duration**                    | Duration tiers mostly null; a 30-day renter pays the 1-day rate                                                | Populate tiers; market monthly hard to expats; renewal campaign at day −5               | High — a 7-day booking is 1.9× a 3-day one in platform fee and 2.3× in rental revenue, on one handover | Low                 | 1 week                  | Low                                                      |
| 5   | **Increase direct bookings**                    | Aggregators own the head terms; you pay their commission on fill                                               | Long-tail SEO, reviews, GBP, and a first-rental → repeat conversion play                | High — direct bookings carry no aggregator commission                                                  | Medium              | 6–12 months             | Low                                                      |
| 6   | **Grow reviews from near-zero**                 | Trent ~412, Localrent 4,509, you ≈ 0                                                                           | Ask every customer at handback; reply within 24h                                        | High — the gating factor on local pack and on conversion                                               | Easy but relentless | Continuous              | Low                                                      |
| 7   | **Increase airport bookings**                   | 3 pages live; KUT and BUS thin; BUS growing +32%                                                               | Rewrite with practical arrival detail; ads on KUT/BUS; transfer-company partnerships    | High — highest-intent traffic in the category                                                          | Medium              | 2 months                | Low                                                      |
| 8   | **Recover abandoned bookings**                  | `pending` bookings with no payment sit in the DB untouched                                                     | WhatsApp at 1 hour, email at 24 hours                                                   | High — these customers already chose a car                                                             | Medium              | 3 days                  | Low                                                      |
| 9   | **Fix the OTP and partner-acceptance steps**    | Foreign tourists asked for SMS before payment; then wait for a human                                           | Measure OTP verification rate; add auto-accept for trusted partners                     | High — two silent losses in the middle of the funnel                                                   | Medium              | 1 week                  | Medium — fraud exposure needs monitoring                 |
| 10  | **Fix the Russian site**                        | /ru/ half-English; Russia is the largest source market by volume and spend                                     | Complete translation, native review, Yandex Business + 2GIS + Yandex Direct             | High — largest untapped market                                                                         | Medium              | 1 month                 | Low                                                      |
| 11  | **Raise prices where utilisation is high**      | Flat pricing; no seasonal or dynamic rules                                                                     | Seasonal index + dynamic rules from §2.17                                               | Medium-high — pure margin, no acquisition cost                                                         | Medium              | 1 month                 | Medium — needs real utilisation data first               |
| 12  | **Increase upsells at pickup**                  | Extras exist in the DB (child seat, snow chains, additional driver, insurance tiers) but are not actively sold | Structured offer at handover + upsell in the confirmation email                         | Medium-high — near-100% margin                                                                         | Easy                | 2 weeks                 | Low                                                      |
| 13  | **Chauffeur / with-driver service**             | 57-word page; aggregators structurally cannot offer this                                                       | Real service page, pricing, content, Gulf and Russian targeting                         | Medium-high — higher day rate, no competition                                                          | Medium              | 1 month                 | Medium — needs real driver supply                        |
| 14  | **Hotel and concierge partnerships**            | None signed                                                                                                    | \$15 flat for accommodation, 15% of fee for luxury concierge                            | Medium — steady, uncorrelated with SEO                                                                 | Medium              | 2–3 months              | Low                                                      |
| 15  | **Increase repeat customers**                   | No CRM, no segmentation, no reactivation                                                                       | §2.18 segments and sequences on your existing DB                                        | Medium — repeat bookings have near-zero CAC                                                            | Medium              | 2–3 months              | Low                                                      |
| 16  | **Reduce low-value discounting**                | One promo code, no discount policy                                                                             | Discount only on low-season and long-duration; never on peak or exotic                  | Medium — protects margin                                                                               | Easy                | Immediate               | Low                                                      |
| 17  | **Flatten the budget-tier fee**                 | 22.5% on budget short rentals makes you 62% dearer than DiscoverCars                                           | Cut to 15% / 13%                                                                        | Uncertain — needs +39% budget volume to break even                                                     | Easy to implement   | 1 day                   | Medium — could reduce revenue if volume doesn't respond  |
| 18  | **Grow fleet supply (partners)**                | 94 cars; partner signup is \$4.99 or invite                                                                    | Actively recruit Batumi and Kutaisi partners for regional coverage                      | Medium — more inventory, more long-tail pages, more coverage                                           | Medium              | Ongoing                 | Medium — quality control                                 |
| 19  | **Grow own fleet**                              | Own cars visible on the platform                                                                               | See §2.27 — **do not buy until utilisation is proven**                                  | Uncertain — 6× the CAC headroom per booking, but capital-intensive                                     | Hard                | 3–12 months             | High — capital at risk                                   |
| 20  | **Georgian-language market**                    | /ka/ half-translated; 5.5M domestic tourists (+8.4%)                                                           | Complete translation; local weekend and occasion offers                                 | Low-medium — lower ABV but zero aggregator competition                                                 | Easy                | 2 weeks                 | Low                                                      |

------------------------------------------------------------------------

## 2.26 — Profit maximisation

**Profit = Revenue − Vehicle Costs − Marketing − Operating − Commissions − Maintenance − Other.** Of those seven terms, this session can compute exactly one.

**⚑ The honest position on profit**

\*\*\[Data unavailable — do not assume\]\*\* Vehicle acquisition and depreciation, maintenance, insurance, fuel, cleaning, hosting, PayPal fees, support hours, partner management time — none are available. **Per-vehicle profitability cannot be calculated in this session.** What follows is the framework and the three things that are computable from the live platform.

#### What is computable today

1.  **Platform fee per booking** — exact, from the live matrix.
2.  **Take rate by tier** — exact. It is regressive, and that shape is a profit decision you have made without necessarily meaning to.
3.  **Relative revenue per car** — computable from your production database in one query: `SELECT vehicle_id, COUNT(*), SUM(total_price), SUM(service_fee), SUM(rental_days) FROM bookings WHERE status='completed' GROUP BY vehicle_id`. Run it, join it to days-available, and you have the utilisation and revenue-per-available-day figures that the rest of this section needs.

### The four-quadrant framework

| Quadrant                         | Signature                                                                                              | Action                                                                                                                                                        | How to identify from your DB                                          |
|----------------------------------|--------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------|
| **High revenue / high profit**   | Strong utilisation, high day rate, low maintenance                                                     | **Promote hard, replicate, acquire more.** Feature on landing pages, put ad budget behind them, buy the next one of these                                     | Utilisation \>60% AND revenue per available day above fleet median    |
| **High revenue / low profit**    | Books constantly but eats it in maintenance, fuel or depreciation — often older SUVs on mountain roads | **Reprice upward or replace.** High utilisation with low profit is the classic signal of underpricing. Raise the rate before you conclude the car is bad      | Utilisation \>60% AND revenue per available day below median          |
| **Low revenue / high potential** | Good car, poorly presented, wrong category, bad photos, or no page anyone can find                     | **Fix the presentation before touching the price.** Most low-utilisation cars in your fleet today are here — because none of the 94 vehicle pages are indexed | Utilisation \<30% BUT good specs and competitive pricing              |
| **Low revenue / low potential**  | Wrong car for this market — poor category fit, high running cost, high age, unpopular class            | **Reprice once, then exit.** Sell or return to the partner. An idle car costs insurance, depreciation and parking every day                                   | Utilisation \<30% after presentation and pricing have both been fixed |

**⚑ The trap to avoid**

Right now **every car in your fleet looks like a low-revenue car**, because none of them have findable pages. Do not make a single keep-or-cut decision until the vehicle pages have been indexed for 90 days. Cutting a car for low utilisation when the real cause was a missing sitemap entry is an expensive mistake that cannot be undone.

#### What the live data does suggest

| Observation                                                       | Implication                                                                                                                                                                                                                                                               |
|-------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| RAV4 2018 at \$45/day sits just under the \$50 tier boundary      | It carries the 22.5% fee band. At \$50/day it would drop to 18% — the guest could pay *less in total* on a short rental while the partner earns more. **Check every car priced \$45–\$49 and \$75–\$79 for this artefact.**                                               |
| Fusion and Prius both at \$39/day                                 | Two cars competing for the same booking at the same price. Differentiate them (one as the fuel-economy pick, one as the space pick) or reprice one.                                                                                                                       |
| Camry 2012 and RAV4 2018 both at \$45                             | A 6-year age gap at an identical price. The RAV4 is underpriced relative to the Camry, or the Camry is overpriced.                                                                                                                                                        |
| Exotic tier (\$700–\$2,000) sits in the lowest fee band (7.5–12%) | The highest-value bookings in the business pay your lowest percentage — but the largest absolute fee. **Do not raise the exotic rate.** The absolute dollars are what matter and price sensitivity is low; volume growth is worth far more here than an extra two points. |

------------------------------------------------------------------------

## 2.27 — Fleet expansion

**⚑ The recommendation is: do not buy a car yet**

\*\*\[Data unavailable — do not assume\]\*\* Fleet expansion requires demonstrated demand — utilisation by car, turn-aways by category, and seasonal peaks. None of that is in this session, and more importantly, **your current utilisation figures are not yet meaningful** because your vehicle pages have been invisible to search. Buying a second Palisade because the first one is busy, when the first one is busy despite having no findable page, tells you nothing about whether a second one would fill.

### The decision gate

Buy a car only when **all four** of these are true — check them in this order:

1.  **Vehicle pages have been indexed for 90+ days** so utilisation reflects real demand rather than invisibility.
2.  **The existing car in that class exceeds 70% utilisation across a full quarter**, not just in August.
3.  **You are turning away bookings in that class** — measurable: log every availability check that returns nothing, by category and date. Build this log before you build anything else in this section; it is the only true demand signal you can get.
4.  **Payback is under 24 months** at conservative utilisation, using real acquisition cost, insurance, maintenance and depreciation.

#### If the gate opens — acquisition order

| Order | Vehicle                                                             | Rationale                                                                                                                                                                          | Expected utilisation driver                                     | Risk                                                                                      |
|-------|---------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------|-------------------------------------------------------------------------------------------|
| 1     | **A second high-value SUV/7-seater** (Palisade or Highlander class) | Highest-value non-exotic segment; Israeli families, EU road-trippers and ski season all want this exact car. Your two most-content-supported clusters (SUV, road trips) point here | Year-round: summer families, winter 4×4, autumn Kakheti         | Low — proven demand shape in this market                                                  |
| 2     | **A second exotic or a strong luxury sedan**                        | Highest fee per booking by an order of magnitude, no competition, and the fleet doubles as your marketing content                                                                  | Weddings, events, Gulf and Russian visitors, content production | Medium — high capital, seasonal, expensive to repair. But a single booking pays \$252–720 |
| 3     | **An additional AWD SUV** (RAV4 / Outlander class)                  | The workhorse class. Fills ski season and shoulder season and takes overflow from \#1                                                                                              | Ski, mountain routes, general tourism                           | Low                                                                                       |
| 4     | **An automatic mid-size sedan** (Camry class)                       | Business travel and long-term expat demand; weekday utilisation when tourist demand is flat                                                                                        | Corporate, monthly rentals                                      | Low — but lowest revenue per day                                                          |
| 5     | Economy vehicles                                                    | **Do not buy.** This is exactly the segment where the aggregators beat you on price and your fee structure hurts most. Let partners supply it                                      | —                                                               | High — competing at your weakest point with your own capital                              |

**⚑ The cheaper alternative to buying**

You run a marketplace. **Adding a partner's car costs you nothing and adds the same inventory.** Before spending capital on a vehicle, spend three weeks recruiting partners who already own the cars you would have bought — especially in Batumi and Kutaisi where your regional coverage is thinnest and Batumi Airport is growing at +32%. The economics are not equivalent (you earn the fee, not the rental), but the risk is zero and the capital stays in your pocket. **Recruit supply first; buy only where marketplace supply genuinely cannot reach — which in practice means the exotic tier, where partners rarely own the cars.**

#### Payback template — fill it with your own numbers

| Input                 | Source                                                | Value                   |
|-----------------------|-------------------------------------------------------|-------------------------|
| Acquisition cost      | Purchase price + registration + insurance year 1      | \*\*\[Your figure\]\*\* |
| Daily rate            | Your pricing (e.g. Palisade \$85)                     | Known from the site     |
| Realistic utilisation | Existing comparable car, full year, not peak month    | \*\*\[Your figure\]\*\* |
| Annual gross revenue  | Rate × 365 × utilisation                              | Computed                |
| Annual running cost   | Insurance + maintenance + tyres + cleaning + parking  | \*\*\[Your figure\]\*\* |
| Annual depreciation   | 15–20% of value for a used car in this market         | \*\*\[Your figure\]\*\* |
| **Payback (months)**  | Acquisition ÷ ((gross − running − depreciation) ÷ 12) | **Must be under 24**    |

------------------------------------------------------------------------

## 2.28 — Priority lists

### Top 10 — implement immediately

| P   | Action                                                                      | Impact | Difficulty | Time     | Financial effect                                                                   |
|-----|-----------------------------------------------------------------------------|--------|------------|----------|------------------------------------------------------------------------------------|
| 1   | Fix every "\$25/day" claim to the true \$39 floor, all four languages + GBP | High   | Easy       | 1 day    | Recovers bounced high-intent traffic; removes ad-disapproval risk                  |
| 2   | Generate vehicle sitemap entries + Product/Offer/Car schema                 | High   | Medium     | 1–2 days | 94 indexable commercial pages from one change                                      |
| 3   | Configure the Telegram token on the server                                  | High   | Easy       | 15 min   | Faster partner acceptance = fewer lost paid bookings                               |
| 4   | Remove the duplicate GBP listing; fully optimise the survivor               | High   | Easy       | 1 day    | Local pack is the highest-intent free channel there is                             |
| 5   | Start asking every single customer for a Google review at handback          | High   | Easy       | Ongoing  | Closes the single largest competitive gap                                          |
| 6   | Show all-in price (rental + fee) on cards and vehicle pages                 | High   | Medium     | 2 days   | Removes checkout shock — multiplies every other effort                             |
| 7   | Sticky mobile CTA + pre-filled WhatsApp on every vehicle page               | High   | Easy       | 1 day    | WhatsApp is the default channel in three of your four markets                      |
| 8   | GA4 funnel events, especially otp_sent → otp_verified                       | High   | Medium     | 2 days   | Without it, every later decision is guesswork                                      |
| 9   | Build /supercar-rental-tbilisi                                              | High   | Medium     | 2 days   | Opens a \$252–720-per-booking category with no competitor                          |
| 10  | Populate duration price tiers across the fleet                              | Medium | Easy       | 1 day    | Longer rentals: a 7-day booking is 1.9× a 3-day one in fee, 2.3× in rental revenue |

### Top 10 — most revenue potential

| P   | Action                                                                            | Impact      | Difficulty | Time     | Financial effect                                                    |
|-----|-----------------------------------------------------------------------------------|-------------|------------|----------|---------------------------------------------------------------------|
| 1   | Own the exotic & supercar category end to end                                     | High        | Medium     | 3 months | \$252–720/booking vs \$26–46; 20% mix ≈ doubles revenue per booking |
| 2   | Index and populate all 94 vehicle pages                                           | High        | Medium     | 3 months | The largest single traffic unlock available                         |
| 3   | Raise conversion from ~0.8% to 1.5%+ (price honesty, availability, CTAs, reviews) | High        | Medium     | 3 months | Base vs Conservative in §2.20 = 7.6× platform revenue at M12        |
| 4   | Fix and market the Russian site + Yandex                                          | High        | Medium     | 2 months | Largest source market: 1.25M visits, \$823M spend                   |
| 5   | Own Kutaisi and Batumi airport terms                                              | High        | Medium     | 2 months | Highest-intent traffic, weakest competitive fields                  |
| 6   | Long-term / monthly rental push to Tbilisi expats                                 | High        | Easy       | 1 month  | \$84–95 fee per booking, 14–30 days, low seasonality                |
| 7   | Hebrew market, done properly                                                      | Medium-high | Medium     | 3 months | +29.4% growth; competitors' Hebrew is thin                          |
| 8   | Seasonal + dynamic pricing                                                        | Medium-high | Medium     | 2 months | Pure margin — no acquisition cost attached                          |
| 9   | Chauffeur service built out properly                                              | Medium      | Medium     | 2 months | Higher day rate; aggregators structurally excluded                  |
| 10  | Hotel and concierge partner network                                               | Medium      | Medium     | 3 months | Steady volume uncorrelated with search rankings                     |

### Top 10 — SEO

| P   | Action                                                               | Impact | Difficulty | Time     |
|-----|----------------------------------------------------------------------|--------|------------|----------|
| 1   | Vehicle pages into the sitemap with Product/Offer schema             | High   | Medium     | 1–2 days |
| 2   | Build the supercar landing page and cluster                          | High   | Medium     | 1 week   |
| 3   | Rewrite Kutaisi and Batumi airport pages with real arrival detail    | High   | Medium     | 3 days   |
| 4   | Full 5-way reciprocal hreflang on every page                         | Medium | Easy       | ½ day    |
| 5   | Complete RU and KA translation                                       | High   | Medium     | 1 week   |
| 6   | Four destination pages: Gudauri, Svaneti, Kazbegi, Kakheti           | High   | Medium     | 1 week   |
| 7   | Add real E-E-A-T signals to all nine guides (currently zero of nine) | Medium | Easy       | 1 week   |
| 8   | Expand the four thinnest guides past 1,200 words                     | Medium | Medium     | 2 weeks  |
| 9   | Earn 5+ editorial links from Georgia travel blogs                    | High   | Hard       | 3 months |
| 10  | Fill the keyword registry with real Keyword Planner and GSC data     | Medium | Easy       | 1 day    |

### Top 10 — website improvements

| P   | Action                                                    | Impact | Difficulty | Time     |
|-----|-----------------------------------------------------------|--------|------------|----------|
| 1   | All-in price on every card and vehicle page               | High   | Medium     | 2 days   |
| 2   | Real-time availability in the listing + date-first search | High   | Medium     | 3–5 days |
| 3   | Sticky mobile CTA bar                                     | High   | Easy       | 1 day    |
| 4   | Pre-filled WhatsApp CTA on every vehicle page             | High   | Easy       | 1 day    |
| 5   | Abandoned-booking recovery                                | High   | Medium     | 3 days   |
| 6   | Defer 10 scripts, merge CSS, WebP all large images        | Medium | Easy       | 1 day    |
| 7   | Deposit badge and no-deposit filter                       | Medium | Easy       | 1 day    |
| 8   | Reviews displayed on vehicle and landing pages            | High   | Medium     | 2 days   |
| 9   | Card payment alongside PayPal                             | High   | Hard       | 2 weeks  |
| 10  | Instant booking / auto-accept for trusted partners        | High   | Medium     | 4 days   |

### Top 10 — marketing

| P   | Action                                                                          | Impact | Difficulty | Time    |
|-----|---------------------------------------------------------------------------------|--------|------------|---------|
| 1   | Google Business Profile fully optimised, duplicate removed                      | High   | Easy       | 1 day   |
| 2   | Review collection at every handback, forever                                    | High   | Easy       | Ongoing |
| 3   | Instagram + TikTok supercar content                                             | High   | Medium     | Ongoing |
| 4   | Google Ads: brand + supercar + Kutaisi only, with the negative list built first | Medium | Medium     | 1 week  |
| 5   | 15 travel-blog pitches for inclusion + affiliate                                | High   | Hard       | 3 weeks |
| 6   | 5–10 hotel partners at \$15 flat + promo codes                                  | Medium | Medium     | 3 weeks |
| 7   | Yandex Business + 2GIS + Yandex Direct for the Russian market                   | Medium | Easy       | 1 week  |
| 8   | Israeli travel Facebook communities, in Hebrew                                  | Medium | Medium     | Ongoing |
| 9   | "Caucasus Supercar Run" digital PR campaign                                     | Medium | Hard       | 3 weeks |
| 10  | List the fleet on Localrent and DiscoverCars as a supplier                      | Medium | Easy       | 2 days  |

### Top 10 — automation

| P   | Automation                                                               | Impact | Difficulty | Time    |
|-----|--------------------------------------------------------------------------|--------|------------|---------|
| 1   | Telegram owner alerts (code deployed, token missing)                     | High   | Trivial    | 15 min  |
| 2   | Abandoned-booking WhatsApp at 1h, email at 24h                           | High   | Medium     | 3 days  |
| 3   | Post-rental review request, 2–4h after return                            | High   | Easy       | 2 days  |
| 4   | Vehicle sitemap regenerated on every deploy                              | High   | Easy       | 1 day   |
| 5   | Long-term rental renewal offer at day −5                                 | Medium | Easy       | 1 day   |
| 6   | Return-to-Georgia campaign at 11 months                                  | Medium | Medium     | 2 days  |
| 7   | Auto-accept for verified partners with good history                      | High   | Medium     | 4 days  |
| 8   | Weekly KPI email from the eight dashboard queries                        | Medium | Easy       | 2 days  |
| 9   | Availability-check-with-no-results logging (the demand signal for §2.27) | Medium | Easy       | 1 day   |
| 10  | Dynamic pricing rules applied automatically                              | Medium | Hard       | 2 weeks |

### Top 10 — cost savings

| P   | Saving                                                                                    | Impact | Difficulty | Time      |
|-----|-------------------------------------------------------------------------------------------|--------|------------|-----------|
| 1   | Build the Google Ads negative-keyword list before spending a cent (USA/Georgia collision) | High   | Easy       | 2 hours   |
| 2   | Do not run Performance Max or broad match                                                 | High   | Easy       | —         |
| 3   | Do not buy TikTok, display or influencer ads — organic and barter instead                 | Medium | Easy       | —         |
| 4   | Do not build Turkish or Armenian language versions                                        | Medium | Easy       | —         |
| 5   | Do not buy a CRM — SQL on your existing Postgres does 90% of it                           | Medium | Easy       | —         |
| 6   | Do not buy an SEO retainer larger than one month's platform revenue                       | Medium | Easy       | —         |
| 7   | Do not buy a car until the four-part gate in §2.27 is passed                              | High   | Easy       | —         |
| 8   | Compress 28 MB of images — bandwidth and speed both                                       | Low    | Easy       | 1 day     |
| 9   | Kill discounting outside low season and long duration                                     | Medium | Easy       | Immediate |
| 10  | Drop partners producing nothing at the 90-day review                                      | Low    | Easy       | Quarterly |

### Top 10 — fleet decisions

| P   | Decision                                                                            | Impact | Difficulty | Time       |
|-----|-------------------------------------------------------------------------------------|--------|------------|------------|
| 1   | **Buy nothing** until vehicle pages have been indexed 90 days                       | High   | Easy       | Immediate  |
| 2   | Log every availability check that returns nothing — the only true demand signal     | High   | Easy       | 1 day      |
| 3   | Promote the exotics hard — they are the most under-utilised asset you own           | High   | Medium     | 1 month    |
| 4   | Audit every car priced \$45–49 and \$75–79 for the fee-tier boundary artefact       | Medium | Easy       | 1 day      |
| 5   | Differentiate or reprice the two \$39 cars and the two \$45 cars                    | Medium | Easy       | 1 day      |
| 6   | Recruit partners in Batumi and Kutaisi before buying anything                       | High   | Medium     | 1 month    |
| 7   | Run the per-vehicle revenue query monthly and track the four quadrants              | High   | Easy       | 1 hour/mo  |
| 8   | If the gate opens: a second high-value SUV/7-seater first                           | Medium | Hard       | 3–6 months |
| 9   | Never buy economy — that is the partners' job and your weakest segment              | Medium | Easy       | —          |
| 10  | Exit any car still under 30% utilisation 90 days after its page and price are fixed | Medium | Medium     | Quarterly  |

------------------------------------------------------------------------

## 2.29 — Executive strategy — 21 answers

#### 1 · Where are EliteAuto's customers currently coming from?

\*\*\[Data unavailable — do not assume\]\*\* No GA4 channel data in this session. Structurally, the answer is almost certainly: direct and WhatsApp from people who already know you, plus a small amount of organic on long-tail landing-page terms. It is **not** coming from vehicle pages (unindexed), not from the local pack (near-zero reviews, duplicate listing), not from Russian or Georgian search (half-translated pages), and not from paid (no campaigns). Confirm in GA4 → Acquisition → Traffic acquisition, this week.

#### 2 · Where should the next customers come from?

In order: **(a)** the 94 vehicle pages once indexed — high intent, zero marginal cost; **(b)** the supercar category, which nobody in Georgia competes for; **(c)** Kutaisi and Batumi airport search, the weakest competitive fields with the highest intent; **(d)** the Google local pack, once reviews exist; **(e)** Russian search via Yandex, your largest source market.

#### 3 · Which customer segment first?

**Luxury and exotic self-drive.** \$252–720 platform fee per booking against \$26–46 for budget; inventory no competitor in Georgia has; price-insensitive buyers; and the cars double as your marketing content. Second: **long-stay expats in Tbilisi** — \$84–95 per booking, low competition, low seasonality, and they search in English.

#### 4 · Which Google searches should you dominate?

**Realistically winnable:** supercar and exotic terms; all 94 *\[brand\] \[model\] rental georgia* queries; kutaisi and batumi airport rental; car rental gudauri/svaneti/kazbegi/kakheti; monthly car rental tbilisi; no deposit car rental georgia; car rental insurance georgia; the Hebrew set. **Do not chase:** "car rental georgia", "car rental tbilisi", "tbilisi airport car rental" as head terms — those belong to aged aggregators and global brands and will cost more than they return for at least a year.

#### 5 · Which pages first?

**1.** /supercar-rental-tbilisi. **2.** All 94 vehicle pages (sitemap + schema, then unique copy in priority order). **3.** Rewritten Kutaisi and Batumi airport pages. **4.** /car-rental-gudauri (before November). **5.** Rebuilt drivers.html. **6.** Svaneti, Kazbegi, Kakheti destination pages.

#### 6 · Which vehicles to promote?

**Ferrari 296 GTB, Mercedes G63, BMW M8 Competition** — highest fee per booking by an order of magnitude and unmatched in the market. Then **Palisade and Highlander** (7-seat SUVs: Israeli families, EU road trips, ski season). Then **RAV4** for the mountain/4×4 content that already exists. Do not put promotional effort behind the \$39 sedans — they compete where you are weakest.

#### 7 · Which vehicles to reprice?

Audit every car priced **\$45–\$49** and **\$75–\$79** — they sit just below a fee-tier boundary, so a small price rise can lower the guest's total while raising the partner's revenue. Specifically: the **RAV4 2018 at \$45**. Also differentiate or reprice the two \$39 cars (Fusion, Prius) and the two \$45 cars (RAV4 2018, Camry 2012 — a six-year age gap at an identical price). **Leave the exotics alone** — the absolute fee is what matters there.

#### 8 · Which vehicles to add?

**None yet.** Utilisation figures are meaningless while vehicle pages are invisible to search. Pass the four-part gate in §2.27 first. When it opens: a second high-value SUV/7-seater, then a second exotic. **Never economy.** And before spending capital at all — recruit partners in Batumi and Kutaisi who already own the cars.

#### 9 · Which channels get money?

**Google Ads** on brand, supercar, Kutaisi, Batumi, long-term and SUV — \$300–900/month, negative list built first. **Meta/Instagram** for supercar content and retargeting — \$150–300/month. **Yandex Direct** once /ru/ is fixed. **Native translation** — \$250–650 one-off. **Freelance writing** — \$0–400/month. **Aggregator commissions** as utilisation fill.

#### 10 · Which channels get little or nothing?

**Nothing:** Performance Max, broad match, programmatic display, paid TikTok, paid influencer sponsorships, Turkish/Armenian localisation, purchased links, a CRM product, SEO retainers above one month's revenue. **Little:** "car rental georgia" head-term bidding, Tbilisi Airport ads (exact match with a hard cap only), Facebook page advertising as distinct from group participation.

#### 11 · How to differentiate?

Not on price — you cannot win there and the fee structure makes it worse. Differentiate on **inventory nobody else has** (supercars, chauffeur service), **languages nobody else serves properly** (Hebrew done deeply, Georgian at all), **local operator knowledge** (real road conditions, real routes, written by someone who drives them), and **honest, complete pricing** — which, once §2.3's first finding is fixed, becomes a genuine claim rather than a liability.

#### 12 · How to increase direct bookings?

Index the vehicle pages. Get reviews so the local pack works. Fix the price claim so paid and organic clicks convert. Then convert every aggregator-sourced customer into a direct one on their next trip: a personal WhatsApp thank-you, a direct-booking code in the confirmation, and the return-to-Georgia campaign at 11 months. The first booking can be the aggregator's; the second should be yours.

#### 13 · How to increase repeat customers?

The CRM data already exists in your database. Build the §2.18 segments, then the sequences in build order: abandoned booking, review request, return-to-Georgia at 11 months, seasonal by what they actually rented, long-term renewal at day −5. Israeli, Russian and EU visitors repeat Georgia at high rates — the return-to-Georgia campaign is the highest-value one.

#### 14 · How to reduce CAC?

Raise conversion rate — it divides every acquisition cost you have. Shift the mix upmarket, so each acquired customer is worth 2–15× more. Build organic and local channels where marginal cost is zero. Route paid traffic to your **own fleet**, where the CAC ceiling is roughly six times higher. Build referrals, whose CAC is a \$10 credit. And never bid above 50% of the platform fee for that campaign's typical booking.

#### 15 · How to increase average booking value?

Mix, duration and upsell, in that order. **Mix:** promote exotic and luxury — a 20% exotic share roughly doubles revenue per booking at identical traffic. **Duration:** populate duration price tiers and market monthly hard; a 7-day booking is 1.9× a 3-day one in platform fee and 2.3× in rental revenue. **Upsell:** child seat, snow chains, additional driver and insurance upgrade at handover — near-100% margin, currently unsold.

#### 16 · How to increase fleet utilisation?

First make the cars findable — 94 unindexed pages is the largest utilisation problem you have. Then: seasonal and dynamic pricing to fill low-demand windows; long-term rentals to fill November and March; corporate accounts to fill weekdays; aggregator listings to fill whatever remains; and ski-season 4×4 packages to fill December to February.

#### 17 · What should be automated?

In build order: Telegram alerts (15 minutes, already coded), abandoned-booking recovery, post-rental review requests, sitemap regeneration on deploy, long-term renewal offers, the return-to-Georgia campaign, partner auto-accept, the weekly KPI email, and the empty-availability-check log. Dynamic pricing last — it needs volume to matter.

#### 18 · What should be built on the website?

Four days of work first: vehicle sitemap + schema, all-in price display, sticky mobile CTA with pre-filled WhatsApp, Telegram token. Then: real-time availability in the listing, abandoned-booking recovery, review system wired to the funnel, slug URLs, deposit badges, instant booking, card payment. §2.22 has all 22 ranked.

#### 19 · The next 7 days

**Mon:** Fix every "\$25/day" claim in all four languages and the GBP plan. Set the Telegram token. **Tue:** Vehicle sitemap generation + Product/Offer schema — deploy and submit to Search Console. **Wed:** Remove the duplicate Google listing; optimise the survivor; upload 20 photos; seed 5 Q&As. **Thu:** GA4 funnel events, especially `otp_sent` → `otp_verified`. **Fri:** Sticky mobile CTA + pre-filled WhatsApp on vehicle pages; start asking every customer for a review at handback. **Weekend:** Draft the supercar landing page.

#### 20 · The next 90 days

**Days 1–30:** stop the bleeding and unlock what exists — price honesty, vehicle indexing, GBP, reviews, tracking, speed, supercar page. **Days 31–60:** content, language and partners — RU/KA/HE fixed and reviewed, airport pages rewritten, four guides published, 5–10 hotel partners, 15 blog pitches, first ad campaigns. **Days 61–90:** scale and prepare for winter — four destination pages, ski content live before November, unique copy for the top 40 vehicles, digital PR, dynamic pricing, the KPI dashboard.

#### 21 · The 12-month strategy in one paragraph

**Stop competing on price against aggregators who will always beat you, and become the operator people choose for the cars and the languages nobody else offers.** Fix the honesty problem first — a false price claim poisons every channel downstream. Make the 94 cars findable, because that is the largest free traffic unlock available. Build the supercar category, because it is the only place where you are the market rather than a participant, and because one Ferrari booking is worth twenty-seven Ford Fusion bookings. Earn reviews relentlessly, because that is the single gap between you and Trent. Serve Russian and Hebrew properly, because those are the largest and the fastest-growing markets and both are half-served. Recruit partner supply in Batumi and Kutaisi before spending a lari on a car. Then, and only then, look at the utilisation numbers and decide what to buy.

------------------------------------------------------------------------

## Sources and verification

#### Market and aviation data

- [Civil Georgia — Georgia Sees Nearly 7 Million International Visits in 2025, Most From Russia](https://civil.ge/archives/717769)
- [1TV — National Tourism Administration: Georgia welcomes record tourists in 2025](https://1tv.ge/lang/en/news/national-tourism-administration-georgia-welcomes-record-5-5-million-tourists-in-2025/)
- [Georgia Tourism Hits Record 6.1 Million Visits in 2025 — source-market breakdown and revenue](https://internationalinvestment.biz/en/tourism/6317-tourism-in-georgia-61-million-visits-and-a-new-seasonal-record.html)
- [Georgia Today — Passenger traffic at Georgian airports reaches record 6.5 million (Jan–Sep 2025)](https://georgiatoday.ge/passenger-traffic-at-georgian-airports-reaches-record-6-5-million-in-2025/)
- [1TV — 8.5m passenger milestone across Tbilisi, Batumi and Kutaisi](https://1tv.ge/lang/en/news/georgian-pm-record-passenger-surge-hits-tbilisi-batumi-and-kutaisi-hubs-following-landmark-8-5m-traveller-milestone/)
- [Georgia Today — Winter ski season opening dates](https://georgiatoday.ge/georgia-opens-winter-ski-season-bakurianis-kokhta-slopes-to-launch-on-december-20/)

#### Competitor pages, read 23 August 2026

- [Localrent — Georgia](https://localrent.com/en/georgia/) · [DiscoverCars — Georgia](https://www.discovercars.com/georgia) · [Naniko](https://naniko.com/) · [Rent Cars Georgia](https://rentcarsgeorgia.com/) · [cardrive.ge (Hebrew)](https://cardrive.ge/il/index.html)
- Hebrew SERP contested by [travel-tbilisi.co.il](https://travel-tbilisi.co.il/car-rental/), [paapmpaapm.com](https://paapmpaapm.com/locations/georgia.html), Avis Israel and Ofran
- "No deposit" SERP contested by [rentiocars.com](https://rentiocars.com/car-rental-georgia-no-deposit/), [rentalcartbilisi.com](https://rentalcartbilisi.com/), [fstarentcar.com](https://fstarentcar.com/)
- [Skyscanner — Tbilisi Airport rates](https://www.skyscanner.com/car-rental-from/tbs/car-rental-from-tbilisi-airport.html), [Sixt TBS](https://www.sixt.com/car-rental/georgia/tbilisi/tbilisi-international-airport/), [Hertz TBS](https://www.hertz.com/us/en/location/georgia/tbilisi/tbst50)

#### EliteAuto.rent — inspected directly

- Live: [homepage](https://eliteauto.rent/), [fleet listing (94 vehicles, \$39–\$2,000)](https://eliteauto.rent/vehicles.html), [a vehicle page](https://eliteauto.rent/vehicle.html?id=1), [/ru/](https://eliteauto.rent/ru/), [/ka/](https://eliteauto.rent/ka/)
- Project source in the connected Myrent.com folder: `server/services/reservation-fee.js` (fee matrix), `sitemap.xml` (50 URLs), `robots.txt`, page HTML and head blocks, `.seo-engine/` data files, `OFFPAGE-PLAYBOOK.md`, `PROJECT-OVERVIEW.md`

**Not available and not estimated:** keyword search volumes, CPC, keyword difficulty, your GA4 and Search Console figures, your revenue, costs, utilisation, average booking value, conversion rates, and competitor traffic or domain-authority metrics. Every place those would be required is marked \*\*\[Data unavailable — do not assume\]\*\*.

**Chapter 2 · EliteAuto.rent Customer Acquisition, SEO, Marketing & Revenue Growth** — prepared 23 August 2026. Built without Chapter 1 financial data at your instruction: all financial sections are scenario models grounded in live prices, the live reservation-fee matrix, and published market statistics. Hand over your revenue, utilisation and GA4 figures and every model here can be re-cut against them.
