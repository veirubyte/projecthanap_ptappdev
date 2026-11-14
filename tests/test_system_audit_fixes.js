const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const ejs = require('ejs');

const db = require('../config/db');
const DatabaseSessionStore = require('../config/sessionStore');
const itemReportModel = require('../models/itemReportModel');
const userModel = require('../models/userModel');
const claimModel = require('../models/claimModel');
const viewLocals = require('../middleware/viewLocals');
const authController = require('../controllers/authController');
const itemController = require('../controllers/itemController');

const ROOT_DIR = path.resolve(__dirname, '..');
const PAGES_DIR = path.join(ROOT_DIR, 'views', 'pages');

const sharedViewLocals = {
    unreadNotificationCount: 0,
    csrfToken: 'test-csrf-token',
    active: 'claims',
    msg: null,
    error: null,
    q: '',
    status: 'all',
    type: '',
    category: '',
    period: '',
    timeAgo: () => 'Just now'
};

function createMockReq(overrides = {}) {
    let savedCount = 0;
    const req = {
        method: 'POST',
        originalUrl: '/',
        ip: '127.0.0.1',
        query: {},
        params: {},
        body: {},
        session: {
            save(cb) {
                savedCount += 1;
                if (typeof cb === 'function') cb(null);
            }
        },
        ...overrides,
        getSavedCount() {
            return savedCount;
        }
    };
    return req;
}

function createMockRes() {
    return {
        statusCode: 200,
        redirectUrl: null,
        redirectSavedCount: null,
        renderedView: null,
        renderedLocals: null,
        locals: {},
        status(code) {
            this.statusCode = code;
            return this;
        },
        redirect(url) {
            this.redirectUrl = url;
            if (this._req && typeof this._req.getSavedCount === 'function') {
                this.redirectSavedCount = this._req.getSavedCount();
            }
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

function httpGet(port, reqPath, headers = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port,
            path: reqPath,
            method: 'GET',
            agent: false,
            headers: {
                'Connection': 'close',
                ...headers
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
        req.end();
    });
}

function httpPostJson(port, reqPath, payload, headers = {}) {
    const body = JSON.stringify(payload || {});
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port,
            path: reqPath,
            method: 'POST',
            agent: false,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Connection': 'close',
                'Content-Length': Buffer.byteLength(body),
                ...headers
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
        req.end(body);
    });
}

async function runTests() {
    console.log('Running System Audit Regression & Integration Tests...');

    const originalExecute = db.execute.bind(db);
    const executedCalls = [];

    try {
        // 1. Model SQL Checks (PostgreSQL + MySQL Case-Insensitive Queries & Report Type)
        console.log('\n--- Test 1: Case-Insensitive SQL & Chat Report Type ---');
        db.execute = async (sql, params = []) => {
            executedCalls.push({ sql, params });
            return [[], []];
        };

        await itemReportModel.findCatalogReports({ q: 'Wallet', isCatalog: true });
        const catalogCall = executedCalls.pop();
        assert(catalogCall.sql.includes('LOWER(r.item_name) LIKE LOWER(?)'), 'Catalog search must use LOWER() LIKE LOWER(?)');
        assert(catalogCall.sql.includes('LOWER(r.description) LIKE LOWER(?)'), 'Catalog description search must be case-insensitive');
        assert(catalogCall.sql.includes('LOWER(r.location_found_lost) LIKE LOWER(?)'), 'Catalog location search must be case-insensitive');
        assert.deepStrictEqual(catalogCall.params, ['%Wallet%', '%Wallet%', '%Wallet%']);

        await userModel.login(['Mixed.Case@CSPC.edu.ph']);
        const userLoginCall = executedCalls.pop();
        assert(userLoginCall.sql.includes('LOWER(u.email) = LOWER(?)'), 'userModel.login must match email case-insensitively');

        await userModel.register(['Mixed.Case@CSPC.edu.ph']);
        const userRegCall = executedCalls.pop();
        assert(userRegCall.sql.includes('LOWER(email) = LOWER(?)'), 'userModel.register duplicate check must match case-insensitively');

        await claimModel.showClaimChat([42]);
        const chatCall = executedCalls.pop();
        assert(chatCall.sql.includes('r.report_type'), 'showClaimChat must select r.report_type for Lost/Found role labels');
        console.log('✅ PASS: PostgreSQL/MySQL case-insensitive queries and chat report_type verified.');

        // 2. Forgot Password Lowercasing, Session Save & Missing-Session Safety
        console.log('\n--- Test 2: Auth Controller Session Save, Lowercase Reset & Guards ---');
        const originalUserLogin = userModel.login;
        const capturedEmails = [];
        userModel.login = async (params) => {
            capturedEmails.push(params[0]);
            return [[], []];
        };

        try {
            const resetReq = createMockReq({
                body: { email: '  Student.Upper@My.CSPC.Edu.Ph ', category: 'institution' }
            });
            const resetRes = createMockRes();
            await authController.requestPasswordReset(resetReq, resetRes);
            assert.strictEqual(capturedEmails[0], 'student.upper@my.cspc.edu.ph', 'requestPasswordReset must lowercase email before lookup');
            assert.strictEqual(resetRes.statusCode, 404);
        } finally {
            userModel.login = originalUserLogin;
        }

        // Verify delete req.session.pwdReset is persisted via saveSession before redirect
        {
            const req = createMockReq({ query: { reset: '1' } });
            req.session.pwdReset = { userId: 5, email: 'a@b.com', step: 'verify' };
            const res = createMockRes();
            res._req = req;
            await authController.showForgotPassword(req, res);
            assert.strictEqual(res.redirectUrl, '/forgot-password');
            assert.strictEqual(req.session.pwdReset, undefined, 'reset=1 must clear pwdReset');
            assert.strictEqual(res.redirectSavedCount, 1, 'showForgotPassword must save session before redirect');
        }
        for (const handler of [
            authController.resendPasswordResetCode,
            authController.verifyPasswordResetCode,
            authController.completePasswordReset
        ]) {
            const req = createMockReq({});
            req.session.pwdReset = { stale: true };
            const res = createMockRes();
            res._req = req;
            await handler(req, res);
            assert.strictEqual(res.redirectUrl, '/forgot-password');
            assert.strictEqual(req.session.pwdReset, undefined);
            assert.strictEqual(res.redirectSavedCount, 1, 'Forgot-password redirect must save session before redirecting');
        }

        // Guarded req.session?.user when req.session is undefined
        {
            const noSessionReq = { method: 'GET', query: {}, session: undefined };
            const noSessionRes = createMockRes();
            await authController.showLogin(noSessionReq, noSessionRes);
            assert.strictEqual(noSessionRes.statusCode, 200);
            authController.showRegistration(noSessionReq, createMockRes());
            await authController.showForgotPassword(noSessionReq, createMockRes());
        }
        console.log('✅ PASS: Forgot-password lowercase lookup, session saves, and req.session guards verified.');

        // 3. DatabaseSessionStore Expired Session Purge
        console.log('\n--- Test 3: DatabaseSessionStore Expired Session Purge ---');
        {
            const mockPoolQueries = [];
            const store = new DatabaseSessionStore();
            store.pool = {
                isPostgres: true,
                execute: async (sql, params) => {
                    mockPoolQueries.push({ sql, params });
                    return [[], []];
                }
            };
            await store.set('fresh-sid', { cookie: { maxAge: 60000 }, user: { id: 1 } });
            await store.purgeExpired();
            assert(
                mockPoolQueries.some((q) => q.sql.includes('DELETE FROM user_sessions WHERE expires_at < CURRENT_TIMESTAMP')),
                'purgeExpired must delete expired sessions from user_sessions'
            );
        }
        console.log('✅ PASS: DatabaseSessionStore expired session cleanup verified.');

        // 4. Unread Notification Cache Invalidation & Claim Terminal State Guard
        console.log('\n--- Test 4: Notification Cache Invalidation & Claim State Guard ---');
        const originalGetUnread = claimModel.getUnreadNotificationCount;
        const originalGetAdminUnread = claimModel.getAdminNotificationCount;
        let userUnreadCalls = 0;
        let adminUnreadCalls = 0;
        try {
            viewLocals.invalidateAllUnreadCache();
            claimModel.getUnreadNotificationCount = async () => {
                userUnreadCalls += 1;
                return [[{ unread_count: userUnreadCalls }], []];
            };
            claimModel.getAdminNotificationCount = async () => {
                adminUnreadCalls += 1;
                return [[{ unread_count: adminUnreadCalls * 10 }], []];
            };

            const userReq = { session: { user: { id: 77, role: 'student' } } };
            const r1 = createMockRes();
            await viewLocals(userReq, r1, () => {});
            assert.strictEqual(r1.locals.unreadNotificationCount, 1);

            const r2 = createMockRes();
            await viewLocals(userReq, r2, () => {});
            assert.strictEqual(r2.locals.unreadNotificationCount, 1, 'Cached count expected before invalidation');
            assert.strictEqual(userUnreadCalls, 1);

            viewLocals.invalidateUnreadCache([77], { includeAdmins: true });
            const r3 = createMockRes();
            await viewLocals(userReq, r3, () => {});
            assert.strictEqual(r3.locals.unreadNotificationCount, 2, 'Count must refresh immediately after invalidation');
            assert.strictEqual(userUnreadCalls, 2);

            const adminReq = { session: { user: { id: 1, role: 'admin' } } };
            const ar1 = createMockRes();
            await viewLocals(adminReq, ar1, () => {});
            assert.strictEqual(ar1.locals.unreadNotificationCount, 10);
            viewLocals.invalidateUnreadCache([], { includeAdmins: true });
            const ar2 = createMockRes();
            await viewLocals(adminReq, ar2, () => {});
            assert.strictEqual(ar2.locals.unreadNotificationCount, 20, 'Admin count must refresh when includeAdmins=true');
        } finally {
            claimModel.getUnreadNotificationCount = originalGetUnread;
            claimModel.getAdminNotificationCount = originalGetAdminUnread;
            viewLocals.invalidateAllUnreadCache();
        }

        // Terminal claim status escalation guard
        const originalUpdateClaimStatus = claimModel.updateClaimStatus;
        const originalUpdateClaimStatusQuery2 = claimModel.updateClaimStatusQuery2;
        try {
            let statusUpdateExecuted = false;
            claimModel.updateClaimStatus = async () => [[{
                id: 99,
                item_id: 50,
                claimant_id: 22,
                reporter_id: 11,
                status: 'returned',
                item_name: 'Calculator',
                custody_mode: 'peer_meetup',
                report_type: 'found'
            }], []];
            claimModel.updateClaimStatusQuery2 = async () => {
                statusUpdateExecuted = true;
                return [{ affectedRows: 1 }, []];
            };

            const req = createMockReq({
                params: { id: '99' },
                body: { action: 'escalated' },
                session: { user: { id: 22, role: 'student' } }
            });
            const res = createMockRes();
            await itemController.updateClaimStatus(req, res);
            assert.strictEqual(statusUpdateExecuted, false, 'Closed (returned/rejected) claim must not be mutated or escalated');
            assert(res.redirectUrl.includes('cannot%20be%20modified'), 'Must redirect with closed-claim error message');
        } finally {
            claimModel.updateClaimStatus = originalUpdateClaimStatus;
            claimModel.updateClaimStatusQuery2 = originalUpdateClaimStatusQuery2;
        }
        console.log('✅ PASS: Notification cache invalidation and closed-claim state guard verified.');

        // 5. EJS View Regression Checks
        console.log('\n--- Test 5: EJS View Regression Checks ---');
        const guestClaimHtml = ejs.render(
            fs.readFileSync(path.join(PAGES_DIR, 'guestClaim.ejs'), 'utf8'),
            {
                ...sharedViewLocals,
                user: { id: 5, full_name: 'Guest User', email: 'g@gmail.com', role: 'guest' },
                isAdmin: false,
                caseId: 14,
                activeCaseId: 14,
                caseItem: { id: 14, item_name: 'Keys', category: 'Keys', location_found_lost: 'Library Entrance', description: 'Silver key' },
                matchPercentage: 0,
                answered: false,
                guestLimitReached: false,
                guestClaimsRemaining: 2
            },
            { filename: path.join(PAGES_DIR, 'guestClaim.ejs') }
        );
        assert(guestClaimHtml.includes('Library Entrance'), 'guestClaim.ejs must render location_found_lost');
        assert(guestClaimHtml.includes('href="/items/new?type=lost"'), 'guestClaim.ejs must link to /items/new?type=lost');
        assert(!guestClaimHtml.includes('href="/report"'), 'guestClaim.ejs must not link to 404 /report');

        const forgotHtml = ejs.render(
            fs.readFileSync(path.join(PAGES_DIR, 'forgotPassword.ejs'), 'utf8'),
            {
                ...sharedViewLocals,
                user: null,
                isAdmin: false,
                step: 'request',
                tab: 'self_service',
                category: 'institution',
                email: '',
                maskedEmail: '',
                cooldownSeconds: 0,
                attemptsRemaining: 5,
                resetToken: null,
                errorTitle: null,
                errorMessage: null,
                action: null,
                invalidFields: []
            },
            { filename: path.join(PAGES_DIR, 'forgotPassword.ejs') }
        );
        assert(!forgotHtml.includes('parents'), 'forgotPassword.ejs must not reference removed parents role');

        const public404Html = ejs.render(
            fs.readFileSync(path.join(PAGES_DIR, '403.ejs'), 'utf8'),
            {
                httpStatus: 404,
                statusLabel: 'Not Found',
                errorTitle: 'Page Not Found',
                errorMessage: 'Not found',
                attemptedPath: '/nonexistent',
                user: null,
                returnUrl: '/',
                returnLabel: 'Back to Home'
            },
            { filename: path.join(PAGES_DIR, '403.ejs') }
        );
        assert(!public404Html.includes('Sign in with an admin account'), 'Public 404 must not show admin sign-in CTA');

        const admin403Html = ejs.render(
            fs.readFileSync(path.join(PAGES_DIR, '403.ejs'), 'utf8'),
            {
                httpStatus: 403,
                statusLabel: 'Forbidden',
                errorTitle: 'Admin Access Only',
                errorMessage: 'Forbidden',
                attemptedPath: '/admin/users',
                user: null,
                returnUrl: '/dashboard'
            },
            { filename: path.join(PAGES_DIR, '403.ejs') }
        );
        assert(admin403Html.includes('Sign in with an admin account'), 'Admin 403 without user should show admin sign-in CTA');

        const postDetailHtml = ejs.render(
            fs.readFileSync(path.join(PAGES_DIR, 'postDetail.ejs'), 'utf8'),
            {
                ...sharedViewLocals,
                user: { id: 3, full_name: 'Student', email: 's@my.cspc.edu.ph', role: 'student' },
                isAdmin: false,
                item: { id: 7, user_id: 9, report_type: 'found', item_name: 'ID', category: 'IDs', location_found_lost: 'Gate', description: 'Blue lace', status: 'active', date_reported: new Date(), secret_challenge: 'Last 4 digits?' },
                itemImages: [],
                existingClaim: null,
                similar: []
            },
            { filename: path.join(PAGES_DIR, 'postDetail.ejs') }
        );
        assert(!postDetailHtml.includes('Officer Mode'), 'postDetail.ejs must not retain dead admin branch inside !isAdminViewer');

        const claimsHtml = ejs.render(
            fs.readFileSync(path.join(PAGES_DIR, 'claims.ejs'), 'utf8'),
            {
                ...sharedViewLocals,
                user: { id: 3, full_name: 'Owner User', email: 'o@my.cspc.edu.ph', role: 'student' },
                isAdmin: false,
                receivedClaims: [
                    { id: 1, item_name: 'Lost Watch', report_type: 'lost', claimant_name: 'Finder One', status: 'pending', proof_details: 'Found near library', created_at: new Date() },
                    { id: 2, item_name: 'Found Wallet', report_type: 'found', claimant_name: 'Claimant Two', status: 'pending', proof_details: 'Has student ID inside', created_at: new Date() }
                ],
                madeClaims: [
                    { id: 3, item_name: 'Lost Phone', report_type: 'lost', reporter_name: 'Real Owner', status: 'returned', proof_details: 'Found in quad', created_at: new Date() },
                    { id: 4, item_name: 'Found Bag', report_type: 'found', reporter_name: 'Finder Two', status: 'escalated', proof_details: 'Blue backpack', created_at: new Date() }
                ]
            },
            { filename: path.join(PAGES_DIR, 'claims.ejs') }
        );
        assert(claimsHtml.includes('Finder: <strong class="text-slate-700">Finder One</strong>'), 'Lost receivedClaim must label finder correctly');
        assert(claimsHtml.includes('Claimant: <strong class="text-slate-700">Claimant Two</strong>'), 'Found receivedClaim must label claimant correctly');
        assert(claimsHtml.includes('Owner: <strong class="text-slate-700">Real Owner</strong>'), 'Lost madeClaim must label owner correctly');
        assert(claimsHtml.includes('Finder: <strong class="text-slate-700">Finder Two</strong>'), 'Found madeClaim must label finder correctly');
        assert(claimsHtml.includes('bg-emerald-100 text-emerald-800'), 'returned badge must render emerald');
        assert(claimsHtml.includes('bg-indigo-100 text-indigo-800'), 'escalated badge must render indigo');

        const lostChatHtml = ejs.render(
            fs.readFileSync(path.join(PAGES_DIR, 'chat.ejs'), 'utf8'),
            {
                ...sharedViewLocals,
                user: { id: 2, full_name: 'Finder', email: 'f@my.cspc.edu.ph', role: 'student' },
                isAdmin: false,
                userIsAdmin: false,
                userIsClaimant: true,
                userIsReporter: false,
                claim: { id: 15, claimant_id: 2, reporter_id: 9, reporter_name: 'Owner Jane', claimant_name: 'Finder', report_type: 'lost', status: 'escalated', item_status: 'active', item_name: 'Keys' },
                messages: []
            },
            { filename: path.join(PAGES_DIR, 'chat.ejs') }
        );
        assert(lostChatHtml.includes('Owner Jane (Owner)'), 'Lost claim chat must label reporter as Owner');
        assert(!lostChatHtml.includes('Escalate to Security'), 'Already-escalated claim chat must hide Escalate button');
        assert(!lostChatHtml.includes('id="menuDropdownWrapper"'), 'Empty overflow menu must not render');

        const adminSettingsHtml = ejs.render(
            fs.readFileSync(path.join(PAGES_DIR, 'settings.ejs'), 'utf8'),
            {
                ...sharedViewLocals,
                user: { id: 1, full_name: 'Admin', email: 'admin@cspc.edu.ph', role: 'admin' },
                profileUser: { id: 1, full_name: 'Admin', email: 'admin@cspc.edu.ph', role: 'admin', role_label: 'System Administrator', department: '', notify_claims: 1, notify_chat: 1, notify_broadcasts: 1 },
                isAdmin: true,
                activeTab: 'security',
                mfaEnabled: true,
                myReports: [],
                claimsMade: [],
                auditHistory: []
            },
            { filename: path.join(PAGES_DIR, 'settings.ejs') }
        );
        assert(!adminSettingsHtml.includes('data-tab="posts"'), 'Admin settings must hide Post & Reports tab');
        assert(!adminSettingsHtml.includes('id="panel-posts"'), 'Admin settings must omit panel-posts');
        assert(adminSettingsHtml.includes("const defaultTab = 'security';"), 'Admin settings must initialize defaultTab to security');
        assert(!adminSettingsHtml.includes('bg-white/80 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] bg-slate-100/80'), 'Disabled department input must not have conflicting bg-white/80');

        const adminDashSrc = fs.readFileSync(path.join(PAGES_DIR, 'adminDashboard.ejs'), 'utf8');
        assert(adminDashSrc.includes("? 'shrink-0 pb-3"), 'adminDashboard switchAdminTab must retain shrink-0');
        console.log('✅ PASS: All 8 EJS template regression assertions passed.');

        // 6. Full Express App HTTP Route Integration Tests
        console.log('\n--- Test 6: Express app.js HTTP Integration Smoke Tests ---');
        db.execute = async (sql, params = []) => {
            if (sql.includes('COUNT(*) AS active_lost') || sql.includes('SUM(CASE WHEN')) {
                return [[{ active_lost: 1, active_found: 2, total_claimed: 0, total_reports: 3 }], []];
            }
            return [[], []];
        };
        const app = require('../app');
        const server = app.listen(0);
        try {
            const { port } = server.address();
            const landingRes = await httpGet(port, '/');
            assert.strictEqual(landingRes.status, 200);
            assert(landingRes.body.includes('Project HANAP'));

            const catalogRes = await httpGet(port, '/catalog?q=Wallet');
            assert.strictEqual(catalogRes.status, 200);

            const notFoundRes = await httpGet(port, '/missing-route-check');
            assert.strictEqual(notFoundRes.status, 404);
            assert(!notFoundRes.body.includes('Sign in with an admin account'), 'HTTP 404 must not expose admin sign-in CTA');
            assert(notFoundRes.body.includes('Back to Home'), 'Anonymous HTTP 404 must say Back to Home');

            const assistantNoCsrfRes = await httpPostJson(port, '/api/assistant/chat', { message: 'hello' });
            assert.strictEqual(assistantNoCsrfRes.status, 403);
            const assistantNoCsrfJson = JSON.parse(assistantNoCsrfRes.body);
            assert(assistantNoCsrfJson.error.includes('CSRF'), 'POST without CSRF token must return JSON 403 error');

            const assistantRoutes = require('../routes/assistantRoutes');
            const chatLayer = assistantRoutes.stack.find((l) => l.route && l.route.path === '/chat');
            assert(chatLayer, 'assistantRoutes must expose /chat route');
            const authGuardMiddleware = chatLayer.route.stack[0].handle;
            const guardRes = createMockRes();
            await authGuardMiddleware({ session: undefined }, guardRes, () => {
                throw new Error('Must not invoke next() when unauthenticated');
            });
            assert.strictEqual(guardRes.statusCode, 401);
            assert.strictEqual(guardRes.jsonPayload.error, 'Please sign in to use the HANAP assistant.');

            const adminRedirectRes = await httpGet(port, '/admin/dashboard');
            assert.strictEqual(adminRedirectRes.status, 302);
            assert(adminRedirectRes.headers.location.startsWith('/login'));

            const claimsRedirectRes = await httpGet(port, '/claims');
            assert.strictEqual(claimsRedirectRes.status, 302);
            assert(claimsRedirectRes.headers.location.startsWith('/login'));
        } finally {
            server.closeAllConnections?.();
            await new Promise((resolve) => server.close(resolve));
        }
        console.log('✅ PASS: Express HTTP integration checks verified.');

        console.log('\n================================================================');
        console.log('🏆 ALL SYSTEM AUDIT REGRESSION & INTEGRATION TESTS PASSED');
        console.log('================================================================');
    } finally {
        db.execute = originalExecute;
    }
}

runTests()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('❌ System Audit Test Failed:', err);
        process.exit(1);
    });
