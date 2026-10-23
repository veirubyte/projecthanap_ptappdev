/**
 * Authentication & Role Authorization Middleware
 * Project HANAP - Campus System Round 1
 * 
 * Protects private routes and enforces role-based access control (RBAC).
 */

/**
 * Ensures user is authenticated via active session before proceeding.
 * Redirects unauthenticated users to login or returns 401 for API calls.
 */
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }

  // Handle API/JSON requests
  if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Active user session required.'
    });
  }

  // Store return URL in session for post-login redirect
  req.session.returnTo = req.originalUrl;
  return res.redirect('/auth/login?error=Please log in to access this page');
}

/**
 * Restricts access to users having one of the specified allowed roles.
 * Blocks unauthorized users from bypassing role restrictions via direct URL entry.
 * 
 * @param  {...string} allowedRoles List of roles permitted to access the route (e.g. 'Admin', 'Staff', 'Student')
 */
function authorizeRole(...allowedRoles) {
  return (req, res, next) => {
    // 1. Ensure user is logged in
    if (!req.session || !req.session.user) {
      if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Active session required.'
        });
      }
      return res.redirect('/auth/login?error=Authentication required');
    }

    const userRole = req.session.user.role;
    const normalizedAllowed = allowedRoles.map(r => r.toLowerCase());

    // 2. Validate role against allowed roles
    if (!userRole || !normalizedAllowed.includes(userRole.toLowerCase())) {
      if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Access restricted. Requires role in [${allowedRoles.join(', ')}].`
        });
      }

      // Render 403 Forbidden template or return error response
      return res.status(403).render('pages/error', {
        title: '403 Forbidden - Access Denied',
        statusCode: 403,
        errorMessage: 'You do not have permission to view or access this administrative resource.',
        user: req.session.user
      });
    }

    // Role authorized
    return next();
  };
}

/**
 * Ensures guest status (prevents already logged-in users from accessing login/register).
 */
function isGuest(req, res, next) {
  if (req.session && req.session.user) {
    return res.redirect('/');
  }
  return next();
}

module.exports = {
  isAuthenticated,
  authorizeRole,
  isGuest
};
