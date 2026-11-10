/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { clearProjectDatabase, readProject, writeProject } = require("./indexeddb-test-helpers.cjs");

const baseUrl = process.env.STEP1_3_BASE_URL || "http://127.0.0.1:4325";
const evidenceDir = path.resolve(__dirname, "../docs/acceptance/step1-3-ui-materiality");
const results = [];
const browserErrors = [];
const expectedFrameworks = ["上交所指引", "深交所指引", "北交所指引", "GRI Standards", "ISSB S1/S2", "港交所 ESG 指引"];

function check(condition, id, detail) {
  results.push({ id, status: condition ? "PASS" : "FAIL", detail });
  console.log(`${condition ? "PASS" : "FAIL"} ${id} ${detail}`);
  if (!condition) throw new Error(`${id}: ${detail}`);
}

async function openStep(page, projectId, step) {
  const response = await page.goto(`${baseUrl}/reports/${projectId}/step/${step}`, { waitUntil: "networkidle" });
  check(Boolean(response?.ok()), `ROUTE-${step}`, `Step ${step} HTTP ${response?.status()}`);
  await page.locator('[aria-busy="false"]').first().waitFor();
}

async function save(page) {
  await page.getByRole("button", { name: /保存草稿|已保存/ }).last().click();
  await page.getByText(/已保存项目数据/).waitFor({ timeout: 15_000 });
}

async function tableLayout(page, id, narrow) {
  const data = await page.locator("table.workbench-data-table").first().evaluate((table) => {
    const wrapper = table.parentElement;
    const cells = [...table.querySelectorAll("thead th")];
    return {
      fontSizes: cells.map((cell) => getComputedStyle(cell).fontSize),
      whiteSpaces: cells.map((cell) => getComputedStyle(cell).whiteSpace),
      overlaps: cells.slice(1).some((cell, index) => cell.getBoundingClientRect().left < cells[index].getBoundingClientRect().right - 1),
      horizontalScroll: wrapper.scrollWidth > wrapper.clientWidth,
      bodyWhiteSpace: getComputedStyle(table.querySelector("tbody td")).whiteSpace,
      clippedCells: [...table.querySelectorAll("th, td")].some((cell) => cell.scrollWidth > cell.clientWidth + 1),
      controlLayout: [...table.querySelectorAll("td button, td select, td input")].every((control) => getComputedStyle(control).fontSize === "12px" && getComputedStyle(control).whiteSpace === "nowrap"),
    };
  });
  check(data.fontSizes.every((size) => size === "12px") && data.whiteSpaces.every((space) => space === "nowrap") && data.bodyWhiteSpace === "nowrap", `${id}-TYPE`, "表头与正文使用 12px 单行排版");
  check(!data.overlaps && !data.clippedCells && data.controlLayout && (!narrow || data.horizontalScroll), `${id}-SCROLL`, narrow ? "窄屏可横向滚动，按钮和选项单行且各列不重叠" : "各列与控件不重叠或裁剪");
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || "/usr/bin/chromium", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const browserVersion = browser.version();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.accept());
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("favicon")) browserErrors.push(`console: ${message.text()}`); });
  page.on("pageerror", (error) => browserErrors.push(`page: ${error.message}`));
  let fatal;
  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await clearProjectDatabase(page);
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "新建报告" }).click();
    await page.locator("#report-name").fill("Step 1–3 UI 验收项目");
    await page.locator("#enterprise").fill("验收测试企业");
    await page.locator("#report-year").fill("2026");
    await page.getByRole("button", { name: "创建并开始" }).click();
    await page.waitForURL(/\/reports\/[^/]+\/step\/1/);
    await page.locator('[aria-busy="false"]').first().waitFor();
    const projectId = new URL(page.url()).pathname.split("/")[2];
    let project = await readProject(page, projectId);
    check(projectId !== "hualan-2025" && project.topics.length > 0, "STEP1-SEED", "新项目保留初始议题数据且使用动态 projectId");
    check(!project.report.frameworks.some((item) => item.includes("CASS")) && !project.disclosureRequirements.some((item) => item.framework.includes("CASS")), "STEP1-NO-CASS", "新项目未选择 CASS，矩阵也没有 CASS 条款");
    const frameworkSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "披露框架" }) });
    const labels = await frameworkSection.locator("label").allTextContents();
    check(JSON.stringify(labels.map((item) => item.trim())) === JSON.stringify(expectedFrameworks), "STEP1-FRAMEWORK-ORDER", "披露框架固定顺序为三列两行，港交所在第二行");
    const positions = await frameworkSection.locator("label").evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().top)));
    check(positions.slice(0, 3).every((top) => top === positions[0]) && positions.slice(3).every((top) => top === positions[3]) && positions[3] > positions[0], "STEP1-FRAMEWORK-GRID", "桌面框架实际呈现三列两行");
    check(!await page.getByText("初始 ESG 议题池").count() && !await page.getByRole("button", { name: "新增议题" }).count(), "STEP1-TOPIC-UI", "Step 1 初始议题池及其操作入口已移除");
    const bseOption = frameworkSection.locator("label").filter({ hasText: "北交所指引" });
    await bseOption.click();
    check((await bseOption.locator("input").isChecked()) && await frameworkSection.getByText("已选择 3 项").isVisible(), "STEP1-BSE-SELECT", "北交所可选中，已选数量更新");
    await bseOption.click();
    check(!(await bseOption.locator("input").isChecked()) && await frameworkSection.getByText("已选择 2 项").isVisible(), "STEP1-BSE-DESELECT", "北交所可取消，已选数量更新");
    await bseOption.click();
    await page.screenshot({ path: path.join(evidenceDir, "step1-desktop.png"), fullPage: true });
    await save(page);
    project = await readProject(page, projectId);
    const bseRows = project.disclosureRequirements.filter((item) => item.framework === "北交所");
    check(bseRows.length === 2 && bseRows.every((item) => item.sourceUrl?.includes("bse.cn") && item.sourceVersion?.includes("2025-04-25") && !item.userConfirmed && item.applicability === "待确认"), "STEP1-BSE-SOURCE", "北交所第35/36条独立建档，标明官网来源和修订版本且待用户确认");

    await openStep(page, projectId, 3);
    const filter = page.getByLabel("筛选披露框架");
    check((await filter.locator("option").allTextContents()).includes("北交所") && !(await filter.locator("option").allTextContents()).includes("CASS-ESG"), "STEP3-FILTER", "新项目矩阵有北交所筛选且无 CASS 筛选");
    await filter.selectOption("北交所");
    check(await page.getByText("第三十五条").count() > 0 && await page.getByText("第三十六条").count() > 0 && await page.getByRole("link", { name: /来源：北京证券交易所/ }).count() === 2, "STEP3-BSE-MAPPING", "北交所条款和独立来源在矩阵内可查看");
    await filter.selectOption("全部框架");
    await tableLayout(page, "STEP3-DESKTOP", false);
    await page.screenshot({ path: path.join(evidenceDir, "step3-desktop.png"), fullPage: true });

    await openStep(page, projectId, 7);
    await page.getByRole("button", { name: "开始全面检查" }).click();
    await page.getByText(/确定性规则检查已完成/).waitFor({ timeout: 20_000 });
    project = await readProject(page, projectId);
    const qualityRunId = project.quality.fullCheck?.runId;
    check(Boolean(qualityRunId) && project.quality.fullCheck?.valid, "STEP7-BASELINE", "修改评分前建立有效质量检查快照");

    await openStep(page, projectId, 2);
    const scoringSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "双重重要性评估" }) });
    check(!await scoringSection.getByRole("button", { name: "筛选" }).count() && await page.getByLabel("搜索议题").isVisible() && await page.getByRole("button", { name: /全部 \d+/ }).count() === 1, "STEP2-CONTROLS", "议题池分类与搜索保留，评分表无无效筛选按钮");
    await page.getByLabel("搜索议题").fill("能源管理");
    check(await page.getByRole("button", { name: "移出能源管理" }).count() === 1 && !await page.getByRole("button", { name: "移出气候变化" }).count(), "STEP2-SEARCH", "议题搜索可筛选列表");
    await page.getByLabel("搜索议题").fill("");
    await page.getByRole("button", { name: "E 4" }).click();
    check(await page.getByRole("button", { name: "移出能源管理" }).count() === 1 && !await page.getByRole("button", { name: "移出商业道德" }).count(), "STEP2-CATEGORY", "E/S/G 分类筛选仍可用");
    await page.getByRole("button", { name: /全部 \d+/ }).click();
    const initialPointCount = await page.locator(".matrix-grid .group").count();
    await page.getByRole("button", { name: "移出能源管理" }).click();
    check(await page.getByRole("button", { name: "纳入能源管理" }).count() === 1 && await page.locator(".matrix-grid .group").count() === initialPointCount - 1 && !await page.getByLabel("能源管理财务重要性").count(), "STEP2-REMOVE", "移出议题同步排除评分行和矩阵点，但保留原始议题");
    await page.getByRole("button", { name: "纳入能源管理" }).click();
    check(await page.locator(".matrix-grid .group").count() === initialPointCount && await page.getByLabel("能源管理财务重要性").count() === 1, "STEP2-REINCLUDE", "纳入议题同步恢复评分行和矩阵点");
    await page.getByRole("button", { name: "新增议题" }).click();
    await page.locator("#topic-name").fill("验收新增议题");
    await page.locator("#topic-financial").fill("4.1");
    await page.locator("#topic-impact").fill("4.4");
    await page.getByRole("button", { name: "保存议题" }).click();
    check(await page.locator(".matrix-grid .group").count() === initialPointCount + 1 && await page.getByLabel("验收新增议题财务重要性").count() === 1, "STEP2-ADD", "新增议题立即出现在评分表和矩阵");
    const priorityLabel = page.getByText("重点议题", { exact: true });
    const priorityBefore = Number((await priorityLabel.locator("..").locator(".text-2xl").textContent()).replace(/\D/g, ""));
    const climateDot = page.locator(".matrix-grid .group").filter({ hasText: "气候变化" });
    const dotBefore = await climateDot.getAttribute("style");
    const finance = page.getByLabel("气候变化财务重要性");
    await finance.fill("");
    check(await finance.inputValue() === "" && await climateDot.getAttribute("style") === dotBefore, "STEP2-EMPTY-SCORE", "编辑中清空评分不写入 1，也不移动矩阵点");
    await finance.fill("5.5");
    await finance.blur();
    check(await finance.inputValue() === "4.6" && await climateDot.getAttribute("style") === dotBefore, "STEP2-SCORE-VALIDATION", "超出 1–5 分或 0.1 步长的输入不会提交");
    await finance.fill("3.1");
    const dotAfterFinance = await climateDot.getAttribute("style");
    check(dotAfterFinance !== dotBefore && await page.getByRole("button", { name: "确认评估结果" }).isVisible(), "STEP2-FINANCE-LINK", "财务评分更新矩阵，并使旧确认失效");
    await page.getByLabel("气候变化影响重要性").fill("3.2");
    check(await climateDot.getAttribute("style") !== dotAfterFinance, "STEP2-IMPACT-LINK", "影响评分立即更新矩阵点位");
    const priorityAfter = Number((await priorityLabel.locator("..").locator(".text-2xl").textContent()).replace(/\D/g, ""));
    check(priorityAfter === priorityBefore - 1, "STEP2-PRIORITY", "评分跨过阈值后重点议题与结果统计立即重算");
    await tableLayout(page, "STEP2-DESKTOP", false);
    await page.screenshot({ path: path.join(evidenceDir, "step2-desktop.png"), fullPage: true });
    await save(page);
    project = await readProject(page, projectId);
    check(project.topics.find((item) => item.name === "气候变化")?.financialScore === 3.1 && project.topics.find((item) => item.name === "气候变化")?.impactScore === 3.2 && !project.materiality.confirmed, "STEP2-PERSIST", "评分与待确认状态保存到 IndexedDB");
    check(project.disclosureRequirements.find((item) => item.id === "req-sse-4")?.reviewStatus === "待复核" && project.quality.stale && !project.quality.fullCheck.valid && project.quality.fullCheck.runId === qualityRunId, "STEP2-DOWNSTREAM", "关联披露和质量快照待复核，旧记录与正文保留");
    await page.getByRole("button", { name: "下一步" }).click();
    await page.waitForURL(/\/step\/3/);
    await page.getByRole("button", { name: "上一步" }).click();
    await page.waitForURL(/\/step\/2/);
    await page.reload({ waitUntil: "networkidle" });
    await page.locator('[aria-busy="false"]').first().waitFor();
    check(await page.getByLabel("气候变化财务重要性").inputValue() === "3.1" && await page.getByLabel("气候变化影响重要性").inputValue() === "3.2" && await page.getByRole("button", { name: "确认评估结果" }).isVisible(), "STEP2-REFRESH", "切换步骤并刷新后评分、矩阵与确认状态一致");
    await page.getByRole("button", { name: "确认评估结果" }).click();
    check(await page.getByRole("button", { name: "已由用户确认" }).isVisible(), "STEP2-RECONFIRM", "用户可重新确认更新后的结果");
    await page.getByRole("button", { name: /管理层评估/ }).click();
    check(await page.getByRole("button", { name: "确认评估结果" }).isVisible(), "STEP2-METHOD-INVALIDATE", "评估方式变化使确认恢复待确认");
    await save(page);
    project = await readProject(page, projectId);
    check(project.materiality.method === "管理层评估" && !project.materiality.confirmed, "STEP2-METHOD-PERSIST", "评估方式与待确认状态持久化");

    await openStep(page, projectId, 1);
    const legacy = structuredClone(await readProject(page, projectId));
    const writingCount = legacy.writing.chapters.flatMap((chapter) => chapter.blocks).length;
    legacy.report.frameworks.push("CASS-ESG 6.0");
    legacy.disclosureRequirements.push({ id: "req-cass-legacy-test", framework: "CASS-ESG", code: "M3.2", topic: "污染物排放", summary: "旧项目原始要求", systemSuggestion: "适用", applicability: "适用", mappedSection: "4.3 污染防治", userConfirmed: true, revision: 1, reviewStatus: "有效" });
    await writeProject(page, legacy, projectId);
    await page.reload({ waitUntil: "networkidle" });
    await page.locator('[aria-busy="false"]').first().waitFor();
    check(await page.getByText(/旧项目保留了 CASS-ESG 6.0/).isVisible() && !await frameworkSection.locator("label").filter({ hasText: "CASS" }).count(), "LEGACY-WARNING", "旧 CASS 选项有明确提示，但不出现在新选项中");
    await page.getByRole("button", { name: "移除旧框架选项并标记相关要求待复核" }).click();
    await save(page);
    project = await readProject(page, projectId);
    const oldRow = project.disclosureRequirements.find((item) => item.id === "req-cass-legacy-test");
    check(!project.report.frameworks.includes("CASS-ESG 6.0") && oldRow?.reviewStatus === "待复核" && oldRow?.userConfirmed && oldRow?.applicability === "适用" && project.writing.chapters.flatMap((chapter) => chapter.blocks).length === writingCount, "LEGACY-PRESERVE", "移除旧选项保留历史确认与正文，仅使该确认待复核且不转成北交所");

    await page.setViewportSize({ width: 390, height: 844 });
    const frameworkScrolls = await frameworkSection.locator(".overflow-x-auto").evaluate((element) => element.scrollWidth > element.clientWidth);
    check(frameworkScrolls, "STEP1-NARROW-SCROLL", "窄屏披露框架仍为三列两行并可横向滚动");
    await page.screenshot({ path: path.join(evidenceDir, "step1-narrow.png"), fullPage: true });
    await openStep(page, projectId, 3);
    await tableLayout(page, "STEP3-NARROW", true);
    await page.screenshot({ path: path.join(evidenceDir, "step3-narrow.png"), fullPage: true });
    await openStep(page, projectId, 4);
    await tableLayout(page, "STEP4-NARROW", true);
    await page.screenshot({ path: path.join(evidenceDir, "step4-narrow.png"), fullPage: true });
    check(browserErrors.length === 0, "BROWSER-ERRORS", "Chromium console/page errors = 0");
  } catch (error) {
    fatal = error instanceof Error ? error.stack : String(error);
    console.error(fatal);
  } finally {
    fs.writeFileSync(path.join(evidenceDir, "results.json"), JSON.stringify({ testedCommit: process.env.TESTED_COMMIT || null, browserVersion, baseUrl, passCount: results.filter((item) => item.status === "PASS").length, failCount: results.filter((item) => item.status === "FAIL").length + (fatal && !results.some((item) => item.status === "FAIL") ? 1 : 0), results, browserErrors, fatal: fatal || null }, null, 2) + "\n");
    await browser.close();
  }
  if (fatal) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
