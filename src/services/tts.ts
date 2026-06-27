import { invokeFunction } from './api-config';
import { getDoubaoApiKey as getStoredDoubaoApiKey } from '@/components/ApiSettingsDialog';

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

  const dbKey = getStoredDoubaoApiKey();
  if (dbKey) {
    body.doubao_api_key = dbKey;
  }

  const data = await invokeFunction('tts-minimax', body) as { audioUrl?: string; audioLength?: number };
  if (!data.audioUrl) throw new Error('未返回音频 URL');
  return { audioUrl: data.audioUrl, audioLength: data.audioLength ?? 0 };
}
