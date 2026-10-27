# Step 5.5：Step 1–5 数据贯通验收说明

本轮在现有 Step 1–5 前端原型上加入项目级统一数据仓库，不新增 Step 6–8 业务功能。截图与测试使用虚构示例企业及本地模拟数据，不代表真实 ESG 披露结论。

## 运行截图

| 场景 | 截图 |
| --- | --- |
| Step 1–3 变化进入 Step 5 复核提示，已编辑正文保持不变 | [01-step5-upstream-review.png](01-step5-upstream-review.png) |
| Step 4 修改已引用指标，事实修订号和确认状态更新 | [02-step4-fact-revision.png](02-step4-fact-revision.png) |
| Step 5 读取最新指标，并显示旧引用版本与待复核提示 | [03-step5-stale-citation.png](03-step5-stale-citation.png) |

## 数据流与模块关系

```text
Step 1 企业画像 ──────┐
Step 2 议题评估 ──────┼──> ProjectDataProvider ──> ReportProjectRepository
Step 3 要求/目录/清单 ─┤            │                       │
Step 4 事实/指标/来源 ─┘            │                       └── localStorage（原型）
                                    ↓
                     synchronizeProjectData（保存时差异协调）
                                    ↓
Step 5 章节树 / ContentBlock / DisclosureMapping / FactCitation / ChapterVersion
```

- `ProjectDataProvider` 提供当前快照、上一已保存快照、保存状态、撤销/重做和影响知悉操作。
- `ReportProjectRepository` 定义异步 `load/save/subscribe` 契约；当前实现为 `LocalStorageReportProjectRepository`，后续可替换为后端 API。
- `synchronizeProjectData` 只同步上游元数据、修订和复核状态。用户正文、旧引用来源和章节版本不会被自动覆盖或删除。
- Step 5 的 `useWritingDocument` 作为兼容适配层，把原有 `WritingDocument` 映射到统一项目聚合，保留既有编辑器接口和版本行为。
- 项目键为 `esg:report-project:{projectId}:v2`。保存前同时校验 URL 项目 ID、快照项目 ID、报告 ID 和乐观修订号，避免跨项目误写与静默覆盖。

## 新增或调整的数据模型

核心类型位于 `lib/types/project-data.ts`，Step 5 关联类型位于 `lib/types/writing.ts`。

| 类型 | 用途 |
| --- | --- |
| `ReportProjectData` | Step 1–5 的项目聚合根，含 `schemaVersion`、`projectId`、`revision` 和全部稳定 ID 对象 |
| `ProjectDisclosureRequirement` | 披露要求、适用性人工确认、映射章节、修订号和复核状态 |
| `ProjectReportSection` | Step 3 目录节点、稳定 ID、修订号及上游有效状态 |
| `ProjectDataRequirement` | Step 3 资料需求与 Step 4 用户调整后的责任部门、状态及修订 |
| `ProjectWritingState` | Step 5 章节、Writing Policy、版本记录和保存时间 |
| `ChangeImpact` | 变更来源步骤、受影响对象、目标步骤、提示文本与知悉状态 |
| `MigrationRecord` | 旧版 Step 5 草稿迁移来源、时间和说明 |
| `ReportProjectRepository` | 未来 API/PostgreSQL 实现需要遵守的加载、保存和订阅接口 |
| `WritingChapter.sourceState` / `WritingFact.sourceState` | 标记上游有效或已移除，同时保留正文、事实及历史版本 |

## 变更协调规则

- Step 1：企业名称、报告年度和披露框架保存后，下游读取最新快照；移除框架或议题时，相关要求与正文映射进入待复核。
- Step 2：议题纳入范围变化时，关联要求取消“用户已确认”状态，正文映射转为“待核验”。
- Step 3：目录名称和顺序同步至 Step 5；已有 `ContentBlock[]` 和版本保持原样。移除目录节点时，Step 5 章节保留并标记为上游已移除。
- Step 4：新确认事实立即可供 Step 5 引用；已引用事实变更后修订号递增、确认状态回退，相关正文块标记为待更新。
- Step 5：编辑和版本保存进入同一项目快照；返回任一步骤或刷新浏览器后均可恢复。
- 删除会影响要求、章节或事实引用的对象时，界面先展示影响数量并要求用户确认；同步逻辑仍保留旧正文、来源与版本。

## 关键同步测试结果

2026-10-27 使用 Chromium 在 1600 × 1050 视口对本地开发服务执行实际页面操作：

| 验收用例 | 结果 |
| --- | --- |
| Step 1 修改企业名称，保存后 Step 5 显示最新结果 | 通过 |
| Step 2 移出能源管理议题，关联披露要求提示复核 | 通过 |
| Step 3 修改 4.2 目录，Step 5 同步且保留正文与版本 | 通过 |
| Step 4 人工确认事实，Step 5 可引用 | 通过 |
| Step 4 修改已引用指标，Step 5 显示旧引用版本与待更新 | 通过 |
| Step 5 编辑正文后返回 Step 3，再回到 Step 5 | 通过，正文未丢失 |
| 刷新浏览器恢复企业、目录、事实及正文 | 通过 |
| 另一 `projectId` 存储键不被当前项目保存改写 | 通过 |
| 旧版 Step 5 草稿、事实、Policy 和版本迁移 | 通过，旧键原样保留 |
| Step 1–5 路由回归及浏览器运行错误检查 | 通过，0 个页面错误、0 个外部请求 |

自动验收还观察到 2 次影响操作确认对话框，证明议题调整及已引用指标更新不会无提示执行。

## 构建与静态检查

```text
npm run lint       通过
npm run typecheck  通过
npm run build      通过（项目首页及 Step 1–8 路由成功生成）
git diff --check   通过
```

## 真实实现与模拟边界

真实实现：浏览器项目快照保存、刷新恢复、项目键隔离、乐观修订冲突保护、跨步骤差异识别、复核提示、目录同步、事实引用失效、旧 Step 5 草稿兼容迁移、Step 5 章节版本保留。

模拟范围：企业、议题、披露要求、资料、事实与来源仍是虚构示例；Mock AI、文件上传和解析仍不调用真实服务；“项目隔离”是浏览器存储键隔离，不是服务端租户权限。

## 已知限制

- 数据只保存在当前浏览器与当前域名的 `localStorage`，没有账号同步、多人协作、服务端审计或跨设备恢复。
- Repository 已为未来 API 预留异步接口，但本轮未部署数据库、服务器或 PostgreSQL schema。
- 文件仅保存名称、大小、类型和来源定位等元数据；真实文件内容需要后续对象存储与访问授权。
- `localStorage` 快照设置约 4.5 MB 安全上限，不适合大量资料；发现二进制对象会拒绝保存。
- 并发保护基于项目修订号；当前页面检测到冲突会停止写入并要求刷新，尚无多人合并界面。
- 上游移除对象只做软保留和待复核，不提供正式归档、恢复策略或批量影响处理。
- Step 6–8 维持原有占位页；真实 AI、复杂排版和 PDF 导出不在本轮范围。
