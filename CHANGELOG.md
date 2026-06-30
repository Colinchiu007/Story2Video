# Story2Video — 变更日志

## [v1.5.1] — 2026-06-30

### 新增功能
- **小红书 ECS 发布实现**: xiaohongshu_publisher 完整实现（9 步 API 流程）
  - COS 分片上传（5MB 分片，3 次重试）+ 封面上传
  - getSign$6 本地 Node.js 签名（xiaohongshu_sign.js）
  - ffprobe 自动检测视频尺寸/时长

### 变更
- PLATFORMS 配置: xiaohongshu 从 coming_soon 移到可用平台
- PublishDialog 小红书按钮从禁用变为可点击

### 集成
- orchestrator publish.py: 新增 `elif platform == "xiaohongshu"` 分发
- orchestrator services/xiaohongshu_publisher.py: 全新 801 行 publisher
- orchestrator services/xiaohongshu_sign.js: 全新 22KB Node.js 签名脚本

## [v1.5.0] — 2026-06-30

### 新增功能
- **视频号 ECS 发布实现**: tencent_video_publisher 完整实现（5 步 API 流程）
  - auth_data → 获取 finderUsername / uin
  - helper_upload_params → 获取 authKey
  - applyuploaddfs → 初始化分片上传
  - uploadpartdfs → 8MB 分片上传（含重试）
  - completepartuploaddfs → 完成上传 / post_create → 提交发布
- **视频号封面上传**: 支持自动上传封面图片
- **视频号定时发布**: post_create 支持 effectiveTime 参数定时发布

### 变更
- PLATFORMS 配置: tencent_video 从 coming_soon 移到可用平台
- PublishDialog 视频号按钮从禁用变为可点击
- orchestrator: tencent_video 从 coming_soon → available，新增 dispatch

### 集成
- orchestrator publish.py: 新增 `elif platform == "tencent_video"` 分发
- orchestrator services/tencent_video_publisher.py: 全新 735 行 publisher

## [v1.4.0] — 2026-06-30

### 新增功能
- **定时发布** (8.2): PublishDialog 新增定时开关，支持选择未来时间定时发布
  - scheduled_at ISO 8601 字段从前端 → orchestrator 背景任务流转
  - asyncio.sleep() 在 background task 中等待到定时时间再执行
  - 状态生命周期扩展: pending → scheduled → downloading → publishing → success/failed
- **平台列表数据驱动**: PublishDialog 平台选择从 orchestrator-api PLATFORMS 配置数组动态渲染
- **平台框架扩展**: 视频号、小红书平台按钮已加入 PublishDialog（coming_soon 状态）

### 变更
- PublishDialog.tsx: 新增 Switch 定时开关 + datetime-local 输入 + scheduled 状态展示
- orchestrator-api.ts: Platform 联合类型扩展 (xiaohongshu, tencent_video) + PLATFORMS 配置数组
- orchestrator-api.ts: PublishRequest + scheduled_at 字段，mapStatus 新增 'scheduled' 映射
- ResultPage.tsx: 平台选择下拉框从 hardcoded 改为 PLATFORMS 数据驱动

### 后端
- orchestrator: VideoPublishRequest + scheduled_at 可选字段
- orchestrator: _publish_video 背景任务支持 ISO 8601 定时等待 (asyncio.sleep)
- orchestrator: 状态 'scheduled' 立即持久化，API 返回 scheduled_at 给前端轮询

### 集成
- orchestrator publish.py: supported/coming_soon 平台分组（视频号、小红书待实现）
## [v1.3.0] — 2026-06-29

### 新增功能
- **发布集成** (8.2): Story2Video 视频可一键发布到第三方平台
- PublishDialog 组件：平台选择（抖音/B站）、标题/简介/标签编辑、发布进度跟踪
- orchestrator-api 服务层：SSO 登录、publish-video API 调用、状态轮询
- GalleryPage: 视频结果区域新增「发布到...」按钮

### 集成
- orchestrator: 复用 `/api/jobs/publish-video` 端点 + bilibili_publisher / douyin_publisher
- 新增 `src/services/orchestrator-api.ts` — orchestrator SSO + 发布 API 封装
- 新增 `src/components/PublishDialog.tsx` — 发布交互弹窗

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
- AI 图片生成（可灵/MiniMax/S