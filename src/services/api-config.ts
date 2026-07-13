import { supabase } from '@/db/supabase';
import { getActiveProfile, getJimengApiKey as getStoredJimengApiKey } from '@/components/ApiSettingsDialog';

export interface CustomApiConfig {
  apiBaseUrl: string;
  apiKey: string;
  modelName: string;
}

export function getCustomApiConfig(): CustomApiConfig | null {
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

export function getJimengApiKey(): string | null {
  return getStoredJimengApiKey();
}

export function getViduApiKey(): string | null {
  const p = getActiveProfile('video') ?? getActiveProfile('image');
  return p?.apiKey?.trim() || null;
}

export function getSenseNovaApiKey(): string | null {
  const p = getActiveProfile('image');
  if (p?.provider === 'sensenova') {
    return p.apiKey?.trim() || null;
  }
  return null;
}

export function getMiniMaxApiKey(): string | null {
  const p = getActiveProfile('image');
  if (p?.provider === 'minimax') {
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

export function getVideoProvider(): string {
  const mcfg = readModelConfig();
  const p = getActiveProfile('video');
  return p?.provider || mcfg.video?.provider || 'jimeng';
}

export function getImageProvider(): string {
  const mcfg = readModelConfig();
  const p = getActiveProfile('image');
  return p?.provider || mcfg.image?.provider || 'kling';
}

export function getImageSource(): string {
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

/** 检查图片生成功能是否可用 */
export function isImageGenerationAvailable(): boolean {
  const provider = getImageProvider();
  const source = getImageSource();
  if (provider === 'kling') return true;
  if (provider === 'jimeng') return true;
  if (provider === 'vidu' && source === 'custom' && !!getViduApiKey()) return true;
  if (provider === 'sensenova' && source === 'custom' && !!getSenseNovaApiKey()) return true;
  if (provider === 'minimax' && source === 'custom' && !!getMiniMaxApiKey()) return true;
  return false;
}

/** 将尺寸字符串转换为可灵 aspect_ratio */
export function sizeToKlingAspectRatio(size: string): string {
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

export function extractErrorMessage(err: unknown): string {
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
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }
  return data;
}
