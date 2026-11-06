/**
 * Project HANAP - Campus Match Engine & Answer Verification Service
 * 
 * Implements algorithmic confidence scoring between a claimant's submitted proof
 * and a finder's secret challenge answer for recovered property.
 * 
 * Uses a hybrid scoring model combining:
 * 1. String Normalization (Unicode NFKC, punctuation removal, whitespace collapsing)
 * 2. Token-Based Jaccard Overlap (handles word order permutations & descriptive phrasing)
 * 3. Space-Optimized Levenshtein Edit Distance (Wagner-Fischer algorithm for typo tolerance)
 */

/**
 * Minimum confidence score required (0-100%) for a claimant to bypass the
 * anti-fraud barrier and submit an official ownership claim.
 */
const ANSWER_MATCH_THRESHOLD = 80;

/**
 * Normalizes input strings to ensure fair, case-insensitive, and accent-insensitive comparison.
 * 
 * Transformations applied:
 * - Unicode NFKC normalization (replaces composed/decomposed glyphs and full-width forms)
 * - Lowercase folding
 * - Punctuation and symbol removal (replaces non-alphanumeric unicode characters with spaces)
 * - Multi-space collapsing and edge trimming
 * 
 * @param {string} answer - Raw string to normalize
 * @returns {string} Cleaned alphanumeric token string
 */
function normalizeAnswer(answer) {
    return answer
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Evaluates the confidence score between a user's submitted answer and the expected secret answer.
 * 
 * Evaluation Pipeline:
 * 1. Validation: If no valid challenge answer exists, returns null (no threshold restriction).
 * 2. Normalization: Normalizes both inputs via normalizeAnswer().
 * 3. Fast-Path: Returns 100% immediately if identical or if user answer contains the exact expected phrase.
 * 4. Token Overlap Scoring: Measures what percentage of expected words appear in the user's answer.
 * 5. Character Levenshtein Distance: Calculates edit distance with an O(min(M,N)) space-optimized DP table.
 * 6. Score Fusion: Selects the maximum of token and character similarity, rounded to the nearest integer.
 * 
 * @param {string} userAnswer - The proof of ownership provided by the claimant
 * @param {string} secretAnswer - The private answer set by the finder
 * @returns {number|null} Match confidence percentage from 0 to 100, or null if no challenge is set
 */
function calculateAnswerMatch(userAnswer, secretAnswer) {
    // Return null if no secret answer exists (item does not require challenge verification)
    if (typeof userAnswer !== 'string' || typeof secretAnswer !== 'string' || !secretAnswer.trim()) {
        return null;
    }

    const user = normalizeAnswer(userAnswer);
    const expected = normalizeAnswer(secretAnswer);

    // If either string is empty after normalization, confidence is 0%
    if (!user || !expected) return 0;

    // Fast-path: Exact match or user statement contains the full expected answer (e.g. "It's a blue hydroflask" contains "blue hydroflask")
    if (user === expected || user.includes(expected)) {
        return 100;
    }

    // -------------------------------------------------------------------------
    // Method 1: Token-based Set Overlap
    // Useful for descriptive answers where words may appear in different order
    // (e.g., expected "Casio Black fx-991EX", user submitted "Black Casio fx-991EX calculator")
    // -------------------------------------------------------------------------
    const expectedTokens = expected.split(' ').filter(Boolean);
    const userTokens = new Set(user.split(' ').filter(Boolean));
    const tokenScore = expectedTokens.length
        ? (expectedTokens.filter((token) => userTokens.has(token)).length / expectedTokens.length) * 100
        : 0;

    // -------------------------------------------------------------------------
    // Method 2: Levenshtein Edit Distance (Wagner-Fischer Dynamic Programming)
    // Uses 2 rolling rows (previousRow, currentRow) for O(N) memory efficiency
    // Accounts for minor typos, misspellings, or phonetic approximations
    // -------------------------------------------------------------------------
    let previousRow = Array.from({ length: expected.length + 1 }, (_, index) => index);
    for (let userIndex = 1; userIndex <= user.length; userIndex++) {
        const currentRow = [userIndex];
        for (let expectedIndex = 1; expectedIndex <= expected.length; expectedIndex++) {
            // Cost is 0 if characters match, 1 if substitution is required
            const substitutionCost = user[userIndex - 1] === expected[expectedIndex - 1] ? 0 : 1;
            currentRow[expectedIndex] = Math.min(
                currentRow[expectedIndex - 1] + 1, // Insertion
                previousRow[expectedIndex] + 1,     // Deletion
                previousRow[expectedIndex - 1] + substitutionCost // Substitution
            );
        }
        previousRow = currentRow;
    }

    // Convert edit distance into a normalized percentage (0 - 100%)
    const maxLength = Math.max(user.length, expected.length);
    const characterScore = maxLength
        ? (1 - previousRow[expected.length] / maxLength) * 100
        : 0;

    // Return the highest confidence score between token overlap and character edit similarity
    return Math.round(Math.max(tokenScore, characterScore));
}

/**
 * Safely parses raw challenge or answer column value from database or form into an array of strings.
 * Supports:
 * - Plain string: "What color is it?" -> ["What color is it?"]
 * - JSON string array: '["Question 1", "Question 2"]' -> ["Question 1", "Question 2"]
 * - JSON object array: '[{"question":"Q1"},{"question":"Q2"}]' -> ["Q1", "Q2"]
 * - Null/empty/undefined -> []
 * 
 * @param {string|Array} raw 
 * @returns {string[]}
 */
function parseChallenges(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) {
        return raw.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
    }
    if (typeof raw !== 'string') return [];
    const trimmed = raw.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed.map((item) => {
                    if (typeof item === 'string') return item.trim();
                    if (item && typeof item === 'object') {
                        if (typeof item.question === 'string') return item.question.trim();
                        if (typeof item.answer === 'string') return item.answer.trim();
                    }
                    return '';
                }).filter(Boolean);
            }
        } catch (_) {}
    }
    return [trimmed];
}

/**
 * Evaluates match confidence across one or more challenge questions.
 * Computes individual scores per question and aggregates into an overall average score.
 * 
 * @param {string|string[]} userAnswers - Answer(s) submitted by the claimant
 * @param {string|string[]} secretAnswers - Expected secret answer(s)
 * @returns {{ score: number, meetsThreshold: boolean, scores: number[], threshold: number, hasChallenge: boolean }}
 */
function calculateMultiAnswerMatch(userAnswers, secretAnswers) {
    const expectedList = Array.isArray(secretAnswers)
        ? secretAnswers.map((a) => (typeof a === 'string' ? a.trim() : '')).filter(Boolean)
        : parseChallenges(secretAnswers);

    if (expectedList.length === 0) {
        return {
            hasChallenge: false,
            score: 100,
            meetsThreshold: true,
            scores: [],
            threshold: ANSWER_MATCH_THRESHOLD
        };
    }

    const claimantList = Array.isArray(userAnswers)
        ? userAnswers.map((a) => (typeof a === 'string' ? a.trim() : ''))
        : [typeof userAnswers === 'string' ? userAnswers.trim() : ''];

    const scores = expectedList.map((expected, idx) => {
        const claimantAnswer = claimantList[idx] || '';
        const singleScore = calculateAnswerMatch(claimantAnswer, expected);
        return singleScore !== null ? singleScore : 0;
    });

    const averageScore = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);

    return {
        hasChallenge: true,
        score: averageScore,
        meetsThreshold: averageScore >= ANSWER_MATCH_THRESHOLD,
        scores,
        threshold: ANSWER_MATCH_THRESHOLD
    };
}

module.exports = {
    ANSWER_MATCH_THRESHOLD,
    calculateAnswerMatch,
    parseChallenges,
    calculateMultiAnswerMatch
};

