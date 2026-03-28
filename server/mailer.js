const nodemailer = require('nodemailer');

function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return null;
    }

    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: String(process.env.SMTP_SECURE || 'false') === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    return transporter;
}

async function sendEmail(options) {
    var tx = getTransporter();
    var from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@eliterent.ge';

    if (!tx) {
        console.log('[email:fallback]', {
            from: from,
            to: options.to,
            subject: options.subject,
            text: options.text
        });
        return { sent: false, fallback: true };
    }

    await tx.sendMail({
        from: from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html
    });

    return { sent: true, fallback: false };
}

module.exports = { sendEmail, escapeHtml };
