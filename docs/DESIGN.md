---
name: story2video-design
description: Story2Video DESIGN.md — 渲染管线与 AI 服务设计
---

# Story2Video — 设计文档

> **版本**: v0.5.0 | **更新**: 2026-07-01

## 一、客户端视频合成设计

### 1.1 渲染管线

```
Text Layout → 解析字幕 → 布局计算 → Canvas 绘制
    │
Image Decode → 图片解码 → 缩放/裁剪
    │
Render Frame → Ken Burns 缩放/平移
    │
Transition Mix → 转场动画（淡入/淡出/滑动）
    │
Record Media → MediaRecorder → WebM Blob
```

### 1.2 Ken Burns 效果

| 参数 | 默认值 | 说明 |
|------|--------|------|
| scale_range | [1.0, 1.15] | 缩放范围 |
| pan_x | [0, 30] | 水平偏移 |
| pan_y | [0, 20] | 垂直偏移 |
| duration | 5s | 单帧时长 |

### 1.3 AudioMixer

基于 Web Audio API：

```
TTS Audio → GainNode(talk) → ┐
                              ├──→ Destination
BGM Audio → GainNode(music) → ┘
```

独立控制 TTS 和 BGM 音量，支持淡入淡出。

---

## 二、Edge Functions 设计

| 函数 | 输入 | 输出 | 第三方服务 |
|------|------|------|-----------|
| tts-minimax | text, voice_id | audio_url | Minimax TTS API |
| clone-voice | audio_sample | voice_id | Minimax Voice Clone |
| text2video | prompt | video_url | Kling / Runway |
| image2video | image_url, prompt | video_url | Kling img2vid |
| image-gen | prompt | image_url | Dall-E 3 |
| video-remix | video_url, style | video_url | Runway remix |

---

## 三、组件树

```
App
├── CreatePage
│   ├── ModeSelector (text2video / image2video / remix)
│   ├── PromptInput
│   ├── ImageUploadSection
│   ├── TemplateSection
│   ├── SettingsGrid (resolution, fps, style)
│   └── SubmitSection → orchestrator API
│
├── GalleryPage
│   ├── VideoGrid → VideoCard[]
│   ├── PublishDialog
│   │   └── PlatformSelector
│   └── LoadingSkeleton
│
└── common/
    ├── ApiSettingsDialog
    └── AudioPreviewButtons
```
