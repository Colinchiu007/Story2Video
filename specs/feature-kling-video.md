# Feature: 可灵（Kling）视频生成

> 规范驱动开发文档 — 需求 + 设计合并版

## 1. 需求（Requirements）

### 1.1 背景
当前项目的视频生成支持即梦（Jimeng）、Vidu 和 Sora 三种模型。用户希望在视频模型选项中增加「可灵（Kling）」，以便通过可灵 API 生成文生视频和图生视频。

### 1.2 功能需求（EARS 格式）

#### FR-KV-001 可灵文生视频
When 用户在创作页选择「文生视频」模式，并在设置中选择「可灵」作为视频模型提供商，  
The 系统 SHALL 调用可灵文生视频 API，根据用户输入的文本描述生成视频，  
Where 支持配置视频尺寸（720x1280、1280x720 等）和时长（5/10 秒）。

#### FR-KV-002 可灵图生视频
When 用户在创作页选择「图生视频」模式并上传参考图片，且在设置中选择「可灵」作为视频模型提供商，  
The 系统 SHALL 调用可灵图生视频 API，基于参考图片生成动态视频，  
Where 同时支持用户输入额外的动作/效果描述文本。

#### FR-KV-003 视频生成任务查询
When 可灵视频生成任务提交后，  
The 系统 SHALL 每 5 秒轮询查询任务状态，  
Where 任务状态包括：processing（生成中）、succeed（完成）、failed（失败）。

#### FR-KV-004 视频结果自动转存
When 可灵视频生成任务状态变为 succeed 时，  
The 系统 SHALL 自动将生成的视频文件下载并转存到 Supabase Storage 的 `generated-videos` bucket 中，  
Where 转存后使用 Supabase 的 public URL 替换原始第三方 URL。

#### FR-KV-005 模型提供商选择
When 用户打开 API 设置弹窗并切换到「视频模型」标签，  
The 系统 SHALL 在提供商列表中显示「可灵」选项，  
Where 可灵既支持「内置 AI」（使用平台密钥），也支持「自定义 API」（用户自备密钥）。

#### FR-KV-006 错误处理
When 可灵视频生成 API 返回错误时，  
The 系统 SHALL 将错误信息以中文形式展示给用户，  
Where 常见错误包括：余额不足、参数错误、生成超时、内容审核不通过。

### 1.3 非功能需求

- NFR-KV-001：可灵视频生成任务 SHALL 支持最长 10 秒的视频生成
- NFR-KV-002：图生视频 SHALL 支持 JPEG/PNG/WebP 格式的参考图片，大小不超过 10MB
- NFR-KV-003：Edge Function 超时 SHALL 设置为 60 秒（提交）/ 90 秒（查询含下载转存）

---

## 2. 设计（Design）

### 2.1 架构变更

新增两个 Edge Function：

| Edge Function | 职责 | 调用的外部 API |
|--------------|------|--------------|
| `kling-create-video` | 提交可灵视频生成任务 | 可灵视频生成 Gateway |
| `kling-query-video` | 查询任务状态 + 视频转存 | 可灵视频生成 Gateway + Supabase Storage |

前端变更：

| 文件 | 变更内容 |
|------|---------|
| `src/services/video.ts` | 新增 `useKlingForVideo()`，更新 `startTextToVideo`/`startImageToVideo`/`queryVideoGeneration` 支持可灵分支 |
| `src/components/ApiSettingsDialog.tsx` | 视频模型选项列表添加「可灵」 |
| `src/services/video.test.ts` | 更新测试用例覆盖可灵视频逻辑 |

### 2.2 数据流

```
用户输入 prompt + 选择可灵
        │
        ▼
┌─────────────────────┐
│ startTextToVideo()  │ ← 检测到 provider === 'kling'
│ 或 startImageToVideo()│
└─────────────────────┘
        │
        ▼
调用 kling-create-video Edge Function
        │
        ├─ 文生视频: POST /v1/videos/text2video
        └─ 图生视频: POST /v1/videos/image2video
        │
        ▼
    返回 task_id
        │
        ▼
写入 video_tasks 表（video_id = task_id）
        │
        ▼
ProgressPage 轮询 queryVideoGeneration()
        │
        ▼
调用 kling-query-video Edge Function
        │
        ├─ GET /v1/videos/{task_id}
        │
        ▼
    状态 = succeed?
        │
        ├─ 是 → 下载视频 → 上传 Storage → 返回 publicUrl
        └─ 否 → 返回当前状态
```

### 2.3 API 接口设计

#### kling-create-video（Edge Function）

请求体：
```json
{
  "prompt": "一只小猫在草地上奔跑",
  "mode": "text-to-video",        // 或 "image-to-video"
  "input_reference_url": "https://...", // 图生视频时必填
  "size": "720x1280",
  "seconds": 5,
  "negative_prompt": "模糊, 低质量",
  "cfg_scale": 5,
  "model_name": "kling-v1-6"
}
```

响应：
```json
{
  "videoId": "kl-xxx-xxx",
  "status": "processing"
}
```

#### kling-query-video（Edge Function）

请求体：
```json
{
  "video_id": "kl-xxx-xxx"
}
```

响应：
```json
{
  "status": "succeed",
  "progress": 100,
  "video_url": "https://...",
  "publicUrl": "https://storage..."  // 转存后的 URL
}
```

### 2.4 前端 Provider 选择逻辑

```typescript
// services/video.ts
function getVideoProvider(): string {
  // 返回 'jimeng' | 'vidu' | 'kling' | 'other'
}

export function useKlingForVideo(): boolean {
  return getVideoProvider() === 'kling';
}

// startTextToVideo / startImageToVideo
if (provider === 'kling') {
  functionName = 'kling-create-video';
  // body 不需要额外 apiKey（使用平台 INTEGRATIONS_API_KEY）
} else if (provider === 'vidu' && viduKey) {
  // ...
}

// queryVideoGeneration
if (provider === 'kling') {
  functionName = 'kling-query-video';
} else if (provider === 'vidu' && viduKey) {
  // ...
}
```

### 2.5 可灵 API 参数映射

| 前端参数 | 可灵 API 参数 | 转换逻辑 |
|---------|-------------|---------|
| size: "720x1280" | aspect_ratio | "9:16" |
| size: "1280x720" | aspect_ratio | "16:9" |
| size: "720x720" | aspect_ratio | "1:1" |
| seconds: 5/8/10 | duration | 取值为 5 或 10（可灵只支持这两个值） |
| prompt | prompt | 直接传递 |
| inputReferenceUrl | image | 图生视频时传递 |

### 2.6 错误码映射

| 可灵错误码 | 中文提示 |
|-----------|---------|
| 400 参数错误 | 生成参数有误，请检查输入内容 |
| 402 余额不足 | 可灵 API 余额不足，请联系管理员 |
| 429 请求过于频繁 | 操作过于频繁，请稍后再试 |
| 500 服务端错误 | 可灵服务暂不可用，请稍后重试 |
| content_moderation | 内容审核不通过，请修改描述后重试 |

---

## 3. 验收标准

- [ ] API 设置弹窗的视频模型选项中可以看到「可灵」
- [ ] 选择可灵后，文生视频可以正常提交并生成
- [ ] 选择可灵后，图生视频可以正常提交并生成
- [ ] 进度页可以正确轮询可灵任务状态
- [ ] 生成完成后视频自动转存到 Storage
- [ ] 所有错误场景都有中文提示
- [ ] lint 通过，单元测试通过
