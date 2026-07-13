import { invokeFunction } from './api-config';
import { getMimoApiKey as getStoredMimoApiKey } from '@/components/ApiSettingsDialog';

export type MimoModel = 'mimo-v2.5-tts' | 'mimo-v2.5-tts-voiceclone';

export interface GenerateMimoTTSParams {
  text: string;
  model?: MimoModel;
  /** 预置音色名（如 "Chloe"）或复合 ID（如 "mimo_default_cn:冰糖"）。克隆时可不传 */
  voice?: string;
  /** 克隆音色时传 user_voices.id；Edge Function 会自动下载并 base64 编码 */
  voiceRecordId?: string;
  /** 输出格式，默认 wav */
  format?: 'wav' | 'mp3' | 'pcm16';
  /** 倍速，仅用于时长估算（MiMo 无 native speed 参数） */
  speed?: number;
}

export interface GenerateMimoTTSResult {
  audioUrl: string;
  audioLength: number;
  provider?: 'mimo';
  model?: string;
}

/**
 * 调用 tts-mimo 边缘函数进行 MiMo 语音合成。
 * - 预置音色：传 voice（音色名，如 "Chloe"），model 默认 mimo-v2.5-tts
 * - 克隆音色：传 voiceRecordId（user_voices.id），model 默认 mimo-v2.5-tts-voiceclone
 */
export async function generateMimoTTS(params: GenerateMimoTTSParams): Promise<GenerateMimoTTSResult> {
  const model: MimoModel = params.model
    ?? (params.voiceRecordId ? 'mimo-v2.5-tts-voiceclone' : 'mimo-v2.5-tts');

  const body: Record<string, unknown> = {
    text: params.text,
    model,
    format: params.format ?? 'wav',
  };

  if (params.voiceRecordId) {
    body.voice_record_id = params.voiceRecordId;
  } else if (params.voice) {
    body.voice = params.voice;
  } else {
    throw new Error('generateMimoTTS 需要 voice 或 voiceRecordId 之一');
  }

  if (typeof params.speed === 'number') {
    body.speed = params.speed;
  }

  const mimoKey = getStoredMimoApiKey();
  if (mimoKey) {
    body.mimo_api_key = mimoKey;
  }

  const data = await invokeFunction('tts-mimo', body) as {
    audioUrl: string;
    audioLength: number;
    provider?: string;
    model?: string;
  };

  return {
    audioUrl: data.audioUrl,
    audioLength: data.audioLength,
    provider: data.provider as 'mimo',
    model: data.model ?? model,
  };
}

/**
 * 解析 voiceId 为 MiMo 音色名字。
 * 对于 `mimo_default_cn:冰糖` 这种复合 ID，拆分出 `:冰糖` 部分；
 * 对于克隆音色（UUID 格式），返回空字符串，调用方应改用 voiceRecordId 逻辑。
 */
export function getMimoVoiceNameFromId(voiceId: string): string {
  if (!voiceId) return '';
  if (voiceId.includes(':')) {
    const parts = voiceId.split(':');
    return parts[parts.length - 1] ?? voiceId;
  }
  return voiceId;
}
