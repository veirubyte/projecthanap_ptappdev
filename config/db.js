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

const requiredVariables = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingVariables = requiredVariables.filter(
  (name) => process.env[name] === undefined || (name !== 'DB_PASSWORD' && !process.env[name].trim())
);

if (missingVariables.length > 0) {
  throw new Error(`Missing required database environment variable(s): ${missingVariables.join(', ')}`);
}

const databasePort = Number(process.env.DB_PORT || 3306);
if (!Number.isInteger(databasePort) || databasePort < 1 || databasePort > 65535) {
  throw new Error('DB_PORT must be an integer between 1 and 65535.');
}

// Create connection pool for MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: databasePort,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
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
    console.log(`[DB] Connected successfully to MySQL database "${process.env.DB_NAME}" at ${process.env.DB_HOST}:${databasePort}`);
    connection.release();
    try {
      const autoMigrate = require('../migrations/autoMigrate');
      await autoMigrate();
    } catch (migErr) {
      console.warn('[DB WARNING] Auto-migration check encountered an error:', migErr.message);
    }
  } catch (err) {
    console.warn(`[DB WARNING] Database connection failed (${err.code || err.message}). Please ensure MySQL is running and migrations are executed.`);
  }
}

// Test connection asynchronously upon initialization
testConnection();

module.exports = pool;
