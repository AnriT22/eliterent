"use strict";

/**
 * Owner alerts via Telegram (free, unlimited).
 *
 * Configure in .env:
 *   TELEGRAM_BOT_TOKEN=123456:ABC...     (from @BotFather)
 *   TELEGRAM_CHAT_ID=123456789           (your personal chat id)
 *
 * Safe + non-blocking: if it isn't configured, or the send fails, it logs and
 * returns false — it NEVER throws, so it can never break a booking/signup flow.
 * Call it fire-and-forget: notifyOwner(text)  (no need to await).
 */
const https = require("https");

function notifyOwner(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return Promise.resolve(false); // not configured — silent no-op

  return new Promise((resolve) => {
    try {
      const payload = JSON.stringify({
        chat_id: chatId,
        text: String(text),
        disable_web_page_preview: true,
      });
      const req = https.request(
        {
          hostname: "api.telegram.org",
          path: "/bot" + token + "/sendMessage",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
          timeout: 8000,
        },
        (res) => {
          res.on("data", function () {});
          res.on("end", function () {
            resolve(res.statusCode >= 200 && res.statusCode < 300);
          });
        },
      );
      req.on("error", function (e) {
        console.error("[notify] Telegram error:", e.message);
        resolve(false);
      });
      req.on("timeout", function () {
        req.destroy();
        resolve(false);
      });
      req.write(payload);
      req.end();
    } catch (e) {
      console.error("[notify] error:", e.message);
      resolve(false);
    }
  });
}

module.exports = { notifyOwner };
