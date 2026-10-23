const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
    if (transporter) return transporter;

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const password = process.env.SMTP_PASSWORD;

    if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !password) {
        const error = new Error('SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD must be configured to send email.');
        error.code = 'SMTP_CONFIGURATION_MISSING';
        throw error;
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
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
    const fromName = process.env.SMTP_FROM_NAME || 'Project HANAP';

    await mailer.sendMail({
        from: `"${fromName}" <${fromAddress}>`,
        to: email,
        subject: 'Your Project HANAP verification code',
        text: `Your Project HANAP verification code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
        html: `<p>Your Project HANAP verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>`
    });
}

async function sendMfaEnabledNotice(email) {
    const mailer = getTransporter();
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
    const fromName = process.env.SMTP_FROM_NAME || 'Project HANAP';

    await mailer.sendMail({
        from: `"${fromName}" <${fromAddress}>`,
        to: email,
        subject: 'Email MFA enabled for Project HANAP',
        text: 'Email multi-factor authentication is now enabled for your Project HANAP account. A one-time code will be emailed after your password each time you sign in. If you did not enable this, contact your campus administrator.',
        html: '<p>Email multi-factor authentication is now enabled for your Project HANAP account.</p><p>A one-time code will be emailed after your password each time you sign in.</p><p>If you did not enable this, contact your campus administrator.</p>'
    });
}

async function verifyEmailTransport() {
    await getTransporter().verify();
}

module.exports = { sendMfaCode, sendMfaEnabledNotice, verifyEmailTransport };
