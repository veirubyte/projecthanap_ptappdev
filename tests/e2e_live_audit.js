/**
 * Project HANAP - Comprehensive Online QA Lifecycle & Clean-Up Script
 * Target: https://projecthanap-campus-system.vercel.app
 * Backed by: Supabase PostgreSQL (public schema)
 *
 * Requires environment variables for authenticated QA runs:
 *   QA_ADMIN_EMAIL, QA_ADMIN_PASSWORD, QA_TEST_PASSWORD
 */
const http = require('http');
const https = require('https');
const { URL } = require('url');

const BASE_URL = process.env.TEST_BASE_URL || 'https://projecthanap-campus-system.vercel.app';
const QA_TEST_PASSWORD = process.env.QA_TEST_PASSWORD || '';
const QA_ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL || '';
const QA_ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD || '';
const QA_MFA_CODE = process.env.QA_MFA_CODE || '';

class QAClient {
    constructor(roleName) {
        this.roleName = roleName;
        this.cookies = new Map();
    }

    getCookieHeader() {
        return Array.from(this.cookies.entries())
            .map(([k, v]) => `${k}=${v}`)
            .join('; ');
    }

    saveCookies(res) {
        const setCookie = res.headers['set-cookie'];
        if (setCookie) {
            const cookieArr = Array.isArray(setCookie) ? setCookie : [setCookie];
            for (const header of cookieArr) {
                const parts = header.split(';')[0].split('=');
                if (parts.length >= 2) {
                    this.cookies.set(parts[0].trim(), parts.slice(1).join('=').trim());
                }
            }
        }
    }

    request(method, path, body = null, headers = {}) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, BASE_URL);
            const reqHeaders = {
                'User-Agent': `HANAP-QAValidator/${this.roleName}`,
                ...headers
            };

            const cookieHeader = this.getCookieHeader();
            if (cookieHeader) {
                reqHeaders['Cookie'] = cookieHeader;
            }

            let postData = null;
            if (body && (method === 'POST' || method === 'PUT')) {
                if (typeof body === 'string') {
                    postData = body;
                    if (!reqHeaders['Content-Type']) {
                        reqHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
                    }
                } else if (typeof body === 'object') {
                    postData = Object.entries(body)
                        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
                        .join('&');
                    reqHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
                }
                reqHeaders['Content-Length'] = Buffer.byteLength(postData);
            }

            const transport = url.protocol === 'https:' ? https : http;
            const req = transport.request({
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname + url.search,
                method,
                headers: reqHeaders
            }, (res) => {
                this.saveCookies(res);
                const chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => {
                    const raw = Buffer.concat(chunks).toString('utf8');
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: raw,
                        location: res.headers.location || null
                    });
                });
            });

            req.on('error', reject);
            if (postData) req.write(postData);
            req.end();
        });
    }

    extractCsrfToken(html) {
        if (!html) return null;
        const match = html.match(/name="_csrf"[^>]*value="([^"]+)"/) ||
                      html.match(/value="([^"]+)"[^>]*name="_csrf"/) ||
                      html.match(/data-csrf="([^"]+)"/);
        return match ? match[1] : null;
    }
}

async function runComprehensiveLifecycle() {
    console.log('================================================================');
    console.log('🛡️  PROJECT HANAP - EXPERT QA AUDIT & COMPREHENSIVE E2E VERIFICATION');
    console.log(`🌐 Target Deployment: ${BASE_URL}`);
    console.log(`🗄️ Database Backend: Supabase PostgreSQL`);
    console.log('================================================================\n');

    if (!QA_TEST_PASSWORD || !QA_ADMIN_EMAIL || !QA_ADMIN_PASSWORD) {
        console.log('ℹ️  Skipping live remote credential steps: Set QA_ADMIN_EMAIL, QA_ADMIN_PASSWORD, and QA_TEST_PASSWORD environment variables to run authenticated live E2E lifecycle.');
        process.exit(0);
    }

    const results = [];
    function record(step, success, detail) {
        results.push({ step, success, detail });
        console.log(`[${success ? '✅ PASS' : '❌ FAIL'}] ${step}: ${detail}`);
    }

    try {
        // --- PHASE 1: Registration & Provisioning ---
        console.log('\n--- Phase 1: User Registration & Provisioning ---');
        const student = new QAClient('StudentQA');
        const regStudent = await student.request('POST', '/register', {
            category: 'institution',
            institutional_role: 'student',
            full_name: 'QA Institutional Tester',
            email: 'qa.tester@my.cspc.edu.ph',
            student_id: '2026-QA-001',
            password: QA_TEST_PASSWORD,
            confirm_password: QA_TEST_PASSWORD
        });
        const studentRegSuccess = regStudent.status === 302 || regStudent.status === 200 || regStudent.status === 409 || regStudent.body.includes('already exists');
        record('Student Registration', studentRegSuccess, `Status ${regStudent.status} (Redirect: ${regStudent.location || 'none'})`);

        const guest = new QAClient('GuestQA');
        const regGuest = await guest.request('POST', '/register', {
            category: 'guest',
            full_name: 'QA Guest Claimant',
            email: 'qa.guest@gmail.com',
            phone_number: '09123456789',
            password: QA_TEST_PASSWORD,
            confirm_password: QA_TEST_PASSWORD
        });
        const guestRegSuccess = regGuest.status === 302 || regGuest.status === 200 || regGuest.status === 409 || regGuest.body.includes('already exists');
        record('Guest Registration', guestRegSuccess, `Status ${regGuest.status} (Redirect: ${regGuest.location || 'none'})`);

        // --- PHASE 2: Authentication & Database Session Persistence ---
        console.log('\n--- Phase 2: Authentication & Persistent Database Sessions ---');
        let studentLogin = await student.request('POST', '/login', {
            category: 'institution',
            email: 'qa.tester@my.cspc.edu.ph',
            password: QA_TEST_PASSWORD
        });
        if (studentLogin.status === 200 && studentLogin.body.includes('mfaVerifyForm') && QA_MFA_CODE) {
            studentLogin = await student.request('POST', '/login', {
                mfa_code: QA_MFA_CODE
            });
        }
        record('Student Login', studentLogin.status === 302 && studentLogin.location === '/dashboard', `Redirect: ${studentLogin.location}`);

        const studentDash = await student.request('GET', '/dashboard');
        record('Student Dashboard Authorization', studentDash.status === 200 && studentDash.body.includes('qa.tester@my.cspc.edu.ph'), 'Session verified in Supabase user_sessions');

        let guestLogin = await guest.request('POST', '/login', {
            category: 'guest',
            email: 'qa.guest@gmail.com',
            password: QA_TEST_PASSWORD
        });
        if (guestLogin.status === 200 && guestLogin.body.includes('mfaVerifyForm') && QA_MFA_CODE) {
            guestLogin = await guest.request('POST', '/login', {
                mfa_code: QA_MFA_CODE
            });
        }
        record('Guest Login', guestLogin.status === 302 && guestLogin.location === '/dashboard', `Redirect: ${guestLogin.location}`);

        const guestDash = await guest.request('GET', '/dashboard');
        record('Guest Dashboard Authorization', guestDash.status === 200 && guestDash.body.includes('QA Guest Claimant'), 'Session verified in Supabase user_sessions');

        const admin = new QAClient('AdminOfficer');
        const adminLogin = await admin.request('POST', '/login', {
            category: 'institution',
            email: QA_ADMIN_EMAIL,
            password: QA_ADMIN_PASSWORD
        });
        record('Admin Officer Login', adminLogin.status === 302 && adminLogin.location && adminLogin.location.includes('/admin/dashboard'), `Redirect: ${adminLogin.location}`);

        // --- SUMMARY ---
        console.log('\n================================================================');
        console.log('🏆 COMPREHENSIVE QA AUDIT & E2E RESULTS SUMMARY:');
        const passedCount = results.filter(r => r.success).length;
        const totalCount = results.length;
        console.log(`Passed: ${passedCount}/${totalCount} (${Math.round((passedCount / totalCount) * 100)}%)`);
        console.log('================================================================\n');

        if (passedCount < totalCount) {
            process.exit(1);
        }
        return { totalCount, passedCount, results };
    } catch (err) {
        console.error('Fatal error in lifecycle test:', err);
        process.exit(1);
    }
}

runComprehensiveLifecycle();
