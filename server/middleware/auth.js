const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'myrent-secret-key-change-in-production';

if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'myrent-secret-key-change-in-production') {
    console.error('FATAL: JWT_SECRET must be set in production. Exiting.');
    process.exit(1);
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

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
        if (req.user.role !== role) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

function generateToken(user) {
    // Ensure all values are proper strings (sql.js can return Uint8Array for TEXT columns)
    function str(val) {
        if (val instanceof Uint8Array) return new TextDecoder().decode(val);
        return val != null ? String(val) : '';
    }
    return jwt.sign(
        { id: user.id, email: str(user.email), role: str(user.role), full_name: str(user.full_name) },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

module.exports = { authenticateToken, requireRole, generateToken, JWT_SECRET };
