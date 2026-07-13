# Story2Video — 测试规范

## TDD 流程

```
RED   → 在 src/lib/*.test.ts 或 src/pages/**/__tests__/ 写失败测试
GREEN → 最小实现让测试通过
REFACTOR → 重构，保持测试通过
```

## 测试基础设施

| 配置 | 值 |
|------|-----|
| 测试框架 | Vitest v4 |
| 环境 | jsdom |
| Pool | `forks`（防止 `vi.stubGlobal` 与 worker_threads 死锁） |
| 超时 | 每个测试 30s |
| Setup 文件 | `src/test-setup.ts`（引入 `@testing-library/jest-dom/vitest`） |

### 运行命令

```bash
npm test              # 全量测试（vitest run，pool=forks）
npm run test:ci       # CI 模式（--bail=1 首个失败即停 + verbose）
npm run test:watch    # Watch 模式
npm run test:watch:pool  # Watch 模式（指定 forks pool）
```

### 现有测试覆盖

| 模块 | 测试文件 | 状态 |
|------|---------|------|
| slideshow (Canvas 视频合成) | `src/lib/slideshow.test.ts` | ✅ |
| audio-mixer (Web Audio 混音) | `src/lib/audio-mixer.test.ts` | ✅ |
| text-segmentation (文本分段) | `src/lib/text-segmentation.test.ts` | ✅ |
| segment | `src/lib/segment.test.ts` | ✅ |
| history-prompt | `src/lib/history-prompt.test.ts` | ✅ |
| bgm-library | `src/lib/bgm-library.test.ts` | ✅ |
| template-library | `src/lib/template-library.test.ts` | ✅ |
| effects-library | `src/lib/effects-library.test.ts` | ✅ |
| watermark | `src/lib/watermark.test.ts` | ✅ |
| share | `src/lib/share.test.ts` | ✅ |
| progress | `src/lib/progress.test.ts` | ✅ |
| zip-utils | `src/lib/zip-utils.test.ts` | ✅ |
| video (api-config) | `src/services/video.test.ts` | ✅ |
| prompt-engine-api | `src/services/prompt-engine-api.test.ts` | ✅ |
| sentence-splitter-api | `src/services/sentence-splitter-api.test.ts` | ✅ |
| tts-mimo | `src/services/tts-mimo.test.ts` | ✅ |
| voice-clone | `src/services/voice-clone.test.ts` | ✅ |
| useFeatureGate | `src/hooks/useFeatureGate.test.ts` | ✅ |
| useOrchestratorMembership | `src/hooks/useOrchestratorMembership.test.ts` | ✅ |
| useVideoClip | `src/hooks/useVideoClip.test.ts` | ✅ |
| BatchExportButton | `src/components/BatchExportButton.test.tsx` | ✅ |
| EffectPicker | `src/components/EffectPicker.test.tsx` | ✅ |
| MembershipUpgradeDialog | `src/components/MembershipUpgradeDialog.test.tsx` | ✅ |
| ShareButton | `src/components/ShareButton.test.tsx` | ✅ |
| VideoClipEditor | `src/components/VideoClipEditor.test.tsx` | ✅ |
| VideoTemplatePicker | `src/components/VideoTemplatePicker.test.tsx` | ✅ |
| WatermarkPicker | `src/components/WatermarkPicker.test.tsx` | ✅ |
| ProfilePage | `src/pages/ProfilePage.test.tsx` | ✅ |

### 已知质量反模式（需避免）

1. **不安全解构**: `const { data: { user } } = await supabase.auth.getUser()` — `data` 为 null 时抛 TypeError
   - 正确做法：`const user = (await supabase.auth.getUser())?.data?.user ?? null`
2. **DB 强依赖**: 本地保存与远程 DB 同步耦合，DB 失败阻塞本地保存
   - 正确做法：localStorage 主存储 + DB 辅助同步
