# 事后复盘：2026-07-13 — 质量节拍 Sprint

> **项目**: Story2Video — AI 视频创作平台
> **日期**: 2026-07-13
> **范围**: 防御式调试（API 设置/音色克隆保存误报失败）+ 语音模型配置统一

---

## 一、Bug 清单

| # | Bug | 文件 | 严重程度 | 状态 |
|---|-----|------|---------|------|
| 1 | API 设置「保存失败」误报 | `src/components/ApiSettingsDialog.tsx` | 🔴 功能 | 已修复 |
| 2 | 音色克隆「克隆失败」误报 | `src/components/VoiceCloneDialog.tsx` | 🔴 功能 | 已修复 |
| 3 | 测试套件挂起/死锁 | `vitest.config.ts` | 🟡 基础设施 | 已修复 |
| 4 | PostCSS BOM 解析失败 | `package.json` | 🟡 构建 | 已修复 |

---

## 二、Bug 1：API 设置「保存失败」误报

### 2.1 现象

在 API 设置-推理模型中新增 API，点击确定后 toast 提示「保存失败」，但实际数据已成功写入 localStorage，刷新后配置正常。

### 2.2 根因分析

**不安全 Supabase 解构模式**

```typescript
// ❌ 导致 TypeError 的写法
const { data: { user } } = await supabase.auth.getUser();
```

`supabase.auth.getUser()` 在未登录或 session 过期时返回 `{ data: null, error: ... }`。当 `data` 为 `null` 时，解构 `data: { user }` 等价于 `null.user`，抛出：

```
TypeError: Cannot destructure property 'user' of 'undefined' or 'null'.
```

**执行流：**
1. `doSave()` 先写入 `localStorage`（成功）
2. 然后尝试 `supabase.auth.getUser()` 获取用户（未登录 → data = null）
3. 不安全解构抛 TypeError，被 `try/catch` 捕获
4. catch 块统一设为「保存失败」，覆盖了 localStorage 已成功的状态

### 2.3 影响范围

此模式在项目中出现了 4 次相同的写法。

### 2.4 修复方案

```typescript
// ✅ 安全写法
const authResult = await supabase.auth.getUser();
const user = authResult?.data?.user ?? null;
```

**分层策略：**
- localStorage 写入始终优先（主存储）
- DB 同步为辅助操作，失败不阻塞本地保存
- 错误提示区分「保存失败」与「本地已保存，云端同步失败」两种情况

---

## 三、Bug 2：音色克隆「克隆失败」误报

### 3.1 现象

选择小米 MiMo 音色，保存时提示「克隆失败」，但实际服务端可能已成功。

### 3.2 根因分析

与 Bug 1 完全相同的不安全 Supabase 解构模式，在 `VoiceCloneDialog.tsx` 中存在两处：

1. `handleFileUpload` 中的 supabase 用户检查
2. `handleClone` 中的 supabase 用户检查

### 3.3 修复方案

同 Bug 1，安全解构 + 区分 MiMo/豆包的错误消息。

---

## 四、Bug 3：测试套件挂起

### 4.1 现象

`npm test` 中某些测试文件（特别是涉及 `vi.stubGlobal` 的测试）会超时挂起，导致 CI 流程卡死。

### 4.2 根因分析

**Vitest v4 默认 Pool 与 jsdom 冲突：**

- Vitest v4 默认使用 `threads` pool（worker_threads）
- `vi.stubGlobal` 在 worker_threads 环境中修改全局变量时，如果与 jsdom 的全局环境交互，可能导致死锁
- 死锁表现为测试进程无响应，直到 30 秒超时后被强制终止

### 4.3 修复方案

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    pool: 'forks',  // 使用 child_process 替代 worker_threads
    testTimeout: 30_000,
    // ...
  },
});
```

**配套改动：**
- 新增 `src/test-setup.ts` 本地化 vitest setup 文件
- 新增 `test:ci` 脚本（`--bail=1` 首个失败即停）
- 新增 `test:watch:pool` 脚本（指定 forks pool 的 watch 模式）

---

## 五、Bug 4：PostCSS BOM 解析失败

### 5.1 现象

`npm run dev` 启动时报：
```
Failed to load PostCSS config: [SyntaxError] Unexpected token '﻿', is not valid JSON
```

### 5.2 根因分析

`package.json` 文件开头包含 UTF-8 BOM（Byte Order Mark，字节 `0xEF 0xBB 0xBF`），PostCSS 的 `jsonLoader` 使用 `JSON.parse()` 解析时，BOM 会被视为非法字符。

### 5.3 修复方案

使用 UTF-8 without BOM 重新保存 `package.json`。

---

## 六、架构改进：语音模型配置统一

### 6.1 背景

TTS 配置标签页中，MiMo 和豆包的 API Key 字段以独立区块形式直接渲染在 UI 中，与其他模型（推理、视频、图片）的 Profile 系统不一致。

### 6.2 改动

- 移除 TTS 标签页中独立的 MiMo/豆包 API Key 字段
- TTS 字段（音色 ID/名称）通过 `profile.extra` 集成到 ProfileEditor
- 向后兼容：旧的展平字段在加载时自动迁移为 Profile
- `doSave` 从活跃 TTS Profile 推导展平字段

### 6.3 收益

- 配置形式统一，减少心智负担
- Profile 系统的复用性提升
- 降低后续新增 TTS 供应商的接入成本

---

## 七、学到的教训（质量门禁补充）

### 7.1 自动检测项

以下模式应加入代码审查自动化门禁：

| 模式 | 检测方法 | 建议门禁 |
|------|---------|---------|
| 不安全解构 `const { data: { user } } = await supabase.auth.getUser()` | `rg "const \{ data: \{ \w+ \} \} = await supabase"` | 🔴 禁止提交 |
| `package.json` 含 BOM | `rg $'\xEF\xBB\xBF' package.json` | 🟡 警告 |
| vitest 未指定 `pool: 'forks'` | 检查 vitest.config.ts 无 `pool: 'forks'` | 🟡 警告 |

### 7.2 架构原则补充

1. **防御式解构原则**: 任何从 API/服务返回值解构时，必须使用可选链（`?.`）+ 默认值（`??`）
2. **存储解耦原则**: 主存储写入永远不受辅助存储失败的阻塞（localStorage 主 + DB 辅）
3. **统一配置原则**: 同类功能使用同一配置模式（Profile 系统），不为个别供应商特殊处理

---

## 八、质量指标

| 指标 | 值 | 对比 |
|------|-----|------|
| 测试文件数 | 28 | +16 (vs v1.5.2) |
| 测试用例数 | 304 | 稳定 |
| 测试通过率 | 100% | 不变 |
| 测试运行时间 | ~20s | 优化后 (pool: forks) |
| 新引入 Bug | 0 | — |
| 已消除 Bug | 4 | — |

---

## 九、后续建议

1. **添加 Pre-commit Hook**: 使用 `simple-git-hooks` 或 `husky` 在提交前自动检测不安全解构模式
2. **TypeScript 严格模式**: 考虑逐步启用 `strictNullChecks`，编译器层面杜绝此类 Bug
3. **添加 E2E 测试**: 使用 Playwright 覆盖 API 设置/音色克隆等用户流程

---

## 附录：全面扫描结果（2026-07-13）

对全仓库执行 `scripts/quality-gate.ps1` 扫描：

### 门禁 2：不安全 supabase 解构 — 已清零 ✅

| 文件 | 行号 | 状态 |
|------|------|------|
| `ApiSettingsDialog.tsx` | 399 | ✅ 已修复 |
| `BgmSettings.tsx` | 129 | ✅ 已修复 |
| `LoginPage.tsx` | 107 | ✅ 已修复 |
| `services/gallery.ts` | 14 | ✅ 已修复 |
| `services/orchestrator-api.ts` | 125 | ✅ 已修复 |

原 bug（`ApiSettingsDialog.tsx` 和 `VoiceCloneDialog.tsx`）正是此模式的受害者。扫描确认后全部清零。

### 遗留技术债

| 类别 | 数量 | 优先级 | 说明 |
|------|------|--------|------|
| `if (error) throw error;` | 15 | 🟡 | 多为非关键路径，但存在相同风险 |
| `instanceof Error` 回退 | 21 | 🟡 | 如果上游不抛 Error 实例则消息被吞 |

**后续计划：** 逐步将 `throw error;` 替换为 `throw new Error(extractErrorMessage(error));` 并统一 catch 块。

---

## 二、Phase 2：解除 Miaoda 依赖 — 2026-07-13

> **范围**: 移除 Miaoda npm 包 + 内联 customFetch + 数据库兼容

### 分析

Miaoda 平台在 `package.json` 中注入了 3 个包：

| 包名 | 源码引用 | 实际作用 |
|------|----------|----------|
| `miaoda-auth-react` | 无 | 未使用 |
| `miaoda-react-devkit` | 无 | 未使用 |
| `miaoda-sc-plugin` | `vite.config.ts` 中 `miaodaDevPlugin()` | 构建时通过 `patchSupabasePlugin` 向 `src/db/supabase.ts` 注入 `customFetch` 适配器 |

### 执行方案

**问题 1：`patchSupabasePlugin` 在构建时做 AST 转换注入 customFetch**
→ 方案：将 customFetch 直接写入 `src/db/supabase.ts` 源码，消除构建时依赖
→ 结果：9 文件变更，+330/-318 行

**问题 2：PowerShell `@"..."@` 会插值 `${...}` 模板变量**
→ 复现：`storageKey: sb-${...}-auth-token` 被 PowerShell 错误解析
→ 修复：改用 `@'...'@` 字面量字符串 + 字符串拼接代替模板字面量

**问题 3：migration 00021 的 `provider` 列未部署，无法 DDL**
→ 方案：`uploadMimoVoiceSample` 添加兼容层 — 收到 `PGRST204` 列缺失错误时自动重试不含 `provider` 列的插入
→ 限制：Supabase Management API 需要 PAT（Personal Access Token），当前环境无法获取

### 门禁更新

| 门禁 | 状态 | 说明 |
|------|------|------|
| `throw error` → `throw new Error(...)` | ✅ 上轮清零 | 15 处已修复 |
| 不安全解构 | ✅ 上轮清零 | 5 处已修复 |
| `instanceof Error` 回退 | ✅ 上轮清零 | 21 处已修复 |
| UTF-8 BOM | ✅ 上轮清零 | Oxc 解析器拒绝 BOM |
| **Miaoda 包引用** | **✅ 本轮清零** | 3 包移除 + vite config 清理 |

### 遗留依赖

| 依赖 | 无法移除的原因 | 替代方案 |
|------|---------------|----------|
| `backend.appmiaoda.com` Supabase 代理 | 数据库服务本身 | Docker 本地 Supabase / 新建云项目 |
| `@miaoda.com` 邮箱后缀 | 用户认证系统约定 | 可更换为任意邮箱，无需改代码 |

### 经验教训

1. **不要信任 PowerShell 的 `@"..."@` 字面量** — 它仍然会插值 `${...}` 变量。用 `@'...'@` 才是不插值的原始字符串
2. **构建插件中的 AST 转换可以被内联** — 运行 `npx tsc` 检查编译结果，提取转换后的逻辑直接写入源码
3. **数据库 DDL 只能通过 service_role/Management API 执行** — anon key 和 user JWT 都无法执行 DDL，这是 Supabase 的安全设计

---

## ??Phase 3??? Provider ????? MiMo ????? ? 2026-07-13

> **??**: user_voices ??? provider ???? VoiceSection ? VoiceCloneDialog ??? provider ??????

### ????

1. **????????**???? MiMo ????"????" ??????????? MiMo ??
2. **??????**????????????????? "??"??? MiMo ???
3. **???????**?MiMo ???????????? `voice.voice_id!`?? null??? ID

### ????

???? `user_voices` ?? `provider` ??migration 00021 ????????????

| ?? | ?? | ?? |
|------|------|------|
| `VoiceSection.tsx:37` | `(voice.provider ?? 'doubao') === voiceProvider` | provider=undefined ? 'doubao'?voiceProvider='mimo' ????????? |
| `VoiceCloneDialog.tsx:542` | `(voice.provider ?? 'doubao') === 'mimo' ? 'MiMo' : '??'` | provider=undefined ? ???? '??' |
| `VoiceCloneDialog.tsx:573` | ???? provider | provider=undefined ? ???? 'doubao'??? `voice.voice_id!` ?? null |

### ????

? `provider` ? `undefined`????????? `voice_id` ???????

| ?? | ?? Provider |
|------|-------------|
| `voice.voice_id` ?? | ??????????? voice_id? |
| `voice.voice_id` ? null | MiMo?MiMo ? voice_id???? ready? |
| `voice.provider === 'mimo'` | MiMo??????????? |
| `voice.provider === 'doubao'` | ????????????? |

### ????

| ?? | ?? | ?? |
|------|------|------|
| provider ???? fallback ?? | ? ??? | 2 ??? + 1 ??? + 1 ????? |
| ?????? | ? ?? | ????? `(voice.provider ?? 'doubao')` ??????? |

### ????

1. **"?????" ???? bug**?`(voice.provider ?? 'doubao')` ?????????? provider ?????????????????????????
   - ?????????`voice.provider == null`?
   - ????????????????
   - ?????????????
2. **Migrations ?????**?migration 00021 ????? Management API ????????? bug ????????? migration?????????? + ??????????
3. **????? bug**???? `(voice.provider ?? 'doubao')` ????? 3 ????2 ?????????????????????????????????????
