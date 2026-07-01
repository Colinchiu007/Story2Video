# Story2Video — 开发流程规范

> AI 视频创作平台的开发流程与编码约定。AI 工具启动时自动读取。

---

## 核心原则

1. **秒哒平台约束**：项目构建和部署依赖秒哒平台，不随意修改 `miaoda-*` 相关配置
2. **Edge Functions 优先**：所有 AI API 调用通过 Supabase Edge Functions 代理，不在前端直接暴露 API Key
3. **客户端视频合成**：视频渲染使用 Canvas + MediaRecorder API，仅在浏览器环境运行
4. **TDD**：测试先于代码，提交前全部测试通过
5. **先文档再代码**：没有 PRD 不动手，没有架构设计不动手

## AI 角色分工

| 角色 | 阶段 | 产出物 |
|------|------|--------|
| **PM** | 需求分析 | PRD、用户故事、功能列表 |
| **设计师** | UI/UX | 页面布局、交互流程、动画设计 |
| **前端工程师** | 编码实现 | React 组件、Canvas 渲染、测试 |
| **后端工程师** | 编码实现 | Edge Functions、Supabase 数据库设计 |
| **AI 工程师** | 编码实现 | TTS/图片生成/视频生成 API 对接 |
| **QA** | 质量验证 | 端到端视频生成流程测试 |
| **CTO** | 代码评审 | 安全审查、AI API Key 审查 |

## 7 阶段开发流程

### 阶段 1：想法澄清
确认：目标用户、视频类型、AI 服务依赖、MVP 范围

### 阶段 2：PRD（PM）
产出：PRD 或功能规格，包含：
- 页面/功能清单（P0/P1/P2）
- AI 服务依赖（TTS / 图片 / 视频）
- 验收标准

**批准后才能进入下一阶段。**

### 阶段 3：技术设计（架构师/设计师）
产出：方案对比 + 推荐方案
- 前端：页面组件树、Canvas 渲染方案
- 后端：Edge Function 设计、数据库 schema 变更
- AI 服务：API 对接方案、降级策略

### 阶段 4：开发计划（PM）
MVP 拆成 ≤4h 的任务。

### 阶段 5：编码实现（开发 + TDD）
- 先写测试，再写代码
- 核心逻辑（`src/lib/`）必须有 `*.test.ts`
- 新增页面必须有 `__tests__/` 组件测试
- 新增 Edge Function 必须有本地 Deno 测试
- 手动验证：网页能渲染 / AI 服务可调用 / 视频能生成

### 阶段 6：代码评审（CTO）
必检项：
- 🔴 API Key 是否暴露在前端代码中
- 🔴 Supabase 连接信息是否硬编码
- 🟠 Edge Function 是否有超时处理
- 🟠 Canvas 渲染是否有内存泄漏风险
- 🟢 新增页面是否注册了路由
- 🟢 测试是否覆盖核心功能

### 阶段 7：发布
- `npm test` 全部通过
- Edge Function 本地测试通过
- 更新 CHANGELOG.md
- 通过秒哒平台部署


## 详细规范

本文档只包含开发流程框架。详细规范已拆分到 `references/` 子目录：

- **[references/testing.md](references/testing.md)** — TDD 流程与测试规范
- **[references/quality-gates.md](references/quality-gates.md)** — 质量门禁详细说明
- **[references/commits.md](references/commits.md)** — 提交规范

## 文档清单

| 文件 | 路径 | 说明 |
|------|------|------|
| AGENTS.md | `./AGENTS.md` | 本文件，开发流程规范 |
| CLAUDE.md | `./CLAUDE.md` | 项目上下文和开发命令 |
| .clinerules | `./.clinerules` | 硬约束规则 |
| docs/prd.md | `./docs/prd.md` | 产品需求文档 |
| specs/design.md | `./specs/design.md` | 系统设计文档 |
| specs/requirements.md | `./specs/requirements.md` | EARS 格式需求 |
| CHANGELOG.md | `./CHANGELOG.md` | 变更日志 |

## 常用命令

```bash
# 前端开发
npm run dev -- --host 127.0.0.1

# 测试
npm test              # vitest run

# Edge Function 本地测试
cd supabase/functions/tts-minimax
deno run --allow-net --allow-env index.ts
```

## 版本

当前为秒哒平台导出版本，无独立版本号。
