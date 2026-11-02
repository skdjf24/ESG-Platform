# Parser 依赖与安全边界

| 依赖 | 版本 | 用途 | 许可证 | 备注 |
| --- | --- | --- | --- | --- |
| `exceljs` | 4.4.0 | 浏览器读取 XLSX、值、公式结果和合并区域 | MIT | 不支持旧版二进制 XLS；本项目不使用其服务端写入/归档路径 |
| `fflate` | 0.8.3 | 本地解压 DOCX Open XML；生成测试 fixture | MIT | 解压前先由自有中央目录检查限制总大小和条目数 |
| `@xmldom/xmldom` | 0.9.12 | 解析 DOCX XML | MIT | 已避开 0.8.x 已公开高危版本 |
| `pdfjs-dist` | 4.10.38 | 浏览器提取文本型 PDF 页数和文本 | Apache-2.0 | worker 由打包器作为本地静态资产加载；无远程服务 |
| `pdf-lib` | 1.17.1 | 仅生成非敏感 PDF 测试 fixture | MIT | devDependency，不参与生产解析 |
| `tsx` | 4.23.15 | 运行 TypeScript Parser 回归 | MIT | devDependency |

## 安全限制

- 上传文件上限：25 MB。
- Office ZIP 解压后总量：100 MB。
- ZIP 条目数：10,000。
- 异常压缩比：超过 1,000 时阻止。
- Excel 非空单元格：20,000。
- PDF 页数：200。
- 校验扩展名、MIME 和 PDF/ZIP 文件头。
- checksum：浏览器 Web Crypto SHA-256。
- 损坏、加密或不支持文件写入 `failed + parseError`，不会让项目页面白屏。

`npm audit --omit=dev --audit-level=high` 通过，无 high/critical。ExcelJS 的归档/UUID 传递依赖仍报告 moderate；本实现只使用受文件大小、ZIP 预检和单元格上限保护的读取路径。后续替换 Parser 依赖时应重新进行供应链审计。
