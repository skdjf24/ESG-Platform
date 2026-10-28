# Step 6 产品验收记录

本轮在 PR #3 的统一项目快照上实现“数据可视化、版式与整本报告预览”。Step 6 没有建立独立报告副本：正文、章节、企业信息、指标和来源均读取当前 `ReportProjectData`，主题、图表和版式配置也通过同一 Repository 保存。

## 运行截图

截图来自本地生产构建，浏览器视口为 1720 × 1100。

| 验收场景 | 截图 |
| --- | --- |
| 澜绿专业主题整本预览 | [01-verdant-full-preview.png](01-verdant-full-preview.png) |
| 蓝灰研报主题整本预览 | [02-slate-full-preview.png](02-slate-full-preview.png) |
| 已确认指标、真实图表配置及原始来源 | [03-chart-config-and-source.png](03-chart-config-and-source.png) |
| 指标修订后图表“需更新”及旧快照保护 | [04-chart-needs-update.png](04-chart-needs-update.png) |

## 数据流与模块关系

```text
Step 4 WritingFact + SourceReference
                │ 保存 / 人工确认 / 修订
                ▼
MetricObservation ────────┐
                          │ observationId
Step 5 WritingChapter     │
  └─ ContentBlock(chart) ─┼─> ReportChart
       blockId            │     ├─ metricObservationIds
       chapterId          │     └─ observationSnapshots（已确认版本快照）
                          ▼
              ReportPresentationState
                ├─ ReportTheme / layout
                ├─ charts
                └─ preview preferences
                          │
                          ▼
             A4 页面生成与整本连续预览
```

- `components/workbench/step-six.tsx`：三栏工作台、导航、预览模式、主题/版式保存与返回 Step 5。
- `components/presentation/report-page.tsx`：八类页面模板及 `blockId` 定位。
- `components/presentation/report-chart.tsx`：Recharts 柱状图、折线图、堆叠柱状图、饼图和 KPI 卡片。
- `components/presentation/chart-config-panel.tsx`：指标、年度、类型、颜色、图例、标签、精度、单位、图注和来源配置。
- `lib/presentation/pages.ts`：按 Step 5 章节顺序生成封面、目录、章节页和正文页，并拆分长表格/长段落。
- `lib/presentation/state.ts`：事实到指标观测的转换、旧存档兼容、图表快照及指标修订联动。
- `lib/presentation/themes.ts`：两套 `ReportTheme`。
- `lib/presentation/mock-ai.ts`：统一的版式 AI Provider Mock。

## 新增数据模型

- `ReportTheme`：主题 ID、A4 纸张、页边距、颜色、中文/英文字体、标题层级、正文、页眉页脚、页码和图表样式。
- `MetricObservation`：`observationId → projectId → metricId`，保存数值/原始值、单位、报告期、边界、来源、修订和确认状态。只有已确认且能安全解析的数值可进入图表。
- `ReportChart`：`chartId → blockId → metricObservationIds`，另保存已确认的 `observationSnapshots`、显示配置、状态和版面复核状态。
- `ReportPresentationState`：主题、版式、指标观测、图表和预览偏好，嵌入 `ReportProjectData.presentation`。
- `PresentationAiTaskProvider`：统一 `run(request, signal)` 接口，响应显式包含 `providerMode: "mock" | "live"`。

PR #3 的 schema v2 存档没有 `presentation` 字段时，Repository 会补充默认 Step 6 状态并写入 `migration-presentation-v1` 记录；原有 Step 1–5 数据、正文、引用和版本数量不变。项目存储仍按 `projectId` 隔离，只保存轻量配置和数据引用，不保存截图或页面栅格。

## 真实实现与 Mock 边界

真实前端功能：

- 三栏工作台、面板收起、章节定位、页面缩略图、单页/连续阅读、缩放和整本聚焦预览。
- 从 Step 5 内容块生成连续报告；正文、表格、案例、图表、目录、页眉页脚和预览页码均实际渲染。
- 两套主题切换，以及页边距、字体、颜色、字号、行距、单双栏、页眉页脚和页码设置。
- 五类 Recharts 图表；仅允许选择已确认的数值指标，并可查看来源文件、位置、摘录和统计边界。
- 图表快照保护：指标修订后旧图不被覆盖，状态转为“需更新”，用户重新确认后才更新快照。
- 版式/图表设置保存到统一 Repository，刷新后恢复；保存失败时停止导航。
- 点击非图表正文返回 Step 5 精确 `chapterId/blockId`；点击图表占位进入对应配置。
- 编辑预览显示内部待办警示；正式阅读模式不把待办当成已完成披露。

明确 Mock：

- “推荐图表类型、生成图表说明、推荐章节版式、识别版面问题”由本地确定性规则返回，界面标注 `Mock AI`，不调用远程服务。
- 示例企业、初始正文和指标仍是原型模拟数据；图表展示的是项目内已确认记录，不补造不存在的年度值。
- 浏览器分页是可重复的 A4 预览机制，不宣称等同于 Word/PDF 排版引擎。

## 自动化验收结果

在生产构建上用 Chromium 执行了下列流程：

| # | 用例 | 结果 |
| --- | --- | --- |
| 1 | Step 5 修改正文并保存，Step 6 显示同一内容 | 通过 |
| 2 | 目录按 Step 3/5 章节顺序生成 | 通过 |
| 3 | 两套主题切换 | 通过 |
| 4 | 柱状/折线/堆叠柱/饼图/KPI 五类图表真实渲染 | 通过 |
| 5 | 已确认指标及来源文件、单元格、边界可查看 | 通过 |
| 6 | 已引用指标从 12,680 修订为 12,682 后图表进入“需更新” | 通过 |
| 7 | 旧快照保持 12,680，重新确认后更新为 12,682 | 通过 |
| 8 | 单页及连续整本预览 | 通过 |
| 9 | 12 个预览页正文区域无固定画布溢出 | 通过 |
| 10 | 刷新后主题、图表和预览设置恢复 | 通过 |
| 11 | Step 1–5 路由回归及 Step 7–8 占位 | 通过 |
| 12 | PR #3 风格旧存档迁移且 Step 5 版本/章节不丢失 | 通过 |

浏览器运行期间：页面脚本错误 0、console error 0、HTTP 4xx/5xx 0、外部请求 0。

```text
npm run lint       通过
npm run typecheck  通过
npm run build      通过
git diff --check   通过
```

## 已知限制

- 当前分页使用浏览器中的内容权重、长段落分片和表格分行机制；预览页码只用于定位，Step 8 正式导出必须根据最终字体和导出渲染器重新分页。
- 不提供自由拖拽式设计画布；主题和版式使用受控配置，优先保证内容完整和来源关联。
- 图表只使用项目中可安全解析且已确认的数值；没有可比年度时不虚构历史序列。
- localStorage 仅适合单浏览器原型，不提供服务端备份、多用户并发或权限审计。
- 本轮不实现 Word/PDF 导出、最终披露索引、Step 7 全面质量检查、数据库、真实文件存储或真实 AI。
