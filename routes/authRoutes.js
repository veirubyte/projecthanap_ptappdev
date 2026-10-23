const controller = require('../controllers/authController');

const router = require('express').Router();

router.get('/login', controller.showLogin);

// POST /login
router.post('/login', controller.login);

// GET /register
router.get('/register', controller.showRegistration);

// POST /register
router.post('/register', controller.register);

// GET /logout
router.get('/logout', controller.logout);

// Password Reset Routes
router.get('/forgot-password', controller.showForgotPassword);
router.post('/forgot-password/request', controller.requestPasswordReset);
router.post('/forgot-password/resend', controller.resendPasswordResetCode);
router.post('/forgot-password/verify', controller.verifyPasswordResetCode);
router.post('/forgot-password/reset', controller.completePasswordReset);

module.exports = router;
