import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { zipSync, strToU8 } from "fflate";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/phase2");
await fs.mkdir(directory, { recursive: true });

const workbook = new ExcelJS.Workbook();
workbook.creator = "ESG Platform Phase 2 fixture generator";
const energy = workbook.addWorksheet("能源汇总");
energy.mergeCells("A1:D1");
energy.getCell("A1").value = "Phase 2 非敏感测试样本";
energy.addRow([]);
energy.addRow(["指标", "2025", "2026", "单位"]);
energy.addRow(["综合能源消耗", 12680, 13240, "MWh"]);
energy.addRow(["可再生能源占比", 0.147, 0.182, "%"]);
energy.getCell("B5").numFmt = "0.0%";
energy.getCell("C5").numFmt = "0.0%";
energy.addRow([]);
energy.addRow(["年度变化", { formula: "C4-B4", result: 560 }, "", "MWh"]);
energy.addTable({ name: "EnergyMetrics", ref: "A3", headerRow: true, totalsRow: false, columns: [{ name: "指标" }, { name: "2025" }, { name: "2026" }, { name: "单位" }], rows: [["综合能源消耗", 12680, 13240, "MWh"], ["可再生能源占比", 0.147, 0.182, "%"]] });
const people = workbook.addWorksheet("员工数据");
people.addRow(["指标", "2025", "2026", "单位"]);
people.addRow(["员工人数", 2180, 2246, "人"]);
people.addRow(["培训覆盖率", 0.91, 0.94, "%"]);
people.getCell("B3").numFmt = "0%";
people.getCell("C3").numFmt = "0%";
await workbook.xlsx.writeFile(path.join(directory, "phase2-metrics.xlsx"));
energy.getCell("C4").value = 14000;
energy.getCell("C5").value = 0.205;
energy.getCell("C5").numFmt = "0.0%";
await workbook.xlsx.writeFile(path.join(directory, "phase2-metrics-updated.xlsx"));

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
const packageRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/></w:style>
</w:styles>`;
const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
  <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>4 环境管理</w:t></w:r></w:p>
  <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>4.1 环境管理体系</w:t></w:r></w:p>
  <w:p><w:r><w:t>本测试样本仅用于验证结构化解析，不代表任何企业事实。</w:t></w:r></w:p>
  <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>保留原始资料来源和人工确认记录</w:t></w:r></w:p>
  <w:tbl><w:tr><w:tc><w:p><w:r><w:t>制度名称</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>状态</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>环境管理制度</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>测试样本</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
  <w:sectPr/>
</w:body></w:document>`;
const docx = zipSync({
  "[Content_Types].xml": strToU8(contentTypes),
  "_rels/.rels": strToU8(packageRels),
  "word/document.xml": strToU8(documentXml),
  "word/styles.xml": strToU8(styles),
}, { level: 6 });
await fs.writeFile(path.join(directory, "phase2-structured.docx"), docx);

const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
const page1 = pdf.addPage([595.28, 841.89]);
page1.drawText("Phase 2 ESG parser fixture - page 1", { x: 54, y: 780, size: 18, font, color: rgb(0.08, 0.35, 0.25) });
page1.drawText("This local test document contains no sensitive enterprise data.", { x: 54, y: 744, size: 11, font });
page1.drawText("Energy consumption | 2025 | 12,680 | MWh", { x: 54, y: 710, size: 11, font });
page1.drawText("Renewable energy ratio | 2025 | 14.7 | percent", { x: 54, y: 690, size: 11, font });
const page2 = pdf.addPage([595.28, 841.89]);
page2.drawText("Phase 2 ESG parser fixture - page 2", { x: 54, y: 780, size: 18, font, color: rgb(0.08, 0.35, 0.25) });
page2.drawText("Policy status: sample only, pending human confirmation.", { x: 54, y: 744, size: 11, font });
page2.drawText("Metric | Period | Value | Unit", { x: 54, y: 710, size: 11, font });
page2.drawText("Training coverage | 2026 | 94 | percent", { x: 54, y: 690, size: 11, font });
await fs.writeFile(path.join(directory, "phase2-text.pdf"), await pdf.save());

await fs.writeFile(path.join(directory, "phase2-corrupt.xlsx"), new TextEncoder().encode("not a valid Office ZIP fixture"));
console.log(`Generated Phase 2 fixtures in ${directory}`);
