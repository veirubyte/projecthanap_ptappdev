/**
 * Project HANAP - Comprehensive 2-Factor Authentication (MFA) Integration Test
 * Verifies both:
 * 1. Initial login form 2FA input area
 * 2. In-card 2FA verification stepper when MFA is triggered
 * 3. Cancel / reset stepper functionality
 * 4. Settings MFA management
 */
const { URL } = require('url');
const http = require('http');
const https = require('https');

const BASE_URL = process.env.TEST_BASE_URL || 'https://projecthanap-campus-system.vercel.app';

class TestClient {
  constructor(name) {
    this.name = name;
    this.cookies = new Map();
  }

  request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, BASE_URL);
      const headers = { 'User-Agent': `HANAP-MFATest/${this.name}` };
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
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
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

  // Test 1: Verify Initial Login Form has 2FA input area
  console.log('--- Step 1: Initial Sign-in Portal Inspection ---');
  const loginGet = await client.request('GET', '/login');
  const has2FaLabel = loginGet.body.includes('Two-Factor Authentication (2FA)');
  const hasInitial2FaInput = loginGet.body.includes('id="mfaCodeInitial"') && loginGet.body.includes('name="mfa_code"');
  console.log(`[${has2FaLabel && hasInitial2FaInput ? '✅ PASS' : '❌ FAIL'}] Initial 2FA Input Area on Sign-in Page:`, has2FaLabel && hasInitial2FaInput);

  // Test 2: Register test user
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

  // Test 3: Log in before MFA
  console.log('\n--- Step 3: Initial Login Prior to Enabling MFA ---');
  const initialLogin = await client.request('POST', '/login', {
    category: 'institution',
    email: testEmail,
    password: testPassword
  });
  console.log(`[${initialLogin.status === 302 && initialLogin.headers.location === '/dashboard' ? '✅ PASS' : '❌ FAIL'}] Initial Login: Redirect to ${initialLogin.headers.location}`);

  // Test 4: Enable Email MFA in Settings
  console.log('\n--- Step 4: Enable Email MFA in Account Settings ---');
  const settingsGet = await client.request('GET', '/settings');
  const csrf = client.extractCsrfToken(settingsGet.body);
  const enableRes = await client.request('POST', '/settings/mfa/enable', {
    _csrf: csrf || '',
    current_password: testPassword
  });
  console.log(`[${enableRes.status === 302 && enableRes.headers.location.includes('#security') ? '✅ PASS' : '❌ FAIL'}] Enable MFA in Settings: Status ${enableRes.status}`);

  // Test 5: Logout
  console.log('\n--- Step 5: Terminate Session (Logout) ---');
  const logoutRes = await client.request('GET', '/logout');
  console.log(`[${logoutRes.status === 302 ? '✅ PASS' : '❌ FAIL'}] Logout: Status ${logoutRes.status}`);

  // Test 6: Sign in with MFA enabled -> Triggers 2FA verification stepper inside card
  console.log('\n--- Step 6: Sign In with MFA Enabled (Trigger 2FA Step) ---');
  const mfaStep = await client.request('POST', '/login', {
    category: 'institution',
    email: testEmail,
    password: testPassword
  });
  const hasMfaVerifyForm = mfaStep.body.includes('id="mfaVerifyForm"');
  const hasMfaCode = mfaStep.body.includes('id="mfaCode"');
  const hasAttempts = mfaStep.body.includes('mfaAttemptsRemaining');
  const hasBackToSignIn = mfaStep.body.includes('Back to Sign In');
  const hasResend = mfaStep.body.includes('mfaResendButton');

  console.log(`[${mfaStep.status === 200 ? '✅ PASS' : '❌ FAIL'}] 2FA Step Status: ${mfaStep.status}`);
  console.log(`[${hasMfaVerifyForm ? '✅ PASS' : '❌ FAIL'}] In-Card 2FA Verification Form:`, hasMfaVerifyForm);
  console.log(`[${hasMfaCode ? '✅ PASS' : '❌ FAIL'}] 6-Digit MFA Input Area:`, hasMfaCode);
  console.log(`[${hasAttempts ? '✅ PASS' : '❌ FAIL'}] Remaining Attempts Counter:`, hasAttempts);
  console.log(`[${hasBackToSignIn ? '✅ PASS' : '❌ FAIL'}] "Back to Sign In" Action:`, hasBackToSignIn);
  console.log(`[${hasResend ? '✅ PASS' : '❌ FAIL'}] Resend Code Button & Countdown:`, hasResend);

  // Test 7: Reset / Cancel 2FA Stepper
  console.log('\n--- Step 7: Cancel / Reset 2FA Stepper Navigation ---');
  const cancelRes = await client.request('GET', '/login?reset_mfa=1');
  const returnedToInitial = cancelRes.body.includes('id="loginForm"') && cancelRes.body.includes('id="mfaCodeInitial"');
  console.log(`[${returnedToInitial ? '✅ PASS' : '❌ FAIL'}] Reset MFA Stepper and Returned to Initial Login:`, returnedToInitial);

  console.log('\n================================================================');
  console.log('🏆 2-FACTOR AUTHENTICATION INTEGRATION SUITE COMPLETE');
  console.log('================================================================');
}

runMfaVerificationSuite().catch((err) => {
  console.error('MFA Suite execution error:', err);
  process.exit(1);
});
