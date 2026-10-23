const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const safeName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
        cb(null, safeName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG, and WebP image formats are supported.'));
        }
    }
});

function uploadReportPhoto(req, res, next) {
    upload.single('photo')(req, res, (uploadError) => {
        if (uploadError) {
            console.error('Failed to upload report photo:', uploadError);
            const reportType = req.query.type === 'found' ? 'found' : 'lost';
            const message = uploadError.code === 'LIMIT_FILE_SIZE'
                ? 'Photo must be 5 MB or smaller.'
                : 'Photo upload failed. Choose a JPEG, PNG, or WebP image and try again.';
            return res.redirect(`/items/new?type=${reportType}&error=${encodeURIComponent(message)}`);
        }

        return next();
    });
}

function reportUploadBeforeCsrf(req, res, next) {
    if (req.method !== 'POST' || req.path !== '/items/report') return next();
    if (!req.session.user) {
        return res.redirect(`/login?msg=${encodeURIComponent('Please sign in to access this feature.')}`);
    }
    return uploadReportPhoto(req, res, next);
}

module.exports = { upload, reportUploadBeforeCsrf };
