const assert = require('assert');
const { getHanapFallbackReply } = require('../services/hanapFallback');
const { redirectIfNoReportPhoto } = require('../services/reportPhoto');

function run() {
    const redirects = [];
    const res = {
        redirect(url) {
            redirects.push(url);
            return url;
        }
    };

    const userBlocked = redirectIfNoReportPhoto(
        [],
        res,
        '/items/new?type=lost',
        'Add at least one photo before submitting your report.'
    );
    const adminBlocked = redirectIfNoReportPhoto(
        [],
        res,
        '/admin/dashboard?tab=posted',
        'Add at least one photo before logging this item.'
    );
    assert.strictEqual(userBlocked, true, 'User report without a photo must be rejected.');
    assert.strictEqual(adminBlocked, true, 'Admin item intake without a photo must be rejected.');
    assert.strictEqual(redirectIfNoReportPhoto([{}], res, '/items/new?type=lost', 'missing'), false,
        'Reports with a photo must continue.');
    assert.ok(redirects[0].includes('type=lost&error='), 'User report errors must return to the selected report form.');
    assert.ok(redirects[1].includes('tab=posted&error='), 'Admin intake errors must return to the intake tab.');

    const fallbackReply = getHanapFallbackReply([
        { role: 'user', text: 'Can I post without adding an image?' }
    ]);
    assert.ok(
        fallbackReply.includes('A photo is required'),
        'The assistant must explain the photo requirement.'
    );

    console.log('PASS: New user reports and admin item intake require a photo.');
    console.log('PASS: The assistant explains the required photo restriction.');
}

try {
    run();
} catch (error) {
    console.error(error);
    process.exitCode = 1;
}
