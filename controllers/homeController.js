/**
 * Home Controller (Renders branded landing page)
 */

function showLandingPage(req, res) {
  return res.render('landing', { user: req.session?.user || null });
}

module.exports = {
  showLandingPage,
  getHomePage: showLandingPage,
  getLandingPage: showLandingPage
};
