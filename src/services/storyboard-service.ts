/**
 * Storyboard Service — 故事板策略客户端
 *
 * 连接 prompt-engine storyboard API 或降级到客户端 storyboard-prompt.ts。
 *
 * 管道角色:
 *   SSS 分句 → storyboard compose(每场景) → 图像生成
 *
 * 用法:
 *   import { storyboardCompose, storyboardStrategies } from '@/services/storyboard-service'
 *   const prompts = await storyboardCompose(scenes, fullText, 'xiaohei_storyboard')
 */

import {
  composeStoryboardPrompt,
  renderPromptString,
  type StoryboardPrompt,
} from '@/lib/storyboard-prompt'

// ── Types ──────────────────────────────────────────────────────────────────

export interface StoryboardMeta {
  /** 构图类型 */
  compositionType: string
  /** 核心动作 */
  action: string
  /** 核心物件 */
  object: string
  /** 视觉场景描述 */
  visualScene: string
}

export interface StoryboardResult {
  /** 可用于图像生成的提示词 */
  prompt: string
  /** 故事板元数据（可选） */
  meta?: StoryboardMeta
}

// ── Orchestrator API 配置 ───────────────────────────────────────────────

function orchestratorBase(): string {
  return localStorage.getItem('orchestrator_url') || '/api'
}

/** 是否启用服务端 storyboard API（场景文案发送到 prompt-engine 处理） */
function useServiceStoryboard(): boolean {
  // 默认禁用（客户端版本已够用），用户可通过 localStorage 开启
  return localStorage.getItem('storyboard_service') === '1'
}

// ── 客户端 storyboard（降级/默认） ─────────────────────────────────────

function clientCompose(scenes: string[], fullText: string): StoryboardResult[] {
  return scenes.map((scene) => {
    const prompt = composeStoryboardPrompt(scene, {
      creativeLevel: 5,
    })
    return {
      prompt: renderPromptString(prompt),
      meta: {
        compositionType: prompt.structure,
        action: prompt.keywords?.[0] ?? '',
        object: prompt.keywords?.[1] ?? '',
        visualScene: prompt.picture,
      },
    }
  })
}

// ── 服务端 storyboard API ──────────────────────────────────────────────

async function serviceCompose(
  scenes: string[],
  fullText: string,
  strategy?: string,
  options?: Record<string, unknown>,
): Promise<StoryboardResult[]> {
  const url = `${orchestratorBase()}/v1/storyboard/compose`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scenes,
      full_text: fullText,
      strategy: strategy ?? 'xiaohei_storyboard',
      options: options ?? {},
    }),
  })

  if (!res.ok) {
    // 服务端不可用 → 降级到客户端
    console.warn(`[storyboard] API unavailable (${res.status}), falling back to client`)
    return clientCompose(scenes, fullText)
  }

  const data = await res.json()
  return data.prompts.map((prompt: string, i: number) => ({
    prompt,
    meta: data.metaphors?.[i]
      ? {
          compositionType: data.metaphors[i].composition ?? '',
          action: data.metaphors[i].action ?? '',
          object: data.metaphors[i].object ?? '',
          visualScene: data.metaphors[i].scene ?? '',
        }
      : undefined,
  }))
}

// ── 公开 API ─────────────────────────────────────────────────────────────

/**
 * 对场景列表进行故事板提示词合成
 *
 * @param scenes      场景文本数组（来自 SSS 分句）
 * @param fullText    原始全文（用于跨场景上下文）
 * @param strategy    策略名，默认 'xiaohei_storyboard'
 * @param options     额外选项
 * @returns           每个场景的 { prompt, meta? }
 */
export async function storyboardCompose(
  scenes: string[],
  fullText: string,
  strategy?: string,
  options?: Record<string, unknown>,
): Promise<StoryboardResult[]> {
  if (!scenes.length) return []

  if (useServiceStoryboard()) {
    return serviceCompose(scenes, fullText, strategy, options)
  }

  return clientCompose(scenes, fullText)
}

/**
 * 获取可用的故事板策略列表（服务端 API 优先，失败降级到内置）
 */
export async function storyboardStrategies(): Promise<
  { name: string; display_name: string; description: string }[]
> {
  try {
    const url = `${orchestratorBase()}/v1/storyboard/strategies`
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      return data.strategies ?? []
    }
  } catch {
    // ignore
  }

  // 降级到内置策略
  return [
    {
      name: 'xiaohei_storyboard',
      display_name: 'Ian 小黑插画风',
      description: '抽象概念到视觉隐喻的手绘插画风格',
    },
  ]
}
