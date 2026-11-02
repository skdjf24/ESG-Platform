# 候选、人工确认与来源追溯

## 候选来源

- XLSX：仅使用可复现的表头、年份、指标行、数值和单位关系；
- DOCX/PDF：由用户选择已解析原文后创建；
- 没有 LLM，也不把简单规则包装成 AI。

用户可修改类型、名称、值/内容、单位、期间、统计边界和备注。候选默认不进入项目事实库。

## 确认映射

| Candidate | 确认后实体 | 下游 |
| --- | --- | --- |
| Fact | `WritingFact` | Step 5 事实资料包、Step 7 来源检查 |
| Metric | `WritingFact` + 现有同步生成 `MetricObservation` | Step 5、Step 6 图表数据、Step 7 |
| Policy | `WritingResource(kind=制度)` | Step 5 章节资料包 |
| Case | `WritingResource(kind=案例)` | Step 5 章节资料包 |

历史报告来源确认后使用 `temporalType=历史事实` 或 `kind=历史资料`，不会自动成为本年度事实。

## 完整来源链路

```text
Fact / Metric / Resource
  → SourceReference
      → sourceId
      → fileId
      → parsedDocumentId
      → parsedBlockId
      → structured SourceLocator
  → UploadedSource
  → ProjectFileRecord
  → original Blob
```

Excel 验收实例：

```text
综合能源消耗 = 12,680 MWh
→ phase2-metrics.xlsx
→ Sheet：能源汇总
→ Cell：B4
→ Range：A4:D4
```

## 拒绝、去重与重新解析

- 拒绝只把 candidate 标为 `rejected`，记录不会删除。
- 相同 checksum、位置、内容和类型得到同一 stable candidateId。
- 重新解析使用 `mergeParsed`，保留人工编辑字段及审核状态。
- 文件 checksum 变化时旧 candidate 进入 `needs-review`，新版本按新 fingerprint 创建。
- 已确认实体不会被新解析静默覆盖。
