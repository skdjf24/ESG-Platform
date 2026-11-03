import { strToU8, zipSync } from "fflate";
import { finalizationFingerprint } from "@/lib/finalization/state";
import { formalBlockExclusionReason } from "@/lib/presentation/formal";
import { createReportPages } from "@/lib/presentation/pages";
import type { ReportProjectData } from "@/lib/types/project-data";
import type { ReportChart } from "@/lib/types/presentation";
import type { FinalReportVersion } from "@/lib/types/finalization";
import type { ContentBlock, WritingChapter } from "@/lib/types/writing";
import { plainText, sanitizeHtml } from "@/lib/writing/document";

const DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function xml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function safeFilePart(value: string) {
  return value.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/\s+/g, "-").slice(0, 80) || "ESG-Report";
}

function orderValue(value: string) {
  return value.split(".").reduce((total, part, index) => total + (Number(part) || 0) / (10 ** index), 0);
}

function run(text: string, options: { bold?: boolean; italic?: boolean; size?: number } = {}) {
  const properties = [
    options.bold ? "<w:b/>" : "",
    options.italic ? "<w:i/>" : "",
    options.size ? `<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>` : "",
  ].join("");
  return `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ""}<w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
}

function paragraph(
  text: string,
  options: { style?: string; keepNext?: boolean; pageBreakBefore?: boolean; align?: "center" | "left"; bold?: boolean; italic?: boolean; size?: number; before?: number; after?: number } = {},
) {
  const properties = [
    options.style ? `<w:pStyle w:val="${options.style}"/>` : "",
    options.keepNext ? "<w:keepNext/>" : "",
    options.pageBreakBefore ? "<w:pageBreakBefore/>" : "",
    options.align ? `<w:jc w:val="${options.align}"/>` : "",
    options.before !== undefined || options.after !== undefined ? `<w:spacing${options.before !== undefined ? ` w:before="${options.before}"` : ""}${options.after !== undefined ? ` w:after="${options.after}"` : ""}/>` : "",
  ].join("");
  return `<w:p>${properties ? `<w:pPr>${properties}</w:pPr>` : ""}${run(text, options)}</w:p>`;
}

function pageBreak() {
  return "<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>";
}

function textLines(html: string) {
  const withBullets = sanitizeHtml(html)
    .replace(/<li>/gi, "<p>• ")
    .replace(/<\/li>/gi, "</p>");
  return plainText(withBullets).split(/\n+/).map((item) => item.trim()).filter(Boolean);
}

function table(rows: string[][], header = true) {
  const columnCount = Math.max(1, ...rows.map((row) => row.length));
  const width = Math.floor(9000 / columnCount);
  const grid = Array.from({ length: columnCount }, () => `<w:gridCol w:w="${width}"/>`).join("");
  const body = rows.map((row, rowIndex) => `<w:tr>${Array.from({ length: columnCount }, (_, columnIndex) => {
    const value = row[columnIndex] ?? "";
    const shading = header && rowIndex === 0 ? "<w:shd w:fill=\"EAF3EE\"/>" : "";
    return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shading}<w:vAlign w:val="center"/></w:tcPr>${paragraph(value, { bold: header && rowIndex === 0, after: 80 })}</w:tc>`;
  }).join("")}</w:tr>`).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="B7C8BE"/><w:left w:val="single" w:sz="4" w:color="B7C8BE"/><w:bottom w:val="single" w:sz="4" w:color="B7C8BE"/><w:right w:val="single" w:sz="4" w:color="B7C8BE"/><w:insideH w:val="single" w:sz="4" w:color="DCE6E0"/><w:insideV w:val="single" w:sz="4" w:color="DCE6E0"/></w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${body}</w:tbl>`;
}

function chartRows(chart: ReportChart) {
  return [
    ["指标", "分类", "系列", "报告期", "数值", "单位", "统计边界"],
    ...chart.observationSnapshots.map((item) => [
      item.metricName,
      item.categoryLabel,
      item.seriesName,
      item.reportingPeriod,
      item.value.toFixed(chart.precision),
      item.unit,
      item.reportingBoundary,
    ]),
  ];
}

function blockXml(block: ContentBlock, project: ReportProjectData, chart?: ReportChart) {
  if (formalBlockExclusionReason(block, project, chart)) return "";
  if (block.kind === "heading") return paragraph(block.title, { style: "Heading2", keepNext: true });
  if (block.kind === "table") return `${paragraph(block.title, { style: "Heading2", keepNext: true })}${table(block.rows)}`;
  if (block.kind === "case") {
    return `${paragraph(block.title, { style: "Heading2", keepNext: true })}${textLines(block.html).map((line) => paragraph(line)).join("")}`;
  }
  if (block.kind === "chart" && chart) {
    return `${paragraph(chart.title, { style: "Heading2", keepNext: true })}${table(chartRows(chart))}${chart.caption ? paragraph(chart.caption, { italic: true, after: 160 }) : ""}`;
  }
  return textLines(block.html).map((line) => paragraph(line)).join("");
}

function chapterXml(chapter: WritingChapter, project: ReportProjectData, first: boolean) {
  const blocks = chapter.blocks.map((block, index) => {
    if (index === 0 && block.kind === "heading" && block.title.trim() === chapter.title.trim()) return "";
    const chart = project.presentation.charts.find((item) => item.blockId === block.id);
    return blockXml(block, project, chart);
  }).join("");
  if (!blocks) return "";
  return `${paragraph(`${chapter.order} ${chapter.title}`, { style: "Heading1", pageBreakBefore: !first, keepNext: true })}${blocks}`;
}

function contentTypes() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/></Types>`;
}

function styles(project: ReportProjectData) {
  const bodySize = Math.max(16, Math.round(project.presentation.layout.bodyFontSize * 2));
  const line = Math.max(240, Math.round(project.presentation.layout.lineHeight * bodySize * 10));
  const bodyFont = xml(project.presentation.layout.bodyFont || "Noto Sans SC");
  const titleFont = xml(project.presentation.layout.titleFont || bodyFont);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${bodyFont}" w:hAnsi="${bodyFont}" w:eastAsia="${bodyFont}"/><w:sz w:val="${bodySize}"/><w:szCs w:val="${bodySize}"/><w:lang w:val="zh-CN" w:eastAsia="zh-CN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="${line}" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:spacing w:before="1200" w:after="420"/><w:jc w:val="center"/></w:pPr><w:rPr><w:rFonts w:ascii="${titleFont}" w:hAnsi="${titleFont}" w:eastAsia="${titleFont}"/><w:b/><w:sz w:val="52"/><w:szCs w:val="52"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="220"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:rFonts w:ascii="${titleFont}" w:hAnsi="${titleFont}" w:eastAsia="${titleFont}"/><w:b/><w:color w:val="176B52"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="260" w:after="140"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:rFonts w:ascii="${titleFont}" w:hAnsi="${titleFont}" w:eastAsia="${titleFont}"/><w:b/><w:color w:val="244D3C"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style></w:styles>`;
}

function documentXml(project: ReportProjectData, version: FinalReportVersion) {
  const chapters = project.writing.chapters
    .filter((chapter) => chapter.sourceState !== "upstream-removed")
    .slice()
    .sort((left, right) => orderValue(left.order) - orderValue(right.order));
  const pages = createReportPages(project);
  const tocRows = [
    ["章节", "标题", "页码"],
    ...chapters.map((chapter) => {
      const index = pages.findIndex((page) => page.chapterId === chapter.id);
      return [chapter.order, chapter.title, String(Math.max(1, index + 1))];
    }),
  ];
  let first = true;
  const chapterContent = chapters.map((chapter) => {
    const content = chapterXml(chapter, project, first);
    if (content) first = false;
    return content;
  }).join("");
  const margins = project.presentation.layout.margins;
  const twips = (mm: number) => Math.round(mm * 56.6929);
  const body = [
    paragraph(project.enterprise.name, { align: "center", bold: true, size: 26, before: 900, after: 260 }),
    paragraph(`${project.report.year} 年度环境、社会及治理报告`, { style: "Title" }),
    paragraph(`报告期：${project.report.reportingPeriod.start} — ${project.report.reportingPeriod.end}`, { align: "center", after: 180 }),
    paragraph(`${version.label} · 定稿确认人：${version.approvedBy}（${version.approverRole}）`, { align: "center", size: 18 }),
    paragraph(`定稿时间：${new Date(version.finalizedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`, { align: "center", size: 18 }),
    pageBreak(),
    paragraph("目录", { style: "Heading1" }),
    table(tocRows),
    chapterContent ? pageBreak() : "",
    chapterContent,
  ].join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${twips(margins.top)}" w:right="${twips(margins.right)}" w:bottom="${twips(margins.bottom)}" w:left="${twips(margins.left)}" w:header="720" w:footer="720" w:gutter="0"/><w:pgNumType w:start="1"/></w:sectPr></w:body></w:document>`;
}

function headerXml(project: ReportProjectData) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="right"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:color="C9D7CF"/></w:pBdr></w:pPr>${run(`${project.enterprise.shortName} · ${project.report.year} 年度 ESG 报告`, { size: 16 })}</w:p></w:hdr>`;
}

function footerXml(version: FinalReportVersion) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/><w:pBdr><w:top w:val="single" w:sz="4" w:color="C9D7CF"/></w:pBdr></w:pPr>${run(`${version.label} · `, { size: 16 })}<w:fldSimple w:instr=" PAGE "><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>${run(" / ", { size: 16 })}<w:fldSimple w:instr=" NUMPAGES "><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>`;
}

function coreProperties(project: ReportProjectData, version: FinalReportVersion) {
  const timestamp = new Date(version.finalizedAt).toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(`${project.enterprise.name} ${project.report.year} 年度 ESG 报告`)}</dc:title><dc:subject>${xml(version.label)}</dc:subject><dc:creator>${xml(version.approvedBy)}</dc:creator><cp:lastModifiedBy>${xml(version.approvedBy)}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified></cp:coreProperties>`;
}

function customProperties(version: FinalReportVersion) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="SourceFingerprint"><vt:lpwstr>${xml(version.sourceFingerprint)}</vt:lpwstr></property><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="3" name="FinalVersion"><vt:lpwstr>${xml(version.label)}</vt:lpwstr></property><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="4" name="QualityCheckRun"><vt:lpwstr>${xml(version.qualityFullCheckRunId)}</vt:lpwstr></property></Properties>`;
}

function makePackage(project: ReportProjectData, version: FinalReportVersion) {
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(contentTypes()),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" Target="docProps/custom.xml"/></Relationships>`),
    "docProps/core.xml": strToU8(coreProperties(project, version)),
    "docProps/app.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>ESG Disclosure Platform</Application><AppVersion>1.0</AppVersion></Properties>`),
    "docProps/custom.xml": strToU8(customProperties(version)),
    "word/document.xml": strToU8(documentXml(project, version)),
    "word/styles.xml": strToU8(styles(project)),
    "word/settings.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:updateFields w:val="true"/><w:defaultTabStop w:val="720"/></w:settings>`),
    "word/fontTable.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:font w:name="Noto Sans SC"><w:family w:val="swiss"/><w:charset w:val="86"/></w:font></w:fonts>`),
    "word/header1.xml": strToU8(headerXml(project)),
    "word/footer1.xml": strToU8(footerXml(version)),
    "word/_rels/document.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdFonts" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/></Relationships>`),
  };
  return zipSync(files, { level: 6 });
}

export interface FinalReportDocx {
  bytes: Uint8Array;
  contentType: typeof DOCX_CONTENT_TYPE;
  fileName: string;
}

export function createFinalReportDocx(project: ReportProjectData, version: FinalReportVersion): FinalReportDocx {
  if (version.sourceFingerprint !== finalizationFingerprint(project)) {
    throw new Error("当前定稿已失效，不能生成 DOCX。请重新执行 Step 7 全面检查并创建新定稿版本。");
  }
  return {
    bytes: makePackage(project, version),
    contentType: DOCX_CONTENT_TYPE,
    fileName: `${safeFilePart(project.enterprise.shortName || project.enterprise.name)}-${project.report.year}-ESG-V${version.versionNumber}.0.docx`,
  };
}
