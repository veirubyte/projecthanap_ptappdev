const claimModel = require('../models/claimModel');
const { isAdmin } = require('../config/roles');

const unreadCache = new Map();
const UNREAD_CACHE_TTL_MS = 30000; // 30 seconds

async function getUnreadNotificationCount(userId, adminFlag = false) {
    if (!userId) return 0;

    const cacheKey = `${adminFlag ? 'admin' : 'user'}:${userId}`;
    const now = Date.now();
    const cached = unreadCache.get(cacheKey);
    if (cached && (now - cached.timestamp < UNREAD_CACHE_TTL_MS)) {
        return cached.count;
    }

    try {
        const [rows] = adminFlag
            ? await claimModel.getAdminNotificationCount([], [])
            : await claimModel.getUnreadNotificationCount([userId, userId], []);
        const count = Number(rows[0]?.unread_count || 0);

        unreadCache.set(cacheKey, { count, timestamp: now });
        if (unreadCache.size > 2000) {
            const oldest = unreadCache.keys().next().value;
            unreadCache.delete(oldest);
        }

        return count;
    } catch (error) {
        console.error('Error loading unread notification count:', error);
        return cached ? cached.count : 0;
    }
}

async function viewLocals(req, res, next) {
    const adminFlag = isAdmin(req.session.user);
    res.locals.user = req.session.user || null;
    res.locals.isAdmin = adminFlag;
    res.locals.unreadNotificationCount = 0;

    if (req.session.user && req.session.user.id) {
        res.locals.unreadNotificationCount = await getUnreadNotificationCount(req.session.user.id, adminFlag);
    }

    next();
}

module.exports = viewLocals;
