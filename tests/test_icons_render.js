const http = require('http');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const { spawn } = require('child_process');

const PORT = 4610;
const viewsDir = path.resolve('views');
const pagesDir = path.join(viewsDir, 'pages');

const pages = [
  { name: '403', role: 'guest' },
  { name: 'adminAnalytics', role: 'admin' },
  { name: 'adminAuditLogs', role: 'admin' },
  { name: 'adminDashboard', role: 'admin' },
  { name: 'adminReports', role: 'admin' },
  { name: 'adminUsers', role: 'admin' },
  { name: 'chat', role: 'student' },
  { name: 'claims', role: 'student' },
  { name: 'custodyHandover', role: 'admin' },
  { name: 'dashboard', role: 'student', isCatalog: false },
  { name: 'dashboard', role: 'student', isCatalog: true },
  { name: 'editReport', role: 'student' },
  { name: 'forgotPassword', role: 'guest' },
  { name: 'guestClaim', role: 'guest' },
  { name: 'landing', role: 'guest' },
  { name: 'login', role: 'guest' },
  { name: 'myReports', role: 'student' },
  { name: 'postDetail', role: 'student' },
  { name: 'register', role: 'guest' },
  { name: 'reportItem', role: 'student' },
  { name: 'settings', role: 'student' }
];

function getFullLocals(role, isCatalog) {
  const isAdmin = role === 'admin';
  const user = {
    id: isAdmin ? 99 : 1,
    full_name: isAdmin ? 'Security Admin Officer' : 'Juan Dela Cruz',
    email: isAdmin ? 'admin.hanap@cspc.edu.ph' : 'juan@my.cspc.edu.ph',
    role: isAdmin ? 'admin' : (role === 'guest' ? 'guest' : 'student'),
    role_code: isAdmin ? 'admin' : 'student',
    student_id: '2023-0001',
    phone: '09123456789'
  };
  const categories = ['Electronics', 'Keys & Lanyards', 'IDs & Cards', 'Bags & Wallets', 'Tumblers & Bottles', 'Books & Documents', 'Clothing & Accessories', 'Other'];
  return {
    user,
    profileUser: user,
    isAdmin,
    isCatalog: Boolean(isCatalog),
    categories,
    categoryCounts: { 'Electronics': 5, 'Keys & Lanyards': 2 },
    unreadNotificationCount: 2,
    csrfToken: 'test-csrf-token',
    msg: null,
    error: null,
    filters: { q: '', type: '', category: '', period: '', status: '' },
    items: [
      { id: 1, item_name: 'Casio Scientific Calculator', category: 'Electronics', report_type: 'found', location_found_lost: 'Library 2F', status: 'active', date_reported: new Date(), image_path: null, reporter_name: 'Juan Dela Cruz' }
    ],
    item: { id: 1, item_name: 'Casio Scientific Calculator', category: 'Electronics', report_type: 'found', location_found_lost: 'Library 2F', status: 'active', date_reported: new Date(), description: 'Calculator found on desk', secret_challenge: 'Color?', secret_answer: 'Black', custody_mode: 'security_desk', reporter_id: 1, reporter_name: 'Juan Dela Cruz' },
    itemImages: [],
    reports: [
      { id: 1, item_name: 'Casio Scientific Calculator', category: 'Electronics', report_type: 'found', location_found_lost: 'Library 2F', status: 'active', date_reported: new Date(), daysActive: 5 }
    ],
    myReports: [
      { id: 1, item_name: 'Casio Scientific Calculator', category: 'Electronics', report_type: 'found', location_found_lost: 'Library 2F', status: 'active', date_reported: new Date(), claims_count: 0 }
    ],
    madeClaims: [],
    receivedClaims: [],
    claim: { id: 1, item_name: 'Casio Calculator', status: 'pending', claimant_id: 1, reporter_id: 99, proof_details: 'Sticker on back' },
    messages: [
      { id: 1, sender_id: 1, message: 'Hello, this is my calculator', sent_at: new Date() }
    ],
    guardianRequests: [],
    guardianLinks: [],
    auditLogs: [],
    logs: [],
    stats: { totalReports: 1, recoveryRate: 85, peerReturns: 10, deskHandovers: 5, totalUsers: 10, lockedQuotas: 0, pendingVerification: 0 },
    users: [user],
    roleCounts: { student: 5, staff: 2, parent: 1, guest: 1, admin: 1 },
    archiveQueue: [],
    verificationHandovers: [],
    verificationQueue: [],
    activeClaimHandovers: [],
    timeAgo: () => '2 hours ago',
    active: 'dashboard',
    step: 'request',
    tab: 'self_service',
    existingClaim: null,
    answerMatchScore: null,
    mfaEnabledForView: false,
    mfaPending: false,
    mfaEmail: '',
    mfaAttemptsRemaining: 5,
    category: role === 'guest' ? 'guest' : 'institution',
    httpStatus: 403,
    statusLabel: 'Forbidden',
    errorTitle: 'Forbidden',
    errorMessage: 'Forbidden error message',
    attemptedPath: '/test',
    returnUrl: '/dashboard',
    returnLabel: 'Back to Dashboard'
  };
}

let currentPage = null;

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/js/') || req.url.startsWith('/css/') || req.url.startsWith('/images/')) {
    const f = path.join(path.resolve('public'), req.url);
    if (fs.existsSync(f)) {
      const ext = path.extname(f);
      const mime = ext === '.css' ? 'text/css' : (ext === '.js' ? 'application/javascript' : (ext === '.png' ? 'image/png' : 'text/plain'));
      res.writeHead(200, { 'Content-Type': mime });
      return fs.createReadStream(f).pipe(res);
    }
  }
  
  if (req.url === '/render' && currentPage) {
    const filePath = path.join(pagesDir, currentPage.name + '.ejs');
    const raw = fs.readFileSync(filePath, 'utf8');
    const locals = getFullLocals(currentPage.role, currentPage.isCatalog);
    try {
      const rendered = ejs.render(raw, locals, { filename: filePath });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(rendered);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end('Render error: ' + e.message);
    }
  }
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, async () => {
  const edgeExe = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const brokenPerPage = {};

  for (const p of pages) {
    currentPage = p;
    const pageLabel = p.name + (p.isCatalog ? ' (catalog)' : '');
    
    await new Promise((resolve) => {
      const proc = spawn(edgeExe, [
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--virtual-time-budget=1500',
        '--dump-dom',
        'http://127.0.0.1:' + PORT + '/render'
      ]);
      
      let dom = '';
      let resolved = false;

      function finish() {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        try { proc.kill(); } catch (_) {}
        const domWithoutScripts = dom.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        const unrendered = domWithoutScripts.match(/<i[^>]*data-lucide="([^"]+)"[^>]*>[^<]*<\/i>/g) || [];
        const unrenderedIcons = unrendered.map(tag => {
          const m = tag.match(/data-lucide="([^"]+)"/);
          return m ? m[1] : tag;
        });
        brokenPerPage[pageLabel] = unrenderedIcons;
        resolve();
      }

      const timer = setTimeout(finish, 2500);
      proc.stdout.on('data', d => dom += d.toString());
      proc.on('close', finish);
      proc.on('error', finish);
    });
  }

  console.log('================================================================');
  console.log('🔍 PRODUCTION ICON INTEGRITY AUDIT (POST-FIX)');
  console.log('================================================================');
  let totalBroken = 0;
  for (const [p, icons] of Object.entries(brokenPerPage)) {
    if (icons.length > 0) {
      console.log(`❌ ${p.padEnd(25)}: ${icons.length} invisible icons! [${icons.join(', ')}]`);
      totalBroken += icons.length;
    } else {
      console.log(`✅ ${p.padEnd(25)}: All icons rendered cleanly.`);
    }
  }
  console.log('================================================================');
  console.log(`Total Invisible Icons Across System: ${totalBroken}`);
  server.close();
  if (totalBroken > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
});
