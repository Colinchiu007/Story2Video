# Story2Video — 变更日志

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
