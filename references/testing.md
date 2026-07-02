# Story2Video — 测试规范

## TDD 流程

```
RED   → 在 src/lib/*.test.ts 或 src/pages/**/__tests__/ 写失败测试
GREEN → 最小实现让测试通过
REFACTOR → 重构，保持测试通过
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

