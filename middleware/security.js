const {
    rateLimiter,
    csrfTokenInjector,
    csrfProtection
} = require('../config/security');

function csrfProtectionExcept(exemptPaths = []) {
    const exemptPathSet = new Set(exemptPaths);

    return (req, res, next) => {
        if (exemptPathSet.has(req.path)) {
            return next();
        }

        return csrfProtection(req, res, next);
    };
}

module.exports = {
    rateLimiter,
    csrfTokenInjector,
    csrfProtection,
    csrfProtectionExcept
};
