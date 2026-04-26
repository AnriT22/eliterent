const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
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
        var uniqueName = 'vehicle_' + req.user.id + '_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8) + ext;
        cb(null, uniqueName);
    }
});

const fileFilter = function (req, file, cb) {
    var allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    var validExts = ['.jpg', '.jpeg', '.png', '.webp'];
    var mimeType = file.mimetype;
    var ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(mimeType) && validExts.includes(ext)) {
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

// Re-encode uploaded image: strip EXIF, resize, compress to JPEG
async function processImage(filePath) {
    var outputPath = filePath.replace(/\.[^.]+$/, '.jpg');
    var tmpPath = outputPath + '.tmp';
    try {
        await sharp(filePath, { failOnError: false, limitInputPixels: 100000000 })
            .rotate() // auto-rotate based on EXIF before stripping
            .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85, mozjpeg: true })
            .toFile(tmpPath);
        // Replace original with processed version
        if (outputPath !== filePath) {
            try { fs.unlinkSync(filePath); } catch (e) {}
        }
        fs.renameSync(tmpPath, outputPath);
        return path.basename(outputPath);
    } catch (err) {
        // Clean up tmp file if it was partially created
        try { fs.unlinkSync(tmpPath); } catch (e) {}
        throw err;
    }
}

// POST /api/upload/vehicle-image — upload single image
router.post('/vehicle-image', authenticateToken, upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
    }
    try {
        var processedName = await processImage(req.file.path);
        var imageUrl = '/uploads/vehicles/' + processedName;
        res.json({ message: 'Image uploaded', url: imageUrl });
    } catch (err) {
        console.error('Image processing error:', err.message);
        // Fallback: serve original if processing fails
        var imageUrl = '/uploads/vehicles/' + req.file.filename;
        res.json({ message: 'Image uploaded', url: imageUrl });
    }
});

// POST /api/upload/vehicle-images — upload multiple images (up to 10)
router.post('/vehicle-images', authenticateToken, upload.array('images', 10), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No image files provided' });
    }
    var urls = [];
    for (var i = 0; i < req.files.length; i++) {
        try {
            var processedName = await processImage(req.files[i].path);
            urls.push('/uploads/vehicles/' + processedName);
        } catch (err) {
            console.error('Image processing error for ' + req.files[i].filename + ':', err.message);
            urls.push('/uploads/vehicles/' + req.files[i].filename);
        }
    }
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
