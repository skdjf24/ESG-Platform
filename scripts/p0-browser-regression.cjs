/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { clearProjectDatabase, readProject } = require("./indexeddb-test-helpers.cjs");

const baseUrl = process.env.P0_BASE_URL || "http://127.0.0.1:4325";
const evidenceDir = path.resolve(__dirname, "../docs/acceptance/p0-blank-industry");
const results = [];
const browserErrors = [];
let fatal;

function check(condition, id, detail) {
  const status = condition ? "PASS" : "FAIL";
  results.push({ id, status, detail });
  console.log(`${status} ${id} ${detail}`);
  if (!condition) throw new Error(`${id}: ${detail}`);
}

async function ready(page) {
  await page.locator('[aria-busy="false"]').first().waitFor({ timeout: 20_000 });
}

async function createBlank(page, title, name) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "新建报告" }).click();
  await page.locator("#report-name").fill(title);
  await page.locator("#enterprise").fill(name);
  await page.locator("#report-year").fill("2026");
  await page.getByRole("button", { name: "创建并开始" }).click();
  await page.waitForURL(/\/reports\/[^/]+\/step\/1/);
  await ready(page);
  return decodeURIComponent(new URL(page.url()).pathname.split("/")[2]);
}

async function selectSearch(page, query, code) {
  await page.getByLabel("搜索行业代码或名称").fill(query);
  await page.getByRole("option", { name: new RegExp(`^${code} · `) }).first().click();
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || "/usr/bin/chromium", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const browserVersion = browser.version();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(`console: ${message.text()}`); });
  page.on("pageerror", (error) => browserErrors.push(`page: ${error.message}`));
  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await clearProjectDatabase(page);
    await page.reload({ waitUntil: "networkidle" });
    const idA = await createBlank(page, "远山实业 2026 ESG 报告", "远山实业");
    let a = await readProject(page, idA);
    check(a?.projectKind === "blank" && a.enterprise.name === "远山实业", "BLANK-A", "新建项目写入空白种子与填写的企业名称");
    check(!a.enterprise.unifiedSocialCreditCode && !a.enterprise.headquarters && a.enterprise.employeeCount === null && !a.enterprise.industryCode && a.report.frameworks.length === 0, "BLANK-PROFILE", "企业画像、行业和披露框架未继承样本");
    check(a.sources.length === 0 && a.facts.length === 0 && a.resources.length === 0 && a.presentation.observations.length === 0 && a.writing.chapters.every((chapter) => chapter.blocks.length === 0), "BLANK-DATA", "来源、事实、正文和图表观测值为空");
    check(a.topics.length > 0 && a.topics.every((topic) => topic.financialScore === 0 && topic.impactScore === 0 && !topic.confirmed) && !a.materiality.confirmed, "BLANK-TOPICS", "通用候选议题未评分、未确认");
    check(a.quality.runs.length === 0 && a.finalization.versions.length === 0 && a.report.progress === 0, "BLANK-PROGRESS", "质量未检查、未定稿且进度为零");
    await page.getByRole("button", { name: "下一步" }).click();
    check(decodeURIComponent(new URL(page.url()).pathname).endsWith("/step/1") && await page.getByText(/请先选择主营行业/).count() > 0 && await page.getByText("进行中", { exact: true }).count() > 0, "PRIMARY-REQUIRED", "未选主营行业时 Step 1 保持进行中，不能进入下一步");
    await page.screenshot({ path: path.join(evidenceDir, "blank-step1-desktop.png"), fullPage: true });

    await selectSearch(page, "软件和信息技术服务业", "65");
    check(await page.getByText(/I 信息传输、软件和信息技术服务业 → 65 软件和信息技术服务业/).count() > 0, "SEARCH-NAME", "按名称搜索后显示完整分类路径");
    await page.getByRole("button", { name: "确认主营行业" }).click();
    await page.getByRole("button", { name: "添加其他行业" }).click();
    await selectSearch(page, "C26", "26");
    await page.getByRole("button", { name: "添加该行业" }).click();
    await page.getByRole("button", { name: "添加该行业" }).click();
    check(await page.getByRole("button", { name: "删除其他行业 26" }).count() === 1, "OTHER-DEDUP", "重复行业不能添加第二次");
    await selectSearch(page, "27", "27");
    await page.getByRole("button", { name: "添加该行业" }).click();
    check(await page.getByRole("button", { name: "删除其他行业 26" }).count() === 1 && await page.getByRole("button", { name: "删除其他行业 27" }).count() === 1, "OTHER-MULTI", "多个其他行业可独立添加");
    await page.getByRole("button", { name: "删除其他行业 27" }).click();
    await page.getByRole("button", { name: "添加该行业" }).click();
    await page.getByRole("button", { name: "保存基础信息" }).click();
    await page.getByText(/已保存项目数据/).waitFor();
    a = await readProject(page, idA);
    check(a.enterprise.industryCode === "65" && a.enterprise.primaryIndustry?.level === 2 && a.enterprise.otherIndustries.length === 2 && new Set(a.enterprise.otherIndustries.map((item) => item.code)).size === 2, "INDUSTRY-SAVE", "主营行业层级与其他行业独立持久化，无重复");
    await page.reload({ waitUntil: "networkidle" });
    await ready(page);
    check(await page.getByText(/65 · 软件和信息技术服务业/).count() > 0 && await page.getByRole("button", { name: "删除其他行业 26" }).count() === 1, "INDUSTRY-REFRESH", "刷新后行业选择恢复");
    await page.getByRole("button", { name: "下一步" }).click();
    await page.waitForURL((url) => decodeURIComponent(url.pathname) === `/reports/${idA}/step/2`);
    check(await page.getByText("待评分").count() > 0 && await page.getByText("进行中", { exact: true }).count() > 0, "STEP2-UNSCORED", "Step 2 进行中并显示待评分，未显示样本评分");

    for (let step = 1; step <= 8; step += 1) {
      const response = await page.goto(`${baseUrl}/reports/${idA}/step/${step}`, { waitUntil: "networkidle" });
      await ready(page);
      const body = await page.locator("body").innerText();
      check(Boolean(response?.ok()) && !/华澜新材料|林悦|12,680 MWh|独立模拟测试边界/.test(body), `BLANK-STEP-${step}`, `空白项目 Step ${step} 可进入且无示例企业内容`);
    }
    await page.goto(`${baseUrl}/reports/${idA}/step/4`, { waitUntil: "networkidle" });
    await ready(page);
    check(await page.getByText("示例 AI 规整结果").count() === 0 && await page.getByText("12,680 MWh").count() === 0, "STEP4-NO-MOCK", "空白项目资料页不显示示例指标");

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "打开示例项目" }).click();
    await page.waitForURL(/\/reports\/public-preview-sample-2025\/step\/1/);
    await ready(page);
    const sample = await readProject(page, "public-preview-sample-2025");
    check(sample?.projectKind === "sample" && sample.facts.length > 0 && sample.sources.length > 0 && sample.presentation.observations.length > 0, "SAMPLE-ENTRY", "示例入口保留完整华澜内容");
    check(sample.enterprise.industryCode === "C26" && await page.getByText(/C26 · 化学原料和化学制品制造业/).count() > 0, "LEGACY-C26", "旧格式 C26 正确识别且原值保留");
    await page.screenshot({ path: path.join(evidenceDir, "sample-step1-desktop.png"), fullPage: true });

    const idB = await createBlank(page, "北辰服务 2026 ESG 报告", "北辰服务");
    const b = await readProject(page, idB);
    check(idA !== idB && idB !== sample.projectId && b.facts.length === 0 && b.enterprise.name === "北辰服务", "THREE-PROJECTS", "两个空白项目和一个示例项目使用独立 ID 与数据");
    await page.getByLabel("总部所在地").fill("广州市");
    await page.getByRole("button", { name: "保存基础信息" }).click();
    await page.getByText(/已保存项目数据/).waitFor();
    const aAfter = await readProject(page, idA);
    const sampleAfter = await readProject(page, sample.projectId);
    check(!aAfter.enterprise.headquarters && sampleAfter.enterprise.headquarters === sample.enterprise.headquarters && (await readProject(page, idB)).enterprise.headquarters === "广州市", "PROJECT-ISOLATION", "修改项目 B 不影响项目 A 或示例项目");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(evidenceDir, "blank-step1-narrow.png"), fullPage: true });
    await page.getByLabel("行业门类").selectOption("C");
    await page.getByLabel("行业大类").selectOption("26");
    await page.getByLabel("行业中类").selectOption("261");
    await page.getByLabel("行业小类").selectOption("2614");
    await page.getByRole("button", { name: "确认主营行业" }).click();
    await page.getByRole("button", { name: "保存基础信息" }).click();
    await page.reload({ waitUntil: "networkidle" });
    await ready(page);
    const narrowIndustry = (await readProject(page, idB)).enterprise.primaryIndustry;
    check(narrowIndustry?.code === "2614" && narrowIndustry.level === 4 && narrowIndustry.parentCode === "261" && await page.getByLabel("行业小类").count() === 1, "NARROW-SELECT", "窄屏四级选择保存并在刷新后恢复代码、层级和上级关系");
    check(browserErrors.length === 0, "BROWSER-ERRORS", "Chromium console/page errors 为零");
  } catch (error) {
    fatal = error instanceof Error ? error.stack : String(error);
    console.error(fatal);
  } finally {
    const payload = {
      baseUrl,
      testedGitHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: path.resolve(__dirname, ".."), encoding: "utf8" }).trim(),
      branch: execFileSync("git", ["branch", "--show-current"], { cwd: path.resolve(__dirname, ".."), encoding: "utf8" }).trim(),
      chromiumVersion: browserVersion,
      generatedAt: new Date().toISOString(),
      totals: { pass: results.filter((item) => item.status === "PASS").length, fail: results.filter((item) => item.status === "FAIL").length },
      results,
      browserErrors,
      fatal,
    };
    fs.writeFileSync(path.join(evidenceDir, "results.json"), `${JSON.stringify(payload, null, 2)}\n`);
    await browser.close();
  }
  if (fatal || results.some((item) => item.status === "FAIL")) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
