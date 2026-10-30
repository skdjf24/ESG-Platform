/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const {
  clearProjectDatabase,
  readProject,
  readProjectFiles,
  writeProject,
} = require("./indexeddb-test-helpers.cjs");

const baseUrl = process.env.PHASE1_BASE_URL || "http://127.0.0.1:4325";
const evidenceDir = path.resolve(__dirname, "../docs/acceptance/phase1");
const results = [];

function check(condition, id, detail) {
  if (!condition) throw new Error(`${id}: ${detail}`);
  results.push({ id, status: "PASS", detail });
  console.log(`PASS ${id} ${detail}`);
}

async function waitForReady(page) {
  await page.locator('[aria-busy="false"]').first().waitFor({ state: "attached", timeout: 20_000 });
}

async function createProject(page, { title, enterpriseName, year }) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "新建报告" }).click();
  await page.locator("#report-name").fill(title);
  await page.locator("#enterprise").fill(enterpriseName);
  await page.locator("#report-year").fill(String(year));
  await page.getByRole("button", { name: "创建并开始" }).click();
  await page.waitForURL(/\/reports\/[^/]+\/step\/1/);
  await waitForReady(page);
  return new URL(page.url()).pathname.split("/")[2];
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const launchOptions = { headless: true, args: ["--no-sandbox"] };
  if (process.env.CHROMIUM_EXECUTABLE) launchOptions.executablePath = process.env.CHROMIUM_EXECUTABLE;
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  const browserErrors = [];
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await clearProjectDatabase(page);
  await page.reload({ waitUntil: "networkidle" });

  const projectId = await createProject(page, {
    title: "E2E Prototype Test Project",
    enterpriseName: "Phase 1 E2E Enterprise",
    year: 2026,
  });
  check(projectId !== "hualan-2025", "P1-PROJECT-ID", "新项目获得动态 projectId");
  let project = await readProject(page, projectId);
  check(project?.enterprise.name === "Phase 1 E2E Enterprise" && project.report.year === 2026, "P1-CREATE", "项目结构化数据写入 IndexedDB");

  const historyBytes = Buffer.from("PHASE1-HISTORY-REAL-BYTES");
  await page.getByLabel("选择历史报告文件").setInputFiles({ name: "phase1-history.pdf", mimeType: "application/pdf", buffer: historyBytes });
  await page.getByText(/历史报告文件已保存到本地文件仓库/).waitFor({ timeout: 15_000 });
  project = await readProject(page, projectId);
  let files = await readProjectFiles(page, projectId);
  const historySource = project.sources.find((item) => item.name === "phase1-history.pdf");
  check(historySource?.fileId && historySource.parserStatus === "not-started" && historySource.fileStatus === "available", "P1-HISTORY-LINK", "Step 1 来源以 fileId 关联真实文件且未伪造解析");
  check(files.some((item) => item.fileId === historySource.fileId && item.text === historyBytes.toString()), "P1-HISTORY-BYTES", "Step 1 历史报告真实字节可读取");
  await page.reload({ waitUntil: "networkidle" });
  await waitForReady(page);
  const historyDownload = page.waitForEvent("download");
  await page.getByLabel("下载历史报告 phase1-history.pdf").click();
  const downloadedHistory = await historyDownload;
  check(fs.readFileSync(await downloadedHistory.path()).equals(historyBytes), "P1-FILE-REFRESH", "刷新后历史报告文件仍可下载且字节一致");

  await page.goto(`${baseUrl}/reports/${projectId}/step/4`, { waitUntil: "networkidle" });
  await waitForReady(page);
  await page.getByRole("button", { name: /上传资料/ }).click();
  const step4Bytes = Buffer.from("PHASE1-STEP4-REAL-BYTES");
  await page.getByLabel("选择资料文件").setInputFiles({ name: "phase1-data.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: step4Bytes });
  await page.getByRole("button", { name: "保存来源记录" }).click();
  await page.getByText(/已保存项目数据/).waitFor({ timeout: 15_000 });
  project = await readProject(page, projectId);
  files = await readProjectFiles(page, projectId);
  const step4Source = project.sources.find((item) => item.name === "phase1-data.xlsx");
  check(step4Source?.fileId && files.some((item) => item.fileId === step4Source.fileId && item.text === step4Bytes.toString()), "P1-STEP4-BYTES", "Step 4 资料文件保存真实字节");
  check(!project.facts.some((fact) => fact.sourceReferences.some((reference) => reference.sourceId === step4Source.id)), "P1-NO-FAKE-PARSE", "未解析文件没有伪造事实或解析结果");

  const secondId = await createProject(page, { title: "Second isolated project", enterpriseName: "Second Enterprise", year: 2026 });
  const secondFiles = await readProjectFiles(page, secondId);
  check(secondId !== projectId && secondFiles.length === 0, "P1-ISOLATION", "第二项目使用独立 ID 且看不到第一项目文件");
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  check(await page.getByText("E2E Prototype Test Project", { exact: true }).isVisible() && await page.getByText("Second isolated project", { exact: true }).isVisible(), "P1-LIST", "项目列表可显示并打开多个项目");

  const projectCard = page.locator("article").filter({ hasText: "E2E Prototype Test Project" });
  const backupDownload = page.waitForEvent("download");
  await projectCard.getByRole("button", { name: "导出备份" }).click();
  const backup = await backupDownload;
  const backupPath = await backup.path();
  const archive = JSON.parse(fs.readFileSync(backupPath, "utf8"));
  check(archive.manifest.schemaVersion === 1 && archive.files.length === 2 && archive.files.every((item) => item.dataBase64), "P1-BACKUP", "备份含 manifest、项目数据和真实文件字节");

  await page.getByLabel("选择项目备份").setInputFiles(backupPath);
  await page.getByText(/已存在|未覆盖/).waitFor({ timeout: 10_000 });
  const unchanged = await readProject(page, projectId);
  check(unchanged.revision === project.revision, "P1-RESTORE-CONFLICT", "同 ID 恢复被明确阻止且不覆盖原项目");

  const restoredId = `${projectId}-restored`;
  archive.manifest.projectId = restoredId;
  archive.project.projectId = restoredId;
  archive.project.report.id = restoredId;
  for (const file of archive.files) file.projectId = restoredId;
  const restoredBackupPath = path.join(evidenceDir, "phase1-restore-fixture.esgbackup.json");
  fs.writeFileSync(restoredBackupPath, JSON.stringify(archive));
  await page.getByLabel("选择项目备份").setInputFiles(restoredBackupPath);
  await page.getByText(/已恢复/).waitFor({ timeout: 15_000 });
  const restored = await readProject(page, restoredId);
  const restoredFiles = await readProjectFiles(page, restoredId);
  check(restored?.writing.chapters.length === project.writing.chapters.length && restoredFiles.length === 2 && restoredFiles.some((item) => item.text === step4Bytes.toString()), "P1-RESTORE", "恢复后 Step 1–8 状态和文件字节完整");

  await projectCard.getByRole("button", { name: "复制下一年度" }).click();
  await page.getByText(/已复制为 2027 年项目/).waitFor({ timeout: 15_000 });
  const summaries = await page.locator("article").allInnerTexts();
  check(summaries.some((text) => text.includes("2027")), "P1-COPY-UI", "下一年度项目出现在项目列表");
  const nextYearId = `${projectId.replace(/-20\d{2}(?:-\d+)?$/, "")}-2027`;
  const nextYear = await readProject(page, nextYearId);
  const nextFiles = await readProjectFiles(page, nextYearId);
  check(nextYear.report.year === 2027 && nextYear.materiality.confirmed === false && nextYear.disclosureRequirements.every((item) => item.userConfirmed === false), "P1-COPY-RESET", "年度、Materiality 和 Requirement 确认正确重置");
  check(nextYear.facts.every((item) => item.state === "待人工确认") && nextYear.quality.runs.length === 0 && nextYear.finalization.versions.length === 0, "P1-COPY-GATES", "Facts、Step 7 和 Step 8 状态正确重置");
  check(nextFiles.length === 2 && nextFiles.every((item) => item.projectId === nextYearId), "P1-COPY-FILES", "年度复制获得隔离的新文件记录");

  const stalePage = await context.newPage();
  await stalePage.goto(`${baseUrl}/reports/${projectId}/step/1`, { waitUntil: "networkidle" });
  await waitForReady(stalePage);
  await page.goto(`${baseUrl}/reports/${projectId}/step/1`, { waitUntil: "networkidle" });
  await waitForReady(page);
  await page.getByLabel("报告联系人姓名").fill("Phase 1 page A");
  await page.getByRole("button", { name: /保存基础信息/ }).click();
  await page.getByText(/已保存项目数据/).waitFor({ timeout: 10_000 });
  await stalePage.getByLabel("报告联系人部门").fill("stale page B");
  await stalePage.getByRole("button", { name: /保存基础信息/ }).click();
  await stalePage.getByText(/另一个页面更新/).waitFor({ timeout: 10_000 });
  check((await readProject(page, projectId)).enterprise.reportingContact.name === "Phase 1 page A", "P1-CONFLICT", "旧 revision 写入被阻止且未覆盖新数据");
  await stalePage.close();

  const legacyId = "phase1-legacy-2026";
  const legacy = structuredClone(await readProject(page, secondId));
  legacy.projectId = legacyId;
  legacy.report.id = legacyId;
  legacy.report.title = "Phase 1 legacy migration";
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: `esg:report-project:${legacyId}:v2`, value: legacy });
  await page.goto(`${baseUrl}/reports/${legacyId}/step/1`, { waitUntil: "networkidle" });
  await waitForReady(page);
  const migrated = await readProject(page, legacyId);
  const legacyStillPresent = await page.evaluate((key) => localStorage.getItem(key) !== null, `esg:report-project:${legacyId}:v2`);
  check(migrated?.migrations.some((item) => item.id === "migration-localstorage-project-v2") && legacyStillPresent, "P1-MIGRATION", "旧 localStorage 项目迁移有记录且旧数据未删除");

  // Simulate a missing file byte without altering its Source record.
  await page.evaluate(async ({ databaseName, fileId }) => {
    const request = indexedDB.open(databaseName);
    const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const transaction = database.transaction("files", "readwrite");
    transaction.objectStore("files").delete(fileId);
    await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
    database.close();
  }, { databaseName: "esg-disclosure-platform", fileId: historySource.fileId });
  await page.goto(`${baseUrl}/reports/${projectId}/step/1`, { waitUntil: "networkidle" });
  await waitForReady(page);
  check((await readProject(page, projectId)).sources.find((item) => item.id === historySource.id)?.fileStatus !== "missing", "P1-MISSING-NONDESTRUCTIVE", "读取时缺失标记不静默改写原项目快照");
  check(await page.getByText("文件缺失", { exact: true }).isVisible(), "P1-MISSING-UI", "文件缺失在界面明确标记且应用不白屏");

  // A malformed record must produce a protected-state message instead of a white screen.
  const corruptId = "phase1-corrupt";
  const corrupt = { ...structuredClone(await readProject(page, secondId)), projectId: corruptId, schemaVersion: 999 };
  corrupt.report.id = corruptId;
  await writeProject(page, corrupt, corruptId);
  await page.goto(`${baseUrl}/reports/${corruptId}/step/1`, { waitUntil: "networkidle" });
  await waitForReady(page);
  check(await page.getByText(/不兼容|保护状态/).isVisible() && await page.getByRole("heading", { name: "创建报告与企业基础画像" }).isVisible(), "P1-CORRUPTION", "损坏数据触发保护提示而非白屏");

  check(browserErrors.length === 0, "P1-BROWSER", "无未处理浏览器错误");
  const output = { generatedAt: new Date().toISOString(), baseUrl, projectId, results, browserErrors };
  fs.writeFileSync(path.join(evidenceDir, "phase1-browser-results.json"), `${JSON.stringify(output, null, 2)}\n`);
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
