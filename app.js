/**
 * Project HANAP - Campus System Round 1
 * Core Express Application Entrypoint
 * 
 * Modular MVC Architecture:
 * - config/      : Database and environment configuration
 * - controllers/ : Request handlers and business logic
 * - middleware/  : Authentication and server-side validation
 * - models/      : Data access objects and schemas
 * - routes/      : Express route definitions
 * - views/       : EJS presentation templates (partials and pages)
 * - public/      : Static assets (CSS, JS, images)
 */
const express = require('express');
const session = require('express-session');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const sessionSecret = process.env.SESSION_SECRET || 'project_hanap_secret_dev_key_2026';

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
}

const fs = require('fs');
const { rateLimiter, csrfTokenInjector, csrfProtection } = require('./config/security');
const viewLocals = require('./middleware/viewLocals');
const { reportUploadBeforeCsrf } = require('./middleware/reportUpload');
const DatabaseSessionStore = require('./config/sessionStore');
const sessionStore = new DatabaseSessionStore();
const pool = require('./config/db');

const app = express();
app.set('trust proxy', 1);

// HTTP response compression (reduces payload transfers by up to 75%)
app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
    }
}));

// Security headers with CSP tailored for Tailwind CDN and Google Fonts
app.use(helmet({
    strictTransportSecurity: process.env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com", "https://unpkg.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
            imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
            connectSrc: ["'self'"],
            upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
        }
    }
}));

// Body parsers and high-performance cached static files
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const staticOptions = {
    maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
    etag: true,
    lastModified: true
};
app.use(express.static(path.join(__dirname, 'public'), staticOptions));
app.use(express.static(path.join(process.cwd(), 'public'), staticOptions));

// Dynamic image route with serverless Supabase database fallback
app.get('/uploads/:filename', async (req, res, next) => {
    const filename = path.basename(req.params.filename);
    const localPath = path.join(__dirname, 'public', 'uploads', filename);
    const tmpPath = path.join('/tmp', 'uploads', filename);

    if (fs.existsSync(localPath)) return res.sendFile(localPath);
    if (process.env.VERCEL && fs.existsSync(tmpPath)) return res.sendFile(tmpPath);

    try {
        const [rows] = await pool.execute(
            'SELECT file_data FROM item_report_images WHERE image_path LIKE ? AND file_data IS NOT NULL LIMIT 1',
            [`%${filename}%`]
        );
        if (rows && rows.length > 0 && rows[0].file_data) {
            const rawData = rows[0].file_data;
            const match = rawData.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
                const mime = match[1];
                const buffer = Buffer.from(match[2], 'base64');
                res.setHeader('Content-Type', mime);
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                return res.send(buffer);
            }
        }
    } catch (e) {
        // Fallback to next
    }
    return res.status(404).send('Image not found');
});

if (process.env.VERCEL) {
    app.use('/uploads', express.static(path.join('/tmp', 'uploads')));
}

// View engine (supports both views/pages/*.ejs and views/*.ejs lookups)
app.set('view engine', 'ejs');
app.set('views', [
    path.join(__dirname, 'views', 'pages'),
    path.join(__dirname, 'views'),
    path.join(process.cwd(), 'views', 'pages'),
    path.join(process.cwd(), 'views')
]);

// Persistent session management
app.use(session({
    store: sessionStore,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
}));

// Attach view locals (user, isAdmin, unreadNotificationCount)
app.use(viewLocals);

// Parse multipart/form-data report uploads before CSRF verification
app.use(reportUploadBeforeCsrf);

// CSRF token injector
app.use(csrfTokenInjector);

// Global CSRF check with auth exemptions
const CSRF_EXEMPT = new Set([
    '/login', 
    '/register', 
    '/logout',
    '/forgot-password',
    '/forgot-password/request',
    '/forgot-password/verify',
    '/forgot-password/reset',
    '/forgot-password/resend'
]);
app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (CSRF_EXEMPT.has(req.path)) return next();
    return csrfProtection(req, res, next);
});

// Rate limiters on auth endpoints
const loginLimiter = rateLimiter({ max: 20, windowMs: 15 * 60 * 1000 });
const registerLimiter = rateLimiter({ max: 10, windowMs: 60 * 60 * 1000 });
const resetLimiter = rateLimiter({ max: 15, windowMs: 15 * 60 * 1000 });
app.post('/login', loginLimiter);
app.post('/register', registerLimiter);
app.post('/forgot-password/request', resetLimiter);
app.post('/forgot-password/verify', resetLimiter);
app.post('/forgot-password/reset', resetLimiter);
app.post('/forgot-password/resend', resetLimiter);

// Application Routes
app.use('/', require('./routes/homeRoutes'));
app.use('/', require('./routes/authRoutes'));
app.use('/api/assistant', require('./routes/assistantRoutes'));
app.use('/', require('./routes/itemRoutes'));

// 404 Not Found Handler
app.use((req, res) => {
    res.status(404).render('403', {
        httpStatus: 404,
        statusLabel: 'Not Found',
        errorTitle: 'Page Not Found',
        errorMessage: 'The requested campus page or resource could not be found.',
        attemptedPath: req.originalUrl,
        user: req.session?.user || null,
        returnUrl: req.session?.user
            ? (['admin', 'administrator'].includes(String(req.session.user.role || '').toLowerCase()) ? '/admin/dashboard' : '/dashboard')
            : '/'
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('[SERVER ERROR]:', err.stack || err);
    if (res.headersSent) return next(err);
    res.status(err.status || 500).render('403', {
        httpStatus: err.status || 500,
        statusLabel: 'Error',
        errorTitle: 'Request Could Not Be Completed',
        errorMessage: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected server error occurred.',
        attemptedPath: req.originalUrl,
        user: req.session?.user || null,
        returnUrl: req.session?.user
            ? (['admin', 'administrator'].includes(String(req.session.user.role || '').toLowerCase()) ? '/admin/dashboard' : '/dashboard')
            : '/'
    });
});

if (require.main === module) {
    app.listen(port, () => {
        console.log(`================================================================`);
        console.log(`🚀 Project HANAP Server active on http://localhost:${port}`);
        console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`================================================================`);
    });

    // Daily background job: archives item reports active for more than 60 days
    const { flagStaleItems } = require('./services/lifecycle');
    setInterval(() => {
        flagStaleItems().catch((e) => console.error('Lifecycle job error:', e));
    }, 24 * 60 * 60 * 1000);
}

module.exports = app;
