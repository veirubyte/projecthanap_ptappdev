const { generateAssistantReply } = require('../services/geminiAssistant');

const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_LENGTH = 6000;

function validateMessages(messages) {
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
        return null;
    }

    let totalLength = 0;
    const validatedMessages = [];
    for (const message of messages) {
        if (!message || !['user', 'model'].includes(message.role) ||
            typeof message.text !== 'string') {
            return null;
        }

        const text = message.text.trim();
        if (!text || text.length > MAX_MESSAGE_LENGTH) {
            return null;
        }

        totalLength += text.length;
        if (totalLength > MAX_HISTORY_LENGTH) {
            return null;
        }

        validatedMessages.push({ role: message.role, text });
    }

    if (validatedMessages[validatedMessages.length - 1].role !== 'user') {
        return null;
    }

    return validatedMessages;
}

async function chat(req, res) {
    const messages = validateMessages(req.body && req.body.messages);
    if (!messages) {
        return res.status(400).json({ error: 'Send a message under 1,000 characters to continue.' });
    }

    try {
        const reply = await generateAssistantReply(messages);
        return res.json({ reply });
    } catch (error) {
        if (error.code === 'GEMINI_NOT_CONFIGURED') {
            return res.status(503).json({
                error: 'The HANAP assistant is not configured yet. Please contact the system administrator.'
            });
        }
        if (error.code === 'GEMINI_TIMEOUT') {
            return res.status(504).json({ error: 'The assistant took too long to respond. Please try again.' });
        }

        const apiKey = process.env.GEMINI_API_KEY || '';
        const safeMessage = String(error.message || 'Unknown error');
        console.error('HANAP assistant request failed:', {
            code: error.code || 'UNKNOWN',
            status: error.status || null,
            message: apiKey ? safeMessage.split(apiKey).join('[REDACTED]') : safeMessage
        });
        if (error.code === 'GEMINI_AUTH_ERROR') {
            return res.status(502).json({
                error: 'Gemini rejected the API key or this key is not enabled for the Gemini API. Check GEMINI_API_KEY in .env and restart the server.'
            });
        }
        if (error.code === 'GEMINI_MODEL_ERROR') {
            return res.status(502).json({
                error: 'The configured Gemini model was not found. Check GEMINI_MODEL in .env.'
            });
        }
        if (error.code === 'GEMINI_QUOTA_ERROR') {
            return res.status(503).json({
                error: 'The Gemini API quota or rate limit has been reached. Please try again later or check the API project quota.'
            });
        }
        if (error.code === 'GEMINI_PROVIDER_ERROR') {
            return res.status(503).json({
                error: 'Gemini is temporarily unavailable. Please wait a moment and try again.'
            });
        }
        if (error.code === 'GEMINI_NETWORK_ERROR') {
            return res.status(503).json({
                error: 'The server could not connect to Gemini. Check the server internet connection, then try again.'
            });
        }
        if (error.code === 'GEMINI_EMPTY_RESPONSE') {
            return res.status(502).json({
                error: 'Gemini could not provide an answer to that message. Try rephrasing your question.'
            });
        }
        if (error.code === 'GEMINI_REQUEST_ERROR') {
            return res.status(502).json({
                error: 'Gemini rejected the request. Check the configured model and assistant request in the server logs.'
            });
        }
        return res.status(502).json({
            error: 'The assistant could not complete this request. Please try again; if the problem continues, check the server logs.'
        });
    }
}

module.exports = { chat };
