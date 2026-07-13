import { invokeFunction } from './api-config';
import { getMimoApiKey as getStoredMimoApiKey } from '@/components/ApiSettingsDialog';

export type MimoModel = 'mimo-v2.5-tts' | 'mimo-v2.5-tts-voiceclone';

export interface GenerateMimoTTSParams {
  text: string;
  model?: MimoModel;
  voice?: string;
  voiceRecordId?: string;
  format?: 'wav' | 'mp3' | 'pcm16';
  speed?: number;
}

export interface GenerateMimoTTSResult {
  audioUrl: string;
  audioLength: number;
  provider?: 'mimo';
  model?: string;
}

/** Exponential backoff delay for retryable errors (429, 5xx). */
function backoffDelay(attempt: number, baseMs = 1000): number {
  return Math.min(baseMs * Math.pow(2, attempt), 15000);
}

/** Sleep helper. */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Whether the HTTP status is retryable (429 rate-limit or 5xx server error). */
function isRetryable(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

export async function generateMimoTTS(params: GenerateMimoTTSParams): Promise<GenerateMimoTTSResult> {
  const model = params.model ?? (params.voiceRecordId ? 'mimo-v2.5-tts-voiceclone' : 'mimo-v2.5-tts');
  const body: Record<string, unknown> = { text: params.text, model, format: params.format ?? 'wav' };
  if (params.voiceRecordId) body.voice_record_id = params.voiceRecordId;
  else if (params.voice) body.voice = params.voice;
  else throw new Error('generateMimoTTS 需要 voice 或 voiceRecordId 之一');
  if (typeof params.speed === 'number') body.speed = params.speed;

  const mimoKey = getStoredMimoApiKey();
  if (mimoKey) body.mimo_api_key = mimoKey;

  // Retry the Edge Function call up to 3 times on retryable errors
  const maxAttempts = 3;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const data = await invokeFunction('tts-mimo', body) as { audioUrl: string; audioLength: number; provider?: string; model?: string };
      return { audioUrl: data.audioUrl, audioLength: data.audioLength, provider: data.provider as 'mimo', model: data.model ?? model };
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      // Retry on 429 / rate limit / server errors
      if (attempt < maxAttempts - 1 && /429|rate.limit|402|server/i.test(msg)) {
        await sleep(backoffDelay(attempt));
        continue;
      }
      // Fall through to direct call on first failure, or throw on retry exhaustion
      if (attempt === 0) break;
      throw err;
    }
  }

  // Fallback: direct API call with retry
  return generateMimoTTSDirectWithRetry(params, mimoKey);
}

async function generateMimoTTSDirectWithRetry(params: GenerateMimoTTSParams, apiKey: string, maxAttempts = 3): Promise<GenerateMimoTTSResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await generateMimoTTSDirect(params, apiKey);
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/429|rate.limit|402|server/i.test(msg)) {
          await sleep(backoffDelay(attempt));
          continue;
        }
      }
      throw err;
    }
  }
  throw lastError;
}

async function generateMimoTTSDirect(params: GenerateMimoTTSParams, apiKey: string): Promise<GenerateMimoTTSResult> {
  const { supabase } = await import('@/db/supabase');
  const model = params.model ?? 'mimo-v2.5-tts-voiceclone';
  const format = params.format ?? 'wav';

  let resolvedVoice: string;
  if (params.voiceRecordId) resolvedVoice = await resolveVoiceSample(params.voiceRecordId);
  else if (params.voice) resolvedVoice = params.voice;
  else throw new Error('缺少 voice 或 voiceRecordId');
  if (!apiKey) throw new Error('未配置 MiMo API Key，请在设置中填写');

  const resp = await fetch('https://api.xiaomimimo.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: '' }, { role: 'assistant', content: params.text }], audio: { format, voice: resolvedVoice } }),
  });
  const raw = await resp.text();
  const result = JSON.parse(raw);
  if (!resp.ok) throw new Error('MiMo 合成失败: ' + (result?.message ?? 'HTTP ' + resp.status));

  const b64 = result?.choices?.[0]?.message?.audio?.data;
  if (!b64) throw new Error('MiMo 未返回音频数据');

  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const ext = format === 'mp3' ? 'mp3' : 'wav';
  const filePath = 'uploads/' + crypto.randomUUID() + '.' + ext;
  const { error: upErr } = await supabase.storage.from('generated-audio').upload(filePath, bin, {
    contentType: format === 'mp3' ? 'audio/mpeg' : 'audio/wav',
    cacheControl: 'no-cache',
  });
  if (upErr) throw upErr;
  const { data: urlData } = supabase.storage.from('generated-audio').getPublicUrl(filePath);
  const chineseChars = (params.text.match(/[\u4e00-\u9fff]/g) || []).length;
  const audioLength = Math.max(1, Math.round(chineseChars / 4 / (params.speed ?? 1)));
  return { audioUrl: urlData.publicUrl, audioLength, provider: 'mimo', model };
}

async function resolveVoiceSample(voiceRecordId: string): Promise<string> {
  const { supabase } = await import('@/db/supabase');
  const { data: rec, error } = await supabase.from('user_voices').select('sample_audio_url').eq('id', voiceRecordId).single();
  if (error || !rec) throw new Error('未找到音色记录(' + voiceRecordId + '): ' + (error?.message ?? 'unknown'));
  const audioResp = await fetch(rec.sample_audio_url);
  if (!audioResp.ok) throw new Error('下载音频样本失败: ' + audioResp.status);
  const blob = await audioResp.blob();
  if (blob.size > 10 * 1024 * 1024) throw new Error('音频样本超过 10MB 限制');
  const buf = await blob.arrayBuffer();
  const u8 = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode(...u8.subarray(i, i + 8192));
  const mime = (blob.type || '').includes('wav') ? 'audio/wav' : 'audio/mpeg';
  return 'data:' + mime + ';base64,' + btoa(bin);
}

export function getMimoVoiceNameFromId(voiceId: string): string {
  if (!voiceId) return '';
  if (voiceId.includes(':')) return voiceId.split(':').pop() ?? voiceId;
  return voiceId;
}