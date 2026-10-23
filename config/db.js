/**
 * Database Configuration & Connection Pool
 * Project HANAP - Campus System Round 1
 * 
 * Uses mysql2/promise for async/await query execution.
 * Reads credentials from environment variables (.env).
 */

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Create connection pool for MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? process.env.DB_PASS ?? '',
  database: process.env.DB_NAME || 'project_hanap',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

/**
 * Diagnostic function to test database connectivity at startup.
 * Logs success or non-fatal warning if database service is not yet running.
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log(`[DB] Connected successfully to MySQL database "${process.env.DB_NAME || 'project_hanap'}" at ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306}`);
    connection.release();
  } catch (err) {
    console.warn(`[DB WARNING] Database connection failed (${err.code || err.message}). Please ensure MySQL is running and migrations are executed.`);
  }
}

// Test connection asynchronously upon initialization
testConnection();

module.exports = pool;
