import { strFromU8, unzipSync } from "fflate";
import { createFinalReportDocx } from "../lib/export/docx";
import { finalizationFingerprint } from "../lib/finalization/state";
import { createProjectData } from "../lib/project/seed";
import type { FinalReportVersion } from "../lib/types/finalization";
import type { ContentBlock } from "../lib/types/writing";

let passed = 0;
let failed = 0;

function check(condition: unknown, id: string, label: string) {
  if (condition) {
    passed += 1;
    console.log(`PASS ${id} ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL ${id} ${label}`);
  }
}

function block(overrides: Partial<ContentBlock>): ContentBlock {
  return {
    id: "phase4-block",
    chapterId: "section-4-2",
    kind: "paragraph",
    title: "正式正文",
    html: "<p>正式正文</p>",
    rows: [],
    mappings: [],
    citations: [],
    sourceReferences: [],
    revision: 1,
    updatedAt: "2026-11-03T08:00:00.000Z",
    reviewStatus: "已审校",
    ...overrides,
  };
}

const project = createProjectData("phase4-export-regression", {
  enterpriseName: "端到端导出测试有限公司",
  year: 2027,
});
project.enterprise.shortName = "端到端导出测试";
project.report.reportingPeriod = { start: "2027.01.01", end: "2027.12.31" };
const chapter = project.writing.chapters.find((item) => item.id === "section-4-2")!;
const completeText = `完整正文开始-${"披露内容".repeat(800)}-完整正文结束`;
chapter.blocks = [
  block({ id: "phase4-heading", kind: "heading", title: chapter.title, html: `<h2>${chapter.title}</h2>` }),
  block({ id: "phase4-paragraph", html: `<p>${completeText}</p>` }),
  block({ id: "phase4-table", kind: "table", title: "绩效数据表", rows: [["指标", "数值", "单位"], ["综合能源消耗", "1250", "MWh"]] }),
  block({ id: "phase4-case", kind: "case", title: "节能案例", html: "<p>完成设备改造并保留来源记录。</p>" }),
  block({ id: "phase4-chart", kind: "chart", title: "能源趋势", html: "<p></p>" }),
  block({ id: "phase4-todo", kind: "todo", title: "内部待办绝不能导出", html: "<p>内部操作说明</p>", pendingKind: "待补充", resolved: false }),
  block({ id: "phase4-mock", title: "Mock 开发说明绝不能导出", html: "<p>Mock 开发内容</p>" }),
];
project.presentation.charts = [{
  chartId: "phase4-chart-config",
  blockId: "phase4-chart",
  chapterId: chapter.id,
  metricObservationIds: ["phase4-observation"],
  observationSnapshots: [{
    observationId: "phase4-observation",
    metricDefinitionId: "energy-use",
    metricName: "综合能源消耗",
    categoryLabel: "能源",
    seriesName: "综合能源消耗",
    value: 1250,
    unit: "MWh",
    reportingPeriod: "2027年度",
    reportingBoundary: "母公司及纳入报告范围的子公司",
    boundaryStatus: "已核验",
    sourceConfirmationStatus: "已确认",
    comparabilityStatus: "可比",
    revision: 1,
    sourceReferences: [],
    sampleKind: "项目事实",
  }],
  type: "kpi",
  title: "能源趋势",
  colors: ["#176b52"],
  showLegend: true,
  showDataLabels: true,
  precision: 0,
  unit: "MWh",
  caption: "报告期综合能源消耗。",
  status: "已确认",
  layoutReviewStatus: "有效",
  revision: 1,
  updatedAt: "2026-11-03T08:00:00.000Z",
}];

const fingerprint = finalizationFingerprint(project);
const version: FinalReportVersion = {
  versionId: "phase4-final-v1",
  versionNumber: 1,
  label: "V1.0 · 2027 年度 ESG 报告",
  sourceFingerprint: fingerprint,
  qualityFullCheckRunId: "phase4-quality-run",
  qualityInputFingerprint: "phase4-quality-input",
  qualityRuleSetFingerprint: "phase4-rules",
  projectRevision: project.revision,
  presentationRevision: project.presentation.revision,
  enterpriseName: project.enterprise.name,
  reportYear: project.report.year,
  reportingPeriod: structuredClone(project.report.reportingPeriod),
  pageCount: 12,
  issueSummary: { total: 0, blockers: 0, high: 0, notices: 0, acceptedExceptions: 0 },
  issueRecords: [],
  declarations: { contentReviewed: true, sourcesReviewed: true, authorityConfirmed: true, exportPreviewReviewed: true },
  approvedBy: "验收负责人",
  approverRole: "ESG 报告负责人",
  approvalNote: "Phase 4 自动化验收",
  finalizedAt: "2026-11-03T08:00:00.000Z",
};

const output = createFinalReportDocx(project, version);
const archive = unzipSync(output.bytes);
const required = [
  "[Content_Types].xml",
  "_rels/.rels",
  "docProps/core.xml",
  "docProps/custom.xml",
  "word/document.xml",
  "word/styles.xml",
  "word/settings.xml",
  "word/header1.xml",
  "word/footer1.xml",
  "word/_rels/document.xml.rels",
];
const documentXml = strFromU8(archive["word/document.xml"]);
const headerXml = strFromU8(archive["word/header1.xml"]);
const footerXml = strFromU8(archive["word/footer1.xml"]);
const customXml = strFromU8(archive["docProps/custom.xml"]);

check(output.fileName.endsWith(".docx") && output.contentType.includes("wordprocessingml"), "P4-01", "输出真实 DOCX MIME 与文件名");
check(required.every((path) => archive[path]), "P4-02", "OOXML 必需部件完整");
check(documentXml.includes("端到端导出测试有限公司") && documentXml.includes("2027 年度环境、社会及治理报告"), "P4-03", "封面使用动态企业与年度");
check(documentXml.includes("2027.01.01") && documentXml.includes("2027.12.31"), "P4-04", "报告期进入正式文档");
check(documentXml.includes("绩效数据表") && documentXml.includes("1250") && documentXml.includes("MWh"), "P4-05", "表格内容完整进入 DOCX");
check(documentXml.includes("能源趋势") && documentXml.includes("母公司及纳入报告范围的子公司"), "P4-06", "已确认图表数据与边界进入 DOCX");
check(documentXml.includes("节能案例") && documentXml.includes("完成设备改造并保留来源记录"), "P4-07", "案例内容进入 DOCX");
check(documentXml.includes("完整正文开始") && documentXml.includes("完整正文结束") && documentXml.includes("披露内容".repeat(800)), "P4-08", "长正文未截断");
check(!documentXml.includes("内部待办绝不能导出") && !documentXml.includes("Mock 开发说明绝不能导出"), "P4-09", "待办与 Mock 内容排除");
check(!documentXml.includes("blockId") && !documentXml.includes("phase4-block"), "P4-10", "内部 blockId 不进入正式文档");
check(headerXml.includes("端到端导出测试") && headerXml.includes("2027"), "P4-11", "页眉动态信息正确");
check(footerXml.includes("V1.0") && footerXml.includes("PAGE") && footerXml.includes("NUMPAGES"), "P4-12", "页脚包含版本与动态页码域");
check(customXml.includes(fingerprint) && customXml.includes("phase4-quality-run"), "P4-13", "定稿指纹与质量检查记录写入文档属性");
check(strFromU8(archive["word/settings.xml"]).includes("updateFields"), "P4-14", "Word 打开时更新页码域");

project.enterprise.name = "上游已变化企业";
let staleBlocked = false;
try {
  createFinalReportDocx(project, version);
} catch (error) {
  staleBlocked = error instanceof Error && error.message.includes("定稿已失效");
}
check(staleBlocked, "P4-15", "上游变化后旧定稿禁止导出");

console.log(JSON.stringify({ pass: passed, fail: failed }));
if (failed) process.exitCode = 1;
