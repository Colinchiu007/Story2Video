import { supabase } from '@/db/supabase';
import type { VideoTask, CreateMode, UserVoice, GalleryImage } from '@/types';
import { getActiveProfile, getJimengApiKey as getStoredJimengApiKey, getDoubaoApiKey as getStoredDoubaoApiKey } from '@/components/ApiSettingsDialog';

/** 从远程URL下载图片并上传到Supabase Storage */
async function uploadRemoteImageToStorage(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`下载图片失败: ${response.status}`);
  }
  const blob = await response.blob();
  const contentType = blob.type || 'image/png';
  const ext = contentType.includes('jpg') || contentType.includes('jpeg') ? 'jpg' : 'png';
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('generated-videos')
    .upload(`uploads/${fileName}`, blob, {
      contentType,
      cacheControl: 'no-cache',
      upsert: false,
    });
  if (error) {
    throw new Error(`上传图片失败: ${error.message}`);
  }
  const { data: urlData } = supabase.storage.from('generated-videos').getPublicUrl(`uploads/${fileName}`);
  return urlData.publicUrl;
}

export interface CustomApiConfig {
  apiBaseUrl: string;
  apiKey: string;
  modelName: string;
}

function getCustomApiConfig(): CustomApiConfig | null {
  const p = getActiveProfile('llm');
  if (p?.apiBaseUrl && p.apiKey && p.modelName) {
    const url = p.apiBaseUrl.trim();
    if (url.includes('example.com') || url.includes('placeholder') || url.includes('localhost')) {
      return null;
    }
    return { apiBaseUrl: url, apiKey: p.apiKey.trim(), modelName: p.modelName.trim() };
  }
  // 向下兼容旧格式
  const stored = localStorage.getItem('api_config');
  if (!stored) return null;
  try {
    const cfg = JSON.parse(stored) as { aiSource: string; apiBaseUrl?: string; apiKey?: string; modelName?: string };
    if (cfg.aiSource === 'custom' && cfg.apiBaseUrl && cfg.apiKey && cfg.modelName) {
      const url = cfg.apiBaseUrl.trim();
      if (url.includes('example.com') || url.includes('placeholder') || url.includes('localhost')) {
        return null;
      }
      return { apiBaseUrl: url, apiKey: cfg.apiKey.trim(), modelName: cfg.modelName.trim() };
    }
  } catch { /* ignore */ }
  return null;
}

function getJimengApiKey(): string | null {
  return getStoredJimengApiKey();
}

function getViduApiKey(): string | null {
  const p = getActiveProfile('video') ?? getActiveProfile('image');
  return p?.apiKey?.trim() || null;
}

function getSenseNovaApiKey(): string | null {
  const p = getActiveProfile('image');
  if (p?.provider === 'sensenova') {
    return p.apiKey?.trim() || null;
  }
  return null;
}

function readModelConfig(): { video?: { provider?: string; source?: string }; image?: { provider?: string; source?: string } } {
  const stored = localStorage.getItem('api_config');
  if (!stored) return {};
  try {
    return (JSON.parse(stored) as { modelConfig?: { video?: { provider?: string; source?: string }; image?: { provider?: string; source?: string } } }).modelConfig || {};
  } catch { /* ignore */ }
  return {};
}

function getVideoProvider(): string {
  const mcfg = readModelConfig();
  const p = getActiveProfile('video');
  return p?.provider || mcfg.video?.provider || 'jimeng';
}

function getImageProvider(): string {
  const mcfg = readModelConfig();
  const p = getActiveProfile('image');
  return p?.provider || mcfg.image?.provider || 'kling';
}

function getImageSource(): string {
  const stored = localStorage.getItem('api_config');
  if (!stored) return 'builtin';
  try {
    const cfg = JSON.parse(stored) as { modelConfig?: { image?: { source?: string } } };
    return cfg.modelConfig?.image?.source || 'builtin';
  } catch { /* ignore */ }
  return 'builtin';
}

export function useJimengForVideo(): boolean {
  return getVideoProvider() === 'jimeng' && !!getJimengApiKey();
}

export function useViduForVideo(): boolean {
  return getVideoProvider() === 'vidu';
}

export function useKlingForVideo(): boolean {
  return getVideoProvider() === 'kling';
}

export function useViduForImage(): boolean {
  return getImageProvider() === 'vidu';
}

export function useKlingForImage(): boolean {
  return getImageProvider() === 'kling';
}

/** 检查图片生成功能是否可用
 * 支持的模型：可灵(内置)、即梦(回退可灵)、Vidu(自定义API)、商汤SenseNova(自定义API)
 */
export function isImageGenerationAvailable(): boolean {
  const provider = getImageProvider();
  const source = getImageSource();
  // 可灵内置AI 直接使用平台密钥
  if (provider === 'kling') return true;
  // jimeng 不支持图片生成，但用户若误选，也允许使用（回退到可灵）
  if (provider === 'jimeng') return true;
  // Vidu 仅在自定义API配置了Key时可用
  if (provider === 'vidu' && source === 'custom' && !!getViduApiKey()) return true;
  // 商汤SenseNova 仅在自定义API配置了Key时可用
  if (provider === 'sensenova' && source === 'custom' && !!getSenseNovaApiKey()) return true;
  return false;
}

/** 将尺寸字符串转换为可灵 aspect_ratio */
function sizeToKlingAspectRatio(size: string): string {
  const parts = size.split('x').map((s) => parseInt(s.trim(), 10));
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return '9:16';
  const w = parts[0];
  const h = parts[1];
  if (w === 720 && h === 1280) return '9:16';
  if (w === 1280 && h === 720) return '16:9';
  if (w === h) return '1:1';
  if (w / h < 0.8) return '3:4';
  if (w / h > 1.3) return '4:3';
  return '9:16';
}

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
  // First delete all child tasks if this is a parent
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

/** Batch parallel execution with concurrency limit */
export async function batchParallel<T>(
  items: T[],
  fn: (item: T, index: number) => Promise<unknown>,
  concurrency = 3,
): Promise<unknown[]> {
  const results: unknown[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((item, idx) => fn(item, i + idx)),
    );
    results.push(...batchResults);
  }
  return results;
}

export async function invokeFunction(name: string, body: Record<string, unknown>): Promise<unknown> {
  const customApi = getCustomApiConfig();
  if (customApi) {
    body._custom_api = customApi;
  }
  console.log(`[invokeFunction] calling ${name}`, { bodyKeys: Object.keys(body) });
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const msg = extractErrorMessage(error);
    console.error(`[invokeFunction] Edge Function ${name} error:`, error);
    // 打印更详细的错误信息用于诊断
    try {
      console.error('[invokeFunction] error details:', JSON.stringify({
        name: (error as Record<string, unknown>).name,
        message: (error as Record<string, unknown>).message,
        cause: (error as Record<string, unknown>).cause,
        stack: (error as Record<string, unknown>).stack,
      }));
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (!data) throw new Error('服务端未返回数据');
  // If the Edge Function returns an error object with status 200, throw it
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }
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
  cluster?: string;
}): Promise<{ audioUrl: string; audioLength: number }> {
  const body: Record<string, unknown> = {
    text: params.text,
    voice_id: params.voiceId ?? 'zh_female_qingxinnvsheng_uranus_bigtts',
  };
  if (params.speed !== undefined) body.speed = params.speed;
  if (params.vol !== undefined) body.vol = params.vol;
  if (params.pitch !== undefined) body.pitch = params.pitch;
  if (params.emotion) body.emotion = params.emotion;
  if (params.cluster) body.cluster = params.cluster;

  // Pass Doubao API key if user has configured it
  const dbKey = getStoredDoubaoApiKey();
  if (dbKey) {
    body.doubao_api_key = dbKey;
  }

  const data = await invokeFunction('tts-minimax', body) as { audioUrl?: string; audioLength?: number };
  if (!data.audioUrl) throw new Error('未返回音频 URL');
  return { audioUrl: data.audioUrl, audioLength: data.audioLength ?? 0 };
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

// ---------- Image Generation ----------

export async function startImageGeneration(params: {
  prompt: string;
  size?: string;
  referenceImageUrl?: string;
}): Promise<{ imageId: string; status: string }> {
  const provider = getImageProvider();
  const source = getImageSource();
  const viduKey = getViduApiKey();
  const senseNovaKey = getSenseNovaApiKey();

  // Vidu 自定义API
  if (provider === 'vidu' && source === 'custom' && viduKey) {
    const data = await invokeFunction('vidu-generate-image', {
      prompt: params.prompt,
      size: params.size ?? '720x1280',
      reference_image_url: params.referenceImageUrl,
      vidu_api_key: viduKey,
    }) as { imageId?: string; status?: string; error?: string };
    if (data.error) throw new Error(data.error);
    if (!data.imageId) throw new Error('未返回图片任务ID');
    return { imageId: data.imageId, status: data.status ?? 'pending' };
  }

  // SenseNova 自定义API（通过Edge Function调用，避免前端CORS问题）
  if (provider === 'sensenova' && source === 'custom' && senseNovaKey) {
    const data = await invokeFunction('sensenova-generate-image', {
      prompt: params.prompt,
      size: params.size ?? '1280x720',
      sensenova_api_key: senseNovaKey,
      model: 'sensenova-u1-fast',
      n: 1,
    }) as { imageId?: string; status?: string; rawUrl?: string; error?: string };
    if (data.error) throw new Error(data.error);
    if (!data.imageId) throw new Error('SenseNova 未返回图片 URL');
    // Edge Function返回的是原始URL，需要前端下载到Storage
    const publicUrl = await uploadRemoteImageToStorage(data.imageId);
    return { imageId: publicUrl, status: 'completed' };
  }

  // 可灵内置AI（默认，jimeng 不支持图片生成也走此分支）
  const aspectRatio = sizeToKlingAspectRatio(params.size ?? '720x1280');
  const reqBody: Record<string, unknown> = {
    prompt: params.prompt,
    model_name: 'kling-image-o1',
    resolution: '1k',
    result_type: 'single',
    n: 1,
    aspect_ratio: aspectRatio,
  };
  if (params.referenceImageUrl) {
    reqBody.image_list = [{ image: params.referenceImageUrl }];
  }

  const data = await invokeFunction('kling-omni-image-submit', reqBody) as {
    code?: number;
    message?: string;
    data?: { task_id?: string; task_status?: string };
  };
  if (data.code !== 0) throw new Error(data.message || '可灵图片生成提交失败');
  const taskId = data.data?.task_id;
  if (!taskId) throw new Error('未返回图片任务ID');
  return { imageId: taskId, status: data.data?.task_status ?? 'submitted' };
}

export async function queryImageGeneration(imageId: string): Promise<{
  status: string;
  progress: number;
  image_url?: string;
  publicUrl?: string;
  error?: string | null;
}> {
  const provider = getImageProvider();
  const source = getImageSource();
  const viduKey = getViduApiKey();
  const senseNovaKey = getSenseNovaApiKey();

  // Vidu 自定义API
  if (provider === 'vidu' && source === 'custom' && viduKey) {
    return await invokeFunction('vidu-query-image', {
      image_id: imageId,
      vidu_api_key: viduKey,
    }) as {
      status: string;
      progress: number;
      image_url?: string;
      publicUrl?: string;
      error?: string | null;
    };
  }

  // SenseNova 自定义API（图片已在生成时下载到Storage，imageId即为Storage publicUrl）
  if (provider === 'sensenova' && source === 'custom' && senseNovaKey) {
    return {
      status: 'completed',
      progress: 100,
      image_url: imageId,
      publicUrl: imageId,
      error: null,
    };
  }

  // 可灵内置AI（默认，jimeng 不支持图片生成也走此分支）
  const data = await invokeFunction('kling-omni-image-query', {
    task_id: imageId,
  }) as {
    code?: number;
    message?: string;
    data?: {
      task_status?: string;
      task_status_msg?: string;
      task_result?: {
        result_type?: string;
        images?: Array<{ index: number; url: string }>;
        series_images?: Array<{ index: number; url: string }>;
      };
    };
  };

  if (data.code !== 0) {
    return { status: 'failed', progress: 0, error: data.message || '查询失败' };
  }

  const taskData = data.data;
  const taskStatus = taskData?.task_status ?? 'submitted';

  if (taskStatus === 'succeed') {
    const taskResult = taskData?.task_result;
    const items = taskResult?.result_type === 'series'
      ? taskResult.series_images
      : taskResult?.images;
    const firstImage = items && items.length > 0 ? items[0] : undefined;
    return {
      status: 'completed',
      progress: 100,
      image_url: firstImage?.url,
      publicUrl: firstImage?.url,
      error: null,
    };
  }

  if (taskStatus === 'failed') {
    return {
      status: 'failed',
      progress: 0,
      error: taskData?.task_status_msg || '图片生成失败',
    };
  }

  // submitted / processing
  return { status: 'in_progress', progress: 50, error: null };
}

/**
 * 使用指定 profile 生成图片（用于多模型对比）
 */
export async function startImageGenerationWithProfile(
  params: { prompt: string; size?: string; referenceImageUrl?: string },
  profile: { provider: string; apiKey?: string; apiBaseUrl?: string; extra?: Record<string, string> },
): Promise<{ imageId: string; status: string }> {
  const { provider, apiKey, apiBaseUrl, extra } = profile;

  // Jimeng 自定义API（即梦4.0使用火山引擎AK/SK签名认证）
  if (provider === 'jimeng') {
    const ak = extra?.accessKeyId?.trim();
    const sk = extra?.secretAccessKey?.trim();
    if (!ak || !sk) {
      throw new Error('即梦 API 需要配置 Access Key ID 和 Secret Access Key');
    }
    const data = await invokeFunction('jimeng-generate-image', {
      prompt: params.prompt,
      size: params.size ?? '1024x1024',
      access_key_id: ak,
      secret_access_key: sk,
    }) as { imageId?: string; status?: string; error?: string };
    if (data.error) throw new Error(data.error);
    if (!data.imageId) throw new Error('即梦未返回图片任务ID');
    return { imageId: data.imageId, status: data.status ?? 'pending' };
  }

  // Vidu 自定义API
  if (provider === 'vidu' && apiKey) {
    const data = await invokeFunction('vidu-generate-image', {
      prompt: params.prompt,
      size: params.size ?? '720x1280',
      reference_image_url: params.referenceImageUrl,
      vidu_api_key: apiKey.trim(),
    }) as { imageId?: string; status?: string; error?: string };
    if (data.error) throw new Error(data.error);
    if (!data.imageId) throw new Error('未返回图片任务ID');
    return { imageId: data.imageId, status: data.status ?? 'pending' };
  }

  // MiniMax 自定义API（同步接口，直接返回图片 URL）
  if (provider === 'minimax' && apiKey) {
    const data = await invokeFunction('minimax-generate-image', {
      prompt: params.prompt,
      size: params.size ?? '1280x720',
      minimax_api_key: apiKey.trim(),
    }) as { imageId?: string; publicUrl?: string; status?: string; error?: string };
    if (data.error) throw new Error(data.error);
    if (!data.imageId) throw new Error('MiniMax 未返回图片 URL');
    return { imageId: data.imageId, status: 'completed' };
  }

  // SenseNova 自定义API（通过Edge Function调用，避免前端CORS问题）
  if (provider === 'sensenova' && apiKey) {
    const data = await invokeFunction('sensenova-generate-image', {
      prompt: params.prompt,
      size: params.size ?? '1280x720',
      sensenova_api_key: apiKey.trim(),
      model: 'sensenova-u1-fast',
      n: 1,
    }) as { imageId?: string; status?: string; rawUrl?: string; error?: string };
    if (data.error) throw new Error(data.error);
    if (!data.imageId) throw new Error('SenseNova 未返回图片 URL');
    const publicUrl = await uploadRemoteImageToStorage(data.imageId);
    return { imageId: publicUrl, status: 'completed' };
  }

  // 默认走可灵内置AI（包括 other / kling 等）
  const aspectRatio = sizeToKlingAspectRatio(params.size ?? '720x1280');
  const reqBody: Record<string, unknown> = {
    prompt: params.prompt,
    model_name: 'kling-image-o1',
    resolution: '1k',
    result_type: 'single',
    n: 1,
    aspect_ratio: aspectRatio,
  };
  if (params.referenceImageUrl) {
    reqBody.image_list = [{ image: params.referenceImageUrl }];
  }

  const data = await invokeFunction('kling-omni-image-submit', reqBody) as {
    code?: number;
    message?: string;
    data?: { task_id?: string; task_status?: string };
  };
  if (data.code !== 0) throw new Error(data.message || '可灵图片生成提交失败');
  const taskId = data.data?.task_id;
  if (!taskId) throw new Error('未返回图片任务ID');
  return { imageId: taskId, status: data.data?.task_status ?? 'submitted' };
}

/**
 * 使用指定 profile 查询图片生成状态
 */
export async function queryImageGenerationWithProfile(
  imageId: string,
  profile: { provider: string; apiKey?: string; apiBaseUrl?: string; extra?: Record<string, string> },
): Promise<{
  status: string;
  progress: number;
  image_url?: string;
  publicUrl?: string;
  error?: string | null;
}> {
  const { provider, apiKey, extra } = profile;

  // Jimeng 自定义API（即梦4.0使用火山引擎AK/SK签名认证）
  if (provider === 'jimeng') {
    const ak = extra?.accessKeyId?.trim();
    const sk = extra?.secretAccessKey?.trim();
    if (!ak || !sk) {
      return { status: 'failed', progress: 0, error: '缺少即梦 Access Key ID 或 Secret Access Key' };
    }
    return await invokeFunction('jimeng-query-image', {
      task_id: imageId,
      access_key_id: ak,
      secret_access_key: sk,
    }) as {
      status: string;
      progress: number;
      image_url?: string;
      publicUrl?: string;
      error?: string | null;
    };
  }

  // Vidu 自定义API
  if (provider === 'vidu' && apiKey) {
    return await invokeFunction('vidu-query-image', {
      image_id: imageId,
      vidu_api_key: apiKey.trim(),
    }) as {
      status: string;
      progress: number;
      image_url?: string;
      publicUrl?: string;
      error?: string | null;
    };
  }

  // MiniMax 图片已在生成时同步返回，imageId 即为图片 URL
  if (provider === 'minimax') {
    return {
      status: 'completed',
      progress: 100,
      image_url: imageId,
      publicUrl: imageId,
      error: null,
    };
  }

  // SenseNova 图片已在生成时下载到Storage，imageId 即为 Storage publicUrl
  if (provider === 'sensenova' && apiKey) {
    return {
      status: 'completed',
      progress: 100,
      image_url: imageId,
      publicUrl: imageId,
      error: null,
    };
  }

  // 可灵内置AI
  const data = await invokeFunction('kling-omni-image-query', {
    task_id: imageId,
  }) as {
    code?: number;
    message?: string;
    data?: {
      task_status?: string;
      task_status_msg?: string;
      task_result?: {
        result_type?: string;
        images?: Array<{ index: number; url: string }>;
        series_images?: Array<{ index: number; url: string }>;
      };
    };
  };

  if (data.code !== 0) {
    return { status: 'failed', progress: 0, error: data.message || '查询失败' };
  }

  const taskData = data.data;
  const taskStatus = taskData?.task_status ?? 'submitted';

  if (taskStatus === 'succeed') {
    const taskResult = taskData?.task_result;
    const items = taskResult?.result_type === 'series'
      ? taskResult.series_images
      : taskResult?.images;
    const firstImage = items && items.length > 0 ? items[0] : undefined;
    return {
      status: 'completed',
      progress: 100,
      image_url: firstImage?.url,
      publicUrl: firstImage?.url,
      error: null,
    };
  }

  if (taskStatus === 'failed') {
    return {
      status: 'failed',
      progress: 0,
      error: taskData?.task_status_msg || '图片生成失败',
    };
  }

  return { status: 'in_progress', progress: 50, error: null };
}

// ---------- Gallery Images ----------

export async function createGalleryImage(params: {
  taskId: string;
  imageUrl?: string;
  prompt: string;
  originalPrompt?: string;
  index: number;
  status?: 'pending' | 'success' | 'failed';
  errorMessage?: string;
}): Promise<GalleryImage> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('gallery_images')
    .insert({
      task_id: params.taskId,
      user_id: user?.id,
      image_url: params.imageUrl || null,
      prompt: params.prompt,
      original_prompt: params.originalPrompt || null,
      index: params.index,
      status: params.status || 'success',
      error_message: params.errorMessage || null,
    })
    .select()
    .single();
  if (error) throw new Error(extractErrorMessage(error));
  return data as GalleryImage;
}

export async function listGalleryImages(taskId: string): Promise<GalleryImage[]> {
  const { data, error } = await supabase
    .from('gallery_images')
    .select('*')
    .eq('task_id', taskId)
    .order('index', { ascending: true });
  if (error) throw new Error(extractErrorMessage(error));
  return Array.isArray(data) ? (data as GalleryImage[]) : [];
}

export async function updateGalleryImage(
  id: string,
  updates: Partial<Pick<GalleryImage, 'image_url' | 'prompt' | 'original_prompt' | 'status' | 'error_message'>>,
): Promise<void> {
  const { error } = await supabase
    .from('gallery_images')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(extractErrorMessage(error));
}

export async function deleteGalleryImage(id: string): Promise<void> {
  const { error } = await supabase.from('gallery_images').delete().eq('id', id);
  if (error) throw new Error(extractErrorMessage(error));
}

export async function cloneVoice(params: {
  name: string;
  description?: string;
  audioUrl: string;
  language?: string;
  duration?: number;
  noiseReduce?: boolean;
  volumeNormalize?: boolean;
}): Promise<{ id: string; status: string; voiceId?: string; message: string }> {
  const body: Record<string, unknown> = {
    name: params.name,
    description: params.description ?? '',
    audioUrl: params.audioUrl,
    language: params.language ?? 'Chinese',
    duration: params.duration,
    noiseReduce: params.noiseReduce ?? false,
    volumeNormalize: params.volumeNormalize ?? false,
  };
  const customApi = getCustomApiConfig();
  if (customApi) {
    body._custom_api = customApi;
  }
  // Pass Doubao API key if user has configured it
  const dbKey2 = getStoredDoubaoApiKey();
  if (dbKey2) {
    body.doubao_api_key = dbKey2;
  }
  const data = await invokeFunction('clone-voice', body) as { id: string; status: string; voiceId?: string; message: string };
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
