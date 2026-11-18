/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { readProject, readProjectFiles, writeProject } = require("./indexeddb-test-helpers.cjs");

const baseUrl = process.env.PROJECT_DELETION_BASE_URL || "http://127.0.0.1:4325";
const evidenceDir = path.resolve(__dirname, "../docs/acceptance/project-deletion");
const results = [];
const browserErrors = [];
let fatal;

function check(condition, id, detail) {
  const status = condition ? "PASS" : "FAIL";
  results.push({ id, status, detail });
  console.log(`${status} ${id} ${detail}`);
  if (!condition) throw new Error(`${id}: ${detail}`);
}

function trackErrors(page) {
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(`console: ${message.text()}`); });
  page.on("pageerror", (error) => browserErrors.push(`page: ${error.message}`));
}

async function dashboard(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "本地项目", exact: true }).waitFor();
}

async function ready(page) {
  await page.locator('[aria-busy="false"]').first().waitFor({ timeout: 20_000 });
}

async function create(page, title, enterpriseName, year) {
  await dashboard(page);
  await page.getByRole("button", { name: "新建报告" }).click();
  await page.locator("#report-name").fill(title);
  await page.locator("#enterprise").fill(enterpriseName);
  await page.locator("#report-year").fill(String(year));
  await page.getByRole("button", { name: "创建并开始" }).click();
  await page.waitForURL(/\/reports\/[^/]+\/step\/1/);
  await ready(page);
  return decodeURIComponent(new URL(page.url()).pathname.split("/")[2]);
}

async function upload(page, fileName, content) {
  await page.getByLabel("选择历史报告文件").setInputFiles({
    name: fileName, mimeType: "application/pdf", buffer: Buffer.from(content),
  });
  await page.getByText(/历史报告文件已保存到本地文件仓库/).waitFor();
}

async function addDerived(page, projectId, fileId) {
  await page.evaluate(async ({ projectId, fileId }) => {
    const open = indexedDB.open("esg-disclosure-platform");
    const database = await new Promise((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const transaction = database.transaction(["parsedDocuments", "extractionCandidates"], "readwrite");
    transaction.objectStore("parsedDocuments").put({ parsedDocumentId: `parsed-${projectId}`, projectId, fileId, status: "parsed" });
    transaction.objectStore("extractionCandidates").put({ candidateId: `candidate-${projectId}`, projectId, fileId, status: "pending" });
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  }, { projectId, fileId });
}

async function storedCounts(page, projectId) {
  return page.evaluate(async (projectId) => {
    const open = indexedDB.open("esg-disclosure-platform");
    const database = await new Promise((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const transaction = database.transaction(["projects", "files", "parsedDocuments", "extractionCandidates", "meta"], "readonly");
    const get = (request) => new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const [project, files, parsed, candidates, tombstone] = await Promise.all([
      get(transaction.objectStore("projects").get(projectId)),
      get(transaction.objectStore("files").index("projectId").getAllKeys(projectId)),
      get(transaction.objectStore("parsedDocuments").index("projectId").getAllKeys(projectId)),
      get(transaction.objectStore("extractionCandidates").index("projectId").getAllKeys(projectId)),
      get(transaction.objectStore("meta").get(`deleted-project:${encodeURIComponent(projectId)}`)),
    ]);
    database.close();
    return { project: Boolean(project), files: files.length, parsed: parsed.length, candidates: candidates.length, tombstone: Boolean(tombstone) };
  }, projectId);
}

function card(page, projectId) {
  return page.locator(`article[data-project-id=${JSON.stringify(projectId)}]`);
}

async function openDelete(page, projectId) {
  await card(page, projectId).getByRole("button", { name: /项目操作/ }).click();
  await page.getByRole("menuitem", { name: "删除项目" }).click();
  return page.getByRole("dialog", { name: "删除项目" });
}

async function stat(page, name) {
  return (await page.getByLabel(`${name}统计`).locator("p").nth(1).innerText()).trim();
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  trackErrors(page);
  try {
    await dashboard(page);
    check(await stat(page, "报告项目") === "0", "ISOLATED-START", "独立浏览器 Context 中没有真实用户项目");

    const fileA = "A".repeat(1_200_000);
    const fileB = "B".repeat(120_000);
    const title = "同名 ESG 报告";
    const idA = await create(page, title, "甲企业", 2026);
    await upload(page, "A-history.pdf", fileA);
    const sourceA = (await readProject(page, idA)).sources.find((item) => item.name === "A-history.pdf");
    await addDerived(page, idA, sourceA.fileId);
    const idB = await create(page, title, "乙企业", 2026);
    await upload(page, "B-history.pdf", fileB);
    const sourceB = (await readProject(page, idB)).sources.find((item) => item.name === "B-history.pdf");
    await addDerived(page, idB, sourceB.fileId);
    await dashboard(page);
    check(idA !== idB && await stat(page, "报告项目") === "2" && await stat(page, "真实文件") === "2", "TWO-SAME-NAME", "同名项目按不同 projectId 存在，文件数量为 2");
    check((await storedCounts(page, idA)).parsed === 1 && (await storedCounts(page, idB)).candidates === 1, "DERIVED-SETUP", "两个项目各有文件、解析快照与候选记录");

    const dialogA = await openDelete(page, idA);
    check(await dialogA.getByText(title, { exact: false }).count() > 0 && await dialogA.getByText(idA, { exact: false }).count() > 0
      && await dialogA.getByText("删除后无法恢复。").count() > 0
      && await dialogA.getByText("与该项目关联的本地数据和上传文件也会删除。").count() > 0
      && await dialogA.getByText("建议先导出项目备份。").count() > 0, "CONFIRM-CONTENT", "二次确认显示项目名称、ID 和三项风险提示");
    await page.screenshot({ path: path.join(evidenceDir, "delete-confirm-desktop.png"), fullPage: true });
    await dialogA.getByRole("button", { name: "取消" }).click();
    check((await storedCounts(page, idA)).project && (await storedCounts(page, idA)).files === 1 && await stat(page, "报告项目") === "2", "CANCEL", "取消删除不改变项目、文件及数量");

    const backupDownload = page.waitForEvent("download");
    await card(page, idA).getByRole("button", { name: "导出备份" }).click();
    const backup = await backupDownload;
    const backupBytes = fs.readFileSync(await backup.path());
    const archive = JSON.parse(backupBytes.toString());
    check(archive.manifest.projectId === idA && archive.files.length === 1 && archive.files[0].size === fileA.length, "BACKUP-BEFORE", "删除前可导出包含真实文件字节的项目备份");

    const spaceBefore = await stat(page, "本地空间");
    const usageBefore = (await page.evaluate(() => navigator.storage.estimate())).usage;
    await openDelete(page, idA);
    await page.getByRole("dialog", { name: "删除项目" }).getByRole("button", { name: "确认删除" }).click();
    await card(page, idA).waitFor({ state: "detached" });
    const countsA = await storedCounts(page, idA);
    const countsB = await storedCounts(page, idB);
    check(!countsA.project && !countsA.files && !countsA.parsed && !countsA.candidates && countsA.tombstone, "DELETE-ALL-STORES", "A 的项目、文件字节、解析快照及候选记录均删除并阻止旧存档回流");
    check(countsB.project && countsB.files === 1 && countsB.parsed === 1 && countsB.candidates === 1
      && (await readProjectFiles(page, idB))[0].text.length === fileB.length, "KEEP-OTHER", "B 的项目、文件字节及解析数据未受影响");
    check(await stat(page, "报告项目") === "1" && await stat(page, "真实文件") === "1", "STATS-COUNTS", "项目数及真实文件数立即更新");
    const usageAfter = (await page.evaluate(() => navigator.storage.estimate())).usage;
    const spaceAfter = await stat(page, "本地空间");
    check(typeof usageBefore === "number" && typeof usageAfter === "number" && usageAfter < usageBefore && spaceAfter !== spaceBefore,
      "STATS-SPACE", `本地空间统计已刷新：${spaceBefore} → ${spaceAfter}`);
    await page.reload({ waitUntil: "networkidle" });
    check(await card(page, idA).count() === 0 && await card(page, idB).count() === 1, "DELETE-REFRESH", "刷新后 A 不重新出现，B 仍在");

    const recreatedId = await create(page, title, "甲企业", 2026);
    check(recreatedId === idA, "RECREATE-SAME-NAME", "删除后可以用相同企业名称与年度重新创建原 projectId");
    await dashboard(page);
    await openDelete(page, idA);
    await page.getByRole("dialog", { name: "删除项目" }).getByRole("button", { name: "确认删除" }).click();
    await card(page, idA).waitFor({ state: "detached" });
    await page.getByLabel("选择项目备份").setInputFiles({ name: "A-backup.esgbackup.json", mimeType: "application/json", buffer: backupBytes });
    await card(page, idA).waitFor();
    check((await readProjectFiles(page, idA))[0].text === fileA && (await storedCounts(page, idB)).files === 1,
      "RESTORE-AFTER", "删除后恢复备份可还原 A 的原始文件字节且不影响 B");

    const copyId = idB.replace(/-2026(?:-\d+)?$/, "-2027");
    await card(page, idB).getByRole("button", { name: "复制下一年度" }).click();
    await card(page, copyId).waitFor();
    await openDelete(page, copyId);
    await page.getByRole("dialog", { name: "删除项目" }).getByRole("button", { name: "确认删除" }).click();
    await card(page, copyId).waitFor({ state: "detached" });
    check(!(await storedCounts(page, copyId)).project && (await storedCounts(page, idB)).files === 1, "COPY-DELETE", "下一年度复制项目可独立删除，原项目和文件保留");

    const oldId = await create(page, "旧版中文项目", "中文旧企", 2024);
    await upload(page, "old-history.pdf", "OLD-REAL-BYTES");
    const oldProject = await readProject(page, oldId);
    delete oldProject.projectKind;
    const legacyKey = `esg:report-project:${encodeURIComponent(oldId)}:v2`;
    const legacyWritingKey = `esg:${oldId}:writing:v1`;
    await page.evaluate(({ id, project, legacyKey, legacyWritingKey }) => new Promise((resolve, reject) => {
      localStorage.setItem(legacyKey, JSON.stringify(project));
      localStorage.setItem(legacyWritingKey, "{}");
      const open = indexedDB.open("esg-disclosure-platform");
      open.onsuccess = () => {
        const database = open.result;
        const transaction = database.transaction("projects", "readwrite");
        transaction.objectStore("projects").delete(id);
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
      open.onerror = () => reject(open.error);
    }), { id: oldId, project: oldProject, legacyKey, legacyWritingKey });
    await dashboard(page);
    check(await card(page, oldId).count() === 1 && (await storedCounts(page, oldId)).project, "LEGACY-MIGRATE", "仅存于旧 localStorage 的中文项目重新迁入并可见");
    await openDelete(page, oldId);
    await page.getByRole("dialog", { name: "删除项目" }).getByRole("button", { name: "确认删除" }).click();
    await card(page, oldId).waitFor({ state: "detached" });
    const legacyKeysGone = await page.evaluate(({ legacyKey, legacyWritingKey }) => !localStorage.getItem(legacyKey) && !localStorage.getItem(legacyWritingKey), { legacyKey, legacyWritingKey });
    check(!(await storedCounts(page, oldId)).project && !(await storedCounts(page, oldId)).files && legacyKeysGone, "LEGACY-DELETE", "旧中文项目及旧 localStorage 存档、文件字节均删除");
    await page.reload({ waitUntil: "networkidle" });
    check(await card(page, oldId).count() === 0, "LEGACY-NO-RESURRECT", "旧项目刷新后不会由迁移路径重新出现");

    await page.getByRole("button", { name: "打开示例项目" }).click();
    await page.waitForURL(/\/reports\/public-preview-sample-2025\/step\/1/);
    await ready(page);
    const sampleId = "public-preview-sample-2025";
    const sample = await readProject(page, sampleId);
    check(sample.facts.length > 0 && sample.sources.length > 0, "SAMPLE-SETUP", "系统示例项目有完整示例数据");
    delete sample.projectKind;
    await writeProject(page, sample);
    await dashboard(page);
    await openDelete(page, sampleId);
    await page.getByRole("dialog", { name: "删除项目" }).getByRole("button", { name: "确认删除" }).click();
    await card(page, sampleId).waitFor({ state: "detached" });
    check(!(await storedCounts(page, sampleId)).project && await page.getByRole("button", { name: "打开示例项目" }).count() === 1,
      "SAMPLE-DELETE", "旧版示例数据项目可删除，独立示例入口仍保留");
    await page.getByRole("button", { name: "打开示例项目" }).click();
    await page.waitForURL(/\/reports\/public-preview-sample-2025\/step\/1/);
    await ready(page);
    check((await readProject(page, sampleId)).facts.length > 0, "SAMPLE-REOPEN", "删除后示例入口可重新创建完整示例");

    await dashboard(page);
    const partialKey = `esg:report-project:${encodeURIComponent(idA)}:v2`;
    await page.evaluate(({ key, project }) => {
      localStorage.setItem(key, JSON.stringify(project));
      window.originalRemoveItem = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function (value) {
        if (value === key) throw new Error("simulated legacy cleanup failure");
        return window.originalRemoveItem.call(this, value);
      };
    }, { key: partialKey, project: await readProject(page, idA) });
    await openDelete(page, idA);
    await page.getByRole("dialog", { name: "删除项目" }).getByRole("button", { name: "确认删除" }).click();
    await page.getByRole("alert").getByText(/旧版浏览器存档未清理完毕/).waitFor();
    check(!(await storedCounts(page, idA)).project && await page.evaluate((key) => localStorage.getItem(key) !== null, partialKey),
      "PARTIAL-NOTICE", "旧键清理失败时明确提示，主项目已删除且旧键仍在");
    const otherPage = await context.newPage();
    trackErrors(otherPage);
    await dashboard(otherPage);
    check(await card(otherPage, idA).count() === 0, "PARTIAL-TOMBSTONE", "旧键仍在时，另一页面刷新列表也不会重新迁入项目");
    await otherPage.close();
    await page.evaluate(() => { Storage.prototype.removeItem = window.originalRemoveItem; });
    await page.getByRole("dialog", { name: "删除项目" }).getByRole("button", { name: "确认删除" }).click();
    await page.getByRole("dialog", { name: "删除项目" }).waitFor({ state: "detached" });
    check(await page.evaluate((key) => localStorage.getItem(key) === null, partialKey), "PARTIAL-RETRY", "重试可清理残留旧键并完成删除");

    await page.evaluate(() => {
      window.originalIdbDelete = IDBObjectStore.prototype.delete;
      IDBObjectStore.prototype.delete = function (key) {
        if (this.name === "files") throw new Error("simulated IndexedDB failure");
        return window.originalIdbDelete.call(this, key);
      };
    });
    await openDelete(page, idB);
    await page.getByRole("dialog", { name: "删除项目" }).getByRole("button", { name: "确认删除" }).click();
    await page.getByRole("alert").getByText(/事务已回滚/).waitFor();
    await page.evaluate(() => { IDBObjectStore.prototype.delete = window.originalIdbDelete; });
    check((await storedCounts(page, idB)).project && (await storedCounts(page, idB)).files === 1
      && (await storedCounts(page, idB)).parsed === 1, "ATOMIC-ROLLBACK", "IndexedDB 失败时整笔删除回滚，B 的项目、文件和解析数据均保留");
    await page.getByRole("dialog", { name: "删除项目" }).getByRole("button", { name: "取消" }).click();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(evidenceDir, "project-list-narrow.png"), fullPage: true });
    await openDelete(page, idB);
    await page.screenshot({ path: path.join(evidenceDir, "delete-confirm-narrow.png"), fullPage: true });
    check(await page.getByRole("dialog", { name: "删除项目" }).getByRole("button", { name: "确认删除" }).isVisible(),
      "NARROW-MENU", "窄屏项目操作菜单及确认框可访问");
    await page.getByRole("dialog", { name: "删除项目" }).getByRole("button", { name: "取消" }).click();
    check(browserErrors.length === 0, "BROWSER-ERRORS", "Chromium console/page errors 为零");
  } catch (error) {
    fatal = error instanceof Error ? error.stack : String(error);
    console.error(fatal);
  } finally {
    fs.writeFileSync(path.join(evidenceDir, "results.json"), JSON.stringify({
      baseUrl,
      testedGitHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: path.resolve(__dirname, ".."), encoding: "utf8" }).trim(),
      browserVersion: browser.version(),
      generatedAt: new Date().toISOString(),
      isolation: "Fresh Chromium Browser Context on local server; no Production user storage accessed.",
      totals: { pass: results.filter((item) => item.status === "PASS").length, fail: results.filter((item) => item.status === "FAIL").length },
      results, browserErrors, fatal,
    }, null, 2) + "\n");
    await browser.close();
  }
  if (fatal || results.some((item) => item.status === "FAIL")) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
