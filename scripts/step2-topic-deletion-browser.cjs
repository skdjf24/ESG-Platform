/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright");
const { PDFDocument } = require("pdf-lib");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");
const { readProject, readProjectFiles, writeProject } = require("./indexeddb-test-helpers.cjs");

const baseUrl = process.env.TOPIC_DELETION_BASE_URL || "http://127.0.0.1:4325";
const outputDir = process.env.TOPIC_DELETION_OUTPUT_DIR || path.resolve(__dirname, "../work/step2-topic-deletion");
const ignoreHTTPSErrors = process.env.TOPIC_DELETION_IGNORE_HTTPS_ERRORS === "1";
const sampleId = "public-preview-sample-2025";
const results = [];
const browserErrors = [];

function check(condition, id, detail) {
  results.push({ id, status: condition ? "PASS" : "FAIL", detail });
  console.log(`${condition ? "PASS" : "FAIL"} ${id} ${detail}`);
  if (!condition) throw new Error(`${id}: ${detail}`);
}

function trackErrors(page) {
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(`console: ${message.text()}`); });
  page.on("pageerror", (error) => browserErrors.push(`page: ${error.message}`));
}

function section(page, title) {
  return page.locator("section").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}

async function openStep(page, projectId, step) {
  const response = await page.goto(`${baseUrl}/reports/${encodeURIComponent(projectId)}/step/${step}`);
  if (!response?.ok()) throw new Error(`Step ${step} HTTP ${response?.status()}`);
  await page.locator('[aria-busy="false"]').first().waitFor();
}

async function saveDraft(page, projectId) {
  const before = await readProject(page, projectId);
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await page.getByRole("button", { name: "已保存", exact: true }).waitFor();
  await page.getByRole("status").filter({ hasText: /已保存项目数据/ }).waitFor();
  const after = await readProject(page, projectId);
  if (after.revision <= before.revision) throw new Error(`Save did not advance the revision for ${projectId}`);
  return after;
}

async function addCustomTopic(page, name, scored = false) {
  await page.getByRole("button", { name: "新增议题", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "新增议题" });
  await editor.getByLabel("议题名称").fill(name);
  await editor.getByLabel("ESG 类别").selectOption("G");
  if (scored) {
    await editor.getByLabel("财务重要性").fill("4.9");
    await editor.getByLabel("影响重要性").fill("4.8");
  }
  await editor.getByRole("button", { name: "保存议题" }).click();
}

async function askDelete(page, name) {
  await page.getByRole("button", { name: `编辑${name}`, exact: true }).click();
  await page.getByRole("dialog", { name: "编辑议题" }).getByRole("button", { name: "删除议题", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: `删除议题“${name}”？`, exact: true });
  await dialog.waitFor();
  return dialog;
}

async function confirmDelete(page, dialog, name) {
  await dialog.getByRole("button", { name: "确认删除", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("status").filter({ hasText: `已删除议题“${name}”` }).waitFor();
}

function content(project) {
  return project.writing.chapters.flatMap((chapter) => chapter.blocks.map(({ id, html, rows, citations }) => ({ id, html, rows, citations })));
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE || (fs.existsSync(chromium.executablePath()) ? chromium.executablePath() : "/usr/bin/chromium"),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  let fatal;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ignoreHTTPSErrors });
    const page = await context.newPage();
    trackErrors(page);
    const homepage = await page.goto(baseUrl);
    await page.getByRole("heading", { name: "尚无本地项目", exact: true }).waitFor();
    check(homepage?.status() === 200, "HTTP-ISOLATED", "首页 HTTP 200，新 Chromium Context 没有本地项目");

    await page.getByRole("button", { name: "新建报告" }).click();
    await page.locator("#report-name").fill("议题隔离验收报告");
    await page.locator("#enterprise").fill("验收乙企业");
    await page.locator("#report-year").fill("2026");
    await page.getByRole("button", { name: "创建并开始" }).click();
    await page.waitForURL(/\/reports\/[^/]+\/step\/1$/);
    await page.locator('[aria-busy="false"]').first().waitFor();
    const otherId = decodeURIComponent(new URL(page.url()).pathname.split("/")[2]);
    const otherBefore = await readProject(page, otherId);
    await page.goto(baseUrl);
    await page.getByRole("button", { name: "打开示例项目" }).click();
    await page.waitForURL(/\/reports\/public-preview-sample-2025\/step\/1$/);
    await page.locator('[aria-busy="false"]').first().waitFor();

    const pdf = await PDFDocument.create();
    pdf.addPage();
    await page.getByLabel("选择历史报告文件").setInputFiles({ name: "议题删除验收样本.pdf", mimeType: "application/pdf", buffer: Buffer.from(await pdf.save()) });
    await page.getByText(/历史报告文件已保存到本地文件仓库/).waitFor();
    const legacy = await readProject(page, sampleId);
    const uploadedFiles = await readProjectFiles(page, sampleId);
    delete legacy.projectKind;
    await writeProject(page, legacy, sampleId);
    await openStep(page, sampleId, 2);
    const energy = legacy.topics.find(({ id }) => id === "topic-energy");
    check(otherId !== sampleId && uploadedFiles.length === 1 && legacy.materiality.confirmed && legacy.facts.length > 0
      && await page.getByRole("button", { name: `编辑${energy.name}`, exact: true }).isVisible(), "LEGACY-READY", "历史格式项目有已确认评分、资料、正文和独立上传文件");

    const customName = "议题删除验收新增议题";
    const ranking = page.getByRole("list", { name: "重点议题排序" });
    const pool = section(page, "议题池与议题调整");
    const result = section(page, "结果确认");
    const total = legacy.topics.length;
    const governanceCount = legacy.topics.filter(({ category }) => category === "G").length;
    const pointCount = await page.locator(".matrix-grid .group").count();
    await addCustomTopic(page, customName, true);
    const withCustom = await saveDraft(page, sampleId);
    const custom = withCustom.topics.find(({ name }) => name === customName);
    check(Boolean(custom) && await pool.getByRole("button", { name: `全部 ${total + 1}`, exact: true }).isVisible()
      && await pool.getByRole("button", { name: `G ${governanceCount + 1}`, exact: true }).isVisible()
      && (await ranking.getByRole("listitem").first().innerText()).includes(customName), "CUSTOM-ADD-RANK", "新增已评分议题计入总数与分类，并按双评分均值排序");

    await page.getByRole("button", { name: `移出${customName}`, exact: true }).click();
    check(await page.getByRole("button", { name: `纳入${customName}`, exact: true }).isVisible()
      && !await page.getByLabel(`${customName}财务重要性`, { exact: true }).count()
      && await page.locator(".matrix-grid .group").count() === pointCount, "UNCHECK-KEEPS-POOL", "取消勾选只退出评估，池内记录仍可勾选");
    await page.getByRole("button", { name: `纳入${customName}`, exact: true }).click();
    await page.getByRole("button", { name: `编辑${customName}`, exact: true }).click();
    const editor = page.getByRole("dialog", { name: "编辑议题" });
    await editor.getByLabel("议题名称").fill("未保存的改名输入");
    await editor.getByRole("button", { name: "删除议题", exact: true }).click();
    const customDialog = page.getByRole("dialog", { name: `删除议题“${customName}”？`, exact: true });
    await customDialog.getByRole("button", { name: "取消", exact: true }).click();
    check(await editor.getByLabel("议题名称").inputValue() === "未保存的改名输入"
      && isDeepStrictEqual(await readProject(page, sampleId), withCustom), "CANCEL-UNCHANGED", "取消后保留编辑器草稿，IndexedDB 快照完全相同");
    await editor.getByRole("button", { name: "取消", exact: true }).click();

    await confirmDelete(page, await askDelete(page, customName), customName);
    const afterCustom = await readProject(page, sampleId);
    check(!afterCustom.topics.some(({ id }) => id === custom.id) && !afterCustom.materiality.includedTopicIds.includes(custom.id)
      && !await pool.getByRole("button", { name: `编辑${customName}`, exact: true }).count()
      && await pool.getByRole("button", { name: `全部 ${total}`, exact: true }).isVisible()
      && await pool.getByRole("button", { name: `G ${governanceCount}`, exact: true }).isVisible(), "CUSTOM-DELETE", "确认后新增议题消失，总数和 G 分类立即恢复");
    check(!await page.getByLabel(`${customName}财务重要性`, { exact: true }).count()
      && await page.locator(".matrix-grid .group").count() === pointCount
      && !await ranking.getByText(customName, { exact: true }).count(), "CUSTOM-ASSESSMENT-SYNC", "评分表、矩阵和重点议题排序同时去除自定义议题");
    await openStep(page, sampleId, 2);
    check(!await pool.getByRole("button", { name: `编辑${customName}`, exact: true }).count(), "CUSTOM-REFRESH", "刷新不会复活自定义议题");

    await page.getByRole("button", { name: "确认评估结果", exact: true }).click();
    await saveDraft(page, sampleId);
    await openStep(page, sampleId, 7);
    await page.getByRole("button", { name: "开始全面检查" }).click();
    await page.getByText(/确定性规则检查已完成/).waitFor();
    const beforePreset = await readProject(page, sampleId);
    check(beforePreset.quality.fullCheck?.valid === true && beforePreset.materiality.confirmed, "PRESET-BASELINE", "删除预设前重新确认评估并取得有效全面检查快照");

    await openStep(page, sampleId, 2);
    const presetDialog = await askDelete(page, energy.name);
    check(await presetDialog.getByText(/将解除 2 个大纲章节/).isVisible()
      && await presetDialog.getByText(/原评分与确认信息保留/).isVisible(), "PRESET-IMPACT", "确认框指明已评分议题的 2 个章节和评估复核范围");
    await page.screenshot({ path: path.join(outputDir, "confirm-preset.png") });
    await confirmDelete(page, presetDialog, energy.name);
    const removed = await readProject(page, sampleId);
    const energyRecord = removed.impacts.find(({ topicRemoval }) => topicRemoval?.topic.id === energy.id);
    const environmentalCount = legacy.topics.filter(({ category }) => category === "E").length;
    check(!await pool.getByRole("button", { name: `编辑${energy.name}`, exact: true }).count()
      && await pool.getByRole("button", { name: `E ${environmentalCount - 1}`, exact: true }).isVisible()
      && await pool.getByRole("button", { name: `S ${legacy.topics.filter(({ category }) => category === "S").length}`, exact: true }).isVisible()
      && await pool.getByRole("button", { name: `全部 ${total - 1}`, exact: true }).isVisible(), "PRESET-DELETE", "预设从旧项目移除，总数和 E/S/G 分类保持正确");
    check(await result.getByText("待复核", { exact: true }).isVisible()
      && !await page.getByLabel(`${energy.name}财务重要性`, { exact: true }).count()
      && !await page.locator(".matrix-grid .group").filter({ hasText: energy.name }).count()
      && !await ranking.getByText(energy.name, { exact: true }).count()
      && await page.locator(".matrix-grid .group").count() === pointCount - 1
      && removed.materiality.confirmed === false && removed.materiality.reviewStatus === "待复核", "PRESET-REVIEW", "原确认失效，评分、点位和重排名均排除已删议题");
    await page.getByRole("button", { name: "查看评估记录" }).click();
    const history = section(page, "议题删除记录");
    check(await history.getByText(energy.name, { exact: true }).isVisible()
      && await history.getByText(/财务重要性 4.2 · 影响重要性 4.5/).isVisible()
      && energyRecord?.topicRemoval.assessment.confirmedAt === beforePreset.materiality.confirmedAt, "HISTORY", "可查看删除前两项评分，保存旧评估确认时间");
    check(removed.quality.fullCheck?.runId === beforePreset.quality.fullCheck.runId
      && removed.quality.fullCheck.valid === false && removed.quality.stale
      && isDeepStrictEqual(removed.finalization, beforePreset.finalization), "QUALITY-HISTORY", "Step 7 旧检查记录保留并失效，定稿历史数据保留");
    check(["sources", "facts", "resources", "dataRequirements", "presentation"].every((key) => isDeepStrictEqual(removed[key], beforePreset[key]))
      && isDeepStrictEqual(content(removed), content(beforePreset))
      && isDeepStrictEqual(await readProjectFiles(page, sampleId), uploadedFiles), "PRESERVE-EVIDENCE", "正文、引用、原始上传文件、资料、事实和图表均保留");
    check(isDeepStrictEqual(await readProject(page, otherId), otherBefore)
      && otherBefore.topics.some(({ id }) => id === energy.id), "PROJECT-ISOLATION", "另一企业项目的完整存档与预设议题未受影响");

    await openStep(page, sampleId, 4);
    check(!await page.getByText("披露要求矩阵", { exact: true }).count()
      && isDeepStrictEqual(removed.disclosureRequirements, beforePreset.disclosureRequirements), "ARCHIVED-DISCLOSURE", "矩阵已移除，历史条款、适用性和原章节映射完整保留");
    const chapter = section(page, "章节编辑");
    await chapter.getByRole("button", { name: "编辑关联", exact: true }).click();
    check(await chapter.getByText("待复核", { exact: true }).isVisible()
      && !await chapter.getByRole("checkbox", { name: /能源管理/ }).count()
      && await chapter.getByText("暂未关联议题", { exact: true }).isVisible(), "STEP4-OUTLINE", "大纲章节保留并待复核，编辑关联时不存在已删除议题");
    await page.screenshot({ path: path.join(outputDir, "outline-review.png"), fullPage: true });

    await openStep(page, sampleId, 2);
    check(!await pool.getByRole("button", { name: `编辑${energy.name}`, exact: true }).count()
      && await result.getByText("待复核", { exact: true }).isVisible(), "PRESET-REFRESH", "切到 Step 4 再回 Step 2 后移除和待复核状态保持");
    await page.getByRole("button", { name: "新增议题", exact: true }).click();
    await page.getByLabel("从预设添加", { exact: true }).selectOption(energy.id);
    await page.getByRole("button", { name: "添加预设议题", exact: true }).click();
    await page.getByRole("dialog", { name: "新增议题" }).waitFor({ state: "hidden" });
    await openStep(page, sampleId, 2);
    const restored = await readProject(page, sampleId);
    const restoredEnergy = restored.topics.find(({ id }) => id === energy.id);
    check(await pool.getByRole("button", { name: `纳入${energy.name}`, exact: true }).isVisible()
      && restoredEnergy?.financialScore === 0 && restoredEnergy.impactScore === 0 && restoredEnergy.confirmed === false
      && !restored.reportSections.find(({ id }) => id === "section-4-2").topics.includes(energy.name)
      && restored.impacts.some(({ id }) => id === energyRecord.id), "RESTORE-PRESET", "可从原模板重新添加，刷新后仍在池内，旧评分、确认及关联须重新填写或建立");

    await page.getByRole("button", { name: "确认评估结果", exact: true }).click();
    const reviewed = await saveDraft(page, sampleId);
    check(reviewed.materiality.confirmed && !reviewed.materiality.reviewStatus, "RECONFIRM-ASSESSMENT", "重新确认当前已评分范围后清除评估待复核");
    await openStep(page, sampleId, 4);
    await chapter.getByRole("button", { name: "编辑关联", exact: true }).click();
    await chapter.getByRole("checkbox", { name: /能源管理/ }).check();
    await chapter.getByRole("button", { name: "确认议题关联", exact: true }).click();
    await chapter.getByRole("button", { name: "确认议题关联", exact: true }).waitFor({ state: "hidden" });
    const relinked = await readProject(page, sampleId);
    check(relinked.reportSections.find(({ id }) => id === "section-4-2").topics.includes(energy.name)
      && !relinked.reportSections.find(({ id }) => id === "section-4-2").topicReviewStatus, "STEP4-MANUAL-RELINK", "允许显式重建并确认章节议题关联");

    await openStep(page, otherId, 2);
    await page.setViewportSize({ width: 390, height: 844 });
    const conflictDialog = await askDelete(page, energy.name);
    check(await conflictDialog.getByRole("button", { name: "确认删除", exact: true }).isVisible(), "NARROW-DIALOG", "窄屏删除确认可操作");
    await page.screenshot({ path: path.join(outputDir, "confirm-narrow.png") });
    const second = await context.newPage();
    trackErrors(second);
    await openStep(second, otherId, 2);
    await addCustomTopic(second, "并发保存验收议题");
    const otherLatest = await saveDraft(second, otherId);
    await conflictDialog.getByRole("button", { name: "确认删除", exact: true }).click();
    await conflictDialog.getByRole("alert").getByText(/项目已在另一个页面更新/).waitFor();
    check(isDeepStrictEqual(await readProject(page, otherId), otherLatest), "CONFLICT-SAFE", "另一个标签页先保存时报告冲突，未覆盖最新项目或删除议题");
    await conflictDialog.getByRole("button", { name: "取消", exact: true }).click();
    check(browserErrors.length === 0, "BROWSER-ERRORS", "Chromium console/page errors = 0");
  } catch (error) {
    fatal = error instanceof Error ? error.stack : String(error);
    console.error(fatal);
  } finally {
    const totals = { pass: results.filter(({ status }) => status === "PASS").length, fail: results.filter(({ status }) => status === "FAIL").length };
    if (fatal && totals.fail === 0) totals.fail += 1;
    fs.writeFileSync(path.join(outputDir, "results.json"), JSON.stringify({
      baseUrl, testedCommit: process.env.TESTED_COMMIT || execFileSync("git", ["rev-parse", "HEAD"], { cwd: path.resolve(__dirname, ".."), encoding: "utf8" }).trim(),
      browserVersion: browser.version(), generatedAt: new Date().toISOString(), ignoreHTTPSErrors,
      isolation: "Fresh Chromium context with synthetic projects only. No existing browser profile or storage used.",
      totals, results, browserErrors, fatal: fatal || null,
    }, null, 2) + "\n");
    console.log(`SUMMARY pass=${totals.pass} fail=${totals.fail} browserErrors=${browserErrors.length}`);
    await browser.close();
  }
  if (fatal) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
