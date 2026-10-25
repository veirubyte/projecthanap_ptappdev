const { isAdmin } = require('../config/roles');

const ACCESS_DENIED_MESSAGE = 'Your current account does not have permission to access this page. Please sign in with an authorized account.';

function renderAccessDenied(req, res, options) {
    return res.status(403).render('403', {
        user: req.session.user,
        attemptedPath: req.originalUrl,
        ...options
    });
}

function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.redirect(`/login?msg=${encodeURIComponent('Please sign in to access this feature.')}`);
    }
    next();
}

function denyAdmin(req, res, next) {
    if (req.session.user && isAdmin(req.session.user)) {
        return renderAccessDenied(req, res, {
            errorTitle: 'User Dashboard Access Only',
            errorMessage: 'Administrator accounts cannot access student, staff, or parent pages.',
            returnUrl: '/admin/dashboard',
            returnLabel: 'Back to Admin Dashboard'
        });
    }
    next();
}

function requireNonAdminAuth(req, res, next) {
    if (!req.session.user) {
        return res.redirect(`/login?msg=${encodeURIComponent('Please sign in to access this feature.')}`);
    }
    if (isAdmin(req.session.user)) return denyAdmin(req, res, next);
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.user) {
        return res.redirect(`/login?msg=${encodeURIComponent('Please sign in with an administrator account to access this page.')}`);
    }
    if (!isAdmin(req.session.user)) {
        return renderAccessDenied(req, res, {
            errorTitle: 'Admin Access Only',
            errorMessage: ACCESS_DENIED_MESSAGE,
            returnUrl: '/dashboard',
            returnLabel: 'Back to Dashboard'
        });
    }
    next();
}

module.exports = { requireAuth, denyAdmin, requireNonAdminAuth, requireAdmin };
