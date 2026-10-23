/**
 * Index Routes (Starter Scaffold)
 * Project HANAP - Campus System Round 1
 */

const express = require('express');
const router = express.Router();
const indexController = require('../controllers/indexController');

// Home / Landing Page
router.get('/', indexController.getHomePage);

module.exports = router;
