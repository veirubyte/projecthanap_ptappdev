const { GoogleGenAI } = require('@google/genai');

const SYSTEM_INSTRUCTION = [
    'You are the HANAP AI Assistant for the Project HANAP campus lost-and-found system at Camarines Sur Polytechnic Colleges.',
    'Help users with common questions about using the system, such as browsing items, reporting lost or found property, submitting ownership claims, messaging about handover, and contacting campus security.',
    'Give clear, concise, friendly answers. Do not claim to know a specific campus policy, office hours, item listing, claim status, or account detail unless it is provided in the conversation. When unsure, say so and direct the user to the official CSPC office or system administrator.',
    'You cannot access the database, accounts, reports, claims, or private conversations. Never imply that you have checked or changed a record.',
    'Do not ask users to send passwords, verification answers, identity documents, full contact details, or other sensitive information in chat.'
].join(' ');

const REQUEST_TIMEOUT_MS = 120000;
const NETWORK_ERROR_CODES = new Set([
    'ECONNRESET',
    'ECONNREFUSED',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'EAI_AGAIN',
    'ETIMEDOUT',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_HEADERS_TIMEOUT',
    'UND_ERR_SOCKET'
]);

async function generateAssistantReply(messages) {
    const apiKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim();
    if (!apiKey) {
        const error = new Error('GEMINI_API_KEY is not configured.');
        error.code = 'GEMINI_NOT_CONFIGURED';
        throw error;
    }

    const model = process.env.GEMINI_MODEL && process.env.GEMINI_MODEL.trim()
        ? process.env.GEMINI_MODEL.trim()
        : 'gemini-3.8-flash';
    const ai = new GoogleGenAI({ apiKey });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await ai.models.generateContent({
            model,
            contents: messages.map(message => ({
                role: message.role,
                parts: [{ text: message.text }]
            })),
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                maxOutputTokens: 350,
                temperature: 0.4,
                thinkingConfig: {
                    thinkingLevel: 'low'
                },
                httpOptions: {
                    timeout: REQUEST_TIMEOUT_MS,
                    retryOptions: { attempts: 1 }
                },
                abortSignal: controller.signal
            }
        });

        const reply = response.text && response.text.trim();
        if (!reply) {
            const error = new Error('Gemini returned no text response.');
            error.code = 'GEMINI_EMPTY_RESPONSE';
            throw error;
        }

        return reply;
    } catch (error) {
        if (error.name === 'AbortError') {
            const timeoutError = new Error('Gemini request timed out.');
            timeoutError.code = 'GEMINI_TIMEOUT';
            throw timeoutError;
        }

        const status = Number(error.status || error.response?.status);
        if (status) {
            error.status = status;
            error.code = status === 401 || status === 403
                ? 'GEMINI_AUTH_ERROR'
                : status === 404
                    ? 'GEMINI_MODEL_ERROR'
                    : status === 429
                        ? 'GEMINI_QUOTA_ERROR'
                        : status >= 500
                            ? 'GEMINI_PROVIDER_ERROR'
                            : 'GEMINI_REQUEST_ERROR';
        } else if (NETWORK_ERROR_CODES.has(error.code) || NETWORK_ERROR_CODES.has(error.cause?.code)) {
            error.code = 'GEMINI_NETWORK_ERROR';
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

module.exports = { generateAssistantReply };
