# Story2Video — 质量门禁

## 自动化门禁

| 门禁 | 命令 | 通过标准 |
|------|------|----------|
| TypeScript 编译 | `npx tsc --noEmit --skipLibCheck` | 零错误 |
| 单元测试 | `npm test` | 304/304 通过 |
| CI 测试 | `npm run test:ci` | `--bail=1` 首个失败即停 |
| Lint | `npx biome lint` | 零错误 |
| 变更日志 | `git diff CHANGELOG.md` | 更新至最新版本 |
| 错误处理门禁 | `powershell -File scripts/quality-gate.ps1` | 零不安全解构 + 合理包装异常 |

## 阶段质量门禁

**PRD 阶段**：MVP 范围清晰 / AI 服务依赖明确 / 验收标准可验证
**设计阶段**：渲染方案合理 / 最简单方案优先
**开发阶段**：测试全通过 / 手动验证视频生成流程
**Review 阶段**：CRITICAL 问题已修复 / API Key 安全审查通过

## 已知质量反模式（Review 必检）

1. **不安全 supabase 解构**: `const { data: { user } } = await supabase.auth.getUser()`
   → 必须使用 `authResult?.data?.user ?? null`
2. **DB 同步阻塞本地保存**: 远程 Supabase 失败不应影响 localStorage 写入
   → 必须分离 localStorage 主存储与 DB 辅助同步
3. **外部 API 无重试**: 直接 fetch 第三方 API 无重试机制
   → 必须添加 3 次指数退避重试，匹配 429/5xx

## 质量复盘记录

| 日期 | 复盘文档 | 关键发现 |
|------|---------|---------|
| 2026-07-13 (v1.6.0) | docs/postmortem-2026-07-13.md | 不安全解构清零 + VoiceCloneDialog 修复 + 门禁脚本 |
| 2026-07-13 (v1.7.0) | docs/postmortem-2026-07-13.md | 解除 Miaoda 依赖 + provider 列兼容 |
| 2026-07-13 (Phase 3) | docs/postmortem-2026-07-13.md | 引擎集成 + 并发控制 + 图片限流 |
| 2026-07-14 (Phase 4) | docs/postmortem-2026-07-13.md | TTS 429 重试 + auth token lock + BOM 清理 |

## P2: 外部 API 调用门禁

- 所有外部 API 调用必须使用 batchParallel（concurrency + delayMs）
- 禁止 Promise.all 直接调用外部 API
- TTS/图片生成 API 必须有重试机制（3次指数退避）
- 新增外部 API 供应商时必须在 isAvailable() 中枚举

## P3: 常量作用域门禁

- const 声明必须在函数顶层，不能在条件分支内重复声明
- 多个 if/else 分支共享的常量必须提到分支外
- 新增 const 时检查是否存在同名声明

## P4: 并发安全门禁

- 批量模式中多个并发任务不应同时调用 supabase.auth
- TTS 调用之间需添加 TTS_STAGGER_MS（2秒）错开
- Edge Function 内部调用第三方 API 必须有重试机制

## P5: 编码规范门禁

- Windows 环境写文件必须使用无 BOM 的 UTF-8: `[System.Text.UTF8Encoding]::new($false)`
- 禁止使用 PowerShell `@"..."@`（会插值变量），必须用 `@'...'@`
- Edge Function 中的注释和错误消息必须使用 UTF-8 编码

## P6: text-to-video Pipeline 确定性门禁（2026-07-19 马尼拉项目复盘）

> 本章来自《马尼拉的华人血痕》text-to-video 全流程实战，经验已固化为确定性规则。

### P6.1: API Key 配置门禁

**强制规则**：任何 AI 服务调用前必须验证 Key 可用性，不能假设 Key 有效。

| 场景 | 验证方法 | 通过标准 |
|------|---------|---------|
| MiniMax 文本模型 (MiniMax-M3) | `curl -X POST` 到 `/v1/chat/completions` 带简单 prompt | HTTP 200 + 有 `choices` 返回 |
| MiniMax 图片生成 (image-01) | `curl -X POST` 到 `/v1/images/generations` | HTTP 200 + 响应含 `data.image_urls`（数组）不是 `data.image_url` |
| MiMo TTS 音色克隆 | 调用 `/v1/chat/completions` model=`mimo-v2.5-tts-voiceclone` | HTTP 200 + `choices[0].message.audio.data` 有 base64 |

**已知 Key 前缀规律（防混淆）**：
- `sk-cp-` 开头 = MiniMax 文本模型 Key
- `sk-` 开头（不含 `cp-`）= MiMo TTS Key（两者不同！）
- 禁止混用：MiniMax Key 不能用于 MiMo，反之亦然

### P6.2: MiniMax 图片 API 响应格式门禁

**强制规则**：MiniMax 图片 API 响应字段为 `data.image_urls[0]`（数组），不是 `data.image_url`。

```python
# 正确写法（3 层兼容）
def get_image_url(result):
    urls = result.get("data", {}).get("image_urls", [])   # ← 数组
    if urls:
        return urls[0]
    url = result.get("data", {}).get("image_url", "")     # ← 兼容旧格式
    if url:
        return url
    url = result.get("image_url", "")                       # ← 最外层兜底
    if url:
        return url
    return None
```

**错误写法（直接取 `data.image_url`）会导致所有图片 URL 获取失败。**

### P6.3: 敏感内容处理门禁

**强制规则**：场景触发 MiniMax 错误码 `1026`（内容涉及敏感）时，更换更安全的 prompt 重试。

```python
def safe_regenerate(scene_index, original_prompt):
    """敏感内容自动重试逻辑"""
    safe_prompts = {
        # 场景索引: 更安全的替代 prompt
        14: "1639 Manila, wealthy Chinese merchant kneeling at doorway, Spanish guards patrolling, torchlight, stone walls, dramatic shadows",
    }
    new_prompt = safe_prompts.get(scene_index, original_prompt.replace("blood", "tears").replace("massacre", "uprising"))
    return generate_image(new_prompt)
```

**Anti-pattern**：不要在包含暴力/死亡/冲突描述的 prompt 中直接使用 `blood`、`massacre`、`kill`、`death` 等词，改为中性词如 `tears`、`uprising`、`conflict`、`tragedy`。

### P6.4: TTS 时长控制门禁

**优先级规则**：时长控制有 3 个选项，按优先级选用。

| 优先级 | 方法 | 适用条件 | 时长来源 |
|--------|------|---------|---------|
| 🥇 **1st** | TTS 实际时长 | `--mode full` 已执行 | `full_tts_report.json` → `estimated_duration` |
| 🥈 **2nd** | 字符数比例估算 | 有各场景字数 | 总时长 × (该场景字数 / 总字数) |
| 🥉 **3rd** | 固定值兜底 | 无 TTS 报告 | 固定 6 秒/图 |

```python
# ✅ 正确：按优先级选择时长控制方法

# 1st: 有 full_tts_report.json
with open("tts/full_tts_report.json") as f:
    tts_report = json.load(f)
scene_info = {item["scene_id"]: item for item in tts_report["scene_durations"]}
sd = scene_info.get(scene_index, {})
duration = sd.get("estimated_duration", 6.0)

# 2nd: 无 TTS 报告但有字数
total_chars = sum(s["chars"] for s in scenes)
total_duration = 570  # 估算总时长
duration = total_duration * (scenes[i]["chars"] / total_chars)

# 3rd: 无任何信息，固定值兜底
duration = 6.0
```

**⚠️ 音画不同步警告**：若 TTS 报告存在但未使用其时长，而用固定值替代，配音与画面会明显不同步。

| 场景字数 | TTS 实际 | 固定 6s | 偏差 |
|---------|---------|---------|------|
| 113字 | 31.4s | 6s | 差 +25s |
| 125字 | 34.7s | 6s | 差 +29s |
| 86字 | 53.0s | 6s | 差 +47s |

### P6.5: video-compositor 参数签名门禁

**强制规则**：`SubtitleSegment` 参数名为 `start_time`/`end_time`，不是 `start`/`end`。

```python
# 正确
subtitles.append(SubtitleSegment(
    text=scene.get("text", ""),
    start_time=current_time,      # ← start_time
    end_time=current_time + duration,  # ← end_time
))

# 错误（会报 AttributeError）
subtitles.append(SubtitleSegment(
    text=scene.get("text", ""),
    start=current_time,     # ❌
    end=current_time + duration,  # ❌
))
```

### P6.6: FFmpeg Windows 路径门禁

**强制规则**：FFmpeg 在 Windows 下对 `d:` 冒号解析有特殊处理，需使用正斜杠路径 + `cwd` 切换工作目录。

```python
# 错误：直接传 Windows 路径会解析失败
subprocess.run(["ffmpeg", "-i", "d:\\Data\\...\\full.ass", ...])
# 报错：Unable to parse option value "Dataprojectstemp..." as image size

# 正确做法 1：正斜杠路径 + cwd
video_only_fs = video_only.replace("\\", "/")
cmd_str = f'ffmpeg -y -i "{video_only_fs}" ...'
subprocess.run(cmd_str, shell=True, cwd=BASE_DIR)

# 正确做法 2：相对路径 + cwd（BASE_DIR 下写 ASS 文件）
full_ass = os.path.join(BASE_DIR, "full.ass")  # 不放 temp 目录
cmd_str = f'ffmpeg -y -i "{video_only_fs}" -filter_complex "...subtitles=full.ass..."'
subprocess.run(cmd_str, shell=True, cwd=BASE_DIR)  # ← cwd 解决相对路径问题
```

**必须避免**：
- ASS 文件写入 `tempfile.gettempdir()`（中文用户名路径会导致 FFmpeg 解析失败）
- 使用 subprocess 列表模式 `[..., "path:d:\\...", ...]` 传含冒号路径

### P6.7: FFmpeg zoompan 内存门禁

**强制规则**：图片分辨率 ≤ 1280×720 时，禁止 `scale=1920` 强制 upscale（会触发 malloc 失败）。

```python
# 错误：scale=1920 对 1152×864 图片会 upscale 1.67 倍，触发 malloc 失败
"[0:v]scale=1920:-1,zoompan..."

# 正确：scale=1280:-1（不 upscale）
"[0:v]scale=1280:-1,zoompan..."
```

**快速判断**：生成前检查图片尺寸，超过 1280 宽再用 1920。

### P6.8: FFmpeg 字幕滤镜路径门禁

**强制规则**：subtitles/ass 滤镜在 filter_complex 中不能直接用含 `d:` 的 Windows 绝对路径。

```python
# 错误
"[0:v]subtitles='d:\\Data\\...\\full.ass':original_size=1280x720"

# 正确：ASS 文件放 BASE_DIR，用相对路径
full_ass = os.path.join(BASE_DIR, "full.ass")
cmd_str = f'...subtitles=\'full.ass\':original_size=1280x720...'
subprocess.run(cmd_str, shell=True, cwd=BASE_DIR)  # cwd 让 FFmpeg 找到 full.ass
```

### P6.9: 图片生成批处理门禁

**强制规则**：批量图片生成必须使用串行或有限并发（≤3），禁止无限制 `Promise.all`。

```python
# 正确：串行生成
for i in range(len(scenes)):
    await generate_image(scene_prompts[i])
    await asyncio.sleep(1)  # 避免触发 API 限流

# 或有限并发
semaphore = asyncio.Semaphore(3)
async def gen_with_limit(i):
    async with semaphore:
        return await generate_image(scene_prompts[i])
await asyncio.gather(*[gen_with_limit(i) for i in range(len(scenes))])
```

### P6.10: 视频合成前完整性检查门禁

**强制规则**：合成前必须验证所有图片文件存在且大小正常（> 50KB）。

```python
def verify_images(image_dir, scene_count):
    """视频合成前图片完整性检查"""
    issues = []
    for i in range(scene_count):
        path = os.path.join(image_dir, f"scene_{i:02d}.png")
        if not os.path.exists(path):
            issues.append(f"场景 {i}: 文件不存在")
        elif os.path.getsize(path) < 50 * 1024:  # < 50KB = 下载失败
            issues.append(f"场景 {i}: 文件过小 ({os.path.getsize(path)} bytes)")
    if issues:
        raise ValueError(f"图片检查失败:\n" + "\n".join(issues))
    return True
```

### P6.11: FFmpeg concat demuxer 编码门禁

**强制规则**：concat list 文件必须使用 UTF-8 无 BOM 编码写入。

```python
# 正确
with open(concat_list, "w", encoding="utf-8") as f:  # Windows 默认会加 BOM
    for clip in clips:
        f.write(f"file '{clip}'\n")

# 检查：BOM 会导致 ffmpeg concat 读取异常
```

## 质量复盘记录（续）

| 日期 | 关键发现 | 固化为 |
|------|---------|-------|
| 2026-07-19 (P6) | text-to-video Pipeline 完整复盘 | P6.1-P6.11 门禁规则 |