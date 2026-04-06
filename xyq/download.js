/* @meta
{
  "name": "xyq/download",
  "description": "Download generated video from 小云雀",
  "domain": "xyq.jianying.com",
  "args": {
    "thread_id": {"required": true, "description": "Thread ID from xyq/generate or xyq/status"},
    "output": {"required": false, "description": "Output filename (default: <title>.mp4)"}
  },
  "readOnly": true,
  "example": "bb-browser site xyq/download 35b9f585-0bb1-4f16-b567-269437bba97f"
}
*/
async function(args) {
  if (!args.thread_id) return { error: 'Missing argument: thread_id' };

  // Get thread info with entry_list to find artifacts
  const threadResp = await fetch('/api/biz/v1/agent/get_thread', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scopes: ['run_list.entry_list'], thread_id: args.thread_id })
  });
  if (!threadResp.ok) return { error: 'HTTP ' + threadResp.status, hint: 'Not logged in?' };
  const threadData = await threadResp.json();
  if (threadData.ret !== '0') return { error: threadData.errmsg };

  const threadInfo = threadData.data.thread;
  const title = threadInfo.title || 'xyq_video';
  const runs = threadInfo.run_list || [];
  const lastRun = runs[runs.length - 1];

  if (lastRun?.state === 4) return { error: 'Task failed', fail_reason: lastRun.fail_reason };
  if (lastRun?.state === 2 || lastRun?.state === 1) return { error: 'Task still running', hint: 'Check xyq/status first.' };

  // Source 1: Extract video URLs from artifacts (沉浸式短片 direct mode)
  const videos = [];
  for (const run of runs) {
    for (const entry of (run.entry_list || [])) {
      if (entry.type === 2 && entry.artifact) {
        for (const c of (entry.artifact.content || [])) {
          if (c.sub_type === 'biz/x_data_video' && c.data) {
            try {
              const v = JSON.parse(c.data).video;
              if (v?.url) videos.push({ source: 'artifact', download_url: v.url, cover_url: v.cover_url, duration_ms: v.metadata?.duration_ms, width: v.metadata?.width, height: v.metadata?.height });
            } catch(e) {}
          }
        }
      }
    }
  }

  // Source 2: list_thread_file (Agent mode)
  const fileResp = await fetch('/api/biz/v1/agent/list_thread_file', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ thread_id: args.thread_id, PageSize: 300, PageNum: 1, Base: { Client: 'web' } })
  });
  const fileData = await fileResp.json();
  if (fileData.data?.Files) {
    for (const f of fileData.data.Files) {
      const asset = f.Raw?.AgentAsset;
      if (asset?.Video?.download_url) {
        videos.push({ source: 'file', name: asset.Name?.split('/').pop(), download_url: asset.Video.download_url, cover_url: asset.Video.cover_url });
      }
    }
  }

  if (videos.length === 0) return { error: 'No video found', hint: 'Video may still be generating. Check xyq/status first.' };

  const video = videos[0];
  const safeTitle = title.replace(/[\/\\:*?"<>|]/g, '_');
  const filename = args.output || (safeTitle + '.mp4');

  return {
    status: 'ready',
    title,
    video: {
      download_url: video.download_url,
      cover_url: video.cover_url,
      duration_ms: video.duration_ms,
      resolution: video.width && video.height ? video.width + 'x' + video.height : undefined
    },
    total_videos: videos.length,
    download_cmd: 'curl -L -o "' + filename + '" "' + video.download_url + '"'
  };
}
