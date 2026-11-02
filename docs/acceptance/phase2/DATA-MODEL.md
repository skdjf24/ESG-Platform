# Phase 2 数据模型

## ParsedDocument

`ParsedDocument` 记录项目、原始文件、来源、Parser 类型/版本、状态、checksum、file revision、内容块、表格、警告和错误。`parsedDocumentId` 由 `fileId + checksum` 稳定组成，因此文件替换会生成新版本，旧版本仍可保留为 stale。

状态：`pending | parsing | parsed | failed | stale`。文件记录额外保留 `not-started`。

## ParsedBlock

统一联合类型：

- `heading`：级别及完整 headingPath；
- `paragraph`：普通段落或列表；
- `cell`：原始值、类型、公式、缓存值；
- `table`：表格摘要和 tableId；
- `page-text`：PDF 页码、文本和行数。

## SourceLocator

所有后续可确认内容均至少包含 `fileId`、`sourceId`，并按文档类型保留：

- Excel：`sheet / cell / range / row / column`；
- DOCX：`headingPath / paragraphIndex`；
- DOCX 表格：`tableIndex / row / column`；
- PDF：`page`；
- 通用：`parsedBlockId`。

## ExtractionCandidate

候选类型：`fact | metric | policy | case`。
候选状态：`candidate | confirmed | rejected | needs-review`。

稳定 fingerprint 由以下内容组成：

```text
file checksum + candidate type + normalized locator + normalized label/value
```

相同文件重复解析会命中同一 `candidateId`，并保留用户已编辑字段、拒绝/确认状态和审核记录。文件 checksum 变化时产生新候选版本，旧候选进入 `needs-review`。

## SourceReference 扩展

旧字段 `sourceId / fileName / locator / excerpt` 保持兼容，新增可选字段：

```text
fileId
parsedDocumentId
parsedBlockId
sourceLocator
```

因此旧项目可以直接加载，新确认实体则具备结构化全链路定位。
