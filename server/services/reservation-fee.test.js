"use strict";

// Plain-node test (no framework): `node server/services/reservation-fee.test.js`
const assert = require("assert");
const {
  getPriceTier,
  getDurationTier,
  getReservationFeePercent,
  calculateReservationFee,
} = require("./reservation-fee");

let passed = 0;
function check(label, actual, expected) {
  assert.strictEqual(actual, expected, label + " => got " + actual + ", expected " + expected);
  passed++;
}

// --- Required test cases (from spec) ---
var A = calculateReservationFee(40, 3);
check("A feePercent", A.feePercent, 0.15);
check("A reservationFee", A.reservationFee, 18.0);
check("A totalCost", A.totalCost, 138.0);

var B = calculateReservationFee(65, 7);
check("B feePercent", B.feePercent, 0.08);
check("B reservationFee", B.reservationFee, 36.4);
check("B totalCost", B.totalCost, 491.4);

var C = calculateReservationFee(90, 12);
check("C feePercent", C.feePercent, 0.05);
check("C reservationFee", C.reservationFee, 54.0);
check("C totalCost", C.totalCost, 1134.0);

// --- Price-tier boundaries (lower-inclusive, upper-open) ---
check("49.99 -> budget", getPriceTier(49.99), "budget");
check("50.00 -> economy", getPriceTier(50.0), "economy");
check("59.99 -> economy", getPriceTier(59.99), "economy");
check("60.00 -> mid (NOT economy)", getPriceTier(60.0), "mid");
check("69.99 -> mid", getPriceTier(69.99), "mid");
check("70.00 -> premium", getPriceTier(70.0), "premium");
check("79.99 -> premium", getPriceTier(79.99), "premium");
check("80.00 -> luxury", getPriceTier(80.0), "luxury");
check("1000 -> luxury", getPriceTier(1000), "luxury");

// --- Duration-tier boundaries (open upper end) ---
check("1 day -> short", getDurationTier(1), "short");
check("4 days -> short", getDurationTier(4), "short");
check("5 days -> medium", getDurationTier(5), "medium");
check("9 days -> medium", getDurationTier(9), "medium");
check("10 days -> long", getDurationTier(10), "long");
check("365 days -> long", getDurationTier(365), "long");

// --- Spot-check a few matrix cells directly ---
check("budget/short", getReservationFeePercent(45, 2), 0.15);
check("economy/long", getReservationFeePercent(55, 30), 0.08);
check("premium/medium", getReservationFeePercent(75, 6), 0.07);

console.log("All " + passed + " assertions passed.");
