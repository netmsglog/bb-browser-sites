/* @meta
{
  "name": "xyq/generate",
  "description": "Submit a video generation task to 小云雀 (Xiao Yunque / Pippit)",
  "domain": "xyq.jianying.com",
  "args": {
    "prompt": {"required": true, "description": "Text prompt describing the video to generate"},
    "model": {"required": false, "description": "Model: 2.0fast (default), 2.0, 2.0fast-vip, 2.0vip, 1.5, agent"},
    "duration": {"required": false, "description": "Video duration in seconds: 5, 10 (default)"},
    "resolution": {"required": false, "description": "Video resolution (agent mode only): 720p_lite (default), 720p, 1080p"}
  },
  "readOnly": false,
  "example": "bb-browser site xyq/generate '一只小猫在草地上奔跑' --model 2.0"
}
*/
async function(args) {
  if (!args.prompt) return { error: 'Missing argument: prompt' };

  const MODEL_MAP = {
    '2.0fast':     'seedance2.0_fast_direct',
    '2.0':         'seedance2.0_direct',
    '2.0fast-vip': 'seedance2.0_fast_vision',
    '2.0vip':      'seedance2.0_vision',
    '1.5':         'seedance1.5_direct',
    'agent':       'agent'
  };

  const modelKey = (args.model || '2.0fast').toLowerCase().replace(/\s+/g, '');
  const modelId = MODEL_MAP[modelKey];
  if (!modelId) return { error: 'Unknown model: ' + args.model, hint: 'Available: 2.0fast, 2.0, 2.0fast-vip, 2.0vip, 1.5, agent' };

  const isAgent = modelId === 'agent';
  const duration = parseInt(args.duration) || 10;
  const resolution = args.resolution || '720p_lite';

  // Step 1: Get user info
  const [acctResp, wsResp] = await Promise.all([
    fetch('/passport/web/account/info/', { credentials: 'include' }),
    fetch('/api/web/v1/workspace/get_user_workspace', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    })
  ]);
  if (!acctResp.ok || !wsResp.ok) return { error: 'Failed to get user info', hint: 'Not logged in? Visit xyq.jianying.com and log in first.' };

  const acctData = await acctResp.json();
  const wsData = await wsResp.json();
  const uid = String(acctData.data.user_id);
  const workspaceId = wsData.data.workspace_id;
  const spaceId = wsData.data.space_id;

  const threadId = crypto.randomUUID();
  const runId = crypto.randomUUID();

  let content, agentName, editType;

  if (isAgent) {
    // Agent mode: natural language, multi-step (image → confirm → video)
    agentName = 'pippit_nest_agent';
    editType = 'integrated_agent';
    content = [{ type: 'text', sub_type: 'text', data: args.prompt }];
    if (resolution !== '720p_lite') {
      content.push({ type: 'data', data: JSON.stringify({ video_resolution: resolution }), sub_type: 'biz/video_settings' });
    }
  } else {
    // Direct video generation (沉浸式短片): single-step
    agentName = 'pippit_video_part_agent';
    editType = 'instant_video';
    content = [{
      type: 'data',
      sub_type: 'biz/x_data_direct_tool_call_req',
      data: JSON.stringify({
        param: JSON.stringify({
          prompt: args.prompt,
          images: [],
          duration_sec: duration,
          language: 'zh',
          imitation_videos: [],
          videos: [],
          audios: [],
          model: modelId
        }),
        tool_name: 'biz/x_tool_name_video_part'
      }),
      hidden: false,
      is_thought: false
    }];
  }

  // Step 2: Submit
  const submitResp = await fetch('/api/biz/v1/agent/submit_run', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        message_id: '',
        role: 'user',
        thread_id: threadId,
        run_id: runId,
        created_at: Date.now(),
        content
      },
      user_info: {
        consumer_uid: uid,
        workspace_id: workspaceId,
        space_id: spaceId,
        app_id: '795647'
      },
      agent_name: agentName,
      entrance_from: 'web',
      run_extra: JSON.stringify({
        client_extra: {
          edit_type: editType,
          position: 'home',
          entrance_from: 'home',
          tab_name: 'other'
        }
      })
    })
  });

  if (!submitResp.ok) return { error: 'Submit failed. HTTP ' + submitResp.status };
  const submitData = await submitResp.json();
  if (submitData.ret !== '0') return { error: submitData.errmsg || 'Submit failed', code: submitData.ret };

  const modelLabel = isAgent ? 'Agent 模式' : modelKey;
  return {
    status: 'submitted',
    thread_id: threadId,
    run_id: runId,
    prompt: args.prompt,
    model: modelLabel,
    duration: isAgent ? null : duration,
    hint: 'Use xyq/status ' + threadId + ' to check progress'
  };
}
