/**
 * StoryboardSettings — 故事板策略选择器
 *
 * 控制 CreatePage 的图片提示词生成策略：
 * - 默认关闭（沿用 generateImagePrompts v9.0）
 * - 开启后使用 storyboard compose 策略
 * - 可选策略：xiaohei_storyboard 等
 */

import React, { useState, useCallback } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Wand2 } from 'lucide-react'

const STORYBOARD_STRATEGIES = [
  { value: 'xiaohei_storyboard', label: 'Ian 小黑插画风', description: '抽象概念 → 视觉隐喻，手绘插画风格' },
]

function getLs(key: string, def: string): string {
  if (typeof window === 'undefined') return def
  return localStorage.getItem(key) ?? def
}

function setLs(key: string, value: string) {
  if (typeof window !== 'undefined') localStorage.setItem(key, value)
}

export default function StoryboardSettings() {
  const [enabled, setEnabledState] = useState(() => getLs('storyboard_enabled') === '1')
  const [strategy, setStrategyState] = useState(() => getLs('storyboard_strategy', 'xiaohei_storyboard'))

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v)
    setLs('storyboard_enabled', v ? '1' : '0')
  }, [])

  const setStrategy = useCallback((v: string) => {
    setStrategyState(v)
    setLs('storyboard_strategy', v)
  }, [])

  const current = STORYBOARD_STRATEGIES.find(s => s.value === strategy) ?? STORYBOARD_STRATEGIES[0]

  return (
    <div className="border-t border-border pt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-muted-foreground" />
          <Label className="text-sm font-medium">故事板分镜策略</Label>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          aria-label="开启故事板分镜"
        />
      </div>

      {enabled && (
        <div className="space-y-3 pl-6 border-l-2 border-primary/20">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">选择策略</Label>
            <Select value={strategy} onValueChange={setStrategy}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STORYBOARD_STRATEGIES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    <span className="font-medium">{s.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>当前策略: <span className="font-medium text-foreground">{current.label}</span></p>
            <p>{current.description}</p>
            <p className="italic">
              开启后，图片提示词将改用故事板策略生成，替代默认的 v9.0 客户端策略
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
