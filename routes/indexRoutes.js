/**
 * Main / Index Routes
 * Project HANAP - Campus System Round 1
 */

const express = require('express');
const router = express.Router();
const indexController = require('../controllers/indexController');

// Home / Landing Page
router.get('/', indexController.getHomePage);

// About System Information Page
router.get('/about', indexController.getAboutPage);

module.exports = router;
