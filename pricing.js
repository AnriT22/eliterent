/* Shared customer-facing pricing helper.
 *
 * Partners type their own daily rate. Customers must NEVER see that raw rate —
 * they see the all-in price (partner rate + website fee) so the fee is part of
 * the price rather than a surprise added at checkout.
 *
 * Mirrors server/services/reservation-fee.js (the server stays authoritative).
 * Price tiers USD/day: Budget <50 | Economy 50-59.99 | Mid 60-69.99 | Premium 70-79.99 | Luxury 80+
 * Duration tiers (days): short 1-4 | medium 5-9 | long 10+
 *
 * On listings no dates are chosen yet, so we use the SHORT-stay percentage —
 * the worst case. That way the price a customer sees can only go down (longer
 * rentals get a lower %), never up.
 */
(function (global) {
    'use strict';

    var FEE_MATRIX = {
        budget:  { short: 0.15, medium: 0.12, long: 0.10 },
        economy: { short: 0.12, medium: 0.10, long: 0.08 },
        mid:     { short: 0.10, medium: 0.08, long: 0.07 },
        premium: { short: 0.09, medium: 0.07, long: 0.06 },
        luxury:  { short: 0.08, medium: 0.06, long: 0.05 }
    };

    function feePercent(rawDaily, days) {
        var p = parseFloat(rawDaily) || 0;
        var tier = p < 50 ? 'budget' : p < 60 ? 'economy' : p < 70 ? 'mid' : p < 80 ? 'premium' : 'luxury';
        var d = Math.max(1, Math.floor(days || 1));
        var dur = d <= 4 ? 'short' : d <= 9 ? 'medium' : 'long';
        return FEE_MATRIX[tier][dur];
    }

    // The all-in daily rate shown to customers. `customFee` is the admin's
    // per-vehicle override (a flat fee for the whole booking).
    function allInDaily(rawDaily, days, customFee) {
        var raw = parseFloat(rawDaily) || 0;
        if (raw <= 0) return 0;
        var d = Math.max(1, Math.floor(days || 1));
        if (customFee != null && customFee !== '' && !isNaN(parseFloat(customFee))) {
            return Math.round((raw + parseFloat(customFee) / d) * 100) / 100;
        }
        return Math.round(raw * (1 + feePercent(raw, d)) * 100) / 100;
    }

    // The exact all-in rental total once the duration is known. Mirrors the server:
    // fee = admin override, else the matrix % with a $10 minimum.
    function allInTotal(rawDaily, days, customFee) {
        var raw = parseFloat(rawDaily) || 0;
        var d = Math.max(1, Math.floor(days || 1));
        var rawTotal = Math.round(raw * d * 100) / 100;
        var fee;
        if (customFee != null && customFee !== '' && !isNaN(parseFloat(customFee))) {
            fee = Math.round(parseFloat(customFee) * 100) / 100;
        } else {
            fee = Math.max(10, Math.round(rawTotal * feePercent(raw, d) * 100) / 100);
        }
        return Math.round((rawTotal + fee) * 100) / 100;
    }

    global.ElitePricing = {
        FEE_MATRIX: FEE_MATRIX,
        feePercent: feePercent,
        allInDaily: allInDaily,
        allInTotal: allInTotal
    };
})(window);
