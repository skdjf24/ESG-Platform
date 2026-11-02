# 下游与全量回归

## 实际链路结果

浏览器验收使用非敏感 fixture 完成：

```text
上传 XLSX
→ 保存 Blob/checksum
→ 解析工作表和单元格
→ Metric Candidate
→ 人工填写统计边界并确认
→ WritingFact（已确认）
→ synchronizeProjectData(step=4)
→ MetricObservation（已确认）
→ Step 7 全面检查失效并等待复检
```

DOCX 段落同时验证 Fact 与 Policy：Fact 进入现有事实列表，Policy 进入现有 `WritingResource`，均保留结构化来源。

## 文件变化

用 `phase2-metrics-updated.xlsx` 替换原文件后：

- `ProjectFileRecord.revision` 从 1 变为 2；
- checksum 变化；
- 旧 ParsedDocument 变为 stale；
- 旧候选变为 needs-review；
- 已确认指标值保持原值但状态变为待人工确认；
- Step 5 引用、Step 6 图表与 Step 7 结论沿用现有同步逻辑待复核；
- 用户重新解析后生成 revision 2 的新 ParsedDocument，旧快照未删除。

浏览器证据：[04-file-revision-and-review.png](04-file-revision-and-review.png)。

## 回归结果

- Phase 1：22 PASS，文件、项目隔离、备份、恢复、复制、冲突与迁移均通过；
- Step 6：统计校验专项通过；
- Step 7：确定性规则、来源、Writing Policy、定位和长文分页通过；
- Step 7.1：A–G 状态管理通过；
- Step 8：门禁、定稿、失效和打印页通过；
- Step 1–8：83 PASS / 0 FAIL / 0 finding；
- 所有已执行浏览器套件均为 `browserErrors = 0`。

Phase 2 没有重写 Step 5 正文，也没有创建第二套项目 Repository 或影响传播机制。
