const assert = require('assert');
const path = require('path');
const ejs = require('ejs');
const {
    ANSWER_MATCH_THRESHOLD,
    calculateAnswerMatch,
    parseChallenges,
    calculateMultiAnswerMatch
} = require('../services/answerMatch');

console.log('=== MULTI-QUESTION & LOST-ITEM CLAIM VERIFICATION TEST SUITE ===');

// --- 1. Unit Tests: parseChallenges & Threshold ---
console.log('\n[1] Testing parseChallenges and 75% threshold...');
assert.strictEqual(ANSWER_MATCH_THRESHOLD, 75, 'ANSWER_MATCH_THRESHOLD must be 75%');
assert.deepStrictEqual(parseChallenges('What color?'), ['What color?']);
assert.deepStrictEqual(parseChallenges('["What color?", "What model?"]'), ['What color?', 'What model?']);
assert.deepStrictEqual(parseChallenges('[{"question":"Q1"},{"question":"Q2"}]'), ['Q1', 'Q2']);
assert.deepStrictEqual(parseChallenges('[{"answer":"A1"},{"answer":"A2"}]'), ['A1', 'A2']);
assert.deepStrictEqual(parseChallenges(''), []);
assert.deepStrictEqual(parseChallenges(null), []);
assert.deepStrictEqual(parseChallenges(undefined), []);
assert.deepStrictEqual(parseChallenges(['Q1', 'Q2']), ['Q1', 'Q2']);
console.log('✓ parseChallenges & 75% threshold: All assertions passed.');

// --- 2. Unit Tests: calculateMultiAnswerMatch ---
console.log('\n[2] Testing calculateMultiAnswerMatch...');
// Perfect 2-question match
const match2Exact = calculateMultiAnswerMatch(['Black', 'Casio fx-991EX'], ['Black', 'Casio fx-991EX']);
assert.strictEqual(match2Exact.hasChallenge, true);
assert.strictEqual(match2Exact.score, 100);
assert.strictEqual(match2Exact.meetsThreshold, true);
assert.strictEqual(match2Exact.scores.length, 2);

// Partial match (1 correct, 1 wrong) -> 50% average < 75% threshold
const match2Partial = calculateMultiAnswerMatch(['Black', 'Wrong Answer'], ['Black', 'Casio fx-991EX']);
assert.strictEqual(match2Partial.meetsThreshold, false);
assert.ok(match2Partial.score < 75, `Expected score < 75, got ${match2Partial.score}`);

// 3-question match with minor typos
const match3 = calculateMultiAnswerMatch(
    ['Navy Blue', 'Goku sticker', 'Engineering Building'],
    ['Blue', 'Goku', 'Engineering']
);
assert.strictEqual(match3.hasChallenge, true);
assert.strictEqual(match3.meetsThreshold, true);
assert.ok(match3.score >= 75, `Expected score >= 75, got ${match3.score}`);

// No challenge configured
const matchNone = calculateMultiAnswerMatch('anything', null);
assert.strictEqual(matchNone.hasChallenge, false);
assert.strictEqual(matchNone.score, 100);
assert.strictEqual(matchNone.meetsThreshold, true);
console.log('✓ calculateMultiAnswerMatch: All assertions passed.');

// --- 3. View Compilation & Render: reportItem.ejs ---
console.log('\n[3] Testing reportItem.ejs compilation with multi-question UI...');
const user = {
    id: 1,
    full_name: 'Juan Dela Cruz',
    email: 'test@my.cspc.edu.ph',
    role: 'student',
    student_id: '2023-0001'
};
const reportItemHtml = ejs.render(
    require('fs').readFileSync(path.join(__dirname, '../views/pages/reportItem.ejs'), 'utf8'),
    {
        user,
        categories: ['Electronics', 'Personal Belongings', 'Other'],
        csrfToken: 'test-csrf-token',
        msg: null,
        error: null,
        initialType: 'found'
    },
    { filename: path.join(__dirname, '../views/pages/reportItem.ejs') }
);
assert.ok(reportItemHtml.includes('id="questionsContainer"'), 'Must contain questionsContainer');
assert.ok(reportItemHtml.includes('id="addQuestionBtn"'), 'Must contain addQuestionBtn');
assert.ok(reportItemHtml.includes('name="secret_challenges[]"'), 'Must contain secret_challenges[]');
assert.ok(reportItemHtml.includes('name="secret_answers[]"'), 'Must contain secret_answers[]');
assert.ok(reportItemHtml.includes('toggle-answer-btn'), 'Must contain toggle-answer-btn');
console.log('✓ reportItem.ejs renders dynamic multi-question UI correctly.');

// --- 4. View Compilation & Render: editReport.ejs with multiple existing questions ---
console.log('\n[4] Testing editReport.ejs with 3 pre-configured questions...');
const editReportHtml = ejs.render(
    require('fs').readFileSync(path.join(__dirname, '../views/pages/editReport.ejs'), 'utf8'),
    {
        user,
        item: {
            id: 42,
            item_name: 'Sony Wireless Headphones',
            category: 'Electronics',
            location_found_lost: 'Gym 2F',
            description: 'Black Sony headphones found near bleachers',
            status: 'active',
            report_type: 'found',
            secret_challenge: JSON.stringify(['What color is the pouch?', 'What sticker is on the right cup?']),
            secret_answer: JSON.stringify(['Gray', 'Batman'])
        },
        itemImages: [],
        categories: ['Electronics', 'Personal Belongings', 'Other'],
        challengePairs: [
            { question: 'What color is the pouch?', answer: 'Gray' },
            { question: 'What sticker is on the right cup?', answer: 'Batman' }
        ],
        csrfToken: 'test-csrf-token',
        msg: null,
        error: null
    },
    { filename: path.join(__dirname, '../views/pages/editReport.ejs') }
);
assert.ok(editReportHtml.includes('What color is the pouch?'), 'Must display question 1');
assert.ok(editReportHtml.includes('What sticker is on the right cup?'), 'Must display question 2');
assert.ok(editReportHtml.includes('Gray'), 'Must populate answer 1');
assert.ok(editReportHtml.includes('Batman'), 'Must populate answer 2');
assert.ok(editReportHtml.includes('id="addQuestionBtn"'), 'Must contain addQuestionBtn');
console.log('✓ editReport.ejs renders and pre-fills multiple questions correctly.');

// --- 5. View Compilation & Render: postDetail.ejs for Found Item ---
console.log('\n[5] Testing postDetail.ejs with multi-question verification form (Found Item)...');
const postDetailHtml = ejs.render(
    require('fs').readFileSync(path.join(__dirname, '../views/pages/postDetail.ejs'), 'utf8'),
    {
        user: { id: 2, full_name: 'Maria Santos', role: 'student', email: 'maria@my.cspc.edu.ph' },
        item: {
            id: 42,
            user_id: 1,
            item_name: 'Sony Wireless Headphones',
            category: 'Electronics',
            location_found_lost: 'Gym 2F',
            description: 'Black Sony headphones',
            status: 'active',
            report_type: 'found',
            date_reported: new Date(),
            reporter_name: 'Juan Dela Cruz',
            secret_challenge: JSON.stringify(['What color is the pouch?', 'What sticker is on the right cup?']),
            secret_answer: JSON.stringify(['Gray', 'Batman'])
        },
        challenges: ['What color is the pouch?', 'What sticker is on the right cup?'],
        itemImages: [],
        existingClaim: null,
        hasConfiguredChallenge: true,
        answerMatchScore: null,
        answerMatchThreshold: 75,
        similar: [],
        timeAgo: () => '1 hour ago',
        msg: null,
        error: null
    },
    { filename: path.join(__dirname, '../views/pages/postDetail.ejs') }
);
assert.ok(postDetailHtml.includes('FINDER ASKS (2 QUESTIONS)'), 'Must indicate 2 questions asked by finder');
assert.ok(postDetailHtml.includes('What color is the pouch?'), 'Must show question 1');
assert.ok(postDetailHtml.includes('What sticker is on the right cup?'), 'Must show question 2');
assert.ok(postDetailHtml.includes('name="proof_answers[]"'), 'Must have proof_answers[] inputs for each question');
assert.ok(postDetailHtml.includes('Minimum 75% match required.'), 'Must indicate 75% match requirement');
console.log('✓ postDetail.ejs (Found Item) renders claimant multi-question prompts and 75% threshold correctly.');

// --- 6. View Compilation & Render: postDetail.ejs for Lost Item (Finder Claim) ---
console.log('\n[6] Testing postDetail.ejs for active Lost Item report (Finder Claim)...');
const lostPostDetailHtml = ejs.render(
    require('fs').readFileSync(path.join(__dirname, '../views/pages/postDetail.ejs'), 'utf8'),
    {
        user: { id: 2, full_name: 'Maria Santos', role: 'student', email: 'maria@my.cspc.edu.ph' },
        item: {
            id: 43,
            user_id: 1,
            item_name: 'Blue Lanyard',
            category: 'Personal Belongings',
            location_found_lost: 'Library 1F',
            description: 'CSPC blue lanyard with ID case',
            status: 'active',
            report_type: 'lost',
            date_reported: new Date(),
            reporter_name: 'Juan Dela Cruz',
            secret_challenge: JSON.stringify(['What keychain is attached?']),
            secret_answer: JSON.stringify(['Totoro'])
        },
        challenges: ['What keychain is attached?'],
        itemImages: [],
        existingClaim: null,
        hasConfiguredChallenge: true,
        answerMatchScore: 50,
        answerMatchThreshold: 75,
        similar: [],
        timeAgo: () => '1 hour ago',
        msg: null,
        error: null
    },
    { filename: path.join(__dirname, '../views/pages/postDetail.ejs') }
);
assert.ok(lostPostDetailHtml.includes('Found This Item?'), 'Lost item must show "Found This Item?" heading');
assert.ok(lostPostDetailHtml.includes('OWNER ASKS:'), 'Lost item with challenge must show "OWNER ASKS:"');
assert.ok(lostPostDetailHtml.includes('I Found This — Notify Owner'), 'Lost item must show "I Found This — Notify Owner" button');
assert.ok(lostPostDetailHtml.includes('id="claimSubmitForm"'), 'Lost item must render the active claim form');
assert.ok(lostPostDetailHtml.includes('You can still submit &amp; chat below 75%.'), 'Lost item must explain advisory score below 75%');
console.log('✓ postDetail.ejs (Lost Item) renders finder claim form and advisory score help text.');

// --- 7. View Compilation & Render: claims.ejs with Match Score Badge ---
console.log('\n[7] Testing claims.ejs Match Score badge rendering...');
const claimsHtml = ejs.render(
    require('fs').readFileSync(path.join(__dirname, '../views/pages/claims.ejs'), 'utf8'),
    {
        user,
        receivedClaims: [
            {
                id: 101,
                item_name: 'Blue Lanyard',
                claimant_name: 'Maria Santos',
                status: 'pending',
                proof_details: '[Match Score: 85%] Q1: What keychain?\nA: Totoro',
                created_at: new Date()
            }
        ],
        madeClaims: [],
        timeAgo: () => '5m ago',
        csrfToken: 'test-csrf',
        msg: null,
        error: null
    },
    { filename: path.join(__dirname, '../views/pages/claims.ejs') }
);
assert.ok(claimsHtml.includes('85% Match'), 'claims.ejs must render the extracted 85% Match badge');
console.log('✓ claims.ejs renders Match Score priority badge cleanly.');

console.log('\n=============================================');
console.log('ALL MULTI-QUESTION & LOST-ITEM CLAIM TESTS PASSED!');
console.log('=============================================');
