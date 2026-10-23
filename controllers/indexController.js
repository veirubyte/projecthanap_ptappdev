/**
 * Index / Dashboard Controller
 * Project HANAP - Campus System Round 1
 */

/**
 * Render Home / Overview Page
 */
exports.getHomePage = (req, res) => {
  res.render('pages/index', {
    title: 'Project HANAP - Campus System',
    user: req.session ? req.session.user : null,
    stats: {
      reportedLost: 18,
      reportedFound: 24,
      reunited: 15,
      activeOffices: 4
    }
  });
};

/**
 * Render Branded Landing Page
 */
exports.getLandingPage = (req, res) => {
  res.render('pages/landing', {
    title: 'HANAP - CSPC Campus Lost & Found Portal',
    user: req.session ? req.session.user : null
  });
};

/**
 * Render About / System Specs Page
 */
exports.getAboutPage = (req, res) => {
  res.render('pages/about', {
    title: 'About Project HANAP',
    user: req.session ? req.session.user : null
  });
};
