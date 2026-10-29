/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright");

const baseUrl = process.env.STEP7_BASE_URL || "http://127.0.0.1:4325";
const storageKey = "esg:report-project:hualan-2025:v2";

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`PASS ${message}`);
}

async function stored(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
}

async function waitStored(page, predicate, timeout = 10_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const project = await stored(page).catch(() => null);
    if (project && predicate(project)) return project;
    await page.waitForTimeout(100);
  }
  throw new Error("Timed out waiting for project storage");
}

async function waitForProjectReady(page) {
  await page.locator('[aria-busy="false"]').first().waitFor({ state: "attached", timeout: 15000 });
}

async function reloadProject(page) {
  await page.reload({ waitUntil: "networkidle" });
  await waitForProjectReady(page);
}

async function openStep(page, step) {
  await page.goto(`${baseUrl}/reports/hualan-2025/step/${step}`, { waitUntil: "networkidle" });
  await waitForProjectReady(page);
}

async function fresh(page) {
  await openStep(page, 7);
  await page.evaluate(() => localStorage.clear());
  await reloadProject(page);
  return null;
}

async function run(page, buttonName, expectedRuns) {
  await page.getByRole("button", { name: buttonName }).click();
  return waitStored(page, (project) => project.quality?.runs?.length === expectedRuns);
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1800, height: 1180 } });
  const page = await context.newPage();
  const browserErrors = [];
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  // A：全面检查失效后，局部检查不得恢复全局有效性。
  await fresh(page);
  let project = await run(page, "开始全面检查", 1);
  assert(project.quality.fullCheck?.valid === true && project.quality.stale === false, "A1 全面检查建立有效的全局检查记录");
  await openStep(page, 1);
  const enterpriseInput = page.getByLabel("企业全称");
  await enterpriseInput.fill(`${await enterpriseInput.inputValue()}（Step 7.1 上游变更）`);
  await page.getByRole("button", { name: "保存基础信息" }).click();
  project = await waitStored(page, (value) => value.quality?.fullCheck?.valid === false && value.quality?.stale === true);
  assert(project.quality.invalidations.length === 1, "A2 上游输入变化生成失效记录并保留全面检查历史");
  await openStep(page, 7);
  project = await run(page, "检查当前章节", 2);
  assert(project.quality.fullCheck?.valid === false && project.quality.stale === true, "A3 局部章节检查没有清除整本报告 stale 状态");
  assert(project.quality.readiness !== "可提交定稿审核", "A4 局部检查后仍不可提交定稿审核");

  // B：没有全面检查时，局部检查不构成 Step 8 放行条件。
  await fresh(page);
  project = await run(page, "检查当前章节", 1);
  assert(!project.quality.fullCheck, "B1 局部检查不会伪造全面检查记录");
  assert(project.quality.readiness === "未检查", "B2 未全面检查时保持未检查状态");

  // C：SRC-002 按事实聚合，同时保留三个正文块位置。
  await fresh(page);
  await run(page, "开始全面检查", 1);
  await page.evaluate((key) => {
    const value = JSON.parse(localStorage.getItem(key));
    const fact = value.facts.find((item) => item.id === "fact-training-2025");
    fact.sourceReferences = [];
    const allBlocks = value.writing.chapters.flatMap((chapter) => chapter.blocks);
    for (const block of allBlocks) block.citations = block.citations.filter((citation) => citation.factId !== fact.id);
    const chapterBlocks = value.writing.chapters
      .map((chapter) => chapter.blocks.find((block) => ["paragraph", "case", "table"].includes(block.kind)))
      .filter(Boolean);
    const blocks = [...chapterBlocks];
    for (const block of allBlocks.filter((item) => ["paragraph", "case", "table"].includes(item.kind))) {
      if (blocks.length >= 3) break;
      if (!blocks.some((item) => item.id === block.id)) blocks.push(block);
    }
    for (const block of blocks) {
      block.citations = [{ factId: fact.id, factRevision: fact.revision }];
    }
    localStorage.setItem(key, JSON.stringify(value));
  }, storageKey);
  await reloadProject(page);
  project = await run(page, "开始全面检查", 2);
  const sourceIssues = project.quality.issues.filter((issue) => issue.ruleId === "SRC-002" && issue.factIds.includes("fact-training-2025"));
  assert(sourceIssues.length === 1, "C1 同一缺陷事实只生成一个 SRC-002 稳定问题身份");
  console.log("C_LOCATIONS", JSON.stringify(sourceIssues[0].locations));
  assert(new Set(sourceIssues[0].locations.map((item) => item.blockId).filter(Boolean)).size === 3, "C2 聚合问题保留三个引用正文块的位置");
  assert(new Set(project.quality.issues.map((issue) => issue.issueId)).size === project.quality.issues.length, "C3 同一次检查没有重复 issueId");
  const removedLocation = sourceIssues[0].locations[0];
  await page.evaluate(({ key, blockId }) => {
    const value = JSON.parse(localStorage.getItem(key));
    const block = value.writing.chapters.flatMap((chapter) => chapter.blocks).find((item) => item.id === blockId);
    block.citations = block.citations.filter((citation) => citation.factId !== "fact-training-2025");
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: storageKey, blockId: removedLocation.blockId });
  await reloadProject(page);
  await page.getByLabel("按章节筛选").selectOption(removedLocation.chapterId);
  project = await run(page, "检查当前章节", 3);
  const partiallyUpdatedSource = project.quality.issues.find((issue) => issue.ruleId === "SRC-002" && issue.factIds.includes("fact-training-2025"));
  assert(partiallyUpdatedSource?.status !== "已复检解决" && partiallyUpdatedSource?.locations.length === 2, "C4 章节检查只移除实际修复位置，不会误解决其他章节仍存在的聚合问题");

  // D：披露要求 reviewStatus 变化后，历史覆盖不能继续有效。
  await fresh(page);
  await run(page, "开始全面检查", 1);
  await page.evaluate((key) => {
    const value = JSON.parse(localStorage.getItem(key));
    const requirement = value.disclosureRequirements.find((item) => item.id === "req-gri-302-1");
    requirement.applicability = "适用";
    requirement.userConfirmed = true;
    requirement.reviewStatus = "有效";
    for (const candidate of value.writing.chapters.flatMap((item) => item.blocks)) {
      candidate.mappings = candidate.mappings.filter((mapping) => mapping.requirementId !== requirement.id);
    }
    const chapter = value.writing.chapters.find((item) => item.id === "section-5") || value.writing.chapters[0];
    const block = chapter.blocks.find((item) => item.kind === "paragraph") || chapter.blocks.find((item) => item.kind !== "heading");
    block.html = "<p>本段为披露覆盖状态回归测试，内容具有明确的人工审校状态。</p>";
    block.pendingKind = undefined;
    block.resolved = true;
    block.reviewStatus = "已审校";
    block.mappings = [...block.mappings.filter((item) => item.requirementId !== requirement.id), { requirementId: requirement.id, coverage: "已覆盖" }];
    localStorage.setItem(key, JSON.stringify(value));
  }, storageKey);
  await reloadProject(page);
  project = await run(page, "开始全面检查", 2);
  assert(project.quality.coverage.find((item) => item.requirementId === "req-gri-302-1")?.status === "已核验覆盖", "D1 有效要求和人工审校正文可形成已核验覆盖记录");
  await page.evaluate((key) => {
    const value = JSON.parse(localStorage.getItem(key));
    const requirement = value.disclosureRequirements.find((item) => item.id === "req-gri-302-1");
    requirement.reviewStatus = "待复核";
    requirement.revision += 1;
    localStorage.setItem(key, JSON.stringify(value));
  }, storageKey);
  await reloadProject(page);
  assert(await page.getByText("上游已变化 · 待复检").isVisible(), "D2 输入指纹变化即时使全面检查失效");
  project = await run(page, "开始全面检查", 3);
  assert(project.quality.coverage.find((item) => item.requirementId === "req-gri-302-1")?.status === "待核验", "D3 reviewStatus 待复核后覆盖状态失效为待核验");

  // E/F：解决记录不重复，重新出现时重新打开并保留历史。
  await fresh(page);
  project = await run(page, "开始全面检查", 1);
  const vague = project.quality.issues.find((issue) => issue.ruleId === "WRITE-001" && issue.title.includes("高度重视"));
  assert(Boolean(vague), "E0 找到可复现的 Writing Policy 问题");
  const vagueBlockId = vague.blockId;
  await page.evaluate(({ key, blockId }) => {
    const value = JSON.parse(localStorage.getItem(key));
    const block = value.writing.chapters.flatMap((chapter) => chapter.blocks).find((item) => item.id === blockId);
    block.html = block.html.replaceAll("高度重视", "重视");
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: storageKey, blockId: vagueBlockId });
  await reloadProject(page);
  project = await run(page, "开始全面检查", 2);
  let resolvedActions = project.quality.actions.filter((action) => action.issueId === vague.issueId && action.action === "系统复检解决");
  assert(resolvedActions.length === 1, "E1 首次复检解决只写入一条系统解决记录");
  project = await run(page, "开始全面检查", 3);
  resolvedActions = project.quality.actions.filter((action) => action.issueId === vague.issueId && action.action === "系统复检解决");
  assert(resolvedActions.length === 1, "E2 重复全面检查不新增重复解决记录");
  await page.evaluate(({ key, blockId }) => {
    const value = JSON.parse(localStorage.getItem(key));
    const block = value.writing.chapters.flatMap((chapter) => chapter.blocks).find((item) => item.id === blockId);
    block.html = `${block.html}<p>本公司高度重视相关工作。</p>`;
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: storageKey, blockId: vagueBlockId });
  await reloadProject(page);
  project = await run(page, "开始全面检查", 4);
  const reopened = project.quality.issues.find((issue) => issue.issueId === vague.issueId);
  assert(reopened?.status === "待处理", "F1 已解决问题重新出现时恢复待处理状态");
  assert(project.quality.actions.some((action) => action.issueId === vague.issueId && action.action === "问题重新打开"), "F2 重新打开动作保留在处理历史中");
  assert(project.quality.actions.some((action) => action.issueId === vague.issueId && action.action === "系统复检解决"), "F3 原解决记录未被覆盖");
  await page.evaluate(({ key, issueId, blockId }) => {
    const value = JSON.parse(localStorage.getItem(key));
    const issue = value.quality.issues.find((item) => item.issueId === issueId);
    issue.status = "已接受例外";
    issue.exceptionReason = "旧输入下的人工例外，仅用于状态回归测试。";
    const block = value.writing.chapters.flatMap((chapter) => chapter.blocks).find((item) => item.id === blockId);
    block.html = block.html.replace("高度重视相关工作", "高度重视并持续推进相关工作");
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: storageKey, issueId: vague.issueId, blockId: vagueBlockId });
  await reloadProject(page);
  project = await run(page, "开始全面检查", 5);
  assert(project.quality.issues.find((issue) => issue.issueId === vague.issueId)?.status === "待处理", "F4 已接受例外的输入变化后需要重新处理");
  assert(project.quality.actions.some((action) => action.issueId === vague.issueId && action.action === "例外失效重新确认"), "F5 例外失效动作保留在处理历史中");

  // G：旧 QualityCheckState v1 兼容迁移，且 Step 1-7 页面仍可打开。
  const chapterCount = project.writing.chapters.length;
  const runCount = project.quality.runs.length;
  await page.evaluate((key) => {
    const value = JSON.parse(localStorage.getItem(key));
    value.quality.schemaVersion = 1;
    delete value.quality.fullCheck;
    delete value.quality.invalidations;
    for (const issue of value.quality.issues) delete issue.locations;
    for (const run of value.quality.runs) { delete run.inputFingerprint; delete run.ruleSetFingerprint; }
    for (const coverage of value.quality.coverage) { delete coverage.requirementRevision; delete coverage.requirementFingerprint; }
    value.migrations = value.migrations.filter((item) => item.id !== "migration-quality-check-v2");
    localStorage.setItem(key, JSON.stringify(value));
  }, storageKey);
  await reloadProject(page);
  project = await run(page, "开始全面检查", runCount + 1);
  assert(project.quality.schemaVersion === 2 && project.quality.invalidations, "G1 QualityCheckState v1 已迁移到 v2");
  assert(project.writing.chapters.length === chapterCount && project.quality.runs.length === runCount + 1, "G2 迁移保留章节和历史检查运行");
  assert(project.migrations.some((item) => item.id === "migration-quality-check-v2"), "G3 项目保存迁移审计记录");

  const headings = new Map([
    [1, "创建报告与企业基础画像"], [2, "ESG 实质性议题评估"], [3, "构建披露框架与报告大纲"],
    [4, "ESG 资料收集、汇总与规整"], [5, "报告内容生成与编辑"], [6, "数据可视化、版式与整本报告预览"],
    [7, "报告质量与披露完整性检查"],
  ]);
  for (const [step, heading] of headings) {
    await openStep(page, step);
    assert(await page.getByRole("heading", { name: heading }).first().isVisible(), `G4 Step ${step} 页面回归可打开`);
  }
  await openStep(page, 7);
  project = await stored(page);
  assert(project.quality.schemaVersion === 2 && project.quality.runs.length === runCount + 1, "G5 刷新后检查状态、历史和迁移结果正常恢复");

  await page.screenshot({ path: "docs/acceptance/step7/07-step7-1-quality-state.png", fullPage: true });
  assert(browserErrors.length === 0, `浏览器无 console/page error（${browserErrors.length}）`);
  console.log("RESULT Step 7.1 A-G passed");
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
