# EliteAuto.rent — Project Overview (for AI assistants & devs)

> Hand this file to a new Claude/dev session so it understands the whole site without re-exploring.
> Generated from a real code+DB scan (June 2026). Server returns 404 for `.md` files, so this is never public.
> If you want it auto-loaded every session, copy it to `CLAUDE.md`.

---

## 1. What this is
**EliteAuto.rent** — a car-rental **marketplace** for the country of **Georgia** (Tbilisi, Batumi, Kutaisi). Verified local **partners** list cars; **guests** book them; an **admin** approves partners/cars and manages everything. Launched ~May 2026. Languages: **EN / RU / KA**.

Owner is non-technical — defer technical decisions, explain plainly.

---

## 2. Stack & hosting
- **Backend:** Node.js + Express (`server/server.js`), PostgreSQL via `pg`. Process manager **PM2** (app name `eliteauto`).
- **Frontend:** **plain static HTML + vanilla JS** — *no framework, no build step*. Files are served directly from the repo root by `express.static`. Scripts are loaded via `<script src="...">`.
- **Hosting:** Hetzner VPS. Repo also on GitHub (`AnriT22/eliterent`, branch `master`).
- **Key deps:** express, pg, jsonwebtoken, bcryptjs, twilio, nodemailer, resend, multer, sharp, helmet, cors, compression, express-rate-limit, google-auth-library, dotenv. PayPal via custom `server/paypal.js`.

## 3. Deploy (IMPORTANT — read before "why isn't my change live")
Code on GitHub is **NOT live** until the server pulls it. Deploy = on the server:
```bash
cd /root/app && git pull origin master && pm2 restart eliteauto
```
- Server: `root@178.104.99.239`, app dir `/root/app`, PM2 name `eliteauto`.
- `_deploy.sh` (repo root) does pull + restart + health checks.
- Assistant with the user's SSH key can deploy: `ssh -i ~/.ssh/id_ed25519 root@178.104.99.239 "cd /root/app && git pull origin master && pm2 restart eliteauto"`.
- **Cache-busting:** HTML references assets as `script.js?v=N` / `style.css?v=N`. When you change a JS/CSS file, **bump the `?v=` in the HTML that loads it**, or returning visitors keep the cached old file.

## 4. Static-serving security (in `server/server.js`)
Returns 404 for: paths starting with `/_` (e.g. `_deploy.sh`, `_offpage-tracker.csv`), `/data/`, and `.db/.sqlite/.md` files. So `/server/*` backend source and internal `.md` docs are **not** publicly fetchable. There are also pretty-URL 301 redirects (e.g. `/rent-a-car/tbilisi` → `rent-car-tbilisi.html`).

---

## 5. Pages (HTML)
**Customer core:** `index.html` (home: hero search + fleet carousel showing 8 random cars, first 4 + "Browse More"), `vehicles.html` (fleet, 12/page pagination), `vehicle.html` (car detail), `reservation.html` (booking flow), `payment.html` (PayPal service fee), `booking.html` (per-reservation detail + travel-essentials affiliate strip), `guest-profile.html` (My Profile / My Bookings / favorites), `reviews.html`, `leave-a-review.html` (Google-review CTA + QR), `contact.html`, `about.html`.

**Auth:** `login.html`, `register.html`, `register-partner.html`, `verify-phone.html`, `reset-password.html`, `google-auth-success.html`.

**Partner:** `partner-dashboard.html`, `partner-financials.html`.

**Admin:** `admin.html` (full control panel).

**SEO landing pages** (English-only, self-canonical, Product/FAQ/Breadcrumb JSON-LD): city — `rent-car-tbilisi/batumi/kutaisi.html`; airport — `tbilisi/kutaisi/batumi-airport-car-rental.html`; category — `economy/sedan/suv/luxury/minivan-7-seater/automatic/cheap/monthly-long-term-...html`; `no-deposit-car-rental-georgia.html`.

**Blog/guides:** `blog.html` + `blog-car-rental-georgia-guide`, `blog-tbilisi-to-kazbegi`, `georgia-road-trip-itinerary`, `is-it-safe-to-drive-in-georgia`, `kakheti-wine-region-by-car`, `svaneti-mestia-road-trip`, `tbilisi-to-batumi-drive`, `tbilisi-to-gudauri-winter-drive`.

**Legal/util:** `tos.html`, `privacy.html`, `404.html`. `RoyalCar_Guide_GEO.html` = a real Georgian print instruction sheet (misnamed, noindex+disallowed — do NOT delete). `85a9e1a5-…html` = site-ownership verification token.

`login/register/reservation/booking/leave-a-review` are `noindex`.

## 6. Frontend JS (root)
`script.js` (home: carousel `renderCarousel`, `pickRandom`, search), `vehicles.css`+inline (vehicles list/pagination/filters), `vehicle.js` (car detail), `reservation.js` (booking flow + fee **display** mirror), `payment.js` (PayPal), `booking.js` (booking detail page), `guest-profile.js` (profile/bookings), `auth.js`+`navbar-auth.js` (auth + nav state), `partner-register.js` (partner signup: invite code / $4.99 PayPal / choice step), `dashboard.js` (partner dashboard — large), `admin.js` (admin panel — large), `partner-financials.js`, `otp-modal.js` (phone OTP), `i18n.js` (EN/RU/KA), `currency.js`, `location-data.js`, `api-helper.js` (fetch wrapper), `premium-animations.js`. `_mock-data.js`/`_validate.js` are dev-only (server-blocked).

---

## 7. Backend API
Mounted in `server/server.js` under `/api`. Auth via JWT (`Authorization: Bearer <token>`), `server/middleware/auth.js` (`authenticateToken`, `requireRole('guest'|'partner'|'admin')`, `generateToken`). Rate-limited per group.

| Mount | File | Endpoints (method path) |
|---|---|---|
| `/api` (auth) | `routes/auth.js` | register/guest, register/verify, register/resend-otp, register/partner, register/partner/apply-invite, login, me (GET/PUT/DELETE), me/password, forgot-password, reset-password, auth/google(+state,+callback), verify-email, check-availability |
| `/api/vehicles` | `routes/vehicles.js` | GET / , GET /my, GET /:id, POST / (partner adds → status `pending`), PUT /:id, DELETE /:id |
| `/api/bookings` | `routes/bookings.js` | POST / (create), GET /my, GET /:id, PATCH /:id/status |
| `/api/availability` | `routes/availability.js` | GET/POST /:vehicleId, DELETE /:vehicleId/:date, GET /:vehicleId/summary |
| `/api/payments` | `routes/payments.js` | config, create-order, capture-order, refund, status/:bookingId, partner/create-order, partner/capture-order |
| `/api/reviews` | `routes/reviews.js` | GET / , GET /stats, POST / , DELETE /:id |
| `/api/favorites` | `routes/favorites.js` | GET / , POST/DELETE /:vehicleId, GET /ids, GET /check/:vehicleId |
| `/api/otp` | `routes/otp.js` | send/verify/resend, reservation/send+verify, phone-verify/send+verify+skip |
| `/api/admin` | `routes/admin.js` | analytics, visitors, users CRUD+approve/reject/suspend/notes, partners + verify/unverify, vehicles + status/reorder/priority/delete-approval, bookings + status, financial, promo-codes CRUD, partner-invite-codes CRUD, export/bookings+financial, bulk/approve-vehicles+partners, activity, change-password |
| `/api/financials` | `routes/financials.js` | overview |
| `/api/contact` | `routes/contact.js` | submit |
| `/api/upload` | `routes/upload.js` | vehicle-image(s) (multer + sharp) |

**Other server files:** `db.js` (pool + migrations on boot), `db-helpers.js` (`queryOne/queryAll/execute/getClient`), `mailer.js` (nodemailer/resend email), `paypal.js`, `i18n-render.js` + `seo-prerender.js` (server-side prerender for crawlers + `/ru/` `/ka/` locale paths), `services/sms.js` (Twilio Verify OTP), `services/otp.js`, `services/reservation-fee.js` (pricing matrix), `services/notify.js` (Telegram owner alerts).

---

## 8. Database (PostgreSQL, 12 tables)
- **users**: id, email, password_hash, full_name, phone, role (`guest|partner|admin`), avatar_url, is_approved, is_verified, phone_verified, email_verified, google_id, admin_notes, timestamps
- **partner_profiles**: user_id, company_name, description, location, whatsapp, telegram, (offered categories/engines/gearboxes/…), **is_verified**, signup_method (`invite|paid`), signup_paid, signup_paypal_*, invite_code_used
- **vehicles**: partner_id, name, brand/model/color, category, engine, gearbox, drive_type, seats, doors, price_per_day, year, image_url, gallery, description, features, deposit_amount, pickup_locations/fees, extras, insurance, **price_tiers** (duration pricing JSON), custom_pricing_*, **status** (`pending|approved|…`), visible_in_search, priority, tech_passport_front/back, country, location_city
- **bookings**: guest_id, vehicle_id, partner_id, pickup/dropoff_date+time, rental_days, pickup/dropoff_location, extras_json, extras_total, location_fee, **service_fee** (paid online now), total_price, deposit_paid, **status** (`pending|accepted|rejected|cancelled|cancel_requested|completed`), **payment_status** (`unpaid|paid|refunded`), paypal_order_id/capture_id, promo_code/discount, guest/partner_notes
- **vehicle_availability**: vehicle_id, date, status (booked/blocked)
- **reviews**: guest_id, vehicle_id, booking_id, rating, title, body
- **favorites**: guest_id, vehicle_id
- **otp_codes**, **password_resets**, **page_visits** (analytics), **promo_codes**, **partner_invite_codes** (code, max_uses, used_count, is_active)

---

## 9. Key business flows
- **Guest booking:** `vehicles.html` → `vehicle.html` → `reservation.html` (dates/extras/locations) → `POST /api/bookings` (status `pending`) → phone-OTP gate → `payment.html` pays **service_fee** via PayPal → partner accepts (`PATCH /bookings/:id/status`). View in `guest-profile.html#bookings` → `booking.html?id=`.
- **Reservation fee (pricing):** `service_fee = baseRentalCost × matrix%`. Matrix = price tier (Budget <$50 / Economy 50–59.99 / Mid 60–69.99 / Premium 70–79.99 / Luxury 80+) × duration tier (1–4 / 5–9 / 10+ days). Single source of truth: `server/services/reservation-fee.js` (used in `bookings.js`); `reservation.js` mirrors it for the live estimate. Tests: `reservation-fee.test.js`.
- **Partner signup:** `register-partner.html` → choice step → **invite code** (free, `is_verified=0`, needs admin approval) OR **$4.99 PayPal** (auto-verifies on capture). Also Google-OAuth partner path. Admin verifies in `admin.html`. Only `is_verified` partners can add cars.
- **Vehicle lifecycle:** partner `POST /api/vehicles` → `status='pending'` → admin approves (`PUT /admin/vehicles/:id/status`) → appears in search.
- **Payments:** PayPal (`paypal.js`, `payments.js`) — guest service_fee + partner $4.99 signup. `GET /api/payments/config` exposes client id (sandbox/live).
- **Owner alerts (NEW):** `server/services/notify.js` sends **free Telegram** messages to the owner on: car added (pending), new partner signup, new booking. Needs `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` in `.env`. Safe no-op if unset.

---

## 10. Conventions & gotchas
- **No build step** — edit HTML/JS/CSS directly; they're served as-is. Match existing vanilla-JS style (var, IIFEs, string-concat HTML).
- **Cache-bust** JS/CSS changes via the `?v=` query in the referencing HTML.
- **i18n:** UI strings live in `lang/en|ru|ka.json`, applied by `i18n.js` via `data-i18n` attributes (inline text is the fallback). Add new keys to all three.
- **SEO:** every public page has unique title/meta/canonical/hreflang; `sitemap.xml` + `robots.txt`; JSON-LD must keep required fields (Product needs `image` + integer `offerCount`). Server-prerenders for crawlers.
- **Env (`.env`):** DATABASE_URL, JWT_SECRET, TWILIO_* (Verify), TELEGRAM_* , PayPal creds, Google OAuth, SMTP/Resend, GA4 `G-4XTKG24HN6`.
- **Money:** USD ($). Booking `total_price` = rental + extras + location_fee; `service_fee` is the online-paid reservation fee; deposit is refundable at pickup.

## 11. Current state / known constraints
- **SEO ranking** is gated by **domain age + near-zero backlinks + a saturated brand name** ("Elite Auto Rent" collides with global firms) — NOT by code. Lever is off-page: Google Business Profile (a duplicate listing needs removing), citations (Yandex/2GIS/Trustpilot), travel-blog links. See `OFFPAGE-PLAYBOOK.md`.
- **Dev/local DB** is often nearly empty (0–1 vehicles, 0 bookings) — end-to-end tests of booking/detail pages may have no data.
- **Telegram alerts** code is deployed but **not yet configured** on the server (no token in `.env`).
- Internal docs in repo: `OFFPAGE-PLAYBOOK.md`, `_offpage-tracker.csv`, `SEO-*.md`, `EliteAuto-SEO-Audit-2026-06.*` (the .html audit is NOT server-blocked — keep it out of deploys or it's public).

## 12. Notable recent work (this period)
2D matrix reservation pricing; customer `booking.html` detail page + travel-essentials affiliate strip; home 8-random fleet w/ "Browse More" + mobile fix; vehicles 12/page pagination; partner invite-codes + $4.99 PayPal signup; 5 new SEO landing pages (KUT/BUS airports, automatic, cheap, monthly); Product structured-data fix; Telegram owner alerts.
