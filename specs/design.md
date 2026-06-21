# 视频创作工具 — 架构设计文档

## 1. 系统架构

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      前端（React SPA）                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │   CreatePage  │ │  GalleryPage  │ │ Progress/Result/History│ │
│  │   创作首页     │ │  图片管理页   │ │    进度/结果/历史     │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │ VoiceClone   │ │  ApiSettings  │ │   AuthContext        │ │
│  │   音色克隆    │ │   API设置     │ │   认证上下文          │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP / WebSocket
┌─────────────────────────────────────────────────────────────┐
│                      后端（Supabase）                         │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │  PostgreSQL      │  │      Edge Functions (Deno)       │ │
│  │  video_tasks     │  │  ┌────────────┐ ┌──────────────┐ │ │
│  │  gallery_images  │  │  │tts-minimax │ │ clone-voice  │ │ │
│  │  profiles        │  │  │ 语音合成    │ │  音色克隆     │ │ │
│  │  user_settings   │  │  └────────────┘ └──────────────┘ │ │
│  └──────────────────┘  │  ┌────────────┐ ┌──────────────┐ │ │
│  ┌──────────────────┐  │  │text2video  │ │image2video   │ │ │
│  │  Storage         │  │  │ 文生视频    │ │ 图生视频      │ │ │
│  │  generated-media │  │  └────────────┘ └──────────────┘ │ │
│  │  generated-audio │  │  ┌────────────┐ ┌──────────────┐ │ │
│  └──────────────────┘  │  │image-gen   │ │video-remix   │ │ │
│                        │  │ 图片生成    │ │ 视频Remix   │ │ │
│                        │  └────────────┘ └──────────────┘ │ │
│                        └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTPS
┌─────────────────────────────────────────────────────────────┐
│                    第三方 AI 服务                              │
│  MiniMax TTS  │  可灵图片生成  │  Sora/Vidu/即梦 视频生成    │
│  豆包语音     │  豆包图像      │  豆包视频                    │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 前端框架 | React 18 + Vite | SPA，路由使用 react-router-dom |
| UI 组件 | shadcn/ui + Tailwind CSS | 原子化样式，内置暗黑模式 |
| 状态管理 | React Context + useState | 轻量级，无需 Redux |
| 后端服务 | Supabase | PostgreSQL + Edge Functions + Storage |
| 认证 | Supabase Auth | 支持手机 OTP、用户名密码、OAuth |
| ORM/API | supabase-js | 直接调用 REST/Realtime API |
| 部署 | 平台托管 | 前端静态部署，后端 Supabase 托管 |

---

## 2. 数据模型

### 2.1 核心表结构

#### video_tasks（视频任务表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| mode | text | 任务模式：text/image/remix/gallery |
| prompt | text | 用户输入的提示词/文案 |
| size | text | 视频尺寸，默认 720x1280 |
| seconds | integer | 视频时长 |
| status | text | 状态：pending/queued/processing/completed/failed |
| progress | integer | 进度百分比 |
| video_url | text | 生成后的视频 URL |
| audio_url | text | 背景音乐 URL |
| tts_audio_url | text | 语音合成音频 URL |
| tts_duration_seconds | integer | 语音时长（秒） |
| bgm_enabled | boolean | 是否启用背景音乐 |
| bgm_url | text | 背景音乐文件 URL |
| bgm_volume | integer | 背景音乐音量 0-100 |
| subtitle_enabled | boolean | 是否启用字幕 |
| subtitle_font | text | 字幕字体 |
| subtitle_size | text | 字幕大小 |
| subtitle_style | text | 字幕样式 |
| image_effect | text | 图片动效 |
| transition_effect | text | 转场效果 |
| error_message | text | 错误信息 |
| user_id | uuid | 关联用户（允许匿名） |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

#### gallery_images（轮播图片表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| task_id | uuid | 关联 video_tasks |
| image_url | text | 图片 URL |
| prompt | text | 图片提示词 |
| original_prompt | text | 原始提示词 |
| index | integer | 图片顺序 |
| created_at | timestamptz | 创建时间 |

#### profiles（用户资料表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 关联 auth.users |
| email | text | 邮箱 |
| phone | text | 手机号 |
| role | user_role | 角色：user/admin |

#### user_settings（用户设置表）

| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | uuid | 关联 profiles |
| minimax_api_key | text | MiniMax API 密钥 |
| doubao_api_key | text | 豆包 API 密钥 |
| jimeng_api_key | text | 即梦 API 密钥 |
| vidu_api_key | text | Vidu API 密钥 |
| doubao_voice_id | text | 豆包音色 ID |

---

## 3. 模块设计

### 3.1 前端页面模块

```
src/
├── pages/
│   ├── CreatePage.tsx      # 创作首页：模式选择、参数配置、生成入口
│   ├── GalleryPage.tsx     # 图片管理：查看/重生成图片、生成轮播视频
│   ├── ProgressPage.tsx    # 进度跟踪：轮询任务状态
│   ├── ResultPage.tsx      # 结果展示：播放视频、下载
│   ├── HistoryPage.tsx     # 历史记录：任务列表
│   └── LoginPage.tsx       # 登录/注册
├── components/
│   ├── VoiceCloneDialog.tsx    # 音色克隆弹窗
│   ├── ApiSettingsDialog.tsx   # API 设置弹窗
│   ├── BgmSettings.tsx         # 背景音乐配置
│   └── SubtitleSettings.tsx    # 字幕配置
├── services/
│   └── video.ts            # 视频/音频/图片 API 封装
├── lib/
│   ├── slideshow.ts        # Canvas 轮播视频合成
│   ├── audio-mixer.ts      # Web Audio API 音频混合
│   ├── segment.ts          # 文本智能分句
│   └── progress.ts         # 进度估算
└── contexts/
    └── AuthContext.tsx     # 全局认证状态
```

### 3.2 Edge Functions 模块

| 函数 | 职责 | 调用的外部 API |
|------|------|--------------|
| `tts-minimax` | 语音合成 | MiniMax TTS API |
| `clone-voice` | 音色克隆 | MiniMax Voice Clone API |
| `text2video` | 文生视频 | 即梦 / Sora / Vidu |
| `image2video` | 图生视频 | 即梦 / Sora / Vidu |
| `image-gen` | 图片生成 | 可灵 / 豆包 |
| `video-remix` | 视频编辑 | Sora / Vidu |

### 3.3 认证与权限设计

```
┌─────────────────────────────────────────┐
│             认证流程                      │
│                                         │
│  未登录用户 ──→ 点击生成按钮              │
│      │                                  │
│      ▼                                  │
│  检查 AuthContext.user                  │
│      │                                  │
│      ├─ user === null ──→ toast + 跳转登录页
│      │                                  │
│      └─ user !== null ──→ 继续执行生成逻辑│
│                                         │
│  登录成功后返回原页面（location.state）   │
└─────────────────────────────────────────┘
```

**RLS 策略**：
- `video_tasks`：允许所有访问（`USING (true)`），便于匿名用户查看进度
- `gallery_images`：允许所有访问
- `profiles` / `user_settings`：仅允许已认证用户访问自己的数据
- Storage `generated-media`：允许所有上传/读取
- Storage `generated-audio`：允许所有上传/读取

---

## 4. 关键流程设计

### 4.1 图片轮播视频生成流程

```
用户输入文案 + 选择参数
        │
        ▼
┌───────────────┐
│ 文本智能分句   │ ← lib/segment.ts（语义分句或按字数分句）
└───────────────┘
        │
        ▼
并行生成图片 + 并行生成语音
        │                    │
        ▼                    ▼
┌───────────────┐    ┌───────────────┐
│ 调用 image-gen │    │ 调用 tts-minimax│
│ 每张图独立生成 │    │ 生成口播音频    │
└───────────────┘    └───────────────┘
        │                    │
        ▼                    ▼
存储到 gallery_images    存储到 generated-audio
        │                    │
        └────────┬───────────┘
                 ▼
        ┌───────────────┐
        │ 用户确认图片   │ ← GalleryPage
        │ 可单张重新生成 │
        └───────────────┘
                 │
                 ▼
        ┌───────────────┐
        │ 生成轮播视频   │ ← lib/slideshow.ts (Canvas)
        │ - 图片动效     │
        │ - 转场效果     │
        │ - 字幕叠加     │
        │ - 背景音乐混合 │ ← lib/audio-mixer.ts
        └───────────────┘
                 │
                 ▼
        输出 MP4 视频文件
```

### 4.2 语音合成流程

```
用户输入文案
        │
        ▼
 选择音色/语速/音量/音调
        │
        ▼
调用 tts-minimax Edge Function
        │
        ├─ MiniMax API 返回 audio base64
        │
        ▼
Edge Function 解码并上传至 Storage
        │
        ▼
返回 publicUrl + audioLength（秒）
        │
        ▼
前端自动播放 / 用于后续视频合成
```

**音频时长兜底策略**：
- 优先使用 MiniMax API 返回的 `addition.duration`
- 若 API 未返回 duration，按文本长度估算：
  - 中文：每秒 4 字
  - 英文：每秒 3.5 词
  - 其他：每秒 6 字符
  - 根据语速倍率修正

### 4.3 音频混合流程

```
口播音频 MP3 + 背景音乐 MP3
        │
        ▼
Web Audio API 解码为 AudioBuffer
        │
        ▼
调整背景音乐音量（按 bgm_volume 百分比）
        │
        ▼
将两个 AudioBuffer 混合为单个 Buffer
        │
        ▼
编码为 WAV Blob
        │
        ▼
上传至 generated-audio Storage bucket
        │
        ▼
获取 publicUrl 用于视频合成
```

---

## 5. 错误处理设计

### 5.1 前端错误处理策略

| 错误类型 | 处理方式 |
|---------|---------|
| API 调用失败 | toast.error 显示中文错误信息 |
| 网络超时 | 自动重试 3 次，失败后提示用户 |
| 登录过期 | 自动跳转登录页，保留当前页面状态 |
| 文件上传失败 | 显示具体错误（格式/大小超限） |

### 5.2 Edge Function 错误处理

所有 Edge Function 统一返回 JSON 格式：
```json
{
  "error": "错误描述（中文）",
  "details": "可选的详细错误信息"
}
```

---

## 6. 性能优化设计

### 6.1 前端优化
- 图片懒加载 + 渐进加载
- 音频/视频使用 CDN 直链
- Canvas 轮播合成使用离屏渲染

### 6.2 后端优化
- 图片生成采用并行调用（Promise.all）
- 使用 Supabase Realtime 替代轮询（可选）
- Edge Function 超时设置：60-90 秒

### 6.3 存储优化
- Storage 文件设置 `cacheControl: '3600'`
- 自动生成 UUID 作为文件名避免冲突

---

## 7. 安全设计

### 7.1 登录拦截
- 所有消耗算力的操作（生成、试听、克隆）前端检查登录状态
- 未登录用户 toast 提示并跳转登录页

### 7.2 API 密钥安全
- 用户密钥存储在 `user_settings` 表中，仅自己可访问
- Edge Function 通过 `SUPABASE_SERVICE_ROLE_KEY` 访问数据库
- 密钥绝不传递到客户端

### 7.3 文件上传安全
- 图片：限制类型（JPEG/PNG/WebP），大小 ≤10MB
- 视频：限制类型（MP4/MOV），大小 ≤50MB
- 音频：限制类型（MP3/WAV/M4A），大小 ≤20MB
