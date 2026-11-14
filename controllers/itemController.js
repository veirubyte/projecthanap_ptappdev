const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcrypt');
const auditLogModel = require('../models/auditLogModel');
const itemReportModel = require('../models/itemReportModel');
const claimModel = require('../models/claimModel');
const userModel = require('../models/userModel');
const mfaModel = require('../models/mfaModel');
const { getConnection } = require('../models/connectionModel');
const DatabaseSessionStore = require('../config/sessionStore');
const { isAdmin, isGuest, isInstitutionalEmail, validatePasswordStrength, isValidEmailSyntax } = require('../config/roles');
const { ANSWER_MATCH_THRESHOLD, calculateAnswerMatch, parseChallenges, calculateMultiAnswerMatch } = require('../services/answerMatch');
const { issueCode, verifyCode } = require('../services/mfa');
const { sendMfaEnabledNotice, verifyEmailTransport } = require('../services/email');
const { flagStaleItems } = require('../services/lifecycle');
const { invalidateUnreadCache, invalidateAllUnreadCache } = require('../middleware/viewLocals');

async function saveSession(req) {
    if (!req.session || typeof req.session.save !== 'function') return;
    await new Promise((resolve) => {
        req.session.save(() => resolve());
    });
}

const STALE_SWEEP_INTERVAL_MS = 15 * 60 * 1000;
let lastStaleSweepAt = 0;
let staleSweepInFlight = null;

async function ensureStaleItemsSwept() {
    const now = Date.now();
    if (now - lastStaleSweepAt < STALE_SWEEP_INTERVAL_MS) return;
    if (staleSweepInFlight) return staleSweepInFlight;

    lastStaleSweepAt = now;
    staleSweepInFlight = flagStaleItems()
        .catch((err) => {
            lastStaleSweepAt = 0;
            console.error('[Lifecycle Sweep] Error flagging stale items:', err.message);
        })
        .finally(() => {
            staleSweepInFlight = null;
        });

    return staleSweepInFlight;
}

function tokenizeMatchText(value) {
    if (typeof value !== 'string') return [];
    return value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length >= 3);
}

function computeMatchScore(sourceReport, candidate) {
    if (!sourceReport || !candidate || sourceReport.report_type === candidate.report_type) return 0;

    let score = 0;
    if (sourceReport.category && candidate.category && sourceReport.category === candidate.category) {
        score += 50;
    }

    const srcLocation = new Set(tokenizeMatchText(sourceReport.location_found_lost));
    const candLocation = tokenizeMatchText(candidate.location_found_lost);
    if (srcLocation.size > 0 && candLocation.length > 0) {
        const locOverlap = candLocation.filter((tok) => srcLocation.has(tok)).length;
        if (locOverlap > 0) {
            score += Math.min(25, Math.round((locOverlap / Math.max(srcLocation.size, 1)) * 25));
        }
    }

    const srcWords = new Set([
        ...tokenizeMatchText(sourceReport.item_name),
        ...tokenizeMatchText(sourceReport.description)
    ]);
    const candWords = new Set([
        ...tokenizeMatchText(candidate.item_name),
        ...tokenizeMatchText(candidate.description)
    ]);
    if (srcWords.size > 0 && candWords.size > 0) {
        let wordOverlap = 0;
        for (const word of candWords) {
            if (srcWords.has(word)) wordOverlap += 1;
        }
        if (wordOverlap > 0) {
            score += Math.min(24, Math.round((wordOverlap / Math.min(srcWords.size, candWords.size)) * 24));
        }
    }

    return Math.min(99, score);
}

function computeSmartMatches(myActiveReports, candidates) {
    if (!Array.isArray(myActiveReports) || myActiveReports.length === 0 || !Array.isArray(candidates) || candidates.length === 0) {
        return [];
    }

    const scored = [];
    for (const candidate of candidates) {
        let bestScore = 0;
        let matchedReport = null;
        for (const myReport of myActiveReports) {
            const score = computeMatchScore(myReport, candidate);
            if (score > bestScore) {
                bestScore = score;
                matchedReport = myReport;
            }
        }
        if (bestScore >= 50 && matchedReport) {
            scored.push({
                ...candidate,
                match_score: bestScore,
                matched_with_id: matchedReport.id,
                matched_with_name: matchedReport.item_name
            });
        }
    }

    scored.sort((a, b) => {
        if (b.match_score !== a.match_score) return b.match_score - a.match_score;
        return new Date(b.date_reported).getTime() - new Date(a.date_reported).getTime();
    });

    return scored.slice(0, 5);
}

function maskContactPhoneNumbers(text) {
    if (typeof text !== 'string') return '';
    return text.replace(
        /(?:\+?63[\s.-]?9\d{2}[\s.-]?\d{3}[\s.-]?\d{4}|09\d{2}[\s.-]?\d{3}[\s.-]?\d{4}|\(\d{2,4}\)\s?\d{3,4}[-.\s]?\d{4}|\b\d{3,4}[-.\s]\d{3,4}[-.\s]\d{4}\b|\b0\d{9,10}\b)/g,
        '[contact hidden until claim approved]'
    );
}

async function closeCompetingClaimsForItem(itemId, winningClaimId, actorId, resolutionLabel) {
    const [competing] = await claimModel.listCompetingActiveClaims([itemId, winningClaimId], []);
    if (!competing || competing.length === 0) return;

    await claimModel.closeCompetingClaims([itemId, winningClaimId], []);
    await Promise.all(competing.map((row) => (
        claimModel.updateClaimStatusQuery6(
            [row.id, actorId, `[SYSTEM] This claim was automatically closed because another claim for this item was ${resolutionLabel}.`],
            []
        )
    )));
}


function extractVerificationPairs(body) {
    let rawChallenges = body.secret_challenges !== undefined ? body.secret_challenges : body.secret_challenge;
    let rawAnswers = body.secret_answers !== undefined ? body.secret_answers : body.secret_answer;

    if (!Array.isArray(rawChallenges)) {
        rawChallenges = rawChallenges !== undefined && rawChallenges !== null ? [rawChallenges] : [];
    }
    if (!Array.isArray(rawAnswers)) {
        rawAnswers = rawAnswers !== undefined && rawAnswers !== null ? [rawAnswers] : [];
    }

    const pairs = [];
    const maxCount = Math.max(rawChallenges.length, rawAnswers.length);
    for (let i = 0; i < maxCount; i++) {
        const q = typeof rawChallenges[i] === 'string' ? rawChallenges[i].trim() : '';
        const a = typeof rawAnswers[i] === 'string' ? rawAnswers[i].trim() : '';
        if (q || a) {
            pairs.push({ question: q, answer: a });
        }
    }
    return pairs;
}

// Helper: Relative time ago
function timeAgo(d) {
    if (!d) return '';
    const s = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
    return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function removeUploadedFiles(files) {
    const uploadedFiles = (Array.isArray(files) ? files : [files]).filter(Boolean);
    await Promise.all(uploadedFiles.map((file) => fs.unlink(file.path).catch((err) => {
        if (err.code !== 'ENOENT') console.error('Failed to remove invalid report upload:', err);
    })));
}

async function removeReportImageFiles(imagePaths) {
    const uploadDirectory = path.join(__dirname, '..', 'public', 'uploads');
    await Promise.all(imagePaths.map((imagePath) => {
        if (typeof imagePath !== 'string' || !imagePath.startsWith('/uploads/')) return Promise.resolve();
        const filename = path.basename(imagePath);
        if (!filename || filename !== imagePath.slice('/uploads/'.length)) return Promise.resolve();
        return fs.unlink(path.join(uploadDirectory, filename)).catch((err) => {
            if (err.code !== 'ENOENT') console.error('Failed to remove report image:', err);
        });
    }));
}

// Helper: Audit Logger
async function logAudit(adminId, actionDescription, ip) {
    try {
        await auditLogModel.logAudit([adminId, actionDescription, ip || null], []);
    } catch (e) {
        console.error('Audit log error:', e);
    }
}

// Standard Categories
const CATEGORIES = [
    'Electronics',
    'Keys & Lanyards',
    'IDs & Cards',
    'Bags & Wallets',
    'Tumblers & Bottles',
    'Books & Documents',
    'Clothing & Accessories',
    'Other'
];

/* ==========================================================================
   PUBLIC & USER FEED / CATALOG
   ========================================================================== */

const showDashboard = async (req, res) => {
    const isCatalog = req.path === '/catalog';
    const user = req.session.user || null;

    if (!isCatalog && !user) {
        return res.redirect('/login');
    }

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const typeFilter = ['lost', 'found'].includes(req.query.type) ? req.query.type : '';
    const catFilter = CATEGORIES.includes(req.query.category) ? req.query.category : '';
    const periodFilter = isCatalog && ['today', 'week', 'month'].includes(req.query.period)
        ? req.query.period
        : '';
    const statusFilter = ['active', 'claimed', 'archived', 'pending_review'].includes(req.query.status)
        ? req.query.status
        : (isCatalog ? 'active' : 'active');

    try {
        const statsPromise = itemReportModel.showDashboard(undefined, []);
        const itemsPromise = itemReportModel.findCatalogReports({
            statusFilter,
            isCatalog,
            typeFilter,
            catFilter,
            periodFilter,
            q
        });

        const catalogPromise = isCatalog
            ? Promise.all([
                itemReportModel.showDashboardQuery2(undefined, []),
                claimModel.showDashboard(undefined, []),
                itemReportModel.showDashboardQuery3(undefined, [])
            ])
            : Promise.resolve(null);

        const userPromise = user
            ? Promise.all([
                itemReportModel.showDashboardQuery4([user.id], []),
                itemReportModel.showDashboardQuery5([user.id], []),
                claimModel.showDashboardQuery2([user.id, user.id], [])
            ])
            : Promise.resolve(null);

        const [statsResult, itemsResult, catalogResult, userResult] = await Promise.all([
            statsPromise,
            itemsPromise,
            catalogPromise,
            userPromise
        ]);

        const [statsRows] = statsResult;
        const stats = {
            active_lost: statsRows?.[0]?.active_lost || 0,
            active_found: statsRows?.[0]?.active_found || 0,
            total_claimed: statsRows?.[0]?.total_claimed || 0,
            total_reports: statsRows?.[0]?.total_reports || 0
        };

        const [items] = itemsResult;
        let recognizedFinders = [];
        let successfulHandovers = [];
        const categoryCounts = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));

        if (catalogResult) {
            const [finderResult, handoverResult, categoryCountResult] = catalogResult;
            recognizedFinders = finderResult[0] || [];
            successfulHandovers = handoverResult[0] || [];
            const categoryCountRows = (categoryCountResult && categoryCountResult[0]) || [];
            categoryCountRows.forEach((row) => {
                if (Object.prototype.hasOwnProperty.call(categoryCounts, row.category)) {
                    categoryCounts[row.category] = Number(row.item_count);
                }
            });
        }

        // Smart Matches (if user is logged in)
        let smartMatches = [];
        let myReports = [];
        let recentClaim = null;

        if (userResult) {
            const [[myActiveReports], [userReportsList], [latestClaims]] = userResult;
            myReports = userReportsList;
            if (latestClaims.length > 0) {
                recentClaim = latestClaims[0];
            }

            if (myActiveReports.length > 0) {
                const [candidates] = await itemReportModel.findMatchCandidates([user.id], []);
                smartMatches = computeSmartMatches(myActiveReports, candidates);
            }
        }

        res.render('dashboard', {
            isCatalog,
            user,
            stats,
            items,
            categories: CATEGORIES,
            filters: { q, type: typeFilter, category: catFilter, period: periodFilter, status: statusFilter },
            recognizedFinders,
            successfulHandovers,
            categoryCounts,
            smartMatches,
            myReports,
            recentClaim,
            timeAgo,
            msg: req.query.msg || null,
            error: req.query.error || null
        });
    } catch (err) {
        console.error('Error fetching dashboard:', err);
        res.status(500).send('Unable to load dashboard. Please try again.');
    }
};

const showNewReportForm = (req, res) => {
    let initialType = req.query.type === 'found' ? 'found' : 'lost';
    
    // Guests are not allowed to report found items
    if (isGuest(req.session.user) && initialType === 'found') {
        return res.redirect(`/items/new?type=lost&error=${encodeURIComponent('Guests are not authorized to report found items. Please surrender found belongings directly to Campus Security.')}`);
    }

    res.render('reportItem', {
        user: req.session.user,
        initialType,
        categories: CATEGORIES,
        csrfToken: res.locals.csrfToken || '',
        error: req.query.error || null
    });
};
const createItemReport = async (req, res) => {
    const reportType = (req.body && ['lost', 'found'].includes(req.body.report_type))
        ? req.body.report_type
        : (req.query && ['lost', 'found'].includes(req.query.type) ? req.query.type : null);
    const reportFormUrl = `/items/new?type=${reportType || 'lost'}`;
    const uploadedFiles = req.files || [];

    // Strict guest security guard: guests cannot report found items
    if (reportType === 'found' && isGuest(req.session.user)) {
        await removeUploadedFiles(uploadedFiles);
        return res.redirect(`${reportFormUrl}&error=${encodeURIComponent('Guests are not authorized to report found items. Please surrender found belongings directly to Campus Security.')}`);
    }
    if (!reportType) {
        await removeUploadedFiles(uploadedFiles);
        return res.redirect(`/items/new?type=lost&error=${encodeURIComponent('Choose whether you lost or found the item, then try again.')}`);
    }

    const itemName = typeof req.body.item_name === 'string' ? req.body.item_name.trim() : '';
    const category = typeof req.body.category === 'string' ? req.body.category.trim() : 'Other';
    const location = typeof req.body.location_found_lost === 'string' ? req.body.location_found_lost.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    const custodyMode = req.body.custody_mode === 'security_desk' ? 'security_desk' : 'peer_meetup';

    if (!itemName || !location || !description) {
        await removeUploadedFiles(uploadedFiles);
        return res.redirect(`${reportFormUrl}&error=${encodeURIComponent('Please fill in all required fields.')}`);
    }

    const verificationPairs = extractVerificationPairs(req.body);
    const hasIncompletePair = verificationPairs.some((p) => !p.question || !p.answer);
    if (hasIncompletePair) {
        await removeUploadedFiles(uploadedFiles);
        return res.redirect(`${reportFormUrl}&error=${encodeURIComponent('Enter both the ownership question and its private correct answer, or leave both blank.')}`);
    }
    if (verificationPairs.length > 5) {
        await removeUploadedFiles(uploadedFiles);
        return res.redirect(`${reportFormUrl}&error=${encodeURIComponent('You can add up to 5 verification questions.')}`);
    }
    const exceedsLength = verificationPairs.some((p) => p.question.length > 500 || p.answer.length > 500);
    if (exceedsLength) {
        await removeUploadedFiles(uploadedFiles);
        return res.redirect(`${reportFormUrl}&error=${encodeURIComponent('The ownership question and answer must each be 500 characters or fewer.')}`);
    }

    let secretChallenge = null;
    let secretAnswer = null;
    if (verificationPairs.length === 1) {
        secretChallenge = verificationPairs[0].question;
        secretAnswer = verificationPairs[0].answer;
    } else if (verificationPairs.length > 1) {
        secretChallenge = JSON.stringify(verificationPairs.map((p) => p.question));
        secretAnswer = JSON.stringify(verificationPairs.map((p) => p.answer));
    }

    const imagePaths = uploadedFiles.map((file) => ({
        path: `/uploads/${file.filename}`,
        fileData: file.base64Data || null
    }));

    try {
        await itemReportModel.createItemReport([req.session.user.id, reportType, itemName, category, description, location, secretChallenge, secretAnswer, custodyMode], imagePaths);

        return res.redirect(`/dashboard?msg=${encodeURIComponent(`Successfully reported ${reportType} item: "${itemName}"`)}`);
    } catch (err) {
        console.error('Failed to report item:', err);
        await removeUploadedFiles(uploadedFiles);
        return res.redirect(`${reportFormUrl}&error=${encodeURIComponent('Failed to save report. Please try again.')}`);
    }
};

const showGuestClaimGuide = async (req, res) => {
    const rawCase = typeof req.query.case === 'string' ? req.query.case.trim() : '';
    const caseIdInt = parseInt(rawCase, 10);
    let caseItem = null;

    if (Number.isSafeInteger(caseIdInt) && caseIdInt > 0) {
        try {
            const [rows] = await itemReportModel.showItemDetails([caseIdInt], []);
            if (rows.length > 0) {
                const row = rows[0];
                caseItem = {
                    id: row.id,
                    item_name: row.item_name,
                    report_type: row.report_type,
                    category: row.category,
                    location_found_lost: row.location_found_lost,
                    status: row.status,
                    custody_mode: row.custody_mode,
                    date_reported: row.date_reported,
                    primary_image_path: row.primary_image_path
                };
            }
        } catch (err) {
            console.error('Error loading guest claim case summary:', err);
        }
    }

    res.render('guestClaim', {
        caseId: rawCase,
        caseItem,
        user: req.session.user || null
    });
};

const showItemDetails = async (req, res) => {
    const itemId = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(itemId) || itemId < 1) return res.redirect('/dashboard');

    const user = req.session.user || null;

    try {
        const [rows] = await itemReportModel.showItemDetails([itemId], []);

        if (rows.length === 0) {
            return res.redirect('/dashboard?error=Item report not found.');
        }

        const item = rows[0];
        const [storedImagesRes, claimsRes, similarRes] = await Promise.all([
            itemReportModel.showItemReportImages([itemId], []),
            user ? claimModel.showItemDetails([itemId, user.id], []) : Promise.resolve([[]]),
            itemReportModel.showItemDetailsQuery2([item.category, item.id], [])
        ]);

        const [storedImages] = storedImagesRes;
        const [claims] = claimsRes;
        const [similar] = similarRes;

        const itemImages = storedImages.length
            ? storedImages
            : (item.primary_image_path ? [{ image_path: item.primary_image_path, is_primary: 1, sort_order: 0 }] : []);
        const storedMatchResult = req.session.answerMatchResult;
        let answerMatchScore = storedMatchResult && storedMatchResult.itemId === itemId
            ? storedMatchResult.score
            : null;
        delete req.session.answerMatchResult;

        const challenges = parseChallenges(item.secret_challenge);
        const expectedAnswers = parseChallenges(item.secret_answer);
        const hasConfiguredChallenge = challenges.length > 0 && expectedAnswers.length > 0;

        // Check if current user already has a pending claim on this item
        let existingClaim = null;
        if (user && claims.length > 0) {
            existingClaim = claims[0];
            if (answerMatchScore === null && existingClaim.proof_details && expectedAnswers.length > 0) {
                const matchResult = calculateMultiAnswerMatch(existingClaim.proof_details, expectedAnswers);
                answerMatchScore = matchResult.score;
            }
        }

        res.render('postDetail', {
            item,
            itemImages,
            user,
            existingClaim,
            challenges,
            hasConfiguredChallenge,
            answerMatchScore,
            answerMatchThreshold: ANSWER_MATCH_THRESHOLD,
            similar,
            timeAgo,
            msg: req.query.msg || null,
            error: req.query.error || null
        });
    } catch (err) {
        console.error('Error fetching item details:', err);
        res.redirect('/dashboard?error=Error fetching item.');
    }
};

/**
 * POST /items/:id/match-preview
 * Live Match Preview Endpoint
 * 
 * Invokes calculateMultiAnswerMatch() in real time as the claimant types their ownership proof.
 * Returns the confidence score (0-100%) and threshold status to drive the dynamic SVG
 * radial progression circle on the item detail view (views/pages/postDetail.ejs).
 */
const previewOwnershipMatch = async (req, res) => {
    const itemId = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(itemId) || itemId < 1) {
        return res.status(400).json({ error: 'Invalid item ID.' });
    }
    const rawAnswers = req.body.answers;
    const rawAnswer = req.body.answer;
    let userAnswers = [];
    if (Array.isArray(rawAnswers)) {
        userAnswers = rawAnswers.map((a) => (typeof a === 'string' ? a.trim() : ''));
    } else if (typeof rawAnswer === 'string') {
        userAnswers = [rawAnswer.trim()];
    }

    try {
        const [rows] = await itemReportModel.previewOwnershipMatch([itemId], []);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        const item = rows[0];
        const expectedAnswers = parseChallenges(item.secret_answer);
        // If the item has no secret challenge, verification is bypassed (100% confidence)
        if (expectedAnswers.length === 0 || !item.secret_challenge) {
            return res.json({ hasChallenge: false, score: 100, meetsThreshold: true, threshold: ANSWER_MATCH_THRESHOLD });
        }

        // Calculate confidence score via the Campus Match Engine
        const matchResult = calculateMultiAnswerMatch(userAnswers, expectedAnswers);
        return res.json({
            hasChallenge: true,
            score: matchResult.score,
            meetsThreshold: matchResult.meetsThreshold,
            scores: matchResult.scores,
            threshold: ANSWER_MATCH_THRESHOLD
        });
    } catch (err) {
        console.error('Error previewing match:', err);
        return res.status(500).json({ error: 'Failed to compute match' });
    }
};

const createClaim = async (req, res) => {
    const itemId = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(itemId) || itemId < 1) {
        return res.redirect('/dashboard?error=Invalid item ID.');
    }
    const rawProofAnswers = req.body.proof_answers;
    const rawProofDetails = req.body.proof_details;
    let claimantAnswers = [];
    if (Array.isArray(rawProofAnswers)) {
        claimantAnswers = rawProofAnswers.map((a) => (typeof a === 'string' ? a.trim() : ''));
    } else if (Array.isArray(rawProofDetails)) {
        claimantAnswers = rawProofDetails.map((a) => (typeof a === 'string' ? a.trim() : ''));
    } else if (typeof rawProofDetails === 'string') {
        claimantAnswers = [rawProofDetails.trim()];
    }

    try {
        // Verify item exists and is active found
        const [itemRows] = await itemReportModel.createClaim([itemId], []);
        if (itemRows.length === 0) {
            return res.redirect('/dashboard?error=Item not found.');
        }
        const item = itemRows[0];

        if (item.status !== 'active') {
            return res.redirect(`/items/${itemId}?error=${encodeURIComponent('Claims can only be submitted for active item reports.')}`);
        }
        const isLostReport = item.report_type === 'lost';

        if (item.user_id === req.session.user.id) {
            return res.redirect(`/items/${itemId}?error=${encodeURIComponent('You cannot submit a claim on your own report.')}`);
        }

        // Check if claim already exists
        const [existing] = await claimModel.createClaim([itemId, req.session.user.id], []);
        if (existing.length > 0) {
            return res.redirect(`/claims/${existing[0].id}`);
        }

        // Enforce 3-pending-claim cap for non-admin claimants
        if (!isAdmin(req.session.user)) {
            const [pendingCountRows] = await claimModel.countActivePendingClaims([req.session.user.id], []);
            const activePendingCount = Number(pendingCountRows[0]?.count || 0);
            if (activePendingCount >= 3) {
                return res.redirect(
                    `/items/${itemId}?error=${encodeURIComponent('You have reached the limit of 3 active pending claims. Please withdraw an existing claim in My Claims before submitting another.')}`
                );
            }
        }

        const questions = parseChallenges(item.secret_challenge);
        const expectedAnswers = parseChallenges(item.secret_answer);

        if (questions.length > 0) {
            const hasEmptyAnswer = questions.some((_, idx) => !claimantAnswers[idx] || claimantAnswers[idx].trim().length === 0);
            if (hasEmptyAnswer) {
                return res.redirect(`/items/${itemId}?error=${encodeURIComponent('Please answer all verification challenge questions.')}`);
            }
        } else {
            if (!claimantAnswers[0] || claimantAnswers[0].trim().length === 0) {
                return res.redirect(`/items/${itemId}?error=${encodeURIComponent(isLostReport ? 'Please provide details about where and how you found the item.' : 'Proof of ownership details are required.')}`);
            }
        }

        const exceedsLength = claimantAnswers.some((a) => a.length > 500);
        if (exceedsLength) {
            return res.redirect(`/items/${itemId}?error=${encodeURIComponent('Your answer must be 500 characters or fewer.')}`);
        }

        const matchResult = calculateMultiAnswerMatch(claimantAnswers, expectedAnswers);
        // Strict threshold on Found items; Advisory score on Lost items so finders can still chat with the owner
        if (!isLostReport && matchResult.hasChallenge && !matchResult.meetsThreshold) {
            req.session.answerMatchResult = { itemId, score: matchResult.score };
            await saveSession(req);
            return res.redirect(`/items/${itemId}?error=${encodeURIComponent(`Your answer scored ${matchResult.score}%. A match of at least ${ANSWER_MATCH_THRESHOLD}% is required to file this claim.`)}`);
        }

        // Format proof details for storage
        let proofDetailsToSave = '';
        if (questions.length > 1) {
            proofDetailsToSave = questions.map((q, idx) => `Q${idx + 1}: ${q}\nA: ${claimantAnswers[idx] || ''}`).join('\n\n');
        } else {
            proofDetailsToSave = claimantAnswers[0] || '';
        }

        if (matchResult.hasChallenge) {
            proofDetailsToSave = `[Match Score: ${matchResult.score}%] ${proofDetailsToSave}`;
        }

        // Insert into claims
        const [claimResult] = await claimModel.createClaimQuery2([itemId, req.session.user.id, proofDetailsToSave], []);
        const claimId = claimResult.insertId;

        // Automatically start the communication thread in claim_messages
        const claimHeading = isLostReport
            ? `Found Item Claim Filed${matchResult.hasChallenge ? ` (Match Score: ${matchResult.score}%)` : ''}`
            : `Ownership Claim Filed${matchResult.hasChallenge ? ` (Match Score: ${matchResult.score}%)` : ''}`;
        await claimModel.createClaimQuery3([claimId, req.session.user.id, `${claimHeading}:\n"${proofDetailsToSave}"`], []);

        req.session.answerMatchResult = { itemId, score: matchResult.score };
        invalidateUnreadCache([item.user_id, req.session.user.id], { includeAdmins: true });
        await saveSession(req);
        const successMsg = isLostReport
            ? 'Found claim submitted. You can now chat with the owner to coordinate handover.'
            : 'Claim submitted. You can now communicate with the finder.';
        return res.redirect(`/items/${itemId}?msg=${encodeURIComponent(successMsg)}`);
    } catch (err) {
        console.error('Claim submission error:', err);
        return res.redirect(`/items/${itemId}?error=Failed to submit claim.`);
    }
};

const cancelClaim = async (req, res) => {
    const claimId = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(claimId) || claimId < 1) {
        return res.redirect('/claims');
    }
    const itemId = parseInt(req.body.item_id, 10);
    const redirectBase = itemId ? `/items/${itemId}` : '/claims';
    try {
        await claimModel.cancelClaim([claimId, req.session.user.id], []);
        invalidateAllUnreadCache();
        return res.redirect(`${redirectBase}?msg=${encodeURIComponent('Your pending claim has been withdrawn.')}`);
    } catch (err) {
        console.error('Error withdrawing claim:', err);
        return res.redirect(`${redirectBase}?error=${encodeURIComponent('Unable to withdraw claim.')}`);
    }
};

const listClaims = async (req, res) => {
    const user = req.session.user;

    try {
        const [[madeClaims], [receivedClaims]] = await Promise.all([
            claimModel.listClaims([user.id], []),
            claimModel.listClaimsQuery2([user.id], [])
        ]);

        res.render('claims', {
            user,
            madeClaims,
            receivedClaims,
            timeAgo,
            msg: req.query.msg || null,
            error: req.query.error || null
        });
    } catch (err) {
        console.error('Error fetching claims:', err);
        res.status(500).send('Error loading claims.');
    }
};

const showClaimChat = async (req, res) => {
    const claimId = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(claimId) || claimId < 1) {
        return res.redirect('/claims?error=Invalid claim ID.');
    }
    const user = req.session.user;

    try {
        const [claimRows] = await claimModel.showClaimChat([claimId], []);

        if (claimRows.length === 0) {
            return res.redirect('/claims?error=Claim not found.');
        }

        const claim = claimRows[0];

        // Access check: User must be claimant, reporter, or admin
        const userIsAdmin = isAdmin(user);
        const userIsClaimant = claim.claimant_id === user.id;
        const userIsReporter = claim.reporter_id === user.id;

        if (!userIsAdmin && !userIsClaimant && !userIsReporter) {
            return res.redirect('/claims?error=Unauthorized to view this claim.');
        }

        // Fetch messages from claim_messages
        const [messages] = await claimModel.showClaimChatQuery2([claimId], []);

        res.render('chat', {
            claim,
            messages,
            user,
            userIsAdmin,
            userIsClaimant,
            userIsReporter,
            timeAgo,
            msg: req.query.msg || null,
            error: req.query.error || null
        });
    } catch (err) {
        console.error('Error loading claim chat:', err);
        res.redirect('/claims?error=Unable to load claim chat.');
    }
};

const sendClaimMessage = async (req, res) => {
    const claimId = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(claimId) || claimId < 1) {
        return res.redirect('/claims');
    }
    const text = typeof req.body.message === 'string' ? req.body.message.trim() : '';

    if (!text) {
        return res.redirect(`/claims/${claimId}`);
    }

    try {
        const [claimRows] = await claimModel.sendClaimMessage([claimId], []);
        if (claimRows.length === 0) return res.redirect('/claims');
        const claim = claimRows[0];

        const user = req.session.user;
        const allowed = isAdmin(user) || claim.claimant_id === user.id || claim.reporter_id === user.id;
        if (!allowed) {
            return res.status(403).send('Unauthorized');
        }

        if (['rejected', 'returned'].includes(claim.status)) {
            return res.redirect(`/claims/${claimId}?error=${encodeURIComponent('This claim conversation is closed and no longer accepts new messages.')}`);
        }

        const sanitizedText = ['pending', 'escalated'].includes(claim.status)
            ? maskContactPhoneNumbers(text)
            : text;

        await claimModel.sendClaimMessageQuery2([claimId, user.id, sanitizedText], []);

        return res.redirect(`/claims/${claimId}`);
    } catch (err) {
        console.error('Error sending message:', err);
        return res.redirect(`/claims/${claimId}?error=Failed to send message.`);
    }
};

const updateClaimStatus = async (req, res) => {
    const claimId = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(claimId) || claimId < 1) {
        return res.redirect('/claims');
    }
    const action = req.body.action; // 'approved' or 'rejected'

    if (!['approved', 'rejected', 'escalated', 'returned'].includes(action)) {
        return res.redirect(`/claims/${claimId}`);
    }

    try {
        const [claimRows] = await claimModel.updateClaimStatus([claimId], []);
        if (claimRows.length === 0) return res.redirect('/claims');
        const claim = claimRows[0];

        if (['rejected', 'returned'].includes(claim.status)) {
            return res.redirect(`/claims/${claimId}?error=${encodeURIComponent(`Closed claims (${claim.status}) cannot be modified.`)}`);
        }

        if (action === 'escalated' && !['pending', 'approved'].includes(claim.status)) {
            return res.redirect(`/claims/${claimId}?error=${encodeURIComponent('This claim cannot be escalated from its current status.')}`);
        }

        const user = req.session.user;
        const userIsAdmin = isAdmin(user);
        const userIsReporter = claim.reporter_id === user.id;
        const userIsClaimant = claim.claimant_id === user.id;

        if (action === 'escalated') {
            if (!userIsAdmin && !userIsReporter && !userIsClaimant) {
                return res.redirect(`/claims/${claimId}?error=Unauthorized to escalate this claim.`);
            }
        } else if (!userIsAdmin && !userIsReporter) {
            return res.redirect(`/claims/${claimId}?error=Only the finder or an admin can resolve this claim.`);
        }

        if (!userIsAdmin && ['approved', 'returned'].includes(action) && claim.custody_mode === 'security_desk' && claim.report_type === 'found') {
            return res.redirect(`/claims/${claimId}?error=${encodeURIComponent('This item is under Security Desk custody and can only be released by an administrator.')}`);
        }

        await claimModel.updateClaimStatusQuery2([action, claimId], []);

        if (action === 'approved') {
            await itemReportModel.updateClaimStatus([claim.item_id], []);
            await claimModel.updateClaimStatusQuery3([claimId, user.id, `[SYSTEM] Claim marked as APPROVED. The item "${claim.item_name}" has been marked as claimed/reunited.`], []);
            await closeCompetingClaimsForItem(claim.item_id, claimId, user.id, 'approved');
        } else if (action === 'returned') {
            await itemReportModel.updateClaimStatusQuery2([claim.item_id], []);
            await claimModel.updateClaimStatusQuery4([claimId, user.id, `[SYSTEM] Item marked as RETURNED. The item "${claim.item_name}" has been handed back and closed as returned.`], []);
            await closeCompetingClaimsForItem(claim.item_id, claimId, user.id, 'marked returned');
        } else if (action === 'escalated') {
            await claimModel.updateClaimStatusQuery5([claimId, user.id, `[SECURITY ESCALATION] Claim has been escalated to Campus Security Desk for manual verification and custody handover.`], []);
        } else {
            await claimModel.updateClaimStatusQuery6([claimId, user.id, `[SYSTEM] Claim marked as REJECTED.`], []);
        }

        invalidateAllUnreadCache();

        if (userIsAdmin) {
            await logAudit(
                user.id,
                `Admin marked claim #${claimId} (${claim.item_name}) as ${action}`,
                req.ip
            );
        }

        return res.redirect(`/claims/${claimId}?msg=${encodeURIComponent(`Claim has been updated: ${action}.`)}`);
    } catch (err) {
        console.error('Error updating claim status:', err);
        return res.redirect(`/claims/${claimId}?error=Failed to update status.`);
    }
};

const listMyReports = async (req, res) => {
    const user = req.session.user;
    try {
        const [reports] = await itemReportModel.listMyReports([user.id], []);

        res.render('myReports', {
            user,
            reports,
            timeAgo,
            msg: req.query.msg || null,
            error: req.query.error || null
        });
    } catch (err) {
        console.error('Error fetching my reports:', err);
        res.status(500).send('Error loading reports.');
    }
};

const updateItemStatus = async (req, res) => {
    const user = req.session.user;
    const redirectBase = isAdmin(user) ? '/admin/reports' : '/my-reports';
    const itemId = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(itemId) || itemId < 1) {
        return res.redirect(`${redirectBase}?error=Invalid item ID.`);
    }
    const newStatus = req.body.status;

    if (!['active', 'claimed', 'returned', 'archived', 'pending_review'].includes(newStatus)) {
        return res.redirect(redirectBase);
    }

    try {
        const [itemRows] = await itemReportModel.updateItemStatus([itemId], []);
        if (itemRows.length === 0) return res.redirect(redirectBase);
        const item = itemRows[0];

        if (!isAdmin(user) && item.user_id !== user.id) {
            return res.redirect(`${redirectBase}?error=Unauthorized.`);
        }

        await itemReportModel.updateItemStatusQuery2([newStatus, itemId], []);

        if (isAdmin(user)) {
            await logAudit(user.id, `Admin changed item #${itemId} status to ${newStatus}`, req.ip);
        }

        return res.redirect(`${redirectBase}?msg=${encodeURIComponent(`Item marked as ${newStatus}.`)}`);
    } catch (err) {
        console.error('Error changing item status:', err);
        return res.redirect(`${redirectBase}?error=Error updating status.`);
    }
};

const deleteItemReport = async (req, res) => {
    const user = req.session.user;
    const redirectBase = isAdmin(user) ? '/admin/reports' : '/my-reports';
    const itemId = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(itemId) || itemId < 1) {
        return res.redirect(`${redirectBase}?error=Invalid item ID.`);
    }
    try {
        const [itemRows] = await itemReportModel.deleteItemReport([itemId], []);
        if (itemRows.length === 0) return res.redirect(redirectBase);
        const item = itemRows[0];

        if (!isAdmin(user) && item.user_id !== user.id) {
            return res.redirect(`${redirectBase}?error=Unauthorized.`);
        }

        const [storedImages] = await itemReportModel.showItemReportImages([itemId], []);
        await itemReportModel.deleteItemReportQuery2([itemId], []);
        const imagePaths = storedImages.map((image) => image.image_path);
        if (item.primary_image_path) imagePaths.push(item.primary_image_path);
        await removeReportImageFiles([...new Set(imagePaths)]);

        if (isAdmin(user)) {
            await logAudit(user.id, `Admin deleted item report #${itemId} ("${item.item_name}")`, req.ip);
        }

        return res.redirect(`${redirectBase}?msg=${encodeURIComponent('Report deleted successfully.')}`);
    } catch (err) {
        console.error('Error deleting report:', err);
        return res.redirect(`${redirectBase}?error=Failed to delete report.`);
    }
};

const showEditItemForm = async (req, res) => {
    const itemId = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(itemId) || itemId < 1) {
        return res.redirect('/dashboard?error=Invalid report ID.');
    }
    const user = req.session.user;
    try {
        const [rows] = await itemReportModel.showEditItemForm([itemId], []);
        if (rows.length === 0) return res.redirect(isAdmin(user) ? '/admin/reports?error=Report not found.' : '/dashboard?error=Report not found.');
        const item = rows[0];

        if (!isAdmin(user) && item.user_id !== user.id) {
            return res.redirect(`/items/${itemId}?error=Unauthorized to edit this report.`);
        }

        const [storedImages] = await itemReportModel.showItemReportImages([itemId], []);
        const itemImages = storedImages.length
            ? storedImages
            : (item.primary_image_path ? [{ image_path: item.primary_image_path, is_primary: 1, sort_order: 0 }] : []);
        const challengeQuestions = parseChallenges(item.secret_challenge);
        const challengeAnswers = parseChallenges(item.secret_answer);
        const challengePairs = [];
        const maxPairs = Math.max(challengeQuestions.length, challengeAnswers.length);
        for (let i = 0; i < maxPairs; i++) {
            challengePairs.push({
                question: challengeQuestions[i] || '',
                answer: challengeAnswers[i] || ''
            });
        }
        res.render('editReport', {
            item,
            itemImages,
            user,
            categories: CATEGORIES,
            challengePairs,
            csrfToken: res.locals.csrfToken || '',
            msg: req.query.msg || null,
            error: req.query.error || null
        });
    } catch (err) {
        console.error('Error fetching report for edit:', err);
        res.redirect(isAdmin(user)
            ? '/admin/reports?error=Error loading edit page.'
            : '/dashboard?error=Error loading edit page.');
    }
};

const updateItemReport = async (req, res) => {
    const itemId = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(itemId) || itemId < 1) {
        return res.redirect('/dashboard?error=Invalid report ID.');
    }
    const user = req.session.user;
    const uploadedFiles = req.files || [];
    const itemName = typeof req.body.item_name === 'string' ? req.body.item_name.trim() : '';
    const category = typeof req.body.category === 'string' ? req.body.category.trim() : 'Other';
    const status = typeof req.body.status === 'string' ? req.body.status.trim() : 'active';
    const location = typeof req.body.location_found_lost === 'string' ? req.body.location_found_lost.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    if (!itemName || !location || !description) {
        await removeUploadedFiles(uploadedFiles);
        return res.redirect(`/items/${itemId}/edit?error=${encodeURIComponent('Please provide an item title, campus location, and description.')}`);
    }

    const verificationPairs = extractVerificationPairs(req.body);
    const hasIncompletePair = verificationPairs.some((p) => !p.question || !p.answer);
    if (hasIncompletePair) {
        await removeUploadedFiles(uploadedFiles);
        return res.redirect(`/items/${itemId}/edit?error=${encodeURIComponent('Enter both the ownership question and its private correct answer, or leave both blank.')}`);
    }
    if (verificationPairs.length > 5) {
        await removeUploadedFiles(uploadedFiles);
        return res.redirect(`/items/${itemId}/edit?error=${encodeURIComponent('You can configure up to 5 verification questions.')}`);
    }
    const exceedsLength = verificationPairs.some((p) => p.question.length > 500 || p.answer.length > 500);
    if (exceedsLength) {
        await removeUploadedFiles(uploadedFiles);
        return res.redirect(`/items/${itemId}/edit?error=${encodeURIComponent('The ownership question and answer must each be 500 characters or fewer.')}`);
    }

    let secretChallenge = null;
    let secretAnswer = null;
    if (verificationPairs.length === 1) {
        secretChallenge = verificationPairs[0].question;
        secretAnswer = verificationPairs[0].answer;
    } else if (verificationPairs.length > 1) {
        secretChallenge = JSON.stringify(verificationPairs.map((p) => p.question));
        secretAnswer = JSON.stringify(verificationPairs.map((p) => p.answer));
    }

    const imagePaths = uploadedFiles.map((file) => ({
        path: `/uploads/${file.filename}`,
        fileData: file.base64Data || null
    }));

    try {
        const [rows] = await itemReportModel.updateItemReport([itemId], []);
        if (rows.length === 0) {
            await removeUploadedFiles(uploadedFiles);
            return res.redirect(isAdmin(user) ? '/admin/reports?error=Report not found.' : '/dashboard?error=Report not found.');
        }
        const item = rows[0];

        if (!isAdmin(user) && item.user_id !== user.id) {
            await removeUploadedFiles(uploadedFiles);
            return res.redirect(`/items/${itemId}?error=Unauthorized to edit this report.`);
        }

        const [existingImages] = await itemReportModel.showItemReportImages([itemId], []);
        const rawRemoveIds = req.body.remove_image_ids;
        const requestedRemoveIds = (Array.isArray(rawRemoveIds) ? rawRemoveIds : (rawRemoveIds ? [rawRemoveIds] : []))
            .map((id) => parseInt(id, 10))
            .filter((id) => Number.isInteger(id) && id > 0);
        const existingIdSet = new Set(existingImages.map((img) => Number(img.id)).filter((id) => Number.isInteger(id) && id > 0));
        const validRemoveIds = [...new Set(requestedRemoveIds.filter((id) => existingIdSet.has(id)))];

        const existingImageCount = existingImages.length;
        const remainingImageCount = Math.max(0, existingImageCount - validRemoveIds.length);
        if (remainingImageCount + uploadedFiles.length > 6) {
            await removeUploadedFiles(uploadedFiles);
            return res.redirect(`/items/${itemId}/edit?error=${encodeURIComponent('A report can have up to 6 photos total. Remove existing photos or upload fewer new photos.')}`);
        }

        const validStatuses = ['active', 'claimed', 'returned', 'archived', 'pending_review'];
        const finalStatus = validStatuses.includes(status) ? status : item.status;
        const requestedCustody = req.body.custody_mode === 'security_desk'
            ? 'security_desk'
            : (req.body.custody_mode === 'peer_meetup' ? 'peer_meetup' : null);
        const custodyMode = (
            requestedCustody
            && item.report_type === 'found'
            && item.status === 'active'
            && !item.custody_received_at
        ) ? requestedCustody : null;

        const updateResult = await itemReportModel.updateItemReportQuery2(
            [itemName, category, description, finalStatus, location, secretChallenge, secretAnswer, itemId],
            imagePaths,
            { removeImageIds: validRemoveIds, custodyMode }
        );
        if (updateResult && Array.isArray(updateResult.removedPaths) && updateResult.removedPaths.length > 0) {
            await removeReportImageFiles(updateResult.removedPaths);
        }

        if (isAdmin(user)) {
            await logAudit(user.id, `Admin edited report #${itemId} ("${itemName}")`, req.ip);
        }

        return res.redirect(`/items/${itemId}?msg=${encodeURIComponent('Report updated successfully.')}`);
    } catch (err) {
        console.error('Error updating report:', err);
        await removeUploadedFiles(uploadedFiles);
        return res.redirect(`/items/${itemId}/edit?error=Failed to update report.`);
    }
};

const showSettings = async (req, res) => {
    const user = req.session.user;
    try {
        const [userRows] = await userModel.showSettings([user.id], []);
        if (userRows.length === 0) {
            return res.redirect('/logout');
        }
        const profileUser = userRows[0];
        req.session.user.role = profileUser.role;
        const mfaEnabled = Boolean(profileUser.mfa_enabled);

        // Fetch User's Reports
        const [myReports] = await itemReportModel.showSettings([user.id], []);

        // Fetch User's Claims
        const [claimsMade] = await claimModel.showSettings([user.id], []);

        // Fetch Audit history
        const [auditHistory] = await auditLogModel.showSettings([user.id], []);

        res.render('settings', {
            user,
            profileUser,
            myReports,
            claimsMade,
            auditHistory,
            mfaEnabled,
            isAdmin: isAdmin(profileUser),
            activeTab: req.query.tab || (isAdmin(profileUser) ? 'security' : 'personal'),
            csrfToken: res.locals.csrfToken || '',
            msg: req.query.msg || null,
            error: req.query.error || null
        });
    } catch (err) {
        console.error('Error fetching settings:', err);
        res.redirect(isAdmin(user) ? '/admin/dashboard?error=Error loading account settings.' : '/dashboard?error=Error loading account settings.');
    }
};

const updateProfile = async (req, res) => {
    const user = req.session.user;
    const fullName = typeof req.body.full_name === 'string' ? req.body.full_name.trim() : '';
    const phoneNumber = typeof req.body.phone_number === 'string' ? req.body.phone_number.trim() : null;
    const requestedDepartment = typeof req.body.department === 'string' ? req.body.department.trim() : '';

    if (!fullName) {
        return res.redirect(`/settings?error=${encodeURIComponent('Full name is required.')}#personal`);
    }

    try {
        const [roleRows] = await userModel.updateProfile([user.id], []);
        if (roleRows.length === 0) {
            return res.redirect('/logout');
        }
        const role = roleRows[0].role_code;
        const email = roleRows[0].email;
        const studentId = roleRows[0].student_id;
        const canEditDepartment = ['student', 'staff'].includes(role);
        const department = canEditDepartment ? requestedDepartment : '';
        if (canEditDepartment && department.length > 255) {
            return res.redirect(`/settings?error=${encodeURIComponent('Department / course must be 255 characters or fewer.')}#personal`);
        }

        const connection = await getConnection();
        try {
            await connection.beginTransaction();
            let departmentId = canEditDepartment ? null : roleRows[0].department_id;
            if (department) {
                const [departmentResult] = await userModel.updateProfileQuery3([department], [], connection);
                departmentId = departmentResult.insertId;
            }
            await userModel.updateProfileQuery4([fullName, email, phoneNumber, departmentId, studentId, user.id], [], connection);
            await connection.commit();
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

        // Update session user identity
        req.session.user.full_name = fullName;
        req.session.user.email = email;
        req.session.user.role = role;
        await saveSession(req);

        return res.redirect(`/settings?msg=${encodeURIComponent('Personal details updated successfully.')}#personal`);
    } catch (err) {
        console.error('Error updating profile:', err);
        return res.redirect(`/settings?error=${encodeURIComponent('Failed to update personal details.')}#personal`);
    }
};

const updateSecurity = async (req, res) => {
    const user = req.session.user;
    const currentPassword = typeof req.body.current_password === 'string' ? req.body.current_password : '';
    const newPassword = typeof req.body.new_password === 'string' ? req.body.new_password : '';
    const confirmPassword = typeof req.body.confirm_password === 'string' ? req.body.confirm_password : '';

    if (!currentPassword || !newPassword || !confirmPassword) {
        return res.redirect(`/settings?error=${encodeURIComponent('All password fields are required.')}#security`);
    }

    if (newPassword !== confirmPassword) {
        return res.redirect(`/settings?error=${encodeURIComponent('New password and confirmation password do not match.')}#security`);
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
        return res.redirect(`/settings?error=${encodeURIComponent(strength.errors.join('. '))}#security`);
    }

    try {
        const [rows] = await userModel.updateSecurity([user.id], []);
        if (rows.length === 0) return res.redirect('/logout');

        const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
        if (!match) {
            return res.redirect(`/settings?error=${encodeURIComponent('Current password is incorrect.')}#security`);
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        await userModel.updateSecurityQuery2([hashed, user.id], []);
        await DatabaseSessionStore.destroyUserSessionsForUser(user.id, req.sessionID, req.sessionStore);

        return res.redirect(`/settings?msg=${encodeURIComponent('Security password updated successfully.')}#security`);
    } catch (err) {
        console.error('Error changing password in settings:', err);
        return res.redirect(`/settings?error=${encodeURIComponent('Failed to update password.')}#security`);
    }
};

const enableMfa = async (req, res) => {
    const user = req.session.user;
    const currentPassword = typeof req.body.current_password === 'string' ? req.body.current_password : '';

    if (!currentPassword) {
        return res.redirect(`/settings?error=${encodeURIComponent('Enter your current password to enable email MFA.')}#security`);
    }

    try {
        const [userRows] = await userModel.enableMfa([user.id], []);
        if (userRows.length === 0) return res.redirect('/logout');

        const passwordMatches = await bcrypt.compare(currentPassword, userRows[0].password_hash);
        if (!passwordMatches) {
            return res.redirect(`/settings?error=${encodeURIComponent('Current password is incorrect.')}#security`);
        }

        if (Boolean(userRows[0].mfa_enabled)) {
            return res.redirect(`/settings?msg=${encodeURIComponent('Email MFA is already enabled.')}#security`);
        }

        await verifyEmailTransport();
        await sendMfaEnabledNotice(user.email);
        await userModel.enableMfaQuery2([user.id], []);

        return res.redirect(`/settings?msg=${encodeURIComponent('Email MFA is enabled and a confirmation email was sent. A one-time code will be emailed after your password at every sign-in.')}#security`);
    } catch (error) {
        console.error('Error starting email MFA enrollment:', error);
        if (error.code === 'SMTP_CONFIGURATION_MISSING') {
            return res.redirect(`/settings?error=${encodeURIComponent('Email MFA cannot send a code yet. Configure SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD in .env, then restart HANAP.')}#security`);
        }
        return res.redirect(`/settings?error=${encodeURIComponent('Could not send the MFA confirmation email. Check the email service configuration and try again.')}#security`);
    }
};

const disableMfa = async (req, res) => {
    const currentPassword = typeof req.body.current_password === 'string' ? req.body.current_password : '';
    if (!currentPassword) {
        return res.redirect(`/settings?error=${encodeURIComponent('Enter your current password to disable MFA.')}#security`);
    }

    try {
        const [userRows] = await userModel.disableMfa([req.session.user.id], []);
        if (userRows.length === 0) return res.redirect('/logout');

        const passwordMatches = await bcrypt.compare(currentPassword, userRows[0].password_hash);
        if (!passwordMatches) {
            return res.redirect(`/settings?error=${encodeURIComponent('Current password is incorrect.')}#security`);
        }

        if (!Boolean(userRows[0].mfa_enabled)) {
            return res.redirect(`/settings?msg=${encodeURIComponent('Email MFA is already disabled.')}#security`);
        }

        await userModel.disableMfaQuery2([req.session.user.id], []);
        await mfaModel.disableMfa([req.session.user.id], []);
        await DatabaseSessionStore.destroyUserSessionsForUser(req.session.user.id, req.sessionID, req.sessionStore);
        return res.redirect(`/settings?msg=${encodeURIComponent('Email MFA has been disabled.')}#security`);
    } catch (error) {
        console.error('Error disabling email MFA:', error);
        return res.redirect(`/settings?error=${encodeURIComponent('Could not disable MFA. Please try again.')}#security`);
    }
};

const updateNotificationSettings = async (req, res) => {
    const user = req.session.user;
    const notifyClaims = req.body.notify_claims ? 1 : 0;
    const notifyChat = req.body.notify_chat ? 1 : 0;
    const notifyBroadcasts = req.body.notify_broadcasts ? 1 : 0;
    try {
        await userModel.updateNotificationSettings([notifyClaims, notifyChat, notifyBroadcasts, user.id], []);
        return res.redirect(`/settings?msg=${encodeURIComponent('Notification preferences saved successfully.')}#notifications`);
    } catch (err) {
        console.error('Error updating notification settings:', err);
        return res.redirect(`/settings?error=${encodeURIComponent('Failed to save notification preferences.')}#notifications`);
    }
};

const deleteAccount = async (req, res) => {
    const user = req.session.user;
    try {
        await mfaModel.deletePasswordResetForAccount([user.id], []);
        await mfaModel.deleteAccount([user.id], []);
        await userModel.deleteAccount([user.id], []);
        await DatabaseSessionStore.destroyUserSessionsForUser(user.id, req.sessionID, req.sessionStore);
        req.session.destroy(() => {
            res.redirect('/login?msg=' + encodeURIComponent('Your account has been deleted.'));
        });
    } catch (err) {
        console.error('Error deleting account:', err);
        res.redirect(`/settings?error=${encodeURIComponent('Failed to delete account.')}#personal`);
    }
};

const showAdminDashboard = async (req, res) => {
    const user = req.session.user;
    try {
        await ensureStaleItemsSwept();
        const [
            [userCount],
            [reportCount],
            [claimCount],
            [vaultedRows],
            [guestClaimRows],
            [disputeRows],
            [overdueRows],
            [recentAudits],
            [catStats],
            [postedItems]
        ] = await Promise.all([
            userModel.showAdminDashboard(undefined, []),
            itemReportModel.showAdminDashboard(undefined, []),
            claimModel.showAdminDashboard(undefined, []),
            itemReportModel.showAdminDashboardQuery2(undefined, []),
            claimModel.showAdminDashboardQuery2(undefined, []),
            claimModel.showAdminDashboardQuery3(undefined, []),
            itemReportModel.showAdminDashboardQuery3(undefined, []),
            auditLogModel.showAdminDashboard(undefined, []),
            itemReportModel.showAdminDashboardQuery4(undefined, []),
            itemReportModel.showAdminDashboardQuery5(undefined, [])
        ]);

        res.render('adminDashboard', {
            user,
            stats: {
                users: userCount[0].cnt,
                reports: reportCount[0],
                claims: claimCount[0],
                vaulted: vaultedRows.filter((item) => item.custody_received_at).length,
                guestClaims: guestClaimRows.length,
                disputes: disputeRows.length,
                overdue: overdueRows[0].cnt || 0
            },
            categories: CATEGORIES,
            vaultedItems: vaultedRows,
            postedItems,
            guestClaims: guestClaimRows,
            disputes: disputeRows,
            recentAudits,
            catStats,
            timeAgo,
            msg: req.query.msg || null,
            error: req.query.error || null
        });
    } catch (err) {
        console.error('Error loading admin dashboard:', err);
        res.status(500).send('Error loading admin portal.');
    }
};

const acceptItemCustody = async (req, res) => {
    const itemId = Number.parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(itemId) || itemId < 1) {
        return res.redirect(`/admin/dashboard?tab=surrendered&error=${encodeURIComponent('Invalid item report.')}`);
    }

    const user = req.session.user;
    try {
        const [result] = await itemReportModel.acceptItemCustody([user.id, itemId], []);
        if (result.affectedRows !== 1) {
            return res.redirect(`/admin/dashboard?tab=surrendered&error=${encodeURIComponent('This item is already accepted or is not awaiting Security Desk custody.')}`);
        }

        await logAudit(user.id, `Admin accepted physical custody of item report #${itemId}`, req.ip);
        return res.redirect(`/admin/dashboard?tab=surrendered&msg=${encodeURIComponent('Item accepted into Security Desk custody.')}`);
    } catch (err) {
        console.error('Error accepting item custody:', err);
        return res.redirect(`/admin/dashboard?tab=surrendered&error=${encodeURIComponent('Could not accept this item into custody. Please try again.')}`);
    }
};

const listAdminUsers = async (req, res) => {
    const user = req.session.user;
    try {
        const [users] = await claimModel.listAdminUsers(undefined, []);

        res.render('adminUsers', {
            user,
            users,
            csrfToken: res.locals.csrfToken || '',
            msg: req.query.msg || null,
            error: req.query.error || null
        });
    } catch (err) {
        console.error('Error fetching users:', err);
        res.redirect('/admin/dashboard?error=Failed to load user directory.');
    }
};

const createAdminUser = async (req, res) => {
    const fullName = typeof req.body.full_name === 'string' ? req.body.full_name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const role = ['student', 'staff', 'guest', 'admin'].includes(req.body.role) ? req.body.role : null;

    if (!fullName || !email || !password) {
        return res.redirect('/admin/users?error=All fields are required.');
    }
    if (!role) {
        return res.redirect('/admin/users?error=Select a valid account role.');
    }
    if (!isValidEmailSyntax(email)) {
        return res.redirect('/admin/users?error=Enter a valid email address.');
    }
    if (['student', 'staff', 'admin'].includes(role) && !isInstitutionalEmail(email)) {
        return res.redirect('/admin/users?error=Student, Staff, and Admin accounts require a CSPC institutional email.');
    }
    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
        return res.redirect(`/admin/users?error=${encodeURIComponent(`Password does not meet security requirements: ${strength.errors.join(', ')}.`)}`);
    }

    try {
        const [existing] = await userModel.createAdminUser([email.toLowerCase()], []);
        if (existing.length > 0) {
            return res.redirect('/admin/users?error=Email already in use.');
        }

        const hashed = await bcrypt.hash(password, 10);
        await userModel.createAdminUserQuery2([fullName, email.toLowerCase(), hashed, role], []);

        await logAudit(req.session.user.id, `Admin created user account for "${fullName}" (${role})`, req.ip);

        return res.redirect('/admin/users?msg=User created successfully.');
    } catch (err) {
        console.error('Error creating user:', err);
        return res.redirect('/admin/users?error=Failed to create user.');
    }
};

const resetUserQuota = async (req, res) => {
    const targetUserId = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(targetUserId) || targetUserId < 1) {
        return res.redirect('/admin/users?error=Invalid user ID.');
    }
    try {
        const [pendingClaims] = await claimModel.listPendingClaimsForQuotaReset([targetUserId], []);
        await claimModel.resetUserQuota([targetUserId], []);
        await Promise.all((pendingClaims || []).map((row) => (
            claimModel.updateClaimStatusQuery6(
                [row.id, req.session.user.id, '[SYSTEM] This pending claim was closed during an administrator claim quota reset.'],
                []
            )
        )));
        invalidateAllUnreadCache();
        await logAudit(req.session.user.id, `Admin reset claim quota limit for user #${targetUserId}`, req.ip);
        return res.redirect('/admin/users?msg=User claim quota limit reset successfully.');
    } catch (err) {
        console.error('Error resetting quota:', err);
        return res.redirect('/admin/users?error=Failed to reset quota.');
    }
};

const updateUserRole = async (req, res) => {
    const targetUserId = parseInt(req.params.id, 10);
    const newRole = ['student', 'staff', 'guest', 'admin'].includes(req.body.new_role)
        ? req.body.new_role
        : null;
    if (!newRole) {
        return res.redirect('/admin/users?error=Select a valid account role.');
    }
    if (targetUserId === req.session.user.id && newRole !== 'admin') {
        return res.redirect('/admin/users?error=You cannot demote your own administrator account.');
    }
    try {
        const [targetUsers] = await userModel.updateUserRole([targetUserId], []);
        if (targetUsers.length === 0) {
            return res.redirect('/admin/users?error=User account not found.');
        }
        if (['student', 'staff', 'admin'].includes(newRole) && !isInstitutionalEmail(targetUsers[0].email)) {
            return res.redirect('/admin/users?error=Student, Staff, and Admin accounts require a CSPC institutional email.');
        }
        await userModel.updateUserRoleQuery2([newRole, targetUserId], []);
        await DatabaseSessionStore.destroyUserSessionsForUser(
            targetUserId,
            targetUserId === req.session.user.id ? req.sessionID : null,
            req.sessionStore
        );
        await logAudit(req.session.user.id, `Admin changed role of user #${targetUserId} to ${newRole}`, req.ip);
        return res.redirect(`/admin/users?msg=User role updated to ${newRole}.`);
    } catch (err) {
        console.error('Error updating role:', err);
        return res.redirect('/admin/users?error=Failed to update role.');
    }
};

const listHandoverClaims = async (req, res) => {
    const user = req.session.user;
    try {
        const [pendingHandovers] = await claimModel.listHandoverClaims(undefined, []);

        res.render('custodyHandover', {
            user,
            claim: null,
            pendingHandovers,
            csrfToken: res.locals.csrfToken || '',
            msg: req.query.msg || null,
            error: req.query.error || null
        });
    } catch (err) {
        console.error('Error loading handover queue:', err);
        res.redirect('/admin/dashboard?error=Failed to load custody terminal.');
    }
};

const showHandoverClaim = async (req, res) => {
    const user = req.session.user;
    const claimId = parseInt(req.params.claimId, 10);
    if (!Number.isSafeInteger(claimId) || claimId < 1) {
        return res.redirect('/admin/handover?error=Invalid claim ID.');
    }
    try {
        const [claimRows] = await claimModel.showHandoverClaim([claimId], []);

        if (claimRows.length === 0) {
            return res.redirect('/admin/handover?error=Claim not found.');
        }

        res.render('custodyHandover', {
            user,
            claim: claimRows[0],
            pendingHandovers: [],
            csrfToken: res.locals.csrfToken || '',
            msg: req.query.msg || null,
            error: req.query.error || null
        });
    } catch (err) {
        console.error('Error loading handover terminal:', err);
        res.redirect('/admin/handover?error=Failed to open handover terminal.');
    }
};

const confirmHandover = async (req, res) => {
    const user = req.session.user;
    const claimId = parseInt(req.params.claimId, 10);
    if (!Number.isSafeInteger(claimId) || claimId < 1) {
        return res.redirect('/admin/handover?error=Invalid claim ID.');
    }
    try {
        const [claimRows] = await claimModel.confirmHandover([claimId], []);
        if (claimRows.length === 0) return res.redirect('/admin/handover');
        const claim = claimRows[0];

        await claimModel.confirmHandoverQuery2([claimId], []);
        await itemReportModel.confirmHandover([claim.item_id], []);

        await claimModel.confirmHandoverQuery3([claimId, user.id, `[SECURITY LOG] Officer ${user.full_name} confirmed physical custody release and handover.`], []);
        await closeCompetingClaimsForItem(claim.item_id, claimId, user.id, 'released by Campus Security');
        invalidateAllUnreadCache();

        await logAudit(user.id, `Officer confirmed physical custody release for claim #${claimId}`, req.ip);

        return res.redirect(`/admin/dashboard?msg=Physical custody release confirmed for claim #${claimId}.`);
    } catch (err) {
        console.error('Error confirming handover release:', err);
        return res.redirect(`/admin/handover/${claimId}?error=Failed to confirm release.`);
    }
};

const rejectHandover = async (req, res) => {
    const user = req.session.user;
    const claimId = parseInt(req.params.claimId, 10);
    if (!Number.isSafeInteger(claimId) || claimId < 1) {
        return res.redirect('/admin/handover?error=Invalid claim ID.');
    }
    try {
        await claimModel.rejectHandover([claimId], []);
        await claimModel.rejectHandoverQuery2([claimId, user.id, `[SECURITY LOG] Officer ${user.full_name} rejected physical custody release.`], []);
        invalidateAllUnreadCache();
        await logAudit(user.id, `Officer rejected custody release for claim #${claimId}`, req.ip);

        return res.redirect(`/admin/dashboard?msg=Claim #${claimId} rejected by security officer.`);
    } catch (err) {
        console.error('Error rejecting handover:', err);
        return res.redirect(`/admin/handover/${claimId}?error=Failed to reject claim.`);
    }
};

const showForbiddenPage = (req, res) => {
    return res.status(403).render('403', {
        user: req.session.user || null,
        attemptedPath: req.originalUrl,
        returnUrl: req.session.user && isAdmin(req.session.user) ? '/admin/dashboard' : '/dashboard',
        returnLabel: 'Back to Dashboard'
    });
};

const listAdminReports = async (req, res) => {
    const user = req.session.user;
    try {
        await ensureStaleItemsSwept();
        const [
            [reports],
            [deskClaims],
            [auditLogs]
        ] = await Promise.all([
            itemReportModel.listAdminReports(undefined, []),
            claimModel.listAdminReports(undefined, []),
            auditLogModel.listAdminReports(undefined, [])
        ]);

        // Calculate archive stats
        const totalReports = reports.length;
        const claimedReports = reports.filter((r) => ['claimed', 'returned'].includes(r.status)).length;
        const recoveryRate = totalReports > 0 ? Math.round((claimedReports / totalReports) * 100) : 0;
        const peerReturns = reports.filter(
            (r) => ['claimed', 'returned'].includes(r.status) && r.report_type === 'found' && r.custody_mode === 'peer_meetup'
        ).length;
        const deskHandovers = Number(deskClaims[0]?.count || 0);

        // Compute days since reported for 60-day archive queue
        const now = new Date();
        const enrichedReports = reports.map((r) => {
            const reportDate = new Date(r.date_reported);
            const diffTime = Math.max(0, now - reportDate);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const eligibleForDisposition = !['claimed', 'returned', 'archived'].includes(r.status)
                && (diffDays >= 60 || r.status === 'pending_review');
            return {
                ...r,
                daysActive: diffDays,
                isOverdue: eligibleForDisposition
            };
        });

        // Strict 60-day queue filter (only 60+ day overdue or pending_review items)
        const archiveQueue = enrichedReports.filter((r) => r.isOverdue);

        res.render('adminReports', {
            user,
            reports: enrichedReports,
            archiveQueue,
            auditLogs,
            csrfToken: res.locals.csrfToken || '',
            stats: {
                totalReports,
                recoveryRate,
                peerReturns,
                deskHandovers
            },
            timeAgo,
            msg: req.query.msg || null,
            error: req.query.error || null
        });
    } catch (err) {
        console.error('Error fetching admin reports:', err);
        res.status(500).send('Error loading reports.');
    }
};

const approveReportArchive = async (req, res) => {
    const user = req.session.user;
    const itemId = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(itemId) || itemId < 1) {
        return res.redirect('/admin/reports?error=Invalid item ID.');
    }
    try {
        const [result] = await itemReportModel.approveReportArchive([itemId], []);
        if (!result || result.affectedRows !== 1) {
            const errorMsg = 'Only items active for 60+ days or pending review can be archived.';
            if (req.xhr || req.headers.accept?.includes('json')) {
                return res.status(400).json({ error: errorMsg });
            }
            return res.redirect(`/admin/reports?error=${encodeURIComponent(errorMsg)}`);
        }
        await logAudit(user.id, `Admin approved 60-day disposition for item #${itemId}`, req.ip);
        if (req.xhr || req.headers.accept?.includes('json')) {
            return res.json({ success: true, message: 'Item approved for disposition.' });
        }
        return res.redirect('/admin/reports?msg=Item approved for disposition.');
    } catch (err) {
        console.error('Error approving item archive:', err);
        if (req.xhr || req.headers.accept?.includes('json')) {
            return res.status(500).json({ error: 'Failed to approve item.' });
        }
        return res.redirect('/admin/reports?error=Failed to approve item.');
    }
};

const batchApproveReportArchive = async (req, res) => {
    const user = req.session.user;
    try {
        await itemReportModel.batchApproveReportArchive(undefined, []);
        await logAudit(user.id, 'Admin batch-approved 60-day disposition archive queue', req.ip);
        if (req.xhr || req.headers.accept?.includes('json')) {
            return res.json({ success: true, message: 'Archive batch approved for disposition.' });
        }
        return res.redirect('/admin/reports?msg=Archive batch approved for disposition.');
    } catch (err) {
        console.error('Error batch approving archive:', err);
        if (req.xhr || req.headers.accept?.includes('json')) {
            return res.status(500).json({ error: 'Failed to batch approve archive.' });
        }
        return res.redirect('/admin/reports?error=Failed to batch approve archive.');
    }
};

const showAdminAnalytics = async (req, res) => {
    const user = req.session.user;
    try {
        const [
            [p2pStats],
            [deskStats],
            [reportStats],
            [categoryBreakdown],
            [pendingHandovers]
        ] = await Promise.all([
            claimModel.showAdminAnalytics(undefined, []),
            claimModel.showAdminAnalyticsQuery2(undefined, []),
            itemReportModel.showAdminAnalytics(undefined, []),
            claimModel.showAdminAnalyticsQuery3(undefined, []),
            claimModel.showAdminAnalyticsQuery4(undefined, [])
        ]);

        const p2pFirst = (p2pStats && p2pStats[0]) || {};
        const deskFirst = (deskStats && deskStats[0]) || {};
        const reportFirst = (reportStats && reportStats[0]) || { total_reports: 0, total_claimed: 0, total_active: 0, total_archived: 0 };

        const p2pTotal = Number(p2pFirst.total_claims || 0);
        const p2pApproved = Number(p2pFirst.approved_claims || 0);
        const p2pSuccessRate = p2pTotal > 0 ? Math.round((p2pApproved / p2pTotal) * 100) : 0;

        const deskTotal = Number(deskFirst.total_claims || 0);
        const deskApproved = Number(deskFirst.approved_claims || 0);
        const deskSuccessRate = deskTotal > 0 ? Math.round((deskApproved / deskTotal) * 100) : 0;

        res.render('adminAnalytics', {
            user,
            currentAdminPage: 'analytics',
            pendingHandoverCount: Number(pendingHandovers[0]?.cnt || 0),
            p2p: {
                total: p2pTotal,
                approved: p2pApproved,
                pending: Number(p2pFirst.pending_claims || 0),
                rejected: Number(p2pFirst.rejected_claims || 0),
                successRate: p2pSuccessRate,
                description: 'Direct campus peer verification via ownership challenges & claim chats'
            },
            centralized: {
                total: deskTotal,
                approved: deskApproved,
                pending: Number(deskFirst.pending_claims || 0),
                rejected: Number(deskFirst.rejected_claims || 0),
                successRate: deskSuccessRate,
                description: 'Physical Security Desk drop-off, escalations, and in-person ID verification'
            },
            reports: reportFirst,
            categories: categoryBreakdown || [],
            msg: req.query.msg || null,
            error: req.query.error || null
        });
    } catch (err) {
        console.error('Error fetching admin analytics:', err);
        res.status(500).send('Error loading statistical overview.');
    }
};

const listAuditLogs = async (req, res) => {
    const user = req.session.user;
    try {
        const [logs] = await auditLogModel.listAuditLogs(undefined, []);

        res.render('adminAuditLogs', {
            user,
            logs,
            csrfToken: res.locals.csrfToken || '',
            timeAgo,
            msg: req.query.msg || null,
            error: req.query.error || null
        });
    } catch (err) {
        console.error('Error loading audit logs:', err);
        res.status(500).send('Error loading audit logs.');
    }
};

const createAdminItemReport = async (req, res) => {
    const user = req.session.user;
    const uploadedFiles = req.files || [];
    const itemName = typeof req.body.item_name === 'string' ? req.body.item_name.trim() : '';
    const category = typeof req.body.category === 'string' ? req.body.category.trim() : 'Other';
    const location = typeof req.body.location_found_lost === 'string' ? req.body.location_found_lost.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    const verificationPairs = extractVerificationPairs(req.body);
    const hasIncompletePair = verificationPairs.some((p) => !p.question || !p.answer);
    if (hasIncompletePair) {
        await removeUploadedFiles(uploadedFiles);
        return res.redirect(`/admin/dashboard?tab=posted&error=${encodeURIComponent('Enter both the ownership question and its private correct answer, or leave both blank.')}`);
    }
    if (verificationPairs.length > 5) {
        await removeUploadedFiles(uploadedFiles);
        return res.redirect(`/admin/dashboard?tab=posted&error=${encodeURIComponent('You can configure up to 5 verification questions.')}`);
    }
    const exceedsLength = verificationPairs.some((p) => p.question.length > 500 || p.answer.length > 500);
    if (exceedsLength) {
        await removeUploadedFiles(uploadedFiles);
        return res.redirect(`/admin/dashboard?tab=posted&error=${encodeURIComponent('The ownership question and answer must each be 500 characters or fewer.')}`);
    }

    let secretChallenge = null;
    let secretAnswer = null;
    if (verificationPairs.length === 1) {
        secretChallenge = verificationPairs[0].question;
        secretAnswer = verificationPairs[0].answer;
    } else if (verificationPairs.length > 1) {
        secretChallenge = JSON.stringify(verificationPairs.map((p) => p.question));
        secretAnswer = JSON.stringify(verificationPairs.map((p) => p.answer));
    }

    const imagePaths = uploadedFiles.map((file) => ({
        path: `/uploads/${file.filename}`,
        fileData: file.base64Data || null
    }));

    try {
        const [result] = await itemReportModel.description(
            [user.id, itemName, category, description, location, secretChallenge, secretAnswer, user.id],
            imagePaths
        );

        await logAudit(
            user.id,
            `Admin logged office turned-in item #${result.insertId} ("${itemName}")`,
            req.ip
        );

        return res.redirect('/admin/dashboard?tab=posted&msg=Office item logged and broadcasted to campus.');
    } catch (err) {
        console.error('Error logging office item:', err);
        await removeUploadedFiles(uploadedFiles);
        return res.redirect('/admin/dashboard?tab=posted&error=Failed to log office item.');
    }
};

function sanitizeCsvCell(val) {
    let str = String(val == null ? '' : val).replace(/"/g, '""');
    if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
    }
    return `"${str}"`;
}

const exportReportsCsv = async (req, res) => {
    try {
        const [reports] = await itemReportModel.listAdminReports(undefined, []);
        let csv = 'ID,Item Name,Category,Type,Location,Status,Date Reported,Reporter Name,Reporter Email\r\n';
        for (const r of reports) {
            const id = r.id;
            const name = sanitizeCsvCell(r.item_name);
            const cat = sanitizeCsvCell(r.category);
            const type = sanitizeCsvCell(r.report_type);
            const loc = sanitizeCsvCell(r.location_found_lost);
            const status = sanitizeCsvCell(r.status);
            const date = new Date(r.date_reported).toISOString();
            const repName = sanitizeCsvCell(r.reporter_name);
            const repEmail = sanitizeCsvCell(r.reporter_email);
            csv += `${id},${name},${cat},${type},${loc},${status},${date},${repName},${repEmail}\r\n`;
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="hanap_reports_ledger_${new Date().toISOString().slice(0, 10)}.csv"`);
        return res.send(csv);
    } catch (err) {
        console.error('Error exporting reports CSV:', err);
        return res.status(500).send('Error generating CSV export.');
    }
};

const exportAuditLogsCsv = async (req, res) => {
    try {
        const [logs] = await auditLogModel.listAuditLogs(undefined, []);
        let csv = 'Timestamp,Admin Name,Admin Email,Action,IP Address\r\n';
        for (const log of logs) {
            const time = new Date(log.timestamp).toISOString();
            const name = sanitizeCsvCell(log.admin_name);
            const email = sanitizeCsvCell(log.admin_email);
            const action = sanitizeCsvCell(log.action);
            const ip = sanitizeCsvCell(log.ip_address);
            csv += `${time},${name},${email},${action},${ip}\r\n`;
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="hanap_audit_logs_${new Date().toISOString().slice(0, 10)}.csv"`);
        return res.send(csv);
    } catch (err) {
        console.error('Error exporting audit logs CSV:', err);
        return res.status(500).send('Error generating CSV export.');
    }
};

module.exports = {
    showDashboard,
    showNewReportForm,
    createItemReport,
    showGuestClaimGuide,
    showItemDetails,
    previewOwnershipMatch,
    createClaim,
    cancelClaim,
    listClaims,
    showClaimChat,
    sendClaimMessage,
    updateClaimStatus,
    listMyReports,
    updateItemStatus,
    deleteItemReport,
    showEditItemForm,
    updateItemReport,
    showSettings,
    updateProfile,
    updateSecurity,
    enableMfa,
    disableMfa,
    updateNotificationSettings,
    deleteAccount,
    showAdminDashboard,
    acceptItemCustody,
    listAdminUsers,
    createAdminUser,
    resetUserQuota,
    updateUserRole,
    listHandoverClaims,
    showHandoverClaim,
    confirmHandover,
    rejectHandover,
    showForbiddenPage,
    listAdminReports,
    approveReportArchive,
    batchApproveReportArchive,
    showAdminAnalytics,
    listAuditLogs,
    createAdminItemReport,
    exportReportsCsv,
    exportAuditLogsCsv
};
