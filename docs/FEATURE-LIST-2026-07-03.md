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
