const db = require('../config/db');

const Item = {
  findAll: async () => {
    const [rows] = await db.query(`
      SELECT items.*, categories.name AS category_name, users.full_name AS reported_by_name 
      FROM items 
      LEFT JOIN categories ON items.category_id = categories.id 
      LEFT JOIN users ON items.reported_by = users.id 
      ORDER BY items.created_at DESC
    `);
    return rows;
  },
  findById: async (id) => {
    const [rows] = await db.query('SELECT * FROM items WHERE id = ?', [id]);
    return rows[0];
  },
  create: async (itemData) => {
    const { item_code, title, description, category_id, location_found, item_status, reported_by, date_logged } = itemData;
    const [result] = await db.query(
      `INSERT INTO items (item_code, title, description, category_id, location_found, item_status, reported_by, date_logged) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [item_code, title, description, category_id, location_found, item_status || 'Turned In', reported_by, date_logged]
    );
    return result.insertId;
  }
};

module.exports = Item;
