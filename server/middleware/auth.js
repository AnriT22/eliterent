const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'myrent-secret-key-change-in-production';

if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'myrent-secret-key-change-in-production') {
    console.error('FATAL: JWT_SECRET must be set in production. Exiting.');
    process.exit(1);
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
        if (req.user.role !== role) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: String(user.email || ''), role: String(user.role || ''), full_name: String(user.full_name || '') },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

module.exports = { authenticateToken, requireRole, generateToken, JWT_SECRET };
