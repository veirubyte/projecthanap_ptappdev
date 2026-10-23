const db = require('../config/db');

module.exports = {
    getConnection: () => db.getConnection()
};
