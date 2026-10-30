/**
 * Persistent Database Session Store for Express-Session
 * Supports both Supabase PostgreSQL (Postgres 15+ JSONB) and MySQL (JSON)
 * Ensures authenticated sessions persist across Vercel serverless lambda cold starts
 * Project HANAP • Campus System
 */
const session = require('express-session');
const pool = require('./db');

const sessionCache = new Map();
const sessionLastTouch = new Map();
const SESSION_CACHE_TTL = 15000; // 15 seconds
const TOUCH_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

class DatabaseSessionStore extends session.Store {
    constructor() {
        super();
        this.pool = pool;
    }

    async get(sid, callback) {
        const now = Date.now();
        const cached = sessionCache.get(sid);
        if (cached && (now - cached.cachedAt < SESSION_CACHE_TTL) && cached.expiresAt > now) {
            return callback(null, cached.sess);
        }

        try {
            const [rows] = await this.pool.execute(
                'SELECT sess, expires_at FROM user_sessions WHERE sid = ? AND expires_at > CURRENT_TIMESTAMP LIMIT 1',
                [sid]
            );
            if (!rows || rows.length === 0) {
                sessionCache.delete(sid);
                return callback(null, null);
            }
            const raw = rows[0].sess;
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            const expiresAt = new Date(rows[0].expires_at).getTime();

            sessionCache.set(sid, { sess: parsed, expiresAt, cachedAt: now });
            if (sessionCache.size > 2000) {
                const oldest = sessionCache.keys().next().value;
                sessionCache.delete(oldest);
            }

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

            sessionCache.set(sid, { sess, expiresAt: expires.getTime(), cachedAt: Date.now() });
            sessionLastTouch.set(sid, Date.now());

            if (callback) callback(null);
        } catch (err) {
            console.error('[SessionStore] Error saving session:', err.message);
            if (callback) callback(err);
        }
    }

    async destroy(sid, callback) {
        try {
            sessionCache.delete(sid);
            sessionLastTouch.delete(sid);
            await this.pool.execute('DELETE FROM user_sessions WHERE sid = ?', [sid]);
            if (callback) callback(null);
        } catch (err) {
            console.error('[SessionStore] Error destroying session:', err.message);
            if (callback) callback(err);
        }
    }

    async touch(sid, sess, callback) {
        const now = Date.now();
        const lastTouch = sessionLastTouch.get(sid) || 0;

        // Skip database write if touched within the last 5 minutes
        if (now - lastTouch < TOUCH_DEBOUNCE_MS) {
            if (callback) callback(null);
            return;
        }

        try {
            const maxAge = (sess.cookie && sess.cookie.maxAge) || (7 * 24 * 60 * 60 * 1000);
            const expires = new Date(now + maxAge);
            await this.pool.execute('UPDATE user_sessions SET expires_at = ? WHERE sid = ?', [expires, sid]);
            sessionLastTouch.set(sid, now);
            if (callback) callback(null);
        } catch (err) {
            if (callback) callback(err);
        }
    }
}

module.exports = DatabaseSessionStore;
