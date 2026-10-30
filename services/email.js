const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
    if (transporter) return transporter;

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const password = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;

    if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !password) {
        if (process.env.NODE_ENV === 'production' && process.env.STRICT_SMTP === 'true') {
            const error = new Error('SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD (or SMTP_PASS) must be configured to send email.');
            error.code = 'SMTP_CONFIGURATION_MISSING';
            throw error;
        }
        transporter = nodemailer.createTransport({
            jsonTransport: true
        });
        return transporter;
    }

    transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass: password }
    });

    return transporter;
}

async function sendMfaCode(email, code) {
    const mailer = getTransporter();
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@cspc.edu.ph';
    const fromName = process.env.SMTP_FROM_NAME || 'Project HANAP';

    const info = await mailer.sendMail({
        from: `"${fromName}" <${fromAddress}>`,
        to: email,
        subject: 'Your Project HANAP verification code',
        text: `Your Project HANAP verification code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
        html: `<p>Your Project HANAP verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>`
    });

    if (!process.env.SMTP_HOST) {
        console.log(`[HANAP Email Fallback] MFA verification code for ${email}: ${code}`);
    }

    return info;
}

async function sendMfaEnabledNotice(email) {
    const mailer = getTransporter();
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@cspc.edu.ph';
    const fromName = process.env.SMTP_FROM_NAME || 'Project HANAP';

    const info = await mailer.sendMail({
        from: `"${fromName}" <${fromAddress}>`,
        to: email,
        subject: 'Email MFA enabled for Project HANAP',
        text: 'Email multi-factor authentication is now enabled for your Project HANAP account. A one-time code will be emailed after your password each time you sign in. If you did not enable this, contact your campus administrator.',
        html: '<p>Email multi-factor authentication is now enabled for your Project HANAP account.</p><p>A one-time code will be emailed after your password each time you sign in.</p><p>If you did not enable this, contact your campus administrator.</p>'
    });

    if (!process.env.SMTP_HOST) {
        console.log(`[HANAP Email Fallback] MFA enabled notice sent to ${email}`);
    }

    return info;
}

async function sendPasswordResetCode(email, code) {
    const mailer = getTransporter();
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@cspc.edu.ph';
    const fromName = process.env.SMTP_FROM_NAME || 'Project HANAP';

    const info = await mailer.sendMail({
        from: `"${fromName}" <${fromAddress}>`,
        to: email,
        subject: 'Password Recovery Code - Project HANAP CSPC',
        text: `Your Project HANAP password recovery code is: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this password reset, please ignore this email.`,
        html: `
        <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background: #F4F7FB; border-radius: 16px; color: #0F172A;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background: #2B5B84; color: #ffffff; padding: 10px 18px; border-radius: 12px; font-weight: 800; font-size: 16px; letter-spacing: 0.5px;">
              HANAP <span style="font-size: 12px; background: rgba(255,255,255,0.25); padding: 2px 6px; border-radius: 6px; margin-left: 4px;">CSPC</span>
            </div>
          </div>
          <div style="background: #ffffff; border-radius: 16px; padding: 28px; border: 1px solid #E2E8F0; box-shadow: 0 4px 12px rgba(15,23,42,0.04);">
            <h2 style="margin: 0 0 12px 0; color: #0F172A; font-size: 20px; font-weight: 700;">Password Recovery Code</h2>
            <p style="margin: 0 0 20px 0; color: #64748B; font-size: 14px; line-height: 1.5;">We received a request to reset your Project HANAP account password. Use the verification code below to proceed with setting a new password:</p>
            <div style="background: #F1F5F9; border: 1px solid #CBD5E1; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 20px;">
              <span style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #2B5B84;">${code}</span>
            </div>
            <p style="margin: 0; color: #94A3B8; font-size: 12px; line-height: 1.5;">⏳ This code expires in <strong>10 minutes</strong>. If you did not request a password reset, you can safely ignore this email.</p>
          </div>
          <div style="text-align: center; margin-top: 20px; color: #94A3B8; font-size: 11px;">
            Project HANAP &bull; Camarines Sur Polytechnic Colleges, Nabua &bull; Lost &amp; Found Portal
          </div>
        </div>
        `
    });

    if (!process.env.SMTP_HOST) {
        console.log(`[HANAP Email Fallback] Password reset verification code for ${email}: ${code}`);
    }

    return info;
}

async function verifyEmailTransport() {
    const mailer = getTransporter();
    if (typeof mailer.verify === 'function' && process.env.SMTP_HOST) {
        await mailer.verify();
    }
}

module.exports = { sendMfaCode, sendMfaEnabledNotice, sendPasswordResetCode, verifyEmailTransport };
