# Parser 架构

## 模块关系

```text
Step 1 / Step 4 上传
  → IndexedDbProjectFileRepository
      ├─ files: Blob / checksum / file revision / parser status
      └─ Source.fileId（ReportProjectData 中仅保存轻量关联）

DocumentParsingWorkbench
  → parseProjectFile（状态与错误编排）
      → BrowserDocumentParserRegistry
          ├─ ExcelParser
          ├─ DocxParser
          └─ PdfParser
      → IndexedDbParsedDocumentRepository
      → IndexedDbExtractionCandidateRepository

人工确认
  → applyCandidateConfirmation
  → ProjectDataProvider.saveProject(step = 4)
  → synchronizeProjectData（复用现有影响机制）
      ├─ Step 5 facts/resources
      ├─ Step 6 MetricObservation / chart review
      └─ Step 7 stale / invalidation
```

React 组件只调用 Parser Registry、Service 和 Repository，不直接调用 ExcelJS、PDF.js 或 Open XML 底层 API。

## 文件职责

| 文件 | 职责 |
| --- | --- |
| `lib/parsing/registry.ts` | 根据文件记录选择 Parser |
| `lib/parsing/service.ts` | pending/parsing/parsed/failed/stale 状态、重解析、文件替换 |
| `lib/parsing/security.ts` | 扩展名/MIME/大小、ZIP 中央目录、PDF 页数和 checksum |
| `lib/parsing/repository.ts` | 两个独立 IndexedDB store 的持久化与 projectId 隔离 |
| `lib/parsing/candidate-utils.ts` | 稳定候选身份、手工片段候选和 locator 格式化 |
| `lib/parsing/confirmation.ts` | 将人工确认结果适配到既有 Fact/Metric/Resource |
| `lib/parsing/parsers/*` | 与 UI 解耦的具体文档解析器 |
| `components/parsing/document-parsing-workbench.tsx` | 文件导航、原文预览、候选编辑与人工确认 |

## 数据保护

- `ReportProjectData` 不保存完整解析正文、表格或 Blob。
- 解析结果和候选按 `projectId`、`fileId` 建索引并单独持久化。
- 同一 Blob 的 SHA-256 checksum 和 file revision 决定解析版本。
- 重新解析不删除已确认 Fact/Metric/Resource。
- 文件变化先把旧 ParsedDocument 标为 `stale`，再等待用户重新解析。
- 任何候选确认仍由项目 Repository 的 revision 冲突检查和 Step 4 同步规则保护。
