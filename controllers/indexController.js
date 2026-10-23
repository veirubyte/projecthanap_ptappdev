/**
 * Index Controller (Starter Scaffold)
 * Project HANAP - Campus System Round 1
 */

exports.getHomePage = (req, res) => {
  res.render('pages/index', {
    title: 'Project HANAP - Starter Baseline'
  });
};
