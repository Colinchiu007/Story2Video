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