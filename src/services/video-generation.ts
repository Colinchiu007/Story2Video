import { supabase } from '@/db/supabase';
import type { VideoTask, CreateMode } from '@/types';
import {
  getVideoProvider,
  getJimengApiKey,
  getViduApiKey,
  invokeFunction,
  extractErrorMessage,
} from './api-config';

export async function createVideoTask(params: {
  mode: CreateMode;
  prompt: string;
  size?: string;
  seconds?: number;
  audioUrl?: string;
  inputReferenceUrl?: string;
  remixSourceId?: string;
  parentId?: string;
  segmentIndex?: number;
  totalSegments?: number;
  segmentText?: string;
}): Promise<VideoTask> {
  const { data, error } = await supabase
    .from('video_tasks')
    .insert({
      mode: params.mode,
      prompt: params.prompt,
      size: params.size ?? '720x1280',
      seconds: params.seconds ?? 8,
      audio_url: params.audioUrl ?? null,
      input_reference_url: params.inputReferenceUrl ?? null,
      remix_source_id: params.remixSourceId ?? null,
      parent_id: params.parentId ?? null,
      segment_index: params.segmentIndex ?? 0,
      total_segments: params.totalSegments ?? 1,
      segment_text: params.segmentText ?? null,
      status: 'pending',
      progress: 0,
    })
    .select()
    .single();
  if (error) throw new Error(extractErrorMessage(error));
  return data as VideoTask;
}

export async function listChildTasks(parentId: string): Promise<VideoTask[]> {
  const { data, error } = await supabase
    .from('video_tasks')
    .select('*')
    .eq('parent_id', parentId)
    .order('segment_index', { ascending: true });
  if (error) throw new Error(extractErrorMessage(error));
  return Array.isArray(data) ? (data as VideoTask[]) : [];
}

export async function updateVideoTask(
  id: string,
  updates: Partial<VideoTask>,
): Promise<VideoTask> {
  const { data, error } = await supabase
    .from('video_tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(extractErrorMessage(error));
  return data as VideoTask;
}

export async function getVideoTask(id: string): Promise<VideoTask | null> {
  const { data, error } = await supabase
    .from('video_tasks')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(extractErrorMessage(error));
  return data as VideoTask | null;
}

export async function listVideoTasks(limit = 50): Promise<VideoTask[]> {
  const { data, error } = await supabase
    .from('video_tasks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(extractErrorMessage(error));
  return Array.isArray(data) ? (data as VideoTask[]) : [];
}

export async function deleteVideoTask(taskId: string): Promise<void> {
  const { data: children } = await supabase
    .from('video_tasks')
    .select('id')
    .eq('parent_id', taskId);
  if (children && children.length > 0) {
    const childIds = children.map((c) => c.id);
    const { error: childErr } = await supabase.from('video_tasks').delete().in('id', childIds);
    if (childErr) throw new Error(extractErrorMessage(childErr));
  }
  const { error } = await supabase.from('video_tasks').delete().eq('id', taskId);
  if (error) throw new Error(extractErrorMessage(error));
}

export async function startTextToVideo(params: {
  prompt: string;
  size?: string;
  seconds?: number;
}): Promise<{ videoId: string; status: string }> {
  const provider = getVideoProvider();
  const jimengKey = getJimengApiKey();
  const viduKey = getViduApiKey();

  let functionName: string;
  const body: Record<string, unknown> = {
    prompt: params.prompt,
    size: params.size ?? '720x1280',
    seconds: params.seconds ?? 8,
    mode: 'text-to-video',
  };

  if (provider === 'kling') {
    functionName = 'kling-create-video';
  } else if (provider === 'vidu' && viduKey) {
    functionName = 'vidu-create-video';
    body.vidu_api_key = viduKey;
  } else if (jimengKey) {
    functionName = 'jimeng-create-video';
    body.jimeng_api_key = jimengKey;
  } else {
    functionName = 'sora-create-video';
  }

  const data = await invokeFunction(functionName, body) as { videoId?: string; status?: string };
  if (!data.videoId) throw new Error('未返回视频任务ID');
  return { videoId: data.videoId, status: data.status ?? 'pending' };
}

export async function startImageToVideo(params: {
  prompt: string;
  inputReferenceUrl?: string;
  size?: string;
}): Promise<{ videoId: string; status: string }> {
  const provider = getVideoProvider();
  const jimengKey = getJimengApiKey();
  const viduKey = getViduApiKey();

  let functionName: string;
  const body: Record<string, unknown> = {
    prompt: params.prompt,
    input_reference_url: params.inputReferenceUrl,
    size: params.size ?? '720x1280',
    mode: 'image-to-video',
  };

  if (provider === 'kling') {
    functionName = 'kling-create-video';
  } else if (provider === 'vidu' && viduKey) {
    functionName = 'vidu-create-video';
    body.vidu_api_key = viduKey;
  } else if (jimengKey) {
    functionName = 'jimeng-create-video';
    body.jimeng_api_key = jimengKey;
  } else {
    functionName = 'sora-video-from-reference';
  }

  const data = await invokeFunction(functionName, body) as { videoId?: string; status?: string };
  if (!data.videoId) throw new Error('未返回视频任务ID');
  return { videoId: data.videoId, status: data.status ?? 'pending' };
}

export async function startRemixVideo(params: {
  videoId?: string;
  videoUrl?: string;
  prompt: string;
}): Promise<{ videoId: string; status: string }> {
  const jimengKey = getJimengApiKey();
  if (jimengKey) {
    throw new Error('即梦 API 暂不支持视频续写/Remix 功能');
  }
  const body: Record<string, unknown> = { prompt: params.prompt };
  if (params.videoId) {
    body.video_id = params.videoId;
  }
  if (params.videoUrl) {
    body.video_url = params.videoUrl;
  }
  const data = await invokeFunction('sora-remix-video', body) as { videoId?: string; status?: string };
  if (!data.videoId) throw new Error('未返回视频任务ID');
  return { videoId: data.videoId, status: data.status ?? 'pending' };
}

export async function queryVideoGeneration(videoId: string): Promise<{
  status: string;
  progress: number;
  video_url?: string;
  publicUrl?: string;
  error?: string | null;
}> {
  const provider = getVideoProvider();
  const jimengKey = getJimengApiKey();
  const viduKey = getViduApiKey();

  let functionName: string;
  const body: Record<string, unknown> = { video_id: videoId };

  if (provider === 'kling') {
    functionName = 'kling-query-video';
  } else if (provider === 'vidu' && viduKey) {
    functionName = 'vidu-query-video';
    body.vidu_api_key = viduKey;
  } else if (jimengKey) {
    functionName = 'jimeng-query-video';
    body.jimeng_api_key = jimengKey;
    body.videoId = videoId;
  } else {
    functionName = 'sora-query-video';
  }

  return await invokeFunction(functionName, body) as {
    status: string;
    progress: number;
    video_url?: string;
    publicUrl?: string;
    error?: string | null;
  };
}
