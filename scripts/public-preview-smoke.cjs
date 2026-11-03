/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { clearProjectDatabase } = require("./indexeddb-test-helpers.cjs");

const baseUrl = process.env.PUBLIC_PREVIEW_BASE_URL || "http://127.0.0.1:4325";
const results = [];
const browserErrors = [];

function check(condition, name, detail = "") {
  if (!condition) throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
  results.push({ name, status: "PASS", detail });
  console.log(`PASS ${name}`);
}

function captureErrors(page, label) {
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(`${label} console: ${message.text()}`); });
  page.on("pageerror", (error) => browserErrors.push(`${label} page: ${error.message}`));
}

async function openHome(page) {
  const response = await page.goto(baseUrl, { waitUntil: "networkidle" });
  check(Boolean(response?.ok()), "公开首页 HTTP 200");
  await page.getByRole("heading", { name: "我的 ESG 报告项目" }).waitFor();
}

async function createProject(page, title, enterprise) {
  await page.getByRole("button", { name: "新建报告" }).click();
  await page.getByLabel("报告名称").fill(title);
  await page.getByLabel("企业名称").fill(enterprise);
  await page.getByLabel("报告年度").fill("2026");
  await page.getByRole("button", { name: "创建并开始" }).click();
  await page.waitForURL(/\/reports\/[^/]+\/step\/1$/);
  return new URL(page.url()).pathname.split("/")[2];
}

async function main() {
  const bundledChromium = chromium.executablePath();
  const executablePath = process.env.CHROMIUM_EXECUTABLE || (fs.existsSync(bundledChromium) ? bundledChromium : "/usr/bin/chromium");
  const browser = await chromium.launch({ headless: true, executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const contextA = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const contextB = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  captureErrors(pageA, "A"); captureErrors(pageB, "B");

  await openHome(pageA);
  check(await pageA.getByText("Public Preview v0.1", { exact: true }).first().isVisible(), "Public Preview 版本可见");
  check(await pageA.getByRole("region", { name: "公开试用版说明" }).isVisible(), "本地存储与隐私说明可见");
  check(await pageA.getByRole("button", { name: "打开示例项目" }).isVisible(), "示例项目入口可见");
  check(await pageA.getByRole("button", { name: "新建报告" }).isVisible(), "新建报告入口可见");

  const aiStatusResponse = await pageA.request.get(`${baseUrl}/api/ai/status`);
  const aiStatus = await aiStatusResponse.json();
  check(aiStatusResponse.ok() && aiStatus.configured === false, "公开版 AI 默认未配置");
  check(!Object.keys(aiStatus).some((key) => /key|secret|token/i.test(key)), "AI 状态接口不暴露 Secret 字段");

  await pageA.getByRole("button", { name: "打开示例项目" }).click();
  await pageA.waitForURL(/\/reports\/public-preview-sample-2025\/step\/1$/);
  check(await pageA.getByLabel("企业全称").inputValue() === "华澜新材料（示例）", "示例项目可直接打开且明确标识为示例");
  for (let step = 1; step <= 8; step += 1) {
    const response = await pageA.goto(`${baseUrl}/reports/public-preview-sample-2025/step/${step}`, { waitUntil: "networkidle" });
    check(Boolean(response?.ok()), `公开 Step ${step} 路由可打开`);
  }

  await pageA.goto(baseUrl, { waitUntil: "networkidle" });
  const projectA = "Public Preview User A";
  const projectAId = await createProject(pageA, projectA, "公开试用企业 A");
  check(Boolean(projectAId) && projectAId !== "hualan-2025", "新项目获得动态 projectId", projectAId);
  await pageA.reload({ waitUntil: "networkidle" });
  await pageA.goto(baseUrl, { waitUntil: "networkidle" });
  check(await pageA.getByText(projectA, { exact: true }).isVisible(), "Context A 刷新后项目仍存在");

  await openHome(pageB);
  check(await pageB.getByText(projectA, { exact: true }).count() === 0, "Context B 看不到 Context A 项目");
  const projectB = "Public Preview User B";
  await createProject(pageB, projectB, "公开试用企业 B");
  await pageB.goto(baseUrl, { waitUntil: "networkidle" });
  check(await pageB.getByText(projectB, { exact: true }).isVisible(), "Context B 可创建独立项目");
  await pageA.reload({ waitUntil: "networkidle" });
  check(await pageA.getByText(projectB, { exact: true }).count() === 0, "Context A 看不到 Context B 项目");

  await clearProjectDatabase(pageA);
  await pageA.reload({ waitUntil: "networkidle" });
  check(await pageA.getByText(projectA, { exact: true }).count() === 0, "清除 Context A 站点数据后其本地项目消失");
  await pageB.reload({ waitUntil: "networkidle" });
  check(await pageB.getByText(projectB, { exact: true }).isVisible(), "清除 Context A 不影响 Context B");
  check(browserErrors.length === 0, "公开预览 console/page error 为 0", browserErrors.join(" | "));

  const output = { generatedAt: new Date().toISOString(), baseUrl, browser: "Chromium", executablePath, results, browserErrors };
  const outputPath = path.resolve(__dirname, "../docs/releases/public-preview-v0.1/public-url-smoke-results.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  await browser.close();
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
