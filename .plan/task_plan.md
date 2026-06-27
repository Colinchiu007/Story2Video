# 项目: Story2Video
# 目标: 实现所有 deferred features（PRD section 8 + 缺失 Tab + 测试覆盖率）
# 创建: 2026-06-27

## 任务清单

| # | 任务 | 依赖 | 风险 | PRD | 测试 | 状态 |
|---|------|------|------|-----|------|------|
| 1 | 自定义水印功能 (WatermarkPicker 组件 + 配置存储) | - | low | yes | yes | completed |
| 2 | 视频分享功能 (ShareButton + 分享链接生成) | - | low | yes | yes | completed |
| 3 | BGM 演示 URL 替换 (SoundHelix → 生产音频 CDN) | - | low | no | yes | completed |
| 4 | 批量导出功能 (zip 打包 + download) | - | low | yes | yes | completed |
| 5 | 音频生成模式 Tab (创作页面新增) | - | low | yes | yes | completed |
| 6 | 分段视频模式 Tab (创作页面新增) | - | low | yes | yes | completed |
| 7 | 页面组件测试 (CreatePage, ResultPage, GalleryPage 等) | - | low | no | yes | completed |
| 8 | 服务层测试 (image-generation, video-generation, tts 等) | - | low | no | yes | completed |
| 9 | 视频编辑功能 (基础 clip/cut UI + 字幕/BGM 编辑增强) | 3 | low | yes | yes | pending |
| 10 | 用户个人主页与作品展示页面 | - | low | yes | yes | completed |
| 11 | 视频模板功能 (模板选择器 + 预设) | - | low | yes | yes | completed |
| 12 | 视频特效库 (滤镜选择器 + 转场选择器) | - | low | yes | yes | completed |
| 13 | 多人协作功能 (共享项目、邀请、权限) | - | low | yes | yes | pending |
| 14 | 发布到第三方平台 (集成 Multi-Publish API) | - | low | yes | yes | pending |
| 15 | 付费会员功能 (集成 orchestrator 订阅系统) | - | low | yes | yes | pending |
| 16 | 更新 PRD 文档 (同步所有新功能) | 1-15 | low | no | no | pending |
| 17 | E2E 集成测试 | 1-15 | low | no | yes | pending |
| 18 | Edge Functions 测试 | - | low | no | yes | pending |

## DAG 图示

```
Layer 1 (并行):  1  2  3  4  5  6  7  8  10  11  12  13  14  15  18
                    \  \  \  \  \  \  \   \   \   \   \   \   \   \
Layer 2 (串行):    9 (depends on 3)                                  \
                    \                                               \
Layer 3 (串行):     16 (depends on 1-15)                            17 (depends on 1-15)
```

## 说明
- 任务 1-6: quick wins + medium features（前端组件 + 路由注册）
- 任务 7-8: 测试覆盖率补全（TDD RED→GREEN）
- 任务 9-15: 大型功能（需先调研现有代码 + 设计文档）
- 任务 16: 最后更新 PRD
- 任务 17-18: 最终验证
- 所有任务默认走 TDD: RED（写失败测试）→ GREEN（最小实现）→ REFACTOR
- 本项目的 CLAUDE.md 和 AGENTS.md 已存在，参考其中开发规范
- 本项目使用 Vitest + jsdom，测试命令: `npm test` 或 `npx vitest run`
- 本项目使用 Biome 作为 linter: `npx biome lint`
