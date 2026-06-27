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
