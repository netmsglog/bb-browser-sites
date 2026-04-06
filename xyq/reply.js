/* @meta
{
  "name": "xyq/reply",
  "description": "Reply to a 小云雀 agent conversation (e.g. confirm video generation)",
  "domain": "xyq.jianying.com",
  "args": {
    "thread_id": {"required": true, "description": "Thread ID from xyq/generate or xyq/status"},
    "message": {"required": false, "description": "Reply message (default: '是')"},
    "resolution": {"required": false, "description": "Video resolution: 720p_lite (default), 720p, 1080p"}
  },
  "readOnly": false,
  "example": "bb-browser site xyq/reply 35b9f585-0bb1-4f16-b567-269437bba97f"
}
*/
async function(args) {
  if (!args.thread_id) return { error: 'Missing argument: thread_id' };

  const message = args.message || '是';
  const resolution = args.resolution || '720p_lite';

  // Get user info
  const [acctResp, wsResp] = await Promise.all([
    fetch('/passport/web/account/info/', { credentials: 'include' }),
    fetch('/api/web/v1/workspace/get_user_workspace', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    })
  ]);
  if (!acctResp.ok || !wsResp.ok) return { error: 'Failed to get user info', hint: 'Not logged in?' };

  const acctData = await acctResp.json();
  const wsData = await wsResp.json();

  const runId = crypto.randomUUID();
  const content = [
    { type: 'text', data: message, sub_type: 'plain/text' },
    { type: 'data', data: JSON.stringify({ video_resolution: resolution }), sub_type: 'biz/video_settings' }
  ];

  const resp = await fetch('/api/biz/v1/agent/submit_run', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        content,
        role: 'user',
        thread_id: args.thread_id,
        run_id: runId,
        created_at: Date.now(),
        message_id: ''
      },
      user_info: {
        consumer_uid: String(acctData.data.user_id),
        workspace_id: wsData.data.workspace_id,
        space_id: wsData.data.space_id,
        app_id: '795647'
      },
      agent_name: 'pippit_nest_agent',
      entrance_from: 'web',
      run_extra: JSON.stringify({
        client_extra: {
          edit_type: 'integrated_agent',
          position: 'home',
          entrance_from: 'home',
          tab_name: 'other',
          is_auto_mode: true
        }
      })
    })
  });

  if (!resp.ok) return { error: 'HTTP ' + resp.status };
  const data = await resp.json();
  if (data.ret !== '0') return { error: data.errmsg || 'Reply failed', code: data.ret };

  return {
    status: 'replied',
    thread_id: args.thread_id,
    run_id: runId,
    message,
    hint: 'Use xyq/status ' + args.thread_id + ' to check progress'
  };
}
