const { isAdmin } = require('../config/roles');

const ACCESS_DENIED_MESSAGE = 'Your current account does not have permission to access this page. Please sign in with an authorized account.';

function redirectForAccessDenied(res) {
    return res.redirect(`/login?accessDenied=1&msg=${encodeURIComponent(ACCESS_DENIED_MESSAGE)}`);
}

function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.redirect(`/login?msg=${encodeURIComponent('Please sign in to access this feature.')}`);
    }
    next();
}

function requireNonAdminAuth(req, res, next) {
    if (!req.session.user) {
        return res.redirect(`/login?msg=${encodeURIComponent('Please sign in to access this feature.')}`);
    }
    if (isAdmin(req.session.user)) {
        return res.status(403).render('403', {
            user: req.session.user,
            attemptedPath: req.originalUrl,
            errorTitle: 'User Pages Restricted',
            errorMessage: 'Administrator accounts cannot access student, staff, parent, or guest pages and workflows.',
            returnUrl: '/admin/dashboard',
            returnLabel: 'Back to Admin Dashboard'
        });
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.user) {
        return res.redirect(`/login?msg=${encodeURIComponent('Please sign in with an administrator account to access this page.')}`);
    }
    if (!isAdmin(req.session.user)) return redirectForAccessDenied(res);
    next();
}

module.exports = { requireAuth, requireNonAdminAuth, requireAdmin };
