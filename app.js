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

require('dotenv').config({ path: path.join(__dirname, '.env') });

const sessionSecret = process.env.SESSION_SECRET || 'project_hanap_secret_dev_key_2026';

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
}

const { rateLimiter, csrfTokenInjector, csrfProtection } = require('./config/security');
const viewLocals = require('./middleware/viewLocals');
const { reportUploadBeforeCsrf } = require('./middleware/reportUpload');

const app = express();

// Security headers with CSP tailored for Tailwind CDN and Google Fonts
app.use(helmet({
    strictTransportSecurity: process.env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
            imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
            connectSrc: ["'self'"],
            upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
        }
    }
}));

// Body parsers and static files
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// View engine (supports both views/pages/*.ejs and views/*.ejs lookups)
app.set('view engine', 'ejs');
app.set('views', [
    path.join(__dirname, 'views', 'pages'),
    path.join(__dirname, 'views')
]);

// Session
app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
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
        user: req.session.user || null,
        returnUrl: req.session.user && ['admin', 'administrator'].includes(String(req.session.user.role || '').toLowerCase())
            ? '/admin/dashboard'
            : '/dashboard'
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
        user: req.session.user || null
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
