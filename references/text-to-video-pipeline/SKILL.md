---
name: text-to-video-pipeline
description: 将文本内容转化为带配音和字幕的视频。通过 4 阶段流水线（语义分句 → Prompt 优化 → 图片生成 → 视频合成）实现全自动视频生成，适用于纪录片、历史叙事、故事讲解等场景。
type: workflow
---

# text-to-video Pipeline

将文本内容通过 4 阶段流水线自动转化为带 AI 配音和烧录字幕的视频。

## Pipeline 总览

```
阶段 1: 语义分句        阶段 2: Prompt 优化     阶段 3: 图片生成        阶段 4: 视频合成
─────────────────►  ──────────────────────►  ───────────────────►  ──────────────────►
分句引擎              MiniMax-M3 优化          MiniMax image-01     FFmpeg + 配音 + 字幕
18 场景               干净英文 Prompt           18 张图 (1152×864)    9.5 分钟成品
```

## 核心概念

### API Key 分工（必须严格区分）

| Key 前缀 | 用途 | 模型 | 端点 |
|---------|------|------|------|
| `sk-cp-` 开头 | MiniMax 文本 | `MiniMax-M3` | `api.minimaxi.com/v1` |
| `sk-` 开头（不含 `cp-`）| MiMo TTS 音色克隆 | `mimo-v2.5-tts-voiceclone` | `api.xiaomimimo.com/v1` |

> **绝对禁止混用**。MiniMax Key 不能调 MiMo，MiMo Key 不能调 MiniMax。
> `.env` 中必须分开配置，变量名：`MINIMAX_API_KEY` / `MIMO_API_KEY`。

### MiniMax 图片 API 响应格式（关键！）

MiniMax 图片 API 返回的 URL 字段是 **`data.image_urls[0]`（数组）**，不是 `data.image_url`。

```python
# 正确：3 层兼容，从 data.image_urls 数组取第一个
def get_image_url(result):
    urls = result.get("data", {}).get("image_urls", [])
    if urls:
        return urls[0]
    # 兜底旧格式和最外层格式
    url = result.get("data", {}).get("image_url", "")
    if url:
        return url
    return result.get("image_url", "")
```

### TTS 时长控制

**优先级规则**：时长控制有 3 个选项，按优先级选用。

| 优先级 | 方法 | 适用条件 | 时长来源 |
|--------|------|---------|---------|
| 🥇 **1st** | TTS 实际时长 | `--mode full` 已执行 | `full_tts_report.json` → `estimated_duration` |
| 🥈 **2nd** | 字符数比例估算 | 有各场景字数 | 总时长 × (该场景字数 / 总字数) |
| 🥉 **3rd** | 固定值兜底 | 无 TTS 报告 | 固定 6 秒/图 |

`full_tts_report.json` 中 `scene_durations` 是 **list**（按 `scene_id` 索引），不是 dict：

```python
# 1st: 有 TTS 报告
with open("full_tts_report.json") as f:
    tts_report = json.load(f)
scene_info = {item["scene_id"]: item for item in tts_report["scene_durations"]}
total_duration = tts_report["total_audio_duration"]
sd = scene_info.get(scene_index, {})
duration = sd.get("estimated_duration", 6.0)

# 2nd: 无报告但有字数
total_chars = sum(s["chars"] for s in scenes)
duration = total_duration * (scenes[i]["chars"] / total_chars)

# 3rd: 无任何信息，固定值兜底
duration = 6.0
```

**⚠️ 音画不同步风险**：TTS 报告存在时未使用其时长，而用固定值替代，会导致配音与画面明显不同步。

| 场景字数 | TTS 实际 | 固定 6s | 偏差 |
|---------|---------|---------|------|
| 113字 | 31.4s | 6s | 差 +25s |
| 86字 | 53.0s | 6s | 差 +47s |
start_time = sd.get("start_time", 0)
```

### video-compositor 参数名

`SubtitleSegment` 参数名是 **`start_time` / `end_time`**，不是 `start` / `end`：

```python
SubtitleSegment(
    text=scene_text,
    start_time=current_time,          # ← 正确
    end_time=current_time + duration, # ← 正确
)
```

---

## 阶段详解

### 阶段 1: 语义分句

**输入**：完整文案文本
**输出**：`scenes.json`（含 `scenes[]` 每个元素 `{text, scene_id}`）

**方法**：使用分句引擎按语义自然断点切分，避免句子中途截断。典型 18 分钟文案 → 18 个场景，每个 25-50 秒配音。

**环境变量依赖**：无

### 阶段 2: Prompt 优化

**输入**：`scenes.json`
**输出**：`scenes_optimized.json`（含 `prompt` 字段）

**方法**：
1. 每个场景的中文文案用 MiniMax-M3 优化为英文绘图 prompt
2. 过滤掉模型内部思考文本（如 `<think>...</think>`、`<think>...</think>`）
3. 手工润色确保画面感强、无敏感词

**环境变量依赖**：`MINIMAX_API_KEY`（`sk-cp-` 开头）

**质量门禁**：
- Prompt 不能含 `blood`、`massacre`、`kill`、`death` 等敏感词
- 如有，换 `tears`、`uprising`、`conflict`、`tragedy` 替代
- 每个 prompt 必须有明确主体 + 场景 + 光线/氛围词

### 阶段 3: 图片生成

**输入**：`scenes_optimized.json` 中的 `prompt` 字段
**输出**：`images/scene_00.png` ~ `scene_17.png`（18 张）

**方法**：逐场景调用 MiniMax 图片生成 API，保存到 `images/` 目录。

**环境变量依赖**：`MINIMAX_API_KEY`

**质量门禁**：
- 每张图生成后检查文件大小 > 50KB（小于 = 下载失败，需重试）
- 小文件原因通常是 API 返回了占位图或下载失败
- 如遇错误码 `1026`（敏感内容），用更安全的 prompt 重试（见下方敏感词替换表）
- 批量生成必须串行或限并发（≤ 3），禁止无限制 `Promise.all`

**敏感 prompt 替换表**（遇到 1026 时使用）：

| 场景 | 原词（触发敏感） | 替换为 |
|------|---------------|--------|
| 含暴力/死亡 | blood, massacre, kill, death | tears, uprising, conflict, tragedy |
| 含华人血案 | massacre, slaughter, massacre of | uprising, expulsion, crackdown |
| 含西班牙人 | oppression, tyranny | colonial rule, Spanish garrison |

### 阶段 4: 视频合成

**输入**：18 张图片 + TTS 音频 + 字幕
**输出**：`manila_2026_tts.mp4`

**方法**：

```
Step 4a: 全量 TTS
  输入: scenes.json, 音色样本 WAV, API Key
  输出: tts/full.wav (20MB), tts/full_tts_report.json
  命令: python mimo_tts.py --mode full --input scenes.json --voice 音色样本.wav

Step 4b: 逐场景生成视频片段（FFmpeg zoom-in）
  每张图用 zoompan 生成对应时长的 mp4 片段
  时长从 full_tts_report.json 读取（精确到 0.1s）

Step 4c: 拼接 + 字幕 + 配音
  FFmpeg concat demuxer 拼接所有片段
  subtitles 滤镜烧录中文字幕（ASS 格式）
  混入 tts/full.wav 音频
```

**环境变量依赖**：`MIMO_API_KEY`（`sk-` 开头）

**质量门禁**（FFmpeg Windows 专有）：

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| `Unable to parse option value "...full.ass" as image size` | FFmpeg 把 `d:` 冒号当分隔符 | ASS 文件放项目目录，用相对路径，`cwd=BASE_DIR` |
| `malloc of size 3325760 failed` | `scale=1920` 对 1152×864 图片 upscale 内存爆 | `scale=1280:-1` 不 upscale |
| concat 文件乱码 | BOM 写入 concat list | `open(file, "w", encoding="utf-8")` 无 BOM |
| ASS 中文乱码 | 字体名含中文路径 | 用 `msyh.ttc` 绝对路径或相对路径 |
| `-map 1:a` 无效 | 没有第二个 `-i` 输入 | 必须加 `-i tts_audio_path` |

**FFmpeg 命令模板**：

```bash
# 逐场景生成（zoom-in 效果）
ffmpeg -y -loop 1 -i "scene_XX.png" \
  -filter_complex "[0:v]scale=1280:-1,zoompan=z='min(zoom+0.0005,1.08)':d={N_FRAMES}:s=1280x720:fps=30,format=yuv420p[v]" \
  -map "[v]" -t {DURATION}s \
  -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -r 30 \
  "clip_XX.mp4"

# 拼接
ffmpeg -y -f concat -safe 0 -i concat.txt -c copy video_only.mp4

# 字幕 + 配音（正斜杠路径 + cwd 解决 d: 冒号问题）
ffmpeg -y -i "d:/Data/projects/temp/manila_video/video_only.mp4" \
  -i "d:/Data/projects/temp/manila_video/tts/full.wav" \
  -filter_complex "[0:v]subtitles='full.ass':original_size=1280x720[v]" \
  -map "[v]" -map 1:a \
  -c:v libx264 -preset fast -crf 20 \
  -c:a aac -b:a 128k -shortest \
  "manila_2026_tts.mp4"
```

**合成前完整性检查**：

```python
def verify_before_compose(image_dir, scene_count, min_size=50_000):
    """视频合成前必须检查"""
    issues = []
    for i in range(scene_count):
        path = os.path.join(image_dir, f"scene_{i:02d}.png")
        if not os.path.exists(path):
            issues.append(f"场景 {i}: 文件不存在")
        elif os.path.getsize(path) < min_size:
            issues.append(f"场景 {i}: 文件过小 ({os.path.getsize(path)} bytes)")
    if issues:
        raise ValueError(f"图片检查失败:\n" + "\n".join(issues))
```

---

## 应用示例

### 完整流水线调用

```
用户: 把这段文案变成视频
→ 自动加载 text-to-video-pipeline skill
→ 阶段 1: 分句（18 场景）
→ 阶段 2: MiniMax-M3 优化 prompt（检查 MINIMAX_API_KEY 可用性）
→ 阶段 3: 生成 18 张图（检查 MiMo API Key 有效性）
→ 阶段 4: TTS 全量 + FFmpeg 合成
→ 输出: manila_2026_tts.mp4
```

### 快速调试（单场景）

```bash
# 测试 MiniMax 图片 API
python -c "
import urllib.request, json
API_KEY = 'sk-cp-...'
payload = {'model':'image-01','prompt':'Manila 1603, Chinese merchants by river, Spanish fort in background','num_images':1}
req = urllib.request.Request('https://api.minimaxi.com/v1/images/generations',
    data=json.dumps(payload).encode(), headers={'Authorization':f'Bearer {API_KEY}','Content-Type':'application/json'})
with urllib.request.urlopen(req) as r:
    result = json.loads(r.read())
    print('URL:', result['data']['image_urls'][0])  # ← 必须是 image_urls[0]
"

# 测试 MiMo TTS
python -c "
import urllib.request, json, base64
API_KEY = 'sk-...'  # MiMo key, 不是 sk-cp-
# 音色样本转 base64 data URI
...
payload = {'model':'mimo-v2.5-tts-voiceclone','messages':[...],'audio':{'format':'wav','voice':voice_uri,'speed':1.2}}
# 测试通过 → 写入 .env
"
```

---

## 常见反模式

### ❌ 直接用 `data.image_url`
MiniMax 新 API 已改为 `data.image_urls[0]`（数组），旧代码会取到空值。

### ❌ 用 MiniMax Key 调 MiMo
`sk-cp-` 是 MiniMax，`sk-`（无 cp-）是 MiMo。混用返回 401。

### ❌ 有 TTS 报告却用固定时长
若已生成 `full_tts_report.json` 但未使用 `estimated_duration`，而用固定值替代，配音与画面会明显不同步（偏差可达 25~47 秒）。

### ❌ FFmpeg subprocess 列表模式传 Windows 路径
`subprocess.run(["ffmpeg", ..., "d:\\path\\file.ass"])` 会导致 FFmpeg 解析失败。
必须用 `shell=True` + 正斜杠路径 + `cwd` 参数。

### ❌ ASS 文件写入 `tempfile.gettempdir()`
中文用户名路径（如 `C:\Users\邱领\AppData\Local\Temp\`）会导致 FFmpeg libass 解析 ASS 失败。
ASS 文件必须写入项目目录（如 `BASE_DIR/full.ass`），用相对路径引用。

### ❌ 批量并发无限制生成图片
无限制 `Promise.all` 会瞬间触发 MiniMax API 限流。
必须串行或 `Semaphore(3)` 限流。

### ❌ `scale=1920` 生成 zoompan
1152×864 的图 upscale 到 1920 会触发 malloc 失败。
zoompan 前统一 `scale=1280:-1`。

### ❌ `SubtitleSegment(start=..., end=...)`
参数名错误，正确是 `start_time` 和 `end_time`。

---

## 依赖项

| 依赖 | 版本要求 | 安装 |
|------|---------|------|
| Python | ≥ 3.10 | 内置 |
| FFmpeg | 任意版本（需含 libass） | `choco install ffmpeg` 或官网下载 |
| PIL (Pillow) | 最新 | `pip install pillow` |
| 微软雅黑字体 | 系统自带 | `C:\Windows\Fonts\msyh.ttc` |

## 参考文档

- [质量门禁](../quality-gates.md) — P6 章节有完整门禁规则
- MiniMax 平台: https://platform.minimaxi.com
- FFmpeg zoompan: https://ffmpeg.org/ffmpeg-filters.html#zoompan
- FFmpeg subtitles: https://ffmpeg.org/ffmpeg-filters.html#subtitles
