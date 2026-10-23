<<<<<<< HEAD
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
=======
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
>>>>>>> 3f22ea3b830880e80bb60d51cdff21285aedaa0f

module.exports = router;
