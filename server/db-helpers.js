const { getDB, saveDB } = require('./db');

// sql.js getAsObject() can return Uint8Array for TEXT columns.
// This helper converts them to proper strings.
function sanitizeRow(row) {
    if (!row) return row;
    var clean = {};
    Object.keys(row).forEach(function (key) {
        var val = row[key];
        if (val instanceof Uint8Array) {
            clean[key] = new TextDecoder().decode(val);
        } else {
            clean[key] = val;
        }
    });
    return clean;
}

// Run SELECT and return array of row objects
function queryAll(sql, params) {
    const db = getDB();
    const stmt = db.prepare(sql);
    if (params && params.length > 0) stmt.bind(params);
    var rows = [];
    while (stmt.step()) {
        rows.push(sanitizeRow(stmt.getAsObject()));
    }
    stmt.free();
    return rows;
}

// Run SELECT and return first row object or null
function queryOne(sql, params) {
    var rows = queryAll(sql, params);
    return rows.length > 0 ? rows[0] : null;
}

// Run INSERT/UPDATE/DELETE
function execute(sql, params) {
    const db = getDB();
    if (params && params.length > 0) {
        db.run(sql, params);
    } else {
        db.run(sql);
    }
    saveDB();
}

module.exports = { queryAll, queryOne, execute, sanitizeRow };
