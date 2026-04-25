const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { authenticateToken, requireRole } = require("../middleware/auth");
const { queryAll, queryOne, execute, getClient } = require("../db-helpers");
const { escapeHtml } = require("../mailer");
const { sendOTPSMS, startVerify, checkVerify } = require("../services/sms");

const bookingOtpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many verification attempts. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: function (req) { return req.user ? String(req.user.id) : req.ip; }
});

const bookingResendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2,
  message: { error: 'Too many resend requests. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: function (req) { return req.user ? String(req.user.id) : req.ip; }
});

const WEBSITE_FEE_PERCENT = 0.3;

const router = express.Router();

async function invalidateOtpRecord(id) {
  if (!id) return;
  await execute("UPDATE otp_codes SET verified = -1 WHERE id = $1", [id]);
}

function parseUtcDate(dateStr) {
  return new Date(dateStr + "T00:00:00Z");
}

function daysBetween(startStr, endStr, pickupTime, dropoffTime) {
  var s = parseUtcDate(startStr);
  var e = parseUtcDate(endStr);
  var baseDays = Math.max(1, Math.round((e - s) / 86400000));

  // If return time exceeds pickup time by more than 2 hours, charge an extra day
  if (pickupTime && dropoffTime) {
    var pParts = pickupTime.split(":");
    var dParts = dropoffTime.split(":");
    var pickupMinutes =
      parseInt(pParts[0], 10) * 60 + parseInt(pParts[1] || "0", 10);
    var dropoffMinutes =
      parseInt(dParts[0], 10) * 60 + parseInt(dParts[1] || "0", 10);
    if (dropoffMinutes - pickupMinutes > 120) {
      baseDays += 1;
    }
  }
  return baseDays;
}

function eachBookingDate(startStr, endStr, cb) {
  var cur = parseUtcDate(startStr);
  var end = parseUtcDate(endStr);
  while (cur <= end) {
    cb(cur);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
}

function formatDateUtc(date) {
  return (
    date.getUTCFullYear() +
    "-" +
    String(date.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getUTCDate()).padStart(2, "0")
  );
}

async function blockDatesForBooking(vehicleId, startStr, endStr) {
  var dates = [];
  eachBookingDate(startStr, endStr, function (date) {
    dates.push(formatDateUtc(date));
  });
  for (var i = 0; i < dates.length; i++) {
    var dateStr = dates[i];
    var existing = await queryOne(
      "SELECT id FROM vehicle_availability WHERE vehicle_id = $1 AND date = $2",
      [vehicleId, dateStr],
    );
    if (existing) {
      await execute(
        "UPDATE vehicle_availability SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE vehicle_id = $2 AND date = $3",
        ["booked", vehicleId, dateStr],
      );
    } else {
      await execute(
        "INSERT INTO vehicle_availability (vehicle_id, date, status) VALUES ($1, $2, $3)",
        [vehicleId, dateStr, "booked"],
      );
    }
  }
}

async function unblockDatesForBooking(vehicleId, startStr, endStr) {
  var dates = [];
  eachBookingDate(startStr, endStr, function (date) {
    dates.push(formatDateUtc(date));
  });
  for (var i = 0; i < dates.length; i++) {
    await execute(
      "DELETE FROM vehicle_availability WHERE vehicle_id = $1 AND date = $2 AND status = 'booked'",
      [vehicleId, dates[i]],
    );
  }
}

function parseJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    var parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function normalizeVehicleServices(vehicle) {
  var ext = vehicle.extras;
  if (typeof ext === "string") {
    try {
      ext = JSON.parse(ext);
    } catch (e) {
      ext = {};
    }
  }
  ext = ext || {};

  var EXTRA_DEFS = [
    {
      code: "child_seat",
      key: "child_seat",
      name: "Child Seat (up to 5 years)",
      perDay: true,
    },
    {
      code: "snow_chains",
      key: "snow_chains",
      name: "Snow Chains",
      perDay: false,
    },
    {
      code: "roof_rack",
      key: "roof_rack",
      name: "Roof Luggage Carrier",
      perDay: true,
    },
    {
      code: "third_driver",
      key: "third_driver",
      name: "Additional Driver",
      perDay: true,
    },
    {
      code: "svaneti_roads",
      key: "svaneti_price",
      name: "Mestia / Mountain Svaneti Roads",
      perDay: false,
    },
    {
      code: "shatili_roads",
      key: "shatili_price",
      name: "Shatili Mountain Roads",
      perDay: false,
    },
  ];

  var services = [];
  EXTRA_DEFS.forEach(function (def) {
    var price = parseFloat(ext[def.key]);
    if (price > 0 || ext[def.key] === 0 || ext[def.key] === "0") {
      services.push({
        code: def.code,
        name: def.name,
        price: price || 0,
        perDay: def.perDay,
      });
    }
  });

  if (services.length === 0) {
    var old = parseJsonArray(vehicle.extra_services);
    old
      .filter(function (item) {
        return item && item.enabled !== false;
      })
      .forEach(function (item) {
        services.push({
          code: item.code || item.id || item.name,
          name: item.name || "Extra Service",
          price: parseFloat(item.price) || 0,
          perDay: (item.code || item.id || item.name) === "additional_driver",
        });
      });
  }

  return services.filter(function (item) {
    return !!item.code;
  });
}

function buildSelectedExtras(vehicleServices, selectedExtras) {
  var selectedCodes = Array.isArray(selectedExtras) ? selectedExtras : [];
  return vehicleServices.filter(function (service) {
    return selectedCodes.indexOf(service.code) !== -1;
  });
}

function getDailyRateByTier(vehicle, days, pickupDate) {
  if (vehicle.custom_pricing_enabled) {
    var ranges = vehicle.custom_pricing_ranges;
    if (typeof ranges === "string") {
      try {
        ranges = JSON.parse(ranges);
      } catch (e) {
        ranges = [];
      }
    }
    if (Array.isArray(ranges) && ranges.length > 0) {
      for (var i = 0; i < ranges.length; i++) {
        var r = ranges[i];
        if (r.start && r.end && pickupDate >= r.start && pickupDate <= r.end) {
          return parseFloat(r.price) || 0;
        }
      }
    }
  }

  var pt = vehicle.price_tiers;
  if (typeof pt === "string") {
    try {
      pt = JSON.parse(pt);
    } catch (e) {
      pt = {};
    }
  }
  pt = pt || {};
  var fallback = parseFloat(vehicle.price_per_day) || 0;
  if (days <= 3 && pt.price_1_3 > 0) return parseFloat(pt.price_1_3);
  if (days <= 7 && pt.price_4_7 > 0) return parseFloat(pt.price_4_7);
  if (days <= 14 && pt.price_8_14 > 0) return parseFloat(pt.price_8_14);
  if (days <= 30 && pt.price_15_30 > 0) return parseFloat(pt.price_15_30);
  return fallback;
}

router.post("/", authenticateToken, requireRole("guest"), async (req, res) => {
  try {
    // Phone must be verified before booking
    var caller = await queryOne("SELECT phone_verified FROM users WHERE id = $1", [req.user.id]);
    if (!caller || caller.phone_verified !== 1) {
      return res.status(403).json({ error: "Please verify your phone number before making a reservation.", phoneRequired: true });
    }

    // Auto-cancel stale pending_verification bookings (older than 10 minutes)
    await execute(
      "UPDATE bookings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE guest_id = $1 AND status = 'pending_verification' AND created_at < NOW() - INTERVAL '10 minutes'",
      [req.user.id],
    );

    // Limit active bookings per user to prevent abuse
    var MAX_ACTIVE_BOOKINGS = 5;
    var activeCount = await queryOne(
      "SELECT COUNT(*) as count FROM bookings WHERE guest_id = $1 AND status IN ('pending', 'accepted', 'cancel_requested')",
      [req.user.id],
    );
    if (activeCount && parseInt(activeCount.count) >= MAX_ACTIVE_BOOKINGS) {
      return res.status(429).json({ error: "You have too many active bookings. Please wait for existing bookings to complete or be cancelled before making new ones." });
    }

    var body = req.body || {};
    var vehicle_id = body.vehicle_id;
    var pickup_date = body.pickup_date;
    var dropoff_date = body.dropoff_date;
    var pickup_location = body.pickup_location;
    var dropoff_location = body.dropoff_location;
    var guest_notes = body.guest_notes;
    var selected_extras = body.selected_extras;
    var pickup_time = body.pickup_time || "10:00";
    var dropoff_time = body.dropoff_time || "10:00";
    var location_fee = 0; // Computed server-side from vehicle pickup_fees

    if (!vehicle_id || !pickup_date || !dropoff_date) {
      return res
        .status(400)
        .json({
          error: "vehicle_id, pickup_date and dropoff_date are required",
        });
    }

    vehicle_id = parseInt(vehicle_id);
    if (isNaN(vehicle_id) || vehicle_id <= 0) {
      return res.status(400).json({ error: "Invalid vehicle_id" });
    }

    // Input length limits
    if (guest_notes && String(guest_notes).length > 1000) {
      return res.status(400).json({ error: "Guest notes too long (max 1000 characters)" });
    }
    if (pickup_location && String(pickup_location).length > 200) {
      return res.status(400).json({ error: "Pickup location too long" });
    }
    if (dropoff_location && String(dropoff_location).length > 200) {
      return res.status(400).json({ error: "Dropoff location too long" });
    }

    var dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(pickup_date) || !dateRegex.test(dropoff_date)) {
      return res.status(400).json({ error: "Dates must be YYYY-MM-DD format" });
    }
    if (pickup_date >= dropoff_date) {
      return res
        .status(400)
        .json({ error: "dropoff_date must be after pickup_date" });
    }

    // Prevent bookings in the past
    var today = new Date().toISOString().split("T")[0];
    if (pickup_date < today) {
      return res.status(400).json({ error: "Pickup date cannot be in the past" });
    }

    var days_check = daysBetween(pickup_date, dropoff_date);
    if (days_check > 365) {
      return res
        .status(400)
        .json({ error: "Maximum booking duration is 365 days" });
    }

    var vehicle = await queryOne(
      `SELECT v.*, pp.company_name, pp.is_verified FROM vehicles v
             LEFT JOIN partner_profiles pp ON v.partner_id = pp.user_id
             WHERE v.id = $1 AND v.status = 'active' AND pp.is_verified = 1`,
      [vehicle_id],
    );
    if (!vehicle)
      return res.status(404).json({ error: "Vehicle not found or inactive" });

    // Compute location_fee server-side from vehicle's pickup_fees config
    if (vehicle.pickup_fees_enabled) {
      var pf = vehicle.pickup_fees;
      if (typeof pf === 'string') { try { pf = JSON.parse(pf); } catch (e) { pf = {}; } }
      pf = pf || {};

      function getLocFee(locStr) {
        if (!locStr) return 0;
        if (locStr.indexOf('Airport') !== -1) return parseFloat(pf.airport_fee) || 0;
        if (locStr.indexOf('Delivery') !== -1) return parseFloat(pf.delivery_fee) || 0;
        return 0;
      }
      location_fee = Math.round((getLocFee(pickup_location) + getLocFee(dropoff_location)) * 100) / 100;
    }

    var days = daysBetween(
      pickup_date,
      dropoff_date,
      pickup_time,
      dropoff_time,
    );
    var dailyPrice = getDailyRateByTier(vehicle, days, pickup_date);
    var rentalTotal = Math.round(days * dailyPrice * 100) / 100;
    var vehicleServices = normalizeVehicleServices(vehicle);
    var chosenExtras = buildSelectedExtras(vehicleServices, selected_extras);
    var extrasTotal =
      Math.round(
        chosenExtras.reduce(function (sum, extra) {
          var price = parseFloat(extra.price) || 0;
          return sum + (extra.perDay ? price * days : price);
        }, 0) * 100,
      ) / 100;
    var serviceFee = Math.round(dailyPrice * WEBSITE_FEE_PERCENT * 100) / 100;
    var total_price =
      Math.round((rentalTotal + extrasTotal + location_fee) * 100) / 100;

    // Use a transaction with row-level locking to prevent double bookings
    var txClient = await getClient();
    var booking;
    try {
      await txClient.query('BEGIN');

      // Lock existing availability rows for this vehicle+date range to prevent concurrent reads
      var conflictResult = await txClient.query(
        `SELECT date FROM vehicle_availability
               WHERE vehicle_id = $1 AND date >= $2 AND date < $3 AND status IN ('blocked', 'booked')
               FOR UPDATE`,
        [vehicle_id, pickup_date, dropoff_date],
      );
      if (conflictResult.rows.length > 0) {
        await txClient.query('ROLLBACK');
        txClient.release();
        return res.status(409).json({
          error: "Vehicle is not available for the selected dates",
          conflicting_dates: conflictResult.rows.map(function (r) {
            return r.date;
          }),
        });
      }

      // Check overlapping bookings within the transaction
      var overlapResult = await txClient.query(
        `SELECT id FROM bookings
               WHERE vehicle_id = $1
               AND status IN ('pending', 'accepted', 'completed', 'cancel_requested', 'pending_verification')
               AND pickup_date <= $2
               AND dropoff_date >= $3
               FOR UPDATE`,
        [vehicle_id, dropoff_date, pickup_date],
      );
      if (overlapResult.rows.length > 0) {
        await txClient.query('ROLLBACK');
        txClient.release();
        return res
          .status(409)
          .json({
            error:
              "Vehicle already has an overlapping reservation for these dates",
          });
      }

      // Create booking with pending_verification status (requires OTP to confirm)
      var insertResult = await txClient.query(
        `INSERT INTO bookings
               (guest_id, vehicle_id, partner_id, pickup_date, dropoff_date, pickup_time, dropoff_time, rental_days,
                pickup_location, dropoff_location, extras_json, extras_total, location_fee, service_fee,
                total_price, status, guest_notes)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'pending_verification', $16)
               RETURNING id`,
        [
          req.user.id,
          vehicle_id,
          vehicle.partner_id,
          pickup_date,
          dropoff_date,
          pickup_time,
          dropoff_time,
          days,
          pickup_location || null,
          dropoff_location || null,
          JSON.stringify(chosenExtras),
          extrasTotal,
          location_fee,
          serviceFee,
          total_price,
          guest_notes || null,
        ],
      );

      booking = insertResult.rows[0];
      await txClient.query('COMMIT');
    } catch (txErr) {
      await txClient.query('ROLLBACK');
      throw txErr;
    } finally {
      txClient.release();
    }

    // Get user's phone for OTP
    var guestUser = await queryOne(
      "SELECT phone, full_name FROM users WHERE id = $1",
      [req.user.id],
    );

    if (!guestUser || !guestUser.phone) {
      // If no phone, auto-confirm (legacy flow)
      await execute("UPDATE bookings SET status = 'pending' WHERE id = $1", [
        booking.id,
      ]);
      await blockDatesForBooking(vehicle_id, pickup_date, dropoff_date);

      var paypalConfigured = false;
      try {
        paypalConfigured = require("../paypal").isConfigured();
      } catch (e) {}

      return res.status(201).json({
        message: "Booking created successfully",
        booking_id: booking.id,
        total_price: total_price,
        rental_days: days,
        extras_total: extrasTotal,
        service_fee: serviceFee,
        payment_required: paypalConfigured && serviceFee > 0,
        status: "pending",
      });
    }

    // Send OTP via Twilio Verify API (managed OTP — Twilio generates & sends the code)
    var verifyMode = 'verify';
    var bookingIdStr = String(booking.id);
    var expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes for Verify API
    var verifyResult = await startVerify(guestUser.phone);

    if (verifyResult.success) {
      // Store a marker record so verify endpoint knows to use Twilio checkVerify
      await execute(
        `INSERT INTO otp_codes (user_id, phone, code_hash, type, reference_id, expires_at)
               VALUES ($1, $2, $3, 'reservation', $4, $5)`,
        [req.user.id, guestUser.phone, 'TWILIO_VERIFY', bookingIdStr, expiresAt],
      );
    } else {
      // Fallback to direct SMS
      console.warn('[Booking OTP] Twilio Verify failed, trying direct SMS:', verifyResult.error);
      verifyMode = 'legacy';
      var otp = crypto.randomInt(100000, 999999).toString();
      var otpHash = await bcrypt.hash(otp, 10);
      var legacyExpires = new Date(Date.now() + 5 * 60 * 1000);

      var otpInsertResult = await execute(
        `INSERT INTO otp_codes (user_id, phone, code_hash, type, reference_id, expires_at)
               VALUES ($1, $2, $3, 'reservation', $4, $5)
               RETURNING id`,
        [req.user.id, guestUser.phone, otpHash, bookingIdStr, legacyExpires],
      );
      var otpRecordId =
        otpInsertResult.rows && otpInsertResult.rows[0]
          ? otpInsertResult.rows[0].id
          : null;

      var smsResult = await sendOTPSMS(guestUser.phone, otp, "reservation");
      if (!smsResult || !smsResult.success) {
        await invalidateOtpRecord(otpRecordId);
        // In development without SMS, auto-confirm the booking instead of failing
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Booking OTP] SMS failed in dev mode — auto-confirming booking', booking.id);
          await execute("UPDATE bookings SET status = 'pending' WHERE id = $1", [booking.id]);
          await blockDatesForBooking(vehicle_id, pickup_date, dropoff_date);

          var paypalConfiguredDev = false;
          try { paypalConfiguredDev = require("../paypal").isConfigured(); } catch (e) {}

          return res.status(201).json({
            message: "Booking created successfully (verification skipped in dev mode)",
            booking_id: booking.id,
            total_price: total_price,
            rental_days: days,
            extras_total: extrasTotal,
            service_fee: serviceFee,
            payment_required: paypalConfiguredDev && serviceFee > 0,
            status: "pending",
          });
        }
        await execute(
          "UPDATE bookings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
          [booking.id],
        );
        return res.status(502).json({
          error:
            "Booking created, but failed to send verification code. Please try again.",
          booking_id: booking.id,
          status: "cancelled",
          requiresVerification: false,
        });
      }
    }

    var paypalConfigured = false;
    try {
      paypalConfigured = require("../paypal").isConfigured();
    } catch (e) {}

    res.status(201).json({
      message:
        "Booking created! Please verify with the code sent to your phone.",
      booking_id: booking.id,
      total_price: total_price,
      rental_days: days,
      extras_total: extrasTotal,
      service_fee: serviceFee,
      payment_required: paypalConfigured && serviceFee > 0,
      status: "pending_verification",
      requiresVerification: true,
      phoneLast4: guestUser.phone.slice(-4),
      expiresIn: 300,
    });
  } catch (err) {
    console.error("Create booking error:", err.message, err.stack);
    console.error("Create booking error details:", JSON.stringify({ code: err.code, detail: err.detail, table: err.table, column: err.column, constraint: err.constraint }));
    var userMessage = "Failed to create booking";
    if (err.code === '23505') userMessage = "A booking already exists for these dates";
    else if (err.code === '23503') userMessage = "Invalid vehicle or user reference";
    else if (err.code === '23514') userMessage = "Invalid booking data";
    else if (err.message) userMessage += ": " + err.message;
    res.status(500).json({ error: userMessage });
  }
});

// POST /api/bookings/verify - Verify booking with OTP
router.post(
  "/verify",
  authenticateToken,
  requireRole("guest"),
  bookingOtpLimiter,
  async (req, res) => {
    try {
      var { booking_id, code } = req.body;

      if (!booking_id || !code) {
        return res
          .status(400)
          .json({ error: "Booking ID and verification code are required" });
      }

      var bookingIdStr = String(booking_id);

      // Get booking
      var booking = await queryOne(
        "SELECT * FROM bookings WHERE id = $1 AND guest_id = $2",
        [booking_id, req.user.id],
      );

      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (booking.status !== "pending_verification") {
        return res
          .status(400)
          .json({ error: "Booking is not pending verification" });
      }

      // Find the OTP record
      var otpRecord = await queryOne(
        `SELECT * FROM otp_codes
             WHERE reference_id = $1 AND type = 'reservation' AND verified = 0 AND expires_at > NOW()
             ORDER BY created_at DESC LIMIT 1`,
        [bookingIdStr],
      );

      if (!otpRecord) {
        // Auto-cancel booking if OTP expired
        await execute(
          "UPDATE bookings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
          [booking_id],
        );
        return res.status(400).json({
          error: "Verification code expired. Booking has been cancelled.",
          cancelled: true,
        });
      }

      // Check max attempts
      if (otpRecord.attempts >= otpRecord.max_attempts) {
        await execute("UPDATE otp_codes SET verified = -1 WHERE id = $1", [
          otpRecord.id,
        ]);
        await execute(
          "UPDATE bookings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
          [booking_id],
        );
        return res.status(429).json({
          error: "Too many failed attempts. Booking has been cancelled.",
          cancelled: true,
        });
      }

      // Verify the code — use Twilio Verify API if marker present, else bcrypt
      var isValid = false;
      if (otpRecord.code_hash === 'TWILIO_VERIFY') {
        var vResult = await checkVerify(otpRecord.phone, code);
        isValid = vResult.success;
      } else {
        isValid = await bcrypt.compare(code, otpRecord.code_hash);
      }

      if (!isValid) {
        await execute(
          "UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1",
          [otpRecord.id],
        );

        var remainingAttempts = otpRecord.max_attempts - otpRecord.attempts - 1;

        return res.status(400).json({
          error: "Invalid verification code",
          remainingAttempts: remainingAttempts,
        });
      }

      // Mark OTP as verified
      await execute("UPDATE otp_codes SET verified = 1 WHERE id = $1", [
        otpRecord.id,
      ]);

      // Update booking status to pending (awaiting partner approval)
      await execute(
        "UPDATE bookings SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [booking_id],
      );

      // Block dates for the booking
      await blockDatesForBooking(
        booking.vehicle_id,
        booking.pickup_date,
        booking.dropoff_date,
      );

      // Notify partner about new booking
      try {
        var vehicle = await queryOne(
          "SELECT name, partner_id FROM vehicles WHERE id = $1",
          [booking.vehicle_id],
        );
        var partnerInfo = await queryOne(
          `SELECT u.email, u.full_name, pp.company_name
                 FROM users u LEFT JOIN partner_profiles pp ON u.id = pp.user_id
                 WHERE u.id = $1`,
          [vehicle.partner_id],
        );
        if (partnerInfo && partnerInfo.email) {
          var { sendEmail } = require("../mailer");
          var guestUser = await queryOne(
            "SELECT full_name FROM users WHERE id = $1",
            [req.user.id],
          );
          await sendEmail({
            to: partnerInfo.email,
            subject: "New Booking Request — " + vehicle.name,
            text:
              "Hello " +
              (partnerInfo.company_name || partnerInfo.full_name || "Partner") +
              ",\n\nYou have a new booking request:\n\nVehicle: " +
              vehicle.name +
              "\nGuest: " +
              (guestUser ? guestUser.full_name : "Guest") +
              "\nDates: " +
              booking.pickup_date +
              " → " +
              booking.dropoff_date +
              "\nTotal: $" +
              booking.total_price.toFixed(2) +
              "\n\nPlease review and accept/reject in your dashboard.\n\nRoyalCar.rent",
            html:
              "<p>Hello " +
              escapeHtml(
                partnerInfo.company_name || partnerInfo.full_name || "Partner",
              ) +
              ",</p><p>You have a new booking request:</p><ul><li><strong>Vehicle:</strong> " +
              escapeHtml(vehicle.name) +
              "</li><li><strong>Guest:</strong> " +
              escapeHtml(guestUser ? guestUser.full_name : "Guest") +
              "</li><li><strong>Dates:</strong> " +
              escapeHtml(booking.pickup_date) +
              " → " +
              escapeHtml(booking.dropoff_date) +
              "</li><li><strong>Total:</strong> $" +
              booking.total_price.toFixed(2) +
              "</li></ul><p>Please review and accept/reject in your dashboard.</p><p>RoyalCar.rent</p>",
          });
        }
      } catch (emailErr) {
        console.error(
          "New booking notification email error:",
          emailErr.message,
        );
      }

      res.json({
        success: true,
        message: "Booking verified successfully!",
        booking_id: booking_id,
        status: "pending",
      });
    } catch (err) {
      console.error("Verify booking error:", err);
      res.status(500).json({ error: "Verification failed" });
    }
  },
);

// POST /api/bookings/resend-otp - Resend booking verification OTP
router.post(
  "/resend-otp",
  authenticateToken,
  requireRole("guest"),
  bookingResendLimiter,
  async (req, res) => {
    try {
      var { booking_id } = req.body;

      if (!booking_id) {
        return res.status(400).json({ error: "Booking ID is required" });
      }

      var booking = await queryOne(
        "SELECT * FROM bookings WHERE id = $1 AND guest_id = $2",
        [booking_id, req.user.id],
      );

      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (booking.status !== "pending_verification") {
        return res
          .status(400)
          .json({ error: "Booking is not pending verification" });
      }

      // Get user's phone
      var user = await queryOne("SELECT phone FROM users WHERE id = $1", [
        req.user.id,
      ]);
      if (!user || !user.phone) {
        return res.status(400).json({ error: "No phone number on file" });
      }

      // Invalidate existing OTPs
      await execute(
        "UPDATE otp_codes SET verified = -1 WHERE reference_id = $1 AND type = 'reservation' AND verified = 0",
        [booking_id],
      );

      // Send OTP via Twilio Verify API first
      var verifyResult = await startVerify(user.phone);

      if (verifyResult.success) {
        var expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await execute(
          `INSERT INTO otp_codes (user_id, phone, code_hash, type, reference_id, expires_at)
               VALUES ($1, $2, $3, 'reservation', $4, $5)`,
          [req.user.id, user.phone, 'TWILIO_VERIFY', booking_id, expiresAt],
        );
        return res.json({
          success: true,
          message: "New verification code sent",
          expiresIn: 600,
          phoneLast4: user.phone.slice(-4),
        });
      }

      // Fallback to direct SMS
      console.warn('[Booking Resend] Twilio Verify failed, trying direct SMS:', verifyResult.error);
      var otp = crypto.randomInt(100000, 999999).toString();
      var otpHash = await bcrypt.hash(otp, 10);
      var legacyExpires = new Date(Date.now() + 5 * 60 * 1000);

      var otpInsertResult = await execute(
        `INSERT INTO otp_codes (user_id, phone, code_hash, type, reference_id, expires_at)
             VALUES ($1, $2, $3, 'reservation', $4, $5)
             RETURNING id`,
        [req.user.id, user.phone, otpHash, booking_id, legacyExpires],
      );
      var otpRecordId =
        otpInsertResult.rows && otpInsertResult.rows[0]
          ? otpInsertResult.rows[0].id
          : null;

      var smsResult = await sendOTPSMS(user.phone, otp, "reservation");
      if (!smsResult || !smsResult.success) {
        await invalidateOtpRecord(otpRecordId);
        return res.status(502).json({
          error: "Failed to resend verification code",
          expiresIn: 300,
          phoneLast4: user.phone.slice(-4),
        });
      }

      res.json({
        success: true,
        message: "New verification code sent",
        expiresIn: 300,
        phoneLast4: user.phone.slice(-4),
      });
    } catch (err) {
      console.error("Resend booking OTP error:", err);
      res.status(500).json({ error: "Failed to resend code" });
    }
  },
);

router.get("/my", authenticateToken, requireRole("guest"), async (req, res) => {
  try {
    var bookings = await queryAll(
      `SELECT b.*, v.name as vehicle_name, v.image_url, v.price_per_day,
                    v.category, v.year, pp.company_name as partner_company
             FROM bookings b
             JOIN vehicles v ON b.vehicle_id = v.id
             LEFT JOIN partner_profiles pp ON b.partner_id = pp.user_id
             WHERE b.guest_id = $1
             ORDER BY b.created_at DESC`,
      [req.user.id],
    );
    res.json({ bookings: bookings });
  } catch (err) {
    console.error("Get my bookings error:", err);
    res.status(500).json({ error: "Failed to get bookings" });
  }
});

router.get(
  "/partner",
  authenticateToken,
  requireRole("partner"),
  async (req, res) => {
    try {
      var bookings = await queryAll(
        `SELECT b.*, v.name as vehicle_name, v.image_url, v.price_per_day,
                    u.full_name as guest_name, u.email as guest_email, u.phone as guest_phone
             FROM bookings b
             JOIN vehicles v ON b.vehicle_id = v.id
             JOIN users u ON b.guest_id = u.id
             WHERE b.partner_id = $1
             ORDER BY b.created_at DESC`,
        [req.user.id],
      );
      res.json({ bookings: bookings });
    } catch (err) {
      console.error("Get partner bookings error:", err);
      res.status(500).json({ error: "Failed to get bookings" });
    }
  },
);

router.patch("/:id/status", authenticateToken, async (req, res) => {
  try {
    var bookingId = parseInt(req.params.id, 10);
    var status = req.body ? req.body.status : null;
    var booking = await queryOne(
      `SELECT b.*, v.name as vehicle_name,
                    u.email as guest_email, u.full_name as guest_name,
                    pu.email as partner_email, pu.full_name as partner_name,
                    pp.company_name as partner_company
             FROM bookings b
             JOIN vehicles v ON b.vehicle_id = v.id
             JOIN users u ON b.guest_id = u.id
             LEFT JOIN users pu ON b.partner_id = pu.id
             LEFT JOIN partner_profiles pp ON b.partner_id = pp.user_id
             WHERE b.id = $1`,
      [bookingId],
    );

    if (!booking) return res.status(404).json({ error: "Booking not found" });

    var allowed = [];
    var bStatus = String(booking.status || "");

    if (req.user.role === "guest" && booking.guest_id == req.user.id) {
      if (bStatus === "pending") {
        allowed = ["cancelled"];
      } else if (bStatus === "accepted") {
        allowed = ["cancel_requested"];
      }
    }

    if (req.user.role === "partner" && booking.partner_id == req.user.id) {
      if (bStatus === "pending") {
        allowed = ["accepted", "rejected"];
      } else if (bStatus === "cancel_requested") {
        allowed = ["cancelled"];
      }
    }

    if (allowed.indexOf(status) === -1) {
      return res.status(403).json({ error: "Action not allowed" });
    }

    try {
      await execute(
        "UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [status, bookingId],
      );
    } catch (dbErr) {
      console.error("DB update error:", dbErr.message);
      return res.status(500).json({ error: "Database error updating status." });
    }

    if (status === "accepted") {
      await blockDatesForBooking(
        booking.vehicle_id,
        booking.pickup_date,
        booking.dropoff_date,
      );
    }
    if (status === "cancelled" || status === "rejected") {
      await unblockDatesForBooking(
        booking.vehicle_id,
        booking.pickup_date,
        booking.dropoff_date,
      );
    }

    var { sendEmail } = require("../mailer");
    var vehicleName = booking.vehicle_name || "Vehicle";
    var dates = booking.pickup_date + " → " + booking.dropoff_date;

    try {
      if (status === "accepted" && booking.guest_email) {
        await sendEmail({
          to: booking.guest_email,
          subject: "Booking Accepted — " + vehicleName,
          text:
            "Hello " +
            (booking.guest_name || "Guest") +
            ",\n\nYour reservation for " +
            vehicleName +
            " (" +
            dates +
            ") has been accepted by the partner.\n\nTotal: $" +
            (parseFloat(booking.total_price) || 0).toFixed(2) +
            "\n\nThank you for using RoyalCar.rent!",
          html:
            "<p>Hello " +
            escapeHtml(booking.guest_name || "Guest") +
            ",</p><p>Your reservation for <strong>" +
            escapeHtml(vehicleName) +
            "</strong> (" +
            escapeHtml(dates) +
            ') has been <strong style="color:#16a34a;">accepted</strong>.</p><p>Total: <strong>$' +
            (parseFloat(booking.total_price) || 0).toFixed(2) +
            "</strong></p><p>Thank you for using RoyalCar.rent!</p>",
        });
      }
      if (status === "rejected" && booking.guest_email) {
        await sendEmail({
          to: booking.guest_email,
          subject: "Booking Declined — " + vehicleName,
          text:
            "Hello " +
            (booking.guest_name || "Guest") +
            ",\n\nUnfortunately your reservation for " +
            vehicleName +
            " (" +
            dates +
            ") was not accepted.\n\nPlease try another vehicle or different dates.\n\nRoyalCar.rent Team",
          html:
            "<p>Hello " +
            escapeHtml(booking.guest_name || "Guest") +
            ",</p><p>Unfortunately your reservation for <strong>" +
            escapeHtml(vehicleName) +
            "</strong> (" +
            escapeHtml(dates) +
            ') was <strong style="color:#dc2626;">declined</strong>.</p><p>Please try another vehicle or different dates.</p><p>RoyalCar.rent Team</p>',
        });
      }
      if (status === "cancel_requested" && booking.partner_email) {
        await sendEmail({
          to: booking.partner_email,
          subject: "Cancellation Requested — " + vehicleName,
          text:
            "Hello " +
            (booking.partner_company || booking.partner_name || "Partner") +
            ",\n\nGuest " +
            (booking.guest_name || "") +
            " has requested cancellation for " +
            vehicleName +
            " (" +
            dates +
            ").\n\nPlease review in your dashboard.\n\nRoyalCar.rent",
          html:
            "<p>Hello " +
            escapeHtml(
              booking.partner_company || booking.partner_name || "Partner",
            ) +
            ",</p><p>Guest <strong>" +
            escapeHtml(booking.guest_name || "") +
            "</strong> has requested cancellation for <strong>" +
            escapeHtml(vehicleName) +
            "</strong> (" +
            escapeHtml(dates) +
            ").</p><p>Please review in your dashboard.</p>",
        });
      }
      if (status === "cancelled" && booking.guest_email) {
        await sendEmail({
          to: booking.guest_email,
          subject: "Booking Cancelled — " + vehicleName,
          text:
            "Hello " +
            (booking.guest_name || "Guest") +
            ",\n\nYour reservation for " +
            vehicleName +
            " (" +
            dates +
            ") has been cancelled.\n\nRoyalCar.rent Team",
          html:
            "<p>Hello " +
            escapeHtml(booking.guest_name || "Guest") +
            ",</p><p>Your reservation for <strong>" +
            escapeHtml(vehicleName) +
            "</strong> (" +
            escapeHtml(dates) +
            ") has been <strong>cancelled</strong>.</p><p>RoyalCar.rent Team</p>",
        });
      }
    } catch (emailErr) {
      console.error("Booking notification email error:", emailErr.message);
    }

    res.json({ message: "Booking status updated", status: status });
  } catch (err) {
    console.error("Update booking status error:", err);
    res.status(500).json({ error: "Failed to update booking" });
  }
});

router.get("/:id", authenticateToken, async (req, res) => {
  try {
    var bookingId = parseInt(req.params.id, 10);
    var booking = await queryOne(
      `SELECT b.*, v.name as vehicle_name, v.image_url, v.price_per_day, v.category, v.year,
                    u.full_name as guest_name, u.email as guest_email, u.phone as guest_phone,
                    pp.company_name as partner_company
             FROM bookings b
             JOIN vehicles v ON b.vehicle_id = v.id
             JOIN users u ON b.guest_id = u.id
             LEFT JOIN partner_profiles pp ON b.partner_id = pp.user_id
             WHERE b.id = $1`,
      [bookingId],
    );

    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (
      booking.guest_id != req.user.id &&
      booking.partner_id != req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({ booking: booking });
  } catch (err) {
    console.error("Get booking error:", err);
    res.status(500).json({ error: "Failed to get booking" });
  }
});

module.exports = router;
