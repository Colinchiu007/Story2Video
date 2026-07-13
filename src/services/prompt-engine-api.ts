/**
 * prompt-engine API 客户端
 *
 * 调用 Python 端 REST API，封装三个核心端点：
 * - POST /v1/optimize        — 单条提示词优化
 * - POST /v1/batch           — 批量优化（最多 10 条）
 * - POST /v1/storyboard/compose — 分镜 prompt 合成（专为 Story2Video 设计）
 *
 * 当 API 不可用时，上层包装函数会降级到本地 TS 实现。
 */

import { apiPost } from './api-client';
import { getPromptEngineUrl } from './external-config';

// ── API 类型定义（对应 Python 端 models.py） ────────────────────────────────

export type PlatformType =
  | 'midjourney'
  | 'stable_diffusion'
  | 'dalle'
  | 'tongyi'
  | 'yizhang'
  | 'jimeng'
  | 'generic';

export type StyleType =
  | 'realistic'
  | 'cartoon'
  | 'anime'
  | 'oil_painting'
  | 'watercolor'
  | 'pixel'
  | 'cyberpunk'
  | 'fantasy'
  | 'photography'
  | '3d_render'
  | 'minimalist'
  | 'abstract'
  | 'portrait'
  | 'landscape';

export interface OptimizeRequest {
  prompt: string;
  platform?: PlatformType;
  style?: StyleType | null;
  creative_level?: number;
  max_length?: number;
  negative_prompt?: string | null;
  num_candidates?: number;
  auto_detect_style?: boolean;
  context?: Record<string, unknown> | null;
}

export interface OptimizeResult {
  optimized_prompt: string;
  platform: PlatformType;
  style?: StyleType | null;
  model_used: string;
  tokens_used: number;
  duration_ms: number;
  candidates: string[];
  key_source: string;
  error?: string | null;
}

export interface StoryboardComposeResult {
  strategy: string;
  prompts: string[];
  metaphors: Array<{
    composition_type: string;
    metaphor: string;
    visual_description: string;
  }>;
}

// ── API 调用 ────────────────────────────────────────────────────────────────

/**
 * POST /v1/optimize — 单条提示词优化
 */
export async function apiOptimizePrompt(
  prompt: string,
  options?: {
    platform?: PlatformType;
    style?: StyleType | null;
    creativeLevel?: number;
    negativePrompt?: string;
  },
): Promise<OptimizeResult> {
  const baseUrl = getPromptEngineUrl();
  if (!baseUrl) throw new Error('Prompt engine URL not configured');

  return apiPost<OptimizeResult>(baseUrl, '/v1/optimize', {
    prompt,
    platform: options?.platform ?? 'generic',
    style: options?.style ?? null,
    creative_level: options?.creativeLevel ?? 5,
    negative_prompt: options?.negativePrompt ?? null,
    auto_detect_style: true,
  });
}

/**
 * POST /v1/batch — 批量优化（最多 10 条）
 */
export async function apiBatchOptimize(
  requests: OptimizeRequest[],
): Promise<OptimizeResult[]> {
  const baseUrl = getPromptEngineUrl();
  if (!baseUrl) throw new Error('Prompt engine URL not configured');

  const result = await apiPost<{ results: OptimizeResult[] }>(
    baseUrl,
    '/v1/batch',
    { requests: requests.slice(0, 10) },
  );
  return result.results;
}

/**
 * POST /v1/storyboard/compose — 分镜 prompt 合成（专为 Story2Video 设计）
 */
export async function apiStoryboardCompose(
  scenes: string[],
  fullText: string,
  options?: {
    strategy?: string;
    creativeLevel?: number;
  },
): Promise<StoryboardComposeResult> {
  const baseUrl = getPromptEngineUrl();
  if (!baseUrl) throw new Error('Prompt engine URL not configured');

  return apiPost<StoryboardComposeResult>(baseUrl, '/v1/storyboard/compose', {
    scenes,
    full_text: fullText,
    strategy: options?.strategy ?? 'xiaohei_storyboard',
    options: {
      creative_level: options?.creativeLevel ?? 5,
    },
  });
}

// ── 健康检查 ────────────────────────────────────────────────────────────────

/**
 * 测试 prompt-engine 服务是否可达
 */
export async function checkPromptEngineHealth(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    await apiOptimizePrompt('test', { creativeLevel: 1 });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
