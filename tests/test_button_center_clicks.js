const http = require('http');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const { spawn } = require('child_process');

const PORT = 4880;
const edgeExe = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const viewsDir = path.resolve('views');
const pagesDir = path.join(viewsDir, 'pages');

const pagesToTest = [
  { name: 'login', role: 'guest', step: null, selector: '[data-password-field="password"]', label: 'Login Password Eye' },
  { name: 'register', role: 'guest', step: null, selector: '[data-password-field="password"]', label: 'Register Password Eye' },
  { name: 'register', role: 'guest', step: null, selector: '[data-password-field="confirm_password"]', label: 'Register Confirm Eye' },
  { name: 'forgotPassword', role: 'guest', step: 'reset', selector: '[data-password-toggle="new_password"]', label: 'Forgot PW New Eye' },
  { name: 'reportItem', role: 'student', step: null, selector: '.toggle-answer-btn', label: 'Report Item Secret Answer Eye' },
  { name: 'settings', role: 'student', step: null, selector: '[data-password-toggle="currentPassword"]', label: 'Settings Current PW Eye', prepare: 'document.querySelectorAll(".settings-panel").forEach(function(p) { p.classList.remove("hidden"); });' },
  { name: 'dashboard', role: 'student', step: null, selector: '[data-theme-toggle]', label: 'Navbar Dark Mode Toggle' }
];

function getLocals(role, step) {
  const user = {
    id: 1,
    full_name: 'Juan Dela Cruz',
    email: 'juan@my.cspc.edu.ph',
    role: 'student',
    student_id: '2023-0001',
    phone: '09123456789'
  };
  return {
    user,
    profileUser: user,
    isAdmin: false,
    isCatalog: false,
    categories: ['Electronics', 'Keys & Lanyards'],
    categoryCounts: {},
    unreadNotificationCount: 0,
    csrfToken: 'token',
    resetToken: 'test-reset-token',
    msg: null,
    error: null,
    filters: {},
    items: [{ id: 1, item_name: 'Casio', category: 'Electronics', report_type: 'found', location_found_lost: 'Hall', status: 'active', date_reported: new Date() }],
    item: { id: 1, secret_challenge: 'Color?', secret_answer: 'Black', custody_mode: 'security_desk' },
    itemImages: [],
    reports: [],
    myReports: [],
    madeClaims: [],
    receivedClaims: [],
    claim: null,
    messages: [],
    guardianRequests: [],
    guardianLinks: [],
    auditLogs: [],
    logs: [],
    stats: {},
    users: [],
    roleCounts: {},
    archiveQueue: [],
    verificationHandovers: [],
    verificationQueue: [],
    activeClaimHandovers: [],
    timeAgo: () => 'now',
    active: 'dashboard',
    step: step || 'request',
    tab: 'self_service',
    existingClaim: null,
    answerMatchScore: null,
    mfaEnabledForView: false,
    mfaPending: false,
    mfaEmail: '',
    mfaAttemptsRemaining: 5,
    category: 'institution'
  };
}

let activeConfig = null;

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

  if (req.url === '/test' && activeConfig) {
    const filePath = path.join(pagesDir, activeConfig.name + '.ejs');
    const raw = fs.readFileSync(filePath, 'utf8');
    let rendered = ejs.render(raw, getLocals(activeConfig.role, activeConfig.step), { filename: filePath });
    
    const probeScript = `
    <div id="hitTestResult" style="display:none;"></div>
    <script>
      window.addEventListener('load', function() {
        setTimeout(function() {
          ${activeConfig.prepare || ''}
          var btn = document.querySelector('${activeConfig.selector}');
          if (!btn) {
            document.getElementById('hitTestResult').textContent = JSON.stringify({ error: 'Button not found: ${activeConfig.selector}' });
            return;
          }
          btn.scrollIntoView({ block: 'center', inline: 'center' });
          var rect = btn.getBoundingClientRect();
          var cx = rect.left + rect.width / 2;
          var cy = rect.top + rect.height / 2;
          var centerEl = document.elementFromPoint(cx, cy);
          var pointerEventsOnChild = 'none';
          var childIcon = btn.querySelector('[data-lucide], svg, span, i');
          if (childIcon) {
            pointerEventsOnChild = window.getComputedStyle(childIcon).pointerEvents;
          }
          
          var clickRegistered = false;
          function onClick(e) { clickRegistered = true; }
          btn.addEventListener('click', onClick);
          
          if (centerEl) {
            centerEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          }
          
          document.getElementById('hitTestResult').textContent = JSON.stringify({
            buttonTag: btn.tagName,
            buttonSelector: '${activeConfig.selector}',
            btnRect: { width: rect.width, height: rect.height },
            centerElTag: centerEl ? centerEl.tagName : null,
            centerElIsInsideButton: centerEl ? btn.contains(centerEl) : false,
            centerElIsButtonItself: centerEl === btn,
            pointerEventsOnChild: pointerEventsOnChild,
            clickRegistered: clickRegistered
          });
        }, 500);
      });
    </script>
    `;
    rendered = rendered.replace('</body>', probeScript + '</body>');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(rendered);
  }

  res.writeHead(404);
  res.end();
});

async function runAll() {
  await new Promise(r => server.listen(PORT, r));
  console.log('================================================================');
  console.log('🎯 DEAD-CENTER BUTTON HIT-TARGET & CLICK RESPONSIVENESS AUDIT');
  console.log('================================================================');

  let failedCount = 0;

  for (const tc of pagesToTest) {
    activeConfig = tc;
    const dom = await new Promise((resolve) => {
      const proc = spawn(edgeExe, [
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--window-size=1280,1024',
        '--virtual-time-budget=2500',
        '--dump-dom',
        `http://127.0.0.1:${PORT}/test`
      ]);
      let out = '';
      proc.stdout.on('data', d => out += d.toString());
      proc.on('close', () => resolve(out));
      setTimeout(() => {
        try { proc.kill(); } catch (_) {}
        resolve(out);
      }, 4000);
    });

    const match = dom.match(/<div id="hitTestResult"[^>]*>([\s\S]*?)<\/div>/);
    if (!match || !match[1].trim()) {
      console.log(`❌ ${tc.label.padEnd(35)}: Failed to extract hit test result`);
      failedCount++;
      continue;
    }

    try {
      const result = JSON.parse(match[1].trim());
      if (result.error) {
        console.log(`❌ ${tc.label.padEnd(35)}: ${result.error}`);
        failedCount++;
      } else {
        const pass = result.clickRegistered && (result.centerElIsButtonItself || result.centerElIsInsideButton);
        const iconPass = result.pointerEventsOnChild === 'none';
        if (pass && iconPass) {
          console.log(`✅ ${tc.label.padEnd(35)}: Size: ${Math.round(result.btnRect.width)}x${Math.round(result.btnRect.height)}px | Center: ${result.centerElTag} | Clicks Center: OK | Icon pointer-events: none`);
        } else {
          console.log(`❌ ${tc.label.padEnd(35)}: Result: ${JSON.stringify(result)}`);
          failedCount++;
        }
      }
    } catch (e) {
      console.log(`❌ ${tc.label.padEnd(35)}: Parse error: ${e.message}`);
      failedCount++;
    }
  }

  console.log('================================================================');
  server.close();
  if (failedCount > 0) {
    console.log(`TOTAL FAILED TESTS: ${failedCount}`);
    process.exit(1);
  } else {
    console.log('🏆 ALL BUTTON HIT-TARGET & CENTER CLICK CHECKS PASSED PERFECTLY!');
    process.exit(0);
  }
}

runAll();
