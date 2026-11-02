# PDF 验收

Fixture：`fixtures/phase2/phase2-text.pdf`，共 2 页，包含逐页文本、数值和表格式文本行。

## 已验证

- PDF 页数为 2；
- 每页生成独立 `page-text` block；
- 第 2 页可读取 `Training coverage | 2026 | 94 | percent`；
- 每个 block 保留 `SourceLocator.page`；
- UI 可按页导航并选择整页文本创建候选；
- Parser worker 由应用本地 bundle 加载，不访问在线解析服务。

Parser 自动化：`P2-PDF-PAGES / P2-PDF-LOCATOR` PASS。
浏览器证据：[03-pdf-page-preview.png](03-pdf-page-preview.png)。

## 扫描件规则

当全部页面提取文本过少时，文档分类为 `scan-suspected`，警告为“未检测到可直接读取文本，可能为扫描件；本阶段未启用 OCR”。系统不会生成虚假文本或事实。PDF 表格不做不可靠自动重建，优先保证页码、原文和位置。
