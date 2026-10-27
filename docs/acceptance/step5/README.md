# 第二轮 Step 5 验收说明

本目录记录“报告内容生成与编辑”工作台在 2026-10-27 本地生产构建上的实际运行画面。示例企业、披露要求、事实、指标和资料均为本地模拟数据；界面不代表真实企业披露结果。

## 运行截图

| 场景 | 截图 |
| --- | --- |
| Step 5 三栏工作台与六类内容块 | [01-writing-workbench.png](01-writing-workbench.png) |
| Mock AI 原文与建议版本对照 | [02-mock-ai-comparison.png](02-mock-ai-comparison.png) |
| 企业事实与原始资料定位 | [03-source-trace.png](03-source-trace.png) |
| 1024px 平板编辑区（资料包默认收起） | [04-tablet-editor.png](04-tablet-editor.png) |

## 已真实实现的前端交互

- 复用 Step 3 报告目录的章节搜索、折叠、切换及状态展示。
- 标题、富文本段落、指标表格、案例、图表占位和待处理事项六类结构化内容块的新增、编辑及删除。
- 富文本加粗、斜体、下划线、列表、引用和纯文本粘贴；存档恢复时执行允许标签校验。
- 保存、撤销、重做、章节状态、审校状态、版本快照及恢复；草稿写入当前浏览器 `localStorage`。
- 披露要求的添加、解除和覆盖状态调整。
- 已有企业事实的人工确认、引用、解除引用，以及原始文件和页码/工作表/单元格定位查看。
- 案例、制度及历史资料的人工确认；确认状态进入本地编制文档并可在刷新后恢复。
- 来源事实修订号变化后，将相关正文标记为“待复核/待更新”，并将映射标为“待核验”。
- 正文块“待补充、待确认、待更新”标记及章节资料包统一查看。
- Writing Policy 的语气、术语、规则和空泛词配置；空泛表述检查会定位命中的内容块。
- 章节资料包折叠，以及披露要求、事实/指标、案例/制度、历史资料和待处理事项切换。
- Mock AI 的生成、接受、重新生成、取消以及局部改写的选区回写流程。

以上均为浏览器端交互。当前没有后端 API、数据库、真实文件上传、多人协作或服务器审计日志。

## 模拟功能与占位边界

- `mockAiProvider` 是本地确定性演示适配器，返回明确标注的“Mock 示例建议”；不调用模型或远程 API。
- AI 仅使用输入中“已确认且有来源”的事实补充建议，接受前要求用户勾选人工确认。建议仍需人工核对，不能作为真实语义审校或披露结论。
- 空泛表述检查是可配置词语匹配，不是完整 AI 语义审校。
- 示例企业、章节初稿、披露要求、事实、资料与来源定位均为模拟数据，不对应真实企业。
- 图表内容块是 Step 6 的占位，不生成图表；Step 6–8 页面仍为待开发占位。
- 本地版本仅用于原型演示，不具备服务端不可篡改审计、权限控制或协作合并能力。

## 新增数据模型及关联关系

核心类型位于 `lib/types/writing.ts`：

```text
DisclosureMapping       披露要求 → 正文内容块（含覆盖状态）
WritingChapter          报告章节 → ContentBlock[]
FactCitation            企业事实/ESG 指标 → 正文内容块（含事实修订快照）
SourceReference         原始资料 → 企业事实/正文内容块（含具体定位与摘录）
ContentBlock            稳定 ID、所属章节、内容类型、映射、引用、来源、修订与审校状态
ChapterVersion          章节保存快照、版本号、时间和标签
WritingResource         案例/制度/历史资料、来源、确认人、确认时间与修订号
WritingDocument         章节、事实、资料、Writing Policy、版本与本地保存时间
```

编辑状态 `ChapterStatus` 与审校状态 `ReviewStatus` 分开记录，为后续 Step 7 自动检查保留数据关联。

## 真实 AI 接入边界

统一入口是 `AiTaskProvider`：

```ts
interface AiTaskProvider {
  id: string;
  mode: "mock" | "live";
  label: string;
  run(request: AiTaskRequest, signal?: AbortSignal): Promise<AiTaskResponse>;
}
```

`AiDialog` 通过属性接收 Provider，当前组合层显式注入 `mockAiProvider`。真实 Provider 可替换该实现，但应继续遵守 `taskId` 对应、章节版本校验、事实快照/来源修订校验、事实引用 ID、警告、用户确认和 `AbortSignal` 取消约定。生产接入还需在服务端实现：

- 身份鉴权、企业/项目数据权限和传输加密；
- 来源事实白名单、统计口径锁定与引用完整性校验；
- 提示词、模型、参数、输入来源与用户接受动作的审计记录；
- 超时、重试、幂等、限流、错误分类及敏感信息治理；
- 对流式或异步任务增加服务端任务状态，而不是依赖浏览器内存。

## 本地验收

```bash
npm install
npm run lint
npm run typecheck
npm run build
npm run start
```

启动后访问 `http://localhost:3000/reports/hualan-2025/step/5`。建议分别检查桌面宽度和 1024px 平板宽度，并确认 Step 1–4 可正常访问、Step 6–8 仍显示待开发占位。
