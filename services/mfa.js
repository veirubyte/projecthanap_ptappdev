const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { getConnection } = require('../models/connectionModel');
const mfaModel = require('../models/mfaModel');
const { sendMfaCode, sendPasswordResetCode } = require('./email');

const CODE_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 30;
const MAX_CODE_ATTEMPTS = 5;

function createCode() {
    return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

async function matchesAnySessionHash(code, sessionHashes) {
    if (!/^\d{6}$/.test(code) || !Array.isArray(sessionHashes)) return false;
    const now = Date.now();
    for (const entry of sessionHashes) {
        if (entry && entry.codeHash && (!entry.expiresAt || Number(entry.expiresAt) > now)) {
            if (await bcrypt.compare(code, entry.codeHash)) {
                return true;
            }
        }
    }
    return false;
}

async function issueCode(userId, email) {
    const [rows] = await mfaModel.issueCode([userId], []);

    const existing = rows[0];
    const now = Date.now();
    const codeStillValid = Boolean(
        existing &&
        existing.code_hash &&
        existing.code_expires_at &&
        new Date(existing.code_expires_at).getTime() > now &&
        Number(existing.attempts || 0) < MAX_CODE_ATTEMPTS
    );
    const secondsSinceSent = (existing && existing.last_sent_at)
        ? Math.floor((now - new Date(existing.last_sent_at).getTime()) / 1000)
        : null;

    if (codeStillValid && secondsSinceSent !== null && secondsSinceSent >= 0 && secondsSinceSent < RESEND_COOLDOWN_SECONDS) {
        return {
            sent: false,
            codeAvailable: true,
            retryAfterSeconds: Math.max(1, RESEND_COOLDOWN_SECONDS - secondsSinceSent),
            attemptsRemaining: Math.max(0, MAX_CODE_ATTEMPTS - Number(existing.attempts || 0)),
            codeHash: existing.code_hash,
            expiresAt: new Date(existing.code_expires_at).getTime()
        };
    }

    const code = createCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000;
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
        attemptsRemaining: MAX_CODE_ATTEMPTS,
        codeHash,
        expiresAt
    };
}

async function issuePasswordResetCode(userId, email) {
    const [rows] = await mfaModel.issuePasswordResetCode([userId], []);

    const existing = rows[0];
    const now = Date.now();
    const codeStillValid = Boolean(
        existing &&
        existing.code_hash &&
        existing.code_expires_at &&
        new Date(existing.code_expires_at).getTime() > now &&
        Number(existing.attempts || 0) < MAX_CODE_ATTEMPTS
    );
    const secondsSinceSent = (existing && existing.last_sent_at)
        ? Math.floor((now - new Date(existing.last_sent_at).getTime()) / 1000)
        : null;

    if (codeStillValid && secondsSinceSent !== null && secondsSinceSent >= 0 && secondsSinceSent < RESEND_COOLDOWN_SECONDS) {
        return {
            sent: false,
            codeAvailable: true,
            retryAfterSeconds: Math.max(1, RESEND_COOLDOWN_SECONDS - secondsSinceSent),
            attemptsRemaining: Math.max(0, MAX_CODE_ATTEMPTS - Number(existing.attempts || 0)),
            codeHash: existing.code_hash,
            expiresAt: new Date(existing.code_expires_at).getTime()
        };
    }

    const code = createCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000;
    await mfaModel.issuePasswordResetCodeUpsert([userId, codeHash], [CODE_EXPIRY_MINUTES]);

    try {
        await sendPasswordResetCode(email, code);
    } catch (error) {
        await mfaModel.clearPasswordResetCode([userId], []);
        throw error;
    }

    return {
        sent: true,
        codeAvailable: true,
        retryAfterSeconds: RESEND_COOLDOWN_SECONDS,
        attemptsRemaining: MAX_CODE_ATTEMPTS,
        codeHash,
        expiresAt
    };
}

const MFA_VERIFICATION_STORE = {
    selectForUpdate: mfaModel.verifyCode,
    clearExpired: mfaModel.verifyCodeQuery2,
    clearLocked: mfaModel.verifyCodeQuery3,
    clearMaxAttempts: mfaModel.verifyCodeQuery4,
    setAttempts: mfaModel.verifyCodeQuery5,
    clearVerified: mfaModel.verifyCodeQuery6
};

const PASSWORD_RESET_VERIFICATION_STORE = {
    selectForUpdate: mfaModel.verifyPasswordResetCode,
    clearExpired: mfaModel.clearPasswordResetCode,
    clearLocked: mfaModel.clearPasswordResetCode,
    clearMaxAttempts: mfaModel.clearPasswordResetCode,
    setAttempts: mfaModel.incrementPasswordResetAttempts,
    clearVerified: mfaModel.clearPasswordResetCode
};

async function verifyChallengeCode(store, userId, submittedCode, sessionHashes = []) {
    const cleanCode = typeof submittedCode === 'string' ? submittedCode.trim() : '';
    const connection = await getConnection();

    try {
        await connection.beginTransaction();

        const [rows] = await store.selectForUpdate([userId], [], connection);

        if (rows.length === 0 || !rows[0].code_hash) {
            if (await matchesAnySessionHash(cleanCode, sessionHashes)) {
                await connection.commit();
                return { status: 'verified', attemptsRemaining: MAX_CODE_ATTEMPTS };
            }
            await connection.rollback();
            return { status: 'not_pending', attemptsRemaining: MAX_CODE_ATTEMPTS };
        }

        const challenge = rows[0];
        if (Number(challenge.attempts) >= MAX_CODE_ATTEMPTS) {
            await store.clearLocked([userId], [], connection);
            await connection.commit();
            return { status: 'locked', attemptsRemaining: 0 };
        }

        const isExpired = challenge.code_expires_at
            ? new Date(challenge.code_expires_at).getTime() <= Date.now()
            : Boolean(challenge.code_expired);

        const matchesSession = await matchesAnySessionHash(cleanCode, sessionHashes);

        if (isExpired && !matchesSession) {
            await store.clearExpired([userId], [], connection);
            await connection.commit();
            return { status: 'expired', attemptsRemaining: MAX_CODE_ATTEMPTS };
        }

        const isDirectMatch = /^\d{6}$/.test(cleanCode) && (await bcrypt.compare(cleanCode, challenge.code_hash) || matchesSession);
        const matches = Boolean(isDirectMatch);

        if (!matches) {
            const nextAttempts = Number(challenge.attempts) + 1;
            if (nextAttempts >= MAX_CODE_ATTEMPTS) {
                await store.clearMaxAttempts([userId], [], connection);
                await connection.commit();
                return { status: 'locked', attemptsRemaining: 0 };
            }

            await store.setAttempts([nextAttempts, userId], [], connection);
            await connection.commit();
            return { status: 'invalid', attemptsRemaining: MAX_CODE_ATTEMPTS - nextAttempts };
        }

        await store.clearVerified([userId], [], connection);

        await connection.commit();
        return { status: 'verified', attemptsRemaining: MAX_CODE_ATTEMPTS };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function verifyCode(userId, submittedCode, sessionHashes = []) {
    return verifyChallengeCode(MFA_VERIFICATION_STORE, userId, submittedCode, sessionHashes);
}

async function verifyPasswordResetCode(userId, submittedCode, sessionHashes = []) {
    return verifyChallengeCode(PASSWORD_RESET_VERIFICATION_STORE, userId, submittedCode, sessionHashes);
}

module.exports = { issueCode, verifyCode, issuePasswordResetCode, verifyPasswordResetCode, RESEND_COOLDOWN_SECONDS };
