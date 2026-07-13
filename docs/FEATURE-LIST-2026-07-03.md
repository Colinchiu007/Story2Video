# Story2Video — 功能清单 & PRD 补充

> **生成日期**: 2026-07-03
> **版本**: v1.5.2
> **范围**: 本次会话新增功能 (https://github.com/Colinchiu007/Story2Video)

---

## 一、本次会话新增功能

### 1.1 新 Publisher (ECS 版本)

| 平台 | 文件 | 说明 | 状态 |
|------|------|------|------|
| 小红书 | - | 前端启用 + 后端对接 | 已发布 |
| 视频号 | tencent_video | 完整 API + dispatch | 已发布 |

### 1.2 Ian Xiaohei 跨项目复用 (5 项)

| # | 复用项 | 源项目 | 目标 | 状态 |
|---|--------|--------|------|------|
| 1 | 统一 Feature Gate | orchestrator | Story2Video (localStorage→YAML) | 已完成 |
| 2 | 发布状态机 | shared-models | Story2Video | 已完成 |
| 3 | 小红书 publisher | orchestrator | Story2Video | 已完成 |
| 4 | 视频号 publisher | orchestrator | Story2Video | 已完成 |
| 5 | 平台列表统一 | orchestrator | Story2Video | 已完成 |

### 1.3 PRD 补充 (审查后 → v1.2.0)

| 章节 | 说明 | 状态 |
|------|------|------|
| 资源限制 | 视频时长/音频大小上限 | 已补充 |
| 并发策略 | 多用户并发策略 | 已补充 |
| 会员配额 | 会员次/天定义 | 已补充 |
| 数据模型 | VideoAsset/ScenePrompt 扩展 | 已补充 |
| 发布状态机 | PublishStage 枚举 | 已补充 |
| Feature Gate 迁移 | localStorage→orchestrator YAML | 已补充 |
| AGENTS.md 重写 | 7-stage+TDD 标准格式 | 已重写 |

### 1.4 重构

| 改动 | 说明 | 状态 |
|------|------|------|
| JSX 组件提取 | CreatePage.tsx 组件提取 | 已完成 |
| Custom Hooks | 集成 4 个自定义 hooks | 已完成 |
| 常量提取 | 分离创建页面常量 | 已完成 |
| ARCHITECTURE.md | 架构文档新增 | 已发布 |
| DESIGN.md | 设计文档新增 | 已发布 |

---

## 二、质量节拍 Sprint (v1.6.0)

> **版本**: v1.6.0
> **日期**: 2026-07-13
> **范围**: 防御式调试 + 语音模型配置统一 + 测试基础设施

### 2.1 Bug 修复

| # | Bug | 文件 | 根因 | 修复方式 |
|---|-----|------|------|---------|
| 1 | API 设置保存误报失败 | `ApiSettingsDialog.tsx` | 不安全 supabase 解构 `const { data: { user } }` | 可选链 + 存储解耦 |
| 2 | 音色克隆误报失败 | `VoiceCloneDialog.tsx` | 同 #1，两处相同模式 | 可选链 + 错误区分 |
| 3 | 测试套件挂起 | `vitest.config.ts` | `pool: threads` 与 jsdom 死锁 | `pool: forks` + 超时 |
| 4 | PostCSS BOM 解析失败 | `package.json` | UTF-8 BOM | 去除 BOM |

### 2.2 架构统一

| 改动 | 说明 | 收益 |
|------|------|------|
| 语音模型配置统一 | TTS API Key 区块 → Profile 系统 | 与推理/视频/图片模型一致 |
| Profile 向后兼容 | 旧展平字段自动迁移 | 用户数据无损过渡 |
| doSave 推导 | 从活跃 TTS Profile 获取字段 | 消除双写不一致 |

### 2.3 基础设施

| 改动 | 说明 |
|------|------|
| 新增 `src/test-setup.ts` | 本地化 vitest setup |
| 新增 `test:ci` 脚本 | `--bail=1` 首个失败即停 |
| 更新 vitest.config.ts | `pool: forks` + `testTimeout: 30_000` |
| 新增 `docs/postmortem-2026-07-13.md` | 完整事后复盘文档 |

### 2.4 质量门禁补充

| 门禁 | 检测方法 | 等级 |
|------|---------|------|
| 不安全 supabase 解构 | `rg "const \{ data: \{ \w+ \} \} = await supabase"` | 🔴 禁止 |
| BOM 检测 | `rg "\xEF\xBB\xBF" package.json` | 🟡 警告 |
| vitest pool | 检查 `pool: forks` | 🟡 警告 |
