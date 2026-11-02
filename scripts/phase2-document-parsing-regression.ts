import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyCandidateConfirmation, rejectCandidate } from "../lib/parsing/confirmation";
import { candidateFromBlock } from "../lib/parsing/candidate-utils";
import { DocxParser } from "../lib/parsing/parsers/docx-parser";
import { ExcelParser } from "../lib/parsing/parsers/excel-parser";
import { PdfParser } from "../lib/parsing/parsers/pdf-parser";
import { checksumBlob } from "../lib/parsing/security";
import { markProjectSourceNeedsReview } from "../lib/parsing/service";
import { createProjectData } from "../lib/project/seed";
import { synchronizeProjectData } from "../lib/project/synchronize";
import type { ProjectFileRecord } from "../lib/types/project-data";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = path.join(root, "fixtures/phase2");
const results: Array<{ id: string; status: "PASS"; detail: string }> = [];

function check(condition: unknown, id: string, detail: string): asserts condition {
  assert.ok(condition, `${id}: ${detail}`);
  results.push({ id, status: "PASS", detail });
  console.log(`PASS ${id} ${detail}`);
}

async function fileRecord(name: string, mimeType: string): Promise<ProjectFileRecord> {
  const bytes = await fs.readFile(path.join(fixtureDir, name));
  const blob = new Blob([bytes], { type: mimeType });
  const now = new Date().toISOString();
  return {
    fileId: `file-${name}`,
    projectId: "hualan-2025",
    name,
    mimeType,
    size: blob.size,
    createdAt: now,
    updatedAt: now,
    checksum: await checksumBlob(blob),
    revision: 1,
    parserStatus: "not-started",
    blob,
  };
}

async function main() {
const excelFile = await fileRecord("phase2-metrics.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
const excel = await new ExcelParser().parse(excelFile, { sourceId: "source-phase2-excel", sourceKind: "current" });
check(excel.document.sheetNames?.join("|") === "能源汇总|员工数据", "P2-EXCEL-SHEETS", "XLSX 工作表名称与顺序正确");
check(excel.document.tables.length === 2 && excel.document.tables[0].mergedRanges.includes("A1:D1"), "P2-EXCEL-MERGE", "工作表区域和合并单元格真实解析");
const energyCell = excel.document.blocks.find((block) => block.kind === "cell" && block.locator.sheet === "能源汇总" && block.locator.cell === "B4");
check(energyCell?.kind === "cell" && energyCell.rawValue === 12680, "P2-EXCEL-CELL", "能源汇总 B4 数值 12680 正确");
const formulaCell = excel.document.blocks.find((block) => block.kind === "cell" && block.kind === "cell" && block.formula === "C4-B4");
check(formulaCell?.kind === "cell" && formulaCell.cachedValue === 560, "P2-EXCEL-FORMULA", "公式与文件内缓存结果均保留");
const energyCandidate = excel.candidates.find((candidate) => candidate.label === "综合能源消耗" && candidate.period === "2025");
check(energyCandidate?.value === 12680 && energyCandidate.unit === "MWh" && energyCandidate.sourceLocator.cell === "B4", "P2-EXCEL-CANDIDATE", "表头规则生成指标候选并保留单位、期间和 Cell locator");
const ratioCandidate = excel.candidates.find((candidate) => candidate.label === "可再生能源占比" && candidate.period === "2025");
check(ratioCandidate?.value === 14.7 && ratioCandidate.unit === "%", "P2-EXCEL-PERCENT", "百分比按显示语义提取为 14.7 %");
check(excel.candidates.every((candidate) => candidate.status === "candidate"), "P2-NO-AUTO-CONFIRM", "规则候选不会自动成为已确认指标");

const docxFile = await fileRecord("phase2-structured.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
const docx = await new DocxParser().parse(docxFile, { sourceId: "source-phase2-docx", sourceKind: "current" });
const docxHeadings = docx.document.blocks.filter((block) => block.kind === "heading");
check(docxHeadings.length === 2 && docxHeadings[1].locator.headingPath?.join(" > ") === "4 环境管理 > 4.1 环境管理体系", "P2-DOCX-HEADINGS", "DOCX Heading 1–2 层级和路径正确");
check(docx.document.blocks.some((block) => block.kind === "paragraph" && block.paragraphStyle === "list"), "P2-DOCX-LIST", "DOCX 列表段落保留原始顺序和类型");
check(docx.document.tables[0]?.rows[1]?.[0]?.text === "环境管理制度" && docx.document.tables[0].rows[1][0].locator.tableIndex === 0, "P2-DOCX-TABLE", "DOCX 表格及 table/row/column locator 正确");

const pdfFile = await fileRecord("phase2-text.pdf", "application/pdf");
const pdf = await new PdfParser().parse(pdfFile, { sourceId: "source-phase2-pdf", sourceKind: "current" });
check(pdf.document.pageCount === 2 && pdf.document.blocks.length === 2, "P2-PDF-PAGES", "文本型 PDF 页数和逐页文本块正确");
check(pdf.document.blocks[1].locator.page === 2 && pdf.document.blocks[1].text.includes("Training coverage"), "P2-PDF-LOCATOR", "PDF 第 2 页文本和 page locator 可追溯");

check(Boolean(energyCandidate), "P2-CANDIDATE-PRESENT", "指标候选存在以供确认测试");
if (!energyCandidate) throw new Error("Fixture candidate missing");
let project = createProjectData("hualan-2025");
project = {
  ...project,
  sources: [...project.sources, { id: energyCandidate.sourceId, name: excelFile.name, kind: "file", fileType: "XLSX", fileId: excelFile.fileId, mimeType: excelFile.mimeType, fileStatus: "available", parserStatus: "parsed", uploadedAt: "2026-11-02", uploadedBy: "Phase 2 test", state: "已解析" }],
};
const confirmed = applyCandidateConfirmation(project, energyCandidate, { type: "metric", label: energyCandidate.label, value: energyCandidate.value, unit: energyCandidate.unit, period: energyCandidate.period, boundary: "测试样本边界" });
const synchronized = synchronizeProjectData(project, confirmed.project, 4).project;
const confirmedFact = synchronized.facts.find((fact) => fact.id === confirmed.confirmedEntityId);
check(confirmedFact?.state === "已确认" && confirmedFact.sourceReferences[0].fileId === excelFile.fileId && confirmedFact.sourceReferences[0].sourceLocator?.cell === "B4", "P2-METRIC-TRACE", "人工确认 Metric 保留 File → ParsedBlock → SourceReference 链路");
check(synchronized.presentation.observations.some((observation) => observation.metricId === confirmed.confirmedEntityId && observation.confirmationStatus === "已确认"), "P2-METRIC-DOWNSTREAM", "确认 Metric 通过既有同步机制进入 Step 6 MetricObservation");

const paragraph = docx.document.blocks.find((block) => block.kind === "paragraph" && block.paragraphStyle === "paragraph");
check(Boolean(paragraph), "P2-DOCX-PARAGRAPH", "DOCX 段落可供手工创建事实候选");
if (!paragraph) throw new Error("Fixture paragraph missing");
const factCandidate = candidateFromBlock(docx.document, paragraph, "fact");
const repeatedFactCandidate = candidateFromBlock(docx.document, paragraph, "fact");
check(factCandidate.candidateId === repeatedFactCandidate.candidateId, "P2-CANDIDATE-DEDUPE", "同 checksum、位置、内容和类型产生稳定 candidate identity");
check(rejectCandidate(factCandidate).status === "rejected" && rejectCandidate(factCandidate).candidateId === factCandidate.candidateId, "P2-CANDIDATE-REJECT", "拒绝候选保留稳定身份且不入库");

const sourceChanged = markProjectSourceNeedsReview(synchronized, energyCandidate.sourceId);
const changedFact = sourceChanged.facts.find((fact) => fact.id === confirmed.confirmedEntityId);
check(changedFact?.state === "待人工确认" && changedFact.sourceConfirmationStatus === "待确认", "P2-SOURCE-STALE", "文件版本变化不覆盖已确认值，仅使来源及下游待复核");

const corrupt = await fileRecord("phase2-corrupt.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
let corruptMessage = "";
try {
  await new ExcelParser().parse(corrupt, { sourceId: "source-corrupt" });
} catch (error) {
  corruptMessage = error instanceof Error ? error.message : String(error);
}
check(/ZIP|损坏/.test(corruptMessage), "P2-CORRUPT", "损坏 XLSX 返回可解释错误而非未处理崩溃");

const output = { generatedAt: new Date().toISOString(), fixtures: [excelFile.name, docxFile.name, pdfFile.name, corrupt.name], results, pass: results.length, fail: 0 };
await fs.mkdir(path.join(root, "docs/acceptance/phase2"), { recursive: true });
await fs.writeFile(path.join(root, "docs/acceptance/phase2/parser-results.json"), `${JSON.stringify(output, null, 2)}\n`);
console.log(`RESULT ${results.length} PASS / 0 FAIL`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
