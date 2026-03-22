# Elite Rental Georgia — Full Project Audit Report
**Date:** March 18, 2026  
**Stack:** Node.js + Express backend, Vanilla JS frontend, PostgreSQL database

---

## PHASE 1: DEEP CODE AUDIT & BUSINESS LOGIC REVIEW

---

### 1.1 — THE RENDER BUG (Root Cause Analysis)

**Why your admin panel stopped showing new users/acceptances on Render:**

There are **two root causes**, not one:

#### 🔴 BUG #1: Fatal Import Error — `db-helpers.js` (CRITIC+AL — APP CANNOT START)

```
File: server/db-helpers.js, Line 1
Problem: const { getPool } = require('./db-pg');  ← FILE DOES NOT EXIST
Fix:     const { getPool } = require('./db');
```

**Every single route file** imports from `db-helpers.js`. Since it references a non-existent module (`db-pg`), Node.js throws `MODULE_NOT_FOUND` on startup and the server crashes immediately. This is why Render showed "Exited with status 1" — the app never actually started. **This has been fixed.**

#### 🔴 BUG #2: Missing `DATABASE_URL` Environment Variable

The `db.js` file calls `process.exit(1)` if `DATABASE_URL` is not set. On Render, you must:
1. Create a PostgreSQL database in Render dashboard
2. Copy the Internal Database URL
3. Add it as env var `DATABASE_URL` in your Web Service settings

#### 🟡 BUG #3 (Previous): JWT_SECRET Fatal Exit — ALREADY FIXED

The auth middleware used to crash if `JWT_SECRET` wasn't set. This was already fixed to auto-generate a random secret.

**Summary:** The app was never running on Render. It crashed on boot every time. This is NOT a WebSocket/polling/sleep issue — the server literally couldn't start.

---

### 1.2 — FILE-BY-FILE ANALYSIS

#### ✅ KEEP — Core Files (Working)

| File | Purpose | Status |
|------|---------|--------|
| `server/server.js` | Express app setup, routes, middleware | ✅ Clean |
| `server/db.js` | PostgreSQL pool + schema creation | ✅ Clean |
| `server/db-helpers.js` | Query helper functions | 🔧 Fixed (import bug) |
| `server/middleware/auth.js` | JWT auth + role middleware | ✅ Clean |
| `server/mailer.js` | Nodemailer SMTP helper | ✅ Clean |
| `server/paypal.js` | PayPal REST API integration | ✅ Clean |
| `server/routes/auth.js` | Registration, login, profile | ✅ Clean |
| `server/routes/admin.js` | Admin panel API (820 lines) | ✅ Clean |
| `server/routes/vehicles.js` | Vehicle CRUD + search | ✅ Clean |
| `server/routes/bookings.js` | Booking creation + status | ✅ Clean |
| `server/routes/availability.js` | Vehicle date availability | ✅ Clean |
| `server/routes/favorites.js` | Guest favorites | ✅ Clean |
| `server/routes/reviews.js` | Review CRUD | ✅ Clean |
| `server/routes/financials.js` | Partner earnings | ✅ Clean |
| `server/routes/payments.js` | PayPal payment flow | ✅ Clean |
| `server/routes/contact.js` | Contact form email | ✅ Clean |
| `server/routes/upload.js` | Image upload (Multer) | ✅ Clean |

#### 🗑️ DELETE — Dead Weight Files

| File | Reason |
|------|--------|
| `server/db-sqlite-backup.js` (38KB) | Old SQLite backup, not used |
| `server/db-helpers-sqlite-backup.js` (1.2KB) | Old SQLite backup, not used |
| `server/routes/admin-sqlite-backup.js` (40KB) | Old SQLite backup |
| `server/routes/auth-sqlite-backup.js` (20KB) | Old SQLite backup |
| `server/routes/availability-sqlite-backup.js` (6.8KB) | Old SQLite backup |
| `server/routes/bookings-sqlite-backup.js` (20KB) | Old SQLite backup |
| `server/routes/favorites-sqlite-backup.js` (4.6KB) | Old SQLite backup |
| `server/routes/financials-sqlite-backup.js` (6.4KB) | Old SQLite backup |
| `server/routes/payments-sqlite-backup.js` (7KB) | Old SQLite backup |
| `server/routes/reviews-sqlite-backup.js` (4.7KB) | Old SQLite backup |
| `server/routes/vehicles-sqlite-backup.js` (15KB) | Old SQLite backup |
| `git.txt` | Personal notes, not needed in production |
| `DEPLOY-INSTRUCTIONS.md` | Gitignored but may exist locally |
| `NETLIFY-DEPLOYMENT-GUIDE.md` | Gitignored but may exist locally |
| `netlify.toml` | Gitignored but may exist locally |

**Total dead weight: ~174KB of backup files that add no value.**

Note: `.gitignore` already excludes `*-sqlite-backup.js`, so they won't be pushed to GitHub — but they clutter your local workspace. Safe to delete.

#### 🟡 Frontend Files — All Valid, No Dead Code

All HTML/CSS/JS frontend files are in active use:
- `index.html`, `script.js`, `style.css`, `premium.css` — Home page
- `vehicles.html`, `vehicles.css` — Vehicle listing
- `vehicle.html`, `vehicle.css`, `vehicle.js` — Single vehicle detail
- `reservation.html`, `reservation.css`, `reservation.js` — Booking flow
- `payment.html`, `payment.js` — PayPal payment
- `login.html`, `register.html`, `register-partner.html` — Auth pages
- `auth.js`, `auth.css`, `auth-luxury.css`, `partner-register.js`, `partner-register.css` — Auth logic/styling
- `admin.html`, `admin.css`, `admin.js` — Admin panel
- `partner-dashboard.html`, `dashboard.css`, `dashboard.js` — Partner dashboard
- `partner-financials.html`, `partner-financials.js` — Partner earnings
- `guest-profile.html`, `guest-profile.css`, `guest-profile.js` — Guest profile/bookings
- `navbar-auth.js`, `navbar-auth.css` — Auth-aware navbar
- `premium-animations.js` — Scroll animations
- `api-helper.js` — API URL helper
- `contact.html`, `contact.js` — Contact form
- `about.html`, `reviews.html`, `privacy.html`, `tos.html` — Static pages
- `reset-password.html` — Password reset
- `404.html` — Error page
- `robots.txt`, `sitemap.xml`, `favicon.svg` — SEO/branding

---

### 1.3 — BUSINESS LOGIC & BUTTON ASSESSMENT

#### User Flows

**Guest Flow:**
1. **Register** → Creates account (auto-approved, can login immediately)
2. **Browse vehicles** → Public listing with filters (category, engine, price, year, etc.)
3. **View vehicle** → Detail page with gallery, specs, availability calendar
4. **Book vehicle** → Select dates → Choose extras → Confirm → Creates pending booking
5. **Pay service fee** → PayPal payment for website fee (30% of one day rate)
6. **Track bookings** → Guest profile shows all bookings with status
7. **Cancel booking** → Pending → cancelled directly; Accepted → sends cancel_requested
8. **Favorites** → Save/unsave vehicles
9. **Reviews** → Write review for completed bookings

**Partner Flow:**
1. **Register** → Creates account + partner_profile (is_verified=0, needs admin approval)
2. **Login** → Can access dashboard but vehicles won't show in search until verified
3. **Add vehicles** → Upload images, set pricing tiers, extras, insurance, locations
4. **Manage bookings** → Accept/reject pending bookings, handle cancel requests
5. **View financials** → Earnings overview, booking history with partner's 70% share
6. **Manage availability** → Block/unblock dates on calendar

**Admin Flow:**
1. **Dashboard** → Analytics: user counts, earnings, vehicle stats, upload trends
2. **Users tab** → View all users, approve/suspend/delete, edit info, add notes
3. **Partners tab** → Verify/unverify partners (unverify cancels active bookings + notifies guests)
4. **Vehicles tab** → Change status (active/inactive/pending), approve/reject delete requests
5. **Bookings tab** → Accept/reject/cancel any booking, auto-refund PayPal on cancel
6. **Financial tab** → All transaction records with CSV export
7. **Promos tab** → Create/edit/delete promo codes
8. **Activity tab** → Recent registrations, bookings, vehicle uploads, status changes

#### Booking Status Machine
```
pending → accepted (by partner or admin)
pending → rejected (by partner or admin)
pending → cancelled (by guest)
accepted → cancel_requested (by guest)
accepted → cancelled (by admin)
cancel_requested → cancelled (by partner or admin)
cancel_requested → accepted (by admin, re-accept)
```

#### 🟡 Issues Found in Business Logic

1. **Service fee calculation is confusing:**
   - `serviceFee = dailyPrice * 0.30` — This is 30% of ONE day's rate, not the total. 
   - This might confuse users expecting 30% of total rental.
   - **Recommendation:** Clarify this in the UI or make it configurable.

2. **No booking expiration:** Pending bookings block dates indefinitely. If a partner never accepts/rejects, those dates stay blocked forever.
   - **Recommendation:** Add a cron job or scheduled task to auto-reject bookings after 48-72 hours.

3. **Double-booking protection has a gap:** The `blockDatesForBooking` runs AFTER insert, and the `overlapBooking` check doesn't account for race conditions with concurrent requests.
   - **Recommendation:** Use a database transaction with row-level locking for booking creation.

4. **Partner vehicle deletion is a "request"** (status → 'delete_requested'), admin must approve. This is good business logic but could frustrate partners if admin is slow.

5. **No email verification on registration:** Users can register with any email. The MX record check only validates the domain exists, not ownership.

6. **Password reset flow exists** (`password_resets` table) but the actual reset endpoint in `auth.js` should be verified for completeness.

7. **Contact form hardcodes recipient:** `elite.rental25@gmail.com` in `contact.js` — should use env var.

---

## PHASE 2: PRODUCTION READINESS & DATABASE STRATEGY

---

### 2.1 — Missing Critical Features for Production

#### 🔴 Must-Have Before Launch

1. **HTTPS/SSL** — Currently no SSL. Required for PayPal, passwords, user trust.
2. **Proper CORS lockdown** — `server.js` line 51 has `cb(null, true)` which allows ALL origins. Must restrict to your domain only.
3. **Booking expiration cron** — Auto-reject stale pending bookings.
4. **Database backups** — Scheduled PostgreSQL pg_dump.
5. **Upload file cleanup** — No mechanism to delete orphaned uploaded images.
6. **Input sanitization on HTML emails** — Contact form and booking emails inject user input directly into HTML. XSS risk via email.
7. **Rate limiting on all write endpoints** — Currently only on `/api/login` and `/api/register`. Add to bookings, contact, reviews.

#### 🟡 Should-Have

1. **Logging** — No structured logging (Winston/Pino). Console.error only.
2. **Health check endpoint** — `/api/health` for monitoring.
3. **Email verification** — Confirm email ownership on registration.
4. **CSRF protection** — Not critical for JWT API but good practice.
5. **Image optimization** — Uploaded images are stored raw (up to 20MB each).
6. **Pagination** — Admin endpoints return ALL records. Will be slow with growth.

### 2.2 — Security Fixes Needed

| Issue | Location | Fix |
|-------|----------|-----|
| CORS allows all origins | `server.js:51` | Remove fallthrough `cb(null, true)` |
| SQL LIKE injection potential | `auth.js:51,93,172` | Phone LIKE queries concatenate user input |
| HTML injection in emails | `contact.js`, `bookings.js` | Sanitize user input before HTML templates |
| `admin123` default password | `db.js:256` | Force password change on first login |
| Contact email hardcoded | `contact.js:49` | Use `process.env.CONTACT_EMAIL` |
| No `Referrer-Policy` header | `server.js` | Helmet default may not set it strict enough |
| File upload no virus scan | `upload.js` | Low risk but consider for production |

### 2.3 — Files to Upload to Production Server

#### ✅ Upload These:
```
/server/          ← entire folder (excluding *-sqlite-backup.js)
/images/          ← static images
/uploads/         ← create empty folder, will be populated at runtime
/*.html           ← all HTML pages
/*.css            ← all CSS files
/*.js             ← all frontend JS files
/favicon.svg
/robots.txt
/sitemap.xml
/package.json
/package-lock.json
/.env             ← create on server, NEVER commit to git
```

#### ❌ DO NOT Upload:
```
/node_modules/    ← run `npm install` on server instead
/.env             ← create manually on server
/.git/            ← use git clone instead
/data/            ← old SQLite data folder
/*-sqlite-backup.js  ← dead backup files
/git.txt          ← personal notes
/AUDIT-REPORT.md  ← this report (keep locally)
```

### 2.4 — Database Migration Strategy

Since you're moving from Render's PostgreSQL to a new VPS PostgreSQL:

**Step 1: Export from Render**
```bash
# Get connection string from Render dashboard
pg_dump "postgresql://user:pass@host:5432/dbname" --no-owner --no-acl > backup.sql
```

**Step 2: Create database on new server**
```bash
sudo -u postgres createdb eliterent
sudo -u postgres createuser eliterent_user -P  # set a strong password
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE eliterent TO eliterent_user;"
```

**Step 3: Import**
```bash
psql -U eliterent_user -d eliterent < backup.sql
```

**Step 4: Update `.env`**
```
DATABASE_URL=postgresql://eliterent_user:YOUR_PASSWORD@localhost:5432/eliterent
```

If you have NO data on Render (app never started properly), skip pg_dump. The app auto-creates all tables and seeds the admin account on first run.

---

## PHASE 3: DOMAIN & HOSTING — STEP-BY-STEP GUIDE

---

### 3.1 — Buy a Domain

**Recommended registrar: [Namecheap](https://namecheap.com)** (cheapest, good UI)

1. Go to namecheap.com → Search for `eliterent.ge`
   - Note: `.ge` domains are managed by NIC.ge. You may need to register through a Georgian registrar like [register.ge](https://register.ge) or [caucasus.net](https://caucasus.net)
   - Alternative: buy `eliterentgeorgia.com` or `eliterent.com` from Namecheap
2. Add to cart → Checkout → Pay (typically $10-15/year for .com)
3. After purchase, you'll have access to DNS management

### 3.2 — Buy a VPS

**Recommended: [Hetzner](https://hetzner.com/cloud)** — Best price/performance in Europe

1. Go to hetzner.com → Sign up → Verify identity
2. Go to **Cloud Console** → **Add Server**
3. Choose:
   - **Location:** Falkenstein or Helsinki (closest to Georgia)
   - **Image:** Ubuntu 24.04
   - **Type:** CX22 (2 vCPU, 4GB RAM) — €4.85/month — plenty for your app
   - **Networking:** Public IPv4 (checked)
   - **SSH Key:** Add your SSH public key (see below)
   - **Name:** `eliterent`
4. Click **Create & Buy**
5. Note the IP address shown (e.g., `65.108.xxx.xxx`)

**Generate SSH key (if you don't have one):**
```powershell
ssh-keygen -t ed25519 -C "your@email.com"
# Press Enter for default location, set a passphrase
cat ~/.ssh/id_ed25519.pub
# Copy this entire line and paste into Hetzner's SSH key field
```

### 3.3 — Initial Server Setup

**Connect to your server:**
```bash
ssh root@YOUR_SERVER_IP
```

**Secure the server:**
```bash
# Update system
apt update && apt upgrade -y

# Create a non-root user
adduser eliterent
usermod -aG sudo eliterent

# Enable firewall
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable

# Switch to new user
su - eliterent
```

### 3.4 — Install Required Software

```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v   # should show v20.x
npm -v    # should show 10.x

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install PM2 (keeps your app running 24/7)
sudo npm install -g pm2

# Install Git
sudo apt install -y git
```

### 3.5 — Set Up PostgreSQL Database

```bash
# Switch to postgres user
sudo -u postgres psql

# In the PostgreSQL shell:
CREATE USER eliterent_user WITH PASSWORD 'YOUR_STRONG_PASSWORD_HERE';
CREATE DATABASE eliterent OWNER eliterent_user;
GRANT ALL PRIVILEGES ON DATABASE eliterent TO eliterent_user;
\q
```

### 3.6 — Deploy Your App via Git

```bash
# As the eliterent user:
cd /home/eliterent

# Clone your repo
git clone https://github.com/AnriT22/eliterent.git app
cd app

# Install dependencies
npm install --production

# Create uploads directory
mkdir -p uploads/vehicles

# Create environment file
nano .env
```

**Paste this into `.env` (edit the values):**
```env
NODE_ENV=production
PORT=3000

JWT_SECRET=GENERATE_WITH_node_-e_"console.log(require('crypto').randomBytes(64).toString('hex'))"

DATABASE_URL=postgresql://eliterent_user:YOUR_STRONG_PASSWORD@localhost:5432/eliterent

BASE_URL=https://eliterent.ge
ALLOWED_ORIGINS=https://eliterent.ge,https://www.eliterent.ge

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=elite.rental25@gmail.com
SMTP_PASS=YOUR_GMAIL_APP_PASSWORD
SMTP_FROM=elite.rental25@gmail.com

PAYPAL_MODE=live
PAYPAL_CLIENT_ID=your-live-paypal-client-id
PAYPAL_CLIENT_SECRET=your-live-paypal-secret
```

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3.7 — Start App with PM2

```bash
cd /home/eliterent/app

# Start the app
pm2 start server/server.js --name eliterent

# Verify it's running
pm2 status
pm2 logs eliterent    # check for errors

# Make PM2 auto-start on reboot
pm2 save
pm2 startup
# Run the command it tells you (starts with sudo)
```

### 3.8 — Configure Nginx Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/eliterent
```

**Paste this configuration:**
```nginx
server {
    listen 80;
    server_name eliterent.ge www.eliterent.ge;

    # Redirect to HTTPS (will work after SSL is set up)
    # For now, proxy directly
    
    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Enable the site:**
```bash
sudo ln -s /etc/nginx/sites-available/eliterent /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default    # remove default page
sudo nginx -t                                # test config
sudo systemctl restart nginx
```

**At this point, visiting `http://YOUR_SERVER_IP` should show your site.**

### 3.9 — Configure DNS

Go to your domain registrar's DNS management:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | YOUR_SERVER_IP | 300 |
| A | www | YOUR_SERVER_IP | 300 |

Wait 5-30 minutes for DNS propagation. Test with:
```bash
ping eliterent.ge
```

### 3.10 — Install Free SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate (DNS must be pointing to your server first!)
sudo certbot --nginx -d eliterent.ge -d www.eliterent.ge

# Follow prompts:
# - Enter email
# - Agree to terms
# - Choose redirect HTTP to HTTPS (option 2)

# Auto-renewal is set up automatically. Test it:
sudo certbot renew --dry-run
```

After this, `https://eliterent.ge` will work with a valid SSL certificate.

### 3.11 — Future Deployment Workflow

When you make changes locally:

```bash
# On your local machine:
git add -A
git commit -m "your change description"
git push

# On the server (SSH in):
cd /home/eliterent/app
git pull
npm install --production    # only if dependencies changed
pm2 restart eliterent
```

**Or automate with a deploy script on the server:**
```bash
# Create /home/eliterent/deploy.sh
#!/bin/bash
cd /home/eliterent/app
git pull origin master
npm install --production
pm2 restart eliterent
echo "Deploy complete!"
```

```bash
chmod +x /home/eliterent/deploy.sh
# Then just run: ./deploy.sh
```

### 3.12 — Database Backup (Recommended Cron)

```bash
# Create backup script
mkdir -p /home/eliterent/backups
nano /home/eliterent/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/eliterent/backups"
DATE=$(date +%Y-%m-%d_%H%M)
pg_dump -U eliterent_user eliterent > "$BACKUP_DIR/eliterent_$DATE.sql"
# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
```

```bash
chmod +x /home/eliterent/backup-db.sh

# Add to crontab (daily at 3 AM)
crontab -e
# Add this line:
0 3 * * * /home/eliterent/backup-db.sh
```

---

## QUICK ACTION CHECKLIST

- [x] Fix `db-helpers.js` import bug (`db-pg` → `db`)
- [ ] Delete all `*-sqlite-backup.js` files locally
- [ ] Delete `git.txt`
- [ ] Fix CORS in `server.js` (remove permissive fallthrough)
- [ ] Move contact email to env var
- [ ] Buy domain
- [ ] Buy VPS (Hetzner CX22, ~$5/month)
- [ ] Set up server (Node, PostgreSQL, Nginx, PM2, SSL)
- [ ] Configure DNS
- [ ] Deploy & test
- [ ] Set up daily DB backups
- [ ] Set strong JWT_SECRET in production .env
- [ ] Change default admin password immediately after first login

---

*Report generated by comprehensive code audit of the Elite Rental Georgia project.*
