import { supabase } from '@/db/supabase';
import type { VideoTask, CreateMode, UserVoice } from '@/types';

function extractErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
    if (typeof obj.msg === 'string') return obj.msg;
    try {
      return JSON.stringify(obj);
    } catch {
      return '未知错误';
    }
  }
  return '未知错误';
}

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

export async function listVideoTasks(limit = 20): Promise<VideoTask[]> {
  const { data, error } = await supabase
    .from('video_tasks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(extractErrorMessage(error));
  return Array.isArray(data) ? (data as VideoTask[]) : [];
}

async function invokeFunction(name: string, body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const msg = extractErrorMessage(error);
    console.error(`Edge Function ${name} error:`, error);
    throw new Error(msg);
  }
  if (!data) throw new Error('服务端未返回数据');
  return data;
}

export async function generateTTS(params: {
  text: string;
  voiceId?: string;
  model?: string;
  speed?: number;
  vol?: number;
  pitch?: number;
  emotion?: string;
}): Promise<{ audioUrl: string; audioLength: number }> {
  const body: Record<string, unknown> = {
    text: params.text,
    voice_id: params.voiceId ?? 'male-qn-qingse',
    model: params.model ?? 'speech-02-turbo',
  };
  if (params.speed !== undefined) body.speed = params.speed;
  if (params.vol !== undefined) body.vol = params.vol;
  if (params.pitch !== undefined) body.pitch = params.pitch;
  if (params.emotion) body.emotion = params.emotion;

  const data = await invokeFunction('tts-minimax', body) as { audioUrl?: string; audioLength?: number };
  if (!data.audioUrl) throw new Error('未返回音频 URL');
  return { audioUrl: data.audioUrl, audioLength: data.audioLength ?? 0 };
}

export async function startTextToVideo(params: {
  prompt: string;
  size?: string;
  seconds?: number;
}): Promise<{ videoId: string; status: string }> {
  const data = await invokeFunction('sora-create-video', {
    prompt: params.prompt,
    size: params.size ?? '720x1280',
    seconds: params.seconds ?? 8,
  }) as { videoId?: string; status?: string };
  if (!data.videoId) throw new Error('未返回视频任务ID');
  return { videoId: data.videoId, status: data.status ?? 'pending' };
}

export async function startImageToVideo(params: {
  prompt: string;
  inputReferenceUrl: string;
  size?: string;
}): Promise<{ videoId: string; status: string }> {
  const data = await invokeFunction('sora-video-from-reference', {
    prompt: params.prompt,
    input_reference_url: params.inputReferenceUrl,
    size: params.size ?? '720x1280',
  }) as { videoId?: string; status?: string };
  if (!data.videoId) throw new Error('未返回视频任务ID');
  return { videoId: data.videoId, status: data.status ?? 'pending' };
}

export async function startRemixVideo(params: {
  videoId: string;
  prompt: string;
}): Promise<{ videoId: string; status: string }> {
  const data = await invokeFunction('sora-remix-video', {
    video_id: params.videoId,
    prompt: params.prompt,
  }) as { videoId?: string; status?: string };
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
  return await invokeFunction('sora-query-video', { video_id: videoId }) as {
    status: string;
    progress: number;
    video_url?: string;
    publicUrl?: string;
    error?: string | null;
  };
}

export async function cloneVoice(params: {
  name: string;
  description?: string;
  audioUrl: string;
  language?: string;
  duration?: number;
}): Promise<{ id: string; status: string; voiceId?: string; message: string }> {
  const data = await invokeFunction('clone-voice', {
    name: params.name,
    description: params.description ?? '',
    audioUrl: params.audioUrl,
    language: params.language ?? 'Chinese',
    duration: params.duration,
  }) as { id: string; status: string; voiceId?: string; message: string };
  return data;
}

export async function getUserVoices(): Promise<UserVoice[]> {
  const { data, error } = await supabase
    .from('user_voices')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(extractErrorMessage(error));
  return Array.isArray(data) ? (data as UserVoice[]) : [];
}

export async function deleteUserVoice(id: string): Promise<void> {
  const { error } = await supabase.from('user_voices').delete().eq('id', id);
  if (error) throw new Error(extractErrorMessage(error));
}
