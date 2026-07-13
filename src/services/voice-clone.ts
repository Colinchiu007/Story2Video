import { supabase } from '@/db/supabase';
import type { UserVoice } from '@/types';
import { invokeFunction, extractErrorMessage, getCustomApiConfig } from './api-config';
import { getDoubaoApiKey as getStoredDoubaoApiKey } from '@/components/ApiSettingsDialog';

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
  const dbKey2 = getStoredDoubaoApiKey();
  if (dbKey2) {
    body.doubao_api_key = dbKey2;
  }
  const data = await invokeFunction('clone-voice', body) as { id: string; status: string; voiceId?: string; message: string };
  return data;
}

/**
 * 上传音色样本到 MiMo。
 * 兼容处理：如果 `provider` 列不存在（migration 00021 未部署），回退到不含 provider 列的插入。
 */
export async function uploadMimoVoiceSample(params: {
  name: string;
  description?: string;
  audioUrl: string;
  duration?: number;
}): Promise<{ id: string; name: string; status: string }> {
  // 优先尝试带 provider 列的插入
  const { data, error } = await supabase
    .from('user_voices')
    .insert({
      name: params.name,
      description: params.description ?? '',
      sample_audio_url: params.audioUrl,
      status: 'ready',
      provider: 'mimo',
      duration_seconds: params.duration ?? null,
      language: 'Chinese',
    })
    .select('id, name, status')
    .single();

  if (!error) return data;

  // 如果是因为 provider 列缺失，回退到不含 provider 的插入
  if (error.code === 'PGRST204' && error.message.includes('provider')) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('user_voices')
      .insert({
        name: params.name,
        description: params.description ?? '',
        sample_audio_url: params.audioUrl,
        status: 'ready',
        duration_seconds: params.duration ?? null,
        language: 'Chinese',
      })
      .select('id, name, status')
      .single();

    if (fallbackError) throw new Error(extractErrorMessage(fallbackError));
    return fallbackData;
  }

  throw new Error(extractErrorMessage(error));
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