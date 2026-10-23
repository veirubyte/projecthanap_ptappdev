/**
 * Project HANAP - Campus System Round 1
 * Core Express Application Entrypoint
 * 
 * Modular MVC Architecture:
 * - config/      : Database and environment configuration
 * - controllers/ : Request handlers and business logic
 * - middleware/  : Authentication and server-side validation
 * - models/      : Data access objects and schemas
 * - routes/      : Express route definitions
 * - views/       : EJS presentation templates (partials and pages)
 * - public/      : Static assets (CSS, JS, images)
 */

require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');

// Import modular routes
const indexRoutes = require('./routes/indexRoutes');
const authRoutes = require('./routes/authRoutes');

// Initialize Express application
const app = express();
const PORT = process.env.PORT || 3000;

// ==============================================================================
// 1. Template Engine Configuration (EJS)
// ==============================================================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ==============================================================================
// 2. Core Middleware
// ==============================================================================
// Parse incoming URL-encoded form payloads
app.use(express.urlencoded({ extended: true }));

// Parse incoming JSON payloads
app.use(express.json());

// Serve static assets from public/ folder
app.use(express.static(path.join(__dirname, 'public')));

// Configure user session management
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'projecthanap_development_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
  })
);

// Expose global template variables (current user, active route) across all views
app.use((req, res, next) => {
  res.locals.currentUser = (req.session && req.session.user) ? req.session.user : null;
  res.locals.currentPath = req.path;
  next();
});

// ==============================================================================
// 3. Mount Application Routes
// ==============================================================================
app.use('/', indexRoutes);
app.use('/auth', authRoutes);

// ==============================================================================
// 4. Error Handling
// ==============================================================================
// 404 Catch-All Route
app.use((req, res) => {
  res.status(404).render('pages/error', {
    title: '404 - Page Not Found',
    statusCode: 404,
    errorMessage: `The requested URL "${req.originalUrl}" was not found on this campus server.`,
    user: res.locals.currentUser
  });
});

// Global 500 Error Handler
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err.stack || err);
  res.status(500).render('pages/error', {
    title: '500 - Internal Server Error',
    statusCode: 500,
    errorMessage: process.env.NODE_ENV === 'production' 
      ? 'An unexpected system error occurred. Please contact the administrator.' 
      : err.message,
    user: res.locals.currentUser
  });
});

// ==============================================================================
// 5. Server Initialization
// ==============================================================================
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`================================================================`);
    console.log(`🚀 Project HANAP Server active on http://localhost:${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`================================================================`);
  });
}

module.exports = app;
