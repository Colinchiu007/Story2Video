# 事后复盘: 2026-07-13/14 — 质量节拍 Sprint

> **项目**: Story2Video — AI 视频创作平台
> **日期**: 2026-07-13 ~ 2026-07-14
> **范围**: 防御式调试 / 架构统一 / API限流 / 并发安全

---

## Phase 4: TTS 限流重试 + 并发 Auth Token Lock (2026-07-14)

### Bug 清单

| # | Bug | 严重度 | 状态 |
|---|-----|--------|------|
| 1 | MiMo TTS HTTP 429 限流无重试 | P1 | **已修复** |
| 2 | 批量模式 Supabase auth token lock 竞争 | P1 | **已修复** |
| 3 | Edge Function 中 UTF-8 BOM 乱码注释 | P2 | **已修复** |

### 根因分析

#### Bug 1: MiMo TTS HTTP 429

**现象**: 批量生成视频时，MiMo 语音合成偶发失败，toast 提示 `MiMo 合成失败: HTTP 429`

**根因**: MiMo API 有速率限制(RPM)，但 Edge Function 和前端调用链中均无重试机制。当并发请求触发限流时，直接返回失败。

**调用链**:
```
CreatePage.dispatchTTS() 
  → generateMimoTTS() [tts-mimo.ts]
    → invokeFunction('tts-mimo') [api-config.ts]
      → Edge Function tts-mimo/index.ts
        → fetch(api.xiaomimimo.com) → HTTP 429
```

**修复** (三层重试):
| 层级 | 文件 | 改动 |
|------|------|------|
| Edge Function | `supabase/functions/tts-mimo/index.ts` | MiMo API 调用添加 3 次指数退避重试，解析 `retry-after` 响应头 |
| 前端 Edge Function | `src/services/tts-mimo.ts` | `invokeFunction` 调用添加 3 次重试，匹配 429/rate-limit/5xx |
| 前端直接 API | `src/services/tts-mimo.ts` | `generateMimoTTSDirect` 同样包装重试 |
| 豆包 TTS | `src/services/tts.ts` | 同步添加 3 次重试，预防同类问题 |

**重试策略**:
- 指数退避: 1s → 2s → 4s（上限 15s）
- 解析 `retry-after` 响应头，取 min(retry-after, 30s)
- 最多 3 次尝试（含首次）

#### Bug 2: Supabase Auth Token Lock

**现象**: 批量模式生成视频时，控制台报错 `Lock *lock:sb-...-auth-token was released because another request stole it`

**根因**: 批量模式 `batchParallel(CONCURRENCY=2)` 同时运行 2 个子任务，每个任务内部都调用 `dispatchTTS` → `supabase.functions.invoke`。Supabase JS 客户端在并发调用时触发了 auth token 的并发刷新竞争。

**触发路径**:
```
batchParallel(CONCURRENCY=2)
  → Task A: dispatchTTS(text1) → supabase.functions.invoke() → 触发 getUser()
  → Task B: dispatchTTS(text2) → supabase.functions.invoke() → 触发 getUser() [竞争!]
  → Supabase 客户端: token refresh lock 被 A 持有, B 抢占释放
```

**修复**:
- 添加 `TTS_STAGGER_MS = 2000`（2秒）
- 批量模式中，第 2 个及之后的 TTS 调用前延迟 2 秒
- 确保两个并发任务的 Supabase 认证请求错开

```typescript
// CreatePage.tsx batch mode
const TTS_STAGGER_MS = 2000;
// ...
if (child.index > 0) {
  await new Promise(r => setTimeout(r, TTS_STAGGER_MS));
}
const ttsResult = await dispatchTTS(child.text);
```

#### Bug 3: Edge Function UTF-8 BOM 乱码

**现象**: `tts-mimo/index.ts` 中大量注释显示为乱码

**根因**: 之前使用 PowerShell `WriteAllText` 写入文件时，Windows 默认添加了 UTF-8 BOM，而部分工具链无法正确处理 BOM。多次重写后注释变成了 GBK/UTF-8 混合编码。

**修复**: 使用 `[System.Text.UTF8Encoding]::new($false)` 显式指定无 BOM 的 UTF-8 编码，所有中文注释和错误消息恢复正常。

---

## Phase 3: 引擎集成与并发控制 (2026-07-13)

### Bug 清单

| # | Bug | 严重度 | 状态 |
|---|-----|--------|------|
| 1 | MiniMax 图片生成选项缺失 | P1 | **已修复** |
| 2 | 42 张图片中 30 张 RPM 限流失败 | P1 | **已修复** |
| 3 | smart-sentence-splitter 从未被启用 | P1 | **已修复** |
| 4 | splitTextToScenesSmart 重复声明错误 | P2 | **已修复** |
| 5 | IMAGE_DELAY_MS const 重复声明 | P2 | **已修复** |

### 关键修复

1. **isImageGenerationAvailable() 遗漏 MiniMax**: 补充 `minimax` 到供应商检查列表
2. **图片批量生成限流**: `Promise.all` → `batchParallel(CONCURRENCY=2, delayMs=1500)`
3. **外部引擎启用**: `.env` 添加 `VITE_SENTENCE_SPLITTER_URL` 和 `VITE_PROMPT_ENGINE_URL`
4. **引擎降级指示器**: 返回 `{ segments, tier: 'api' | 'local' }` 结构体

---

## Phase 2: 解除 Miaoda 依赖 (2026-07-13)

### 核心变更

- 移除 3 个 Miaoda npm 包（miaoda-auth-react, miaoda-react-devkit, miaoda-sc-plugin）
- 内联 customFetch 到 `src/db/supabase.ts`
- MiMo 音色克隆 provider 列兼容处理

### 遗留依赖

| 依赖 | 无法移除的原因 | 替代方案 |
|------|---------------|---------|
| `backend.appmiaoda.com` | 数据库服务本身 | Docker 本地 Supabase / 新建云项目 |
| `@miaoda.com` 邮箱后缀 | 用户认证系统约定 | 可替换为任意邮箱 |

---

## Phase 1: 防御式调试 (2026-07-13)

### Bug 清单

| # | Bug | 状态 |
|---|-----|------|
| 1 | API 设置「保存失败」误报 | **已修复** |
| 2 | 音色克隆「克隆失败」误报 | **已修复** |
| 3 | PostCSS BOM 解析失败 | **已修复** |
| 4 | 测试套件挂起/死锁 | **已修复** |
| 5 | Vite oxc Invalid Unicode escape | **已修复** |

---

## 质量门禁更新

### 已建立的门禁

| 门禁 | 级别 | 说明 |
|------|------|------|
| 不安全 supabase 解构 | P0 | `const { data: { user } }` → 必须用 `authResult?.data?.user ?? null` |
| throw raw error | P0 | 必须 `throw new Error(extractErrorMessage(error))` |
| instanceof Error 回退 | P0 | catch 块必须显式类型处理 |
| UTF-8 BOM | P1 | 写文件必须无 BOM |
| 外部 API 调用 | P2 | 必须使用 batchParallel + concurrency/delay |
| 常量作用域 | P3 | const 不能在条件分支内重复声明 |

### 教训总结

1. **不要信任 PowerShell 的 `@"..."@` 字面量** — 它仍会插值 `${...}` 变量，用 `@'...'@` 才是真正的原始字符串
2. **外部 API 调用必须有重试机制** — 429/5xx 是常态，不是异常
3. **Supabase 并发调用需要串行化** — 多个 `supabase.functions.invoke` 不应同时触发
4. **数据库 DDL 只能通过 service_role 执行** — anon key 和 user JWT 都无法执行 DDL
5. **字符串替换要注意函数边界** — `if (!trimmed) return [];` 等通用模式容易命中多个函数
6. **.env.example 必须与实际一致** — 端口号、URL 等不一致会导致开发者困惑
7. **BOM 是隐形杀手** — UTF-8 BOM 会导致 PostCSS/Vite 解析失败，但错误信息完全不提示 BOM