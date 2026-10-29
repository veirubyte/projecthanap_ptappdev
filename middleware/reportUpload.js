const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { isAdmin } = require('../config/roles');

const isVercel = Boolean(process.env.VERCEL);
const uploadDir = isVercel
    ? path.join('/tmp', 'uploads')
    : path.join(__dirname, '..', 'public', 'uploads');

try {
    fs.mkdirSync(uploadDir, { recursive: true });
} catch (e) {
    // Graceful fallback for read-only environments
}
const MAX_REPORT_PHOTOS = 6;
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/pjpeg']);
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);

async function detectImageType(filePath) {
    const handle = await fs.promises.open(filePath, 'r');
    try {
        const header = Buffer.alloc(12);
        const { bytesRead } = await handle.read(header, 0, header.length, 0);

        if (bytesRead >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
            return 'image/jpeg';
        }
        if (bytesRead >= 8 && header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
            return 'image/png';
        }
        if (bytesRead >= 12 && header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP') {
            return 'image/webp';
        }
        return null;
    } finally {
        await handle.close();
    }
}

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
    limits: { fileSize: 5 * 1024 * 1024, files: MAX_REPORT_PHOTOS },
    fileFilter: (req, file, cb) => {
        const mimeType = file.mimetype.toLowerCase();
        const extension = path.extname(file.originalname).toLowerCase();
        if (allowedMimeTypes.has(mimeType) || allowedExtensions.has(extension)) {
            cb(null, true);
        } else {
            const error = new Error('Only JPEG, PNG, and WebP image formats are supported.');
            error.code = 'UNSUPPORTED_IMAGE_TYPE';
            error.receivedMimeType = mimeType;
            cb(error);
        }
    }
});

function uploadReportPhotos(req, res, next) {
    const uploadErrorRedirect = (message) => {
        const encodedMessage = encodeURIComponent(message);
        const editMatch = req.path.match(/^\/items\/(\d+)\/edit$/);
        if (editMatch) return res.redirect(`/items/${editMatch[1]}/edit?error=${encodedMessage}`);
        if (req.path === '/admin/items/log') return res.redirect(`/admin/dashboard?tab=posted&error=${encodedMessage}`);
        const reportType = req.query.type === 'found' ? 'found' : 'lost';
        return res.redirect(`/items/new?type=${reportType}&error=${encodedMessage}`);
    };

    upload.array('photos', 6)(req, res, async (uploadError) => {
        if (uploadError) {
            console.error('Failed to upload report photo:', {
                code: uploadError.code || 'UPLOAD_ERROR',
                mimeType: uploadError.receivedMimeType || undefined,
                message: uploadError.message
            });
            await Promise.all((req.files || []).map((file) => fs.promises.unlink(file.path).catch((err) => {
                if (err.code !== 'ENOENT') console.error('Failed to remove partial report upload:', err);
            })));
            const message = uploadError.code === 'LIMIT_FILE_SIZE'
                ? 'Each photo must be 5 MB or smaller.'
                : ['LIMIT_FILE_COUNT', 'LIMIT_UNEXPECTED_FILE'].includes(uploadError.code)
                    ? 'You can upload up to 6 photos per report.'
                    : uploadError.code === 'UNSUPPORTED_IMAGE_TYPE'
                        ? 'Unsupported file type. Choose JPEG, PNG, or WebP images.'
                        : 'Photo upload failed. Please try again.';
            return uploadErrorRedirect(message);
        }

        const uploadedFiles = req.files || [];
        let detectedTypes;
        try {
            detectedTypes = await Promise.all(uploadedFiles.map((file) => detectImageType(file.path)));
        } catch (err) {
            console.error('Failed to verify uploaded image contents:', err);
            await Promise.all(uploadedFiles.map((file) => fs.promises.unlink(file.path).catch((unlinkError) => {
                if (unlinkError.code !== 'ENOENT') console.error('Failed to remove unverified report upload:', unlinkError);
            })));
            const message = 'Photo upload could not be verified. Please try again.';
            return uploadErrorRedirect(message);
        }

        if (detectedTypes.some((type) => !type)) {
            console.error('Rejected report upload with invalid image contents:', {
                fileCount: uploadedFiles.length,
                detectedTypes
            });
            await Promise.all(uploadedFiles.map((file) => fs.promises.unlink(file.path).catch((err) => {
                if (err.code !== 'ENOENT') console.error('Failed to remove invalid report upload:', err);
            })));
            const message = 'One or more files are not valid JPEG, PNG, or WebP images. Choose the original image files and try again.';
            return uploadErrorRedirect(message);
        }

        try {
            for (let index = 0; index < uploadedFiles.length; index += 1) {
                const file = uploadedFiles[index];
                const expectedExtension = {
                    'image/jpeg': '.jpg',
                    'image/png': '.png',
                    'image/webp': '.webp'
                }[detectedTypes[index]];
                const normalizedPath = path.join(uploadDir, `${path.parse(file.filename).name}${expectedExtension}`);
                if (normalizedPath !== file.path) {
                    await fs.promises.rename(file.path, normalizedPath);
                    file.path = normalizedPath;
                    file.filename = path.basename(normalizedPath);
                }
                const buffer = await fs.promises.readFile(file.path);
                file.base64Data = `data:${detectedTypes[index]};base64,${buffer.toString('base64')}`;
            }
        } catch (err) {
            console.error('Failed to normalize uploaded image filename:', err);
            await Promise.all(uploadedFiles.map((file) => fs.promises.unlink(file.path).catch((unlinkError) => {
                if (unlinkError.code !== 'ENOENT') console.error('Failed to remove unnormalized report upload:', unlinkError);
            })));
            const message = 'Photo upload failed while preparing the images. Please try again.';
            return uploadErrorRedirect(message);
        }

        return next();
    });
}

function reportUploadBeforeCsrf(req, res, next) {
    if (req.method !== 'POST') return next();
    const isUserReport = req.path === '/items/report';
    const isItemEdit = /^\/items\/\d+\/edit$/.test(req.path);
    const isAdminIntake = req.path === '/admin/items/log';
    if (!isUserReport && !isItemEdit && !isAdminIntake) return next();
    if (!req.session.user) {
        return res.redirect(`/login?msg=${encodeURIComponent('Please sign in to access this feature.')}`);
    }
    if (isAdminIntake && !isAdmin(req.session.user)) return next();
    return uploadReportPhotos(req, res, next);
}

module.exports = { upload, reportUploadBeforeCsrf };
