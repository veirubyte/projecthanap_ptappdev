const db = require('../config/db');

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
