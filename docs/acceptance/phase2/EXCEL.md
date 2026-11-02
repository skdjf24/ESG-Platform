# Excel 验收

Fixture：`fixtures/phase2/phase2-metrics.xlsx`

包含两个 Sheet（能源汇总、员工数据）、2025/2026 指标、单位、合并单元格、百分比、空行、公式及缓存结果。

## 已验证

- Sheet 名称及顺序正确；
- 非空单元格值、行列、地址正确；
- `能源汇总!B4 = 12680`；
- 合并区域 `A1:D1` 保留；
- 公式 `C4-B4` 与缓存结果 `560` 同时保留；
- 百分比候选按业务显示语义记录为 `14.7 %`；
- 表格预览显示行列号、原始值、公式标记和位置；
- 表头 `指标 / 2025 / 2026 / 单位` 生成确定性 Metric Candidate；
- 候选定位为 `Sheet + Cell + Range + row/column`；
- 候选初始状态始终为 `candidate`。

Parser 自动化：`P2-EXCEL-*` 全部 PASS。
浏览器证据：[01-excel-parser-and-candidate.png](01-excel-parser-and-candidate.png)。

旧版二进制 `.xls` 没有启用 Parser。文件可以作为来源保存，但解析时会明确要求另存为 XLSX，不会按 XLSX 猜测内容。
