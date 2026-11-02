# Phase 1｜本地项目持久化审计与补齐记录

审计日期：2026-11-02
审计范围：仅 Phase 1；未检查 Phase 0。  
浏览器验收基线：`feature/step7-1-quality-state-fixes-20261029`，commit `e0193487888314dca407f814cf5e648d5aca2113`，PR [#7](https://github.com/skdjf24/ESG-Platform/pull/7)。

## 1. 远端状态审计

- GitHub 上没有独立的 Phase 1 分支或 Phase 1 PR。
- 最新连续开发分支仍是 `feature/step7-1-quality-state-fixes-20261029`；浏览器验收开始时 PR #7 为 open，head 为 `e019348`。
- `e019348` 已包含 Phase 1 的 IndexedDB、真实文件字节、项目列表、备份恢复及年度复制实现；当时缺少真实浏览器验收结果。
- 本轮没有从头重建项目，也没有新增业务模块或检查 Phase 0；验收直接建立在上述 Step 1–8 完整代码线上。

## 2. 状态说明

- ✅：代码实现完整，且通过静态检查、构建或可在当前环境执行的确定性测试。
- 🟡：部分完成或仍缺少动态验证；本次最终结果中无此状态。
- ❌：未实现。

## 3. 44 项完成度

### A. 项目存储

| # | 要求 | 状态 | 证据 |
| --- | --- | --- | --- |
| 1 | UI 不再直接依赖 localStorage 作为正式项目存储 | ✅ | UI 统一通过 `projectRepository`；localStorage 仅作为只读迁移来源。 |
| 2 | 统一 `ReportProjectRepository` | ✅ | `lib/types/project-data.ts` 与 `lib/project/repository.ts`。 |
| 3 | 结构化数据使用 IndexedDB 或等价持久化 | ✅ | `projects` object store。 |
| 4 | 支持创建多个项目 | ✅ | 首页真实创建逻辑已实现；真实 Chromium 浏览器回归通过。 |
| 5 | 支持项目列表 | ✅ | 首页从 Repository 动态读取列表；真实 Chromium 浏览器回归通过。 |
| 6 | 支持打开已有项目 | ✅ | 动态 projectId 路由和项目卡已实现；真实 Chromium 浏览器回归通过。 |
| 7 | projectId 不再固定为 `hualan-2025` | ✅ | Step 1–8 与 final 路由移除固定 ID 限制，新项目生成动态 ID。 |
| 8 | 多项目数据完全隔离 | ✅ | 项目以 `projectId` 为 key，文件记录含 `projectId` 且读取时二次校验。 |
| 9 | revision 并发冲突保护有效 | ✅ | 单个 readwrite transaction 内比较 revision；双页面 revision 冲突回归通过。 |

### B. 文件存储

| # | 要求 | 状态 | 证据 |
| --- | --- | --- | --- |
| 10 | 独立 `ProjectFileRepository` | ✅ | 类型契约及 `IndexedDbProjectFileRepository`。 |
| 11 | 保存真实文件字节 | ✅ | `files` store 保存 `Blob`；真实字节一致性回归通过。 |
| 12 | Step 1 历史报告真实保存 | ✅ | Step 1 写入文件仓库并保存 fileId；真实 Chromium 浏览器回归通过。 |
| 13 | Step 4 资料文件真实保存 | ✅ | Step 4 写入文件仓库并保存 fileId；真实 Chromium 浏览器回归通过。 |
| 14 | 关闭/刷新后仍可读取文件 | ✅ | Step 1 提供从仓库下载；刷新后下载字节一致性回归通过。 |
| 15 | Source 通过 fileId 关联文件 | ✅ | `UploadedSource.fileId`。 |
| 16 | 文件删除不制造孤立引用 | ✅ | 删除事务在 Source 仍引用 fileId 时返回 `referenced` 并拒绝删除。 |
| 17 | 不伪造解析结果 | ✅ | 文件保存不生成 Facts/Resources/定位。 |
| 18 | parserStatus 为 not-started 或等价 | ✅ | 所有真实文件及迁移元数据统一为 `not-started`。 |

### C. 迁移与兼容

| # | 要求 | 状态 | 证据 |
| --- | --- | --- | --- |
| 19 | 旧 localStorage 项目可迁移 | ✅ | 完整项目及旧 Step 5 草稿迁移已实现；真实 Chromium 浏览器回归通过。 |
| 20 | migration 有 schema/version 记录 | ✅ | IDB wrapper `storageSchemaVersion: 1`、meta 记录和项目 migrations。 |
| 21 | 迁移后旧数据不自动删除 | ✅ | 迁移只读旧键，不调用 remove/clear。 |
| 22 | Step 1–8 正文、quality、finalization 历史保持 | ✅ | 加法迁移沿用原快照并补状态；迁移后完整快照回归通过。 |

### D. 备份与恢复

| # | 要求 | 状态 | 证据 |
| --- | --- | --- | --- |
| 23 | 支持导出项目备份 | ✅ | 首页“导出备份”已实现；浏览器下载回归通过。 |
| 24 | 备份包含 project 数据 | ✅ | archive `project`。 |
| 25 | 备份包含真实文件字节 | ✅ | 文件 Blob 以 base64 写入 archive。 |
| 26 | manifest/schemaVersion | ✅ | `manifest.schemaVersion = 1`。 |
| 27 | 支持从备份恢复 | ✅ | 校验后在单个 IDB transaction 写入项目与文件；真实 Chromium 浏览器回归通过。 |
| 28 | 恢复不静默覆盖同 ID | ✅ | transaction 内先查 key，存在即明确报 conflict。 |
| 29 | 恢复后 Step 1–8 与文件完整 | ✅ | 完整快照及文件字节恢复回归通过。 |

### E. 年度复制

| # | 要求 | 状态 | 证据 |
| --- | --- | --- | --- |
| 30 | 支持“复制为下一年度” | ✅ | 项目卡入口与原子复制已实现；真实 Chromium 浏览器回归通过。 |
| 31 | 新项目获得新 projectId | ✅ | 年度 ID 冲突时自动加后缀，不覆盖。 |
| 32 | 企业信息/结构/框架保留 | ✅ | 基于深拷贝保留。 |
| 33 | 年度改为新年度 | ✅ | year 与 reportingPeriod 更新。 |
| 34 | Materiality 年度确认重置 | ✅ | `confirmed=false`、时间清空、revision +1。 |
| 35 | Requirement 适用性确认重置 | ✅ | `userConfirmed=false`、`reviewStatus=待复核`。 |
| 36 | 当年 Facts 重新确认 | ✅ | Facts 统一改为待人工确认/待核验，revision +1。 |
| 37 | Step 7 清空 | ✅ | 新建 `QualityCheckState`。 |
| 38 | Step 8 定稿清空 | ✅ | 新建 `FinalizationState`。 |

### F. 存储可靠性

| # | 要求 | 状态 | 证据 |
| --- | --- | --- | --- |
| 39 | 使用 `navigator.storage.estimate()` 或等价 | ✅ | `storageEstimate()`。 |
| 40 | 容量不足明确阻止写入 | ✅ | 每次项目/文件/恢复前调用 `ensureStorageCapacity()` 并保留 1 MB 余量。 |
| 41 | 支持/尝试 Persistent Storage | ✅ | 首页和文件写入调用 `navigator.storage.persist()`；拒绝授权不伪报成功。 |
| 42 | 数据损坏不会导致白屏 | ✅ | Provider 捕获并进入只读保护提示；损坏记录保护状态回归通过。 |
| 43 | 文件缺失明确标记 missing | ✅ | 每次 load 对 Source.fileId 与 files store 对账；缺失显示 `missing`，不伪造内容。 |
| 44 | 保存失败有用户可见提示 | ✅ | Provider、首页和上传面板均显示错误并保留未保存修改。 |

实现完成度：44 项 ✅，0 项 🟡，0 项 ❌。
产品验收结论：**Phase 1：通过。**

## 4. 数据与事务设计

IndexedDB 数据库：`esg-disclosure-platform`，version 1。

| Store | Key | 内容 |
| --- | --- | --- |
| `projects` | `projectId` | storage schema、revision、更新时间、完整 `ReportProjectData` |
| `files` | `fileId` | projectId、文件名、MIME、大小、`Blob`、parserStatus |
| `meta` | `key` | 存储 schema/migration 元数据 |

项目 JSON 不保存二进制；Source 只保存 fileId。恢复与年度复制在一个跨 store transaction 中完成，避免只写入一半。文件删除在同一事务检查项目 Source 引用。

## 5. 自动化

新增：

```bash
npm run test:phase1:browser
```

覆盖多项目、真实字节、刷新读取、Step 1/4 上传、隔离、备份、同 ID 冲突、恢复、年度复制、revision 冲突、旧 localStorage 迁移、missing 和损坏数据保护。

既有 Step 7、Step 7.1、Step 8 和 Step 1–8 E2E 脚本已从直接读写 localStorage 改为读写 IndexedDB 测试辅助层；Step 6 确定性图表回归保持不变。

## 6. 本轮测试结果

| 命令 | 结果 |
| --- | --- |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `git diff --check` | PASS |
| `node --experimental-strip-types scripts/step6-1-chart-regression.mjs` | PASS（3/3） |
| `npm run test:phase1:browser` | PASS：Chromium 153.0.8010.0，22/22 检查通过，browserErrors = 0 |
| `npx playwright install chromium` | 官方下载源在当前环境返回 0 MiB 无效 zip；改用可审计的真实 Chromium 153 二进制执行 |
| `docs/acceptance/phase1/phase1-browser-results.json` | 已由真实浏览器执行生成 |
| `npm run test:step7:browser` | PASS |
| `npm run test:step7-1:browser` | PASS |
| `npm run test:step8:browser` | PASS |
| `npm run test:e2e:step1-8` | PASS（82 项通过，0 项失败；1 项已知产品 Gap） |

`phase1-browser-results.json` 由真实浏览器执行生成；未把未执行场景或环境探测结果伪装为通过。

## 7. 已知限制

- IndexedDB 仍是单浏览器、单设备本地存储，不是服务器备份、多人协作或企业级灾备。
- Persistent Storage 是否获批由浏览器决定；界面只显示真实结果。
- JSON + base64 备份对超大文件内存开销较高，适合当前原型，不适合生产级大文件。
- Phase 1 不做 PDF/Word/Excel 解析、OCR 或事实抽取；所有上传文件保持 `not-started`。
- Step 4 暂无独立文件管理器；文件缺失会进入数据状态，Step 1 历史报告同时提供可见缺失标签和下载入口。
- 当前验收使用无 GPU 的真实 headless Chromium；脚本显式禁用 WebGL/软件光栅器以适配受限容器，不改变产品逻辑。
