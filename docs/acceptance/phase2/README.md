# Phase 2 验收｜真实文件解析、结构化候选与人工确认

验收日期：2026-11-02（Asia/Shanghai）
开发基线：`fbf552c53fdc412cec78c43a8830d330bd5f0e77`
开发分支：`feature/phase2-document-parsing`

## 结论

**Phase 2：通过。**

真实文件链路已跑通：

```text
ProjectFileRecord (Blob + checksum + revision)
  → DocumentParserRegistry
  → ParsedDocument / ParsedBlock / SourceLocator
  → ExtractionCandidate（未自动确认）
  → 用户编辑与人工确认
  → WritingFact / MetricObservation / WritingResource
  → Step 5 资料包 / Step 6 指标 / Step 7 检查失效与复检
```

解析在浏览器本地执行，文件不上传第三方。原始 Blob 是唯一证据源；结构化解析结果和候选只保存引用、摘录及定位。

## Parser 状态

| 类型 | Parser | 状态 | 已知限制 |
| --- | --- | --- | --- |
| XLSX | ExcelJS 4.4.0 + 确定性表头规则 | 通过 | 不复刻视觉样式；不计算公式，只读取文件已有公式及缓存结果 |
| XLS | 无安全客户端 Parser | 明确不支持 | 文件可保存，但解析会提示先另存为 XLSX |
| DOCX | Open XML + fflate 0.8.3 + xmldom 0.9.12 | 通过 | 支持 Heading 1–6、段落、列表、表格；不提取图片、批注、修订和脚注 |
| 文本型 PDF | PDF.js 4.10.38 | 通过 | 保证页码与文本定位；不推断不可靠表格结构 |
| 图片/扫描 PDF OCR | Parser 类型与状态已预留 | 未实现 | 明确列入 Phase 2.1，不伪装为已识别文本 |

## 自动化结果

| 检查 | 结果 |
| --- | --- |
| `npm run lint` | PASS，0 error / 0 warning |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `git diff --check` | PASS |
| `npm run test:phase2` | 20 PASS / 0 FAIL |
| `npm run test:phase2:browser` | 19 PASS / 0 FAIL，browserErrors = 0 |
| `npm run test:step6` | PASS |
| `npm run test:phase1:browser` | 22 PASS / 0 FAIL，browserErrors = 0 |
| `npm run test:step7:browser` | 全部场景 PASS，browserErrors = 0 |
| `npm run test:step7-1:browser` | A–G 全部 PASS，browserErrors = 0 |
| `npm run test:step8:browser` | 全部场景 PASS，browserErrors = 0 |
| `npm run test:e2e:step1-8` | 83 PASS / 0 FAIL / 0 finding，browserErrors = 0 |
| `npm audit --omit=dev --audit-level=high` | PASS；无 high/critical，ExcelJS 写入侧传递依赖仍有 moderate 告警 |

机器可读结果：[parser-results.json](parser-results.json)、[browser-results.json](browser-results.json)。

## 浏览器证据

- [XLSX 真实表格与指标候选](01-excel-parser-and-candidate.png)
- [DOCX 标题路径、原文片段与来源追溯](02-docx-source-trace.png)
- [PDF 第 2 页文本与页码定位](03-pdf-page-preview.png)
- [文件 revision、stale 与重新解析](04-file-revision-and-review.png)

## 18 项通过标准

1. XLSX 真实解析：通过。
2. DOCX 真实解析：通过。
3. 文本型 PDF 真实解析：通过。
4. 所有内容块使用稳定 `SourceLocator`：通过。
5. 原始文件仍为唯一证据源：通过。
6. candidate 不自动入库：通过。
7. Fact 人工确认：通过。
8. Metric 人工确认：通过。
9. Metric 进入 Step 6：通过。
10. Fact/Resource 进入 Step 5：通过。
11. 文件变化使旧解析结果 stale：通过。
12. 相同文件重复解析不产生重复候选：通过。
13. IndexedDB v1 → v2 无损迁移：通过。
14. 损坏文件显示可恢复错误且不白屏：通过。
15. 刷新后解析结果与候选恢复：通过。
16. Step 1–8 E2E 无回归：通过。
17. Phase 2 Chromium 验收：通过。
18. `browserErrors = 0`：通过。

## 文档索引

- [解析架构](ARCHITECTURE.md)
- [数据模型](DATA-MODEL.md)
- [依赖与安全边界](DEPENDENCIES.md)
- [IndexedDB v1 → v2 迁移](MIGRATION.md)
- [Excel 验收](EXCEL.md)
- [DOCX 验收](DOCX.md)
- [PDF 验收](PDF.md)
- [候选、人工确认与来源追溯](CANDIDATES-AND-TRACE.md)
- [下游及全量回归](DOWNSTREAM-REGRESSION.md)
- [已知限制](KNOWN-LIMITATIONS.md)

本轮未实现真实 AI、OCR、后端、数据库、云存储、多人协作或报告导出引擎，也未启动 Phase 3。
