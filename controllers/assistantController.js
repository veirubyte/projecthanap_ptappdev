const { generateAssistantReply } = require('../services/geminiAssistant');
const { getHanapFallbackReply } = require('../services/hanapFallback');

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
        const apiKey = process.env.GEMINI_API_KEY || '';
        const safeMessage = String(error && error.message || error || 'Unknown error');
        console.error('HANAP assistant request failed:', {
            code: error && error.code || 'UNKNOWN',
            status: error && error.status || null,
            message: apiKey ? safeMessage.split(apiKey).join('[REDACTED]') : safeMessage
        });
        return res.json({
            reply: getHanapFallbackReply(messages)
        });
    }
}

module.exports = { chat };
