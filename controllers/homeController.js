/**
 * Home Controller (Delegates to indexController for landing page)
 */

const indexController = require('./indexController');

function showLandingPage(req, res) {
  return indexController.getLandingPage(req, res);
}

module.exports = {
  showLandingPage,
  getHomePage: showLandingPage,
  getLandingPage: showLandingPage
};
