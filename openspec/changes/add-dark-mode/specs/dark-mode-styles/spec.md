# Dark Mode Styles Specification

## Overview
深色模式样式系统，基于 CSS 变量实现主题切换，所有组件通过变量引用颜色值。

## Requirements

### Functional Requirements
- 定义完整的深色/浅色主题 CSS 变量体系
- 所有颜色值通过 CSS 变量引用，不硬编码
- 切换主题时立即生效（<100ms）
- 保持与现有 Tailwind CSS 兼容

### Non-Functional Requirements
- CSS 变量命名遵循语义化规范
- 变量定义集中管理，便于维护
- 不影响页面渲染性能
- 支持所有现代浏览器

## Design Tokens

### 颜色变量

```css
/* 浅色主题（默认） */
:root {
  /* 背景色 */
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-tertiary: #f1f5f9;

  /* 文本色 */
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;

  /* 边框色 */
  --border-primary: #e2e8f0;
  --border-secondary: #cbd5e1;

  /* 强调色 */
  --accent-primary: #3b82f6;
  --accent-hover: #2563eb;

  /* 状态色 */
  --success: #22c55e;
  --warning: #f59e0b;
  --error: #ef4444;

  /* 阴影 */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
}

/* 深色主题 */
[data-theme="dark"] {
  /* 背景色 */
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --bg-tertiary: #334155;

  /* 文本色 */
  --text-primary: #f8fafc;
  --text-secondary: #cbd5e1;
  --text-muted: #64748b;

  /* 边框色 */
  --border-primary: #334155;
  --border-secondary: #475569;

  /* 强调色 */
  --accent-primary: #60a5fa;
  --accent-hover: #3b82f6;

  /* 状态色 */
  --success: #4ade80;
  --warning: #fbbf24;
  --error: #f87171;

  /* 阴影 */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
}
```

### 颜色语义映射

| 用途 | 浅色值 | 深色值 | 说明 |
|------|--------|--------|------|
| 页面背景 | `#ffffff` | `#0f172a` | 主背景 |
| 卡片背景 | `#f8fafc` | `#1e293b` | 次级背景 |
| 悬停背景 | `#f1f5f9` | `#334155` | 交互反馈 |
| 主文本 | `#0f172a` | `#f8fafc` | 标题/正文 |
| 次要文本 | `#475569` | `#cbd5e1` | 描述/说明 |
| 弱化文本 | `#94a3b8` | `#64748b` | 时间戳/标签 |
| 主强调 | `#3b82f6` | `#60a5fa` | 按钮/链接 |
| 悬停强调 | `#2563eb` | `#3b82f6` | 交互反馈 |

## Component Mapping

### Tailwind CSS 集成

```javascript
// tailwind.config.js
module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        border: {
          primary: 'var(--border-primary)',
          secondary: 'var(--border-secondary)',
        },
      },
    },
  },
}
```

### 组件类名映射

```css
/* 通用组件样式 */
.card {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  box-shadow: var(--shadow-sm);
}

.text-primary { color: var(--text-primary); }
.text-secondary { color: var(--text-secondary); }
.text-muted { color: var(--text-muted); }

.bg-primary { background-color: var(--bg-primary); }
.bg-secondary { background-color: var(--bg-secondary); }
.bg-tertiary { background-color: var(--bg-tertiary); }

.border-primary { border-color: var(--border-primary); }
.border-secondary { border-color: var(--border-secondary); }
```

## Edge Cases

1. **首次访问**: 默认浅色主题，`data-theme` 属性未设置
2. **JavaScript 禁用**: 无 `data-theme` 属性，显示浅色主题
3. **第三方组件**: 使用 CSS 变量覆盖，或添加 `!important`
4. **内联样式**: 无法通过 CSS 变量覆盖，需重构

## Testing

### Unit Tests
- 测试 CSS 变量在不同主题下的值
- 测试主题切换时变量更新

### Visual Tests
- 测试所有组件在两种主题下的显示
- 测试切换动画平滑性
- 测试边界情况（极长文本、空状态等）
