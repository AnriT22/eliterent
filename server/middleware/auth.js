const jwt = require('jsonwebtoken');
const crypto = require('crypto');

let JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
        console.error('FATAL: JWT_SECRET is not set in production. All user sessions will break on restart. Set JWT_SECRET in your .env file.');
        process.exit(1);
    }
    JWT_SECRET = crypto.randomBytes(48).toString('hex');
    console.warn('WARNING: JWT_SECRET not set — generated a random secret. Sessions will reset on each restart. Set JWT_SECRET env var for persistent sessions.');
}

// Tokens live for 30 days, so role and suspension come from the database on each
// request: a suspended, deleted or re-roled account loses access immediately.
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }

    try {
        const { queryOne } = require('../db-helpers');
        const account = await queryOne('SELECT role, suspended_at FROM users WHERE id = $1', [decoded.id]);
        if (!account) {
            return res.status(401).json({ error: 'Account no longer exists' });
        }
        if (account.suspended_at) {
            return res.status(403).json({ error: 'Your account has been suspended. Please contact support.', suspended: true });
        }
        decoded.role = account.role;
    } catch (err) {
        console.error('Auth account check error:', err.message);
        return res.status(503).json({ error: 'Service temporarily unavailable' });
    }

    req.user = decoded;
    next();
}

function requireRole(role) {
    return function (req, res, next) {
        if (req.user.role !== role && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: String(user.email || ''), role: String(user.role || ''), full_name: String(user.full_name || '') },
        JWT_SECRET,
        { expiresIn: '30d', issuer: 'EliteAuto.rent', audience: 'EliteAuto-api' }
    );
}

module.exports = { authenticateToken, requireRole, generateToken, JWT_SECRET };
