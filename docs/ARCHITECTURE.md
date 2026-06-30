---
name: story2video-architecture
description: Story2Video ARCHITECTURE.md — 系统架构
---

# Story2Video — 架构文档

> **版本**: v0.5.0 | **更新**: 2026-07-01
> **定位**: 客户端视频合成 + 云端 AI 服务编排

## 一、系统架构

```
Browser (React SPA)
   │
   ├── orchestrator (:8000) ──┬── Supabase (Edge Functions)
   │                          │   ├── tts-minimax
   │                          │   ├── clone-voice
   │                          │   ├── text2video / image2video
   │                          │   ├── image-gen
   │                          │   └── video-remix
   │                          │
   │                          └── Third-party AI APIs
   │                              ├── Minimax TTS
   │                              ├── Kling / Runway Video
   │                              └── Dall-E / Midjourney Image
   │
   └── Canvas API + MediaRecorder（客户端视频合成）
       ├── Text Layout → 字幕渲染
       ├── Image Decode → 图片帧解码
       ├── Render Frame → Ken Burns 动画
       ├── Transition Mix → 转场混合
       └── Record Media → WebM 录制
```

## 二、数据模型

```sql
-- video_tasks 核心表
id          uuid PRIMARY KEY
mode        text CHECK (text2video, image2video, remix)
prompt      text           -- 用户提示词
status      text CHECK (pending, processing, completed, failed)
progress    int DEFAULT 0  -- 0-100
video_url   text           -- 输出视频地址
tts_audio_url text         -- TTS 音频地址
images      jsonb          -- 图片素材数组
created_at  timestamptz
updated_at  timestamptz
```

## 三、部署架构

| 组件 | 部署方式 |
|------|---------|
| 前端 SPA | Supabase Storage (静态托管) |
| API | Supabase Edge Functions (Deno) |
| 视频存储 | Supabase Storage |
| 数据库 | Supabase PostgreSQL |
| AI 服务 | 第三方 API（通过 Edge Functions 转发）|

## 四、目录结构

```
src/
├── components/       # React 组件
│   ├── CreatePage/   # 视频创建页
│   ├── GalleryPage/  # 视频画廊
│   └── common/       # 通用组件
├── hooks/            # 自定义 hooks
├── lib/              # 工具库
│   ├── orchestrator-api.ts  # orchestrator 通信
│   └── video-renderer.ts    # 客户端视频合成
├── services/         # 业务服务
│   └── video-service.ts
└── types/            # TypeScript 类型
```
