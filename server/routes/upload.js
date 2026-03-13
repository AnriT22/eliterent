const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'vehicles');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        var ext = path.extname(file.originalname).toLowerCase();
        var uniqueName = 'vehicle_' + req.user.id + '_' + Date.now() + ext;
        cb(null, uniqueName);
    }
});

const fileFilter = function (req, file, cb) {
    var allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    var mimeType = file.mimetype;
    if (allowedTypes.includes(mimeType)) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed (jpg, png, webp)'));
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

// POST /api/upload/vehicle-image — upload single image
router.post('/vehicle-image', authenticateToken, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
    }
    var imageUrl = '/uploads/vehicles/' + req.file.filename;
    res.json({ message: 'Image uploaded', url: imageUrl });
});

// POST /api/upload/vehicle-images — upload multiple images (up to 6)
router.post('/vehicle-images', authenticateToken, upload.array('images', 6), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No image files provided' });
    }
    var urls = req.files.map(function (f) {
        return '/uploads/vehicles/' + f.filename;
    });
    res.json({ message: 'Images uploaded', urls: urls });
});

// Error handler for multer errors (file too large, invalid type)
router.use(function (err, req, res, next) {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 20MB.' });
        }
        return res.status(400).json({ error: err.message });
    }
    if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
});

module.exports = router;
