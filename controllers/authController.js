const bcrypt = require('bcrypt');
const crypto = require('crypto');
const userModel = require('../models/userModel');
const guardianLinkModel = require('../models/guardianLinkModel');
const { getConnection } = require('../models/connectionModel');
const {
    CSPC_INSTITUTIONAL_DOMAINS,
    isValidEmailSyntax,
    isInstitutionalEmail,
    validatePasswordStrength,
    isAdmin,
    isInstitutional,
    isGuest
} = require('../config/roles');
const { issueCode, verifyCode } = require('../services/mfa');


/**
 * Helper to render the login view with consistent alert state.
 */
function renderLogin(res, options = {}) {
    return res.status(options.status || 200).render('login', {
        category: options.category || 'institution',
        errorTitle: options.errorTitle || null,
        errorMessage: options.errorMessage || null,
        errorType: options.errorType || null,
        action: options.action || null,
        invalidFields: options.invalidFields || [],
        email: options.email || '',
        mfaPending: options.mfaPending || false,
        mfaEmail: options.mfaEmail || '',
        mfaCooldownSeconds: Math.max(0, Number(options.mfaCooldownSeconds) || 0),
        mfaAttemptsRemaining: Math.max(0, Math.min(5, Number(options.mfaAttemptsRemaining ?? 5))),
        msg: options.msg || null
    });
}

function maskEmail(email) {
    const [name, domain] = email.split('@');
    if (!domain) return email;
    return `${name.slice(0, 1)}${'*'.repeat(Math.max(name.length - 1, 2))}@${domain}`;
}

async function establishAuthenticatedSession(req, res, sessionUser) {
    await new Promise((resolve, reject) => {
        req.session.regenerate((error) => (error ? reject(error) : resolve()));
    });
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
    res.locals.csrfToken = req.session.csrfToken;
    req.session.user = sessionUser;
    await new Promise((resolve, reject) => {
        req.session.save((error) => (error ? reject(error) : resolve()));
    });

    return res.redirect(isAdmin(sessionUser) ? '/admin/dashboard' : '/dashboard');
}

/**
 * Helper to render the register view with consistent alert state.
 */
function renderRegister(res, options = {}) {
    return res.status(options.status || 200).render('register', {
        category: options.category || 'institution',
        errorTitle: options.errorTitle || null,
        errorMessage: options.errorMessage || null,
        errorType: options.errorType || null,
        action: options.action || null,
        invalidFields: options.invalidFields || [],
        values: options.values || {},
        success: options.success || null
    });
}

// GET /login

const showLogin = (req, res) => {
    // If already authenticated, redirect immediately based on authoritative database role
    const accessDenied = req.query.accessDenied === '1';
    if (req.session.user && !accessDenied) {
        if (isAdmin(req.session.user)) {
            return res.redirect('/admin/dashboard');
        }
        return res.redirect('/dashboard');
    }

    const category = req.session.pendingMfaCategory ||
        (req.query.category === 'guest' ? 'guest' : 'institution');
    const email = typeof req.query.registered_email === 'string' ? req.query.registered_email : (req.query.email || '');
    const msg = typeof req.query.msg === 'string' ? req.query.msg : null;

    return renderLogin(res, {
        category,
        email,
        mfaPending: Boolean(req.session.pendingMfaUser),
        mfaEmail: req.session.pendingMfaUser ? maskEmail(req.session.pendingMfaUser.email) : '',
        mfaCooldownSeconds: req.session.mfaCooldownUntil
            ? Math.max(0, Math.ceil((req.session.mfaCooldownUntil - Date.now()) / 1000))
            : 0,
        mfaAttemptsRemaining: req.session.mfaAttemptsRemaining,
        msg: accessDenied ? null : msg,
        errorTitle: accessDenied ? 'Access denied' : null,
        errorMessage: accessDenied ? (msg || 'Your account is not authorized to access that page.') : null,
        status: 200
    });
};

const login = async (req, res) => {
    if (req.session.pendingMfaUser) {
        const pendingUser = req.session.pendingMfaUser;
        const category = req.session.pendingMfaCategory || 'institution';

        try {
            if (req.body.resend_code === '1') {
                const result = await issueCode(pendingUser.id, pendingUser.email);
                req.session.mfaCooldownUntil = Date.now() + result.retryAfterSeconds * 1000;
                req.session.mfaAttemptsRemaining = result.attemptsRemaining;
                return renderLogin(res, {
                    category,
                    mfaPending: true,
                    mfaEmail: maskEmail(pendingUser.email),
                    mfaCooldownSeconds: result.retryAfterSeconds,
                    mfaAttemptsRemaining: result.attemptsRemaining,
                    msg: result.sent
                        ? 'A new verification code was sent to your email.'
                        : (result.codeAvailable
                            ? `A recent code is still valid. Try again in ${result.retryAfterSeconds} seconds before requesting another.`
                            : `Please wait ${result.retryAfterSeconds} seconds, then request a new code.`)
                });
            }

            const code = typeof req.body.mfa_code === 'string' ? req.body.mfa_code.trim() : '';
            const verification = await verifyCode(pendingUser.id, code);
            req.session.mfaAttemptsRemaining = verification.attemptsRemaining;
            if (verification.status === 'verified') {
                delete req.session.pendingMfaUser;
                delete req.session.pendingMfaCategory;
                delete req.session.mfaCooldownUntil;
                delete req.session.mfaAttemptsRemaining;
                return await establishAuthenticatedSession(req, res, pendingUser);
            }

            if (verification.status === 'expired') req.session.mfaCooldownUntil = Date.now();
            if (verification.status === 'locked') {
                req.session.mfaCooldownUntil = Date.now();
                req.session.mfaAttemptsRemaining = 0;
            }

            const errorMessage = verification.status === 'expired'
                ? 'Your code expired. Request a new code to continue.'
                : verification.status === 'locked'
                    ? 'You have used all five attempts. Request a new code to continue.'
                    : verification.status === 'not_pending'
                        ? 'There is no active code. Request a new code to continue.'
                        : 'Enter the six-digit code from your email.';

            return renderLogin(res, {
                category,
                mfaPending: true,
                mfaEmail: maskEmail(pendingUser.email),
                mfaCooldownSeconds: req.session.mfaCooldownUntil
                    ? Math.max(0, Math.ceil((req.session.mfaCooldownUntil - Date.now()) / 1000))
                    : 0,
                mfaAttemptsRemaining: req.session.mfaAttemptsRemaining,
                errorTitle: verification.status === 'invalid' ? 'Invalid verification code' : 'Verification required',
                errorMessage
            });
        } catch (error) {
            console.error('MFA login verification error:', error);
            if (error.code === 'SMTP_CONFIGURATION_MISSING') {
                return renderLogin(res, {
                    category,
                    mfaPending: true,
                    mfaEmail: maskEmail(pendingUser.email),
                    mfaCooldownSeconds: req.session.mfaCooldownUntil
                        ? Math.max(0, Math.ceil((req.session.mfaCooldownUntil - Date.now()) / 1000))
                        : 0,
                    mfaAttemptsRemaining: req.session.mfaAttemptsRemaining,
                    errorTitle: 'Email service not configured',
                    errorMessage: 'The sign-in code cannot be sent yet. Configure SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD in .env, then restart HANAP.'
                });
            }
            return renderLogin(res, {
                category,
                mfaPending: true,
                mfaEmail: maskEmail(pendingUser.email),
                mfaCooldownSeconds: req.session.mfaCooldownUntil
                    ? Math.max(0, Math.ceil((req.session.mfaCooldownUntil - Date.now()) / 1000))
                    : 0,
                mfaAttemptsRemaining: req.session.mfaAttemptsRemaining,
                errorTitle: 'Verification error',
                errorMessage: 'Unable to verify your code right now. Please try again.'
            });
        }
    }

    const rawCategory = typeof req.body.category === 'string' ? req.body.category.trim().toLowerCase() : 'institution';
    const category = rawCategory === 'guest' ? 'guest' : 'institution';
    const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
    const cleanEmail = email.toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    const invalidFields = [];
    const missingErrors = [];

    // 1. Strict required fields validation
    if (!email) {
        invalidFields.push('email');
        missingErrors.push('Please enter your email address.');
    }
    if (!password) {
        invalidFields.push('password');
        missingErrors.push('Please enter your password.');
    }

    if (missingErrors.length > 0) {
        return renderLogin(res, {
            category,
            email,
            invalidFields,
            errorTitle: 'Complete the required information',
            errorMessage: missingErrors.join('\n'),
            errorType: 'missing_fields',
            status: 400
        });
    }

    // 2. Strict email format validation
    if (!isValidEmailSyntax(cleanEmail)) {
        return renderLogin(res, {
            category,
            email,
            invalidFields: ['email'],
            errorTitle: 'Invalid email format',
            errorMessage: 'Please enter a valid email address.',
            errorType: 'invalid_format',
            status: 400
        });
    }

    // 3. Category-specific domain validation
    if (category === 'institution') {
        if (!isInstitutionalEmail(cleanEmail)) {
            return renderLogin(res, {
                category: 'institution',
                email,
                invalidFields: ['email'],
                errorTitle: 'Institutional account required',
                errorMessage: 'The email you entered is not a recognized CSPC institutional email.\nIf you are a parent, guardian, or external guest, please select "Guest" to continue.',
                errorType: 'institutional_domain_required',
                action: 'switch_to_guest',
                status: 400
            });
        }
    }

    try {
        // 4. Query user from database
        const [rows] = await userModel.login([cleanEmail], []);

        // Account does not exist
        if (rows.length === 0) {
            if (category === 'institution') {
                return renderLogin(res, {
                    category: 'institution',
                    email,
                    invalidFields: ['email'],
                    errorTitle: 'Account not found',
                    errorMessage: 'This CSPC institutional email is valid, but no registered HANAP account was found.\nPlease register first or contact the appropriate administrator.',
                    errorType: 'account_not_found',
                    action: 'register',
                    status: 404
                });
            } else {
                return renderLogin(res, {
                    category: 'guest',
                    email,
                    invalidFields: ['email', 'password'],
                    errorTitle: 'Unable to sign in',
                    errorMessage: 'The email or password is incorrect.\nPlease check your credentials and try again.',
                    errorType: 'invalid_credentials',
                    status: 401
                });
            }
        }

        const userRecord = rows[0];

        // 5. Verify password hash using bcrypt
        const passwordMatches = await bcrypt.compare(password, userRecord.password_hash);
        if (!passwordMatches) {
            return renderLogin(res, {
                category,
                email,
                invalidFields: ['password'],
                errorTitle: 'Unable to sign in',
                errorMessage: 'The email or password is incorrect.\nPlease check your credentials and try again.',
                errorType: 'invalid_credentials',
                status: 401
            });
        }

        // 6. Cross-category validation against database role
        // Case A: User selected Guest, but account has an institutional role or is an admin.
        if (category === 'guest' && (isInstitutional(userRecord) || isAdmin(userRecord))) {
            return renderLogin(res, {
                category: 'guest',
                email,
                invalidFields: ['email'],
                errorTitle: 'Institution account detected',
                errorMessage: 'This account belongs to the CSPC institutional community.\nPlease select "Institution" to sign in.',
                errorType: 'institution_account_detected',
                action: 'switch_to_institution',
                status: 403
            });
        }

        // Case B: User selected Institution, but account has a Guest or Parent role.
        if (category === 'institution' && isGuest(userRecord)) {
            return renderLogin(res, {
                category: 'institution',
                email,
                invalidFields: ['email'],
                errorTitle: 'Institutional account required',
                errorMessage: 'Your email is not a recognized CSPC institutional email. If you are a parent, guardian, or guest, please select Guest.',
                errorType: 'guest_account_detected',
                action: 'switch_to_guest',
                status: 403
            });
        }

        const sessionUser = {
            id: userRecord.id,
            email: userRecord.email,
            full_name: userRecord.full_name,
            role: userRecord.role
        };

        const [mfaRows] = await userModel.loginQuery2([sessionUser.id], []);

        if (mfaRows.length > 0 && Boolean(mfaRows[0].mfa_enabled)) {
            const result = await issueCode(sessionUser.id, sessionUser.email);
            await new Promise((resolve, reject) => {
                req.session.regenerate((error) => (error ? reject(error) : resolve()));
            });
            req.session.csrfToken = crypto.randomBytes(24).toString('hex');
            res.locals.csrfToken = req.session.csrfToken;
            req.session.pendingMfaUser = sessionUser;
            req.session.pendingMfaCategory = category;
            req.session.mfaCooldownUntil = Date.now() + result.retryAfterSeconds * 1000;
            req.session.mfaAttemptsRemaining = result.attemptsRemaining;
            await new Promise((resolve, reject) => {
                req.session.save((error) => (error ? reject(error) : resolve()));
            });

            return renderLogin(res, {
                category,
                mfaPending: true,
                mfaEmail: maskEmail(sessionUser.email),
                mfaCooldownSeconds: result.retryAfterSeconds,
                mfaAttemptsRemaining: result.attemptsRemaining,
                msg: result.sent
                    ? 'A six-digit verification code was sent to your email.'
                    : result.codeAvailable
                        ? 'A recent verification code is still valid. Check your email.'
                        : `Please wait ${result.retryAfterSeconds} seconds before requesting a new code.`
            });
        }

        return await establishAuthenticatedSession(req, res, sessionUser);
    } catch (error) {
        console.error('Login system error:', error);
        if (error.code === 'SMTP_CONFIGURATION_MISSING') {
            return renderLogin(res, {
                category,
                email,
                errorTitle: 'Email service not configured',
                errorMessage: 'The sign-in code cannot be sent yet. Configure SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD in .env, then restart HANAP.'
            });
        }
        return renderLogin(res, {
            category,
            email,
            errorTitle: 'System error',
            errorMessage: 'Unable to process your sign in at this time. Please try again later.',
            status: 500
        });
    }
};

const showRegistration = (req, res) => {
    if (req.session.user) {
        if (isAdmin(req.session.user)) {
            return res.redirect('/admin/dashboard');
        }
        return res.redirect('/dashboard');
    }

    const category = req.query.category === 'guest' ? 'guest' : 'institution';
    return renderRegister(res, { category });
};

const register = async (req, res) => {
    const rawCategory = typeof req.body.category === 'string' ? req.body.category.trim().toLowerCase() : 'institution';
    const category = rawCategory === 'guest' ? 'guest' : 'institution';
    const rawFullName = typeof req.body.full_name === 'string' ? req.body.full_name.trim() : '';
    const rawEmail = typeof req.body.email === 'string' ? req.body.email.trim() : '';
    const cleanEmail = rawEmail.toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const confirmPassword = typeof req.body.confirm_password === 'string' ? req.body.confirm_password : '';
    const studentEmailInput = typeof req.body.student_email === 'string' ? req.body.student_email.trim() : '';
    const studentEmail = studentEmailInput.toLowerCase();
    const institutionalRole = typeof req.body.institutional_role === 'string'
        ? req.body.institutional_role.trim().toLowerCase()
        : '';

    const values = {
        full_name: rawFullName,
        email: rawEmail,
        student_email: studentEmailInput,
        institutional_role: institutionalRole
    };

    const invalidFields = [];
    const missingErrors = [];

    // 1. Required fields check
    if (!rawFullName) {
        invalidFields.push('full_name');
        missingErrors.push('Please enter your full name.');
    }
    if (!cleanEmail) {
        invalidFields.push('email');
        missingErrors.push('Please enter your email.');
    }
    if (!password) {
        invalidFields.push('password');
        missingErrors.push('Please create a strong password.');
    }
    if (!confirmPassword) {
        invalidFields.push('confirm_password');
        missingErrors.push('Please confirm your password.');
    }
    if (category === 'institution' && !['student', 'staff'].includes(institutionalRole)) {
        invalidFields.push('institutional_role');
        missingErrors.push('Please select whether you are a Student or Staff member.');
    }

    if (missingErrors.length > 0) {
        return renderRegister(res, {
            category,
            values,
            invalidFields,
            errorTitle: 'Complete the required information',
            errorMessage: missingErrors.map((e) => `ΓÇó ${e}`).join('\n'),
            errorType: 'missing_fields',
            status: 400
        });
    }

    // 2. Full Name length validation
    if (rawFullName.length > 150) {
        return renderRegister(res, {
            category,
            values,
            invalidFields: ['full_name'],
            errorTitle: 'Name too long',
            errorMessage: 'Full name must not exceed 150 characters.',
            status: 400
        });
    }

    // 3. Email syntax validation
    if (!isValidEmailSyntax(cleanEmail)) {
        return renderRegister(res, {
            category,
            values,
            invalidFields: ['email'],
            errorTitle: 'Invalid email format',
            errorMessage: 'Please enter a valid email address.',
            status: 400
        });
    }

    if (category === 'guest' && studentEmail && !isInstitutionalEmail(studentEmail)) {
        return renderRegister(res, {
            category,
            values,
            invalidFields: ['student_email'],
            errorTitle: 'Invalid student email',
            errorMessage: 'Enter a valid CSPC institutional Student email, or leave this field blank to register as a Guest.',
            status: 400
        });
    }

    // 4. Institutional domain validation if category is Institution
    if (category === 'institution') {
        if (!isInstitutionalEmail(cleanEmail)) {
            return renderRegister(res, {
                category: 'institution',
                values,
                invalidFields: ['email'],
                errorTitle: 'Institutional email required',
                errorMessage: 'Institution registration requires an official @my.cspc.edu.ph or @cspc.edu.ph email address.\nIf you are a parent or guest, please switch to the Guest registration tab.',
                errorType: 'institutional_domain_required',
                action: 'switch_to_guest',
                status: 400
            });
        }
    }

    // 5. Password strength validation (all 3 segments required)
    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
        return renderRegister(res, {
            category,
            values,
            invalidFields: ['password'],
            errorTitle: 'Password does not meet requirements',
            errorMessage: 'Please create a strong password containing:\nΓÇó Minimum 8 characters\nΓÇó At least one uppercase letter\nΓÇó At least one lowercase letter\nΓÇó At least one number\nΓÇó At least one special character',
            errorType: 'weak_password',
            status: 400
        });
    }

    // 6. Password match validation
    if (password !== confirmPassword) {
        return renderRegister(res, {
            category,
            values,
            invalidFields: ['confirm_password'],
            errorTitle: 'Passwords do not match',
            errorMessage: 'Please enter the same password in both fields.',
            errorType: 'mismatched_password',
            status: 400
        });
    }

    // 7. Duplicate email verification
    try {
        const [existing] = await userModel.register([cleanEmail], []);
        if (existing.length > 0) {
            return renderRegister(res, {
                category,
                values,
                invalidFields: ['email'],
                errorTitle: 'Account already exists',
                errorMessage: 'An account with this email already exists. Please sign in instead.',
                errorType: 'duplicate_email',
                action: 'sign_in',
                status: 409
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const connection = await getConnection();
        let parentRequestCreated = false;
        let studentMatchFound = false;
        try {
            await connection.beginTransaction();

            const roleCode = category === 'institution' ? institutionalRole : 'guest';
            const [roleRows] = await userModel.registerQuery2([roleCode], [], connection);
            if (roleRows.length !== 1) {
                throw new Error(`Account role is missing from account_roles: ${roleCode}`);
            }

            let studentId = null;
            if (category === 'guest' && studentEmail) {
                const [studentRows] = await userModel.registerQuery3([studentEmail], [], connection);
                studentMatchFound = studentRows.length > 0;
                if (studentMatchFound) studentId = studentRows[0].id;
            }

            const [insertResult] = await userModel.registerQuery4([rawFullName, cleanEmail, passwordHash, roleRows[0].id], [], connection);

            if (studentId !== null) {
                await guardianLinkModel.register([insertResult.insertId, studentId], [], connection);
                parentRequestCreated = true;
            }

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        // 9. Redirect to login with explicit success parameters
        const successMsg = parentRequestCreated
            ? 'Your Guest account has been created. The linked Student must approve your Parent / Guardian request in Account Settings.'
            : category === 'guest' && studentEmail && !studentMatchFound
                ? 'No Student account matched that email. Your account was created as a Guest.'
                : 'Your HANAP account has been created. You can now sign in using your registered credentials.';
        return res.redirect(`/login?msg=${encodeURIComponent(successMsg)}&registered_email=${encodeURIComponent(cleanEmail)}&category=${category}`);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return renderRegister(res, {
                category,
                values,
                invalidFields: ['email'],
                errorTitle: 'Account already exists',
                errorMessage: 'An account with this email already exists. Please sign in instead.',
                errorType: 'duplicate_email',
                action: 'sign_in',
                status: 409
            });
        }
        console.error('Registration database error:', error);
        return renderRegister(res, {
            category,
            values,
            errorTitle: 'Registration error',
            errorMessage: 'Unable to complete registration at this time. Please try again.',
            status: 500
        });
    }
};

const logout = (req, res, next) => {
    req.session.destroy((error) => {
        if (error) return next(error);
        res.clearCookie('connect.sid');
        return res.redirect('/login');
    });
};

module.exports = {
    showLogin,
    login,
    showRegistration,
    register,
    logout
};
