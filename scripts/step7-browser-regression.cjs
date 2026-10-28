/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright");

const baseUrl = process.env.STEP7_BASE_URL || "http://127.0.0.1:4325";
const screenshotDir = "docs/acceptance/step7";
const storageKey = "esg:report-project:hualan-2025:v2";

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`PASS ${message}`);
}

async function storedProject(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
}

async function waitForStored(page, predicate, timeout = 8_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const project = await storedProject(page).catch(() => null);
    if (project && predicate(project)) return project;
    await page.waitForTimeout(100);
  }
  throw new Error("Timed out waiting for stored project state");
}

async function openStep(page, step, query = "") {
  await page.goto(`${baseUrl}/reports/hualan-2025/step/${step}${query}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1800, height: 1180 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const browserErrors = [];
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(`console: ${message.text()}`); });
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));

  await openStep(page, 7);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  assert(await page.getByRole("heading", { name: "报告质量与披露完整性检查" }).isVisible(), "Step 7 工作台可实际打开");
  await page.getByRole("button", { name: "开始全面检查" }).click();
  let project = await waitForStored(page, (value) => value.quality?.runs?.length === 1);
  assert(project.quality.runs[0].status === "已完成", "全面检查生成独立 QualityCheckRun");
  assert(project.quality.issues.length > 0, "确定性规则从现有项目数据生成问题，而非静态清单");
  await page.screenshot({ path: `${screenshotDir}/01-quality-workbench.png`, fullPage: true });

  await page.evaluate((key) => {
    const value = JSON.parse(localStorage.getItem(key));
    for (const chapter of value.writing.chapters) {
      for (const block of chapter.blocks) {
        block.mappings = block.mappings.filter((mapping) => mapping.requirementId !== "req-gri-403");
        if (block.kind !== "heading") block.mappings = block.mappings.filter((mapping) => mapping.requirementId !== "req-gri-302-1");
      }
    }
    const training = value.facts.find((fact) => fact.id === "fact-training-2025");
    training.revision += 1;
    training.sourceReferences = [];
    const trainingBlock = value.writing.chapters.flatMap((chapter) => chapter.blocks).find((block) => block.id === "section-5-training");
    trainingBlock.html = trainingBlock.html.replace("32.6", "99.9");
    value.facts.push({
      ...structuredClone(training),
      id: "fact-training-2024-different-boundary",
      value: "77.7",
      period: "2024年度",
      reportingBoundary: "独立测试边界（与 2025 年事实不同）",
      revision: 1,
      sourceReferences: [{ id: "test-ref-different-scope", sourceId: "test-source", fileName: "独立测试数据.csv", locator: "A2", excerpt: "仅用于不可比口径回归测试" }],
    });
    const chartBlock = value.writing.chapters.flatMap((chapter) => chapter.blocks).find((block) => block.kind === "chart");
    const observation = value.presentation.observations.find((item) => item.sampleKind === "明确模拟样本");
    value.presentation.charts = [{
      chartId: "chart-step7-regression",
      blockId: chartBlock.id,
      chapterId: chartBlock.chapterId,
      metricObservationIds: [observation.observationId],
      observationSnapshots: [],
      type: "bar",
      title: "质量检查独立测试图表",
      colors: ["#176b52"],
      showLegend: true,
      showDataLabels: true,
      precision: 0,
      unit: observation.unit,
      caption: "独立测试数据，不代表企业绩效。",
      status: "需更新",
      layoutReviewStatus: "待复核",
      changeNote: "独立回归测试：指标修订发生变化。",
      validationIssues: [],
      usesMockData: true,
      revision: 2,
      updatedAt: new Date().toISOString(),
    }];
    localStorage.setItem(key, JSON.stringify(value));
  }, storageKey);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "开始全面检查" }).click();
  project = await waitForStored(page, (value) => value.quality?.runs?.length === 2);
  const active = project.quality.issues.filter((issue) => issue.status !== "已复检解决");
  assert(active.some((issue) => issue.ruleId === "DISC-001" && issue.requirementIds.includes("req-gri-403")), "移除已确认适用要求的映射后发现未覆盖问题");
  assert(active.some((issue) => issue.ruleId === "DISC-002" && issue.requirementIds.includes("req-gri-302-1")), "仅有标题映射时不判定为充分披露");
  assert(active.some((issue) => issue.ruleId === "SRC-001" && issue.factIds.includes("fact-training-2025") && issue.title.includes("版本")), "修改已引用事实后识别旧引用版本");
  assert(active.some((issue) => issue.ruleId === "SRC-002" && issue.factIds.includes("fact-training-2025")), "删除事实来源后发现来源定位问题");
  assert(active.some((issue) => issue.ruleId === "DATA-002" && issue.blockId === "section-5-training"), "正文指标与同口径已确认事实不一致时发现冲突");
  assert(!active.some((issue) => issue.ruleId === "DATA-001" && issue.factIds.includes("fact-training-2024-different-boundary")), "不同统计期间或边界的数据未被错误判为冲突");
  assert(active.some((issue) => issue.ruleId === "DATA-003" && issue.chartIds.includes("chart-step7-regression")), "图表处于需更新时生成对应问题");
  assert(active.some((issue) => issue.ruleId === "WRITE-001" && issue.title.includes("高度重视")), "Writing Policy 规则识别空泛表述并生成建议");
  assert(active.some((issue) => issue.ruleId === "WRITE-003"), "未解决内部待办和占位信息被发现");

  await page.getByRole("button", { name: /披露完整性/ }).first().click();
  await page.locator('[aria-label="质量问题清单"] button').first().click();
  await page.screenshot({ path: `${screenshotDir}/02-disclosure-completeness.png`, fullPage: true });
  await page.getByRole("button", { name: /数据一致性/ }).first().click();
  await page.locator('[aria-label="质量问题清单"] button').first().click();
  await page.screenshot({ path: `${screenshotDir}/03-fact-data-consistency.png`, fullPage: true });
  await page.getByRole("button", { name: /文字与 Writing Policy/ }).first().click();
  await page.locator('[aria-label="质量问题清单"] button').filter({ hasText: "高度重视" }).first().click();
  await page.screenshot({ path: `${screenshotDir}/04-writing-policy.png`, fullPage: true });

  await page.getByRole("button", { name: /事实与来源/ }).first().click();
  await page.locator('[aria-label="质量问题清单"] button').filter({ hasText: "引用版本已过期" }).first().click();
  await page.screenshot({ path: `${screenshotDir}/05-issue-detail-location.png`, fullPage: true });
  await page.getByRole("button", { name: "定位问题" }).click();
  await page.waitForURL(/\/step\/5\?.*blockId=section-5-training/);
  assert(page.url().includes("chapterId=section-5") && page.url().includes("blockId=section-5-training"), "问题可通过稳定 ID 定位到具体 Step、章节和内容块");
  await openStep(page, 7);

  await page.getByRole("button", { name: /文字与 Writing Policy/ }).first().click();
  await page.locator('[aria-label="质量问题清单"] button').filter({ hasText: "高度重视" }).first().click();
  await page.getByLabel("问题处理说明").fill("该表述将在编辑阶段改为有来源的具体行动，本次仅记录验收例外。 ");
  await page.getByRole("button", { name: "接受例外" }).click();
  project = await waitForStored(page, (value) => value.quality.issues.some((issue) => issue.title.includes("高度重视") && issue.status === "已接受例外"));
  assert(project.quality.actions.some((action) => action.action === "接受例外" && action.note.includes("具体行动")), "接受例外强制保存理由和人工处理记录");
  await page.reload({ waitUntil: "networkidle" });
  project = await storedProject(page);
  assert(project.quality.issues.some((issue) => issue.title.includes("高度重视") && issue.status === "已接受例外"), "刷新后恢复问题状态、例外理由和检查历史");

  await page.evaluate((key) => {
    const value = JSON.parse(localStorage.getItem(key));
    for (const block of value.writing.chapters.flatMap((chapter) => chapter.blocks)) block.html = block.html.replaceAll("高度重视", "重视");
    const issue = value.quality.issues.find((item) => item.title.includes("高度重视"));
    issue.status = "待复检";
    value.quality.stale = true;
    localStorage.setItem(key, JSON.stringify(value));
  }, storageKey);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "重新检查已修改项" }).click();
  project = await waitForStored(page, (value) => value.quality.issues.some((issue) => issue.title.includes("高度重视") && issue.status === "已复检解决"));
  assert(project.quality.actions.some((action) => action.action === "系统复检解决"), "用户修正后规则复检通过，且不把人工已处理直接视为通过");
  await page.getByLabel("按处理状态筛选").selectOption({ label: "已复检解决" });
  await page.screenshot({ path: `${screenshotDir}/06-fix-and-recheck.png`, fullPage: true });

  await openStep(page, 1);
  await page.getByLabel("企业全称").fill("华澜新材料股份有限公司（上游变更测试）");
  await page.getByRole("button", { name: "保存基础信息" }).click();
  project = await waitForStored(page, (value) => value.quality?.stale === true);
  assert(project.quality.issues.some((issue) => issue.status === "待复检"), "Step 1 上游内容变化后旧检查结果标记待复检");
  await openStep(page, 7);
  assert(await page.getByText("上游已变化 · 待复检").isVisible(), "工作台明确提示上游版本变化");

  const smokeHeadings = new Map([
    [1, "创建报告与企业基础画像"], [2, "ESG 实质性议题评估"], [3, "构建披露框架与报告大纲"],
    [4, "ESG 资料收集、汇总与规整"], [5, "报告内容生成与编辑"], [6, "数据可视化、版式与整本报告预览"],
  ]);
  for (const [step, heading] of smokeHeadings) {
    await openStep(page, step);
    assert(await page.getByRole("heading", { name: heading }).first().isVisible(), `Step ${step} 既有页面回归可打开`);
  }

  project = await storedProject(page);
  const richBlock = project.writing.chapters.flatMap((chapter) => chapter.blocks).find((block) => block.id === "section-5-training");
  richBlock.html = `<p><strong>${Array.from({ length: 80 }, () => "加粗保真。").join("")}</strong><a href="https://example.com/evidence">链接保真</a></p><ul>${Array.from({ length: 45 }, (_, index) => `<li><em>列表保真-${index + 1}</em></li>`).join("")}</ul>`;
  richBlock.pendingKind = undefined;
  richBlock.resolved = true;
  project.presentation.layout.bodyFontSize = 14;
  project.presentation.layout.lineHeight = 2.2;
  project.presentation.layout.margins.top = 28;
  project.presentation.layout.margins.bottom = 28;
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: storageKey, value: project });
  await openStep(page, 6);
  const richResult = await page.evaluate(() => {
    const fragments = [...document.querySelectorAll('[data-preview-block-id="section-5-training"]')];
    const text = fragments.map((element) => element.textContent || "").join("");
    const occurrences = (value) => text.split(value).length - 1;
    const bodies = [...document.querySelectorAll(".report-page-body")];
    return {
      fragmentCount: fragments.length,
      strongCount: fragments.reduce((count, element) => count + element.querySelectorAll("strong").length, 0),
      linkHref: fragments.flatMap((element) => [...element.querySelectorAll("a")]).map((link) => link.getAttribute("href"))[0],
      listMarkerCount: occurrences("列表保真-"),
      boldMarkerCount: occurrences("加粗保真"),
      maxOverflow: Math.max(0, ...bodies.map((body) => body.scrollHeight - body.clientHeight)),
    };
  });
  console.log("RICH_RESULT", JSON.stringify(richResult));
  assert(richResult.fragmentCount > 1, "长段落按版面安全拆分为多个预览片段");
  assert(richResult.boldMarkerCount === 80 && richResult.strongCount > 1, "跨页后完整保留加粗文本和原文内容");
  assert(richResult.linkHref === "https://example.com/evidence", "跨页富文本保留经过安全校验的链接");
  assert(richResult.listMarkerCount === 45, "跨页后完整保留列表内容");
  assert(richResult.maxOverflow <= 2, "最大字号、行距和页边距下没有静默裁切正文");

  const legacyContext = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const legacyPage = await legacyContext.newPage();
  const legacy = structuredClone(project);
  const originalChapterCount = legacy.writing.chapters.length;
  delete legacy.quality;
  legacy.migrations = legacy.migrations.filter((item) => item.id !== "migration-quality-check-v1");
  await legacyPage.goto(baseUrl, { waitUntil: "networkidle" });
  await legacyPage.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: storageKey, value: legacy });
  await openStep(legacyPage, 7);
  assert(await legacyPage.getByRole("heading", { name: "报告质量与披露完整性检查" }).isVisible(), "缺少 Step 7 状态的历史项目可兼容打开");
  await legacyPage.getByRole("button", { name: "开始全面检查" }).click();
  const migrated = await waitForStored(legacyPage, (value) => value.quality?.runs?.length === 1);
  assert(migrated.writing.chapters.length === originalChapterCount && migrated.migrations.some((item) => item.id === "migration-quality-check-v1"), "历史项目迁移保留 Step 1–6 数据并记录迁移");
  await legacyContext.close();

  assert(browserErrors.length === 0, `浏览器无 console/page error（${browserErrors.length}）`);
  console.log(`RESULT quality_runs=${project.quality.runs.length} issues=${project.quality.issues.length} screenshots=6`);
  await context.close();
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
