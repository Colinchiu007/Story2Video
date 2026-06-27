# Story2Video/src — 源码上下文

> 源码目录 `src/`. 本文件在 AI 操作该目录代码时自动加载。

## 目录结构

### TypeScript 模块

- `App.tsx`
- `global.d.ts`
- `main.tsx`
- `routes.tsx`
- `svg.d.ts`
- `vite-env.d.ts`

### 子目录

- `__mocks__/`
- `components/` (3 子目录)
- `contexts/`
- `db/`
- `hooks/`
- `lib/`
- `pages/`
- `services/`
- `types/`

## 编辑规范

- 修改代码前先阅读对应模块的现有实现，理解接口契约
- 遵循项目 `.clinerules` 中的架构约束
- 新增文件需保持一致的命名风格
- 提交前运行 `pytest` 或 `npm test` 确保无回归
