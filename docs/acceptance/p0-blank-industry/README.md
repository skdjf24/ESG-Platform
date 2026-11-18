# P0 空白项目与行业分类验收

开发基线：`fd65f58250420c187556bb7f7e4a9205f70e62f3`（`origin/main`）。产品代码最后变更提交：`2c17c141c9012a96babd5ccb4c658eb041655035`。专项浏览器脚本补充四级窄屏断言后，测试提交为 `0a3b6ae64dd9bf6e4008b8a30a52637653a54236`，其后没有产品代码修改。

Chromium：`154.0.8037.57`。测试目标为本地生产构建 `http://127.0.0.1:4325`，未部署到 Production。P0 专项的真实浏览器结果见 [results.json](./results.json)：**27 PASS / 0 FAIL，browserErrors=[]**。覆盖两个中文名称空白项目、一个独立示例项目、Step 1–8 页面、未评分议题、分类搜索和四级选择、刷新持久化、窄屏操作及三项目隔离。

截图：[空白项目桌面 Step 1](./blank-step1-desktop.png)、[空白项目窄屏 Step 1](./blank-step1-narrow.png)、[示例项目桌面 Step 1](./sample-step1-desktop.png)。

相关原始结果：

| 回归 | 实际结果 | 证据 |
| --- | --- | --- |
| Phase 1 浏览器 | 22 PASS / 0 FAIL，browserErrors=[] | [phase1-browser-results.json](../phase1/phase1-browser-results.json) |
| Phase 2 解析 | 20 PASS / 0 FAIL | [parser-results.json](../phase2/parser-results.json) |
| Phase 2 浏览器 | 19 PASS / 0 FAIL，browserErrors=[] | [browser-results.json](../phase2/browser-results.json) |
| Step 1–3 浏览器 | 46 PASS / 0 FAIL，browserErrors=[] | [results.json](../step1-3-ui-materiality/results.json) |
| Step 1–8 E2E | 86 PASS / 0 FAIL / 0 findings，browserErrors=[] | [e2e-results.json](../e2e-step1-step8/e2e-results.json) |

这些既有脚本的结果格式未记录 tested commit；Phase 1、Phase 2 和 Step 1–3 在本分支的中间工作树运行，不能将它们单独标记为针对最终提交重新生成。P0 专项 `results.json` 直接记录测试提交。E2E 的 AI 状态、写作和语义审校接口在浏览器边界使用显式测试替身；没有调用外部 AI Provider。

分类数据使用 GB/T 4754-2017 及 2019 年第 1 号修改单，数量为 20/97/473/1382。来源和核对范围见 [行业分类数据说明](../../industry/gbt4754.md)。PDF 文本抽取后有 **43 个代码与名称不能在同一抽取行自动配对**；如需逐项独立核证，应在合并前人工核对原 PDF 版面。代码数量和父级关系已通过自动检查，此限制不能当作全部名称逐项独立核证完成。
