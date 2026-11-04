const assert = require('assert');
const crypto = require('crypto');
const {
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
} = require('../services/deviceTrust');

console.log('================================================================');
console.log('🧪 PROJECT HANAP - DEVICE TRUST & 2FA LIFECYCLE UNIT TEST SUITE');
console.log('================================================================\n');

// Mock request / response helpers
function createMockReq(cookieMap = {}) {
    return {
        headers: {
            cookie: Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ')
        },
        cookies: cookieMap
    };
}

function createMockRes() {
    const cookies = new Map();
    return {
        cookie: (name, val, opts) => cookies.set(name, val),
        getHeader: (name) => null,
        setHeader: (name, val) => {},
        _cookies: cookies
    };
}

function runTests() {
    // Test 1: Tamper Protection & Cryptographic Signing
    console.log('--- Test 1: Tamper Protection & Cryptographic Signing ---');
    const secret = getSecret();
    const testPayload = { deviceId: 'test-uuid-1', accounts: { '10': { twoFactorVerifiedAt: Date.now(), lastLoginAt: Date.now() } } };
    const signedCookie = encodeSignedPayload(testPayload, secret);
    const decoded = decodeSignedPayload(signedCookie, secret);
    assert.deepStrictEqual(decoded, testPayload, 'Decoded payload must match original');

    // Tamper with dataPart
    const parts = signedCookie.split('.');
    const tamperedDataPart = Buffer.from(JSON.stringify({ deviceId: 'hacked' })).toString('base64url');
    const tamperedCookie = `${tamperedDataPart}.${parts[1]}`;
    const tamperedResult = decodeSignedPayload(tamperedCookie, secret);
    assert.strictEqual(tamperedResult, null, 'Tampered cookie signature check must fail and return null');
    console.log('✅ PASS: Cryptographic signatures protect device trust tokens from tampering.');

    // Test 2: New Account First Login Requires 2FA
    console.log('\n--- Test 2: New Account First Login Requires 2FA ---');
    const newReq = createMockReq();
    const isNewUserTrusted = isDeviceTrustedForUser(newReq, 999);
    assert.strictEqual(isNewUserTrusted, false, 'New user on this device must not be trusted before 2FA');
    console.log('✅ PASS: Newly created accounts correctly require 2FA on their first login.');

    // Test 3: 2FA Verification Establishes Device Trust
    console.log('\n--- Test 3: 2FA Verification Establishes Device Trust ---');
    const res = createMockRes();
    recordDevice2FaVerification(newReq, res, 999);
    const cookieIssued = res._cookies.get(COOKIE_NAME);
    assert.ok(cookieIssued, 'Device trust cookie must be issued upon 2FA verification');

    // Read cookie back in subsequent request
    const trustedReq = createMockReq({ [COOKIE_NAME]: cookieIssued });
    const isNowTrusted = isDeviceTrustedForUser(trustedReq, 999);
    assert.strictEqual(isNowTrusted, true, 'User must now be trusted on this device within 7 days');
    console.log('✅ PASS: Successful 2FA verification establishes trusted device status.');

    // Test 4: Subsequent Login on SAME Device within 7 Days Bypasses 2FA
    console.log('\n--- Test 4: Subsequent Login on SAME Device within 7 Days Bypasses 2FA ---');
    assert.strictEqual(isDeviceTrustedForUser(trustedReq, 999), true, 'Same device within 7 days skips 2FA');
    const touchRes = createMockRes();
    touchDeviceLogin(trustedReq, touchRes, 999);
    console.log('✅ PASS: Subsequent logins on the same device within 7 days do not show 2FA.');

    // Test 5: Inactivity for 7 Days or More Requires 2FA Again
    console.log('\n--- Test 5: Inactivity for 7 Days or More Requires 2FA Again ---');
    const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000);
    const expiredPayload = {
        deviceId: 'device-1',
        accounts: {
            '999': {
                twoFactorVerifiedAt: eightDaysAgo,
                lastLoginAt: eightDaysAgo // 8 days inactive!
            }
        }
    };
    const expiredCookie = encodeSignedPayload(expiredPayload, secret);
    const expiredReq = createMockReq({ [COOKIE_NAME]: expiredCookie });
    const isExpiredTrusted = isDeviceTrustedForUser(expiredReq, 999);
    assert.strictEqual(isExpiredTrusted, false, 'Inactivity for 7 days or more must require 2FA again');
    console.log('✅ PASS: Inactivity for 7 days or more correctly re-enforces Two-Factor Authentication.');

    // Test 6: Cross-Account Device Isolation
    console.log('\n--- Test 6: Cross-Account Device Isolation ---');
    // Account 999 is trusted on this device, but new Account 888 logs into the same device
    const isAccount888Trusted = isDeviceTrustedForUser(trustedReq, 888);
    assert.strictEqual(isAccount888Trusted, false, 'Different account on same device must require 2FA until it verifies');
    console.log('✅ PASS: Device trust is strictly isolated per user credential.');

    // Test 7: Different Device (Missing Cookie) Requires 2FA
    console.log('\n--- Test 7: Different Device (Missing Cookie) Requires 2FA ---');
    const differentDeviceReq = createMockReq({});
    assert.strictEqual(isDeviceTrustedForUser(differentDeviceReq, 999), false, 'Different device without cookie requires 2FA');
    console.log('✅ PASS: Logging in from a different device correctly requires Two-Factor Authentication.');

    console.log('\n================================================================');
    console.log('🏆 ALL DEVICE TRUST & 2FA LIFECYCLE UNIT TESTS PASSED (7/7)');
    console.log('================================================================');
}

runTests();

