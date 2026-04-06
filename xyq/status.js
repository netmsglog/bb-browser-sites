/* @meta
{
  "name": "xyq/status",
  "description": "Check the status of a 小云雀 video generation task",
  "domain": "xyq.jianying.com",
  "args": {
    "thread_id": {"required": true, "description": "Thread ID returned by xyq/generate"}
  },
  "readOnly": true,
  "example": "bb-browser site xyq/status 35b9f585-0bb1-4f16-b567-269437bba97f"
}
*/
async function(args) {
  if (!args.thread_id) return { error: 'Missing argument: thread_id' };

  // Get thread state
  const threadResp = await fetch('/api/biz/v1/agent/get_thread', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scopes: ['run_list.entry_list'], thread_id: args.thread_id })
  });
  if (!threadResp.ok) return { error: 'HTTP ' + threadResp.status, hint: 'Not logged in?' };
  const threadData = await threadResp.json();
  if (threadData.ret !== '0') return { error: threadData.errmsg || 'Failed', code: threadData.ret };

  const thread = threadData.data.thread;
  const runs = thread.run_list || [];
  const lastRun = runs[runs.length - 1];

  // state: 1=submitted, 2=running, 3=completed, 4=failed, 5=cancelled
  const stateMap = { 1: 'submitted', 2: 'running', 3: 'completed', 4: 'failed', 5: 'cancelled' };
  const state = lastRun ? stateMap[lastRun.state] || ('unknown_' + lastRun.state) : 'unknown';

  // Extract messages and artifacts from entries
  const messages = [];
  const artifacts = [];
  for (const run of runs) {
    if (!run.entry_list) continue;
    for (const entry of run.entry_list) {
      if (entry.type === 1 && entry.message) {
        const msg = entry.message;
        // Text messages
        const texts = (msg.content || []).filter(c => c.type === 'text' && !c.is_thought).map(c => c.data);
        if (texts.length > 0) {
          messages.push({ role: msg.role, text: texts.join('\n') });
        }
        // Error messages in content
        for (const c of (msg.content || [])) {
          if (c.type === 'error' || c.sub_type === 'biz/x_data_error' || (c.type === 'text' && c.data && c.data.includes('遇到了一些问题'))) {
            messages.push({ role: 'error', text: c.data });
          }
        }
      }
      // Artifact entries (type=2) contain generated videos
      if (entry.type === 2 && entry.artifact) {
        const art = entry.artifact;
        for (const c of (art.content || [])) {
          if (c.sub_type === 'biz/x_data_video' && c.data) {
            try {
              const videoData = JSON.parse(c.data);
              const v = videoData.video;
              if (v) {
                artifacts.push({
                  type: 'video',
                  artifact_id: art.artifact_id,
                  download_url: v.url || v.download_url,
                  cover_url: v.cover_url,
                  duration_ms: v.metadata?.duration_ms,
                  width: v.metadata?.width,
                  height: v.metadata?.height
                });
              }
            } catch(e) {}
          }
        }
      }
    }
  }

  // Also check list_thread_file for Agent mode files
  const files = [];
  const fileResp = await fetch('/api/biz/v1/agent/list_thread_file', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ thread_id: args.thread_id, PageSize: 300, PageNum: 1, Base: { Client: 'web' } })
  });
  const fileData = await fileResp.json();

  if (fileData.data && fileData.data.Files) {
    for (const f of fileData.data.Files) {
      const asset = f.Raw?.AgentAsset;
      if (!asset) continue;
      if (asset.Video?.download_url) {
        files.push({ type: 'video', id: f.ID, name: asset.Name?.split('/').pop(), download_url: asset.Video.download_url, cover_url: asset.Video.cover_url });
      } else if (asset.Image?.url) {
        files.push({ type: 'image', id: f.ID, name: asset.Name?.split('/').pop(), url: asset.Image.url });
      }
    }
  }

  // Merge: artifacts (from direct video mode) + files (from agent mode)
  const allVideos = [
    ...artifacts.filter(a => a.download_url),
    ...files.filter(f => f.type === 'video')
  ];
  const hasVideo = allVideos.length > 0;

  // Detect failure: state completed but no video and fail_reason present, or error messages
  const isFailed = state === 'failed' || lastRun?.fail_reason ||
    messages.some(m => m.role === 'error');
  const failReason = lastRun?.fail_reason ||
    messages.filter(m => m.role === 'error').map(m => m.text).join('; ') || null;

  // Check if agent is waiting for user input
  const lastMsg = messages.filter(m => m.role !== 'error').slice(-1)[0];
  const needsInput = state === 'completed' && !hasVideo && lastMsg?.role === 'assistant' &&
    (lastMsg.text.includes('?') || lastMsg.text.includes('？'));

  const effectiveState = isFailed ? 'failed' : state;

  return {
    thread_id: args.thread_id,
    title: thread.title,
    state: effectiveState,
    run_id: lastRun?.run_id,
    fail_reason: failReason,
    messages: messages.filter(m => m.role !== 'error').slice(-4),
    videos: allVideos,
    files: files.filter(f => f.type === 'image'),
    needs_input: needsInput,
    hint: isFailed ? 'Task failed. Try again with xyq/generate.' :
          needsInput ? 'Agent is waiting for input. Use xyq/reply to respond.' :
          hasVideo ? 'Video ready! Use xyq/download to save it.' :
          state === 'running' ? 'Still generating... check again in a minute.' : null
  };
}
