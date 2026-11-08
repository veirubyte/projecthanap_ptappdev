function redirectIfNoReportPhoto(files, res, returnUrl, message) {
    if (files.length > 0) return false;

    const separator = returnUrl.includes('?') ? '&' : '?';
    res.redirect(`${returnUrl}${separator}error=${encodeURIComponent(message)}`);
    return true;
}

module.exports = { redirectIfNoReportPhoto };
