const HELP_TOPICS = [
    {
        matches: /\b(forgot|reset|recover|can't log in|cannot log in|locked out).{0,35}\b(password|account|login)?\b|\b(password|account).{0,25}\b(reset|recovery)\b/i,
        reply: 'To reset a forgotten password, open the Sign In page and choose Forgot Password. Enter your registered email, verify the one-time code, then set a new password. If the code does not arrive, check your email address and contact the system administrator.'
    },
    {
        matches: /\b(register|registration|sign ?up|create an account|institutional email|student account|staff account|login|log in|sign ?in)\b/i,
        reply: 'Use Register to create an account and Sign In to access HANAP. Institutional accounts must use the appropriate CSPC email domain shown on the registration form. If you already have an account but cannot access it, use Forgot Password.'
    },
    {
        matches: /\b(mfa|two.factor|one.time code|otp|verification code|login code|email code)\b/i,
        reply: 'HANAP can use email multi-factor authentication (MFA). Manage MFA in Settings; enabling or disabling it requires your password. If a code is not arriving, check your registered email and contact the system administrator.'
    },
    {
        matches: /\b(report|post|list|submit|add|upload).{0,35}\b(lost|found|item|belonging)\b|\b(lost|found)\b|\b(item|belonging).{0,25}\b(lost|found)\b/i,
        excludes: /\b(claim|ownership)\b/i,
        reply: 'Sign in and open Report an Item (/items/new). Choose Lost or Found, enter the item name, category, location, and description, then optionally add photos and submit. Guests cannot post found-item reports; please surrender found property to Campus Security.'
    },
    {
        matches: /\b(claim|ownership|prove.*own|match engine|match score|verification question|80\s?%)\b/i,
        reply: 'Open an active found-item listing in the Catalog, review its details, and submit the ownership proof requested on the item page. If the reporter set a private verification question, the answer must reach at least 80% match to submit. After filing, view and continue the conversation from My Claims (/claims).'
    },
    {
        matches: /\b(catalog|search|browse|find|look for)\b|\b(item|belonging|report|listing).{0,35}\b(catalog|search|browse)\b/i,
        reply: 'Open the Catalog (/catalog) to browse item reports. Use the available search and filters to narrow listings, then open a listing to see its details. Sign in if you want to submit a claim or report an item.'
    },
    {
        matches: /\b(guardian|parent link|link.*student|student.*link)\b/i,
        reply: 'A parent or guardian can request a student link from Settings. The student must approve the request. Parents and guests can browse public listings; for claiming a recovered item, follow the Security Desk guide at /claims/guest-claim.'
    },
    {
        matches: /\b(security desk|security office|custody|hand.?over|guest|visitor|parent)\b/i,
        reply: 'For guest or Security Desk claims, open the Security Desk guide (/claims/guest-claim) and follow its current identity-verification instructions. Guests can browse public listings, but cannot report found items; found property should be surrendered to Campus Security.'
    },
    {
        matches: /\b(chat|message|messaging|contact.*finder|contact.*claimant|phone number)\b/i,
        reply: 'Open My Claims (/claims), then select a claim to view its conversation. Contact details are protected in claim messages; do not share passwords, verification answers, or other sensitive information.'
    },
    {
        matches: /\b(notification|notifications|email alert|alerts)\b/i,
        reply: 'Sign in and open Settings to manage your notification preferences. If you are not receiving account or MFA emails, check your registered email and contact the system administrator.'
    },
    {
        matches: /\b(theme|dark mode|light mode|appearance|display)\b/i,
        reply: 'Open Settings and choose the Light or Dark theme preference. Your theme choice is saved in this browser.'
    },
    {
        matches: /\b(profile|change.*(name|phone|details)|account details|delete.*account|change password)\b/i,
        reply: 'Open Settings to manage your profile and account security. You can update profile details or change your password there; some changes require your current password. Account deletion is also available in Settings.'
    },
    {
        matches: /\b(admin|administrator|security staff|custody intake|audit log|archive)\b/i,
        reply: 'Administrative pages are restricted to authorized administrator accounts. If you are authorized, sign in and use the relevant Admin navigation page. If you believe you need access, contact the system administrator.'
    },
    {
        matches: /\b(privacy|private|database|records|my report|report status|claim status|account status|my account|my profile)\b/i,
        reply: 'The HANAP assistant cannot access or change accounts, reports, claims, or private messages. Sign in and check My Reports (/my-reports) or My Claims (/claims) for your own activity. Never share your password or private verification answers in chat.'
    }
];

function getHanapFallbackReply(messages) {
    const latestMessage = messages[messages.length - 1];
    const question = latestMessage.text;
    const replies = HELP_TOPICS
        .filter(topic => topic.matches.test(question) && !(topic.excludes && topic.excludes.test(question)))
        .slice(0, 2)
        .map(topic => topic.reply);

    if (replies.length > 0) {
        return replies.join('\n\n');
    }

    return 'I can help with HANAP account access, browsing the Catalog, reporting lost or found items, ownership claims, claim messages, Settings, and Security Desk procedures. I cannot look up personal records or change account information. Tell me which page or step you need help with, or contact the system administrator for account-specific issues.';
}

module.exports = { getHanapFallbackReply };
