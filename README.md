# ESG Disclosure Platform

ESG 报告编制网站的前端产品原型。项目以一个虚构示例企业“华澜新材料股份有限公司”和其 2025 年度 ESG 报告为主线，当前覆盖企业画像、实质性议题、披露框架、资料与事实、报告内容编辑、数据可视化与整本预览，以及 Step 7 报告质量与披露完整性检查。Step 1–7 共享统一的项目数据仓库。

当前版本使用本地模拟数据，不接入真实 AI、文件存储或后端接口。

## 技术栈

- Next.js 16（App Router）
- React 19
- TypeScript 5（严格模式）
- Tailwind CSS 4
- Lucide React 图标
- Recharts 3
- ESLint 9

## 本地启动

建议使用 Node.js 20.9 或更高版本。

```bash
npm install
npm run dev
```

开发服务器启动后访问 `http://localhost:3000`。

生产构建与运行：

```bash
npm run build
npm run start
```

## 页面与路由

| 路由 | 页面 | 当前状态 |
| --- | --- | --- |
| `/` | 项目首页 | 已实现 |
| `/reports/hualan-2025/step/1` | 创建报告与企业基础画像 | 已实现原型 |
| `/reports/hualan-2025/step/2` | ESG 实质性议题评估 | 已实现原型 |
| `/reports/hualan-2025/step/3` | 构建披露框架与报告大纲 | 已实现原型 |
| `/reports/hualan-2025/step/4` | ESG 资料收集、汇总与规整 | 已实现原型 |
| `/reports/hualan-2025/step/5` | 报告内容生成与编辑 | 已实现前端工作台 |
| `/reports/hualan-2025/step/6` | 数据可视化、版式与整本报告预览 | 已实现前端工作台 |
| `/reports/hualan-2025/step/7` | 报告质量与披露完整性检查 | 已实现前端工作台与规则引擎 |
| `/reports/hualan-2025/step/8` | 定稿与导出 | 待开发占位页 |

工作台侧边导航、首页“继续编辑”以及每一步底部的上一步/下一步均使用真实 App Router 路由。当前仅提供示例项目 `hualan-2025`，未知项目或无效步骤会进入 404 页面。

## 目录说明

```text
app/
├── layout.tsx                         # 根布局与页面元数据
├── page.tsx                           # 项目首页入口
├── globals.css                        # Tailwind 引入、全局变量及少量通用样式
├── not-found.tsx                      # 无效项目/步骤的空状态
└── reports/[projectId]/step/[step]/
    └── page.tsx                       # Step 1–8 动态路由与页面分发

components/
├── project/
│   └── project-data-provider.tsx      # 项目级状态、保存、撤销/重做与跨步骤影响提示
├── dashboard/
│   └── dashboard-page.tsx             # 首页、示例项目卡与新建报告弹窗
├── workbench/
│   ├── workbench-shell.tsx            # 工作台顶栏、桌面侧栏和平板抽屉导航
│   ├── step-page-header.tsx            # 统一步骤页头
│   ├── step-footer.tsx                 # 上一步、保存草稿、下一步
│   ├── step-one.tsx                    # Step 1
│   ├── step-two.tsx                    # Step 2
│   ├── step-three.tsx                  # Step 3
│   ├── step-four.tsx                   # Step 4
│   ├── step-five.tsx                   # Step 5 三栏报告编制工作台
│   ├── step-six.tsx                    # Step 6 三栏版式与整本预览工作台
│   ├── step-seven.tsx                  # Step 7 三栏质量检查工作台
│   └── step-placeholder.tsx            # Step 8 占位页
├── presentation/
│   ├── report-page.tsx                 # A4 页面、八类模板与 blockId 定位
│   ├── report-chart.tsx                # 五类 Recharts 图表
│   └── chart-config-panel.tsx           # 图表指标、统计校验、来源与显示配置
├── writing/
│   ├── rich-text.tsx                   # 可编辑富文本正文块
│   ├── block-editor.tsx                # 六类结构化内容块编辑器
│   ├── resource-panel.tsx              # 章节资料包、披露映射与来源引用
│   ├── ai-dialog.tsx                   # Mock AI 原文/建议对照流程
│   ├── policy-dialog.tsx               # Writing Policy 设置
│   └── use-writing-document.ts         # Step 5 对统一项目状态的兼容适配层
└── ui/
    ├── brand-mark.tsx                  # 品牌标识
    ├── notice.tsx                      # 信息、警示与 AI 示例提示
    ├── progress-bar.tsx                # 进度条
    ├── section-card.tsx                # 内容卡片容器
    └── status-badge.tsx                # 状态标签

lib/
├── data/mock-data.ts                   # 示例企业、项目及 Step 1–4 模拟数据
├── project/
│   ├── seed.ts                         # 统一项目快照初始数据
│   ├── repository.ts                   # Repository 接口的 localStorage 实现及旧草稿迁移
│   └── synchronize.ts                  # 跨步骤差异识别、关联同步与复核标记
├── presentation/
│   ├── state.ts                        # 指标观测、图表快照、迁移与修订联动
│   ├── pages.ts                        # 内容块分页与整本报告页面生成
│   ├── chart-validation.ts             # 五类图表的统计口径与确认校验
│   ├── sample-observations.ts          # 独立且明确标注的图表测试数据
│   ├── themes.ts                       # 两套专业报告主题
│   └── mock-ai.ts                      # 版式辅助 Mock AI Provider
├── quality/
│   ├── state.ts                        # Step 7 状态、兼容迁移、汇总与定稿准备状态
│   ├── rules.ts                        # 五类确定性质量检查规则
│   ├── engine.ts                       # 检查运行、稳定问题身份、复检与处理记录
│   └── mock-ai.ts                      # 质量审校 Mock AI Provider
├── types/
│   ├── esg.ts                          # 基础 TypeScript 业务类型
│   ├── project-data.ts                 # 项目聚合、影响记录与 Repository 契约
│   ├── writing.ts                      # Step 5 内容块、引用、版本及 AI 类型
│   ├── presentation.ts                 # Step 6 主题、指标、图表、版式及 AI 类型
│   └── quality.ts                      # Step 7 规则、问题、运行、处理与 AI 类型
└── writing/
    ├── document.ts                     # 编制文档、校验、引用协调及规则检查
    └── mock-ai.ts                      # 本地确定性 Mock AI Provider
```

## TypeScript 数据类型

基础类型位于 `lib/types/esg.ts`，目前覆盖：

- 企业、报告项目和八步流程状态
- 历史资料与来源类型
- ESG 议题及财务/影响重要性评分
- 披露要求、系统建议与用户确认的适用性
- 报告章节及年度资料需求
- 建议责任部门、实际责任部门与资料收集状态
- AI 规整示例结果
- 企业事实、原始文件和页码/工作表/单元格级来源关联

示例种子数据统一位于 `lib/data/mock-data.ts`，由 `lib/project/seed.ts` 组合为项目快照；Step 1–7 页面读取同一项目状态，不再各自维护相互隔离的业务副本。

项目聚合类型和 Repository 契约位于 `lib/types/project-data.ts`。原型使用 `LocalStorageReportProjectRepository`，存储键为 `esg:report-project:{projectId}:v2`；接口为异步设计，可在后续以 API/PostgreSQL Repository 替换，而不改变页面保存调用。项目快照仅保存文件元数据及来源定位，拒绝写入 `File`、`Blob`、`ArrayBuffer` 等二进制内容。

Step 5 类型位于 `lib/types/writing.ts`，核心关联为：

```text
披露要求 ── DisclosureMapping ──> 报告章节 ──> ContentBlock
企业事实/ESG 指标 ── FactCitation ──> ContentBlock
原始资料 ── SourceReference ──> 企业事实 / ContentBlock
案例/制度/历史资料 ── WritingResource ──> SourceReference / ContentBlock
ContentBlock.revision ──> ChapterVersion + ReviewStatus
```

内容块保存稳定 `id`、所属章节、披露映射、事实引用快照、原始来源、修订号和审校状态。事实修订号变化或失去人工确认时，已有引用会转为“待复核/待更新”，披露覆盖状态同步转为“待核验”。

Step 6 类型位于 `lib/types/presentation.ts`，核心关联为：

```text
WritingFact / SourceReference ──> MetricObservation
ContentBlock(chart).blockId ──> ReportChart ──> metricObservationIds
ReportChart.observationSnapshots ──> 已确认指标版本与来源快照
ReportPresentationState ──> ReportTheme / layout / charts / preview
```

`MetricObservation` 记录指标定义、分类、系列、构成组、指标自身统计边界、来源确认、可比性和修订号。`ChartObservationSnapshot` 固化确认时的口径与来源，指标值、单位、报告期、边界、来源状态或修订变化时，相关图表进入“需更新”并保留旧图。

旧项目没有 `presentation` 时会兼容补充默认版式；Step 6 schema v1 会迁移至 v2。原 Step 1–5 正文、引用、来源和版本保持不变。

Step 7 类型位于 `lib/types/quality.ts`，核心关联为：

```text
DisclosureRequirement ──> WritingChapter / ContentBlock ──> FactCitation
WritingFact / MetricObservation ──> SourceReference
ContentBlock(chart) ──> ReportChart / PreviewPage
上述稳定 ID ──> QualityIssue ──> QualityCheckRun / QualityActionRecord
```

`QualityIssue` 保存规则、严重程度、证据、来源步骤、章节/内容块/事实/图表 ID、处理状态和稳定身份。人工“标记已处理”只进入“待复检”，只有确定性规则再次运行且不再命中时才进入“已复检解决”。旧项目没有 `quality` 时会兼容补充空状态并记录迁移，不改写 Step 1–6 数据。

## 已实现功能

### 项目首页

- “我的 ESG 报告项目”概览与统计卡
- 示例企业与示例报告项目
- 项目编制进度、当前步骤和下一步建议
- “继续编辑”路由跳转
- “新建报告”弹窗及基础表单

### 工作台通用布局

- 八步侧边导航及当前步骤高亮
- 桌面侧边栏、平板抽屉导航与响应式内容区
- 项目进度、保存状态、上一步/下一步导航
- 复杂表格横向滚动与可读性优化

### Step 1：创建报告与企业基础画像

- 企业基本信息和 GB/T 4754 行业信息
- A 股、H 股、A+H、未上市身份选择
- 披露框架多选、报告边界、边界说明
- 历史报告上传区及文件记录
- 按 E/S/G 分类的初始议题池与调整交互

### Step 2：ESG 实质性议题评估

- 议题搜索、分类筛选及纳入/移出
- 评估方式选择与参与范围展示
- 财务重要性、影响重要性评分表
- 双重重要性矩阵
- 重点议题结果及用户确认交互

### Step 3：构建披露框架与报告大纲

- 披露要求矩阵、框架筛选和搜索
- 系统建议与用户适用性确认分离
- 报告目录、章节选择与章节编辑区
- 本年度 ESG 报告所需资料清单
- 企业现有 Excel 收集方式展示

### Step 4：ESG 资料收集、汇总与规整

- 年度资料统计、搜索与资料任务表
- 系统建议部门和可调整的实际责任部门
- 文件上传、在线补充、企业现有 Excel 三种收集方式
- AI 资料规整前后对照及人工确认
- 企业事实库与原始文件、工作表/单元格、页码关联

### Step 5：报告内容生成与编辑

- 报告章节树：复用 Step 3 目录，支持章节搜索、折叠、切换和状态展示
- 三栏工作台：章节树、结构化内容编辑器、可折叠章节资料包
- 标题、富文本段落、指标表格、案例、图表占位、待处理事项六类真实可编辑内容块
- 保存、撤销、重做、章节状态、独立审校状态、本地版本记录与版本恢复
- 披露要求映射的添加/解除，以及“部分覆盖、已覆盖、待核验”状态调整
- 企业事实/ESG 指标引用、解除引用、人工确认、来源文件与具体定位查看
- 案例、制度和历史资料的人工确认状态随本地草稿持久化
- 事实来源修订后的正文“待复核/待更新”联动
- “待补充、待确认、待更新”内部标记及资料包汇总
- 可配置 Writing Policy 与基于词语规则的 ESG 空泛表述检查
- 六种 Mock AI 操作及原文/建议版本对照、接受、重新生成、取消流程
- 草稿和版本记录保存在当前浏览器 `localStorage`，刷新后可恢复

### Step 6：数据可视化、版式与整本报告预览

- 与 Step 5 一致的三栏工作台：报告导航、A4 报告画布、可折叠版式/图表设置
- 报告封面、关于本报告、自动目录、章节首页、正文、绩效数据、案例专题和附录八类页面模型
- 从 Step 5 已保存章节和内容块生成整本报告，不维护单独硬编码正文
- 澜绿专业、蓝灰研报两套主题；支持页边距、字体、颜色、字号、行距、单双栏、页眉页脚和预览页码设置
- 柱状图、同指标时间序列折线图、真实多系列堆叠柱状图、同口径构成饼图和 KPI 卡片五类真实图表
- 图表确认前校验单位、报告期、指标统计边界、可比性、确认状态、来源和修订版本，并显示具体阻断原因
- 图表仅关联满足当前图表统计规则的指标，可查看来源文件、具体位置、摘录和统计边界
- 指标版本变化后图表进入“需更新”，保留旧数据快照，人工重新确认后才更新
- 正式阅读画布排除内部待办、未确认/待更新内容、技术标识和独立模拟测试内容，并在画布外统一提示
- 长段落和长表格安全分片，新增小标题保留；字号、行距及边距变化后重新分页并定位具体版面问题
- 单页、连续阅读、缩放、页面缩略图、章节跳转和整本聚焦预览
- 预览内容保留 `blockId`；正文可返回 Step 5 精确编辑位置，图表占位可直接进入配置
- 主题、图表、版式及预览偏好保存到同一项目 Repository，刷新后恢复

### Step 7：报告质量与披露完整性检查

- 三栏工作台：检查分类与筛选、可搜索排序的问题清单、证据和处理详情
- 顶部概览：披露覆盖、问题严重程度、解决/复检/例外数量、检查版本和定稿准备状态
- 五类真实确定性规则：披露完整性、事实与来源、数据一致性、Writing Policy、版式与结构
- 覆盖状态区分“未覆盖、部分覆盖、待核验、已核验覆盖”；正文映射存在不等于充分披露
- 事实存在性、人工确认、引用修订、报告期、来源文件和具体位置检查
- 仅在指标定义、单位、期间和已核验统计边界均一致时自动判断数据冲突
- 表格未建立指标级引用时明确标记“无法自动核验”，不虚构匹配结果
- 图表旧快照、待确认、需更新、来源状态及版面待复核检查
- 复用 Writing Policy 的可复现词语规则；命中词语只生成带上下文的人工复核提示
- 稳定问题身份、完整检查/章节检查/修改项复检、检查历史和处理记录
- “认可问题、返回修改、标记已处理、接受例外、重新检查”流程；阻断问题不能普通例外绕过
- 通过稳定 ID 定位 Step 3 披露要求、Step 4 事实、Step 5 内容块和 Step 6 图表
- 上游保存后旧检查结果进入待复检，正文、来源、图表快照和旧问题历史均保留
- 内部质量报告摘要和定稿准备状态只代表平台流程，不构成合规认证或外部鉴证

## 模拟功能说明

以下交互用于产品原型演示，不会写入后端或产生真实业务结果：

- 首页新建报告表单和项目统计
- 所有企业、议题、披露要求、资料、事实及来源数据
- 历史报告和资料文件上传
- 在线资料补充
- 议题增删、评分方式切换、适用性及重要性确认
- 责任部门调整、草稿保存和保存状态
- AI 资料解析与规整结果
- Step 5 的企业事实、资料包、披露映射和章节初始正文
- Step 5 AI 建议：由本地固定规则的 `mockAiProvider` 生成，不调用远程服务
- Step 6 图表/版式建议：由本地确定性 `mockPresentationAiProvider` 返回，并明确标注 `Mock AI`
- Step 7 AI 建议：由 `mockQualityAiProvider` 返回固定演示流程，不能判断披露义务、充分性或事实真实性，也不会自动修改正文
- Step 1–7 统一项目保存和 Step 5 版本恢复：仅使用当前浏览器 `localStorage`，不等同于服务器持久化或多人协作

所有 AI 结果在界面中明确标注为“示例 AI 规整结果”，需要人工确认后才表现为可进入事实库。项目没有调用真实 AI 接口，也没有 API 路由或外部数据请求。

Step 5 的 AI 弹窗明确标注“Mock 示例建议”，接受前必须勾选人工确认。空泛表述检查仅为可配置词语匹配规则，不宣称具备完整 AI 语义审校能力。写作与版式分别提供可注入的 `AiTaskProvider` 和 `PresentationAiTaskProvider`，均包含 Provider ID、`mock/live` 模式、显示标签和 `run(request, signal)`；后续真实服务需在服务端补充身份鉴权、数据权限、审计、超时/重试、来源校验和敏感信息治理。

## 业务约束

- 平台不自动判断企业是否具有强制披露义务；上市身份仅作为企业信息记录。
- 实质性议题的重要性结论由用户复核并确认。
- 披露要求的适用性由用户逐项确认，系统建议不是最终结论。
- 资料责任部门仅由系统建议，用户可以调整实际责任部门。
- 支持沿用企业现有 Excel 收集资料，不提供独立模板生成模块。
- 尚未收集的资料只显示“待收集”等流程状态，不预判为数据缺失。
- AI 模拟结果必须人工确认。
- 企业事实保留与原始文件及具体定位信息的关联。
- 上游数据变化只同步共享数据和复核状态，不自动改写或删除 Step 5 已编辑正文。
- 未确认事实不会因同步而自动变为已确认；事实修订会保留旧引用版本并提示待更新。

## Step 1–7 数据贯通

```text
Step 1 企业画像 / 年度 / 框架
             ↓
Step 2 议题与人工确认 ──→ Step 3 披露要求 / 目录 / 资料需求
                                      ↓                 ↓
                          Step 5 章节与披露映射 ←── Step 4 事实 / 指标 / 来源
                                      ↓                         ↓
                              内容块 / 引用 / 版本 ──→ Step 6 页面 / 图表 / 版式
                                      └──────────────→ Step 7 规则 / 问题 / 复检
```

- 所有跨步骤对象使用稳定 ID；保存时对比上一已保存快照并生成 `ChangeImpact`。
- Step 3 章节名称和顺序会同步到 Step 5；被上游移除的章节仍保留正文并标记“上游已移除”。
- Step 4 事实值、确认状态或来源修订变化后，引用块进入“待复核/待更新”，正文文本不变。
- Step 5 仍保留章节版本；旧键 `esg:{projectId}:writing:v1` 可读入新快照，旧键不会被删除或覆盖。
- Step 6 的图表保存指标版本快照；上游数值变化只标记“需更新”，不会覆盖旧图或 Step 5 正文。
- Step 7 引用现有对象 ID 而不复制整份报告；Step 1–6 保存后检查状态标记待复检，旧运行和人工处理历史保留。
- 通过 `projectId` 生成独立存储键，并在 Repository 保存时校验项目 ID 与快照修订号。

Step 5.5 数据贯通见 [docs/acceptance/step5-5/README.md](docs/acceptance/step5-5/README.md)；Step 6 截图、数据流、自动化测试和限制见 [docs/acceptance/step6/README.md](docs/acceptance/step6/README.md)；Step 7 截图、规则边界、回归记录和已知限制见 [docs/acceptance/step7/README.md](docs/acceptance/step7/README.md)。

## 待开发范围

- Step 8：定稿与导出
- Word/PDF 正式导出与最终披露索引
- 后端 API、数据库、真实身份与权限体系
- 真实文件存储、解析和在线协作
- 真实 AI 服务接入
- 服务端数据持久化、多人协作、正式版本记录与审计日志
- 真实 AI Provider、流式任务、提示词/模型治理及服务端事实校验

Step 8 当前仍仅展示明确的待开发状态与未来能力说明。Step 6 提供受控主题和浏览器 A4 预览，Step 7 提供内部质量流程，但均不包含自由拖拽专业设计画布、Word/PDF 正式导出、最终页码保证、合规认证或外部鉴证。

## 基础检查

```bash
npm run lint
npm run typecheck
npm run build
git diff --check
```

建议在 1024px、1280px 和 1440px 宽度下检查工作台导航、表格滚动、页内标签和弹窗/抽屉布局。
