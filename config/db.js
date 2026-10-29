/**
 * Unified Database Configuration & Connection Pool
 * Project HANAP - Campus System Round 1
 * 
 * Supports both:
 * 1. Supabase PostgreSQL (via pg) when DATABASE_URL, SUPABASE_DB_URL, or POSTGRES_URL is set
 * 2. MySQL (via mysql2/promise) when standard MySQL environment variables are set
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const postgresUrl = process.env.DATABASE_URL || 
                    process.env.SUPABASE_DB_URL || 
                    process.env.POSTGRES_URL || 
                    process.env.SUPABASE_DATABASE_URL;

const isPostgres = Boolean(
  (postgresUrl && (postgresUrl.startsWith('postgres://') || postgresUrl.startsWith('postgresql://'))) ||
  ['postgres', 'postgresql', 'supabase'].includes(String(process.env.DB_CLIENT || '').toLowerCase())
);

let poolInstance;

if (isPostgres) {
  const { Pool } = require('pg');
  const connectionString = postgresUrl || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'postgres'}`;

  const isPostgresSsl = process.env.DB_SSL === 'true' || 
                        process.env.PGSSLMODE === 'require' ||
                        connectionString.includes('supabase.co') || 
                        connectionString.includes('pooler.supabase.com') ||
                        connectionString.includes('sslmode=require');

  const pgPool = new Pool({
    connectionString,
    ssl: isPostgresSsl ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.DB_CONNECTION_LIMIT || 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  function translateQueryForPostgres(sql, params = []) {
    if (!sql || typeof sql !== 'string') return { sql, params };
    let paramIndex = 1;
    let translated = sql;

    // 1. Convert backticks to standard identifiers
    translated = translated.replace(/`([a-zA-Z0-9_]+)`/g, '$1');

    // 2. Translate ? to $1, $2, ...
    translated = translated.replace(/\?/g, () => `$${paramIndex++}`);

    // 3. MySQL Intervals & Dates
    translated = translated.replace(/DATE_SUB\s*\(\s*CURRENT_TIMESTAMP\s*,\s*INTERVAL\s*(\d+)\s*DAY\s*\)/gi, "CURRENT_TIMESTAMP - INTERVAL '$1 day'");
    translated = translated.replace(/DATE_SUB\s*\(\s*NOW\(\)\s*,\s*INTERVAL\s*(\d+)\s*DAY\s*\)/gi, "NOW() - INTERVAL '$1 day'");
    translated = translated.replace(/NOW\(\)\s*-\s*INTERVAL\s*(\d+)\s*DAY/gi, "NOW() - INTERVAL '$1 days'");
    translated = translated.replace(/DATE_ADD\s*\(\s*(UTC_TIMESTAMP\(\)|NOW\(\))\s*,\s*INTERVAL\s*(\d+)\s*MINUTE\s*\)/gi, "($1 + INTERVAL '$2 minutes')");
    translated = translated.replace(/TIMESTAMPDIFF\s*\(\s*SECOND\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi, "EXTRACT(EPOCH FROM ($2 - $1))::integer");
    translated = translated.replace(/UTC_TIMESTAMP\(\)/gi, "(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')");

    // 4. ON DUPLICATE KEY UPDATE handling
    if (/ON\s+DUPLICATE\s+KEY\s+UPDATE\s+id\s*=\s*LAST_INSERT_ID\s*\(\s*id\s*\)/i.test(translated)) {
      translated = translated.replace(
        /ON\s+DUPLICATE\s+KEY\s+UPDATE\s+id\s*=\s*LAST_INSERT_ID\s*\(\s*id\s*\)/gi,
        'ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id'
      );
    } else if (/user_sessions/i.test(translated) && /ON\s+DUPLICATE\s+KEY\s+UPDATE/i.test(translated)) {
      translated = translated.replace(
        /ON\s+DUPLICATE\s+KEY\s+UPDATE[\s\S]*$/gi,
        'ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expires_at = EXCLUDED.expires_at'
      );
    } else if (/ON\s+DUPLICATE\s+KEY\s+UPDATE/i.test(translated)) {
      translated = translated.replace(
        /ON\s+DUPLICATE\s+KEY\s+UPDATE[\s\S]*$/gi,
        'ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, code_expires_at = EXCLUDED.code_expires_at, attempts = 0, last_sent_at = (CURRENT_TIMESTAMP AT TIME ZONE \'UTC\')'
      );
    }

    // 5. Append RETURNING * for INSERT queries if not already present
    const isInsert = /^\s*INSERT\s+INTO/i.test(translated.trim());
    if (isInsert && !/RETURNING/i.test(translated)) {
      translated += ' RETURNING *';
    }

    return { sql: translated, params };
  }

  function formatPostgresResult(res, sql) {
    const isSelect = /^\s*SELECT/i.test(sql.trim());
    if (isSelect) {
      return [res.rows, res.fields];
    }
    const firstRow = res.rows && res.rows[0];
    const insertId = firstRow ? Number(firstRow.id || firstRow.user_id || 0) : 0;
    const header = {
      insertId,
      affectedRows: res.rowCount || 0,
      changedRows: res.rowCount || 0,
      warningStatus: 0
    };
    return [header, res.fields];
  }

  poolInstance = {
    isPostgres: true,
    async execute(sql, params = []) {
      const { sql: transSql, params: transParams } = translateQueryForPostgres(sql, params);
      const res = await pgPool.query(transSql, transParams);
      return formatPostgresResult(res, sql);
    },
    async query(sql, params = []) {
      const { sql: transSql, params: transParams } = translateQueryForPostgres(sql, params);
      const res = await pgPool.query(transSql, transParams);
      return formatPostgresResult(res, sql);
    },
    async getConnection() {
      const client = await pgPool.connect();
      return {
        async execute(sql, params = []) {
          const { sql: transSql, params: transParams } = translateQueryForPostgres(sql, params);
          const res = await client.query(transSql, transParams);
          return formatPostgresResult(res, sql);
        },
        async query(sql, params = []) {
          const { sql: transSql, params: transParams } = translateQueryForPostgres(sql, params);
          const res = await client.query(transSql, transParams);
          return formatPostgresResult(res, sql);
        },
        async beginTransaction() {
          await client.query('BEGIN');
        },
        async commit() {
          await client.query('COMMIT');
        },
        async rollback() {
          await client.query('ROLLBACK');
        },
        release() {
          client.release();
        }
      };
    }
  };

  async function testPostgresConnection() {
    try {
      const client = await pgPool.connect();
      console.log(`[DB] Connected successfully to Supabase PostgreSQL database`);
      client.release();
      try {
        const autoMigrate = require('../migrations/autoMigrate');
        await autoMigrate();
      } catch (migErr) {
        console.warn('[DB WARNING] Auto-migration check encountered an error:', migErr.message);
      }
    } catch (err) {
      console.warn(`[DB WARNING] Supabase PostgreSQL connection check failed (${err.code || err.message}). Please ensure DATABASE_URL/SUPABASE_DB_URL is correct and supabase_schema.sql was executed.`);
    }
  }

  testPostgresConnection();

} else {
  // MySQL connection mode
  const mysql = require('mysql2/promise');

  const requiredVariables = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missingVariables = requiredVariables.filter(
    (name) => process.env[name] === undefined || (name !== 'DB_PASSWORD' && !process.env[name].trim())
  );

  if (missingVariables.length > 0) {
    console.warn(`[DB NOTICE] Missing MySQL variable(s): ${missingVariables.join(', ')}. If using Supabase, set DATABASE_URL or SUPABASE_DB_URL in .env.`);
  }

  const databasePort = Number(process.env.DB_PORT || 3306);

  const mysqlPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number.isInteger(databasePort) ? databasePort : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'project_hanap',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  });

  poolInstance = mysqlPool;
  poolInstance.isPostgres = false;

  async function testMySqlConnection() {
    try {
      const connection = await mysqlPool.getConnection();
      console.log(`[DB] Connected successfully to MySQL database "${process.env.DB_NAME}" at ${process.env.DB_HOST}:${databasePort}`);
      connection.release();
      try {
        const autoMigrate = require('../migrations/autoMigrate');
        await autoMigrate();
      } catch (migErr) {
        console.warn('[DB WARNING] Auto-migration check encountered an error:', migErr.message);
      }
    } catch (err) {
      console.warn(`[DB WARNING] MySQL connection failed (${err.code || err.message}). Please ensure MySQL service is running or switch to Supabase PostgreSQL.`);
    }
  }

  testMySqlConnection();
}

module.exports = poolInstance;
