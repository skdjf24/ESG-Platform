# Step 6.1 修复验收记录

本轮基于 Step 6 分支修复图表统计语义、正式阅读、分页完整性、指标版本联动和动态报告信息，不新增 Step 7 或 Step 8 功能。截图来自本地实际运行的 Chromium，视口为 1720 × 1100；企业、正文和指标仍为原型示例数据。

## 运行截图

| 验收场景 | 截图 |
| --- | --- |
| 同一构成组、两个期间、两个数据系列的真实堆叠柱状图 | [01-stacked-chart-validation.png](01-stacked-chart-validation.png) |
| 跨单位、跨统计边界、可比性未确认的组合被阻断 | [02-invalid-combination-blocked.png](02-invalid-combination-blocked.png) |
| 指标变化后保留 12,680 MWh 旧快照并进入“需更新” | [03-chart-old-snapshot-needs-update.png](03-chart-old-snapshot-needs-update.png) |
| 正式阅读画布不显示内部待办、技术标识、编辑提示或 Mock 内容 | [04-formal-reading-clean.png](04-formal-reading-clean.png) |
| Step 5 新增小标题及长正文在大字号/大行距下重新分页 | [05-long-content-heading-pagination.png](05-long-content-heading-pagination.png) |
| Step 1 企业名称、年度和报告期动态进入 Step 6 封面 | [06-dynamic-project-cover.png](06-dynamic-project-cover.png) |

## 数据模型与统计规则

`MetricObservation` 新增并实际参与校验的字段：

- `metricDefinitionId`：识别同一指标的跨期序列。
- `categoryLabel`、`seriesName`、`compositionGroupId`：分别用于分类、系列和构成关系。
- `reportingBoundary`、`boundaryStatus`：指标自身的统计边界及核验状态；项目报告边界不会被自动代入。
- `sourceConfirmationStatus`、`comparabilityStatus`：来源确认和可比性结论。
- `sampleKind`、`sampleLabel`：区分项目事实与独立模拟测试数据。

`ChartObservationSnapshot` 保存确认时的数值、单位、报告期、统计边界、来源状态、可比性、来源引用和修订号。`ReportChart` 新增 `validationIssues`、`validatedAt` 和 `usesMockData`，使旧图表可以保留快照并等待人工更新。

图表确认规则：

| 图表类型 | 主要约束 |
| --- | --- |
| 柱状图 | 多项数据须为同一期间的分类比较，或同一指标的期间比较；单位和边界一致。 |
| 折线图 | 同一 `metricDefinitionId`、至少两个不重复期间，且单位、边界和可比性均一致。 |
| 堆叠柱状图 | 至少两个系列；同一构成组、单位和边界；每个系列具有一致的分类期间。 |
| 饼图 | 同一期间、单位、边界及构成组；分类不重复，数值非负且合计大于零。 |
| KPI 卡片 | 精确展示指标、期间、分类、数值和单位；仍要求已确认指标、来源和边界。 |

图表显示单位若与指标单位不同也会阻断确认；当前原型不会在没有换算规则的情况下重标单位。

当前示例企业没有足够的真实跨期序列，因此新增的数据仅是与 `WritingFact` 分离的独立图表测试样本，界面明确标注“独立模拟测试”，不会作为企业事实、正文引用或正式阅读内容。

## 分页与正式阅读

- 所有 Step 5 内容块按 Step 3/5 章节顺序进入页面生成；仅首个与章节标题重复的种子标题会去重，用户新增小标题保留。
- 长段落按句子和安全字符长度分片，长表格保留表头并分行分页；案例和图表作为不可拆分块处理。
- 页面容量随上下边距、正文字号和行距重新计算；版面问题包含具体 `pageId`、内容块名称及 `blockId`，并位于编辑画布外提示。
- 正式阅读直接排除内部待办、未解决内部标记、待复核引用、未确认图表和独立模拟测试图表。内部问题只在报告画布外统一提示。
- 预览页码仍只用于浏览器定位，不宣称等同于 Step 8 最终导出页码。

## 浏览器回归结果

| # | 用例 | 结果 |
| --- | --- | --- |
| 1 | 柱状、折线、堆叠柱、饼图、KPI 分别使用合法数据组合渲染 | 通过 |
| 2 | 小时与 MWh、不同边界、可比性未确认的组合被阻断并显示原因 | 通过 |
| 3 | 正式阅读画布不含内部待办、`blockId`、编辑提示和 Mock 说明 | 通过 |
| 4 | 60 段长正文完整出现 60 次，无静默截断 | 通过 |
| 5 | Step 5 新增“分页验收小标题”，Step 6 出现且仅出现 1 次 | 通过 |
| 6 | 字号 14、行距 2.2、上下边距 28 mm 后重新分页，正文区域溢出为 0 | 通过 |
| 7 | 指标 12,680 → 13,000 后旧图保持 12,680；事实重新确认并接受更新后显示 13,000 | 通过 |
| 8 | Step 1 名称、年度、报告期变化后封面/页眉更新，图表进入“需更新” | 通过 |
| 9 | 保存后刷新恢复图表、字号、行距及长正文；Step 1–6 路由继续可用 | 通过 |
| 10 | 10 行数据表拆成 2 个表格片段，数据行总数保持 10，正文区域溢出为 0 | 通过 |
| 11 | 将 MWh 指标显示单位改为 kg 时阻断确认，未执行隐式单位换算 | 通过 |

五类图表均由 Recharts 实际生成 DOM/SVG。堆叠柱状图断言 `data-series-count=2`；非法组合的人工确认按钮保持禁用。浏览器验收脚本同时检查了正式阅读禁用词、内容出现次数、DOM `scrollHeight/clientHeight` 及刷新恢复。

## 迁移与数据保护

`ReportPresentationState.schemaVersion` 从 1 升级至 2。Repository 接受旧版 Step 6 状态并执行兼容迁移：

- 保留原 Step 1–5 数据、正文、版本、引用和图表数值快照。
- 从当前项目事实重建轻量 `MetricObservation`，不复制正文或建立第二套项目存储。
- 旧图表若不满足新校验条件则进入“需更新”，不会静默成为已确认状态。
- 项目报告边界或报告期变化只标记图表复核，不替换指标自身统计边界。
- localStorage 只保存配置、数据和来源引用，不保存图片二进制、截图或页面栅格。

## 已知限制

- 分页采用可重复的浏览器端估算与分片，不是 Word/PDF 排版引擎；字体可用性变化仍可能影响最终导出分页。
- 独立模拟测试数据只覆盖图表交互，不代表示例企业真实绩效，也不会进入正式阅读。
- 饼图校验确认构成组、期间、单位、边界和非负合计，但当前模型没有“应等于某个已确认总量”的额外对账字段。
- 正式阅读当前按内容块整体排除待确认内容，尚未实现段落内句子级脱敏或 Step 7 语义审校。
- 本轮不包含正式 Word/PDF 导出、Step 7 全面检查、Step 8 页码重算、后端数据库、多用户协作或真实 AI。

## 检查命令

```text
npm run lint       通过
npm run typecheck  通过
npm run build      通过
git diff --check   通过
```

