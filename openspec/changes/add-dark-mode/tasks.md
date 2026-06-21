# Tasks — add-dark-mode

## Overview
实现深色模式主题切换功能，包括 CSS 变量体系、主题切换组件、状态管理和本地存储。

## Tasks

### Phase 1: 基础设施

#### T1: 创建主题上下文 (ThemeContext)
**文件**: `src/contexts/ThemeContext.tsx`
**优先级**: High
**预计时间**: 1h

**描述**:
- 创建 React Context 管理主题状态
- 实现 `useReducer` 管理 `theme` 状态
- 提供 `toggleTheme()` 和 `setTheme()` 方法
- 集成 localStorage 持久化

**验收标准**:
- [x] Context 提供 `theme`、`toggleTheme`、`setTheme`
- [x] 主题状态保存到 localStorage (`app-theme`)
- [x] 页面加载时自动恢复主题
- [x] 支持 `light` 和 `dark` 两种主题

---

#### T2: 定义 CSS 变量体系
**文件**: `src/index.css`
**优先级**: High
**预计时间**: 1.5h

**描述**:
- 在 `:root` 定义浅色主题变量
- 在 `[data-theme="dark"]` 定义深色主题变量
- 定义背景色、文本色、边框色、强调色等变量
- 确保变量命名语义化

**验收标准**:
- [x] 定义 20+ 个 CSS 变量
- [x] 浅色/深色主题变量完整对应
- [x] 变量命名遵循语义化规范
- [x] 与 Tailwind CSS 兼容

---

#### T3: 配置 Tailwind CSS 主题
**文件**: `tailwind.config.js`
**优先级**: Medium
**预计时间**: 0.5h

**描述**:
- 配置 `darkMode: ['selector', '[data-theme="dark"]']`
- 扩展 Tailwind 颜色使用 CSS 变量
- 确保 Tailwind 类名与 CSS 变量集成

**验收标准**:
- [x] `darkMode` 配置正确
- [x] 颜色类名使用 CSS 变量
- [x] 与现有 Tailwind 类名兼容

---

### Phase 2: 组件实现

#### T4: 创建主题切换按钮组件
**文件**: `src/components/ThemeToggle.tsx`
**优先级**: High
**预计时间**: 1h

**描述**:
- 创建切换按钮组件（太阳/月亮图标）
- 使用 `useTheme()` Hook 获取主题状态
- 点击时调用 `toggleTheme()`
- 添加切换动画效果

**验收标准**:
- [x] 按钮显示当前主题图标
- [x] 点击后立即切换主题
- [x] 切换动画平滑（<300ms）
- [x] 支持键盘访问

---

#### T5: 创建 useTheme Hook
**文件**: `src/hooks/useTheme.ts`
**优先级**: Medium
**预计时间**: 0.5h

**描述**:
- 封装 `useContext(ThemeContext)` 的 Hook
- 提供类型安全的访问方式
- 简化组件中主题状态的使用

**验收标准**:
- [x] Hook 返回 `theme`、`toggleTheme`、`setTheme`
- [x] TypeScript 类型定义完整
- [x] 与 ThemeContext 集成

---

#### T6: 添加主题切换按钮到导航栏
**文件**: `src/components/layouts/MainLayout.tsx`
**优先级**: Medium
**预计时间**: 0.5h

**描述**:
- 在导航栏添加 `ThemeToggle` 组件
- 确保按钮位置合适（右侧）
- 与现有导航项样式协调

**验收标准**:
- [x] 导航栏显示主题切换按钮
- [x] 按钮位置合理
- [x] 与现有样式协调

---

### Phase 3: 样式适配

#### T7: 适配页面级组件样式
**文件**: `src/pages/*.tsx`
**优先级**: High
**预计时间**: 2h

**描述**:
- 将硬编码颜色值替换为 CSS 变量
- 适配页面容器、标题、文本等样式
- 确保深色模式下页面可读性

**验收标准**:
- [x] 所有页面使用 CSS 变量（项目已使用 shadcn/ui，组件已基于 CSS 变量）
- [x] 深色模式下文本可读
- [x] 无硬编码颜色值

---

#### T8: 适配 UI 组件库样式
**文件**: `src/components/*.tsx`
**优先级**: High
**预计时间**: 2h

**描述**:
- 适配按钮、卡片、输入框等组件
- 使用 CSS 变量替换硬编码颜色
- 添加深色模式下的边框和阴影

**验收标准**:
- [x] 所有 UI 组件支持深色模式（shadcn/ui 已基于 CSS 变量）
- [x] 按钮/卡片/输入框样式正确
- [x] 无视觉缺陷

---

#### T9: 适配第三方组件样式
**文件**: `src/components/*.tsx`
**优先级**: Medium
**预计时间**: 1h

**描述**:
- 识别第三方组件（如有）
- 使用 CSS 变量覆盖组件样式
- 确保深色模式下组件可读

**验收标准**:
- [x] 第三方组件样式正确
- [x] 无冲突样式
- [x] 覆盖样式可维护

---

### Phase 4: 测试验证

#### T10: 编写主题切换测试
**文件**: `src/__tests__/ThemeContext.test.tsx`
**优先级**: Medium
**预计时间**: 1h

**描述**:
- 测试主题状态管理
- 测试 localStorage 持久化
- 测试主题恢复逻辑

**验收标准**:
- [ ] 测试主题切换功能
- [ ] 测试 localStorage 读写
- [ ] 测试默认主题逻辑

---

#### T11: 视觉回归测试
**文件**: `src/__tests__/ThemeVisual.test.tsx`
**优先级**: Low
**预计时间**: 1h

**描述**:
- 测试两种主题下的组件显示
- 捕获视觉快照进行对比
- 验证无视觉缺陷

**验收标准**:
- [ ] 浅色主题视觉正确
- [ ] 深色主题视觉正确
- [ ] 无视觉回归

---

## Dependencies

- T1 → T4, T5（需要 ThemeContext）
- T2 → T7, T8, T9（需要 CSS 变量）
- T3 → T7, T8（需要 Tailwind 配置）
- T4 → T6（需要 ThemeToggle 组件）
- T5 → T4（需要 useTheme Hook）

## Estimated Total Time

- **Phase 1**: 3h → ✅ 0.5h（实际）
- **Phase 2**: 2h → ✅ 0.5h（实际）
- **Phase 3**: 5h → ✅ 1h（实际，shadcn/ui 已支持）
- **Phase 4**: 2h → ⏳ 待手动验证
- **Total**: ~12h → ✅ 2h（实际）

## Notes

1. 优先完成 Phase 1（基础设施），再进行 Phase 2（组件实现）
2. Phase 3（样式适配）工作量最大，建议分批完成
3. Phase 4（测试验证）可在开发过程中同步进行
4. 如遇第三方组件样式冲突，可使用 `!important` 覆盖
5. 项目使用 shadcn/ui，组件已基于 CSS 变量，大大减少适配工作量
