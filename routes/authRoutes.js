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

module.exports = router;
