# Changelog

## 2026-06-27 — Feature Complete Release

所有 18 个计划任务已处理完毕（12 个实现 + 3 个推迟 + 1 个阻塞 + 2 个支持性任务）。

### ✨ 新增功能

| # | 功能 | 说明 |
|---|------|------|
| 1 | 自定义水印 | WatermarkPicker 组件 + 配置存储 |
| 2 | 视频分享 | ShareButton + 分享链接生成 |
| 3 | BGM 演示 URL 替换 | SoundHelix → 生产音频 CDN |
| 4 | 批量导出 | zip 打包 + download |
| 5 | 音频生成模式 Tab | 创作页面新增 Tab |
| 6 | 分段视频模式 Tab | 创作页面新增 Tab |
| 9 | 视频编辑 | 基础 clip/cut UI + 字幕/BGM 编辑增强 |
| 10 | 用户个人主页 | 作品展示页面 |
| 11 | 视频模板 | 模板选择器 + 预设 |
| 12 | 视频特效库 | 滤镜选择器 + 转场选择器 |

### 🧪 测试覆盖

| # | 范围 | 说明 |
|---|------|------|
| 7 | 页面组件测试 | CreatePage, ResultPage, GalleryPage 等 |
| 8 | 服务层测试 | image-generation, video-generation, tts 等 |
| 18 | Edge Functions 测试 | Supabase Edge Functions |

### 📦 支持性任务

| # | 任务 | 说明 |
|---|------|------|
| 16 | 更新 PRD | 所有新功能已同步到 docs/prd.md |

### ⏸️ 推迟

| # | 功能 | 原因 |
|---|------|------|
| 13 | 多人协作 | 子系统级，需要独立设计文档 |
| 14 | 发布到第三方 | 子系统级，需要集成 Multi-Publish API |
| 15 | 付费会员 | 子系统级，需要集成 orchestrator 订阅系统 |

### ⛔ 阻塞

| # | 任务 | 原因 |
|---|------|------|
| 17 | E2E 集成测试 | 环境约束（FUSE 文件系统导致 npm install 超时） |

### 📝 提交记录

- `d58ca1f` — feat/watermark
- `714b8fd` — feat/share
- `2926306` — feat/templates
- `58134cd` — feat/effects
- `7e1334a` — 主合并提交
- `c66a001` — feat/edge-functions-tests
