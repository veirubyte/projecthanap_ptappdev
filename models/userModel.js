const db = require('../config/db');

async function login(params, values = [], connection = db) {
    return connection.execute(`SELECT u.id, u.full_name, u.email, u.password_hash, ar.role_code AS role
             FROM users u
             JOIN account_roles ar ON ar.id = u.role_id
             WHERE LOWER(u.email) = LOWER(?)`, params);
}

async function loginQuery2(params, values = [], connection = db) {
    return connection.execute(`SELECT mfa_enabled FROM users WHERE id = ?`, params);
}

async function register(params, values = [], connection = db) {
    return connection.execute('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', params);
}

async function registerQuery2(params, values = [], connection = db) {
    return connection.execute('SELECT id FROM account_roles WHERE role_code = ?', params);
}

async function registerQuery4(params, values = [], connection = db) {
    return connection.execute(`INSERT INTO users (full_name, email, password_hash, role_id, mfa_enabled) VALUES (?, ?, ?, ?, 1)`, params);
}

async function showSettings(params, values = [], connection = db) {
    return connection.execute(`SELECT u.id, u.full_name, u.email, u.mfa_enabled, ar.role_code AS role, ar.display_name AS role_label,
                    u.phone_number, d.name AS department, u.student_id, u.created_at,
                    COALESCE(u.notify_claims, 1) AS notify_claims,
                    COALESCE(u.notify_chat, 1) AS notify_chat,
                    COALESCE(u.notify_broadcasts, 1) AS notify_broadcasts
             FROM users u
             JOIN account_roles ar ON ar.id = u.role_id
             LEFT JOIN departments d ON d.id = u.department_id
             WHERE u.id = ?`, params);
}

async function updateNotificationSettings(params, values = [], connection = db) {
    return connection.execute(`UPDATE users
                 SET notify_claims = ?, notify_chat = ?, notify_broadcasts = ?
                 WHERE id = ?`, params);
}

async function updateProfile(params, values = [], connection = db) {
    return connection.execute(`SELECT ar.role_code, u.email, u.student_id, u.department_id
             FROM users u
             JOIN account_roles ar ON ar.id = u.role_id
             WHERE u.id = ?`, params);
}

async function updateProfileQuery3(params, values = [], connection = db) {
    return connection.execute(`INSERT INTO departments (name) VALUES (?)
                     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`, params);
}

async function updateProfileQuery4(params, values = [], connection = db) {
    return connection.execute(`UPDATE users
                 SET full_name = ?, email = ?, phone_number = ?, department_id = ?, student_id = ?
                 WHERE id = ?`, params);
}

async function updateSecurity(params, values = [], connection = db) {
    return connection.execute(`SELECT password_hash FROM users WHERE id = ?`, params);
}

async function updateSecurityQuery2(params, values = [], connection = db) {
    return connection.execute(`UPDATE users SET password_hash = ? WHERE id = ?`, params);
}

async function enableMfa(params, values = [], connection = db) {
    return connection.execute(`SELECT password_hash, mfa_enabled FROM users WHERE id = ?`, params);
}

async function enableMfaQuery2(params, values = [], connection = db) {
    return connection.execute(`UPDATE users SET mfa_enabled = 1 WHERE id = ?`, params);
}

async function disableMfa(params, values = [], connection = db) {
    return connection.execute(`SELECT password_hash, mfa_enabled FROM users WHERE id = ?`, params);
}

async function disableMfaQuery2(params, values = [], connection = db) {
    return connection.execute(`UPDATE users SET mfa_enabled = 0 WHERE id = ?`, params);
}

async function deleteAccount(params, values = [], connection = db) {
    return connection.execute(`DELETE FROM users WHERE id = ?`, params);
}

async function showAdminDashboard(params, values = [], connection = db) {
    return connection.execute('SELECT COUNT(*) AS cnt FROM users');
}

async function createAdminUser(params, values = [], connection = db) {
    return connection.execute('SELECT id FROM users WHERE email = ?', params);
}

async function createAdminUserQuery2(params, values = [], connection = db) {
    return connection.execute(`INSERT INTO users (full_name, email, password_hash, role_id, mfa_enabled)
             VALUES (?, ?, ?, (SELECT id FROM account_roles WHERE role_code = ?), 1)`, params);
}

async function updateUserRole(params, values = [], connection = db) {
    return connection.execute(`SELECT email FROM users WHERE id = ?`, params);
}

async function updateUserRoleQuery2(params, values = [], connection = db) {
    return connection.execute(`UPDATE users SET role_id = (SELECT id FROM account_roles WHERE role_code = ?) WHERE id = ?`, params);
}

module.exports = {
    login,
    loginQuery2,
    register,
    registerQuery2,
    registerQuery4,
    showSettings,
    updateNotificationSettings,
    updateProfile,
    updateProfileQuery3,
    updateProfileQuery4,
    updateSecurity,
    updateSecurityQuery2,
    enableMfa,
    enableMfaQuery2,
    disableMfa,
    disableMfaQuery2,
    deleteAccount,
    showAdminDashboard,
    createAdminUser,
    createAdminUserQuery2,
    updateUserRole,
    updateUserRoleQuery2
};
