const db = require('../config/db');

async function register(params, values = [], connection = db) {
    return connection.execute(`INSERT INTO guardian_student_links (guardian_user_id, student_user_id, status)
                     VALUES (?, ?, 'pending')`, params);
}

async function showSettings(params, values = [], connection = db) {
    return connection.execute(`SELECT gsl.id, gsl.status, gsl.requested_at, u.full_name AS guardian_name, u.email AS guardian_email
                 FROM guardian_student_links gsl
                 JOIN users u ON u.id = gsl.guardian_user_id
                 WHERE gsl.student_user_id = ? AND gsl.status = 'pending'
                 ORDER BY gsl.requested_at DESC`, params);
}

async function showSettingsQuery2(params, values = [], connection = db) {
    return connection.execute(`SELECT gsl.id, gsl.status, gsl.requested_at, gsl.responded_at,
                        u.full_name AS student_name, u.email AS student_email
                 FROM guardian_student_links gsl
                 JOIN users u ON u.id = gsl.student_user_id
                 WHERE gsl.guardian_user_id = ?
                 ORDER BY gsl.requested_at DESC`, params);
}

async function createGuardianLink(params, values = [], connection = db) {
    return connection.execute(`SELECT id, status
             FROM guardian_student_links
             WHERE guardian_user_id = ? AND student_user_id = ?
             FOR UPDATE`, params);
}

async function createGuardianLinkQuery2(params, values = [], connection = db) {
    return connection.execute(`UPDATE guardian_student_links
                 SET status = 'pending', requested_at = CURRENT_TIMESTAMP, responded_at = NULL
                 WHERE id = ?`, params);
}

async function createGuardianLinkQuery3(params, values = [], connection = db) {
    return connection.execute(`INSERT INTO guardian_student_links (guardian_user_id, student_user_id, status)
                 VALUES (?, ?, 'pending')`, params);
}

async function decideGuardianLink(params, values = [], connection = db) {
    return connection.execute(`SELECT id, guardian_user_id
             FROM guardian_student_links
             WHERE id = ? AND student_user_id = ? AND status = 'pending'
             FOR UPDATE`, params);
}

async function decideGuardianLinkQuery2(params, values = [], connection = db) {
    return connection.execute(`UPDATE guardian_student_links
             SET status = ?, responded_at = CURRENT_TIMESTAMP
             WHERE id = ?`, params);
}

async function updateUserRole(params, values = [], connection = db) {
    return connection.execute(`SELECT id FROM guardian_student_links
             WHERE guardian_user_id = ? AND status = 'approved'
             LIMIT 1`, params);
}

module.exports = {
    register,
    showSettings,
    showSettingsQuery2,
    createGuardianLink,
    createGuardianLinkQuery2,
    createGuardianLinkQuery3,
    decideGuardianLink,
    decideGuardianLinkQuery2,
    updateUserRole
};
