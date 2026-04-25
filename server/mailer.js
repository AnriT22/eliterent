const nodemailer = require("nodemailer");

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isProduction() {
  return String(process.env.NODE_ENV || "").toLowerCase() === "production";
}

function isEmailDebugEnabled() {
  return (
    String(process.env.EMAIL_DEBUG_LOGS || "").toLowerCase() === "true" &&
    !isProduction()
  );
}

function maskEmail(email) {
  if (!email || typeof email !== "string") return "***";
  const parts = email.split("@");
  if (parts.length !== 2) return "***";

  const local = parts[0];
  const domain = parts[1];

  if (!local) return `***@${domain || "***"}`;
  if (local.length <= 2) return `${local[0]}***@${domain}`;

  return `${local.slice(0, 2)}***@${domain}`;
}

// ── Resend provider ──
let resendClient = null;

function getResendClient() {
  if (resendClient) return resendClient;
  if (!process.env.RESEND_API_KEY) return null;
  const { Resend } = require("resend");
  resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

async function sendViaResend(options, from) {
  const client = getResendClient();
  if (!client) return null;

  const { data, error } = await client.emails.send({
    from: from,
    to: [options.to],
    subject: options.subject,
    text: options.text,
    html: options.html,
  });

  if (error) {
    console.error("[email:resend] Error:", error);
    return null;
  }

  console.log("[email:resend] Sent successfully", {
    id: data && data.id,
    to: maskEmail(options.to),
    subject: options.subject,
  });
  return { sent: true, provider: "resend" };
}

// ── SMTP provider (nodemailer) ──
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

async function sendViaSMTP(options, from) {
  const tx = getTransporter();
  if (!tx) return null;

  await tx.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });

  console.log("[email:smtp] Sent successfully", {
    to: maskEmail(options.to),
    subject: options.subject,
  });
  return { sent: true, provider: "smtp" };
}

// ── Main send function: tries Resend first, then SMTP ──
async function sendEmail(options) {
  const from =
    process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || "RoyalCar <onboarding@resend.dev>";

  // Try Resend first
  if (process.env.RESEND_API_KEY) {
    try {
      const result = await sendViaResend(options, from);
      if (result) return result;
    } catch (err) {
      console.error("[email:resend] Failed, trying SMTP fallback:", err.message);
    }
  }

  // Try SMTP fallback
  if (getTransporter()) {
    try {
      const result = await sendViaSMTP(options, from);
      if (result) return result;
    } catch (err) {
      console.error("[email:smtp] Failed:", err.message);
    }
  }

  // No provider available
  if (isProduction()) {
    console.error(
      "[email] No email provider configured. Email delivery skipped.",
      {
        to: maskEmail(options && options.to),
        subject: options && options.subject,
      },
    );
    return { sent: false, fallback: false, error: "No email provider configured" };
  }

  if (isEmailDebugEnabled()) {
    console.log("[email:debug] Simulated email delivery", {
      from,
      to: maskEmail(options && options.to),
      subject: options && options.subject,
    });
  } else {
    console.log("[email] No provider configured; email delivery skipped", {
      to: maskEmail(options && options.to),
      subject: options && options.subject,
    });
  }

  return { sent: false, fallback: true };
}

// Send OTP verification email
async function sendOTPEmail(email, otp, type = "verification") {
  let subject, text, html;

  switch (type) {
    case "registration":
      subject = "RoyalCar.rent - Verify Your Account";
      text = `Your verification code is: ${otp}\n\nThis code expires in 5 minutes.\nIf you didn't create an account, please ignore this email.`;
      html = `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #1e293b; margin: 0;">RoyalCar.rent</h1>
                        <p style="color: #64748b; margin: 5px 0;">Premium Car Rental</p>
                    </div>
                    <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 12px; padding: 30px; text-align: center;">
                        <h2 style="color: #fff; margin: 0 0 10px;">Verify Your Account</h2>
                        <p style="color: #94a3b8; margin: 0 0 25px;">Enter this code to complete your registration</p>
                        <div style="background: #fff; border-radius: 8px; padding: 20px; display: inline-block;">
                            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e293b;">${otp}</span>
                        </div>
                        <p style="color: #94a3b8; margin: 25px 0 0; font-size: 13px;">Code expires in 5 minutes</p>
                    </div>
                    <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 20px;">
                        If you didn't create an account, please ignore this email.
                    </p>
                </div>
            `;
      break;
    case "reservation":
      subject = "RoyalCar.rent - Confirm Your Booking";
      text = `Your booking confirmation code is: ${otp}\n\nThis code expires in 5 minutes.\nEnter this code to confirm your reservation.`;
      html = `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #1e293b; margin: 0;">RoyalCar.rent</h1>
                        <p style="color: #64748b; margin: 5px 0;">Premium Car Rental</p>
                    </div>
                    <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); border-radius: 12px; padding: 30px; text-align: center;">
                        <h2 style="color: #fff; margin: 0 0 10px;">Confirm Your Booking</h2>
                        <p style="color: #d1fae5; margin: 0 0 25px;">Enter this code to confirm your reservation</p>
                        <div style="background: #fff; border-radius: 8px; padding: 20px; display: inline-block;">
                            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #059669;">${otp}</span>
                        </div>
                        <p style="color: #d1fae5; margin: 25px 0 0; font-size: 13px;">Code expires in 5 minutes</p>
                    </div>
                    <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 20px;">
                        If you didn't make this booking, please contact support.
                    </p>
                </div>
            `;
      break;
    default:
      subject = "RoyalCar.rent - Verification Code";
      text = `Your verification code is: ${otp}\n\nThis code expires in 5 minutes.`;
      html = `<p>Your verification code is: <strong>${otp}</strong></p><p>This code expires in 5 minutes.</p>`;
  }

  return sendEmail({ to: email, subject, text, html });
}

module.exports = { sendEmail, sendOTPEmail, escapeHtml };
