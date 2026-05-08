const express = require('express');
const { sendEmail, escapeHtml } = require('../mailer');
const router = express.Router();

router.post('/submit', async (req, res) => {
    try {
        const { fullName, email, phone, subject, message } = req.body;

        if (!fullName || !email || !subject || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (fullName.length > 100 || email.length > 254 || subject.length > 200 || message.length > 5000 || (phone && phone.length > 20)) {
            return res.status(400).json({ error: 'One or more fields exceed maximum length' });
        }

        const emailText = `New contact form submission from EliteAuto.rent

Name: ${fullName}
Email: ${email}
Phone: ${phone || 'Not provided'}
Subject: ${subject}

Message:
${message}

---
This message was sent from the contact form at EliteAuto.rent`;

        const safeFullName = escapeHtml(fullName);
        const safeEmail = escapeHtml(email);
        const safePhone = escapeHtml(phone);
        const safeSubject = escapeHtml(subject);
        const safeMessage = escapeHtml(message);

        const emailHtml = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc;border-radius:12px;">
    <div style="background:#fff;padding:30px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
        <h2 style="color:#1e293b;margin:0 0 20px;font-size:24px;">New Contact Form Submission</h2>
        <div style="background:#f1f5f9;padding:16px;border-radius:6px;margin-bottom:20px;">
            <p style="margin:0 0 8px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;">From</p>
            <p style="margin:0;color:#1e293b;font-size:16px;font-weight:600;">${safeFullName}</p>
            <p style="margin:4px 0 0;color:#64748b;font-size:14px;">${safeEmail}</p>
            ${phone ? `<p style="margin:4px 0 0;color:#64748b;font-size:14px;">${safePhone}</p>` : ''}
        </div>
        <div style="margin-bottom:20px;">
            <p style="margin:0 0 8px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;">Subject</p>
            <p style="margin:0;color:#1e293b;font-size:16px;">${safeSubject}</p>
        </div>
        <div>
            <p style="margin:0 0 8px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;">Message</p>
            <p style="margin:0;color:#1e293b;font-size:15px;line-height:1.6;white-space:pre-wrap;">${safeMessage}</p>
        </div>
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:20px;">This message was sent from the contact form at EliteAuto.rent</p>
</div>`;

        await sendEmail({
            to: process.env.CONTACT_EMAIL || process.env.SMTP_USER || 'elite.rental25@gmail.com',
            subject: `Contact Form: ${subject}`,
            text: emailText,
            html: emailHtml
        });

        res.json({ success: true, message: 'Message sent successfully' });
    } catch (err) {
        console.error('Contact form error:', err);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

module.exports = router;
