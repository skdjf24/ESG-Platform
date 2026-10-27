# ESG Disclosure Platform

ESG 报告编制网站的前端产品原型。项目以一个虚构示例企业“华澜新材料股份有限公司”和其 2025 年度 ESG 报告为主线，第一轮覆盖企业基础画像、实质性议题评估、披露框架与报告大纲、资料收集和事实库；第二轮新增 Step 5“报告内容生成与编辑”工作台。

当前版本使用本地模拟数据，不接入真实 AI、文件存储或后端接口。

## 技术栈

- Next.js 16（App Router）
- React 19
- TypeScript 5（严格模式）
- Tailwind CSS 4
- Lucide React 图标
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
| `/reports/hualan-2025/step/6` | 可视化与报告排版 | 待开发占位页 |
| `/reports/hualan-2025/step/7` | 质量与合规检查 | 待开发占位页 |
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
│   └── step-placeholder.tsx            # Step 6–8 占位页
├── writing/
│   ├── rich-text.tsx                   # 可编辑富文本正文块
│   ├── block-editor.tsx                # 六类结构化内容块编辑器
│   ├── resource-panel.tsx              # 章节资料包、披露映射与来源引用
│   ├── ai-dialog.tsx                   # Mock AI 原文/建议对照流程
│   ├── policy-dialog.tsx               # Writing Policy 设置
│   └── use-writing-document.ts         # 本地保存、撤销/重做及版本状态
└── ui/
    ├── brand-mark.tsx                  # 品牌标识
    ├── notice.tsx                      # 信息、警示与 AI 示例提示
    ├── progress-bar.tsx                # 进度条
    ├── section-card.tsx                # 内容卡片容器
    └── status-badge.tsx                # 状态标签

lib/
├── data/mock-data.ts                   # 示例企业、项目及 Step 1–4 模拟数据
├── types/
│   ├── esg.ts                          # 基础 TypeScript 业务类型
│   └── writing.ts                      # Step 5 内容块、引用、版本及 AI 类型
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

示例数据统一位于 `lib/data/mock-data.ts`，页面组件从该文件读取，便于后续替换为 API 数据。

Step 5 类型位于 `lib/types/writing.ts`，核心关联为：

```text
披露要求 ── DisclosureMapping ──> 报告章节 ──> ContentBlock
企业事实/ESG 指标 ── FactCitation ──> ContentBlock
原始资料 ── SourceReference ──> 企业事实 / ContentBlock
案例/制度/历史资料 ── WritingResource ──> SourceReference / ContentBlock
ContentBlock.revision ──> ChapterVersion + ReviewStatus
```

内容块保存稳定 `id`、所属章节、披露映射、事实引用快照、原始来源、修订号和审校状态。事实修订号变化或失去人工确认时，已有引用会转为“待复核/待更新”，披露覆盖状态同步转为“待核验”。

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
- Step 5 本地保存和版本恢复：仅使用当前浏览器 `localStorage`，不等同于服务器持久化或多人协作

所有 AI 结果在界面中明确标注为“示例 AI 规整结果”，需要人工确认后才表现为可进入事实库。项目没有调用真实 AI 接口，也没有 API 路由或外部数据请求。

Step 5 的 AI 弹窗明确标注“Mock 示例建议”，接受前必须勾选人工确认。空泛表述检查仅为可配置词语匹配规则，不宣称具备完整 AI 语义审校能力。统一接口为可注入的 `AiTaskProvider`，包含 Provider ID、`mock/live` 模式、显示标签和 `run(request, signal)`；后续真实服务需返回与 `AiTaskResponse` 一致的任务 ID、Provider 元数据、原文、建议、事实引用 ID、警告与强制确认标识，并在服务端补充身份鉴权、数据权限、审计、超时/重试和敏感信息治理。

## 业务约束

- 平台不自动判断企业是否具有强制披露义务；上市身份仅作为企业信息记录。
- 实质性议题的重要性结论由用户复核并确认。
- 披露要求的适用性由用户逐项确认，系统建议不是最终结论。
- 资料责任部门仅由系统建议，用户可以调整实际责任部门。
- 支持沿用企业现有 Excel 收集资料，不提供独立模板生成模块。
- 尚未收集的资料只显示“待收集”等流程状态，不预判为数据缺失。
- AI 模拟结果必须人工确认。
- 企业事实保留与原始文件及具体定位信息的关联。

## 待开发范围

- Step 6：可视化与报告排版
- Step 7：质量与合规检查
- Step 8：定稿与导出
- 后端 API、数据库、真实身份与权限体系
- 真实文件存储、解析和在线协作
- 真实 AI 服务接入
- 服务端数据持久化、多人协作、正式版本记录与审计日志
- 真实 AI Provider、流式任务、提示词/模型治理及服务端事实校验

Step 6–8 当前仍仅展示明确的待开发状态与未来能力说明。Step 5 不包含复杂报告排版、图表生成、PDF 导出或完整合规审校。

## 基础检查

```bash
npm run lint
npm run typecheck
npm run build
git diff --check
```

建议在 1024px、1280px 和 1440px 宽度下检查工作台导航、表格滚动、页内标签和弹窗/抽屉布局。
