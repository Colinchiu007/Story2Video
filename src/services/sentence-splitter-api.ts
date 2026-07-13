/**
 * smart-sentence-splitter API 客户端
 *
 * 调用 Python 端 REST API（POST /v1/split），将结果适配为
 * text-segmentation.ts 兼容的格式。
 *
 * 当 API 不可用时，上层包装函数会降级到本地 TS 实现。
 */

import { apiPost } from './api-client';
import { getSentenceSplitterUrl } from './external-config';

// ── API 类型定义（对应 Python 端 SplitResult） ─────────────────────────────

export interface ApiSentenceBlock {
  index: number;
  text: string;
  language: string;
  tier: string;
  confidence: number;
  char_count: number;
  is_topic_boundary?: boolean;
  topic_depth_score?: number;
}

export interface ApiSubtitleBlock {
  text: string;
  start: number;
  end: number;
}

export interface ApiSceneSegment {
  text: string;
  estimated_duration: number;
  era_info?: { era: string; confidence: number };
  subtitles: ApiSubtitleBlock[];
}

export interface ApiSplitResult {
  sentences: ApiSentenceBlock[];
  scenes: ApiSceneSegment[];
  tier_used: string;
  language: string;
  total_duration: number;
  total_words: number;
  total_scenes: number;
}

export interface SplitOptions {
  language?: 'auto' | 'zh' | 'en';
  mode?: 'fast' | 'balanced' | 'precise';
  enableLlm?: boolean;
  enableEra?: boolean;
}

// ── API 调用 ────────────────────────────────────────────────────────────────

/**
 * 调用 smart-sentence-splitter POST /v1/split
 */
export async function apiSplitText(
  text: string,
  options?: SplitOptions,
): Promise<ApiSplitResult> {
  const baseUrl = getSentenceSplitterUrl();
  if (!baseUrl) throw new Error('Sentence splitter URL not configured');

  return apiPost<ApiSplitResult>(baseUrl, '/v1/split', {
    text,
    language: options?.language ?? 'auto',
    mode: options?.mode ?? 'balanced',
    enable_era: options?.enableEra ?? false,
    enable_llm: options?.enableLlm ?? false,
    enable_topic_segmentation: false,
  });
}

// ── 结果适配器 ──────────────────────────────────────────────────────────────

/**
 * API scenes → splitTextToScenes 兼容的 string[]
 * 每个 scene 的 text 作为一段
 */
export function adaptToSceneSegments(apiResult: ApiSplitResult): string[] {
  return apiResult.scenes.map((s) => s.text).filter((t) => t.trim().length > 0);
}

/**
 * API scenes → 字幕文本数组
 * 提取每个场景下的字幕块文本
 */
export function adaptToSubtitleLines(apiResult: ApiSplitResult): string[] {
  const lines: string[] = [];
  for (const scene of apiResult.scenes) {
    if (scene.subtitles && scene.subtitles.length > 0) {
      for (const sub of scene.subtitles) {
        if (sub.text.trim()) lines.push(sub.text);
      }
    } else if (scene.text.trim()) {
      lines.push(scene.text);
    }
  }
  return lines;
}

// ── 健康检查 ────────────────────────────────────────────────────────────────

/**
 * 测试 sentence-splitter 服务是否可达
 * @returns 服务信息或 null
 */
export async function checkSentenceSplitterHealth(): Promise<{
  ok: boolean;
  tier?: string;
  error?: string;
}> {
  try {
    const result = await apiSplitText('测试文本', { mode: 'fast' });
    return { ok: true, tier: result.tier_used };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
