"use strict";

/**
 * Two-dimensional reservation-fee matrix.
 *
 * The platform reservation fee is a percentage of the base rental cost
 * (effective daily price x rental days). The percentage is selected from a
 * matrix indexed by two dimensions:
 *
 *   - price tier    — based on the EFFECTIVE daily price actually charged
 *                     (i.e. after any duration-based tier pricing), in USD/day
 *   - duration tier — based on the number of rental days
 *
 * Price tiers (USD/day):  Budget <50 | Economy 50-59.99 | Mid 60-69.99 |
 *                         Premium 70-79.99 | Luxury 80+
 * Duration tiers (days):  short 1-4 | medium 5-9 | long 10+
 *
 * Boundaries are inclusive at the lower bound and open at the top, so a daily
 * price of exactly $60.00 is Mid-Range (not Economy) and exactly 10 days is
 * "long". This file is the single source of truth for the fee; the booking
 * route consumes it server-side, and reservation.js mirrors it for the live
 * estimate shown to the guest.
 */

const FEE_MATRIX = {
  budget:  { short: 0.15, medium: 0.12, long: 0.10 },
  economy: { short: 0.12, medium: 0.10, long: 0.08 },
  mid:     { short: 0.10, medium: 0.08, long: 0.07 },
  premium: { short: 0.09, medium: 0.07, long: 0.06 },
  luxury:  { short: 0.08, medium: 0.06, long: 0.05 },
};

// Price tier from the effective daily price (USD). Lower-bound inclusive,
// upper-bound open: 50.00 -> economy, 60.00 -> mid, 80.00 -> luxury.
function getPriceTier(dailyPrice) {
  var p = Number(dailyPrice) || 0;
  if (p < 50) return "budget";
  if (p < 60) return "economy"; // 50.00 - 59.99
  if (p < 70) return "mid";     // 60.00 - 69.99
  if (p < 80) return "premium"; // 70.00 - 79.99
  return "luxury";              // 80.00 +
}

// Duration tier from rental days. Open upper end: 10 or more days -> long.
function getDurationTier(days) {
  var d = Math.max(1, Math.floor(Number(days) || 0));
  if (d <= 4) return "short";  // 1 - 4
  if (d <= 9) return "medium"; // 5 - 9
  return "long";               // 10 +
}

// The matrix fee percentage (e.g. 0.15) for a given daily price + duration.
function getReservationFeePercent(dailyPrice, days) {
  return FEE_MATRIX[getPriceTier(dailyPrice)][getDurationTier(days)];
}

/**
 * Full breakdown for a daily price + rental days.
 *   baseRentalCost = dailyPrice * days
 *   reservationFee = baseRentalCost * feePercent
 *   totalCost      = baseRentalCost + reservationFee
 * Money values are rounded to 2 decimals.
 */
function calculateReservationFee(dailyPrice, days) {
  var p = Number(dailyPrice) || 0;
  var d = Math.max(1, Math.floor(Number(days) || 0));
  var feePercent = getReservationFeePercent(p, d);
  var baseRentalCost = Math.round(p * d * 100) / 100;
  // Minimum $10 reservation fee applies in every situation.
  var reservationFee = Math.max(10, Math.round(baseRentalCost * feePercent * 100) / 100);
  return {
    priceTier: getPriceTier(p),
    durationTier: getDurationTier(d),
    feePercent: feePercent,
    baseRentalCost: baseRentalCost,
    reservationFee: reservationFee,
    totalCost: Math.round((baseRentalCost + reservationFee) * 100) / 100,
  };
}

module.exports = {
  FEE_MATRIX,
  getPriceTier,
  getDurationTier,
  getReservationFeePercent,
  calculateReservationFee,
};
