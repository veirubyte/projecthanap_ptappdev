const http = require('http');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const { spawn } = require('child_process');

const PORT = 4567;
const viewsDir = path.join(__dirname, '../views');
const pagesDir = path.join(viewsDir, 'pages');
const artifactsDir = 'C:\\Users\\Zien\\.gemini\\antigravity\\brain\\384f2c8b-8a84-49a4-8fb1-a61156b92fb0';
const publicDir = path.join(__dirname, '../public');

// Mock data builder for any page
function getMockLocals(pageName, role = 'student') {
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

  return {
    user: user,
    isAdmin: isAdmin,
    unreadNotificationCount: 2,
    csrfToken: 'test-token',
    flash: { success: [], error: [] },
    currentPath: '/' + pageName.replace('.ejs', ''),
    siteTitle: 'Project HANAP',
    env: 'development',
    timeAgo: () => '1 hour ago',
    active: 'dashboard',
    isCatalog: pageName === 'dashboard.ejs' && false,
    mfaPending: false,
    mfaEmail: 'juan@my.cspc.edu.ph',
    mfaRemainingAttempts: 3,
    query: {},
    msg: null,
    err: null,
    items: [
      { id: 101, title: 'Casio Scientific Calculator FX-991CW', category_name: 'Electronics', status: 'active', report_type: 'found', location_found: 'Library 2nd Floor', created_at: new Date(), primary_image: '/images/logo-icon.png', finder_name: 'Maria Santos', private_question: 'What stickers are on the back?' },
      { id: 102, title: 'Black Leather Bifold Wallet', category_name: 'Personal Accessories', status: 'active', report_type: 'lost', location_lost: 'Gymnasium Bleachers', created_at: new Date(), primary_image: '/images/logo-icon.png', private_question: 'What initials are engraved?' }
    ],
    item: { id: 101, title: 'Casio Scientific Calculator FX-991CW', category_name: 'Electronics', status: 'active', report_type: 'found', location_found: 'Library 2nd Floor', created_at: new Date(), primary_image: '/images/logo-icon.png', finder_name: 'Maria Santos', private_question: 'What stickers are on the back?' },
    itemImages: [{ image_path: '/images/logo-icon.png' }],
    primaryReportImage: '/images/logo-icon.png',
    existingClaim: null,
    answerMatchScore: null,
    metrics: { totalReports: 24, activeReports: 12, resolvedClaims: 8, pendingHandover: 3, vaulted: 5, guestClaims: 2, disputes: 1, overdue: 4 },
    stats: { totalReports: 24, activeReports: 12, resolvedClaims: 8, pendingHandover: 3, vaulted: 5, guestClaims: 2, disputes: 1, overdue: 4 },
    smartMatches: [{ id: 101, title: 'Casio Scientific Calculator FX-991CW', category_name: 'Electronics', location_found: 'Library 2nd Floor', match_confidence: 94 }],
    postedItems: [{ id: 101, title: 'Casio Scientific Calculator FX-991CW', category_name: 'Electronics', status: 'active', report_type: 'found', created_at: new Date() }],
    claims: [
      { id: 50, item_id: 101, item_title: 'Casio Scientific Calculator FX-991CW', claimant_name: 'Juan Dela Cruz', reporter_name: 'Maria Santos', status: 'pending', created_at: new Date() },
      { id: 51, item_id: 102, item_title: 'Black Leather Bifold Wallet', claimant_name: 'Juan Dela Cruz', reporter_name: 'Carlos Rivera', status: 'approved', created_at: new Date() }
    ],
    receivedClaims: [],
    madeClaims: [
      { id: 50, item_id: 101, item_title: 'Casio Scientific Calculator FX-991CW', status: 'pending', created_at: new Date() }
    ],
    claimsMade: [
      { id: 50, item_id: 101, item_title: 'Casio Scientific Calculator FX-991CW', status: 'pending', created_at: new Date() }
    ],
    myReports: [{ id: 101, title: 'Casio Scientific Calculator FX-991CW', category_name: 'Electronics', status: 'active', report_type: 'found', created_at: new Date() }],
    guardianRequests: [],
    guardianLinks: [],
    claim: { id: 50, item_id: 101, claimant_id: 1, claimant_name: 'Juan Dela Cruz', reporter_name: 'Maria Santos', status: 'pending', created_at: new Date() },
    userIsClaimant: true,
    userIsFinder: false,
    messages: [
      { id: 1, sender_id: 1, sender_name: 'Juan Dela Cruz', message: 'Hello! I lost this calculator during math finals.', created_at: new Date() },
      { id: 2, sender_id: 2, sender_name: 'Maria Santos', message: 'Hi Juan! Please describe the stickers on the back.', created_at: new Date() }
    ],
    chatMessages: [
      { id: 1, sender_id: 1, sender_name: 'Juan Dela Cruz', message: 'Hello! I lost this calculator during math finals.', created_at: new Date() },
      { id: 2, sender_id: 2, sender_name: 'Maria Santos', message: 'Hi Juan! Please describe the stickers on the back.', created_at: new Date() }
    ],
    users: [
      { id: 1, full_name: 'Juan Dela Cruz', email: 'juan@my.cspc.edu.ph', role: 'student', active_reports_count: 1, created_at: new Date() }
    ],
    reports: [
      { id: 101, title: 'Casio Scientific Calculator FX-991CW', category_name: 'Electronics', report_type: 'found', status: 'active', days_open: 65, is_eligible_archive: true, created_at: new Date() }
    ],
    auditLogs: [
      { id: 1, user_email: 'admin.hanap@cspc.edu.ph', action: 'PHYSICAL_CUSTODY_RELEASE', details: 'Claim #50 property release confirmed', ip_address: '127.0.0.1', created_at: new Date() }
    ],
    filters: { q: '', type: '', category: '', period: '', status: '' },
    pagination: { current: 1, total: 1, hasPrev: false, hasNext: false },
    categories: ['Electronics', 'Identification', 'Personal Accessories', 'Bags', 'Keys', 'Documents']
  };
}

const auditResults = [];

// Audit probe injection
const auditProbeScript = `
<script id="mobile-audit-probe">
(function() {
  function runMobileAudit() {
    const docWidth = document.documentElement.clientWidth;
    const bodyWidth = document.body ? document.body.clientWidth : docWidth;
    const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
    const overflowingElements = [];

    document.querySelectorAll('*').forEach(function(el) {
      if (['SCRIPT', 'STYLE', 'LINK', 'META', 'HEAD', 'TITLE', 'NOSCRIPT'].includes(el.tagName)) return;
      const rect = el.getBoundingClientRect();
      if (rect.right > docWidth + 3 || rect.left < -3) {
        overflowingElements.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || '',
          className: (el.className || '').toString().slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          overflowPx: Math.round(rect.right - docWidth)
        });
      }
    });

    // Touch targets check (< 44x44px for buttons and links)
    const smallTouchTargets = [];
    document.querySelectorAll('button, a, input, select').forEach(function(el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && (rect.width < 32 || rect.height < 32)) {
        smallTouchTargets.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || el.value || '').trim().slice(0, 30),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        });
      }
    });

    const payload = {
      url: window.location.href,
      clientWidth: docWidth,
      scrollWidth: scrollWidth,
      hasHorizontalOverflow: scrollWidth > docWidth + 2,
      overflowPx: Math.max(0, scrollWidth - docWidth),
      overflowingCount: overflowingElements.length,
      topOverflowing: overflowingElements.slice(0, 5),
      smallTouchCount: smallTouchTargets.length,
      topSmallTouch: smallTouchTargets.slice(0, 3)
    };

    fetch('/audit-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(function(err) {});
  }

  if (document.readyState === 'complete') {
    setTimeout(runMobileAudit, 400);
  } else {
    window.addEventListener('load', function() {
      setTimeout(runMobileAudit, 400);
    });
  }
})();
</script>
`;

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/audit-report') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        auditResults.push(data);
        console.log('[AUDIT PROBE REPORTED]:', data.url, 'Overflow:', data.hasHorizontalOverflow ? (data.overflowPx + 'px') : 'NONE (PASS)');
      } catch (e) {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"status":"ok"}');
    });
    return;
  }

  // Static assets
  if (req.url.startsWith('/css/') || req.url.startsWith('/js/') || req.url.startsWith('/images/')) {
    const filePath = path.join(publicDir, req.url);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath);
      const mime = ext === '.css' ? 'text/css' : (ext === '.js' ? 'application/javascript' : (ext === '.png' ? 'image/png' : 'text/plain'));
      res.writeHead(200, { 'Content-Type': mime });
      return fs.createReadStream(filePath).pipe(res);
    }
  }

  // Render view
  const urlParts = req.url.split('?');
  const viewPath = urlParts[0].replace('/view/', '');
  const params = new URLSearchParams(urlParts[1] || '');
  const role = params.get('role') || 'student';
  const theme = params.get('theme') || 'light';

  const ejsFile = path.join(pagesDir, viewPath + '.ejs');
  if (fs.existsSync(ejsFile)) {
    try {
      const locals = getMockLocals(viewPath + '.ejs', role);
      if (params.get('isCatalog') === '1') locals.isCatalog = true;

      ejs.renderFile(ejsFile, locals, { root: viewsDir }, (err, str) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          return res.end('Render error: ' + err.message);
        }

        // Apply theme and inject audit probe
        let html = str;
        if (theme === 'dark') {
          html = html.replace('<html', '<html class="dark"');
        }
        html = html.replace('</body>', auditProbeScript + '</body>');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      });
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server exception: ' + e.message);
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Page not found');
  }
});

server.listen(PORT, async () => {
  console.log('Audit server ready on http://127.0.0.1:' + PORT);

  const edgeExe = 'C:\\Program Files (x86)\\Microsoft\Edge\\Application\\msedge.exe';
  const chromeExe = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
  const browserExe = fs.existsSync(edgeExe) ? edgeExe : chromeExe;

  // Pages to audit at 375x812 (iPhone SE mobile size)
  const auditList = [
    { page: 'landing', role: 'guest', name: '01_landing' },
    { page: 'login', role: 'guest', name: '02_login' },
    { page: 'register', role: 'guest', name: '03_register' },
    { page: 'forgotPassword', role: 'guest', name: '04_forgot_password' },
    { page: 'guestClaim', role: 'guest', name: '05_guest_claim' },
    { page: 'dashboard', role: 'student', name: '06_student_dashboard' },
    { page: 'dashboard', role: 'student', isCatalog: '1', name: '07_public_catalog' },
    { page: 'postDetail', role: 'student', name: '08_post_detail' },
    { page: 'reportItem', role: 'student', name: '09_report_item' },
    { page: 'editReport', role: 'student', name: '10_edit_report' },
    { page: 'claims', role: 'student', name: '11_claims_hub' },
    { page: 'chat', role: 'student', name: '12_claim_chat' },
    { page: 'myReports', role: 'student', name: '13_my_reports' },
    { page: 'settings', role: 'student', name: '14_user_settings' },
    { page: 'adminDashboard', role: 'admin', name: '15_admin_dashboard' },
    { page: 'custodyHandover', role: 'admin', name: '16_admin_custody_handover' },
    { page: 'adminReports', role: 'admin', name: '17_admin_reports' },
    { page: 'adminUsers', role: 'admin', name: '18_admin_users' },
    { page: 'adminAnalytics', role: 'admin', name: '19_admin_analytics' },
    { page: 'adminAuditLogs', role: 'admin', name: '20_admin_audit_logs' }
  ];

  console.log('--- STARTING COMPREHENSIVE 375px PHONE VIEW AUDIT ---');

  for (const item of auditList) {
    const isCat = item.isCatalog ? '&isCatalog=1' : '';
    const url = 'http://127.0.0.1:' + PORT + '/view/' + item.page + '?role=' + item.role + isCat;
    const shotPath = path.join(artifactsDir, 'mobile_screen_' + item.name + '.png');

    await new Promise((resolve) => {
      const args = [
        '--headless=new',
        '--disable-gpu',
        '--virtual-time-budget=2500',
        '--window-size=375,812',
        '--screenshot=' + shotPath,
        url
      ];

      const proc = spawn(browserExe, args);
      proc.on('close', () => {
        resolve();
      });
    });
  }

  // Allow last probe POST to arrive
  setTimeout(() => {
    console.log('================================================================');
    console.log('📊 AUDIT SUMMARY: ' + auditResults.length + ' pages evaluated in 375px phone view');
    console.log('================================================================');
    const failures = auditResults.filter(r => r.hasHorizontalOverflow);
    console.log('Pages with Horizontal Overflow (>375px): ' + failures.length);
    failures.forEach(f => {
      console.log('  ⚠️ ' + f.url + ' -> +' + f.overflowPx + 'px overflow (' + f.scrollWidth + 'px total).');
      if (f.topOverflowing.length > 0) {
        console.log('     Leading cause: <' + f.topOverflowing[0].tag + '> class="' + f.topOverflowing[0].className + '" (width: ' + f.topOverflowing[0].width + 'px, overflow: +' + f.topOverflowing[0].overflowPx + 'px)');
      }
    });

    fs.writeFileSync(path.join(artifactsDir, 'mobile_audit_report.json'), JSON.stringify(auditResults, null, 2));
    server.close();
    process.exit(0);
  }, 1500);
});

