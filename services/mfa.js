const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { getConnection } = require('../models/connectionModel');
const mfaModel = require('../models/mfaModel');
const { sendMfaCode, sendPasswordResetCode } = require('./email');

const CODE_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_CODE_ATTEMPTS = 5;

function createCode() {
    return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

async function issueCode(userId, email) {
    const [rows] = await mfaModel.issueCode([userId], []);

    const existing = rows[0];
    const secondsSinceSent = existing && existing.seconds_since_sent !== null
        ? Number(existing.seconds_since_sent)
        : null;
    if (existing && secondsSinceSent !== null && secondsSinceSent < RESEND_COOLDOWN_SECONDS) {
        const codeStillValid = existing.code_hash && Boolean(existing.code_valid);
        return {
            sent: false,
            codeAvailable: Boolean(codeStillValid),
            retryAfterSeconds: RESEND_COOLDOWN_SECONDS - secondsSinceSent,
            attemptsRemaining: Math.max(0, MAX_CODE_ATTEMPTS - Number(existing.attempts || 0))
        };
    }

    const code = createCode();
    const codeHash = await bcrypt.hash(code, 10);
    await mfaModel.issueCodeQuery2([userId, codeHash], [CODE_EXPIRY_MINUTES]);

    try {
        await sendMfaCode(email, code);
    } catch (error) {
        await mfaModel.issueCodeQuery3([userId], []);
        throw error;
    }

    return {
        sent: true,
        codeAvailable: true,
        retryAfterSeconds: RESEND_COOLDOWN_SECONDS,
        attemptsRemaining: MAX_CODE_ATTEMPTS
    };
}

async function issuePasswordResetCode(userId, email) {
    const [rows] = await mfaModel.issueCode([userId], []);

    const existing = rows[0];
    const secondsSinceSent = existing && existing.seconds_since_sent !== null
        ? Number(existing.seconds_since_sent)
        : null;
    if (existing && secondsSinceSent !== null && secondsSinceSent < RESEND_COOLDOWN_SECONDS) {
        const codeStillValid = existing.code_hash && Boolean(existing.code_valid);
        return {
            sent: false,
            codeAvailable: Boolean(codeStillValid),
            retryAfterSeconds: RESEND_COOLDOWN_SECONDS - secondsSinceSent,
            attemptsRemaining: Math.max(0, MAX_CODE_ATTEMPTS - Number(existing.attempts || 0))
        };
    }

    const code = createCode();
    const codeHash = await bcrypt.hash(code, 10);
    await mfaModel.issueCodeQuery2([userId, codeHash], [CODE_EXPIRY_MINUTES]);

    try {
        await sendPasswordResetCode(email, code);
    } catch (error) {
        await mfaModel.issueCodeQuery3([userId], []);
        throw error;
    }

    return {
        sent: true,
        codeAvailable: true,
        retryAfterSeconds: RESEND_COOLDOWN_SECONDS,
        attemptsRemaining: MAX_CODE_ATTEMPTS
    };
}

async function verifyCode(userId, submittedCode) {
    const connection = await getConnection();

    try {
        await connection.beginTransaction();
        const [rows] = await mfaModel.verifyCode([userId], [], connection);

        if (rows.length === 0 || !rows[0].code_hash) {
            await connection.rollback();
            return { status: 'not_pending', attemptsRemaining: MAX_CODE_ATTEMPTS };
        }

        const mfa = rows[0];
        if (Boolean(mfa.code_expired)) {
            await mfaModel.verifyCodeQuery2([userId], [], connection);
            await connection.commit();
            return { status: 'expired', attemptsRemaining: MAX_CODE_ATTEMPTS };
        }

        if (Number(mfa.attempts) >= MAX_CODE_ATTEMPTS) {
            await mfaModel.verifyCodeQuery3([userId], [], connection);
            await connection.commit();
            return { status: 'locked', attemptsRemaining: 0 };
        }

        const matches = /^\d{6}$/.test(submittedCode) && await bcrypt.compare(submittedCode, mfa.code_hash);
        if (!matches) {
            const nextAttempts = Number(mfa.attempts) + 1;
            if (nextAttempts >= MAX_CODE_ATTEMPTS) {
                await mfaModel.verifyCodeQuery4([userId], [], connection);
                await connection.commit();
                return { status: 'locked', attemptsRemaining: 0 };
            }

            await mfaModel.verifyCodeQuery5([nextAttempts, userId], [], connection);
            await connection.commit();
            return { status: 'invalid', attemptsRemaining: MAX_CODE_ATTEMPTS - nextAttempts };
        }

        await mfaModel.verifyCodeQuery6([userId], [], connection);

        await connection.commit();
        return { status: 'verified', attemptsRemaining: MAX_CODE_ATTEMPTS };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = { issueCode, verifyCode, issuePasswordResetCode };
