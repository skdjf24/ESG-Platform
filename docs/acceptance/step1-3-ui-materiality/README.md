# Step 1–3 功能与工作台表格验收（2026-11-10）

本轮基于 `origin/main` 的 `5153ec2a44ab65269b3eb4b4dc01305714330039`，在分支 `fix/step1-3-ui-materiality-20261110` 开发。下列测试针对产品代码提交 `8f093dd6b96b2fa12149551355cb9203f22cf597` 的本地 production build 执行；本目录的文档与证据在测试后另行提交。测试没有更新 Production。

## 功能结果

- Step 1 披露框架按三列两行固定排序，新增北交所指引，移除新项目可选的 CASS-ESG 6.0；多选、数量统计与窄屏横向滚动正常。Step 1 页面移除“初始 ESG 议题池”，项目初始议题数据仍留在 Step 2。
- 北交所条款独立记录了官网来源、指引名称和版本。目前仅建档正式指引的第 35 条（能源）与第 36 条（水资源）两个已核实条款，均需用户确认；**这不是完整的北交所条款目录，也不代表合规判断**。来源：[《北京证券交易所上市公司持续监管指引第 11 号——可持续发展报告（试行）》2025-04-25 第一次修订](https://www.bse.cn/uploads/6/file/public/202504/20250426144813_oajv33m1es.pdf)。
- 旧项目的 CASS 选择保留为历史选项，界面提示用户复核；不会自动映射成北交所。用户明确移除旧选项时，旧披露确认和正文继续保留，关联条款标记待复核。
- Step 2 移除评分表中无效的“筛选”按钮，保留议题池 E/S/G、全部与搜索。纳入、移出和新增议题同步到评分表、矩阵和统计；财务/影响评分及评估方式变化使旧确认失效。评分限制为 1–5、0.1 步长，清空输入的编辑过程不会写入 1。IndexedDB 保存、切换步骤和刷新后仍一致。
- Step 2 变化依现有依赖关系将 Step 3 关联披露、Step 7 质量快照和 Step 8 定稿置于复核流程；既有披露映射与正文不会被删除。
- 工作台数据表格统一 12px、单行文字与横向滚动。Step 3 框架、状态、议题、适用性和章节列，以及 Step 4、Step 5 的窄屏表格已在真实 Chromium 检查。正式报告预览、打印及导出表格未套用工作台样式。

## 测试证据

浏览器为 Chromium `154.0.8037.57`，目标为 `http://127.0.0.1:4325` 的本地 production build。`results.json` 明确记录 testedCommit；原有回归脚本的 JSON 不都自带 commit 字段，因此其执行提交以本次运行记录和本目录的集中归档为准。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| lint / typecheck / build | 全部通过 | [static-checks.log](static-checks.log) |
| 本轮 Step 1–3 与表格 Chromium 验收 | 46 PASS / 0 FAIL，browserErrors `[]` | [results.json](results.json) |
| Step 5 窄屏表格补充检查 | PASS，browserErrors `[]`，容器横向滚动、无裁剪 | [step5-table-result.json](step5-table-result.json) |
| Step 1–8 E2E | 85 PASS / 0 FAIL / 0 findings，browserErrors `[]` | [e2e-step1-8-results.json](e2e-step1-8-results.json)、[运行日志](e2e-step1-8.log) |
| Phase 1 浏览器 | 22 PASS / 0 FAIL，browserErrors `[]` | [phase1-browser-results.json](phase1-browser-results.json)、[日志](phase1-browser.log) |
| Phase 2 浏览器 | 19 PASS / 0 FAIL，browserErrors `[]` | [phase2-browser-results.json](phase2-browser-results.json)、[日志](phase2-browser.log) |
| Phase 2 解析 | 20 PASS / 0 FAIL | [phase2-parser-results.json](phase2-parser-results.json)、[日志](phase2.log) |
| Phase 3 AI 边界 | 20 PASS / 0 FAIL | [phase3.log](phase3.log) |
| Phase 4 DOCX 导出 | 15 PASS / 0 FAIL | [phase4.log](phase4.log) |
| Step 6 图表校验 | 3 项断言 PASS，含预期的无效输入检测 | [step6.log](step6.log) |
| Step 7 浏览器 | 32 PASS / 0 FAIL，console/page errors 0 | [step7-browser.log](step7-browser.log) |
| Step 7.1 浏览器 | 33 PASS / 0 FAIL，console/page errors 0 | [step7-1-browser.log](step7-1-browser.log) |
| Step 8 浏览器 | 27 PASS / 0 FAIL，console/page errors 0 | [step8-browser.log](step8-browser.log) |

Step 1–8 E2E 首次运行的本地服务未开启测试用 AI 状态，脚本在 Step 5 等待被禁用的“真实 AI”按钮而超时；[首次日志](e2e-step1-8-initial-unconfigured-ai.log)保留。最终通过的运行仅在本地测试服务设置 `AI_PROVIDER=lmstudio AI_BASE_URL=http://127.0.0.1:1234/v1 AI_MODEL=test-model`，使按钮可用；脚本拦截 AI 写作与语义检查请求，返回测试响应，未调用外部 Provider，也未更改产品配置。

## Chromium 截图

| 页面 | 桌面 | 窄屏 |
| --- | --- | --- |
| Step 1 | [step1-desktop.png](step1-desktop.png) | [step1-narrow.png](step1-narrow.png) |
| Step 2 | [step2-desktop.png](step2-desktop.png) | — |
| Step 3 | [step3-desktop.png](step3-desktop.png) | [step3-narrow.png](step3-narrow.png) |
| Step 4 | — | [step4-narrow.png](step4-narrow.png) |
| Step 5 | — | [step5-narrow.png](step5-narrow.png) |
