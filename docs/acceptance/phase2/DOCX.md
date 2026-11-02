# DOCX 验收

Fixture：`fixtures/phase2/phase2-structured.docx`

包含 Heading 1、Heading 2、普通段落、编号列表和 2×2 表格。

## 已验证

- 标题顺序与级别正确；
- `4 环境管理 > 4.1 环境管理体系` headingPath 正确；
- 普通段落与列表保持文档顺序；
- 表格文本和 `tableIndex / row / column` 正确；
- 段落使用 `headingPath + paragraphIndex` 定位；
- 用户选择段落后可创建 Fact、Metric、Policy 或 Case 候选；
- Fact/Policy 人工确认后保留 parsedBlock 和结构化 locator。

Parser 自动化：`P2-DOCX-*` 全部 PASS。
浏览器证据：[02-docx-source-trace.png](02-docx-source-trace.png)。

本阶段不解析图片、文本框、批注、修订记录、页眉页脚、脚注或嵌入对象。
