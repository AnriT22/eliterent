const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const { queryAll, queryOne, execute } = require("../db-helpers");

const router = express.Router();

const MIN_PAYOUT_AMOUNT = 50;

// Generate a unique 8-character referral code (ELITE + 4 alphanumerics)
function generateReferralCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoid 0/O/I/L
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return "ELITE" + suffix;
}

async function ensureReferralCode(userId) {
  var row = await queryOne("SELECT referral_code FROM partner_profiles WHERE user_id = $1", [userId]);
  if (row && row.referral_code) return row.referral_code;
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateReferralCode();
    try {
      await execute("UPDATE partner_profiles SET referral_code = $1 WHERE user_id = $2", [code, userId]);
      var check = await queryOne("SELECT referral_code FROM partner_profiles WHERE user_id = $1", [userId]);
      if (check && check.referral_code) return check.referral_code;
    } catch (e) {
      if (e.message && e.message.indexOf("unique") === -1 && e.message.indexOf("duplicate") === -1) {
        console.error("ensureReferralCode error:", e.message);
      }
    }
  }
  return null;
}

function getTierFromCarCount(carCount) {
  var c = Math.max(0, parseInt(carCount, 10) || 0);
  if (c >= 41) return { percent: 0.30, label: "41+", name: "Diamond" };
  if (c >= 21) return { percent: 0.20, label: "21-40", name: "Gold" };
  if (c >= 1) return { percent: 0.10, label: "1-20", name: "Silver" };
  return { percent: 0, label: "0", name: "None" };
}

async function getReferralStats(userId) {
  var profile = await queryOne(
    "SELECT referral_code, referral_balance, referred_by_user_id FROM partner_profiles WHERE user_id = $1",
    [userId],
  );
  if (!profile) return null;

  // Auto-generate referral code if missing (existing partners from before the feature)
  if (!profile.referral_code) {
    profile.referral_code = await ensureReferralCode(userId);
  }

  var referredPartners = await queryAll(
    `SELECT u.id, u.full_name, u.email, u.created_at, pp.company_name, pp.referral_code,
            (SELECT COUNT(*) FROM vehicles v WHERE v.partner_id = u.id AND v.status = 'active') AS active_cars
     FROM partner_profiles pp
     JOIN users u ON pp.user_id = u.id
     WHERE pp.referred_by_user_id = $1
     ORDER BY u.created_at DESC`,
    [userId],
  );

  var totalCars = referredPartners.reduce(function (sum, p) {
    return sum + (parseInt(p.active_cars, 10) || 0);
  }, 0);
  var tier = getTierFromCarCount(totalCars);

  var referrer = null;
  if (profile.referred_by_user_id) {
    referrer = await queryOne(
      "SELECT u.full_name, u.email, pp.company_name, pp.referral_code FROM partner_profiles pp JOIN users u ON pp.user_id = u.id WHERE pp.user_id = $1",
      [profile.referred_by_user_id],
    );
  }

  var earnings = await queryOne(
    "SELECT COALESCE(SUM(commission_amount), 0) as total, COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END), 0) as pending FROM partner_referral_commissions WHERE referrer_user_id = $1 AND status != 'reversed'",
    [userId],
  );

  var monthEarnings = await queryOne(
    "SELECT COALESCE(SUM(commission_amount), 0) as amount FROM partner_referral_commissions WHERE referrer_user_id = $1 AND status IN ('approved', 'paid') AND to_char(created_at, 'YYYY-MM') = to_char(NOW(), 'YYYY-MM')",
    [userId],
  );

  return {
    my_code: profile.referral_code,
    balance: parseFloat(profile.referral_balance) || 0,
    referred_by: referrer,
    referred_partners: referredPartners,
    total_referred_partners: referredPartners.length,
    total_referral_cars: totalCars,
    tier: tier,
    earnings: {
      total: parseFloat(earnings.total) || 0,
      pending: parseFloat(earnings.pending) || 0,
      this_month: parseFloat(monthEarnings.amount) || 0,
    },
    min_payout_amount: MIN_PAYOUT_AMOUNT,
  };
}

// GET /api/partner/referral-stats
router.get("/referral-stats", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "partner" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Only partners can view referral stats" });
    }
    var stats = await getReferralStats(req.user.id);
    if (!stats) {
      return res.status(404).json({ error: "Partner profile not found" });
    }
    res.json(stats);
  } catch (err) {
    console.error("Get referral stats error:", err);
    res.status(500).json({ error: "Failed to get referral stats" });
  }
});

// POST /api/partner/apply-referral — existing partner enters a referrer code
router.post("/apply-referral", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "partner") {
      return res.status(403).json({ error: "Only partners can apply referral codes" });
    }
    var code = String(req.body.referral_code || "").trim().toUpperCase();
    if (!code) return res.status(400).json({ error: "Referral code required" });

    // Check partner doesn't already have a referrer
    var myProfile = await queryOne(
      "SELECT referral_code, referred_by_user_id FROM partner_profiles WHERE user_id = $1",
      [req.user.id],
    );
    if (!myProfile) return res.status(404).json({ error: "Partner profile not found" });
    if (myProfile.referred_by_user_id) {
      return res.status(400).json({ error: "You already have a referrer. It cannot be changed." });
    }
    if (myProfile.referral_code && myProfile.referral_code.toUpperCase() === code) {
      return res.status(400).json({ error: "You cannot refer yourself." });
    }

    // Find referrer by code
    var referrer = await queryOne(
      "SELECT user_id, referral_code FROM partner_profiles WHERE UPPER(referral_code) = $1",
      [code],
    );
    if (!referrer) return res.status(404).json({ error: "Invalid referral code" });
    if (referrer.user_id === req.user.id) {
      return res.status(400).json({ error: "You cannot refer yourself." });
    }

    // Link this partner to the referrer
    await execute(
      "UPDATE partner_profiles SET referred_by_user_id = $1 WHERE user_id = $2",
      [referrer.user_id, req.user.id],
    );

    res.json({
      success: true,
      message: "Referral code applied successfully",
      referrer: {
        code: referrer.referral_code,
        name: (await queryOne("SELECT full_name, company_name FROM users u LEFT JOIN partner_profiles pp ON u.id = pp.user_id WHERE u.id = $1", [referrer.user_id])) || {},
      },
    });
  } catch (err) {
    console.error("Apply referral error:", err);
    res.status(500).json({ error: "Failed to apply referral code" });
  }
});

// POST /api/partner/payout-request
router.post("/payout-request", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "partner") {
      return res.status(403).json({ error: "Only partners can request payouts" });
    }
    var { amount, method, details } = req.body;
    var requestedAmount = parseFloat(amount);
    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      return res.status(400).json({ error: "Invalid payout amount" });
    }
    if (requestedAmount < MIN_PAYOUT_AMOUNT) {
      return res.status(400).json({ error: "Minimum payout amount is $" + MIN_PAYOUT_AMOUNT });
    }

    var profile = await queryOne(
      "SELECT referral_balance, referral_payout_method, referral_payout_details FROM partner_profiles WHERE user_id = $1",
      [req.user.id],
    );
    if (!profile) {
      return res.status(404).json({ error: "Partner profile not found" });
    }
    var balance = parseFloat(profile.referral_balance) || 0;
    if (requestedAmount > balance) {
      return res.status(400).json({ error: "Requested amount exceeds your balance" });
    }

    var payoutMethod = method || profile.referral_payout_method || "bank";
    var payoutDetails = details || profile.referral_payout_details || "";

    await execute(
      "INSERT INTO partner_payout_requests (partner_user_id, amount, method, details) VALUES ($1, $2, $3, $4)",
      [req.user.id, requestedAmount, payoutMethod, typeof payoutDetails === "string" ? payoutDetails : JSON.stringify(payoutDetails)],
    );

    await execute(
      "UPDATE partner_profiles SET referral_balance = referral_balance - $1 WHERE user_id = $2",
      [requestedAmount, req.user.id],
    );

    res.json({ message: "Payout request submitted", amount: requestedAmount });
  } catch (err) {
    console.error("Payout request error:", err);
    res.status(500).json({ error: "Failed to submit payout request" });
  }
});

// PUT /api/partner/payout-method
router.put("/payout-method", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "partner") {
      return res.status(403).json({ error: "Only partners can update payout method" });
    }
    var { method, details } = req.body;
    if (!method) {
      return res.status(400).json({ error: "Payout method is required" });
    }
    await execute(
      "UPDATE partner_profiles SET referral_payout_method = $1, referral_payout_details = $2 WHERE user_id = $3",
      [method, typeof details === "string" ? details : JSON.stringify(details), req.user.id],
    );
    res.json({ message: "Payout method updated" });
  } catch (err) {
    console.error("Update payout method error:", err);
    res.status(500).json({ error: "Failed to update payout method" });
  }
});

// ==========================================================================
// VIP WALLET — spend-only credit used to buy VIP status for a partner's cars.
// $10 / 30 days per car. Fundable by card (PayPal), by moving referral earnings,
// and seeded with a one-time $10 gift on a partner's first VIP.
// ==========================================================================

const VIP_FEE = 10;
const VIP_FIRST_BONUS = 10;

async function logVipTx(partnerUserId, amount, type, source, vehicleId, balanceAfter) {
  try {
    await execute(
      "INSERT INTO vip_wallet_transactions (partner_user_id, amount, type, source, vehicle_id, balance_after) VALUES ($1,$2,$3,$4,$5,$6)",
      [partnerUserId, amount, type, source || null, vehicleId || null, balanceAfter == null ? null : balanceAfter],
    );
  } catch (e) { console.error("logVipTx error:", e.message); }
}

// Activate 30-day VIP on a vehicle and apply the one-time first-VIP bonus.
// Call ONLY after payment/deduction has already succeeded. Returns the new vip_until.
async function activateVehicleVip(vehicleId, partnerUserId) {
  // Extend from the later of "now" or the current expiry, so buying VIP on an
  // already-VIP car stacks another 30 days instead of overwriting/shortening it.
  var row = await queryOne(
    `UPDATE vehicles
       SET vip_until = GREATEST(COALESCE(vip_until, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP) + INTERVAL '30 days',
           vip_expiry_reminded = 0,
           updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 RETURNING vip_until`,
    [vehicleId],
  );

  // One-time first-VIP gift: credit the wallet once, atomically flipping the flag.
  var bonus = await queryOne(
    "UPDATE partner_profiles SET vip_balance = vip_balance + $1, vip_first_bonus_used = 1 WHERE user_id = $2 AND COALESCE(vip_first_bonus_used,0) = 0 RETURNING vip_balance",
    [VIP_FIRST_BONUS, partnerUserId],
  );
  if (bonus) {
    await logVipTx(partnerUserId, VIP_FIRST_BONUS, "bonus", "first_vip", vehicleId, parseFloat(bonus.vip_balance) || 0);
  }
  return row ? row.vip_until : null;
}

// Shared owner/eligibility check for a VIP purchase on a vehicle.
async function getVipTargetVehicle(vehicleId, partnerUserId) {
  var v = await queryOne("SELECT id, partner_id, name, vip_until FROM vehicles WHERE id = $1", [vehicleId]);
  if (!v) return { error: 404, message: "Vehicle not found" };
  if (v.partner_id !== partnerUserId) return { error: 403, message: "Not your vehicle" };
  // Active VIP is allowed to be extended (activateVehicleVip stacks 30 more days).
  return { vehicle: v };
}

// GET /api/partner/vip-wallet — balances + first-bonus availability + recent tx
router.get("/vip-wallet", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "partner") return res.status(403).json({ error: "Partners only" });
    var p = await queryOne(
      "SELECT COALESCE(vip_balance,0) AS vip_balance, COALESCE(referral_balance,0) AS referral_balance, COALESCE(vip_first_bonus_used,0) AS bonus_used FROM partner_profiles WHERE user_id = $1",
      [req.user.id],
    );
    if (!p) return res.status(404).json({ error: "Partner profile not found" });
    var txs = await queryAll(
      "SELECT amount, type, source, vehicle_id, balance_after, created_at FROM vip_wallet_transactions WHERE partner_user_id = $1 ORDER BY created_at DESC LIMIT 20",
      [req.user.id],
    );
    res.json({
      vip_balance: parseFloat(p.vip_balance) || 0,
      referral_balance: parseFloat(p.referral_balance) || 0,
      first_bonus_available: !p.bonus_used,
      vip_fee: VIP_FEE,
      transactions: txs,
    });
  } catch (err) {
    console.error("vip-wallet error:", err);
    res.status(500).json({ error: "Failed to load VIP wallet" });
  }
});

// POST /api/partner/vehicle/:id/vip/pay-with-balance — spend VIP credit
router.post("/vehicle/:id/vip/pay-with-balance", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "partner") return res.status(403).json({ error: "Partners only" });
    var vehicleId = parseInt(req.params.id, 10);
    if (!vehicleId) return res.status(400).json({ error: "vehicle id required" });

    var target = await getVipTargetVehicle(vehicleId, req.user.id);
    if (target.error) return res.status(target.error).json({ error: target.message });

    // Atomic deduct — only succeeds if balance is sufficient.
    var deducted = await queryOne(
      "UPDATE partner_profiles SET vip_balance = vip_balance - $1 WHERE user_id = $2 AND COALESCE(vip_balance,0) >= $1 RETURNING vip_balance",
      [VIP_FEE, req.user.id],
    );
    if (!deducted) return res.status(400).json({ error: "Insufficient VIP balance", code: "INSUFFICIENT" });
    await logVipTx(req.user.id, -VIP_FEE, "spend", "vip_balance", vehicleId, parseFloat(deducted.vip_balance) || 0);

    var vipUntil = await activateVehicleVip(vehicleId, req.user.id);
    res.json({ status: "COMPLETED", message: "VIP activated for 30 days!", vehicleId: vehicleId, vip_until: vipUntil });
  } catch (err) {
    console.error("vip pay-with-balance error:", err);
    res.status(500).json({ error: "Failed to activate VIP" });
  }
});

// POST /api/partner/vehicle/:id/vip/pay-with-referral — spend referral earnings
router.post("/vehicle/:id/vip/pay-with-referral", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "partner") return res.status(403).json({ error: "Partners only" });
    var vehicleId = parseInt(req.params.id, 10);
    if (!vehicleId) return res.status(400).json({ error: "vehicle id required" });

    var target = await getVipTargetVehicle(vehicleId, req.user.id);
    if (target.error) return res.status(target.error).json({ error: target.message });

    var deducted = await queryOne(
      "UPDATE partner_profiles SET referral_balance = referral_balance - $1 WHERE user_id = $2 AND COALESCE(referral_balance,0) >= $1 RETURNING referral_balance",
      [VIP_FEE, req.user.id],
    );
    if (!deducted) return res.status(400).json({ error: "Insufficient referral balance", code: "INSUFFICIENT" });
    await logVipTx(req.user.id, -VIP_FEE, "spend", "referral_balance", vehicleId, null);

    var vipUntil = await activateVehicleVip(vehicleId, req.user.id);
    res.json({ status: "COMPLETED", message: "VIP activated for 30 days!", vehicleId: vehicleId, vip_until: vipUntil });
  } catch (err) {
    console.error("vip pay-with-referral error:", err);
    res.status(500).json({ error: "Failed to activate VIP" });
  }
});

// PUT /api/partner/company-name — partner updates their own company name
router.put("/company-name", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "partner") return res.status(403).json({ error: "Partners only" });
    var name = String(req.body.company_name == null ? "" : req.body.company_name).trim();
    if (name.length < 2) return res.status(400).json({ error: "Company name must be at least 2 characters" });
    if (name.length > 150) return res.status(400).json({ error: "Company name must be 150 characters or fewer" });

    var updated = await queryOne(
      "UPDATE partner_profiles SET company_name = $1 WHERE user_id = $2 RETURNING company_name",
      [name, req.user.id],
    );
    if (!updated) return res.status(404).json({ error: "Partner profile not found" });
    res.json({ message: "Company name updated", company_name: updated.company_name });
  } catch (err) {
    console.error("Update company-name error:", err);
    res.status(500).json({ error: "Failed to update company name" });
  }
});

module.exports = router;
module.exports.getReferralStats = getReferralStats;
module.exports.activateVehicleVip = activateVehicleVip;
module.exports.logVipTx = logVipTx;
module.exports.VIP_FEE = VIP_FEE;
module.exports.getTierFromCarCount = getTierFromCarCount;
module.exports.MIN_PAYOUT_AMOUNT = MIN_PAYOUT_AMOUNT;
