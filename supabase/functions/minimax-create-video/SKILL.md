---
name: minimax-video-generation
description: MiniMax 视频生成 Skill - 文生视频、图生视频、首尾帧视频
type: workflow
---

# MiniMax 视频生成 Skill

MiniMax (海螺 AI) 视频生成 API 的 Supabase Edge Function 封装，支持文生视频、图生视频等多种模式。

## API 端点

| 函数 | HTTP Method | 端点 |
|:---|:---|:---|
| 创建任务 | POST | `minimax-create-video` |
| 查询状态 | POST | `minimax-query-video` |

## 模型选择

| 模型 | 用途 | 分辨率 | 时长 |
|:---|:---|:---|:---|
| `MiniMax-Hailuo-2.3` | 文生视频 (推荐) | 1080P | 6秒 |
| `MiniMax-Hailuo-02` | 文生视频 | 768P | 6/10秒 |
| `T2V-01` | 文生视频 | 720P | 6秒 |
| `I2V-01` | 图生视频 | 720P | 6秒 |

## 使用示例

### 1. 文生视频

```typescript
// 步骤 1: 创建任务
const createRes = await supabase.functions.invoke("minimax-create-video", {
  body: {
    prompt: "镜头拍摄一个女性坐在咖啡馆里，女人抬头看着窗外，镜头缓缓移动拍摄到窗外的街道",
    model: "MiniMax-Hailuo-2.3",
    duration: 6,
    resolution: "1080P",
  },
});

const { videoId } = createRes.data;
console.log("任务 ID:", videoId);

// 步骤 2: 轮询查询状态 (建议间隔 10 秒)
let status = "processing";
while (status === "processing") {
  await new Promise(r => setTimeout(r, 10000));
  
  const queryRes = await supabase.functions.invoke("minimax-query-video", {
    body: { video_id: videoId },
  });
  
  status = queryRes.data.status;
  console.log("状态:", status);
  
  if (status === "Success") {
    console.log("视频 URL:", queryRes.data.publicUrl);
  }
}
```

### 2. 图生视频

```typescript
// 使用 first_frame_image 参数
const createRes = await supabase.functions.invoke("minimax-create-video", {
  body: {
    prompt: "女人缓缓站起来，走向门口",
    first_frame_image: "https://example.com/input.jpg",
    model: "MiniMax-Hailuo-2.3",
    duration: 6,
  },
});
```

### 3. 自定义 API Key

```typescript
const createRes = await supabase.functions.invoke("minimax-create-video", {
  body: {
    minimax_api_key: "your-api-key-here",
    prompt: "...",
  },
});
```

## 请求参数

### minimax-create-video

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|:---|:---|:---|:---|:---|
| `prompt` | string | 条件 | - | 视频描述，最大 2000 字符 |
| `model` | string | 否 | `MiniMax-Hailuo-2.3` | 模型名称 |
| `operation` | string | 否 | `text_to_video` | `text_to_video` 或 `image_to_video` |
| `first_frame_image` | string | 条件 | - | 图生视频时必填，图片 URL |
| `duration` | number | 否 | 6 | 视频时长（秒） |
| `resolution` | string | 否 | `1080P` | 分辨率: 512P/720P/768P/1080P |
| `prompt_optimizer` | boolean | 否 | `true` | 是否自动优化 prompt |
| `aigc_watermark` | boolean | 否 | `false` | 是否添加水印 |
| `minimax_api_key` | string | 否 | 环境变量 | 自定义 API Key |

### minimax-query-video

| 参数 | 类型 | 必填 | 说明 |
|:---|:---|:---|:---|
| `video_id` | string | ✅ | 创建任务返回的 task_id |
| `auto_upload` | boolean | 否 | 是否自动上传到 Storage（默认 true） |
| `minimax_api_key` | string | 否 | 自定义 API Key |

## 响应格式

### 创建任务响应

```json
{
  "videoId": "106916112212032",
  "status": "processing",
  "model": "MiniMax-Hailuo-2.3",
  "operation": "text_to_video",
  "duration": 6,
  "resolution": "1080P"
}
```

### 查询状态响应

```json
{
  "videoId": "106916112212032",
  "status": "Success",
  "fileId": "file_xxx",
  "videoUrl": "https://...",
  "publicUrl": "https://..."
}
```

### 状态值

| status | 含义 |
|:---|:---|
| `processing` | 处理中，继续轮询 |
| `Success` | 成功，可在 publicUrl 获取视频 |
| `Fail` | 失败，查看 error 字段 |

### 错误码

| code | 含义 |
|:---|:---|
| 1002 | 触发限流，请稍后重试 |
| 1004 | 账号鉴权失败 |
| 1008 | 余额不足 |
| 1026 | 内容涉及敏感 |
| 2013 | 参数异常 |
| 2049 | 无效 API Key |

## 环境变量

在 Supabase Edge Function 中设置:

```
MINIMAX_API_KEY=your-api-key-here
```

## 运镜指令

在 prompt 中使用以下指令控制镜头运动:

```
[左移], [右移], [左摇], [右摇]
[推进], [拉远], [上升], [下降]
[上摇], [下摇], [变焦推近], [变焦拉远]
[晃动], [跟随], [固定]
```

## 速率限制

| 用户类型 | 视频生成 RPM |
|:---|:---|
| 免费用户 | 5 次/分钟 |
| 充值用户 | 20 次/分钟 |

## 注意事项

1. **轮询间隔**: 建议 10 秒，避免触发限流
2. **Prompt 优化**: 如需精确控制，建议设置 `prompt_optimizer: false`
3. **分辨率**: 1080P 仅支持 6 秒，10 秒仅支持 768P
4. **图片要求**: JPG/PNG/WebP，小于 20MB，短边 > 300px

## 文档链接

- [文生视频 API](https://platform.minimaxi.com/api-reference/video-generation-t2v)
- [图生视频 API](https://platform.minimaxi.com/api-reference/video-generation-i2v)
- [产品定价](https://platform.minimaxi.com/guides/pricing-paygo#视频)
