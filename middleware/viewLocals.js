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

function invalidateUnreadCache(userIds = [], { includeAdmins = false } = {}) {
    const ids = Array.isArray(userIds) ? userIds : [userIds];
    for (const id of ids) {
        if (id !== null && id !== undefined && id !== '') {
            unreadCache.delete(`user:${id}`);
            unreadCache.delete(`admin:${id}`);
        }
    }
    if (includeAdmins) {
        for (const key of unreadCache.keys()) {
            if (key.startsWith('admin:')) {
                unreadCache.delete(key);
            }
        }
    }
}

function invalidateAllUnreadCache() {
    unreadCache.clear();
}

async function viewLocals(req, res, next) {
    const sessionUser = req.session?.user || null;
    const adminFlag = isAdmin(sessionUser);
    res.locals.user = sessionUser;
    res.locals.isAdmin = adminFlag;
    res.locals.unreadNotificationCount = 0;

    if (sessionUser && sessionUser.id) {
        res.locals.unreadNotificationCount = await getUnreadNotificationCount(sessionUser.id, adminFlag);
    }

    next();
}

viewLocals.invalidateUnreadCache = invalidateUnreadCache;
viewLocals.invalidateAllUnreadCache = invalidateAllUnreadCache;

module.exports = viewLocals;
