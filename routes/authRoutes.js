/**
 * Authentication Routes (Starter Scaffold)
 * Project HANAP - Campus System Round 1
 * 
 * Starter route placeholders to be implemented by team members:
 * - Member 1: Express routes & validation
 * - Member 2: Auth views & forms
 * - Member 3: Database queries, bcrypt, and session auth
 */

const express = require('express');
const router = express.Router();

// Starter placeholder for login route
router.get('/login', (req, res) => {
  res.render('pages/index', {
    title: 'Project HANAP - Login (Placeholder)'
  });
});

// Starter placeholder for register route
router.get('/register', (req, res) => {
  res.render('pages/index', {
    title: 'Project HANAP - Register (Placeholder)'
  });
});

// Starter placeholder for logout route
router.get('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(() => {
      res.redirect('/');
    });
  } else {
    res.redirect('/');
  }
});

module.exports = router;
