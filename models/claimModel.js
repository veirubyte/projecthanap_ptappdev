const db = require('../config/db');

async function showDashboard(params, values = [], connection = db) {
    return connection.execute(`SELECT u.id, u.full_name, COUNT(c.id) AS handover_count, MAX(c.created_at) AS latest_at
                     FROM claims c
                     JOIN item_reports r ON r.id = c.item_id
                     JOIN users u ON u.id = r.user_id
                     WHERE c.status = 'approved' AND r.report_type = 'found'
                     GROUP BY u.id, u.full_name
                     ORDER BY latest_at DESC
                     LIMIT 5`);
}

async function showDashboardQuery2(params, values = [], connection = db) {
    return connection.execute(`
                SELECT c.*, r.item_name, r.image_path, claimant.full_name AS claimant_name, reporter.full_name AS reporter_name,
                       (SELECT message FROM claim_messages WHERE claim_id = c.id ORDER BY sent_at DESC LIMIT 1) AS last_message,
                       (SELECT sent_at FROM claim_messages WHERE claim_id = c.id ORDER BY sent_at DESC LIMIT 1) AS last_message_at
                FROM claims c
                JOIN item_reports r ON r.id = c.item_id
                JOIN users claimant ON claimant.id = c.claimant_id
                JOIN users reporter ON reporter.id = r.user_id
                WHERE c.claimant_id = ? OR r.user_id = ?
                ORDER BY c.created_at DESC LIMIT 1
            `, params);
}

async function showItemDetails(params, values = [], connection = db) {
    return connection.execute(`SELECT * FROM claims WHERE item_id = ? AND claimant_id = ? ORDER BY id DESC LIMIT 1`, params);
}

async function createClaim(params, values = [], connection = db) {
    return connection.execute('SELECT id FROM claims WHERE item_id = ? AND claimant_id = ? AND status = "pending"', params);
}

async function createClaimQuery2(params, values = [], connection = db) {
    return connection.execute(`INSERT INTO claims (item_id, claimant_id, proof_details, status) VALUES (?, ?, ?, 'pending')`, params);
}

async function createClaimQuery3(params, values = [], connection = db) {
    return connection.execute(`INSERT INTO claim_messages (claim_id, sender_id, message) VALUES (?, ?, ?)`, params);
}

async function listClaims(params, values = [], connection = db) {
    return connection.execute(`SELECT c.*, r.item_name, r.report_type, r.image_path, r.location_found_lost, r.status AS item_status, u.full_name AS reporter_name
             FROM claims c
             JOIN item_reports r ON r.id = c.item_id
             JOIN users u ON u.id = r.user_id
             WHERE c.claimant_id = ?
             ORDER BY c.created_at DESC`, params);
}

async function listClaimsQuery2(params, values = [], connection = db) {
    return connection.execute(`SELECT c.*, r.item_name, r.report_type, r.image_path, r.location_found_lost, r.status AS item_status, u.full_name AS claimant_name
             FROM claims c
             JOIN item_reports r ON r.id = c.item_id
             JOIN users u ON u.id = c.claimant_id
             WHERE r.user_id = ?
             ORDER BY c.created_at DESC`, params);
}

async function showClaimChat(params, values = [], connection = db) {
    return connection.execute(`SELECT c.*, 
                    r.item_name, r.category, r.description AS item_description, r.location_found_lost, r.image_path, r.status AS item_status, r.user_id AS reporter_id,
                    claimant.full_name AS claimant_name, claimant.email AS claimant_email, claimant_role.role_code AS claimant_role,
                    reporter.full_name AS reporter_name, reporter.email AS reporter_email, reporter_role.role_code AS reporter_role
             FROM claims c
             JOIN item_reports r ON r.id = c.item_id
             JOIN users claimant ON claimant.id = c.claimant_id
             JOIN account_roles claimant_role ON claimant_role.id = claimant.role_id
             JOIN users reporter ON reporter.id = r.user_id
             JOIN account_roles reporter_role ON reporter_role.id = reporter.role_id
             WHERE c.id = ?`, params);
}

async function showClaimChatQuery2(params, values = [], connection = db) {
    return connection.execute(`SELECT m.*, u.full_name AS sender_name, sender_role.role_code AS sender_role
             FROM claim_messages m
             JOIN users u ON u.id = m.sender_id
             JOIN account_roles sender_role ON sender_role.id = u.role_id
             WHERE m.claim_id = ?
             ORDER BY m.sent_at ASC`, params);
}

async function sendClaimMessage(params, values = [], connection = db) {
    return connection.execute(`SELECT c.*, r.user_id AS reporter_id 
             FROM claims c 
             JOIN item_reports r ON r.id = c.item_id 
             WHERE c.id = ?`, params);
}

async function sendClaimMessageQuery2(params, values = [], connection = db) {
    return connection.execute(`INSERT INTO claim_messages (claim_id, sender_id, message) VALUES (?, ?, ?)`, params);
}

async function updateClaimStatus(params, values = [], connection = db) {
    return connection.execute(`SELECT c.*, r.user_id AS reporter_id, r.item_name
             FROM claims c 
             JOIN item_reports r ON r.id = c.item_id 
             WHERE c.id = ?`, params);
}

async function updateClaimStatusQuery2(params, values = [], connection = db) {
    return connection.execute('UPDATE claims SET status = ? WHERE id = ?', params);
}

async function updateClaimStatusQuery3(params, values = [], connection = db) {
    return connection.execute(`INSERT INTO claim_messages (claim_id, sender_id, message) 
                 VALUES (?, ?, ?)`, params);
}

async function updateClaimStatusQuery4(params, values = [], connection = db) {
    return connection.execute(`INSERT INTO claim_messages (claim_id, sender_id, message) 
                 VALUES (?, ?, ?)`, params);
}

async function updateClaimStatusQuery5(params, values = [], connection = db) {
    return connection.execute(`INSERT INTO claim_messages (claim_id, sender_id, message) 
                 VALUES (?, ?, ?)`, params);
}

async function updateClaimStatusQuery6(params, values = [], connection = db) {
    return connection.execute(`INSERT INTO claim_messages (claim_id, sender_id, message) 
                 VALUES (?, ?, ?)`, params);
}

async function showSettings(params, values = [], connection = db) {
    return connection.execute(`SELECT c.*, r.item_name, r.report_type, r.location_found_lost, r.image_path, r.status AS item_status, u.full_name AS reporter_name
             FROM claims c
             JOIN item_reports r ON r.id = c.item_id
             JOIN users u ON u.id = r.user_id
             WHERE c.claimant_id = ?
             ORDER BY c.created_at DESC`, params);
}

async function showAdminDashboard(params, values = [], connection = db) {
    return connection.execute(`
            SELECT 
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected
            FROM claims
        `);
}

async function showAdminDashboardQuery2(params, values = [], connection = db) {
    return connection.execute(`
            SELECT c.*, r.item_name, r.image_path, r.location_found_lost, r.status AS item_status,
                   u.full_name AS claimant_name, ar.role_code AS claimant_role
            FROM claims c
            JOIN item_reports r ON r.id = c.item_id
            JOIN users u ON u.id = c.claimant_id
            JOIN account_roles ar ON ar.id = u.role_id
            WHERE ar.role_code IN ('guest', 'parent')
            ORDER BY c.created_at DESC
        `);
}

async function showAdminDashboardQuery3(params, values = [], connection = db) {
    return connection.execute(`
            SELECT c.*, r.item_name, r.image_path, r.location_found_lost, r.status AS item_status,
                   u.full_name AS claimant_name, ar.role_code AS claimant_role
            FROM claims c
            JOIN item_reports r ON r.id = c.item_id
            JOIN users u ON u.id = c.claimant_id
            JOIN account_roles ar ON ar.id = u.role_id
            WHERE c.status = 'pending'
            ORDER BY c.created_at DESC
        `);
}

async function listAdminUsers(params, values = [], connection = db) {
    return connection.execute(`
            SELECT u.id, u.full_name, u.email, ar.role_code AS role, ar.display_name AS role_label,
                   d.name AS department, u.student_id, u.created_at,
                   (SELECT COUNT(*) FROM claims c WHERE c.claimant_id = u.id AND c.status = 'pending') AS claim_count
            FROM users u
            JOIN account_roles ar ON ar.id = u.role_id
            LEFT JOIN departments d ON d.id = u.department_id
            ORDER BY u.created_at DESC
        `);
}

async function listHandoverClaims(params, values = [], connection = db) {
    return connection.execute(`
            SELECT c.*, r.item_name, r.image_path, r.location_found_lost,
                   u.full_name AS claimant_name, ar.role_code AS claimant_role, u.email AS claimant_email, u.student_id
            FROM claims c
            JOIN item_reports r ON r.id = c.item_id
            JOIN users u ON u.id = c.claimant_id
            JOIN account_roles ar ON ar.id = u.role_id
            WHERE c.status = 'pending'
            ORDER BY c.created_at DESC
        `);
}

async function showHandoverClaim(params, values = [], connection = db) {
    return connection.execute(`
            SELECT c.*, r.item_name, r.image_path, r.location_found_lost, r.status AS item_status,
                   u.full_name AS claimant_name, ar.role_code AS claimant_role, u.email AS claimant_email, u.student_id
            FROM claims c
            JOIN item_reports r ON r.id = c.item_id
            JOIN users u ON u.id = c.claimant_id
            JOIN account_roles ar ON ar.id = u.role_id
            WHERE c.id = ?
        `, params);
}

async function confirmHandover(params, values = [], connection = db) {
    return connection.execute('SELECT * FROM claims WHERE id = ?', params);
}

async function confirmHandoverQuery2(params, values = [], connection = db) {
    return connection.execute('UPDATE claims SET status = "approved" WHERE id = ?', params);
}

async function confirmHandoverQuery3(params, values = [], connection = db) {
    return connection.execute(`INSERT INTO claim_messages (claim_id, sender_id, message) VALUES (?, ?, ?)`, params);
}

async function rejectHandover(params, values = [], connection = db) {
    return connection.execute('UPDATE claims SET status = "rejected" WHERE id = ?', params);
}

async function rejectHandoverQuery2(params, values = [], connection = db) {
    return connection.execute(`INSERT INTO claim_messages (claim_id, sender_id, message) VALUES (?, ?, ?)`, params);
}

async function listAdminReports(params, values = [], connection = db) {
    return connection.execute(`SELECT COUNT(*) as count FROM claims WHERE status = 'approved'`);
}

async function showAdminAnalytics(params, values = [], connection = db) {
    return connection.execute(`
            SELECT 
                COUNT(*) as total_claims,
                SUM(CASE WHEN c.status = 'approved' THEN 1 ELSE 0 END) as approved_claims,
                SUM(CASE WHEN c.status = 'pending' THEN 1 ELSE 0 END) as pending_claims,
                SUM(CASE WHEN c.status = 'rejected' THEN 1 ELSE 0 END) as rejected_claims
            FROM claims c
            JOIN item_reports r ON r.id = c.item_id
            JOIN users u ON u.id = c.claimant_id
            JOIN account_roles ar ON ar.id = u.role_id
            WHERE ar.role_code NOT IN ('parent', 'guest')
        `);
}

async function showAdminAnalyticsQuery2(params, values = [], connection = db) {
    return connection.execute(`
            SELECT 
                COUNT(*) as total_claims,
                SUM(CASE WHEN c.status = 'approved' THEN 1 ELSE 0 END) as approved_claims,
                SUM(CASE WHEN c.status = 'pending' THEN 1 ELSE 0 END) as pending_claims,
                SUM(CASE WHEN c.status = 'rejected' THEN 1 ELSE 0 END) as rejected_claims
            FROM claims c
            JOIN item_reports r ON r.id = c.item_id
            JOIN users u ON u.id = c.claimant_id
            JOIN account_roles ar ON ar.id = u.role_id
            WHERE ar.role_code IN ('parent', 'guest') OR r.location_found_lost LIKE '%Office%'
        `);
}

async function showAdminAnalyticsQuery3(params, values = [], connection = db) {
    return connection.execute(`
            SELECT r.category, COUNT(c.id) as claim_count
            FROM claims c
            JOIN item_reports r ON r.id = c.item_id
            WHERE c.status = 'approved'
            GROUP BY r.category
            ORDER BY claim_count DESC
        `);
}

async function showAdminAnalyticsQuery4(params, values = [], connection = db) {
    return connection.execute(`
            SELECT COUNT(*) as cnt 
            FROM claims c 
            JOIN users u ON u.id = c.claimant_id 
            JOIN account_roles ar ON ar.id = u.role_id
            WHERE c.status = 'pending' AND ar.role_code IN ('parent', 'guest')
        `);
}

async function getUnreadNotificationCount(params, values = [], connection = db) {
    return connection.execute(`
            SELECT COUNT(*) AS unread_count
            FROM claims c
            JOIN item_reports r ON r.id = c.item_id
            WHERE (r.user_id = ? OR c.claimant_id = ?)
              AND c.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
              AND c.status IN ('pending', 'approved', 'rejected')
        `, params);
}

module.exports = {
    showDashboard,
    showDashboardQuery2,
    showItemDetails,
    createClaim,
    createClaimQuery2,
    createClaimQuery3,
    listClaims,
    listClaimsQuery2,
    showClaimChat,
    showClaimChatQuery2,
    sendClaimMessage,
    sendClaimMessageQuery2,
    updateClaimStatus,
    updateClaimStatusQuery2,
    updateClaimStatusQuery3,
    updateClaimStatusQuery4,
    updateClaimStatusQuery5,
    updateClaimStatusQuery6,
    showSettings,
    showAdminDashboard,
    showAdminDashboardQuery2,
    showAdminDashboardQuery3,
    listAdminUsers,
    listHandoverClaims,
    showHandoverClaim,
    confirmHandover,
    confirmHandoverQuery2,
    confirmHandoverQuery3,
    rejectHandover,
    rejectHandoverQuery2,
    listAdminReports,
    showAdminAnalytics,
    showAdminAnalyticsQuery2,
    showAdminAnalyticsQuery3,
    showAdminAnalyticsQuery4,
    getUnreadNotificationCount
};
