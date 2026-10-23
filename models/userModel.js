const db = require('../config/db');

<<<<<<< HEAD
async function login(params, values = [], connection = db) {
    return connection.execute(`SELECT u.id, u.full_name, u.email, u.password_hash, ar.role_code AS role
             FROM users u
             JOIN account_roles ar ON ar.id = u.role_id
             WHERE u.email = ?`, params);
}

async function loginQuery2(params, values = [], connection = db) {
    return connection.execute(`SELECT mfa_enabled FROM users WHERE id = ?`, params);
}

async function register(params, values = [], connection = db) {
    return connection.execute('SELECT id FROM users WHERE email = ?', params);
}

async function registerQuery2(params, values = [], connection = db) {
    return connection.execute('SELECT id FROM account_roles WHERE role_code = ?', params);
}

async function registerQuery3(params, values = [], connection = db) {
    return connection.execute(`SELECT u.id
                     FROM users u
                     JOIN account_roles ar ON ar.id = u.role_id
                     WHERE u.email = ? AND ar.role_code = 'student'
                     FOR UPDATE`, params);
}

async function registerQuery4(params, values = [], connection = db) {
    return connection.execute(`INSERT INTO users (full_name, email, password_hash, role_id) VALUES (?, ?, ?, ?)`, params);
}

async function showSettings(params, values = [], connection = db) {
    return connection.execute(`SELECT u.id, u.full_name, u.email, u.mfa_enabled, ar.role_code AS role, ar.display_name AS role_label,
                    u.phone_number, d.name AS department, u.student_id, u.created_at
             FROM users u
             JOIN account_roles ar ON ar.id = u.role_id
             LEFT JOIN departments d ON d.id = u.department_id
             WHERE u.id = ?`, params);
}

async function createGuardianLink(params, values = [], connection = db) {
    return connection.execute(`SELECT ar.role_code
             FROM users u
             JOIN account_roles ar ON ar.id = u.role_id
             WHERE u.id = ?
             FOR UPDATE`, params);
}

async function createGuardianLinkQuery2(params, values = [], connection = db) {
    return connection.execute(`SELECT u.id
             FROM users u
             JOIN account_roles ar ON ar.id = u.role_id
             WHERE u.email = ? AND ar.role_code = 'student'
             FOR UPDATE`, params);
}

async function decideGuardianLink(params, values = [], connection = db) {
    return connection.execute(`SELECT ar.role_code
             FROM users u
             JOIN account_roles ar ON ar.id = u.role_id
             WHERE u.id = ?
             FOR UPDATE`, params);
}

async function decideGuardianLinkQuery2(params, values = [], connection = db) {
    return connection.execute(`SELECT ar.role_code
                 FROM users u
                 JOIN account_roles ar ON ar.id = u.role_id
                 WHERE u.id = ?
                 FOR UPDATE`, params);
}

async function decideGuardianLinkQuery3(params, values = [], connection = db) {
    return connection.execute(`UPDATE users
                 SET role_id = (SELECT id FROM account_roles WHERE role_code = 'parent')
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
    return connection.execute(`INSERT INTO users (full_name, email, password_hash, role_id)
             VALUES (?, ?, ?, (SELECT id FROM account_roles WHERE role_code = ?))`, params);
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
    registerQuery3,
    registerQuery4,
    showSettings,
    createGuardianLink,
    createGuardianLinkQuery2,
    decideGuardianLink,
    decideGuardianLinkQuery2,
    decideGuardianLinkQuery3,
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
=======
const User = {
  findByEmail: async (email) => {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0];
  },
  findById: async (id) => {
    const [rows] = await db.query('SELECT id, full_name, email, role, department FROM users WHERE id = ?', [id]);
    return rows[0];
  },
  create: async (userData) => {
    const { full_name, email, password_hash, role, department } = userData;
    const [result] = await db.query(
      'INSERT INTO users (full_name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?)',
      [full_name, email, password_hash, role || 'Student', department || 'General']
    );
    return result.insertId;
  }
};

module.exports = User;
>>>>>>> 3f22ea3b830880e80bb60d51cdff21285aedaa0f
