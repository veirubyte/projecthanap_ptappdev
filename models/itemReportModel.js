const db = require('../config/db');
const primaryImageSelect = `COALESCE((SELECT report_image.image_path
             FROM item_report_images report_image
             WHERE report_image.report_id = r.id
             ORDER BY report_image.is_primary DESC, report_image.sort_order ASC, report_image.id ASC
             LIMIT 1), r.image_path) AS primary_image_path`;

async function findCatalogReports({ statusFilter, isCatalog, typeFilter, catFilter, periodFilter, q }) {
    let querySql = `
            SELECT r.*, ${primaryImageSelect}, u.full_name AS reporter_name, reporter_role.role_code AS reporter_role
            FROM item_reports r
            JOIN users u ON u.id = r.user_id
            JOIN account_roles reporter_role ON reporter_role.id = u.role_id
            WHERE 1=1
        `;
    const params = [];

    if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'claimed') {
            querySql += ` AND r.status IN ('claimed', 'returned')`;
        } else {
            querySql += ` AND r.status = ?`;
            params.push(statusFilter);
        }
    } else if (isCatalog) {
        querySql += ` AND r.status = 'active'`;
    }

    if (typeFilter) {
        querySql += ` AND r.report_type = ?`;
        params.push(typeFilter);
    }

    if (catFilter) {
        querySql += ` AND r.category = ?`;
        params.push(catFilter);
    }

    if (periodFilter === 'today') {
        querySql += ` AND r.date_reported >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 DAY)`;
    } else if (periodFilter === 'week') {
        querySql += ` AND r.date_reported >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 7 DAY)`;
    } else if (periodFilter === 'month') {
        querySql += ` AND r.date_reported >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY)`;
    }

    if (q) {
        querySql += ` AND (r.item_name LIKE ? OR r.description LIKE ? OR r.location_found_lost LIKE ?)`;
        const wildcard = `%${q}%`;
        params.push(wildcard, wildcard, wildcard);
    }

    querySql += ` ORDER BY r.date_reported DESC LIMIT 100`;
    return db.execute(querySql, params);
}

async function showDashboard(params, values = [], connection = db) {
    return connection.execute(`
            SELECT 
                SUM(CASE WHEN report_type = 'lost' AND status = 'active' THEN 1 ELSE 0 END) AS active_lost,
                SUM(CASE WHEN report_type = 'found' AND status = 'active' THEN 1 ELSE 0 END) AS active_found,
                SUM(CASE WHEN status IN ('claimed', 'returned') THEN 1 ELSE 0 END) AS total_claimed,
                COUNT(*) AS total_reports
            FROM item_reports
        `);
}

async function showDashboardQuery2(params, values = [], connection = db) {
    return connection.execute(`SELECT u.id, u.full_name, COUNT(r.id) AS item_count, MAX(r.date_reported) AS latest_at
                     FROM item_reports r
                     JOIN users u ON u.id = r.user_id
                     WHERE r.report_type = 'found' AND r.status IN ('active', 'claimed', 'returned')
                     GROUP BY u.id, u.full_name
                     ORDER BY latest_at DESC
                     LIMIT 5`);
}

async function showDashboardQuery3(params, values = [], connection = db) {
    return connection.execute(`SELECT category, COUNT(*) AS item_count
                     FROM item_reports
                     WHERE status = 'active'
                     GROUP BY category`);
}

async function showDashboardQuery4(params, values = [], connection = db) {
    return connection.execute(`SELECT r.*, ${primaryImageSelect} FROM item_reports r WHERE r.user_id = ? AND r.status = 'active'`, params);
}

async function showDashboardQuery5(params, values = [], connection = db) {
    return connection.execute(`SELECT r.*, ${primaryImageSelect} FROM item_reports r WHERE r.user_id = ? ORDER BY r.date_reported DESC LIMIT 4`, params);
}

async function showDashboardQuery6(params, values = [], connection = db) {
    return connection.execute(`SELECT r.*, ${primaryImageSelect}, u.full_name AS reporter_name 
                         FROM item_reports r 
                         JOIN users u ON u.id = r.user_id
                         WHERE r.user_id != ? 
                           AND r.report_type = ? 
                           AND r.status = 'active' 
                           AND r.category IN (${values[0]})
                         ORDER BY r.date_reported DESC LIMIT 4`, params);
}

async function createItemReport(params, imagePaths = []) {
    const connection = await db.getConnection();
    let transactionOpen = false;
    try {
        await connection.beginTransaction();
        transactionOpen = true;
        const [result, fields] = await connection.execute(`INSERT INTO item_reports (user_id, report_type, item_name, category, description, location_found_lost, secret_challenge, secret_answer, custody_mode, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`, params);

        for (let index = 0; index < imagePaths.length; index += 1) {
            await connection.execute(`INSERT INTO item_report_images (report_id, image_path, is_primary, sort_order)
                     VALUES (?, ?, ?, ?)`, [result.insertId, imagePaths[index], index === 0 ? 1 : 0, index]);
        }

        await connection.commit();
        transactionOpen = false;
        return [result, fields];
    } catch (err) {
        if (transactionOpen) await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

async function showItemDetails(params, values = [], connection = db) {
    return connection.execute(`SELECT r.*, ${primaryImageSelect}, u.full_name AS reporter_name, u.email AS reporter_email, reporter_role.role_code AS reporter_role
             FROM item_reports r
             JOIN users u ON u.id = r.user_id
             JOIN account_roles reporter_role ON reporter_role.id = u.role_id
             WHERE r.id = ?`, params);
}

async function showItemReportImages(params, values = [], connection = db) {
    return connection.execute(`SELECT image_path, is_primary, sort_order
             FROM item_report_images
             WHERE report_id = ?
             ORDER BY is_primary DESC, sort_order ASC, id ASC`, params);
}

async function showItemDetailsQuery2(params, values = [], connection = db) {
    return connection.execute(`SELECT r.*, ${primaryImageSelect} FROM item_reports r
             WHERE r.category = ? AND r.id != ? AND r.status = 'active'
             ORDER BY r.date_reported DESC LIMIT 3`, params);
}

async function previewOwnershipMatch(params, values = [], connection = db) {
    return connection.execute('SELECT secret_answer, secret_challenge FROM item_reports WHERE id = ?', params);
}

async function createClaim(params, values = [], connection = db) {
    return connection.execute(`SELECT r.*, ${primaryImageSelect} FROM item_reports r WHERE r.id = ?`, params);
}

async function updateClaimStatus(params, values = [], connection = db) {
    return connection.execute("UPDATE item_reports SET status = 'claimed' WHERE id = ?", params);
}

async function updateClaimStatusQuery2(params, values = [], connection = db) {
    return connection.execute("UPDATE item_reports SET status = 'returned' WHERE id = ?", params);
}

async function listMyReports(params, values = [], connection = db) {
    return connection.execute(`SELECT r.*, ${primaryImageSelect} FROM item_reports r WHERE r.user_id = ? ORDER BY r.date_reported DESC`, params);
}

async function updateItemStatus(params, values = [], connection = db) {
    return connection.execute(`SELECT r.*, ${primaryImageSelect} FROM item_reports r WHERE r.id = ?`, params);
}

async function updateItemStatusQuery2(params, values = [], connection = db) {
    return connection.execute('UPDATE item_reports SET status = ? WHERE id = ?', params);
}

async function deleteItemReport(params, values = [], connection = db) {
    return connection.execute(`SELECT r.*, ${primaryImageSelect} FROM item_reports r WHERE r.id = ?`, params);
}

async function deleteItemReportQuery2(params) {
    const dbConnection = await db.getConnection();
    let transactionOpen = false;
    try {
        await dbConnection.beginTransaction();
        transactionOpen = true;
        await dbConnection.execute('DELETE FROM item_report_images WHERE report_id = ?', params);
        const result = await dbConnection.execute('DELETE FROM item_reports WHERE id = ?', params);
        await dbConnection.commit();
        transactionOpen = false;
        return result;
    } catch (err) {
        if (transactionOpen) await dbConnection.rollback();
        throw err;
    } finally {
        dbConnection.release();
    }
}

async function showEditItemForm(params, values = [], connection = db) {
    return connection.execute(`SELECT r.*, ${primaryImageSelect} FROM item_reports r WHERE r.id = ?`, params);
}

async function updateItemReport(params, values = [], connection = db) {
    return connection.execute(`SELECT r.*, ${primaryImageSelect} FROM item_reports r WHERE r.id = ?`, params);
}

async function updateItemReportQuery2(params, imagePaths = []) {
    const connection = await db.getConnection();
    let transactionOpen = false;
    try {
        await connection.beginTransaction();
        transactionOpen = true;
        await connection.execute(`UPDATE item_reports
             SET item_name = ?, category = ?, description = ?, status = ?, location_found_lost = ?, secret_challenge = ?, secret_answer = ?
             WHERE id = ?`, params);

        if (imagePaths.length > 0) {
            const [existingImages] = await connection.execute(
                'SELECT COUNT(*) AS image_count FROM item_report_images WHERE report_id = ?',
                [params[7]]
            );
            let sortOrder = Number(existingImages[0].image_count);
            for (const imagePath of imagePaths) {
                await connection.execute(`INSERT INTO item_report_images (report_id, image_path, is_primary, sort_order)
                     VALUES (?, ?, ?, ?)`, [params[7], imagePath, sortOrder === 0 ? 1 : 0, sortOrder]);
                sortOrder += 1;
            }
        }

        await connection.commit();
        transactionOpen = false;
    } catch (err) {
        if (transactionOpen) await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

async function showSettings(params, values = [], connection = db) {
    return connection.execute(`SELECT r.*, ${primaryImageSelect} FROM item_reports r WHERE r.user_id = ? ORDER BY r.date_reported DESC`, params);
}

async function showAdminDashboard(params, values = [], connection = db) {
    return connection.execute(`
            SELECT 
                COUNT(*) AS total,
                SUM(CASE WHEN report_type = 'lost' THEN 1 ELSE 0 END) AS lost,
                SUM(CASE WHEN report_type = 'found' THEN 1 ELSE 0 END) AS found,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
                SUM(CASE WHEN status IN ('claimed', 'returned') THEN 1 ELSE 0 END) AS claimed,
                SUM(CASE WHEN status = 'pending_review' THEN 1 ELSE 0 END) AS pending_review
            FROM item_reports
        `);
}

async function showAdminDashboardQuery2(params, values = [], connection = db) {
    return connection.execute(`
            SELECT r.*, ${primaryImageSelect}, u.full_name AS reporter_name,
                   receiver.full_name AS custody_received_by_name
            FROM item_reports r
            JOIN users u ON u.id = r.user_id
            LEFT JOIN users receiver ON receiver.id = r.custody_received_by
            WHERE r.report_type = 'found'
              AND r.status = 'active'
              AND r.custody_mode = 'security_desk'
            ORDER BY r.date_reported DESC
        `);
}

async function acceptItemCustody(params, values = [], connection = db) {
    return connection.execute(`UPDATE item_reports
             SET custody_received_at = CURRENT_TIMESTAMP, custody_received_by = ?
             WHERE id = ?
               AND report_type = 'found'
               AND status = 'active'
               AND custody_mode = 'security_desk'
               AND custody_received_at IS NULL`, params);
}

async function showAdminDashboardQuery3(params, values = [], connection = db) {
    return connection.execute(`
            SELECT COUNT(*) AS cnt
            FROM item_reports
            WHERE status = 'active' AND date_reported <= NOW() - INTERVAL 60 DAY
        `);
}

async function showAdminDashboardQuery4(params, values = [], connection = db) {
    return connection.execute(`
            SELECT category, COUNT(*) as cnt 
            FROM item_reports 
            GROUP BY category 
            ORDER BY cnt DESC
        `);
}

async function confirmHandover(params, values = [], connection = db) {
    return connection.execute("UPDATE item_reports SET status = 'claimed' WHERE id = ?", params);
}

async function listAdminReports(params, values = [], connection = db) {
    return connection.execute(`
            SELECT r.*, ${primaryImageSelect}, u.full_name AS reporter_name, u.email AS reporter_email, ar.role_code AS reporter_role
            FROM item_reports r
            JOIN users u ON u.id = r.user_id
            JOIN account_roles ar ON ar.id = u.role_id
            ORDER BY r.date_reported DESC
        `);
}

async function showAdminDashboardQuery5(params, values = [], connection = db) {
    return connection.execute(`
            SELECT r.*, ${primaryImageSelect}, u.full_name AS reporter_name
            FROM item_reports r
            JOIN users u ON u.id = r.user_id
            ORDER BY r.date_reported DESC
            LIMIT 8
        `);
}

async function approveReportArchive(params, values = [], connection = db) {
    return connection.execute("UPDATE item_reports SET status = 'archived' WHERE id = ?", params);
}

async function batchApproveReportArchive(params, values = [], connection = db) {
    return connection.execute(`UPDATE item_reports SET status = 'archived' WHERE status IN ('active', 'pending_review') AND date_reported <= NOW() - INTERVAL 60 DAY`);
}

async function showAdminAnalytics(params, values = [], connection = db) {
    return connection.execute(`
            SELECT 
                COUNT(*) as total_reports,
                SUM(CASE WHEN status IN ('claimed', 'returned') THEN 1 ELSE 0 END) as total_claimed,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as total_active,
                SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as total_archived
            FROM item_reports
        `);
}

async function description(params, imagePaths = []) {
    const connection = await db.getConnection();
    let transactionOpen = false;
    try {
        await connection.beginTransaction();
        transactionOpen = true;
        const [result, fields] = await connection.execute(`INSERT INTO item_reports (user_id, report_type, item_name, category, description, location_found_lost, secret_challenge, secret_answer, custody_mode, custody_received_at, custody_received_by, status)
                 VALUES (?, 'found', ?, ?, ?, ?, ?, ?, 'security_desk', CURRENT_TIMESTAMP, ?, 'active')`, params);
        for (let index = 0; index < imagePaths.length; index += 1) {
            await connection.execute(`INSERT INTO item_report_images (report_id, image_path, is_primary, sort_order)
                     VALUES (?, ?, ?, ?)`, [result.insertId, imagePaths[index], index === 0 ? 1 : 0, index]);
        }
        await connection.commit();
        transactionOpen = false;
        return [result, fields];
    } catch (err) {
        if (transactionOpen) await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

async function flagStaleItems(params, values = [], connection = db) {
    return connection.execute(`UPDATE item_reports 
             SET status = 'archived' 
             WHERE status = 'active' 
               AND date_reported <= NOW() - INTERVAL 60 DAY`);
}

module.exports = {
    findCatalogReports,
    showDashboard,
    showDashboardQuery2,
    showDashboardQuery3,
    showDashboardQuery4,
    showDashboardQuery5,
    showDashboardQuery6,
    createItemReport,
    showItemDetails,
    showItemReportImages,
    showItemDetailsQuery2,
    previewOwnershipMatch,
    createClaim,
    updateClaimStatus,
    updateClaimStatusQuery2,
    listMyReports,
    updateItemStatus,
    updateItemStatusQuery2,
    deleteItemReport,
    deleteItemReportQuery2,
    showEditItemForm,
    updateItemReport,
    updateItemReportQuery2,
    showSettings,
    showAdminDashboard,
    showAdminDashboardQuery2,
    acceptItemCustody,
    showAdminDashboardQuery3,
    showAdminDashboardQuery4,
    confirmHandover,
    listAdminReports,
    showAdminDashboardQuery5,
    approveReportArchive,
    batchApproveReportArchive,
    showAdminAnalytics,
    description,
    createAdminItemReport: description,
    flagStaleItems
};
