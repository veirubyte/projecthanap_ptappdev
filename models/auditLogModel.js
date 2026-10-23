const db = require('../config/db');

async function logAudit(params, values = [], connection = db) {
    return connection.execute(`INSERT INTO audit_logs (admin_id, action_description, ip_address) VALUES (?, ?, ?)`, params);
}

async function showSettings(params, values = [], connection = db) {
    return connection.execute(`SELECT a.*, a.action_description AS action FROM audit_logs a WHERE a.admin_id = ? ORDER BY a.timestamp DESC LIMIT 20`, params);
}

async function showAdminDashboard(params, values = [], connection = db) {
    return connection.execute(`
            SELECT a.*, a.action_description AS action, u.full_name AS admin_name 
            FROM audit_logs a 
            LEFT JOIN users u ON u.id = a.admin_id 
            ORDER BY a.timestamp DESC LIMIT 8
        `);
}

async function listAdminReports(params, values = [], connection = db) {
    return connection.execute(`
            SELECT a.*, a.action_description AS action, u.full_name as admin_name
            FROM audit_logs a
            LEFT JOIN users u ON u.id = a.admin_id
            ORDER BY a.timestamp DESC
            LIMIT 50
        `);
}

async function listAuditLogs(params, values = [], connection = db) {
    return connection.execute(`
            SELECT a.*, a.action_description AS action, u.full_name AS admin_name, u.email AS admin_email
            FROM audit_logs a
            LEFT JOIN users u ON u.id = a.admin_id
            ORDER BY a.timestamp DESC
        `);
}

module.exports = {
    logAudit,
    showSettings,
    showAdminDashboard,
    listAdminReports,
    listAuditLogs
};
