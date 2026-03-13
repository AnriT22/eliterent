const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticateToken, generateToken } = require('../middleware/auth');
const { queryAll, queryOne, execute } = require('../db-helpers');

const router = express.Router();

// GET /api/check-availability?field=email&value=test@test.com
router.get('/check-availability', (req, res) => {
    try {
        const { field, value } = req.query;
        if (!field || !value) {
            return res.status(400).json({ error: 'field and value are required' });
        }
        const allowed = ['email', 'phone', 'full_name'];
        if (!allowed.includes(field)) {
            return res.status(400).json({ error: 'Invalid field' });
        }
        const existing = queryOne('SELECT id FROM users WHERE ' + field + ' = ?', [value.trim()]);
        res.json({ available: !existing });
    } catch (err) {
        console.error('Check availability error:', err);
        res.status(500).json({ error: 'Check failed' });
    }
});

// POST /api/register/guest
router.post('/register/guest', async (req, res) => {
    try {
        const { email, password, full_name, phone } = req.body;

        if (!email || !password || !full_name) {
            return res.status(400).json({ error: 'Email, password, and full name are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const existing = queryOne('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        if (phone) {
            const phoneExists = queryOne('SELECT id FROM users WHERE phone = ?', [phone]);
            if (phoneExists) {
                return res.status(409).json({ error: 'Phone number already registered' });
            }
        }

        const nameExists = queryOne('SELECT id FROM users WHERE full_name = ?', [full_name]);
        if (nameExists) {
            return res.status(409).json({ error: 'Username already taken' });
        }

        const password_hash = await bcrypt.hash(password, 12);

        execute(
            'INSERT INTO users (email, password_hash, full_name, phone, role, is_approved) VALUES (?, ?, ?, ?, ?, 0)',
            [email, password_hash, full_name, phone || null, 'guest']
        );

        res.status(201).json({
            message: 'Account created successfully! Please wait for admin approval before logging in.',
            pending_approval: true
        });
    } catch (err) {
        console.error('Guest registration error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// POST /api/register/partner
router.post('/register/partner', async (req, res) => {
    try {
        const {
            email, password, full_name, phone,
            company_name, description, location,
            whatsapp, telegram
        } = req.body;

        if (!email || !password || !full_name) {
            return res.status(400).json({ error: 'Email, password, and full name are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        if (!company_name) {
            return res.status(400).json({ error: 'Company name is required for partners' });
        }

        const existing = queryOne('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        if (phone) {
            const phoneExists = queryOne('SELECT id FROM users WHERE phone = ?', [phone]);
            if (phoneExists) {
                return res.status(409).json({ error: 'Phone number already registered' });
            }
        }

        const nameExists = queryOne('SELECT id FROM users WHERE full_name = ?', [full_name]);
        if (nameExists) {
            return res.status(409).json({ error: 'Username already taken' });
        }

        const password_hash = await bcrypt.hash(password, 12);

        // Insert user
        execute(
            'INSERT INTO users (email, password_hash, full_name, phone, role, is_approved) VALUES (?, ?, ?, ?, ?, 0)',
            [email, password_hash, full_name, phone || null, 'partner']
        );

        const newUser = queryOne('SELECT id FROM users WHERE email = ?', [email]);
        const userId = newUser.id;

        // Insert partner profile
        execute(`
            INSERT INTO partner_profiles 
            (user_id, company_name, description, location, whatsapp, telegram)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                userId,
                company_name,
                description || null,
                location || null,
                whatsapp || null,
                telegram || null
            ]
        );

        res.status(201).json({
            message: 'Partner account created successfully! Please wait for admin approval before logging in.',
            pending_approval: true
        });
    } catch (err) {
        console.error('Partner registration error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// POST /api/login
router.post('/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = queryOne('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check if user is approved by admin (admins bypass this)
        if (user.role !== 'admin' && !user.is_approved) {
            return res.status(403).json({ error: 'Your account is waiting for admin approval. Please try again later.' });
        }

        // Enforce role separation: guest cannot login as partner and vice versa
        // Admin accounts bypass this check
        if (role && role !== user.role && user.role !== 'admin') {
            if (role === 'guest') {
                return res.status(403).json({ error: 'This account is registered as a Partner. Please select "Login as Partner".' });
            } else {
                return res.status(403).json({ error: 'This account is registered as a Guest. Please select "Login as Guest".' });
            }
        }

        const token = generateToken(user);

        const responseUser = {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            role: user.role
        };

        if (user.role === 'partner') {
            const profile = queryOne('SELECT company_name FROM partner_profiles WHERE user_id = ?', [user.id]);
            if (profile) {
                responseUser.company_name = profile.company_name;
            }
        }

        res.json({
            message: 'Login successful',
            token,
            user: responseUser
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

// GET /api/me — get current user profile
router.get('/me', authenticateToken, (req, res) => {
    try {
        const user = queryOne(
            'SELECT id, email, full_name, phone, role, avatar_url, created_at FROM users WHERE id = ?',
            [req.user.id]
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.role === 'partner') {
            const profile = queryOne('SELECT * FROM partner_profiles WHERE user_id = ?', [user.id]);
            if (profile) {
                user.partner_profile = {
                    company_name: profile.company_name,
                    description: profile.description,
                    location: profile.location,
                    whatsapp: profile.whatsapp,
                    telegram: profile.telegram,
                    categories: JSON.parse(profile.categories || '[]'),
                    engines: JSON.parse(profile.engines || '[]'),
                    gearboxes: JSON.parse(profile.gearboxes || '[]'),
                    drive_types: JSON.parse(profile.drive_types || '[]'),
                    interior_types: JSON.parse(profile.interior_types || '[]'),
                    steering_sides: JSON.parse(profile.steering_sides || '[]'),
                    payment_methods: JSON.parse(profile.payment_methods || '[]'),
                    is_verified: profile.is_verified
                };
            }
        }

        res.json({ user });
    } catch (err) {
        console.error('Get profile error:', err);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// PUT /api/me/password — change password
router.put('/me/password', authenticateToken, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'current_password and new_password are required' });
        }
        if (new_password.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }
        const user = queryOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const valid = await bcrypt.compare(current_password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

        const new_hash = await bcrypt.hash(new_password, 12);
        execute('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [new_hash, req.user.id]);
        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('Password change error:', err);
        res.status(500).json({ error: 'Failed to update password' });
    }
});

// PUT /api/me — update profile (name, phone)
router.put('/me', authenticateToken, async (req, res) => {
    try {
        const { full_name, phone } = req.body;
        if (!full_name) return res.status(400).json({ error: 'full_name is required' });
        execute('UPDATE users SET full_name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [full_name, phone || null, req.user.id]);
        const user = queryOne('SELECT id, email, full_name, phone, role FROM users WHERE id = ?', [req.user.id]);
        res.json({ message: 'Profile updated', user });
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// DELETE /api/me — delete own account
router.delete('/me', authenticateToken, async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) return res.status(400).json({ error: 'password is required to confirm deletion' });
        const user = queryOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Password is incorrect' });
        execute('DELETE FROM users WHERE id = ?', [req.user.id]);
        res.json({ message: 'Account deleted successfully' });
    } catch (err) {
        console.error('Delete account error:', err);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

module.exports = router;
