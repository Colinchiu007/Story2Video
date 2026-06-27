# Story2Video — 变更日志

## [当前版本] — 2026-06-27

### 测试
- 新增 GitHub Actions CI 流水线，使用 pnpm + vitest 自动运行测试
- `package.json`: 添加 `test` / `test:watch` script，移除 `lint` 中的 `tsgo` 依赖
- `slideshow.test.ts`: 扩展至 26 个测试用例（renderFrame 8个、renderTransition 7个、mapSubtitleStyle 4个、getVideoExtension 3个、createSlideshowVideo 3个、loadImage 1个）
- `history-prompt.test.ts`: 现有 37 个测试用例覆盖所有导出类（SentimentAnalyzer、EraDetector、DynastyDetector、VisualStyleSelector、DiversePromptGeneratorV10、HistoryArticleProcessorV9、splitTextForImages、generateImagePromptsWithNegative 等）
- `audio-mixer.test.ts`: 新增 8 个测试用例（mixAudio 5个、uploadMixedAudio 3个），覆盖 fetch/AudioContext/OfflineAudioContext mock
- PRD 新增「质量与测试」章节（§7），明确测试覆盖率要求与 CI 规范

## [当前版本] — 2026-06-21

### 功能
- AI 视频创作平台完整功能
- 文本输入 → TTS 语音生成（豆包/火山引擎）
- AI 图片生成（可灵/MiniMax/SenseNova/即梦/Vidu）
- AI 视频生成（可灵/即梦/Vidu/Sora）
- Canvas + MediaRecorder 客户端视频合成
- 语音克隆
- 提示词优化
- 25 个 Supabase Edge Functions
- 8 个前端页面（创建、进度、结果、历史、画廊、分段管理）

### 技术栈
- 前端：Vite + TypeScript + React 18 + Radix UI
- 后端：Supabase Edge Functions (Deno/TypeScript)
- 数据库：Supabase PostgreSQL
- 平台：秒哒（Miaoda）低代码平台

### 集成备注
- 本项目为纯前端 + Deno Edge Functions 架构
- 无 Python 后端代码
- 视频合成在浏览器客户端完成（Canvas + MediaRecorder）
- 绑定 `backend.appmiaoda.com` Supabase 实例
