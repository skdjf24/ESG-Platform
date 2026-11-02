# IndexedDB v1 → v2 迁移

数据库名称保持 `esg-disclosure-platform`，版本由 1 升至 2。

## v2 新增 store

```text
parsedDocuments
  keyPath: parsedDocumentId
  indexes: projectId, fileId, [projectId, fileId]

extractionCandidates
  keyPath: candidateId
  indexes: projectId, fileId, [projectId, fileId], parsedDocumentId, status
```

原有 `projects / files / meta` 不删除、不重建。旧 file record 在首次读取时惰性补充：

- `updatedAt = createdAt`
- `checksum = SHA-256(blob)`
- `revision = 1`
- `parserStatus = not-started`

补充采用原记录 `put`，Blob 字节不转换、不丢弃。损坏的项目结构仍沿用 Phase 1 的保护模式，不会被默认种子静默覆盖。

## 浏览器迁移验收

自动化在浏览器中真实创建 v1 数据库，写入 Phase 1 项目、quality、finalization 和 Blob，再由应用打开升级：

- 数据库版本为 2；
- 两个新 store 存在；
- Blob 内容逐字节保留；
- checksum/revision 补齐；
- quality 与 finalization JSON 保持一致；
- Step 1–8 项目仍可打开。

对应结果：`P2-BROWSER-MIGRATION-STORES / FILE / PROJECT` 全部 PASS。
