#!/usr/bin/env bash
# One-command deploy for EliteAuto.rent.
# Run this ON THE SERVER, from the app directory:  bash _deploy.sh
# (Underscore prefix => the app never serves this file publicly.)
set -euo pipefail
cd "$(dirname "$0")"

echo "==> Pulling latest from GitHub..."
git pull origin master

# Uncomment if package.json / dependencies changed in a release:
# echo "==> Installing dependencies..."
# npm install --production

echo "==> Restarting the app under PM2..."
pm2 restart eliteauto
sleep 2

echo "==> Health checks (expect 200s, and the token for the verification file):"
BASE="https://eliteauto.rent"
check() { printf "  [%s] %s\n" "$(curl -s -o /dev/null -w '%{http_code}' "$1")" "$1"; }
check "$BASE/"
check "$BASE/vehicles.html"
check "$BASE/kutaisi-airport-car-rental.html"
check "$BASE/cheap-car-rental-georgia.html"
check "$BASE/85a9e1a5-97ae-4d57-8987-f00c8fd0da3e.html"
echo "==> Verification token returns:"
curl -s "$BASE/85a9e1a5-97ae-4d57-8987-f00c8fd0da3e.html"; echo
echo "==> Done. Open $BASE and hard-refresh (Ctrl/Cmd+Shift+R)."
