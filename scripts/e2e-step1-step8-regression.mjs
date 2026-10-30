import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { validateChartSelection } from "../lib/presentation/chart-validation.ts";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { clearProjectDatabase, mutateProject, readProject, readProjectFiles } = require("./indexeddb-test-helpers.cjs");

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:4325";
const projectLabel = "E2E Prototype Test Project";
const here = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.resolve(here, "../docs/acceptance/e2e-step1-step8");
const results = [];
const findings = [];
const browserErrors = [];

function record(condition, id, title, detail = "") {
  const status = condition ? "PASS" : "FAIL";
  results.push({ id, title, status, detail });
  console.log(`${status} ${id} ${title}${detail ? ` — ${detail}` : ""}`);
  return condition;
}

function finding(severity, id, title, evidence, impact, recommendation) {
  findings.push({ severity, id, title, evidence, impact, recommendation });
  console.log(`FINDING ${severity} ${id} ${title}`);
}

function observation(overrides = {}) {
  return {
    observationId: "e2e-observation",
    projectId: "hualan-2025",
    metricId: "e2e-metric",
    metricDefinitionId: "e2e-definition",
    metricName: "E2E 模拟指标",
    categoryLabel: "类别 A",
    seriesName: "系列 A",
    compositionGroupId: "e2e-composition",
    value: 10,
    rawValue: "10",
    unit: "MWh",
    reportingPeriod: "2025年度",
    reportingBoundary: "E2E 独立模拟边界",
    boundaryStatus: "已核验",
    sourceConfirmationStatus: "已确认",
    comparabilityStatus: "可比",
    sourceReferences: [{ id: "e2e-ref", sourceId: "e2e-source", fileName: "E2E-明确模拟数据.csv", locator: "A2", excerpt: "明确模拟数据，不进入正式披露" }],
    revision: 1,
    confirmationStatus: "已确认",
    sampleKind: "明确模拟样本",
    sampleLabel: "E2E 明确模拟数据",
    ...overrides,
  };
}

function runChartContractChecks() {
  const fixtures = {
    bar: [
      observation({ observationId: "bar-a", metricDefinitionId: "energy-a", metricName: "购电量", categoryLabel: "购电", seriesName: "购电" }),
      observation({ observationId: "bar-b", metricDefinitionId: "energy-b", metricName: "蒸汽量", categoryLabel: "蒸汽", seriesName: "蒸汽", value: 8 }),
    ],
    line: [
      observation({ observationId: "line-2024", reportingPeriod: "2024年度", value: 9 }),
      observation({ observationId: "line-2025", reportingPeriod: "2025年度", value: 10 }),
    ],
    "stacked-bar": [
      observation({ observationId: "stack-a-2024", reportingPeriod: "2024年度", seriesName: "外购电力", value: 7 }),
      observation({ observationId: "stack-b-2024", reportingPeriod: "2024年度", seriesName: "外购蒸汽", value: 2 }),
      observation({ observationId: "stack-a-2025", reportingPeriod: "2025年度", seriesName: "外购电力", value: 8 }),
      observation({ observationId: "stack-b-2025", reportingPeriod: "2025年度", seriesName: "外购蒸汽", value: 2.5 }),
    ],
    pie: [
      observation({ observationId: "pie-a", categoryLabel: "外购电力", seriesName: "外购电力", value: 8 }),
      observation({ observationId: "pie-b", categoryLabel: "外购蒸汽", seriesName: "外购蒸汽", value: 2 }),
    ],
    kpi: [observation({ observationId: "kpi" })],
  };
  for (const [type, items] of Object.entries(fixtures)) {
    const validation = validateChartSelection(type, items, "MWh");
    record(validation.valid, `CHART-${type}`, `${type} 合规模拟数据通过确认校验`, validation.issues.join("；"));
    record(validation.warnings.some((item) => item.includes("模拟测试数据")), `CHART-${type}-LABEL`, `${type} 模拟数据具有明确警示`);
  }

  const invalidCases = [
    ["line-metric", "line", [fixtures.line[0], observation({ observationId: "line-other", metricDefinitionId: "other", reportingPeriod: "2025年度" })], "同一指标定义"],
    ["unit", "bar", [fixtures.bar[0], observation({ observationId: "bar-unit", unit: "tCO2e", categoryLabel: "类别 B" })], "单位必须一致"],
    ["boundary", "bar", [fixtures.bar[0], observation({ observationId: "bar-boundary", reportingBoundary: "其他边界", categoryLabel: "类别 B" })], "统计边界必须一致"],
    ["pie-period", "pie", [fixtures.pie[0], observation({ observationId: "pie-period", reportingPeriod: "2024年度", categoryLabel: "类别 B" })], "同一报告期间"],
    ["stack-duplicate", "stacked-bar", [fixtures["stacked-bar"][0], observation({ observationId: "stack-duplicate", reportingPeriod: "2024年度", seriesName: "外购电力" }), fixtures["stacked-bar"][1]], "只能对应一项观测"],
  ];
  for (const [id, type, items, expected] of invalidCases) {
    const validation = validateChartSelection(type, items, "MWh");
    record(!validation.valid && validation.issues.some((item) => item.includes(expected)), `CHART-BLOCK-${id}`, `拦截 ${id}`, validation.issues.join("；"));
  }
  return fixtures;
}

async function stored(page) {
  return readProject(page);
}

async function waitForProjectReady(page) {
  await page.locator('[aria-busy="false"]').first().waitFor({ state: "attached", timeout: 15000 });
}

async function reloadProject(page, timeout = 90_000) {
  await page.reload({ waitUntil: "networkidle", timeout });
  await waitForProjectReady(page);
}

async function openStep(page, step) {
  const response = await page.goto(`${baseUrl}/reports/hualan-2025/step/${step}`, { waitUntil: "networkidle" });
  record(Boolean(response?.ok()), `ROUTE-${step}`, `Step ${step} 路由可打开`, String(response?.status()));
  await waitForProjectReady(page);
}

async function waitForStored(page, predicate, timeout = 12_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const project = await stored(page).catch(() => null);
    if (project && predicate(project)) return project;
    await page.waitForTimeout(100);
  }
  throw new Error("Timed out waiting for the expected IndexedDB state");
}

async function saveFooter(page) {
  const button = page.getByRole("button", { name: /保存草稿|已保存/ }).last();
  await button.click();
  await page.getByText(/已保存项目数据|刷新后仍可恢复/).waitFor({ timeout: 12_000 }).catch(() => null);
}

function duplicateIds(project) {
  const collections = {
    topics: project.topics,
    disclosureRequirements: project.disclosureRequirements,
    reportSections: project.reportSections,
    dataRequirements: project.dataRequirements,
    sources: project.sources,
    facts: project.facts,
    resources: project.resources,
    chapters: project.writing.chapters,
    blocks: project.writing.chapters.flatMap((chapter) => chapter.blocks),
    observations: project.presentation.observations.map((item) => ({ id: item.observationId })),
    charts: project.presentation.charts.map((item) => ({ id: item.chartId })),
    qualityIssues: project.quality.issues.map((item) => ({ id: item.issueId })),
    finalVersions: project.finalization.versions.map((item) => ({ id: item.versionId })),
  };
  return Object.entries(collections).flatMap(([name, items]) => {
    const seen = new Set();
    return items.filter((item) => item?.id && (seen.has(item.id) || !seen.add(item.id))).map((item) => `${name}:${item.id}`);
  });
}

function integrity(project) {
  const requirementIds = new Set(project.disclosureRequirements.map((item) => item.id));
  const sectionIds = new Set(project.reportSections.map((item) => item.id));
  const chapterIds = new Set(project.writing.chapters.map((item) => item.id));
  const blockIds = new Set(project.writing.chapters.flatMap((chapter) => chapter.blocks.map((item) => item.id)));
  const factIds = new Set(project.facts.map((item) => item.id));
  const sourceIds = new Set(project.sources.map((item) => item.id));
  const observationIds = new Set(project.presentation.observations.map((item) => item.observationId));
  const orphanRequirements = project.writing.chapters.flatMap((chapter) => chapter.blocks.flatMap((block) => block.mappings.filter((item) => !requirementIds.has(item.requirementId)).map((item) => `${block.id}:${item.requirementId}`)));
  const orphanFacts = project.writing.chapters.flatMap((chapter) => chapter.blocks.flatMap((block) => block.citations.filter((item) => !factIds.has(item.factId)).map((item) => `${block.id}:${item.factId}`)));
  const orphanCharts = project.presentation.charts.flatMap((chart) => [
    ...(!blockIds.has(chart.blockId) ? [`${chart.chartId}:block:${chart.blockId}`] : []),
    ...(!chapterIds.has(chart.chapterId) ? [`${chart.chartId}:chapter:${chart.chapterId}`] : []),
    ...chart.metricObservationIds.filter((id) => !observationIds.has(id)).map((id) => `${chart.chartId}:observation:${id}`),
  ]);
  const orphanSources = [
    ...project.facts.flatMap((fact) => fact.sourceReferences.filter((item) => !sourceIds.has(item.sourceId)).map((item) => `fact:${fact.id}:${item.sourceId}`)),
    ...project.resources.flatMap((resource) => resource.sourceReferences.filter((item) => !sourceIds.has(item.sourceId)).map((item) => `resource:${resource.id}:${item.sourceId}`)),
  ];
  const sectionGaps = project.reportSections.filter((item) => !chapterIds.has(item.id)).map((item) => item.id);
  const inactiveChapters = project.writing.chapters.filter((item) => !sectionIds.has(item.id) && item.sourceState !== "upstream-removed").map((item) => item.id);
  const badRevisions = [
    ...project.facts.filter((item) => !Number.isInteger(item.revision) || item.revision < 1).map((item) => `fact:${item.id}`),
    ...project.writing.chapters.flatMap((chapter) => chapter.blocks.filter((item) => !Number.isInteger(item.revision) || item.revision < 1).map((item) => `block:${item.id}`)),
    ...project.presentation.observations.filter((item) => !Number.isInteger(item.revision) || item.revision < 1).map((item) => `observation:${item.observationId}`),
  ];
  return { duplicates: duplicateIds(project), orphanRequirements, orphanFacts, orphanCharts, orphanSources, sectionGaps, inactiveChapters, badRevisions };
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const chartFixtures = runChartContractChecks();
  const bundledChromium = chromium.executablePath();
  const executablePath = process.env.CHROMIUM_EXECUTABLE || (fs.existsSync(bundledChromium) ? bundledChromium : "/usr/bin/chromium");
  const browser = await chromium.launch({ headless: true, executablePath, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1800, height: 1180 }, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(90_000);
  page.on("dialog", (dialog) => dialog.accept());
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("favicon")) browserErrors.push(`console: ${message.text()}`); });
  page.on("pageerror", (error) => browserErrors.push(`page: ${error.message}`));

  await openStep(page, 1);
  await clearProjectDatabase(page);
  await reloadProject(page);
  await page.getByLabel("企业全称").fill(projectLabel);
  await page.getByLabel("报告年度").fill("2026");
  await page.getByLabel("报告期开始").fill("2026.01.01");
  await page.getByLabel("报告期结束").fill("2026.12.31");
  await page.getByRole("button", { name: "未上市" }).click();
  await page.locator("#boundary-note").fill("E2E 独立模拟测试边界；不属于企业正式披露数据。");
  await page.getByRole("button", { name: "保存基础信息" }).click();
  let project = await waitForStored(page, (value) => value.enterprise.name === projectLabel && value.report.year === 2026);
  record(project.enterprise.listingStatus === "未上市", "STEP1-MARKET", "市场类别保存");
  record(project.boundary.note.startsWith("E2E"), "STEP1-BOUNDARY", "报告边界保存");
  record(project.sources.length > 0, "STEP1-HISTORY", "历史报告记录保留");
  const initialSourceCount = project.sources.length;
  await reloadProject(page);
  record(await page.getByLabel("企业全称").inputValue() === projectLabel, "STEP1-REFRESH", "Step 1 刷新后恢复");
  record(await page.getByLabel("企业全称").inputValue() === projectLabel, "STEP1-DYNAMIC", "Step 1 使用最新企业信息作为当前项目状态");

  const industryBefore = `${project.enterprise.industryCode}:${project.enterprise.industryName}`;
  await page.getByLabel("行业分类").selectOption("I65");
  await page.getByRole("button", { name: "保存基础信息" }).click();
  const industryAfter = await waitForStored(page, (value) => value.enterprise.industryCode === "I65");
  const industryEditable = `${industryAfter.enterprise.industryCode}:${industryAfter.enterprise.industryName}` !== industryBefore;
  record(industryEditable, "STEP1-INDUSTRY-EDIT", "行业分类可编辑并可进入保存流程");
  await page.getByLabel("选择历史报告文件").setInputFiles({ name: "E2E-历史报告-明确模拟.pdf", mimeType: "application/pdf", buffer: Buffer.from("E2E mock PDF metadata only") });
  await page.getByText(/历史报告文件已保存到本地文件仓库/).waitFor({ timeout: 12_000 });
  project = await waitForStored(page, (value) => value.sources.some((item) => item.name === "E2E-历史报告-明确模拟.pdf"));
  const historyUploadWorks = project.sources.length === initialSourceCount + 1 && project.sources.some((item) => item.kind === "historical" && item.state === "已上传");
  record(historyUploadWorks, "STEP1-HISTORY-UPLOAD", "历史报告可创建并保存本地来源元数据");
  record(await page.getByText(/文件内容不会存入浏览器/).isVisible(), "STEP1-HISTORY-BOUNDARY", "历史报告入口明确不保存或解析文件内容");

  await openStep(page, 7);
  await page.getByRole("button", { name: "开始全面检查" }).click();
  await page.getByText(/确定性规则检查已完成/).waitFor({ timeout: 20_000 });
  project = await stored(page);
  record(project.quality.fullCheck?.valid === true, "STEP7-FULL-CHECK", "全面检查建立有效运行记录");
  const fullCheckRunId = project.quality.fullCheck?.runId;
  const blockCountBeforeTopicChange = project.writing.chapters.flatMap((item) => item.blocks).length;

  await openStep(page, 2);
  const includedTopic = project.topics.find((item) => project.materiality.includedTopicIds.includes(item.id) && project.disclosureRequirements.some((requirement) => requirement.topic === item.name));
  await page.getByRole("button", { name: `移出${includedTopic.name}` }).click();
  await page.getByRole("button", { name: "确认评估结果" }).click();
  await saveFooter(page);
  project = await waitForStored(page, (value) => value.quality.stale === true);
  record(project.disclosureRequirements.some((item) => item.topic === includedTopic.name && item.reviewStatus === "待复核"), "CHAIN-B-STEP2-3", "Step 2 议题变化使相关披露要求待复核");
  record(project.writing.chapters.flatMap((item) => item.blocks).length === blockCountBeforeTopicChange, "STEP2-NO-DELETE", "议题变化不删除既有正文");
  record(project.quality.fullCheck?.valid === false && project.quality.fullCheck?.runId === fullCheckRunId, "STEP2-INVALIDATE-QA", "议题变化保留历史并使原全面检查失效");

  const topicCount = project.topics.length;
  await page.getByRole("button", { name: "新增议题" }).click();
  await page.locator("#topic-name").fill("E2E 用户新增议题");
  await page.locator("#topic-category").selectOption("S");
  await page.locator("#topic-financial").fill("4.1");
  await page.locator("#topic-impact").fill("4.4");
  await page.getByRole("button", { name: "保存议题" }).click();
  await saveFooter(page);
  project = await waitForStored(page, (value) => value.topics.some((item) => item.name === "E2E 用户新增议题"));
  const addedTopic = project.topics.find((item) => item.name === "E2E 用户新增议题");
  record(project.topics.length === topicCount + 1 && addedTopic?.financialScore === 4.1 && addedTopic?.impactScore === 4.4, "STEP2-ADD-TOPIC", "议题池支持新增议题并保存双重重要性评分");

  await openStep(page, 3);
  const requirement = project.disclosureRequirements[0];
  const applicability = page.getByLabel(`${requirement.code} 用户确认适用性`);
  await applicability.selectOption(requirement.applicability === "不适用" ? "适用" : "不适用");
  const confirm = page.getByRole("button", { name: "人工确认" }).first();
  if (await confirm.count()) await confirm.click();
  await page.getByRole("button", { name: "报告目录" }).click();
  const originalSectionCount = project.reportSections.length;
  const originalTitle = await page.locator("#section-title").inputValue();
  const renamedTitle = `${originalTitle} E2E`;
  await page.locator("#section-title").fill(renamedTitle);
  await page.getByRole("button", { name: "保存章节" }).click();
  project = await waitForStored(page, (value) => value.reportSections.some((item) => item.title === renamedTitle));
  record(project.writing.chapters.some((item) => item.title === renamedTitle), "CHAIN-D-STEP3-5", "Step 3 章节改名同步 Step 5 目录");
  record(project.disclosureRequirements.filter((item) => item.mappedSection.endsWith(renamedTitle)).length > 0, "CHAIN-B-STEP3-MAPPING", "Step 3 章节改名同步披露要求映射");
  await page.getByRole("button", { name: "新增章节" }).click();
  await page.locator("#new-section-order").fill("8");
  await page.locator("#new-section-title-input").fill("E2E 新增章节");
  await page.locator("#new-section-description").fill("E2E 章节新增与下游同步测试。");
  await page.getByRole("button", { name: "创建章节" }).click();
  await page.getByRole("button", { name: "保存章节" }).click();
  project = await waitForStored(page, (value) => value.reportSections.some((item) => item.title === "E2E 新增章节") && value.writing.chapters.some((item) => item.title === "E2E 新增章节"));
  record(project.reportSections.length === originalSectionCount + 1, "STEP3-ADD-SECTION", "Step 3 可新增章节并同步创建 Step 5 章节");

  await openStep(page, 4);
  await page.getByRole("button", { name: /企业事实库/ }).click();
  project = await stored(page);
  const numericFact = project.facts.find((item) => item.value && !Number.isNaN(Number(String(item.value).replaceAll(",", ""))));
  const valueInput = page.getByLabel(`${numericFact.name}数值`);
  if (!await valueInput.isVisible().catch(() => false)) await page.getByText(numericFact.name, { exact: true }).first().click();
  const nextValue = String(Number(String(numericFact.value).replaceAll(",", "")) + 1);
  await valueInput.fill(nextValue);
  await page.getByRole("button", { name: "应用更新" }).click();
  await saveFooter(page);
  project = await waitForStored(page, (value) => value.facts.find((item) => item.id === numericFact.id)?.revision > numericFact.revision);
  const changedFact = project.facts.find((item) => item.id === numericFact.id);
  record(changedFact.value === nextValue, "STEP4-FACT-REVISION", "Step 4 事实修订保存并增加版本");
  const citations = project.writing.chapters.flatMap((chapter) => chapter.blocks.flatMap((block) => block.citations.filter((item) => item.factId === numericFact.id).map((item) => ({ chapter, block, citation: item }))));
  record(!citations.length || citations.every((item) => item.citation.factRevision < changedFact.revision && item.block.reviewStatus === "待复核"), "CHAIN-A-STEP4-5", "事实版本变化保留旧引用快照并使正文待复核");
  const affectedCharts = project.presentation.charts.filter((chart) => chart.metricObservationIds.some((id) => project.presentation.observations.some((item) => item.observationId === id && item.metricId === numericFact.id)));
  record(!affectedCharts.length || affectedCharts.every((item) => item.status === "需更新"), "CHAIN-A-STEP4-6", "图表引用数据变化后进入需更新");

  const sourceCountBefore = project.sources.length;
  await page.getByRole("button", { name: /上传资料/ }).click();
  record(await page.getByText(/文件字节保存到本地 IndexedDB；Phase 1 不执行解析/).isVisible(), "STEP4-UPLOAD-STORAGE-LABEL", "文件收集明确标记真实本地存储和未解析边界");
  await page.getByLabel("选择资料文件").setInputFiles({ name: "E2E-能源资料-明确模拟.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from("E2E mock spreadsheet metadata only") });
  await page.getByRole("button", { name: "保存来源记录" }).click();
  await saveFooter(page);
  project = await waitForStored(page, (value) => value.sources.some((item) => item.name === "E2E-能源资料-明确模拟.xlsx"));
  const uploadedSource = project.sources.find((source) => source.name === "E2E-能源资料-明确模拟.xlsx");
  const uploadedFiles = await readProjectFiles(page, project.projectId);
  record(project.sources.length === sourceCountBefore + 1 && uploadedSource?.fileId && uploadedFiles.some((file) => file.fileId === uploadedSource.fileId), "STEP4-UPLOAD-BYTES", "Step 4 文件入口保存来源元数据和真实文件字节");
  record(!project.facts.some((item) => item.sourceReferences.some((reference) => reference.sourceId === project.sources.find((source) => source.name === "E2E-能源资料-明确模拟.xlsx")?.id)), "STEP4-UPLOAD-NO-FALSE-DATA", "未解析文件不伪造事实或抽取结果");
  finding("High", "GAP-S4-PARSER", "Step 4 尚无文件解析和事实抽取", "文件字节已在 IndexedDB 中保存，但 parserStatus 保持 not-started，且不会生成事实。", "链路 C 可保留原始文件，但仍不能从文件内容抽取真实指标。", "下一阶段建设解析、抽取、人工确认和来源版本管理。");

  await openStep(page, 5);
  record((await page.locator("body").innerText()).includes(`当前企业：${projectLabel}`), "STEP5-UPSTREAM-ENTERPRISE", "Step 5 读取 Step 1 最新企业信息");
  const editor = page.getByRole("textbox", { name: /正文$/ }).first();
  const blockTitle = await editor.getAttribute("aria-label");
  const existingText = await editor.innerText();
  const e2eSentence = "E2E 正文保存与预览同步验证。";
  await editor.fill(`${existingText}\n${e2eSentence}`);
  const beforeAi = await editor.innerText();
  await page.getByRole("button", { name: "Mock AI" }).click();
  const aiDialog = page.getByRole("dialog");
  await aiDialog.waitFor();
  await aiDialog.getByRole("button", { name: /生成|重新生成/, exact: true }).click();
  await page.getByText(/Mock AI|本地规则/).last().waitFor({ timeout: 10_000 }).catch(() => null);
  await aiDialog.getByRole("button", { name: /关闭/ }).click();
  record(await editor.innerText() === beforeAi, "STEP5-MOCK-NO-OVERWRITE", "Mock AI 未经接受不覆盖用户正文");
  await page.getByRole("button", { name: "保存报告草稿" }).click();
  await waitForStored(page, (value) => value.writing.chapters.some((chapter) => chapter.blocks.some((block) => block.html?.includes(e2eSentence))));
  await reloadProject(page);
  record(await page.getByRole("textbox", { name: blockTitle }).innerText().then((text) => text.includes(e2eSentence)).catch(() => false), "STEP5-REFRESH", "Step 5 正文修改保存并刷新恢复");

  await openStep(page, 6);
  await page.getByRole("button", { name: "连续阅读" }).click();
  await page.waitForTimeout(300);
  record(await page.getByText(projectLabel, { exact: false }).first().isVisible(), "STEP6-DYNAMIC-COVER", "Step 6 动态显示 Step 1 企业名称");
  record(await page.getByText("2026", { exact: false }).first().isVisible(), "STEP6-DYNAMIC-YEAR", "Step 6 动态显示 Step 1 报告年度");
  record(await page.getByText(renamedTitle, { exact: false }).first().isVisible(), "CHAIN-D-STEP6", "Step 3 目录顺序和标题进入 Step 6");
  record(await page.getByText(e2eSentence, { exact: false }).first().isVisible(), "STEP5-6-SYNC", "Step 5 正文同步 Step 6 预览");
  const pageCountBeforeLayout = await page.locator("[data-report-page]").count();
  await page.getByLabel("正文行距").fill("2.2");
  await page.getByLabel("正文字号").fill("14");
  await page.waitForTimeout(300);
  const overflow = await page.locator(".report-page-body").evaluateAll((items) => items.map((item) => ({ page: item.closest("[data-report-page]")?.getAttribute("data-report-page"), overflow: item.scrollHeight - item.clientHeight })).filter((item) => item.overflow > 2));
  record(overflow.length === 0, "STEP6-NO-SILENT-CLIP", "字体和行距变化后正文无静默裁切", JSON.stringify(overflow));
  record(await page.locator("[data-report-page]").count() >= pageCountBeforeLayout, "STEP6-REPAGINATE", "字体和行距变化触发安全重分页");
  await page.getByRole("button", { name: "切换正式阅读" }).click();
  const formalText = await page.locator(".report-page").allInnerTexts();
  record(!/blockId:|编辑原文|内部待办|Mock AI|明确模拟/.test(formalText.join("\n")), "STEP6-FORMAL-CLEAN", "正式阅读不显示内部编辑标识或 Mock 说明");
  await page.screenshot({ path: path.join(evidenceDir, "step6-formal-e2e.png"), fullPage: false });
  await page.getByRole("button", { name: "返回编辑预览" }).click();

  project = await stored(page);
  const integrityResult = integrity(project);
  record(integrityResult.duplicates.length === 0, "DATA-DUPLICATES", "统一数据中无重复 ID", integrityResult.duplicates.join("；"));
  record(integrityResult.orphanRequirements.length === 0, "DATA-REQ-ORPHANS", "正文无失效披露映射", integrityResult.orphanRequirements.join("；"));
  record(integrityResult.orphanFacts.length === 0, "DATA-FACT-ORPHANS", "正文无失效事实引用", integrityResult.orphanFacts.join("；"));
  record(integrityResult.orphanCharts.length === 0, "DATA-CHART-ORPHANS", "图表无失效引用", integrityResult.orphanCharts.join("；"));
  record(integrityResult.sectionGaps.length === 0 && integrityResult.inactiveChapters.length === 0, "DATA-SECTIONS", "Step 3/5 章节引用完整", JSON.stringify({ sectionGaps: integrityResult.sectionGaps, inactiveChapters: integrityResult.inactiveChapters }));
  record(integrityResult.badRevisions.length === 0, "DATA-REVISIONS", "事实、正文块和指标修订号有效", integrityResult.badRevisions.join("；"));
  record(integrityResult.orphanSources.length === 0, "DATA-SOURCE-ORPHANS", "来源引用均指向统一 sources 集合", integrityResult.orphanSources.join("；"));
  if (integrityResult.orphanSources.length) finding("Medium", "DATA-ORPHAN-SOURCES", "种子事实/资源引用了 sources 中不存在的 sourceId", integrityResult.orphanSources.join("；"), "来源卡片可展示嵌入快照，但无法从统一来源集合管理或撤销这些来源。", "统一 Source 实体，迁移现有引用并在保存校验中覆盖 facts/resources/blocks。");

  // 五种图表采用明确模拟观测，逐一在真实 Step 6 画布中渲染；不会作为正式披露成果。
  const chartBlock = project.writing.chapters.flatMap((chapter) => chapter.blocks.map((block) => ({ chapter, block }))).find((item) => item.block.kind === "chart");
  if (chartBlock) {
    const chartObservationIds = {
      bar: ["mock-observation-renewable-2025", "mock-observation-other-2025"],
      line: ["mock-observation-total-2023", "mock-observation-total-2024", "mock-observation-total-2025"],
      "stacked-bar": ["mock-observation-renewable-2024", "mock-observation-other-2024", "mock-observation-renewable-2025", "mock-observation-other-2025"],
      pie: ["mock-observation-renewable-2025", "mock-observation-other-2025"],
      kpi: ["mock-observation-total-2025"],
    };
    for (const type of Object.keys(chartFixtures)) {
      await mutateProject(page, (value, { type, observationIds, blockId, chapterId }) => {
        const items = observationIds.map((id) => value.presentation.observations.find((item) => item.observationId === id)).filter(Boolean);
        value.presentation.preview.mode = "continuous";
        value.presentation.preview.readingMode = "editing";
        value.presentation.charts = [{
          chartId: `chart-e2e-${type}`, blockId, chapterId, metricObservationIds: items.map((item) => item.observationId),
          observationSnapshots: items.map(({ observationId, metricDefinitionId, metricName, categoryLabel, seriesName, compositionGroupId, value, unit, reportingPeriod, reportingBoundary, boundaryStatus, sourceConfirmationStatus, comparabilityStatus, revision, sourceReferences, sampleKind, sampleLabel }) => ({ observationId, metricDefinitionId, metricName, categoryLabel, seriesName, compositionGroupId, value, unit, reportingPeriod, reportingBoundary, boundaryStatus, sourceConfirmationStatus, comparabilityStatus, revision, sourceReferences, sampleKind, sampleLabel })),
          type, title: `E2E ${type}`, colors: ["#176b52", "#5aa17d", "#d2a247"], showLegend: true, showDataLabels: true, precision: 1, unit: "MWh", caption: "明确模拟数据，仅用于 E2E 图表渲染验收。", status: "已确认", layoutReviewStatus: "有效", validationIssues: [], validatedAt: new Date().toISOString(), usesMockData: true, revision: 1, updatedAt: new Date().toISOString(),
        }];
      }, { type, observationIds: chartObservationIds[type], blockId: chartBlock.block.id, chapterId: chartBlock.chapter.id });
      await reloadProject(page);
      const renderedChart = page.locator(`[data-chart-type="${type}"]`);
      await renderedChart.first().waitFor({ state: "attached", timeout: 10_000 }).catch(() => null);
      const visible = await renderedChart.count() > 0;
      record(visible, `CHART-RENDER-${type}`, `${type} 在 Step 6 真实画布渲染`);
    }
  } else {
    record(false, "CHART-BLOCK-MISSING", "Step 5 存在图表占位供 Step 6 配置");
  }

  await openStep(page, 7);
  await page.getByRole("button", { name: "开始全面检查" }).click();
  await page.getByText(/确定性规则检查已完成/).waitFor({ timeout: 20_000 });
  project = await stored(page);
  const ruleIds = new Set(project.quality.issues.map((item) => item.ruleId));
  record(project.quality.runs.length >= 2, "STEP7-RECHECK", "修订后可重新执行全面检查并保留运行历史");
  record(project.quality.issues.some((item) => item.status !== "已复检解决"), "STEP7-UNRESOLVED-PRESERVED", "未解决问题未在复检时消失");
  record(project.quality.issues.some((item) => item.severity === "阻断") ? project.quality.readiness !== "可提交定稿审核" : true, "STEP7-BLOCKER-GATE", "阻断问题不能放行 Step 8 Gate");
  record(["DISC", "SRC", "WRITE"].every((prefix) => [...ruleIds].some((id) => id.startsWith(prefix))), "STEP7-CURRENT-FINDINGS", "当前 E2E 数据真实触发披露、来源和 Writing Policy 问题", [...ruleIds].join(","));

  await openStep(page, 8);
  record(await page.getByText("定稿门禁未通过").isVisible(), "STEP8-BLOCKED", "Step 7 Gate 未通过时禁止定稿");
  record(await page.getByRole("button", { name: "确认并创建新定稿版本" }).isDisabled(), "STEP8-BUTTON-DISABLED", "定稿按钮处于禁用状态");

  // 持久化：刷新、关闭重开、跨步骤往返。
  const revisionBeforeReopen = project.revision;
  await reloadProject(page);
  await openStep(page, 3);
  await openStep(page, 8);
  const reopened = await stored(page);
  record(reopened.enterprise.name === projectLabel && reopened.revision === revisionBeforeReopen, "STORAGE-REOPEN", "刷新、关闭式重载和跨步骤往返保持数据");

  // 乐观并发冲突：第二页持有旧 revision，第一页先保存。
  const stalePage = await context.newPage();
  await openStep(stalePage, 1);
  await page.goto(`${baseUrl}/reports/hualan-2025/step/1`, { waitUntil: "networkidle" });
  await waitForProjectReady(page);
  await page.getByLabel("报告联系人姓名").fill("E2E Page A");
  await page.getByRole("button", { name: "保存基础信息" }).click();
  const pageAProject = await waitForStored(page, (value) => value.enterprise.reportingContact.name === "E2E Page A");
  await stalePage.getByLabel("报告联系人部门").fill("E2E Page B stale write");
  await stalePage.getByRole("button", { name: "保存基础信息" }).click();
  await stalePage.getByText(/另一个页面更新|保存冲突/).waitFor({ timeout: 10_000 });
  const afterConflict = await stored(page);
  record(afterConflict.enterprise.reportingContact.name === "E2E Page A" && afterConflict.revision === pageAProject.revision, "STORAGE-CONFLICT", "并发旧页面保存被明确拦截且未覆盖新数据");
  await stalePage.close();

  // 旧 schema 加法迁移：删除后续步骤状态，再打开保存，正文和历史来源必须保留。
  const retainedSourceIds = project.sources.map((item) => item.id);
  await mutateProject(page, (value) => {
    delete value.presentation;
    delete value.quality;
    delete value.finalization;
  });
  await reloadProject(page);
  await page.getByRole("button", { name: /保存基础信息|基础信息已保存/ }).click();
  project = await waitForStored(page, (value) => Boolean(value.presentation && value.quality && value.finalization));
  record(project.writing.chapters.some((chapter) => chapter.blocks.some((block) => block.html?.includes(e2eSentence))) && retainedSourceIds.every((id) => project.sources.some((item) => item.id === id)), "STORAGE-MIGRATION", "旧 schema 加法迁移保留正文与来源记录");

  // 容量上限：模拟 StorageManager 无剩余空间，保存必须提示且不得覆盖快照。
  await page.addInitScript(() => {
    if (navigator.storage) Object.defineProperty(navigator.storage, "estimate", { configurable: true, value: async () => ({ usage: 10_000_000, quota: 10_000_000 }) });
  });
  await reloadProject(page, 45_000);
  const beforeCapacity = await stored(page);
  await page.getByLabel("报告联系人姓名").fill("容量测试不应落盘");
  await page.getByRole("button", { name: "保存基础信息" }).click();
  await page.getByText(/存储剩余空间不足|保存失败/).waitFor({ timeout: 15_000 });
  const afterCapacity = await stored(page);
  record(afterCapacity.revision === beforeCapacity.revision && afterCapacity.enterprise.reportingContact.name === beforeCapacity.enterprise.reportingContact.name, "STORAGE-CAPACITY", "容量不足时明确报错且不覆盖旧快照");

  record(browserErrors.length === 0, "BROWSER-ERRORS", "浏览器无未处理 console/page error", browserErrors.join(" | "));
  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    testProject: projectLabel,
    dataPolicy: "独立浏览器 context + 清空 IndexedDB/localStorage；图表数据明确标记为模拟，不作为正式披露。",
    totals: { pass: results.filter((item) => item.status === "PASS").length, fail: results.filter((item) => item.status === "FAIL").length, findings: findings.length },
    results,
    findings,
    integrity: integrityResult,
    browserErrors,
  };
  fs.writeFileSync(path.join(evidenceDir, "e2e-results.json"), `${JSON.stringify(summary, null, 2)}\n`);
  await browser.close();
  console.log(`SUMMARY pass=${summary.totals.pass} fail=${summary.totals.fail} findings=${summary.totals.findings}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
