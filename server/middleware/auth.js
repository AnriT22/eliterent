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

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
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
        { expiresIn: '7d', issuer: 'royalcar.rent', audience: 'royalcar-api' }
    );
}

module.exports = { authenticateToken, requireRole, generateToken, JWT_SECRET };
