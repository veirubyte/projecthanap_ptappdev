/**
 * Main / Index Routes
 * Project HANAP - Campus System Round 1
 */

const express = require('express');
const router = express.Router();
const indexController = require('../controllers/indexController');

// Home Route:
// Displays the branded landing page for visitors, or dashboard if already logged in
router.get('/', (req, res) => {
  if (req.session && req.session.user) {
    return indexController.getHomePage(req, res);
  }
  return indexController.getLandingPage(req, res);
});

// Explicit Landing Page Route
router.get('/landing', indexController.getLandingPage);

// Dashboard Route (always renders system dashboard)
router.get('/dashboard', indexController.getHomePage);

// About System Information Page
router.get('/about', indexController.getAboutPage);

// Convenient aliases from landing page buttons
router.get('/catalog', (req, res) => res.redirect('/dashboard#browse-catalog'));
router.get('/login', (req, res) => res.redirect('/auth/login'));
router.get('/register', (req, res) => res.redirect('/auth/register'));
router.get('/logout', (req, res) => res.redirect('/auth/logout'));

module.exports = router;
