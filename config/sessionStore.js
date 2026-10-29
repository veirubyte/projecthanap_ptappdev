/**
 * Persistent Database Session Store for Express-Session
 * Supports both Supabase PostgreSQL (Postgres 15+ JSONB) and MySQL (JSON)
 * Ensures authenticated sessions persist across Vercel serverless lambda cold starts
 * Project HANAP • Campus System
 */
const session = require('express-session');
const pool = require('./db');

class DatabaseSessionStore extends session.Store {
    constructor() {
        super();
        this.pool = pool;
    }

    async get(sid, callback) {
        try {
            const [rows] = await this.pool.execute(
                'SELECT sess FROM user_sessions WHERE sid = ? AND expires_at > CURRENT_TIMESTAMP LIMIT 1',
                [sid]
            );
            if (!rows || rows.length === 0) {
                return callback(null, null);
            }
            const raw = rows[0].sess;
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return callback(null, parsed);
        } catch (err) {
            console.error('[SessionStore] Error reading session:', err.message);
            return callback(null, null);
        }
    }

    async set(sid, sess, callback) {
        try {
            const maxAge = (sess.cookie && sess.cookie.maxAge) || (7 * 24 * 60 * 60 * 1000);
            const expires = new Date(Date.now() + maxAge);
            const sessStr = JSON.stringify(sess);

            if (this.pool.isPostgres) {
                await this.pool.execute(
                    `INSERT INTO user_sessions (sid, sess, expires_at)
                     VALUES (?, ?::jsonb, ?)
                     ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expires_at = EXCLUDED.expires_at`,
                    [sid, sessStr, expires]
                );
            } else {
                await this.pool.execute(
                    `INSERT INTO user_sessions (sid, sess, expires_at)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE sess = VALUES(sess), expires_at = VALUES(expires_at)`,
                    [sid, sessStr, expires]
                );
            }
            if (callback) callback(null);
        } catch (err) {
            console.error('[SessionStore] Error saving session:', err.message);
            if (callback) callback(err);
        }
    }

    async destroy(sid, callback) {
        try {
            await this.pool.execute('DELETE FROM user_sessions WHERE sid = ?', [sid]);
            if (callback) callback(null);
        } catch (err) {
            console.error('[SessionStore] Error destroying session:', err.message);
            if (callback) callback(err);
        }
    }

    async touch(sid, sess, callback) {
        try {
            const maxAge = (sess.cookie && sess.cookie.maxAge) || (7 * 24 * 60 * 60 * 1000);
            const expires = new Date(Date.now() + maxAge);
            await this.pool.execute('UPDATE user_sessions SET expires_at = ? WHERE sid = ?', [expires, sid]);
            if (callback) callback(null);
        } catch (err) {
            if (callback) callback(err);
        }
    }
}

module.exports = DatabaseSessionStore;
