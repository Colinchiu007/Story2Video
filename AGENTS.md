# Story2Video — 开发规范

> AI 视频创作平台的开发流程与编码约定。

## 项目背景

Story2Video 是基于**秒哒（Miaoda）**低代码平台构建的 AI 视频创作工具，技术栈为：

| 层 | 技术 |
|----|------|
| **前端** | Vite + TypeScript + React 18 |
| **后端** | Supabase Edge Functions (Deno/TypeScript) |
| **数据库** | Supabase PostgreSQL |
| **AI 服务** | 豆包 TTS、可灵视频生成、MiniMax 图片生成 |

## 核心原则

1. **秒哒平台约束**：项目构建和部署依赖秒哒平台，不随意修改 `miaoda-*` 相关配置。
2. **Edge Functions 优先**：所有 AI API 调用通过 Supabase Edge Functions 代理，不在前端直接暴露 API Key。
3. **客户端视频合成**：视频渲染使用 Canvas + MediaRecorder API，仅在浏览器环境运行。
4. **Supabase 实例绑定**：当前绑定 `backend.appmiaoda.com` 的 Supabase 实例，迁移需全面测试。

## 开发流程

### 本地开发

```bash
npm install
npm run dev -- --host 127.0.0.1
```

### Edge Functions 开发

Edge Functions 位于 `supabase/functions/` 目录，使用 Deno/TypeScript：

```bash
# 本地测试 Edge Function
cd supabase/functions/tts-minimax
deno run --allow-net --allow-env index.ts
```

### 修改 Edge Function

1. 在 `supabase/functions/<name>/index.ts` 中修改
2. 本地用 Deno 测试
3. 通过秒哒平台部署

## AI 角色分工

| 角色 | 职责 |
|------|------|
| **前端工程师** | React 组件、Canvas 渲染、状态管理 |
| **后端工程师** | Edge Functions、Supabase 数据库设计 |
| **AI 工程师** | TTS/图片生成/视频生成 API 对接 |
| **QA** | 端到端视频生成流程测试 |

## 目录结构

```
Story2Video/
├── src/                     # React 前端
│   ├── pages/               # 8 个页面
│   ├── components/          # UI 组件
│   ├── services/            # Supabase 调用
│   ├── lib/                 # 核心逻辑
│   │   ├── slideshow.ts     # Canvas 视频合成
│   │   ├── audio-mixer.ts   # Web Audio 混音
│   │   └── text-segmentation.ts  # 文本分段
│   └── db/                  # 数据库配置
├── supabase/
│   ├── functions/           # 25 个 Edge Functions
│   └── schema.sql           # 数据库模式
├── specs/                   # 规格文档
│   ├── requirements.md      # EARS 格式需求
│   ├── design.md            # 系统设计
│   └── feature-kling-video.md
├── docs/
│   └── prd.md               # 产品需求文档
└── package.json
```

## 安全注意事项

1. **API Key 不暴露前端**：所有 AI API Key 存储在 Supabase Edge Function 的环境变量中。
2. **Supabase 连接信息**：`.env` 中的 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY` 不提交到公开仓库。
3. **用户数据隔离**：所有数据库查询通过 RLS（Row Level Security）策略限制用户只能访问自己的数据。

## 提交规范

```
feat: 添加可灵视频生成 Edge Function
fix: 修复音频混音音量问题
docs: 更新 PRD 视频生成章节
refactor: 重构 slideshow.ts Canvas 渲染逻辑
```

## 版本

当前为秒哒平台导出版本，无独立版本号。
