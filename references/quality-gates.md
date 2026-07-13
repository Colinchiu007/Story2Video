# Story2Video — 质量门禁

## 自动化门禁

| 门禁 | 命令 | 通过标准 |
|------|------|----------|
| TypeScript 编译 | `npx tsc --noEmit --skipLibCheck` | 零错误 |
| 单元测试 | `npm test` | 304/304 通过 |
| CI 测试 | `npm run test:ci` | `--bail=1` 首个失败即停 |
| Lint | `npx biome lint` | 零错误 |
| 变更日志 | `git diff CHANGELOG.md` | 更新至最新版本 |

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

## 质量复盘记录

| 日期 | 复盘文档 | 关键发现 |
|------|---------|---------|
| 2026-07-13 | `docs/postmortem-2026-07-13.md` | 不安全 supabase 解构模式（4次出现）、DB 同步阻塞本地保存、Profile 系统统一 |
