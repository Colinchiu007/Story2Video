# Story2Video — 变更日志

## [v1.2.0] — 2026-06-27

### 新增功能
- **水印自定义** (7.10): WatermarkPicker 组件，支持位置、透明度、字号、颜色配置
- **视频分享** (7.11): ShareButton + Web Share API + 剪贴板降级 + 多平台跳转
- **批量导出** (7.12): BatchExportButton + zip-utils，并行 ZIP 打包
- **视频剪辑** (7.13): VideoClipEditor + useVideoClip hook，Canvas captureStream + MediaRecorder 浏览器端裁剪
- **用户个人主页** (7.14): ProfilePage，支持网格/列表双视图、视频悬停预览
- **视频模板** (7.16): VideoTemplatePicker + template-library，7 内置模板 + 自定义模板
- **视频特效库** (7.17): EffectPicker，10 种图片动效 + 6 种转场效果 + 推荐搭配

### 组件库
- 新增 WatermarkPicker / ShareButton / BatchExportButton / VideoClipEditor / VideoTemplatePicker / EffectPicker / ProfilePage 等 7 个组件
- 新增 useVideoClip hook + 配套测试
- 新增 zip-utils / share / watermark / bgm-library / effects-library / template-library 等 6 个工具库

### 集成
- CreatePage: 集成模板选择器 + 特效选择器 + BGM 配置 + 字幕配置
- ResultPage: 集成分享按钮 + 视频剪辑入口
- GalleryPage: 集成批量导出 + 暗色模式修复
- ProfilePage: 新增侧边栏导航入口 (/profile)
- 服务层: api-config / gallery / image-generation / tts / video-generation / voice-clone 类型与配置更新

## [当前版本] — 2026-06-27

### 测试
- 新增 GitHub Actions CI 流水线，使用 pnpm + vitest 自动运行测试
- `package.json`: 添加 `test` / `test:watch` script，移除 `lint` 中的 `tsgo` 依赖
- `slideshow.test.ts`: 扩展至 26 个测试用例（renderFrame 8个、renderTransition 7个、mapSubtitleStyle 4个、getVideoExtension 3个、createSlideshowVideo 3个、loadImage 1个）
- `history-prompt.test.ts`: 现有 37 个测试用例，覆盖所有导出类
- `audio-mixer.test.ts`: 新增 8 个测试用例（mixAudio 5个、uploadMixedAudio 3个），覆盖 fetch/AudioContext/OfflineAudioContext mock
- 新增 Edge Functions 测试套件: api-health-check / optimize-prompt / short-speech-recognition（14 个测试）
- PRD 新增「质量与测试」章节（§7），明确测试覆盖率要求与 CI 规范

## [v1.0.0] — 2026-06-21

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
