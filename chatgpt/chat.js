/* @meta
{
  "name": "chatgpt/chat",
  "description": "Send a prompt to ChatGPT and get the response",
  "domain": "chatgpt.com",
  "args": {
    "prompt": {"required": true, "description": "The prompt to send"},
    "conversation_id": {"required": false, "description": "Conversation ID to continue (omit for new chat)"},
    "model": {"required": false, "description": "Model selector label shown in UI, e.g. 'GPT-4o'"}
  },
  "readOnly": false,
  "example": "bb-browser site chatgpt/chat 'explain quantum computing in 3 sentences'"
}
*/
async function(args) {
  if (!args.prompt) return { error: 'Missing argument: prompt' };

  // Navigate to specific conversation or new chat
  if (args.conversation_id) {
    const targetPath = '/c/' + args.conversation_id;
    if (!window.location.pathname.includes(targetPath)) {
      window.location.href = targetPath;
      await new Promise(r => setTimeout(r, 3000));
      // Wait for page to load
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 500));
        if (document.querySelector('#prompt-textarea')) break;
      }
    }
  } else if (window.location.pathname.match(/\/c\//)) {
    // Currently in a conversation, navigate to new chat
    const newChatBtn = document.querySelector('a[href="/"]');
    if (newChatBtn) {
      newChatBtn.click();
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Wait for input to be ready
  let input = null;
  for (let i = 0; i < 20; i++) {
    input = document.querySelector('#prompt-textarea');
    if (input) break;
    await new Promise(r => setTimeout(r, 500));
  }
  if (!input) return { error: 'ChatGPT input not found', hint: 'Make sure chatgpt.com is open and logged in' };

  // Count existing assistant messages
  const beforeCount = document.querySelectorAll('[data-message-author-role="assistant"]').length;

  // Fill prompt using ProseMirror-compatible method
  input.focus();
  // Clear existing content
  input.innerHTML = '<p>' + args.prompt.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>';
  input.dispatchEvent(new Event('input', { bubbles: true }));

  await new Promise(r => setTimeout(r, 500));

  // Click send button
  let sent = false;
  const sendBtn = document.querySelector('[data-testid="send-button"], button[aria-label="Send prompt"]');
  if (sendBtn && !sendBtn.disabled) {
    sendBtn.click();
    sent = true;
  }

  if (!sent) {
    // Try Enter key
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    sent = true;
  }

  if (!sent) return { error: 'Could not send message' };

  // Wait for response to complete
  let response = null;
  let conversationId = null;
  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 1000));

    // Get conversation ID from URL
    const urlMatch = window.location.pathname.match(/\/c\/([a-f0-9-]+)/);
    if (urlMatch) conversationId = urlMatch[1];

    const msgs = document.querySelectorAll('[data-message-author-role="assistant"]');
    if (msgs.length > beforeCount) {
      // Check if still streaming
      const stopBtn = document.querySelector('[data-testid="stop-button"], button[aria-label="Stop streaming"]');
      if (!stopBtn) {
        // Response complete - get the last assistant message
        const lastMsg = msgs[msgs.length - 1];

        // Extract text from markdown content, excluding thinking blocks
        const md = lastMsg.querySelector('.markdown:not(.result-thinking)');
        if (md) {
          response = md.textContent?.trim();
        } else {
          // Fallback: get all text but exclude known UI elements
          const clone = lastMsg.cloneNode(true);
          clone.querySelectorAll('.result-thinking, button, [class*="feedback"]').forEach(el => el.remove());
          response = clone.textContent?.trim();
        }

        // Clean up common artifacts
        if (response) {
          response = response.replace(/^ChatGPT\s*/, '').replace(/\s*Give feedback\s*$/, '').trim();
        }
        break;
      }
    }
  }

  if (!response && response !== '') {
    return { error: 'Timeout waiting for response', conversation_id: conversationId };
  }

  return {
    prompt: args.prompt,
    response,
    conversation_id: conversationId,
    hint: conversationId ? 'Continue with: bb-browser site chatgpt/chat "your message" --conversation_id ' + conversationId : null
  };
}
