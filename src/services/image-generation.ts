import { supabase } from '@/db/supabase';
import {
  getImageProvider,
  getImageSource,
  getViduApiKey,
  getSenseNovaApiKey,
  invokeFunction,
  sizeToKlingAspectRatio,
} from './api-config';

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

  // SenseNova 自定义API
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
    const publicUrl = await uploadRemoteImageToStorage(data.imageId);
    return { imageId: publicUrl, status: 'completed' };
  }

  // 可灵内置AI（默认）
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

  // SenseNova 自定义API
  if (provider === 'sensenova' && source === 'custom' && senseNovaKey) {
    return {
      status: 'completed',
      progress: 100,
      image_url: imageId,
      publicUrl: imageId,
      error: null,
    };
  }

  // 可灵内置AI（默认）
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

/**
 * 使用指定 profile 生成图片（用于多模型对比）
 */
export async function startImageGenerationWithProfile(
  params: { prompt: string; size?: string; referenceImageUrl?: string },
  profile: { provider: string; apiKey?: string; apiBaseUrl?: string; modelName?: string; extra?: Record<string, string> },
): Promise<{ imageId: string; status: string }> {
  const { provider, apiKey, apiBaseUrl, modelName, extra } = profile;

  // Jimeng 自定义API
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

  // MiniMax 自定义API
  if (provider === 'minimax' && apiKey) {
    const data = await invokeFunction('minimax-generate-image', {
      prompt: params.prompt,
      size: params.size ?? '1280x720',
      minimax_api_key: apiKey.trim(),
      model: modelName || 'image-01',
    }) as { imageId?: string; publicUrl?: string; status?: string; error?: string; raw?: unknown };
    if (data.error) throw new Error(data.error);
    if (!data.imageId) throw new Error('MiniMax 未返回图片 URL');
    return { imageId: data.imageId, status: 'completed' };
  }

  // SenseNova 自定义API
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

  // 默认走可灵内置AI
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

  // Jimeng 自定义API
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

  // MiniMax
  if (provider === 'minimax') {
    return {
      status: 'completed',
      progress: 100,
      image_url: imageId,
      publicUrl: imageId,
      error: null,
    };
  }

  // SenseNova
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
