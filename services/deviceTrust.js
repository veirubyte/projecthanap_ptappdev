const crypto = require('crypto');

const COOKIE_NAME = 'hanap_device_trust';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const RUNTIME_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

function getSecret() {
    const configuredSecret = String(process.env.SESSION_SECRET || '').trim();
    if (configuredSecret) return configuredSecret;
    if (process.env.NODE_ENV === 'production') {
        throw new Error('SESSION_SECRET environment variable must be configured in production.');
    }
    return RUNTIME_FALLBACK_SECRET;
}

function parseCookieHeader(cookieHeader, name) {
    if (!cookieHeader || typeof cookieHeader !== 'string') return null;
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
        const [k, ...rest] = cookie.trim().split('=');
        if (k === name) {
            return decodeURIComponent(rest.join('='));
        }
    }
    return null;
}

function decodeSignedPayload(cookieVal, secret) {
    if (!cookieVal || typeof cookieVal !== 'string') return null;
    const parts = cookieVal.split('.');
    if (parts.length !== 2) return null;
    const [dataPart, signature] = parts;

    try {
        const expectedSig = crypto.createHmac('sha256', secret).update(dataPart).digest('base64url');
        const sigBuf = Buffer.from(signature);
        const expBuf = Buffer.from(expectedSig);
        if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
            return null;
        }

        const json = Buffer.from(dataPart, 'base64url').toString('utf8');
        return JSON.parse(json);
    } catch (_) {
        return null;
    }
}

function encodeSignedPayload(payload, secret) {
    const dataPart = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(dataPart).digest('base64url');
    return `${dataPart}.${signature}`;
}

function getDeviceTrust(req) {
    if (!req) return { deviceId: crypto.randomUUID(), accounts: {} };

    let rawCookie = null;
    if (req.cookies && req.cookies[COOKIE_NAME]) {
        rawCookie = req.cookies[COOKIE_NAME];
    } else if (req.headers && req.headers.cookie) {
        rawCookie = parseCookieHeader(req.headers.cookie, COOKIE_NAME);
    }

    const payload = decodeSignedPayload(rawCookie, getSecret());
    if (payload && payload.deviceId && typeof payload.accounts === 'object') {
        return payload;
    }

    return {
        deviceId: crypto.randomUUID(),
        accounts: {}
    };
}

function setDeviceTrustCookie(res, trust) {
    if (!res) return;
    const signedValue = encodeSignedPayload(trust, getSecret());
    const isProduction = process.env.NODE_ENV === 'production';

    if (typeof res.cookie === 'function') {
        res.cookie(COOKIE_NAME, signedValue, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: ONE_YEAR_MS,
            path: '/'
        });
    } else if (typeof res.setHeader === 'function') {
        const cookieString = `${COOKIE_NAME}=${encodeURIComponent(signedValue)}; Path=/; Max-Age=${Math.floor(ONE_YEAR_MS / 1000)}; HttpOnly; SameSite=Lax${isProduction ? '; Secure' : ''}`;
        const existing = res.getHeader('Set-Cookie');
        if (existing) {
            const cookies = Array.isArray(existing) ? existing.concat(cookieString) : [existing, cookieString];
            res.setHeader('Set-Cookie', cookies);
        } else {
            res.setHeader('Set-Cookie', cookieString);
        }
    }
}

/**
 * Check if the current device is already trusted for a given user credential.
 * Requires:
 * 1. The account has completed 2FA on this device at least once (twoFactorVerifiedAt exists).
 * 2. The user has logged in from this device within the last 7 days.
 */
function isDeviceTrustedForUser(req, userId) {
    if (!userId) return false;
    const trust = getDeviceTrust(req);
    const account = trust.accounts && trust.accounts[String(userId)];
    if (!account) return false;
    if (!account.twoFactorVerifiedAt) return false;

    const lastLoginAt = Number(account.lastLoginAt || 0);
    const timeSinceLastLogin = Date.now() - lastLoginAt;
    if (timeSinceLastLogin >= SEVEN_DAYS_MS) {
        return false; // Inactive for 7 days or more -> require 2FA again
    }

    return true;
}

/**
 * Record successful 2FA verification for this user on this device.
 */
function recordDevice2FaVerification(req, res, userId) {
    if (!userId) return;
    const trust = getDeviceTrust(req);
    if (!trust.accounts) trust.accounts = {};
    const now = Date.now();
    trust.accounts[String(userId)] = {
        twoFactorVerifiedAt: now,
        lastLoginAt: now
    };
    setDeviceTrustCookie(res, trust);
}

/**
 * Update the last login timestamp for an already trusted device.
 */
function touchDeviceLogin(req, res, userId) {
    if (!userId) return;
    const trust = getDeviceTrust(req);
    if (!trust.accounts) trust.accounts = {};
    if (trust.accounts[String(userId)]) {
        trust.accounts[String(userId)].lastLoginAt = Date.now();
        setDeviceTrustCookie(res, trust);
    }
}

module.exports = {
    COOKIE_NAME,
    SEVEN_DAYS_MS,
    getDeviceTrust,
    setDeviceTrustCookie,
    isDeviceTrustedForUser,
    recordDevice2FaVerification,
    touchDeviceLogin,
    encodeSignedPayload,
    decodeSignedPayload,
    getSecret
};

