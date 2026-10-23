/**
 * Authentication Routes
 * Project HANAP - Campus System Round 1
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { isGuest, isAuthenticated } = require('../middleware/authMiddleware');

// Login page & submission
router.get('/login', isGuest, authController.getLoginPage);
router.post('/login', isGuest, authController.postLogin);

// Registration page & submission
router.get('/register', isGuest, authController.getRegisterPage);
router.post('/register', isGuest, authController.postRegister);

// Logout
router.get('/logout', authController.logout);
router.post('/logout', authController.logout);

module.exports = router;
