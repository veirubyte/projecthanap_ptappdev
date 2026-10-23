const db = require('../config/db');

async function disableMfa(params, values = [], connection = db) {
    return connection.execute(`UPDATE user_mfa
             SET code_hash = NULL, code_expires_at = NULL, attempts = 0
             WHERE user_id = ?`, params);
}

async function deleteAccount(params, values = [], connection = db) {
    return connection.execute(`DELETE FROM user_mfa WHERE user_id = ?`, params);
}

async function issueCode(params, values = [], connection = db) {
    return connection.execute(`SELECT code_hash, code_expires_at, last_sent_at, attempts,
                (code_expires_at > UTC_TIMESTAMP()) AS code_valid,
                TIMESTAMPDIFF(SECOND, last_sent_at, UTC_TIMESTAMP()) AS seconds_since_sent
         FROM user_mfa
         WHERE user_id = ?`, params);
}

async function issueCodeQuery2(params, values = [], connection = db) {
    return connection.execute(`INSERT INTO user_mfa (user_id, code_hash, code_expires_at, attempts, last_sent_at)
         VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${values[0]} MINUTE), 0, UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE
            code_hash = VALUES(code_hash),
            code_expires_at = VALUES(code_expires_at),
            attempts = 0,
            last_sent_at = UTC_TIMESTAMP()`, params);
}

async function issueCodeQuery3(params, values = [], connection = db) {
    return connection.execute(`UPDATE user_mfa
             SET code_hash = NULL, code_expires_at = NULL, attempts = 0, last_sent_at = NULL
             WHERE user_id = ?`, params);
}

async function verifyCode(params, values = [], connection = db) {
    return connection.execute(`SELECT code_hash, code_expires_at, attempts,
                    (code_expires_at <= UTC_TIMESTAMP()) AS code_expired
             FROM user_mfa
             WHERE user_id = ?
             FOR UPDATE`, params);
}

async function verifyCodeQuery2(params, values = [], connection = db) {
    return connection.execute(`UPDATE user_mfa SET code_hash = NULL, code_expires_at = NULL, attempts = 0, last_sent_at = NULL WHERE user_id = ?`, params);
}

async function verifyCodeQuery3(params, values = [], connection = db) {
    return connection.execute(`UPDATE user_mfa SET code_hash = NULL, code_expires_at = NULL, attempts = 0, last_sent_at = NULL WHERE user_id = ?`, params);
}

async function verifyCodeQuery4(params, values = [], connection = db) {
    return connection.execute(`UPDATE user_mfa
                     SET code_hash = NULL, code_expires_at = NULL, attempts = 0, last_sent_at = NULL
                     WHERE user_id = ?`, params);
}

async function verifyCodeQuery5(params, values = [], connection = db) {
    return connection.execute(`UPDATE user_mfa SET attempts = ? WHERE user_id = ?`, params);
}

async function verifyCodeQuery6(params, values = [], connection = db) {
    return connection.execute(`UPDATE user_mfa
             SET code_hash = NULL, code_expires_at = NULL, attempts = 0, last_sent_at = NULL
             WHERE user_id = ?`, params);
}

module.exports = {
    disableMfa,
    deleteAccount,
    issueCode,
    issueCodeQuery2,
    issueCodeQuery3,
    verifyCode,
    verifyCodeQuery2,
    verifyCodeQuery3,
    verifyCodeQuery4,
    verifyCodeQuery5,
    verifyCodeQuery6
};
