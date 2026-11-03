# Phase 4｜正式 DOCX 与 PDF 输出验收

## 范围

本阶段在现有 Step 8 定稿门禁之后增加正式输出能力，不改变 Step 1–8 业务数据，不引入数据库、账号、云存储或多租户：

- 当前有效定稿可下载本地生成的 OOXML `.docx`；
- DOCX 包含动态企业名称、报告年度、报告期、定稿信息、目录、章节正文、表格、案例、已确认图表数据、页眉页脚和页码域；
- DOCX 自定义属性保留定稿来源指纹、质量检查运行 ID 和版本标签；
- PDF 继续使用 Step 6 已验证的 A4 分页模型和浏览器打印引擎，并支持从 Step 8 直接进入打印/保存流程；
- 网页正式阅读、DOCX 与 PDF 共用 `formalBlockExclusionReason`，排除内部待办、待复核/未确认内容、Mock 说明、模拟图表和内部 blockId；
- 上游输入或 Step 7 结论变化后，旧定稿不能继续生成 DOCX/PDF。

## 自动化验收

```bash
npm run lint
npm run typecheck
npm run build
npm run test:phase4
npm run test:step6
git diff --check
```

结果：

- Phase 4 DOCX 回归：15 PASS / 0 FAIL；
- lint：PASS；
- typecheck：PASS；
- production build：PASS；
- Step 6 分页/图表回归：PASS；
- git diff --check：PASS。

`test:phase4` 会真实创建 ZIP/OOXML 字节并重新解包核对，不把 JSON 或文本文件伪装成 DOCX。它验证必需部件、完整长正文、表格、案例、已确认图表数据、动态页眉页脚、页码域、定稿属性、内部内容排除和旧定稿失效保护。

## 浏览器验收状态

Step 8 浏览器脚本已扩展，覆盖：

- DOCX 下载及重新解包；
- PDF 正式页面与 `?print=1` 流程；
- 打印媒体隐藏操作工具栏；
- 失效定稿同时禁用 DOCX/PDF；
- 浏览器 console/page error。

当前执行环境没有 Chrome/Chromium。`npx playwright install chromium` 与运行时自带 Playwright 安装器均尝试下载，但网络代理返回 0 MiB 非 ZIP 内容；系统路径也不存在可用浏览器。因此本轮没有生成或伪造浏览器 PASS，`npm run test:step8:browser` 明确失败于 `/usr/bin/chromium` 不存在。

结论：Phase 4 代码与非浏览器工程验收通过；真实浏览器最终验收待在有 Chromium 的 Codespace/CI 环境执行。

## 已知限制

- PDF 由浏览器打印引擎生成，不是服务器签名或不可篡改 PDF；打印对话框中仍需用户选择“保存为 PDF”。
- DOCX 为可编辑 OOXML；已确认图表在 Word 中以完整数据表和图注输出，当前未生成 Word 原生图表对象或位图，PDF 保留网页图表视觉。
- DOCX 目录为导出时的静态页码表；页脚 `PAGE/NUMPAGES` 域会在 Word 打开时更新。修改 Word 内容后应人工更新目录并复核分页。
- 本阶段不提供电子签章、发布、云端归档、服务端哈希签名或审批不可抵赖证明。

