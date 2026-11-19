/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { isDeepStrictEqual } = require("node:util");
const { mutateProject, readProject } = require("./indexeddb-test-helpers.cjs");
const legacyQuality = require("./fixtures/legacy-disclosure-quality.json");

const baseUrl = process.env.STEP3_BASE_URL || "http://127.0.0.1:4325";
const outputDir = process.env.STEP3_OUTPUT_DIR || path.resolve(__dirname, "../work/step3-planning");
const ignoreHTTPSErrors = process.env.STEP3_IGNORE_HTTPS_ERRORS === "1";
const results = [];
const browserErrors = [];

function check(condition, id, detail) {
  results.push({ id, status: condition ? "PASS" : "FAIL", detail });
  console.log(`${condition ? "PASS" : "FAIL"} ${id} ${detail}`);
  if (!condition) throw new Error(`${id}: ${detail}`);
}

async function ready(page) {
  await page.locator('[aria-busy="false"]').first().waitFor();
}

async function openStep(page, projectId, step, query = "") {
  const response = await page.goto(`${baseUrl}/reports/${encodeURIComponent(projectId)}/step/${step}${query}`);
  if (!response?.ok()) throw new Error(`Step ${step} HTTP ${response?.status()}`);
  await ready(page);
}

async function waitStored(page, id, predicate) {
  const expires = Date.now() + 15_000;
  while (Date.now() < expires) {
    const project = await readProject(page, id);
    if (project && predicate(project)) return project;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("IndexedDB 未保存预期结果");
}

async function save(page, id, buttonName) {
  const before = await readProject(page, id);
  await page.getByRole("button", { name: buttonName, exact: true }).click();
  return waitStored(page, id, (project) => project.revision > before.revision);
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const bundled = chromium.executablePath();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || (fs.existsSync(bundled) ? bundled : "/usr/bin/chromium"), args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  let fatal;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ignoreHTTPSErrors, acceptDownloads: true });
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") browserErrors.push(`console: ${message.text()}`); });
    page.on("pageerror", (error) => browserErrors.push(`page: ${error.message}`));
    const homepage = await page.goto(baseUrl);
    await page.getByRole("heading", { name: "尚无本地项目", exact: true }).waitFor();
    check(homepage?.status() === 200, "HTTP-ISOLATED", "首页 HTTP 200，独立会话无现有本地项目");

    await page.getByRole("button", { name: "新建报告" }).click();
    await page.locator("#report-name").fill("目录与资料链路验收报告");
    await page.locator("#enterprise").fill("验收样本企业");
    await page.locator("#report-year").fill("2026");
    await page.getByRole("button", { name: "创建并开始" }).click();
    await page.waitForURL(/\/reports\/[^/]+\/step\/1$/);
    await ready(page);
    const id = decodeURIComponent(new URL(page.url()).pathname.split("/")[2]);
    const frameworks = page.locator("section").filter({ has: page.getByRole("heading", { name: "披露框架", exact: true }) });
    await frameworks.locator("label").filter({ hasText: "北交所指引" }).click();
    await frameworks.locator("label").filter({ hasText: "GRI Standards" }).click();
    const profile = await save(page, id, "保存基础信息");
    check(profile.report.frameworks.includes("北交所指引") && profile.report.frameworks.includes("GRI Standards") && profile.disclosureRequirements.length === 0, "REFERENCE", "框架选择可保存，空白项目不生成条款或义务判断");

    const topicName = "验收议题：资源效率";
    await openStep(page, id, 2);
    await page.getByRole("button", { name: "新增议题", exact: true }).click();
    await page.getByLabel("议题名称", { exact: true }).fill(topicName);
    await page.getByLabel("财务重要性", { exact: true }).fill("4.2");
    await page.getByLabel("影响重要性", { exact: true }).fill("4.5");
    await page.getByRole("button", { name: "保存议题" }).click();
    await save(page, id, "保存草稿");

    await openStep(page, id, 3, "?requirementId=old-link");
    const modules = page.getByRole("group", { name: "Step 3 模块" }).getByRole("button");
    check(isDeepStrictEqual(await modules.allTextContents(), ["报告目录", "年度资料清单"])
      && await modules.first().getAttribute("aria-pressed") === "true"
      && await page.getByRole("heading", { name: "构建报告大纲与年度资料清单", exact: true }).isVisible()
      && !await page.getByText(/披露要求矩阵|披露要求覆盖|用户确认适用性|条款确认度/).count(), "MODULES", "旧矩阵链接进入目录，Step 3 仅有两个模块且默认目录");
    const title = "验收资源与环境";
    await page.getByRole("button", { name: "新增章节" }).click();
    await page.locator("#new-section-order").fill("8");
    await page.locator("#new-section-title-input").fill(title);
    await page.locator("#new-section-description").fill("核对年度资源管理资料。");
    await page.getByRole("button", { name: "创建章节" }).click();
    await page.getByRole("button", { name: "编辑关联" }).click();
    await page.getByRole("checkbox", { name: /验收议题：资源效率/ }).check();
    const outlined = await save(page, id, "保存章节");
    const chapterId = outlined.reportSections.find((item) => item.title === title).id;
    check(outlined.reportSections.some((item) => item.id === chapterId && item.topics.includes(topicName))
      && outlined.writing.chapters.some((item) => item.id === chapterId && item.title === title && item.blocks[0].mappings.length === 0), "OUTLINE-TOPIC", "新增章节保存 Step 2 议题关联，并同步创建 Step 5 章节");
    await page.screenshot({ path: path.join(outputDir, "outline.png") });

    await modules.last().click();
    check(await page.getByText("暂无资料项，可按报告需要新增。").isVisible(), "EMPTY-MATERIALS", "空白项目可直接开始编制年度资料清单");
    await page.getByRole("button", { name: "新增资料项" }).click();
    const firstItemName = "资源管理佐证材料";
    await page.getByLabel("资料名称", { exact: true }).fill(firstItemName);
    await page.getByLabel("对应章节", { exact: true }).selectOption(`8 ${title}`);
    await page.getByLabel("资料类型", { exact: true }).selectOption("案例");
    await page.getByLabel("责任部门", { exact: true }).selectOption("安全环保部");
    await page.getByLabel("收集方式", { exact: true }).selectOption("在线补充");
    await page.getByLabel("截止日期", { exact: true }).fill("2026-12-10");
    const created = await save(page, id, "保存资料项");
    const itemId = created.dataRequirements.find((item) => item.itemName === firstItemName).id;
    check(await page.getByRole("row", { name: new RegExp(firstItemName) }).isVisible(), "ADD-MATERIAL", "新增资料项后显示章节、部门、类型、截止日期和状态");
    await page.getByRole("button", { name: `编辑${firstItemName}`, exact: true }).click();
    const itemName = "资源管理年度记录";
    await page.getByLabel("资料名称", { exact: true }).fill(itemName);
    await page.getByLabel("截止日期", { exact: true }).fill("2026-12-20");
    await save(page, id, "保存资料项");
    await openStep(page, id, 3, `?chapterId=${encodeURIComponent(chapterId)}`);
    check(await page.locator("#section-title").inputValue() === title, "OUTLINE-LOCATOR", "章节定位参数打开对应目录编辑项");
    const renamed = "验收资源与环境策略";
    await page.locator("#section-title").fill(renamed);
    const saved = await save(page, id, "保存章节");
    const item = saved.dataRequirements.find((entry) => entry.id === itemId);
    check(item.itemName === itemName && item.dueDate === "2026-12-20" && item.section === `8 ${renamed}` && item.collectionMethod === "在线补充"
      && saved.writing.chapters.find((entry) => entry.id === chapterId)?.title === renamed, "MATERIALS-RENAME", "资料编辑可刷新恢复，章节改名同步资料清单与正文目录");
    await page.setViewportSize({ width: 390, height: 844 });
    await modules.last().click();
    check(await modules.last().isVisible() && await page.getByRole("table").evaluate((table) => table.parentElement.scrollWidth > table.parentElement.clientWidth), "NARROW", "窄屏可切换模块，资料表可横向滚动");
    await page.screenshot({ path: path.join(outputDir, "materials-narrow.png"), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });

    await openStep(page, id, 4);
    check(await page.getByRole("row", { name: new RegExp(itemName) }).getByLabel(`${itemName}责任部门`).inputValue() === "安全环保部"
      && await page.getByRole("row", { name: new RegExp(itemName) }).getByText(`8 ${renamed}`, { exact: true }).isVisible(), "STEP4-TASK", "Step 4 使用同一资料任务、责任部门及章节");
    await page.getByRole("button", { name: "在线补充", exact: true }).click();
    const resourceName = "验收资料来源记录";
    await page.getByLabel("关联资料项", { exact: true }).selectOption(itemId);
    await page.getByLabel("补充标题").fill(resourceName);
    await page.getByLabel("资料内容").fill("此资料用于验证章节资料来源的保存和读取。");
    const withResource = await save(page, id, "保存来源记录");
    const resource = withResource.resources.find((entry) => entry.title === resourceName);
    await openStep(page, id, 5, `?chapterId=${encodeURIComponent(chapterId)}`);
    await page.getByRole("tab", { name: "相关资料", exact: true }).click();
    check(resource.chapterIds.includes(chapterId) && await page.getByLabel("章节标题", { exact: true }).inputValue() === renamed
      && await page.getByText(itemName, { exact: true }).isVisible() && await page.getByText(resourceName, { exact: true }).isVisible()
      && !await page.getByRole("tab", { name: "披露要求", exact: true }).count(), "STEP5-RESOURCES", "Step 5 显示同一章节、资料任务及 Step 4 补充来源");

    await mutateProject(page, (project, archived) => {
      const sectionChapter = project.writing.chapters.find((chapter) => chapter.id === archived.chapterId);
      sectionChapter.blocks[0].mappings = [{ requirementId: "req-gri-302-1", coverage: "待核验" }];
      project.disclosureRequirements.push({ id: "req-gri-302-1", framework: "GRI", code: "302-1", topic: "能源管理", summary: "旧条款验收样本", systemSuggestion: "适用", applicability: "适用", mappedSection: "旧章节", userConfirmed: true, revision: 1, reviewStatus: "有效" });
      project.quality = { ...project.quality, ...archived.quality };
    }, { chapterId, quality: legacyQuality }, id);
    const archivedProject = await readProject(page, id);
    await openStep(page, id, 5, `?chapterId=${encodeURIComponent(chapterId)}`);
    await page.getByLabel("章节状态", { exact: true }).selectOption("已审校");
    const reviewed = await save(page, id, "保存报告草稿");
    check(reviewed.writing.chapters.find((entry) => entry.id === chapterId).status === "已审校"
      && isDeepStrictEqual(reviewed.disclosureRequirements, archivedProject.disclosureRequirements)
      && isDeepStrictEqual(reviewed.writing.chapters.find((entry) => entry.id === chapterId).blocks, archivedProject.writing.chapters.find((entry) => entry.id === chapterId).blocks), "LEGACY-WRITING", "旧映射未核验时仍可完成正文审校，历史条款与正文块原样保留");

    await openStep(page, id, 7);
    check(await page.getByRole("heading", { name: "报告质量检查", exact: true }).isVisible()
      && !await page.getByText(legacyQuality.issues[0].title, { exact: true }).count(), "QUALITY-LEGACY-LIST", "旧条款问题不进入当前可处理问题列表");
    const checked = await save(page, id, "开始全面检查");
    check(checked.quality.fullCheck?.valid && checked.quality.runs.at(-1).issueIds.length === 0
      && checked.quality.runs.at(-1).ruleVersions["SRC-001"] && !checked.quality.runs.at(-1).ruleVersions["DISC-001"]
      && isDeepStrictEqual(checked.quality.runs[0], legacyQuality.runs[0]) && isDeepStrictEqual(checked.quality.coverage, legacyQuality.coverage)
      && isDeepStrictEqual(checked.quality.issues, legacyQuality.issues) && isDeepStrictEqual(checked.quality.actions, legacyQuality.actions), "QUALITY-RULES-ARCHIVE", "真实运行现行检查，旧条款问题、覆盖与处理记录均完整保留");
    await page.getByRole("button", { name: "生成检查报告" }).click();
    const report = page.getByRole("dialog");
    await report.waitFor();
    check(!await report.getByText(/已核验覆盖|披露覆盖：|已合规/).count(), "QUALITY-REPORT", "质量摘要不展示历史覆盖率或给出框架合规结论");

    await openStep(page, id, 8);
    check(await page.getByText(/定稿门禁已通过/).isVisible() && !await page.getByText(legacyQuality.issues[0].title, { exact: true }).count(), "STEP8-RELEASE-GATE", "旧版条款阻断留档，现行检查通过后可进入定稿");
    await page.getByLabel("定稿确认人").fill("验收样本审核人");
    await page.getByLabel("定稿授权角色").fill("验收样本报告负责人");
    for (const box of await page.getByRole("checkbox").all()) await box.check();
    const final = await save(page, id, "确认并创建新定稿版本");
    check(final.finalization.versions[0]?.qualityFullCheckRunId === checked.quality.fullCheck.runId
      && final.finalization.versions[0]?.issueSummary.blockers === 0, "STEP8-FINALIZE", "仅在测试项目通过当前质量检查和人工声明后创建版本");
    await page.screenshot({ path: path.join(outputDir, "finalization.png") });

    await mutateProject(page, (project, chapterId) => {
      const block = project.writing.chapters.find((entry) => entry.id === chapterId).blocks[0];
      block.citations.push({ factId: "missing-fact-fixture", factRevision: 1 });
    }, chapterId, id);
    await openStep(page, id, 7);
    const flagged = await save(page, id, "开始全面检查");
    await openStep(page, id, 8);
    check(flagged.quality.issues.some((issue) => issue.ruleId === "SRC-001" && issue.severity === "阻断")
      && await page.getByText("定稿门禁未通过", { exact: true }).isVisible()
      && await page.getByRole("button", { name: "确认并创建新定稿版本" }).isDisabled()
      && flagged.finalization.versions[0]?.versionId === final.finalization.versions[0].versionId, "STEP8-REAL-BLOCKER", "确实缺失的事实引用依然产生阻断，已存在定稿版本保留");
    check(browserErrors.length === 0, "BROWSER-ERRORS", "Chromium console/page errors = 0");
  } catch (error) {
    fatal = error instanceof Error ? error.stack : String(error);
    console.error(fatal);
  } finally {
    const totals = { pass: results.filter((result) => result.status === "PASS").length, fail: results.filter((result) => result.status === "FAIL").length };
    if (fatal && totals.fail === 0) totals.fail += 1;
    fs.writeFileSync(path.join(outputDir, "results.json"), JSON.stringify({
      baseUrl, testedCommit: process.env.TESTED_COMMIT || execFileSync("git", ["rev-parse", "HEAD"], { cwd: path.resolve(__dirname, ".."), encoding: "utf8" }).trim(),
      browserVersion: browser.version(), ignoreHTTPSErrors, generatedAt: new Date().toISOString(), totals, results, browserErrors, fatal: fatal || null,
      isolation: "Fresh Chromium context; all projects and historical fixtures are synthetic.",
    }, null, 2) + "\n");
    console.log(`SUMMARY pass=${totals.pass} fail=${totals.fail} browserErrors=${browserErrors.length}`);
    await browser.close();
  }
  if (fatal) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
