const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const ejs = require('ejs');
const bcrypt = require('bcrypt');

const pool = require('../config/db');
const roles = require('../config/roles');
const { timingSafeMatch } = require('../config/security');
const DatabaseSessionStore = require('../config/sessionStore');
const { reportUploadBeforeCsrf } = require('../middleware/reportUpload');
const mfaService = require('../services/mfa');
const userModel = require('../models/userModel');
const claimModel = require('../models/claimModel');
const itemReportModel = require('../models/itemReportModel');
const itemController = require('../controllers/itemController');

const ROOT_DIR = path.resolve(__dirname, '..');
const VIEWS_DIR = path.join(ROOT_DIR, 'views');
const PAGES_DIR = path.join(VIEWS_DIR, 'pages');
const UPLOAD_DIR = process.env.VERCEL
    ? path.join('/tmp', 'uploads')
    : path.join(ROOT_DIR, 'public', 'uploads');

function createMockRes() {
    return {
        statusCode: 200,
        redirectUrl: null,
        renderedView: null,
        renderedLocals: null,
        headers: {},
        setHeader(k, v) {
            this.headers[k] = v;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        redirect(url) {
            this.redirectUrl = url;
            return this;
        },
        render(view, locals) {
            this.renderedView = view;
            this.renderedLocals = locals;
            return this;
        },
        json(payload) {
            this.jsonPayload = payload;
            return this;
        }
    };
}

function sendMultipartUpload(port, csrfValue, fileBuffer, filename = 'probe.png') {
    return new Promise((resolve, reject) => {
        const boundary = '----HanapOverhaulTestBoundary987654';
        const parts = [];
        if (csrfValue !== null) {
            parts.push(Buffer.from(
                `--${boundary}\r\n` +
                `Content-Disposition: form-data; name="_csrf"\r\n\r\n` +
                `${csrfValue}\r\n`
            ));
        }
        parts.push(Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="photos"; filename="${filename}"\r\n` +
            `Content-Type: image/png\r\n\r\n`
        ));
        parts.push(fileBuffer);
        parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
        const body = Buffer.concat(parts);

        const req = http.request({
            hostname: '127.0.0.1',
            port,
            path: '/items/report',
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': body.length
            }
        }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: Buffer.concat(chunks).toString('utf8')
                });
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function runOverhaulRegressionSuite() {
    console.log('================================================================');
    console.log('🧪 PROJECT HANAP - SYSTEM OVERHAUL REGRESSION TEST SUITE');
    console.log('================================================================\n');

    // 1. 4-Role Architecture & Guardian Removal
    console.log('--- Test 1: 4-Role Architecture & Guardian Removal ---');
    assert.strictEqual(roles.normalizeRole('parent'), 'guest', 'Legacy parent role must normalize to guest');
    assert.strictEqual(roles.normalizeRole('guardian'), 'guest', 'Guardian alias must normalize to guest');
    assert.strictEqual(roles.normalizeRole('parent/guest'), 'guest', 'parent/guest alias must normalize to guest');
    assert.strictEqual(roles.normalizeRole('administrator'), 'admin', 'administrator alias must normalize to admin');
    assert.strictEqual(roles.isGuest({ role: 'parent' }), true, 'isGuest must match normalized parent role');
    assert.strictEqual(
        fs.existsSync(path.join(ROOT_DIR, 'models', 'guardianLinkModel.js')),
        false,
        'guardianLinkModel.js must be deleted'
    );
    const routesSrc = fs.readFileSync(path.join(ROOT_DIR, 'routes', 'itemRoutes.js'), 'utf8');
    assert(!routesSrc.includes('guardian-links'), 'itemRoutes.js must not expose guardian-links endpoints');
    assert(!routesSrc.includes('test-403'), 'itemRoutes.js must not expose /admin/test-403');
    console.log('✅ PASS: 4-role normalization, guardian removal, and route cleanup verified.');

    // 2. Staff Department Editability & Notification Settings Persistence
    console.log('\n--- Test 2: Staff Department Edit & Notification Preferences ---');
    const origExec2 = pool.execute;
    const origQuery2 = pool.query;
    const origConn2 = pool.getConnection;
    const origUpdateProfile = userModel.updateProfile;
    const origUpdateProfileQuery3 = userModel.updateProfileQuery3;
    const origUpdateProfileQuery4 = userModel.updateProfileQuery4;
    const origUpdateNotify = userModel.updateNotificationSettings;
    let savedDeptName = null;
    let savedUpdateArgs = null;
    let savedNotifyArgs = null;
    let activeRole = 'staff';
    try {
        const mockProfileDb = async (sql, params = []) => {
            if (sql.includes('FROM departments')) {
                return [[]];
            }
            if (sql.includes('INSERT INTO departments')) {
                savedDeptName = params[0];
                return [{ insertId: 9 }];
            }
            if (sql.includes('UPDATE users') && sql.includes('department_id')) {
                savedUpdateArgs = params;
                return [{ affectedRows: 1 }];
            }
            if (sql.includes('notify_claims')) {
                savedNotifyArgs = params;
                return [{ affectedRows: 1 }];
            }
            return [{ affectedRows: 1, insertId: 1 }];
        };
        pool.execute = mockProfileDb;
        pool.query = mockProfileDb;
        pool.getConnection = async () => ({
            execute: mockProfileDb,
            query: mockProfileDb,
            beginTransaction: async () => {},
            commit: async () => {},
            rollback: async () => {},
            release: () => {}
        });

        userModel.updateProfile = async () => [[{
            role_code: activeRole,
            email: activeRole === 'staff' ? 'staff@cspc.edu.ph' : 'visitor@gmail.com',
            student_id: activeRole === 'staff' ? 'EMP-101' : null,
            department_id: activeRole === 'staff' ? 2 : null
        }]];
        userModel.updateProfileQuery3 = async ([dept]) => {
            savedDeptName = dept;
            return [{ insertId: 9 }];
        };
        userModel.updateProfileQuery4 = async (args) => {
            savedUpdateArgs = args;
            return [{ affectedRows: 1 }];
        };

        const staffReq = {
            session: { user: { id: 12, full_name: 'Staff Member', email: 'staff@cspc.edu.ph', role: 'staff', student_id: 'EMP-101' } },
            body: { full_name: 'Staff Member', phone_number: '09171234567', department: 'College of Computer Studies' }
        };
        const staffRes = createMockRes();
        await itemController.updateProfile(staffReq, staffRes);
        assert.strictEqual(savedDeptName, 'College of Computer Studies', 'Staff must be allowed to update department');
        assert.strictEqual(savedUpdateArgs[3], 9, 'Staff department_id must persist to users update');
        assert(staffRes.redirectUrl && staffRes.redirectUrl.includes('msg='), 'Staff profile update must succeed with redirect msg');

        // Guest cannot set department
        activeRole = 'guest';
        savedDeptName = null;
        savedUpdateArgs = null;
        const guestReq = {
            session: { user: { id: 13, full_name: 'Campus Visitor', email: 'visitor@gmail.com', role: 'guest' } },
            body: { full_name: 'Campus Visitor', phone_number: '09170001111', department: 'Attempted Override' }
        };
        const guestRes = createMockRes();
        await itemController.updateProfile(guestReq, guestRes);
        assert.strictEqual(savedDeptName, null, 'Guest must not create or assign department');
        assert.strictEqual(savedUpdateArgs[3], null, 'Guest department_id must remain null');

        userModel.updateNotificationSettings = async (args) => {
            savedNotifyArgs = args;
            return [{ affectedRows: 1 }];
        };
        const notifyReq = {
            session: { user: { id: 12, role: 'staff' } },
            body: {} // all checkboxes unchecked -> 0, 0, 0
        };
        const notifyRes = createMockRes();
        await itemController.updateNotificationSettings(notifyReq, notifyRes);
        assert.deepStrictEqual(savedNotifyArgs, [0, 0, 0, 12], 'Notification toggles must persist to database');
        assert(notifyRes.redirectUrl && notifyRes.redirectUrl.includes('msg='), `Notification settings must redirect with success msg, got: ${notifyRes.redirectUrl}`);
    } finally {
        pool.execute = origExec2;
        pool.query = origQuery2;
        pool.getConnection = origConn2;
        userModel.updateProfile = origUpdateProfile;
        userModel.updateProfileQuery3 = origUpdateProfileQuery3;
        userModel.updateProfileQuery4 = origUpdateProfileQuery4;
        userModel.updateNotificationSettings = origUpdateNotify;
    }
    console.log('✅ PASS: Staff department editability, Guest lock, and notification persistence work.');

    // 3. Timing-Safe Comparison & reportUpload CSRF Ordering + Unlink
    console.log('\n--- Test 3: Timing-Safe Tokens & Upload CSRF Before detectImageType ---');
    assert.strictEqual(timingSafeMatch('token-123', 'token-123'), true);
    assert.strictEqual(timingSafeMatch('token-123', 'token-124'), false);
    assert.strictEqual(timingSafeMatch('short', 'longer'), false);

    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const beforeFiles = new Set(fs.readdirSync(UPLOAD_DIR));
    let nextCalled = false;
    let uploadedTempPath = null;

    const uploadServer = http.createServer((req, res) => {
        req.session = { user: { id: 2, role: 'student' }, csrfToken: 'expected-csrf-token' };
        req.originalUrl = req.url;
        req.path = req.url.split('?')[0];
        req.query = {};
        res.status = (code) => {
            res.statusCode = code;
            return res;
        };
        res.redirect = (loc) => {
            res.statusCode = 302;
            res.setHeader('Location', loc);
            res.end();
        };
        res.render = (view, locals) => {
            res.setHeader('X-Rendered-View', view);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ view, errorTitle: locals && locals.errorTitle }));
        };

        reportUploadBeforeCsrf(req, res, () => {
            nextCalled = true;
            const uploaded = (req.files || [])[0] || null;
            uploadedTempPath = uploaded ? uploaded.path : null;
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                ok: true,
                hasBase64: Boolean(uploaded && uploaded.base64Data && uploaded.base64Data.startsWith('data:image/png;base64,'))
            }));
        });
    });

    await new Promise((resolve) => uploadServer.listen(0, '127.0.0.1', resolve));
    const port = uploadServer.address().port;
    try {
        // Upload garbage .png bytes with invalid CSRF: must fail 403 BEFORE detectImageType
        const invalidCsrfResp = await sendMultipartUpload(port, 'wrong-csrf-token', Buffer.from('not-a-valid-png-header'));
        assert.strictEqual(invalidCsrfResp.status, 403, 'Invalid CSRF upload must return 403 before detectImageType redirect');
        assert.strictEqual(invalidCsrfResp.headers['x-rendered-view'], '403', 'Must render 403 view directly');
        assert.strictEqual(nextCalled, false, 'next() must never run when CSRF fails');

        const afterBadFiles = fs.readdirSync(UPLOAD_DIR).filter((f) => !beforeFiles.has(f));
        assert.strictEqual(afterBadFiles.length, 0, 'Invalid CSRF upload must unlink temp files from disk');

        // Upload valid 1x1 PNG with valid CSRF
        const minimalPng = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            'base64'
        );
        const validCsrfResp = await sendMultipartUpload(port, 'expected-csrf-token', minimalPng, 'valid.png');
        assert.strictEqual(validCsrfResp.status, 200, 'Valid CSRF + valid PNG upload must succeed');
        const parsed = JSON.parse(validCsrfResp.body);
        assert.strictEqual(parsed.hasBase64, true, 'Valid upload must produce base64Data');
    } finally {
        await new Promise((resolve) => uploadServer.close(resolve));
        if (uploadedTempPath && fs.existsSync(uploadedTempPath)) {
            fs.unlinkSync(uploadedTempPath);
        }
    }
    console.log('✅ PASS: reportUpload runs CSRF check before detectImageType and unlinks rejected files cleanly.');

    // 4. Separate password_resets & Session Revocation
    console.log('\n--- Test 4: password_resets Isolation & Session Store Revocation ---');
    const origExecute = pool.execute;
    const origQuery = pool.query;
    const origConn4 = pool.getConnection;
    const resetOtpHash = await bcrypt.hash('654321', 10);
    try {
        const mockResetDb = async (sql) => {
            assert(!sql.includes('user_mfa'), 'Password reset verification must never touch user_mfa table');
            if (sql.includes('FROM password_resets')) {
                return [[{
                    user_id: 99,
                    code_hash: resetOtpHash,
                    code_expires_at: new Date(Date.now() + 300000).toISOString(),
                    code_expired: 0,
                    attempts: 0
                }]];
            }
            return [{ affectedRows: 1 }];
        };
        pool.execute = mockResetDb;
        pool.query = mockResetDb;
        pool.getConnection = async () => ({
            execute: mockResetDb,
            query: mockResetDb,
            beginTransaction: async () => {},
            commit: async () => {},
            rollback: async () => {},
            release: () => {}
        });

        const verifyRes = await mfaService.verifyPasswordResetCode(99, '654321');
        assert.strictEqual(verifyRes.status, 'verified', 'Password reset code must verify strictly against password_resets');

        const sessionQueries = [];
        pool.query = async (sql, params) => {
            sessionQueries.push({ sql, params });
            if (sql.trim().toUpperCase().startsWith('SELECT')) {
                return [[{ sid: 'sess-u77', sess: JSON.stringify({ user: { id: 77 } }) }]];
            }
            return [{ affectedRows: 1 }];
        };
        pool.execute = pool.query;
        await DatabaseSessionStore.destroyUserSessionsForUser(77);
        assert(sessionQueries.some((q) => q.sql.includes('DELETE FROM user_sessions') || q.sql.includes('FROM user_sessions')), 'Session revocation must query and delete user_sessions');
        assert(sessionQueries.some((q) => Array.isArray(q.params) && q.params.some((p) => String(p) === '77')), 'Session revocation must target user id 77');
    } finally {
        pool.execute = origExecute;
        pool.query = origQuery;
        pool.getConnection = origConn4;
    }
    console.log('✅ PASS: password_resets isolation and multi-session revocation verified.');

    // 5. Claim Quota Cap, Chat Lock, Phone Masking, Custody Guard & Quota Reset Note
    console.log('\n--- Test 5: Claims Quota Cap, Chat Lock, Phone Masking & Custody Guard ---');
    const origExec5 = pool.execute;
    const origQuery5 = pool.query;
    const origConn5 = pool.getConnection;
    const origItemCreateClaim = itemReportModel.createClaim;
    const origClaimCreateClaim = claimModel.createClaim;
    const origCountPending = claimModel.countActivePendingClaims;
    const origSendClaimMessage = claimModel.sendClaimMessage;
    const origSendClaimMessageQuery2 = claimModel.sendClaimMessageQuery2;
    const origUpdateClaimStatus = claimModel.updateClaimStatus;
    const origUpdateClaimStatusQuery2 = claimModel.updateClaimStatusQuery2;
    const origUpdateClaimStatusQuery3 = claimModel.updateClaimStatusQuery3;
    const origUpdateClaimStatusQuery4 = claimModel.updateClaimStatusQuery4;
    const origUpdateClaimStatusQuery6 = claimModel.updateClaimStatusQuery6;
    const origListCompeting = claimModel.listCompetingActiveClaims;
    const origCloseCompeting = claimModel.closeCompetingClaims;
    const origListPendingReset = claimModel.listPendingClaimsForQuotaReset;
    const origResetUserQuota = claimModel.resetUserQuota;
    try {
        const mockFallbackDb = async () => [[], []];
        pool.execute = mockFallbackDb;
        pool.query = mockFallbackDb;
        pool.getConnection = async () => ({
            execute: mockFallbackDb,
            query: mockFallbackDb,
            beginTransaction: async () => {},
            commit: async () => {},
            rollback: async () => {},
            release: () => {}
        });

        itemReportModel.createClaim = async () => [[{
            id: 50,
            user_id: 20,
            status: 'active',
            report_type: 'found',
            item_name: 'Casio Calculator',
            secret_challenge: 'Sticker?',
            secret_answer: 'Blue Star'
        }]];
        claimModel.createClaim = async () => [[]];
        claimModel.countActivePendingClaims = async () => [[{ count: 3 }]];

        const capRes = createMockRes();
        await itemController.createClaim({
            params: { id: '50' },
            body: { proof_details: 'Blue Star' },
            session: { user: { id: 30, role: 'student', full_name: 'Claimant' } }
        }, capRes);
        assert(capRes.redirectUrl && decodeURIComponent(capRes.redirectUrl).includes('limit of 3 active pending claims'), `4th active pending claim must be rejected, got: ${capRes.redirectUrl}`);

        // Chat lock on rejected claim
        claimModel.sendClaimMessage = async () => [[{ id: 10, claimant_id: 30, reporter_id: 20, status: 'rejected' }]];
        const closedMsgRes = createMockRes();
        await itemController.sendClaimMessage({
            params: { id: '10' },
            body: { message: 'Hello?' },
            session: { user: { id: 30, role: 'student' } }
        }, closedMsgRes);
        assert(closedMsgRes.redirectUrl && decodeURIComponent(closedMsgRes.redirectUrl).includes('closed'), `Posting to rejected claim chat must fail, got: ${closedMsgRes.redirectUrl}`);

        // Phone masking on pending vs approved claims
        const sentPayloads = [];
        claimModel.sendClaimMessageQuery2 = async (params) => {
            sentPayloads.push(params[2]);
            return [{ insertId: 1 }];
        };
        claimModel.sendClaimMessage = async () => [[{ id: 11, claimant_id: 30, reporter_id: 20, status: 'pending' }]];
        await itemController.sendClaimMessage({
            params: { id: '11' },
            body: { message: 'Reach me at 09171234567 or +639181234568 please.' },
            session: { user: { id: 30, role: 'student' } }
        }, createMockRes());
        assert(!sentPayloads[0].includes('09171234567'), 'Pending claim must mask 09xx phone numbers');
        assert(!sentPayloads[0].includes('9181234568'), 'Pending claim must mask +63 phone numbers');

        claimModel.sendClaimMessage = async () => [[{ id: 11, claimant_id: 30, reporter_id: 20, status: 'approved' }]];
        await itemController.sendClaimMessage({
            params: { id: '11' },
            body: { message: 'Meet me, call 09171234567.' },
            session: { user: { id: 30, role: 'student' } }
        }, createMockRes());
        assert(sentPayloads[1].includes('09171234567'), 'Approved claim must allow unmasked contact coordination');

        // Custody guard: non-admin finder cannot approve security_desk found item
        claimModel.updateClaimStatus = async () => [[{
            id: 15,
            item_id: 50,
            claimant_id: 30,
            reporter_id: 20,
            status: 'pending',
            report_type: 'found',
            custody_mode: 'security_desk',
            item_name: 'Casio Calculator'
        }]];
        const custodyGuardRes = createMockRes();
        await itemController.updateClaimStatus({
            params: { id: '15' },
            body: { action: 'approved' },
            session: { user: { id: 20, role: 'student' } },
            ip: '127.0.0.1'
        }, custodyGuardRes);
        assert(custodyGuardRes.redirectUrl && decodeURIComponent(custodyGuardRes.redirectUrl).includes('Security Desk'), `Finder cannot directly approve security_desk item, got: ${custodyGuardRes.redirectUrl}`);

        // Peer item approval closes competing claims
        let competingClosedArgs = null;
        claimModel.updateClaimStatus = async () => [[{
            id: 15,
            item_id: 50,
            claimant_id: 30,
            reporter_id: 20,
            status: 'pending',
            report_type: 'found',
            custody_mode: 'peer_meetup',
            item_name: 'Casio Calculator'
        }]];
        claimModel.updateClaimStatusQuery2 = async () => [{ affectedRows: 1 }];
        claimModel.updateClaimStatusQuery3 = async () => [{ affectedRows: 1 }];
        claimModel.listCompetingActiveClaims = async () => [[{ id: 16 }, { id: 17 }]];
        claimModel.closeCompetingClaims = async (args) => {
            competingClosedArgs = args;
            return [{ affectedRows: 2 }];
        };
        const competingNotes = [];
        claimModel.updateClaimStatusQuery6 = async (params) => {
            competingNotes.push(params[2]);
            return [{ insertId: 1 }];
        };
        const peerApproveRes = createMockRes();
        await itemController.updateClaimStatus({
            params: { id: '15' },
            body: { action: 'approved' },
            session: { user: { id: 20, role: 'student' } },
            ip: '127.0.0.1'
        }, peerApproveRes);
        assert.deepStrictEqual(competingClosedArgs, [50, 15], 'Approving peer claim must auto-close competing claims');
        assert.strictEqual(competingNotes.length, 2, 'Competing closed claims must receive [SYSTEM] notification messages');

        // Admin quota reset posts [SYSTEM] note only on pending claims
        const resetNotes = [];
        claimModel.listPendingClaimsForQuotaReset = async () => [[{ id: 81 }, { id: 82 }]];
        claimModel.resetUserQuota = async () => [{ affectedRows: 2 }];
        claimModel.updateClaimStatusQuery6 = async (params) => {
            resetNotes.push({ claimId: params[0], msg: params[2] });
            return [{ insertId: 1 }];
        };
        const resetRes = createMockRes();
        await itemController.resetUserQuota({
            params: { id: '30' },
            session: { user: { id: 1, role: 'admin' } },
            ip: '127.0.0.1'
        }, resetRes);
        assert.strictEqual(resetNotes.length, 2, 'Quota reset must post [SYSTEM] cancellation note on pending claims');
        assert(resetNotes[0].msg.startsWith('[SYSTEM]'), 'Quota reset message must use [SYSTEM] prefix');
    } finally {
        pool.execute = origExec5;
        pool.query = origQuery5;
        pool.getConnection = origConn5;
        itemReportModel.createClaim = origItemCreateClaim;
        claimModel.createClaim = origClaimCreateClaim;
        claimModel.countActivePendingClaims = origCountPending;
        claimModel.sendClaimMessage = origSendClaimMessage;
        claimModel.sendClaimMessageQuery2 = origSendClaimMessageQuery2;
        claimModel.updateClaimStatus = origUpdateClaimStatus;
        claimModel.updateClaimStatusQuery2 = origUpdateClaimStatusQuery2;
        claimModel.updateClaimStatusQuery3 = origUpdateClaimStatusQuery3;
        claimModel.updateClaimStatusQuery4 = origUpdateClaimStatusQuery4;
        claimModel.updateClaimStatusQuery6 = origUpdateClaimStatusQuery6;
        claimModel.listCompetingActiveClaims = origListCompeting;
        claimModel.closeCompetingClaims = origCloseCompeting;
        claimModel.listPendingClaimsForQuotaReset = origListPendingReset;
        claimModel.resetUserQuota = origResetUserQuota;
    }
    console.log('✅ PASS: Claim quota cap, chat lock, phone masking, custody guard, competing closure, and quota reset work.');

    // 6. EJS Views Render Real Data & UI/Dark-Mode Fixes
    console.log('\n--- Test 6: View Rendering (Zero Fake Fallbacks, UI & Dark-Mode Fixes) ---');
    const sharedViewLocals = {
        csrfToken: 'csrf-test',
        unreadNotificationCount: 0,
        timeAgo: () => 'Just now',
        msg: null,
        error: null
    };

    const adminReportsHtml = ejs.render(
        fs.readFileSync(path.join(PAGES_DIR, 'adminReports.ejs'), 'utf8'),
        {
            ...sharedViewLocals,
            user: { id: 1, full_name: 'Admin', email: 'admin@cspc.edu.ph', role: 'admin' },
            isAdmin: true,
            stats: { totalReports: 0, recoveryRate: 0, peerReturns: 0, deskHandovers: 0 },
            archiveQueue: [],
            auditLogs: [],
            reports: []
        },
        { filename: path.join(PAGES_DIR, 'adminReports.ejs') }
    );
    assert(!adminReportsHtml.includes('86%'), 'adminReports must not render fake 86% fallback');
    assert(!adminReportsHtml.includes('Handover Verified'), 'adminReports must not render fake mock audit rows');
    assert(!adminReportsHtml.includes('data-csv='), 'adminReports must not embed unescaped data-csv');

    const adminAnalyticsHtml = ejs.render(
        fs.readFileSync(path.join(PAGES_DIR, 'adminAnalytics.ejs'), 'utf8'),
        {
            ...sharedViewLocals,
            user: { id: 1, full_name: 'Admin', email: 'admin@cspc.edu.ph', role: 'admin' },
            isAdmin: true,
            p2p: { successRate: 0, description: 'Direct peer verification', approved: 0, pending: 0, rejected: 0, total: 0 },
            centralized: { successRate: 0, description: 'Security counter handover', approved: 0, pending: 0, rejected: 0, total: 0 },
            reports: { total_reports: 0, total_claimed: 0, total_active: 0, total_archived: 0 },
            categories: [],
            pendingHandoverCount: 0
        },
        { filename: path.join(PAGES_DIR, 'adminAnalytics.ejs') }
    );
    assert(!adminAnalyticsHtml.includes('88%'), 'adminAnalytics must not render fake 88%');
    assert(!adminAnalyticsHtml.includes('4.2 hrs'), 'adminAnalytics must not render fake 4.2 hrs');
    assert(!adminAnalyticsHtml.includes('100%'), 'adminAnalytics must not render fake 100% ID Verify');
    assert(adminAnalyticsHtml.includes('No resolved claim category data yet.'), 'adminAnalytics must render empty category notice');

    const dashboardHtml = ejs.render(
        fs.readFileSync(path.join(PAGES_DIR, 'dashboard.ejs'), 'utf8'),
        {
            ...sharedViewLocals,
            user: { id: 2, full_name: 'Student', email: 's@my.cspc.edu.ph', role: 'student' },
            isAdmin: false,
            isCatalog: false,
            filters: {},
            items: [],
            categories: ['Electronics'],
            categoryCounts: {},
            smartMatches: [{ id: 10, item_name: 'Black Umbrella', location_found_lost: 'Library', match_score: 64, date_reported: new Date() }],
            myReports: [{ id: 21, item_name: 'Lost Umbrella', report_type: 'lost', status: 'active', active_claim_count: 0, location_found_lost: 'Library', date_reported: new Date() }]
        },
        { filename: path.join(PAGES_DIR, 'dashboard.ejs') }
    );
    assert(dashboardHtml.includes('64%'), 'Dashboard Smart Match must render actual score');
    assert(!dashboardHtml.includes('92%'), 'Dashboard must not hardcode 92% match score');
    assert(dashboardHtml.includes('Cataloged'), 'Dashboard Step 2 must not claim Matched when active_claim_count is 0');

    const rejectedPostHtml = ejs.render(
        fs.readFileSync(path.join(PAGES_DIR, 'postDetail.ejs'), 'utf8'),
        {
            ...sharedViewLocals,
            user: { id: 2, full_name: 'Student', email: 's@my.cspc.edu.ph', role: 'student' },
            isAdmin: false,
            item: { id: 9, user_id: 99, report_type: 'found', item_name: 'Keys', status: 'active', location_found_lost: 'Gate', date_reported: new Date(), secret_challenge: 'Keychain?' },
            itemImages: [],
            existingClaim: { id: 7, status: 'rejected' },
            similar: []
        },
        { filename: path.join(PAGES_DIR, 'postDetail.ejs') }
    );
    assert(rejectedPostHtml.includes('id="claimSubmitForm"'), 'Claimant must be allowed to re-claim after rejection');
    assert(rejectedPostHtml.includes('Previous Claim Rejected'), 'Rejection re-claim notice must display');

    const closedChatHtml = ejs.render(
        fs.readFileSync(path.join(PAGES_DIR, 'chat.ejs'), 'utf8'),
        {
            ...sharedViewLocals,
            user: { id: 2, full_name: 'Student', email: 's@my.cspc.edu.ph', role: 'student' },
            isAdmin: false,
            claim: { id: 33, claimant_id: 2, reporter_id: 9, status: 'returned', item_name: 'ID Card' },
            messages: []
        },
        { filename: path.join(PAGES_DIR, 'chat.ejs') }
    );
    assert(!closedChatHtml.includes('id="chatForm"'), 'Closed chat must hide message composer');
    assert(closedChatHtml.includes('conversation is closed'), 'Closed chat must explain why messaging is disabled');

    const editReportHtml = ejs.render(
        fs.readFileSync(path.join(PAGES_DIR, 'editReport.ejs'), 'utf8'),
        {
            ...sharedViewLocals,
            user: { id: 2, full_name: 'Finder', email: 'f@my.cspc.edu.ph', role: 'student' },
            isAdmin: false,
            item: { id: 40, report_type: 'found', item_name: 'Watch', category: 'Other', status: 'active', location_found_lost: 'Gym', custody_mode: 'peer_meetup', custody_received_at: null },
            itemImages: [{ id: 71, image_path: '/uploads/watch.jpg' }],
            categories: ['Electronics', 'Other']
        },
        { filename: path.join(PAGES_DIR, 'editReport.ejs') }
    );
    assert(editReportHtml.includes('name="remove_image_ids"'), 'editReport must render photo deletion checkboxes');
    assert(editReportHtml.includes('data-status="claimed"'), 'editReport must allow Claimed status');
    assert(editReportHtml.includes('data-status="archived"'), 'editReport must allow Archived status');
    assert(editReportHtml.includes('name="custody_mode"'), 'editReport must allow toggling custody_mode before drop-off');

    const navbarAdminHtml = ejs.render(
        fs.readFileSync(path.join(VIEWS_DIR, 'partials', 'navbar.ejs'), 'utf8'),
        {
            ...sharedViewLocals,
            user: { id: 1, full_name: 'Admin', email: 'a@cspc.edu.ph', role: 'admin' },
            isAdmin: true,
            unreadNotificationCount: 3,
            active: 'admin-dashboard'
        },
        { filename: path.join(VIEWS_DIR, 'partials', 'navbar.ejs') }
    );
    assert(navbarAdminHtml.includes('href="/admin/handover"'), 'Admin navbar bell must point to /admin/handover');
    assert(navbarAdminHtml.includes('hanap_notifications_seen_count'), 'Navbar must track seen count so new alerts appear');

    const loginSrc = fs.readFileSync(path.join(PAGES_DIR, 'login.ejs'), 'utf8');
    assert(loginSrc.includes("getElementById('signInBtn')"), 'login.ejs submit handler must disable #signInBtn');
    assert(!loginSrc.includes("getElementById('submitBtn')"), 'login.ejs must not reference nonexistent #submitBtn');

    const forgotSrc = fs.readFileSync(path.join(PAGES_DIR, 'forgotPassword.ejs'), 'utf8');
    assert(forgotSrc.includes("if (tab === 'institutional_info')"), 'forgotPassword.ejs switchRecoveryTab must inspect tab parameter');
    assert(!forgotSrc.includes("if (currentTab === 'institutional_info')"), 'forgotPassword.ejs JS must fix currentTab ReferenceError');
    assert(forgotSrc.includes('matchIconWrap'), 'forgotPassword.ejs must use matchIconWrap for Lucide icon re-renders');

    const auditSrc = fs.readFileSync(path.join(PAGES_DIR, 'adminAuditLogs.ejs'), 'utf8');
    assert(!auditSrc.includes('<html class="light"'), 'adminAuditLogs.ejs must not hardcode light class');
    assert(auditSrc.includes('darkMode: "class"'), 'adminAuditLogs.ejs must enable Tailwind class dark mode');

    const staffSettingsHtml = ejs.render(
        fs.readFileSync(path.join(PAGES_DIR, 'settings.ejs'), 'utf8'),
        {
            ...sharedViewLocals,
            user: { id: 4, full_name: 'Staff', email: 'staff@cspc.edu.ph', role: 'staff' },
            profileUser: { id: 4, full_name: 'Staff', email: 'staff@cspc.edu.ph', role: 'staff', role_label: 'Staff', department: 'CCS', notify_claims: 0, notify_chat: 1, notify_broadcasts: 0 },
            isAdmin: false,
            mfaEnabled: true,
            myReports: [],
            claimsMade: []
        },
        { filename: path.join(PAGES_DIR, 'settings.ejs') }
    );
    assert(!staffSettingsHtml.includes('panel-connections'), 'settings.ejs must omit deleted guardian panel-connections');
    assert(!staffSettingsHtml.includes('Department is only editable for student accounts'), 'settings.ejs must allow staff to edit department');
    console.log('✅ PASS: All view renders, fake metric removals, forms, JS fixes, and dark-mode markup verified.');

    console.log('\n================================================================');
    console.log('🏆 ALL SYSTEM OVERHAUL REGRESSION TESTS PASSED');
    console.log('================================================================');
    process.exit(0);
}

runOverhaulRegressionSuite().catch((err) => {
    console.error('❌ Overhaul Regression Suite Failed:', err);
    process.exit(1);
});

