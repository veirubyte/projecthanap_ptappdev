const assert = require('assert');
const { normalizeReportMatchResults } = require('../services/reportMatchResult');
const { getHanapFallbackReply } = require('../services/hanapFallback');

const candidates = [{ id: 10 }, { id: 11 }, { id: 12 }];
const matches = normalizeReportMatchResults(JSON.stringify({
    matches: [
        { reportId: 10, confidence: 80, explanation: 'The photos show the same distinctive case.' },
        { reportId: 11, confidence: 79, explanation: 'The category is the same.' },
        { reportId: 12, confidence: 95, explanation: 'A likely visual match.' },
        { reportId: 99, confidence: 99, explanation: 'Unknown report.' },
        { reportId: 10, confidence: 99, explanation: 'Duplicate report.' }
    ]
}), candidates);

assert.deepStrictEqual(matches, [
    { reportId: 10, confidence: 80, explanation: 'The photos show the same distinctive case.' },
    { reportId: 12, confidence: 95, explanation: 'A likely visual match.' }
], 'Only unique, known candidates at or above the confidence threshold should be saved.');

assert.throws(
    () => normalizeReportMatchResults('not json', candidates),
    /invalid JSON/,
    'Malformed model output should be rejected.'
);

const assistantReply = getHanapFallbackReply([
    { role: 'user', text: 'How does AI match active Lost and Found posts?' }
]);
assert.ok(assistantReply.includes('photos, category, and campus location'));
assert.ok(assistantReply.includes('both report owners'));
assert.ok(assistantReply.includes('ownership claim'));

console.log('PASS: AI matching accepts only unique high-confidence active candidate IDs.');
console.log('PASS: Assistant explains shared lost/found match results and verification.');
