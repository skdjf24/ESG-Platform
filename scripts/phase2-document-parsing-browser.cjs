/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { clearProjectDatabase, readProject } = require("./indexeddb-test-helpers.cjs");

const baseUrl = process.env.PHASE2_BASE_URL || "http://127.0.0.1:4326";
const evidenceDir = path.resolve(__dirname, "../docs/acceptance/phase2");
const fixtureDir = path.resolve(__dirname, "../fixtures/phase2");
const results = [];

function check(condition, id, detail) {
  if (!condition) throw new Error(`${id}: ${detail}`);
  results.push({ id, status: "PASS", detail });
  console.log(`PASS ${id} ${detail}`);
}

async function waitForServer(url, timeout = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Development server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function ensureServer() {
  try {
    const response = await fetch(baseUrl);
    if (response.ok) return null;
  } catch {
    // Start an isolated local server below.
  }
  if (process.env.PHASE2_BASE_URL) throw new Error(`PHASE2_BASE_URL is not reachable: ${baseUrl}`);
  const server = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", "4326"], {
    cwd: path.resolve(__dirname, ".."),
    env: process.env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const logPath = path.join(evidenceDir, "dev-server.log");
  const log = fs.createWriteStream(logPath);
  server.stdout.pipe(log);
  server.stderr.pipe(log);
  await waitForServer(baseUrl);
  return { server, log };
}

async function waitForReady(page) {
  await page.locator('[aria-busy="false"]').first().waitFor({ state: "attached", timeout: 30_000 });
}

async function createProject(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "新建报告" }).click();
  await page.locator("#report-name").fill("Phase 2 文件解析验收项目");
  await page.locator("#enterprise").fill("Phase 2 非敏感测试企业");
  await page.locator("#report-year").fill("2026");
  await page.getByRole("button", { name: "创建并开始" }).click();
  await page.waitForURL(/\/reports\/[^/]+\/step\/1/);
  await waitForReady(page);
  return new URL(page.url()).pathname.split("/")[2];
}

async function uploadStep4File(page, projectId, fixtureName) {
  await page.goto(`${baseUrl}/reports/${projectId}/step/4`, { waitUntil: "networkidle" });
  await waitForReady(page);
  await page.getByRole("button", { name: /上传资料/ }).click();
  await page.getByLabel("选择资料文件").setInputFiles(path.join(fixtureDir, fixtureName));
  await page.getByRole("button", { name: "保存来源记录" }).click();
  await page.getByText(/已保存项目数据/).waitFor({ timeout: 20_000 });
}

async function openParsing(page) {
  await page.getByRole("button", { name: /解析结果 \/ 候选确认/ }).click();
}

async function readParsingArtifacts(page, projectId) {
  return page.evaluate(async ({ projectId }) => {
    const request = indexedDB.open("esg-disclosure-platform");
    const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const transaction = database.transaction(["parsedDocuments", "extractionCandidates"], "readonly");
    const documentsRequest = transaction.objectStore("parsedDocuments").index("projectId").getAll(projectId);
    const candidatesRequest = transaction.objectStore("extractionCandidates").index("projectId").getAll(projectId);
    const [documents, candidates] = await Promise.all([
      new Promise((resolve, reject) => { documentsRequest.onsuccess = () => resolve(documentsRequest.result); documentsRequest.onerror = () => reject(documentsRequest.error); }),
      new Promise((resolve, reject) => { candidatesRequest.onsuccess = () => resolve(candidatesRequest.result); candidatesRequest.onerror = () => reject(candidatesRequest.error); }),
    ]);
    database.close();
    return { documents, candidates };
  }, { projectId });
}

async function runMigrationAcceptance(page) {
  await page.goto(`${baseUrl}/reports/hualan-2025/step/1`, { waitUntil: "networkidle" });
  await waitForReady(page);
  const sample = await readProject(page, "hualan-2025");
  const qualitySnapshot = JSON.stringify(sample.quality);
  const finalizationSnapshot = JSON.stringify(sample.finalization);
  await page.evaluate(async ({ sample }) => {
    const databaseName = "esg-disclosure-platform";
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(databaseName);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("v1 migration fixture delete blocked"));
    });
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        const projects = db.createObjectStore("projects", { keyPath: "projectId" });
        projects.createIndex("updatedAt", "updatedAt");
        const files = db.createObjectStore("files", { keyPath: "fileId" });
        files.createIndex("projectId", "projectId");
        files.createIndex("projectAndName", ["projectId", "name"]);
        db.createObjectStore("meta", { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const fileId = "phase1-v1-file";
    sample.sources.push({ id: "source-phase1-v1", name: "phase1-preserved.xlsx", kind: "file", fileType: "XLSX", fileId, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileStatus: "available", parserStatus: "not-started", size: "1 KB", uploadedAt: "2026-11-01", uploadedBy: "migration fixture", state: "已上传" });
    const transaction = database.transaction(["projects", "files", "meta"], "readwrite");
    transaction.objectStore("projects").put({ projectId: sample.projectId, storageSchemaVersion: 1, revision: sample.revision, updatedAt: sample.updatedAt, project: sample });
    transaction.objectStore("files").put({ fileId, projectId: sample.projectId, name: "phase1-preserved.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 23, createdAt: "2026-11-01T00:00:00.000Z", parserStatus: "not-started", blob: new Blob(["PHASE1-PRESERVED-BYTES"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) });
    transaction.objectStore("meta").put({ key: "storage-schema", version: 1 });
    await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
    database.close();
  }, { sample });
  await page.reload({ waitUntil: "networkidle" });
  await waitForReady(page);
  const migration = await page.evaluate(async () => {
    const request = indexedDB.open("esg-disclosure-platform");
    const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const stores = Array.from(database.objectStoreNames);
    const transaction = database.transaction("files", "readonly");
    const get = transaction.objectStore("files").get("phase1-v1-file");
    const file = await new Promise((resolve, reject) => { get.onsuccess = () => resolve(get.result); get.onerror = () => reject(get.error); });
    const text = file ? await file.blob.text() : "";
    const result = { version: database.version, stores, text, checksum: file?.checksum, revision: file?.revision };
    database.close();
    return result;
  });
  const migratedProject = await readProject(page, "hualan-2025");
  check(migration.version === 2 && migration.stores.includes("parsedDocuments") && migration.stores.includes("extractionCandidates"), "P2-BROWSER-MIGRATION-STORES", "IndexedDB v1 原地升级为 v2 并创建两个独立解析仓");
  check(migration.text === "PHASE1-PRESERVED-BYTES" && migration.checksum && migration.revision === 1, "P2-BROWSER-MIGRATION-FILE", "Phase 1 文件字节保留并惰性补充 checksum/revision");
  check(JSON.stringify(migratedProject.quality) === qualitySnapshot && JSON.stringify(migratedProject.finalization) === finalizationSnapshot, "P2-BROWSER-MIGRATION-PROJECT", "Step 1–8、quality 与 finalization 数据迁移无损");
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const managedServer = await ensureServer();
  const bundledChromium = chromium.executablePath();
  const executablePath = process.env.CHROMIUM_EXECUTABLE || (fs.existsSync(bundledChromium) ? bundledChromium : "/usr/bin/chromium");
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    ignoreDefaultArgs: ["--enable-unsafe-swiftshader"],
    args: ["--no-sandbox", "--disable-gpu", "--disable-webgl", "--disable-software-rasterizer", "--use-gl=disabled", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({ viewport: { width: 1800, height: 1180 }, acceptDownloads: true });
  const page = await context.newPage();
  const browserErrors = [];
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(`console: ${message.text()}`); });
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));

  try {
    await runMigrationAcceptance(page);
    await clearProjectDatabase(page);
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    const projectId = await createProject(page);
    check(projectId !== "hualan-2025", "P2-BROWSER-PROJECT", "Phase 2 验收使用独立项目 ID");

    await page.goto(`${baseUrl}/reports/${projectId}/step/7`, { waitUntil: "networkidle" });
    await waitForReady(page);
    await page.getByRole("button", { name: "开始全面检查" }).click();
    await page.getByText(/确定性规则检查已完成/).waitFor({ timeout: 20_000 });
    check(Boolean((await readProject(page, projectId)).quality.fullCheck), "P2-BROWSER-QUALITY-BASELINE", "先建立 Step 7 全面检查基线以验证后续失效传播");

    await uploadStep4File(page, projectId, "phase2-metrics.xlsx");
    await openParsing(page);
    await page.getByRole("button", { name: /phase2-metrics\.xlsx/ }).click();
    await page.getByRole("button", { name: "开始解析" }).click();
    await page.getByText(/已使用 .*浏览器本地解析/).waitFor({ timeout: 30_000 });
    await page.getByRole("button", { name: "能源汇总", exact: true }).click();
    check(await page.getByText("12680", { exact: true }).first().isVisible(), "P2-BROWSER-EXCEL-PREVIEW", "XLSX 真实数值在表格预览可见");
    await page.getByRole("button", { name: /综合能源消耗.*metric/ }).first().click();
    await page.getByLabel("候选统计边界").fill("Phase 2 浏览器验收边界");
    await page.getByRole("button", { name: "人工确认入库" }).click();
    await page.getByText(/指标已人工确认并进入企业事实及 MetricObservation/).waitFor({ timeout: 20_000 });
    let project = await readProject(page, projectId);
    const parsedMetric = project.facts.find((fact) => fact.name === "综合能源消耗" && fact.sourceReferences.some((reference) => reference.fileName === "phase2-metrics.xlsx"));
    check(parsedMetric?.sourceReferences[0].sourceLocator?.cell === "B4", "P2-BROWSER-METRIC-TRACE", "人工确认指标保存结构化 Cell locator");
    check(project.presentation.observations.some((observation) => observation.metricId === parsedMetric.id && observation.confirmationStatus === "已确认"), "P2-BROWSER-STEP6", "确认指标实际进入 Step 6 observation 数据源");
    check(project.quality.stale === true && project.quality.fullCheck?.valid === false, "P2-BROWSER-STEP7", "新增确认指标沿用既有同步机制使 Step 7 检查失效");
    await page.screenshot({ path: path.join(evidenceDir, "01-excel-parser-and-candidate.png"), fullPage: true });

    let artifacts = await readParsingArtifacts(page, projectId);
    const candidateCount = artifacts.candidates.filter((candidate) => candidate.fileId === parsedMetric.sourceReferences[0].fileId).length;
    await page.getByRole("button", { name: "重新解析", exact: true }).click();
    await page.getByText(/已使用 .*浏览器本地解析/).waitFor({ timeout: 30_000 });
    artifacts = await readParsingArtifacts(page, projectId);
    check(artifacts.candidates.filter((candidate) => candidate.fileId === parsedMetric.sourceReferences[0].fileId).length === candidateCount, "P2-BROWSER-DEDUPE", "相同文件重新解析不重复新增候选");
    await page.reload({ waitUntil: "networkidle" });
    await waitForReady(page);
    await openParsing(page);
    await page.getByRole("button", { name: /phase2-metrics\.xlsx/ }).click();
    check(await page.getByRole("button", { name: /综合能源消耗.*confirmed/ }).first().isVisible(), "P2-BROWSER-PERSISTENCE", "刷新后 ParsedDocument 与已确认 candidate 仍可恢复");

    await uploadStep4File(page, projectId, "phase2-structured.docx");
    await openParsing(page);
    await page.getByRole("button", { name: /phase2-structured\.docx/ }).click();
    await page.getByRole("button", { name: "开始解析" }).click();
    await page.getByText(/已使用 .*浏览器本地解析/).waitFor({ timeout: 30_000 });
    await page.getByRole("button", { name: /本测试样本仅用于验证结构化解析/ }).click();
    await page.getByRole("button", { name: "创建事实候选" }).click();
    await page.getByRole("button", { name: "人工确认入库" }).click();
    await page.getByText(/候选已人工确认入库/).waitFor({ timeout: 20_000 });
    await page.getByRole("button", { name: /保留原始资料来源和人工确认记录/ }).click();
    await page.getByRole("button", { name: /基于当前所选片段新增候选/ }).click();
    await page.getByRole("button", { name: "创建制度候选" }).click();
    await page.getByRole("button", { name: "人工确认入库" }).click();
    await page.getByText(/候选已人工确认入库/).waitFor({ timeout: 20_000 });
    project = await readProject(page, projectId);
    check(project.facts.some((fact) => fact.sourceReferences.some((reference) => reference.fileName === "phase2-structured.docx" && reference.sourceLocator?.headingPath?.includes("4.1 环境管理体系"))), "P2-BROWSER-FACT", "DOCX 段落人工确认 Fact 并保留 headingPath/paragraphIndex");
    check(project.resources.some((resource) => resource.confirmed && resource.sourceReferences.some((reference) => reference.fileName === "phase2-structured.docx")), "P2-BROWSER-STEP5", "确认制度实际进入 Step 5 Resource 数据源");
    await page.screenshot({ path: path.join(evidenceDir, "02-docx-source-trace.png"), fullPage: true });

    await uploadStep4File(page, projectId, "phase2-text.pdf");
    await openParsing(page);
    await page.getByRole("button", { name: /phase2-text\.pdf/ }).click();
    await page.getByRole("button", { name: "开始解析" }).click();
    await page.getByText(/已使用 .*浏览器本地解析/).waitFor({ timeout: 30_000 });
    await page.getByRole("button", { name: "第 2 页" }).click();
    check(await page.getByText(/Training coverage.*2026.*94.*percent/).isVisible(), "P2-BROWSER-PDF", "文本型 PDF 第 2 页内容与页码定位真实呈现");
    await page.screenshot({ path: path.join(evidenceDir, "03-pdf-page-preview.png"), fullPage: true });

    await uploadStep4File(page, projectId, "phase2-corrupt.xlsx");
    await openParsing(page);
    await page.getByRole("button", { name: /phase2-corrupt\.xlsx/ }).click();
    await page.getByRole("button", { name: "开始解析" }).click();
    await page.getByText("可恢复的解析错误", { exact: true }).waitFor({ timeout: 20_000 });
    check(await page.getByRole("heading", { name: "ESG 资料收集、汇总与规整" }).isVisible(), "P2-BROWSER-CORRUPT", "损坏文件显示明确错误且 Step 4 不白屏");

    await page.getByRole("button", { name: /phase2-metrics\.xlsx/ }).click();
    await page.getByLabel("替换来源文件").setInputFiles(path.join(fixtureDir, "phase2-metrics-updated.xlsx"));
    await page.getByText(/原始文件已替换.*旧解析快照保留为 stale/).waitFor({ timeout: 20_000 });
    project = await readProject(page, projectId);
    const staleMetric = project.facts.find((fact) => fact.id === parsedMetric.id);
    artifacts = await readParsingArtifacts(page, projectId);
    check(staleMetric.state === "待人工确认" && staleMetric.sourceConfirmationStatus === "待确认", "P2-BROWSER-REPLACE-FACT", "替换源文件不覆盖已确认值，只标记事实待复核");
    check(artifacts.documents.some((document) => document.fileId === parsedMetric.sourceReferences[0].fileId && document.status === "stale"), "P2-BROWSER-REPLACE-DOCUMENT", "替换源文件使旧 ParsedDocument 进入 stale 并保留快照");
    await page.getByRole("button", { name: "重新解析", exact: true }).click();
    await page.getByText(/已使用 .*浏览器本地解析/).waitFor({ timeout: 30_000 });
    artifacts = await readParsingArtifacts(page, projectId);
    check(artifacts.documents.some((document) => document.fileId === parsedMetric.sourceReferences[0].fileId && document.status === "parsed" && document.fileRevision === 2), "P2-BROWSER-REPARSE", "文件 revision 2 可重新解析且旧快照仍独立保留");
    await page.screenshot({ path: path.join(evidenceDir, "04-file-revision-and-review.png"), fullPage: true });

    check(browserErrors.length === 0, "P2-BROWSER-ERRORS", "真实浏览器回归 browserErrors = 0");
    const output = { generatedAt: new Date().toISOString(), baseUrl, projectId, browser: browser.version(), results, browserErrors, pass: results.length, fail: 0 };
    fs.writeFileSync(path.join(evidenceDir, "browser-results.json"), `${JSON.stringify(output, null, 2)}\n`);
  } finally {
    await browser.close();
    if (managedServer) {
      try { process.kill(-managedServer.server.pid, "SIGTERM"); } catch { managedServer.server.kill("SIGTERM"); }
      managedServer.log.end();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
