const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const assert = require('assert');

const viewsDir = path.join(__dirname, '../views');
const pagesDir = path.join(viewsDir, 'pages');

const pages = fs.readdirSync(pagesDir).filter(f => f.endsWith('.ejs'));

// Default mock locals that simulate Express + viewLocals
const defaultLocals = {
    user: { id: 1, full_name: 'Juan Dela Cruz', email: 'juan@my.cspc.edu.ph', role: 'student', role_code: 'student', student_id: '2023-0001' },
    isAdmin: false,
    unreadNotificationCount: 0,
    csrfToken: 'test-csrf-token',
    flash: {},
    currentPath: '/dashboard',
    siteTitle: 'Project HANAP',
    env: 'development',
    timeAgo: (d) => '2 hours ago',
    items: [],
    item: {
        id: 1,
        title: 'Lost Calculator',
        description: 'Casio fx-991EX',
        category_name: 'Electronics',
        status: 'open',
        report_type: 'lost',
        created_at: new Date(),
        location_found: 'Library',
        primary_image: '/images/calc.jpg'
    },
    itemImages: [],
    primaryReportImage: '/images/calc.jpg',
    existingClaim: null,
    answerMatchScore: null,
    metrics: {
        totalReports: 10,
        activeReports: 5,
        resolvedClaims: 5,
        pendingHandover: 0,
        custodyCount: 2,
        surrenderedCount: 3
    },
    postedItems: [],
    claims: [],
    receivedClaims: [],
    madeClaims: [],
    claimsMade: [],
    claim: {
        id: 1,
        item_id: 1,
        claimant_id: 2,
        item_title: 'Lost Calculator',
        status: 'pending',
        claimant_name: 'Maria Santos',
        reporter_name: 'Juan Dela Cruz',
        created_at: new Date()
    },
    userIsClaimant: false,
    userIsReporter: true,
    userIsAdmin: false,
    messages: [],
    myReports: [],
    profileUser: { id: 1, full_name: 'Juan Dela Cruz', email: 'juan@my.cspc.edu.ph', role: 'student', role_code: 'student' },
    guardianRequests: [],
    guardianLinks: [],
    mfaEnabled: false,
    auditLogs: [],
    users: [],
    surrendered: [],
    recognizedFinders: [],
    successfulHandovers: [],
    categoryCounts: {},
    isCatalog: false,
    smartMatches: [{
        own_report_id: 1,
        own_item_name: 'Lost Blue Backpack',
        matched_report_id: 2,
        matched_item_name: 'Blue Backpack Found',
        matched_category: 'Bags & Wallets',
        matched_location: 'Main Library',
        matched_image_path: '/images/logo-icon.png',
        confidence: 91,
        explanation: 'The image and reported details appear consistent.',
        created_at: new Date()
    }],
    initialType: 'lost',
    handoverClaims: [],
    handoverItem: null,
    httpStatus: 403,
    statusLabel: 'Forbidden',
    errorTitle: 'Forbidden',
    errorMessage: 'Forbidden error message',
    attemptedPath: '/test',
    returnUrl: '/dashboard',
    returnLabel: 'Back to Dashboard',
    categories: ['Electronics', 'Keys', 'IDs', 'Bags', 'Books', 'Clothing', 'Other'],
    campuses: ['CSPC Main Campus'],
    locations: ['Library', 'Gymnasium', 'Cafeteria']
};

console.log('--- COMPILING AND RENDERING ALL 21 EJS PAGES ---');
const results = [];

pages.forEach(p => {
    const filePath = path.join(pagesDir, p);
    try {
        const template = fs.readFileSync(filePath, 'utf8');
        const renderFunc = ejs.compile(template, {
            filename: filePath,
            root: viewsDir
        });
        
        // Render as student
        const studentOutput = renderFunc(defaultLocals);
        if (p === 'dashboard.ejs') {
            assert(studentOutput.includes('AI Smart Matches'), 'Dashboard should display confirmed AI matches.');
            assert(studentOutput.includes('Blue Backpack Found'), 'Dashboard should show the other matched report.');
            assert(studentOutput.includes('91%'), 'Dashboard should show the stored match confidence.');
        }
        
        // Render as admin
        renderFunc({
            ...defaultLocals,
            user: { id: 99, full_name: 'Admin Officer', email: 'security.officer@cspc.edu.ph', role: 'admin', role_code: 'admin' },
            isAdmin: true,
            userIsAdmin: true
        });

        // Render as guest (logged out)
        renderFunc({
            ...defaultLocals,
            user: null,
            isAdmin: false,
            userIsAdmin: false
        });

        results.push({ page: p, status: 'PASS' });
    } catch (err) {
        results.push({ page: p, status: 'FAIL', error: err.message });
    }
});

console.log(JSON.stringify(results, null, 2));
const failCount = results.filter(r => r.status === 'FAIL').length;
console.log(`\nSummary: ${pages.length - failCount}/${pages.length} pages compiled and rendered successfully.`);
