const { getPool } = require('./db');

// Run SELECT and return array of row objects
async function queryAll(sql, params) {
    const pool = getPool();
    const result = await pool.query(sql, params || []);
    return result.rows;
}

// Run SELECT and return first row object or null
async function queryOne(sql, params) {
    const pool = getPool();
    const result = await pool.query(sql, params || []);
    return result.rows.length > 0 ? result.rows[0] : null;
}

// Run INSERT/UPDATE/DELETE, returns result object with rowCount
async function execute(sql, params) {
    const pool = getPool();
    const result = await pool.query(sql, params || []);
    return result;
}

// Get a dedicated client from the pool for transactions
async function getClient() {
    const pool = getPool();
    return pool.connect();
}

module.exports = { queryAll, queryOne, execute, getClient };
