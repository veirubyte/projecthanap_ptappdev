document.addEventListener('DOMContentLoaded', () => {
  const assistant = document.getElementById('hanapAssistant');
  if (!assistant) return;

  const panel = document.getElementById('hanapAssistantPanel');
  const toggle = document.getElementById('hanapAssistantToggle');
  const close = document.getElementById('hanapAssistantClose');
  const messagesElement = document.getElementById('hanapAssistantMessages');
  const suggestions = document.getElementById('hanapAssistantSuggestions');
  const form = document.getElementById('hanapAssistantForm');
  const input = document.getElementById('hanapAssistantInput');
  const send = document.getElementById('hanapAssistantSend');
  const conversation = [];

  function setOpen(isOpen) {
    panel.hidden = !isOpen;
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Close HANAP AI Assistant' : 'Open HANAP AI Assistant');
    if (isOpen) {
      input.focus();
    } else {
      toggle.focus();
    }
  }

  function addMessage(text, type) {
    const message = document.createElement('div');
    message.className = `hanap-assistant__message hanap-assistant__message--${type}`;
    message.textContent = text;
    messagesElement.append(message);
    messagesElement.scrollTop = messagesElement.scrollHeight;
    return message;
  }

  async function sendMessage(text) {
    const userText = text.trim();
    if (!userText || send.disabled) return;

    if (suggestions) suggestions.remove();
    addMessage(userText, 'user');
    input.value = '';
    send.disabled = true;
    const pendingMessage = addMessage('Looking for an answer about HANAP...', 'assistant');

    try {
      const requestMessages = [
        ...conversation,
        { role: 'user', text: userText }
      ].slice(-12);
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': assistant.dataset.csrfToken
        },
        body: JSON.stringify({ messages: requestMessages })
      });
      const result = await response.json();
      pendingMessage.remove();

      if (!response.ok) {
        addMessage(result.error || 'The assistant could not respond. Please try again.', 'error');
        return;
      }

      conversation.push(
        { role: 'user', text: userText },
        { role: 'model', text: result.reply }
      );
      addMessage(result.reply, 'assistant');
    } catch (error) {
      pendingMessage.remove();
      addMessage('Unable to reach the assistant. Check your connection and try again.', 'error');
    } finally {
      send.disabled = false;
      input.focus();
    }
  }

  toggle.addEventListener('click', () => setOpen(panel.hidden));
  close.addEventListener('click', () => setOpen(false));

  form.addEventListener('submit', event => {
    event.preventDefault();
    sendMessage(input.value);
  });

  messagesElement.addEventListener('click', event => {
    const promptButton = event.target.closest('[data-assistant-prompt]');
    if (promptButton) sendMessage(promptButton.dataset.assistantPrompt);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) setOpen(false);
  });
});
