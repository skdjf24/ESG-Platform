/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { clearProjectDatabase, mutateProject, readProject } = require("./indexeddb-test-helpers.cjs");

const baseUrl = process.env.STEP8_BASE_URL || "http://127.0.0.1:4325";
const acceptanceDir = path.resolve(__dirname, "../docs/acceptance/step8");
const results = [];

function check(condition, name, detail = "") {
  if (!condition) throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
  results.push({ name, status: "PASS", detail });
  console.log(`PASS ${name}`);
}

async function waitForProjectReady(page) {
  await page.locator('[aria-busy="false"]').first().waitFor({ state: "attached", timeout: 15000 });
}

async function main() {
  fs.mkdirSync(acceptanceDir, { recursive: true });
  const bundledChromium = chromium.executablePath();
  const executablePath = process.env.CHROMIUM_EXECUTABLE || (fs.existsSync(bundledChromium) ? bundledChromium : "/usr/bin/chromium");
  const browser = await chromium.launch({ headless: true, executablePath, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1800, height: 1180 }, acceptDownloads: true });
  const page = await context.newPage();
  const browserErrors = [];
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(`console: ${message.text()}`); });
  page.on("pageerror", (error) => browserErrors.push(`page: ${error.message}`));

  await page.goto(`${baseUrl}/reports/hualan-2025/step/7`, { waitUntil: "networkidle" });
  await waitForProjectReady(page);
  await clearProjectDatabase(page);
  await page.reload({ waitUntil: "networkidle" });
  await waitForProjectReady(page);
  await page.getByRole("button", { name: "开始全面检查" }).click();
  await page.getByText(/确定性规则检查已完成/).waitFor({ timeout: 15000 });
  const checkedProject = await readProject(page);
  check(Boolean(checkedProject.quality.fullCheck?.valid), "Step 7.1 全面检查建立有效 gate 记录");
  await page.goto(`${baseUrl}/reports/hualan-2025/step/8`, { waitUntil: "networkidle" });
  await waitForProjectReady(page);
  check(await page.getByText("定稿门禁未通过").isVisible() && await page.getByRole("button", { name: "确认并创建新定稿版本" }).isDisabled(), "Step 7 活动问题未关闭时 Step 8 禁止定稿");

  const originalChapterCount = checkedProject.writing.chapters.length;
  const originalFullCheckRunId = checkedProject.quality.fullCheck.runId;
  await mutateProject(page, (project) => {
    delete project.finalization;
  });
  await page.reload({ waitUntil: "networkidle" });
  await waitForProjectReady(page);
  await page.getByRole("button", { name: "已保存" }).click();
  await page.getByText(/已保存项目数据/).waitFor({ timeout: 10000 });
  const migratedProject = await readProject(page);
  check(
    migratedProject.finalization?.schemaVersion === 1
      && migratedProject.writing.chapters.length === originalChapterCount
      && migratedProject.quality.fullCheck.runId === originalFullCheckRunId,
    "缺少 Step 8 状态的 Step 1–7 存档加法迁移且保留质量历史",
  );

  // This fixture only prepares a closed quality state for Step 8 workflow
  // testing. It is explicitly simulated and does not claim the findings were
  // genuinely remediated.
  await mutateProject(page, (project) => {
    project.quality.issues = project.quality.issues.map((issue) => ({
      ...issue,
      status: "已复检解决",
      resolutionNote: "Step 8 独立模拟验收：仅用于验证定稿流程。",
      resolvedAt: new Date().toISOString(),
    }));
    project.quality.summary = {
      ...project.quality.summary,
      blockerCount: 0,
      highCount: 0,
      noticeCount: 0,
      unresolvedCount: 0,
      pendingRecheckCount: 0,
      resolvedCount: project.quality.issues.length,
    };
    project.quality.readiness = "可提交定稿审核";
    project.quality.stale = false;
  });

  await page.goto(`${baseUrl}/reports/hualan-2025/step/8`, { waitUntil: "networkidle" });
  await waitForProjectReady(page);
  check(await page.getByText(/Step 7.1 定稿门禁已通过/).isVisible(), "Step 8 直接读取朋友版本的 Step 7.1 gate");
  await page.screenshot({ path: path.join(acceptanceDir, "01-finalization-gate.png"), fullPage: true });

  await page.getByLabel("定稿确认人").fill("独立模拟验收人");
  await page.getByLabel("定稿授权角色").fill("模拟 ESG 报告负责人");
  for (const checkbox of await page.getByRole("checkbox").all()) await checkbox.check();
  await page.getByRole("button", { name: "确认并创建新定稿版本" }).click();
  await page.getByText(/已形成定稿记录/).waitFor({ timeout: 10000 });
  const finalized = await readProject(page);
  const version = finalized.finalization.versions.at(-1);
  check(finalized.finalization.versions.length === 1 && Boolean(version.qualityFullCheckRunId), "人工声明创建持久化定稿版本");
  check(await page.getByRole("button", { name: "当前数据已完成定稿" }).isDisabled(), "同一数据不能重复创建相同定稿");
  await page.screenshot({ path: path.join(acceptanceDir, "02-final-version.png"), fullPage: true });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载审计归档 JSON" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const archive = JSON.parse(fs.readFileSync(downloadPath, "utf8"));
  check(archive.simulatedPrototype === true && archive.version.versionId === version.versionId && !archive.sourceSnapshot.finalization, "审计包包含版本与来源快照且明确标记模拟原型");

  const finalPage = await context.newPage();
  finalPage.on("console", (message) => { if (message.type() === "error") browserErrors.push(`final console: ${message.text()}`); });
  finalPage.on("pageerror", (error) => browserErrors.push(`final page: ${error.message}`));
  await finalPage.goto(`${baseUrl}/reports/hualan-2025/final`, { waitUntil: "networkidle" });
  await waitForProjectReady(finalPage);
  await finalPage.getByText("打印 / 保存 PDF").waitFor({ timeout: 15000 });
  check(await finalPage.getByText("打印 / 保存 PDF").isVisible(), "当前有效版本可以打开最终打印页");
  const reportText = await finalPage.locator(".final-report-pages").innerText();
  check(!/blockId:|编辑原文|内部待办|Mock AI|独立模拟测试/.test(reportText), "最终报告不显示内部编辑标识、待办或 Mock 说明");
  const pageCount = await finalPage.locator(".final-report-page").count();
  check(pageCount === version.pageCount && pageCount > 2, "最终打印页使用定稿页面数量与最终页码");
  await finalPage.screenshot({ path: path.join(acceptanceDir, "03-final-print-view.png"), fullPage: false });

  await mutateProject(page, (project) => {
    project.revision += 1;
    project.updatedAt = new Date().toISOString();
    project.lastSavedAt = new Date().toISOString();
  });
  await page.reload({ waitUntil: "networkidle" });
  await waitForProjectReady(page);
  check(await page.getByText("当前有效定稿").isVisible(), "普通保存元数据变化不会错误使定稿失效");

  await mutateProject(page, (project) => {
    project.enterprise.name = `${project.enterprise.name}（变更）`;
  });
  await page.reload({ waitUntil: "networkidle" });
  await waitForProjectReady(page);
  check(await page.getByText("定稿已失效").isVisible(), "披露输入变化立即使旧定稿失效");
  check(await page.getByRole("button", { name: "打开最终打印版" }).isDisabled(), "失效定稿禁止继续输出");
  check(await page.getByText("定稿门禁未通过").isVisible(), "披露输入变化同时关闭 Step 7.1 gate");

  for (let step = 1; step <= 8; step += 1) {
    const response = await page.goto(`${baseUrl}/reports/hualan-2025/step/${step}`, { waitUntil: "networkidle" });
    await waitForProjectReady(page);
    check(response?.ok(), `Step ${step} 既有路由可打开`);
  }
  check(browserErrors.length === 0, "浏览器无 console/page error", browserErrors.join(" | "));

  fs.writeFileSync(path.join(acceptanceDir, "browser-results.json"), JSON.stringify({ simulatedDataOnly: true, results, browserErrors }, null, 2));
  await browser.close();
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
