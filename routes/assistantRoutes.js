const express = require('express');
const { rateLimiter } = require('../config/security');
const assistantController = require('../controllers/assistantController');

const router = express.Router();
const chatRateLimiter = rateLimiter({ max: 12, windowMs: 5 * 60 * 1000 });

router.post('/chat', (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Please sign in to use the HANAP assistant.' });
    }
    next();
}, chatRateLimiter, assistantController.chat);

module.exports = router;
