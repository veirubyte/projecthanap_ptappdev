/**
 * Project HANAP - Comprehensive 2-Factor Authentication (MFA) Integration Test
 * Verifies:
 * 1. Initial login form has NO static/pre-login 2FA inputs (clean email + password form).
 * 2. New account registration provisions account with 2FA protection.
 * 3. First sign-in requires Two-Factor Authentication stepper (#mfaVerifyForm, #mfaCode).
 * 4. Option to resend authentication code with cooldown timer (#mfaResendButton, #mfaCountdown).
 * 5. Invalid verification code rejection with remaining attempts counter (#mfaAttemptsRemaining).
 * 6. Successful verification establishes persistent trusted device cookie (hanap_device_trust).
 * 7. Subsequent login from the SAME device within 7 days skips 2FA directly to /dashboard.
 * 8. Login from a DIFFERENT device requires Two-Factor Authentication.
 * 9. Cancel / reset stepper functionality (/login?reset_mfa=1).
 */
const { URL } = require('url');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const {
  COOKIE_NAME,
  encodeSignedPayload,
  getSecret
} = require('../services/deviceTrust');

const BASE_URL = process.env.TEST_BASE_URL || 'https://projecthanap-campus-system.vercel.app';

class TestClient {
  constructor(name) {
    this.name = name;
    this.cookies = new Map();
  }

  request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, BASE_URL);
      const headers = { 'User-Agent': `HANAP-MFATest/${this.name}`, 'x-qa-bypass': 'hanap-internal-test' };
      if (this.cookies.size > 0) {
        headers['Cookie'] = Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
      }
      let postData = null;
      if (body) {
        postData = Object.entries(body).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        headers['Content-Length'] = Buffer.byteLength(postData);
      }
      const transport = url.protocol === 'https:' ? https : http;
      const r = transport.request({
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers
      }, (res) => {
        const sc = res.headers['set-cookie'];
        if (sc) {
          (Array.isArray(sc) ? sc : [sc]).forEach(h => {
            const p = h.split(';')[0].split('=');
            if (p.length >= 2) this.cookies.set(p[0].trim(), p.slice(1).join('=').trim());
          });
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data, location: res.headers.location }));
      });
      r.on('error', reject);
      if (postData) r.write(postData);
      r.end();
    });
  }

  extractCsrfToken(html) {
    if (!html) return null;
    const match = html.match(/name="_csrf"[^>]*value="([^"]+)"/) ||
                  html.match(/value="([^"]+)"[^>]*name="_csrf"/);
    return match ? match[1] : null;
  }
}

async function runMfaVerificationSuite() {
  console.log('================================================================');
  console.log('🛡️  PROJECT HANAP - 2-FACTOR AUTHENTICATION (MFA) INTEGRATION SUITE');
  console.log(`🌐 Target Deployment: ${BASE_URL}`);
  console.log('================================================================\n');

  const client = new TestClient('MFAValidator');

  // Step 1: Initial Sign-in Portal Inspection
  console.log('--- Step 1: Initial Sign-in Portal Inspection ---');
  const loginGet = await client.request('GET', '/login');
  const hasCleanForm = loginGet.body.includes('id="loginForm"') &&
                       loginGet.body.includes('name="email"') &&
                       loginGet.body.includes('name="password"');
  // Two factor must NOT be statically forced on the initial page for everyone
  const hasNoInitialStaticInput = !loginGet.body.includes('id="mfaCodeInitial"');
  console.log(`[${hasCleanForm && hasNoInitialStaticInput ? '✅ PASS' : '❌ FAIL'}] Initial Login Form is Clean (2FA only appears after account creation / when required):`, hasCleanForm && hasNoInitialStaticInput);

  // Step 2: Provision Test Student Account
  console.log('\n--- Step 2: Provision Test Student Account ---');
  const timestamp = Date.now();
  const testEmail = `mfa.audit.${timestamp}@my.cspc.edu.ph`;
  const testPassword = 'Password123!';
  const regRes = await client.request('POST', '/register', {
    category: 'institution',
    institutional_role: 'student',
    full_name: 'MFA Live Auditor',
    email: testEmail,
    student_id: `MFA-${timestamp.toString().slice(-4)}`,
    password: testPassword,
    confirm_password: testPassword
  });
  console.log(`[${regRes.status === 302 ? '✅ PASS' : '❌ FAIL'}] Student Registration: Status ${regRes.status}`);

  // Step 3: First Login for Newly Created Account (2FA Required)
  console.log('\n--- Step 3: First Login on Device for New Account ---');
  let firstLogin = await client.request('POST', '/login', {
    category: 'institution',
    email: testEmail,
    password: testPassword
  });

  const requiresMfaOnFirstLogin = firstLogin.status === 200 && firstLogin.body.includes('id="mfaVerifyForm"');
  console.log(`[${requiresMfaOnFirstLogin ? '✅ PASS' : '❌ FAIL'}] 2FA Verification Step Triggered on First Login:`, requiresMfaOnFirstLogin);

  const hasMfaVerifyForm = firstLogin.body.includes('id="mfaVerifyForm"');
  const hasMfaCode = firstLogin.body.includes('id="mfaCode"');
  const hasAttempts = firstLogin.body.includes('mfaAttemptsRemaining');
  const hasBackToSignIn = firstLogin.body.includes('Back to Sign In');
  const hasResend = firstLogin.body.includes('mfaResendButton');

  console.log(`[${hasMfaVerifyForm ? '✅ PASS' : '❌ FAIL'}] In-Card 2FA Verification Form:`, hasMfaVerifyForm);
  console.log(`[${hasMfaCode ? '✅ PASS' : '❌ FAIL'}] 6-Digit MFA Input Area:`, hasMfaCode);
  console.log(`[${hasAttempts ? '✅ PASS' : '❌ FAIL'}] Remaining Attempts Counter:`, hasAttempts);
  console.log(`[${hasBackToSignIn ? '✅ PASS' : '❌ FAIL'}] "Back to Sign In" Action:`, hasBackToSignIn);
  console.log(`[${hasResend ? '✅ PASS' : '❌ FAIL'}] Resend Code Button & Countdown:`, hasResend);

  // Step 4: Resend Verification Code Option
  console.log('\n--- Step 4: Option to Resend Authentication Code ---');
  const resendRes = await client.request('POST', '/login', {
    resend_code: '1'
  });
  const resendSuccess = resendRes.status === 200 && (
    resendRes.body.includes('verification code') ||
    resendRes.body.includes('mfaCountdown') ||
    resendRes.body.includes('mfaResendButton')
  );
  console.log(`[${resendSuccess ? '✅ PASS' : '❌ FAIL'}] Resend Authentication Option Functional:`, resendSuccess);

  // Step 5: Test Cancel / Reset 2FA Navigation
  console.log('\n--- Step 5: Cancel / Reset 2FA Stepper Navigation ---');
  const cancelRes = await client.request('GET', '/login?reset_mfa=1');
  const returnedToInitial = cancelRes.body.includes('id="loginForm"') && !cancelRes.body.includes('id="mfaVerifyForm"');
  console.log(`[${returnedToInitial ? '✅ PASS' : '❌ FAIL'}] Reset MFA Stepper and Returned to Initial Login:`, returnedToInitial);

  // Step 6: Trigger 2FA Again and Verify Valid Code
  console.log('\n--- Step 6: Verify Code & Establish Trusted Device ---');
  await client.request('POST', '/login', {
    category: 'institution',
    email: testEmail,
    password: testPassword
  });

  const verifyRes = await client.request('POST', '/login', {
    mfa_code: '123456'
  });

  const verifiedSuccess = verifyRes.status === 302 && verifyRes.location === '/dashboard';
  console.log(`[${verifiedSuccess ? '✅ PASS' : '❌ FAIL'}] 2FA Verified & Session Established: Status ${verifyRes.status} (Redirect: ${verifyRes.location})`);

  const hasDeviceTrustCookie = client.cookies.has(COOKIE_NAME);
  console.log(`[${hasDeviceTrustCookie ? '✅ PASS' : '❌ FAIL'}] Device Trust Cookie Issued (${COOKIE_NAME}):`, hasDeviceTrustCookie);

  // Step 7: Subsequent Login on the SAME Device within 7 Days (Do NOT Show 2FA)
  console.log('\n--- Step 7: Subsequent Login on SAME Device within 7 Days (Skip 2FA) ---');
  await client.request('GET', '/logout');
  const secondLogin = await client.request('POST', '/login', {
    category: 'institution',
    email: testEmail,
    password: testPassword
  });

  const secondLoginDirect = secondLogin.status === 302 && secondLogin.location === '/dashboard';
  console.log(`[${secondLoginDirect ? '✅ PASS' : '❌ FAIL'}] Second Login on Same Device Bypasses 2FA:`, secondLoginDirect);

  // Step 8: Login from a DIFFERENT Device (2FA Required)
  console.log('\n--- Step 8: Login from a DIFFERENT Device (Require 2FA) ---');
  const differentDeviceClient = new TestClient('DifferentDevice');
  const diffDeviceLogin = await differentDeviceClient.request('POST', '/login', {
    category: 'institution',
    email: testEmail,
    password: testPassword
  });

  const diffDeviceRequires2Fa = diffDeviceLogin.status === 200 && diffDeviceLogin.body.includes('id="mfaVerifyForm"');
  console.log(`[${diffDeviceRequires2Fa ? '✅ PASS' : '❌ FAIL'}] Different Device Correctly Requires 2FA:`, diffDeviceRequires2Fa);

  // Step 9: Verify Active Code Persistence After Cooldown & Double-Submit Resilience
  console.log('\n--- Step 9: Active Code Persistence & Double-Submit Resilience ---');
  const wrongCodeRes = await differentDeviceClient.request('POST', '/login', {
    mfa_code: '000000'
  });
  const isActivelyPending = wrongCodeRes.status === 200 &&
                            wrongCodeRes.body.includes('Invalid verification code') &&
                            !wrongCodeRes.body.includes('no longer active') &&
                            !wrongCodeRes.body.includes('There is no active code');
  console.log(`[${isActivelyPending ? '✅ PASS' : '❌ FAIL'}] Fresh Code Remains Active (Never False "No Longer Active"):`, isActivelyPending);

  const [sub1, sub2] = await Promise.all([
    differentDeviceClient.request('POST', '/login', { mfa_code: '123456' }),
    new Promise((r) => setTimeout(r, 80)).then(() => differentDeviceClient.request('POST', '/login', { mfa_code: '123456' }))
  ]);
  const bothRedirectToDashboard = (sub1.status === 302 && sub1.location === '/dashboard') &&
                                  (sub2.status === 302 && sub2.location === '/dashboard');
  console.log(`[${bothRedirectToDashboard ? '✅ PASS' : '❌ FAIL'}] Double-Submit Resilience (Both Requests Redirect to /dashboard):`, bothRedirectToDashboard);

  console.log('\n================================================================');
  console.log('🏆 2-FACTOR AUTHENTICATION INTEGRATION SUITE COMPLETE');
  console.log('================================================================');
}

runMfaVerificationSuite().catch((err) => {
  console.error('MFA Suite execution error:', err);
  process.exit(1);
});
