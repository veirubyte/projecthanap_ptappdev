const claimModel = require('../models/claimModel');
const { isAdmin } = require('../config/roles');

async function getUnreadNotificationCount(userId) {
    if (!userId) return 0;

    try {
        const [rows] = await claimModel.getUnreadNotificationCount([userId, userId], []);

        return Number(rows[0]?.unread_count || 0);
    } catch (error) {
        console.error('Error loading unread notification count:', error);
        return 0;
    }
}

async function viewLocals(req, res, next) {
    res.locals.user = req.session.user || null;
    res.locals.isAdmin = isAdmin(req.session.user);
    res.locals.unreadNotificationCount = 0;

    if (req.session.user && req.session.user.id) {
        res.locals.unreadNotificationCount = await getUnreadNotificationCount(req.session.user.id);
    }

    next();
}

module.exports = viewLocals;
