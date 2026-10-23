function showLandingPage(req, res) {
    res.render('landing', { user: req.session.user || null });
}

module.exports = { showLandingPage };
