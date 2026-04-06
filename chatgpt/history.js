/* @meta
{
  "name": "chatgpt/history",
  "description": "List recent ChatGPT conversations",
  "domain": "chatgpt.com",
  "args": {
    "limit": {"required": false, "description": "Number of conversations to return (default: 20)"}
  },
  "readOnly": true,
  "example": "bb-browser site chatgpt/history"
}
*/
async function(args) {
  const limit = parseInt(args.limit) || 20;

  // Get auth token from session
  const sessResp = await fetch('/api/auth/session', { credentials: 'include' });
  if (!sessResp.ok) return { error: 'Not logged in', hint: 'Log in at chatgpt.com first' };
  const sess = await sessResp.json();
  const token = sess.accessToken;
  if (!token) return { error: 'No access token found' };

  const resp = await fetch('/backend-api/conversations?offset=0&limit=' + limit + '&order=updated', {
    credentials: 'include',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
  });
  if (!resp.ok) return { error: 'HTTP ' + resp.status };

  const data = await resp.json();
  if (!data.items) return { error: 'Unexpected response format' };

  const conversations = data.items.map(c => ({
    id: c.id,
    title: c.title,
    created: c.create_time ? c.create_time.slice(0, 16) : null,
    updated: c.update_time ? c.update_time.slice(0, 16) : null
  }));

  return { conversations, total: data.total, showing: conversations.length };
}
