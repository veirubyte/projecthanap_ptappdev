/**
 * Index Routes (Starter Scaffold)
 * Project HANAP - Campus System Round 1
 */

const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');

// Home / Landing Page
router.get('/', homeController.getHomePage);

module.exports = router;
