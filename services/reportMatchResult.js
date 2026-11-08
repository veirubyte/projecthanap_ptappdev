const MATCH_CONFIDENCE_THRESHOLD = 80;

function normalizeReportMatchResults(responseText, candidates) {
    let response;
    try {
        response = JSON.parse(responseText);
    } catch (error) {
        throw new Error('The matching service returned invalid JSON.');
    }

    if (!response || !Array.isArray(response.matches)) {
        throw new Error('The matching service returned an invalid result.');
    }

    const candidateIds = new Set(candidates.map((candidate) => Number(candidate.id)));
    const seen = new Set();
    return response.matches
        .map((match) => {
            const candidateId = Number(match && match.reportId);
            const confidence = Number(match && match.confidence);
            const explanation = typeof (match && match.explanation) === 'string'
                ? match.explanation.trim().slice(0, 500)
                : '';
            if (!candidateIds.has(candidateId) || seen.has(candidateId) ||
                !Number.isInteger(confidence) || confidence < MATCH_CONFIDENCE_THRESHOLD ||
                confidence > 100 || !explanation) {
                return null;
            }
            seen.add(candidateId);
            return { reportId: candidateId, confidence, explanation };
        })
        .filter(Boolean);
}

module.exports = {
    MATCH_CONFIDENCE_THRESHOLD,
    normalizeReportMatchResults
};
