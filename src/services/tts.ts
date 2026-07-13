import { invokeFunction } from './api-config';
import { getDoubaoApiKey as getStoredDoubaoApiKey } from '@/components/ApiSettingsDialog';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffDelay(attempt: number, baseMs = 1000): number {
  return Math.min(baseMs * Math.pow(2, attempt), 15000);
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

  const dbKey = getStoredDoubaoApiKey();
  if (dbKey) {
    body.doubao_api_key = dbKey;
  }

  // Retry with exponential backoff on 429/rate limit errors
  const maxAttempts = 3;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const data = await invokeFunction('tts-minimax', body) as { audioUrl?: string; audioLength?: number };
      if (!data.audioUrl) throw new Error('未返回音频 URL');
      return { audioUrl: data.audioUrl, audioLength: data.audioLength ?? 0 };
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/429|rate.limit|402|server/i.test(msg)) {
          await sleep(backoffDelay(attempt));
          continue;
        }
      }
      if (attempt === 0) break; // Non-retryable error, fall through to throw
      throw err;
    }
  }
  throw lastError;
}