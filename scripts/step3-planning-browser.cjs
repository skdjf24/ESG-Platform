/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { isDeepStrictEqual } = require("node:util");
const { mutateProject, readProject, readProjectFiles } = require("./indexeddb-test-helpers.cjs");
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

    const missingTopic = "验收议题：待补证据";
    await mutateProject(page, (project, names) => {
      const first = project.topics.find((topic) => topic.name === names[0]);
      const second = { ...first, id: "topic-acceptance-missing", name: names[1] };
      project.topics.push(second);
      project.materiality.includedTopicIds = [first.id, second.id];
    }, [topicName, missingTopic], id);
    await openStep(page, id, 2);
    await page.getByRole("button", { name: "确认评估结果", exact: true }).click();
    const assessed = await save(page, id, "保存草稿");
    check(assessed.materiality.confirmed, "CONFIRMED-SCOPE", "Step 2 实际确认本次验收项目的两个议题");

    await page.getByRole("button", { name: "下一步", exact: true }).click();
    await page.waitForURL(/\/step\/3$/);
    await ready(page);
    const categories = page.getByRole("group", { name: "资料分类" });
    check(await page.getByRole("heading", { name: "ESG资料收集与整理" }).isVisible()
      && await categories.getByRole("button", { name: /定性资料/ }).getAttribute("aria-pressed") === "true"
      && await categories.getByRole("button", { name: /定量资料/ }).isVisible()
      && !await page.getByText(/披露要求矩阵|披露要求覆盖|用户确认适用性|条款确认度/).count(), "COLLECTION-FIRST", "Step 2 下一步进入资料收集，定性与定量独立分类");

    await page.getByRole("button", { name: "管理部门", exact: true }).click();
    await page.getByLabel("部门名称", { exact: true }).fill("能源项目组");
    const managed = await save(page, id, "保存部门");
    const departmentId = managed.departments.find((item) => item.name === "能源项目组").id;
    await page.getByLabel("部门操作", { exact: true }).selectOption(departmentId);
    await page.getByLabel("部门名称", { exact: true }).fill("能源与资源组");
    const renamedDepartment = await save(page, id, "保存部门");
    check(renamedDepartment.departments.find((item) => item.id === departmentId).name === "能源与资源组"
      && ["hr", "finance", "legal"].every((key) => renamedDepartment.departments.some((item) => item.id === key)), "DEPARTMENTS", "默认部门可用，自定义部门改名后稳定 ID 保留");
    await page.getByRole("button", { name: "关闭部门管理" }).click();

    const itemName = "资源管理年度工作记录及节能项目访谈摘要";
    await page.getByRole("button", { name: "新增资料", exact: true }).click();
    await page.getByLabel("资料名称", { exact: true }).fill("资源管理工作记录");
    await page.getByLabel("资料类型", { exact: true }).selectOption("案例");
    await page.getByLabel("主要负责部门", { exact: true }).selectOption(departmentId);
    for (const name of ["财务部", "法务合规部", /验收议题：资源效率/]) await page.getByRole("checkbox", { name }).check();
    await page.getByLabel("收集方式", { exact: true }).selectOption("在线补充");
    await page.getByLabel("收集状态", { exact: true }).selectOption("收集中");
    const created = await save(page, id, "保存资料");
    const itemId = created.dataRequirements.find((item) => item.itemName === "资源管理工作记录").id;
    check(created.dataRequirements[0].section === "" && created.dataRequirements[0].departmentId === departmentId
      && created.dataRequirements[0].topicIds.includes(assessed.topics.find((item) => item.name === topicName).id)
      && isDeepStrictEqual(created.dataRequirements[0].collaboratorDepartmentIds, ["finance", "legal"]), "UNASSIGNED-MATERIAL", "没有章节关联即可保存定性资料、议题、主责和两个协作部门");
    await page.getByRole("button", { name: "详情与编辑", exact: true }).click();
    await page.getByLabel("资料名称", { exact: true }).fill(itemName);
    await page.getByLabel("截止日期", { exact: true }).fill("2026-12-20");
    await save(page, id, "保存资料");
    await openStep(page, id, 3);
    const qualitativeRow = page.getByRole("row", { name: new RegExp(itemName) });
    await page.getByLabel("部门筛选", { exact: true }).selectOption("hr");
    check(await qualitativeRow.count() === 0, "FILTER-EXCLUDED", "无关部门筛选排除资料");
    await page.getByLabel("部门筛选", { exact: true }).selectOption("finance");
    await page.getByLabel("议题筛选", { exact: true }).selectOption({ label: topicName });
    await page.getByLabel("状态筛选", { exact: true }).selectOption("收集中");
    await page.getByRole("searchbox", { name: "搜索资料任务" }).fill("访谈摘要");
    check(await qualitativeRow.getByText("能源与资源组", { exact: false }).isVisible(), "FILTER-EDIT", "刷新后按协作部门、议题、状态和关键词筛出已编辑的资料");

    await qualitativeRow.getByRole("button", { name: "在线补充", exact: true }).click();
    const resourceName = "验收资料来源记录";
    await page.getByLabel("补充标题").fill(resourceName);
    await page.getByLabel("资料内容").fill("此资料用于验证章节资料来源的保存和读取。");
    const withResource = await save(page, id, "保存来源记录");
    const resource = withResource.resources.find((entry) => entry.title === resourceName);
    check(resource.chapterIds.length === 0 && !resource.confirmed && withResource.sources.find((item) => item.id === resource.sourceReferences[0].sourceId).materialId === itemId, "ONLINE-PENDING", "在线补充关联资料，保持待人工确认且不依赖章节");
    await page.getByLabel("状态筛选", { exact: true }).selectOption("待确认");
    await qualitativeRow.getByRole("button", { name: "详情与编辑" }).click();
    page.once("dialog", (dialog) => dialog.accept());
    const reviewedResource = await save(page, id, "人工确认资料");
    check(reviewedResource.resources.find((item) => item.id === resource.id).confirmed
      && reviewedResource.dataRequirements.find((item) => item.id === itemId).state === "已确认", "ONLINE-REVIEW", "在线内容经显式人工确认后才进入已确认资料");

    await openStep(page, id, 3);
    await categories.getByRole("button", { name: /定量资料/ }).click();
    await page.getByRole("button", { name: "新增资料", exact: true }).click();
    const metricItemName = "总部月度节能量";
    await page.getByLabel("资料名称", { exact: true }).fill(metricItemName);
    await page.getByLabel("主要负责部门", { exact: true }).selectOption("ehs");
    await page.getByRole("checkbox", { name: /验收议题：资源效率/ }).check();
    for (const [label, value] of [["数值", "681.5"], ["单位", "MWh"], ["统计期间", "2026-06"], ["统计范围", "总部"], ["来源位置", "能源汇总 B4"]]) {
      await page.getByLabel(label, { exact: true }).fill(value);
    }
    const draftMetric = await save(page, id, "保存资料");
    const metricItem = draftMetric.dataRequirements.find((item) => item.itemName === metricItemName);
    check(metricItem.quantitative.value === "681.5" && metricItem.quantitative.boundary === "总部"
      && metricItem.section === "" && draftMetric.facts.length === 0, "QUANTITATIVE-DRAFT", "数值、单位、统计期间和范围可单独保存，未人工确认的手填记录不会进事实库");

    const quantitativeRow = page.getByRole("row", { name: new RegExp(metricItemName) });
    await quantitativeRow.getByRole("button", { name: "上传", exact: true }).click();
    const sourceName = "phase2-metrics.xlsx";
    const fixture = path.resolve(__dirname, "../fixtures/phase2", sourceName);
    await page.getByLabel("选择资料文件").setInputFiles(fixture);
    const uploaded = await save(page, id, "保存来源记录");
    const fileSource = uploaded.sources.find((item) => item.name === sourceName);
    const originalFiles = await readProjectFiles(page, id);
    check(fileSource.materialId === metricItem.id && originalFiles.some((item) => item.fileId === fileSource.fileId)
      && uploaded.facts.length === 0, "UPLOAD-BYTES", "Excel 原始字节保存在 IndexedDB，上传本身不会创建事实");
    await page.getByRole("button", { name: /解析结果 \/ 候选确认/ }).click();
    await page.getByRole("button", { name: "开始解析" }).click();
    await page.getByText(/已使用 .*浏览器本地解析/).waitFor({ timeout: 30_000 });
    const parsed = await readProject(page, id);
    check(parsed.sources.find((item) => item.id === fileSource.id).parserStatus === "parsed" && parsed.facts.length === 0, "PARSE-ONLY", "真实解析生成候选，人工确认前事实库仍为空");
    await page.getByRole("button", { name: /综合能源消耗.*metric/ }).first().click();
    await page.getByLabel("候选统计边界").fill("验收企业总部");
    const reviewedMetric = await save(page, id, "人工确认入库");
    const metricFact = reviewedMetric.facts.find((fact) => fact.sourceReferences.some((reference) => reference.sourceId === fileSource.id));
    check(metricFact.state === "已确认" && metricFact.sourceReferences[0].sourceLocator.cell === "B4", "PARSE-REVIEW", "人工确认入库保留 Excel 工作表和单元格定位");
    await page.getByRole("button", { name: /^资料清单/ }).click();
    await categories.getByRole("button", { name: /定量资料/ }).click();
    await quantitativeRow.getByRole("button", { name: "详情与编辑" }).click();
    await page.getByLabel("来源文件或表单").selectOption(fileSource.id);
    await save(page, id, "保存资料");
    await quantitativeRow.getByRole("button", { name: "详情与编辑" }).click();
    page.once("dialog", (dialog) => dialog.accept());
    const withManualMetric = await save(page, id, "人工确认资料");
    check(withManualMetric.facts.some((fact) => fact.name === metricItemName && fact.value === "681.5"
      && fact.period === "2026-06" && fact.sourceReferences[0].fileId === fileSource.fileId), "STRUCTURED-REVIEW", "手填指标完成来源核对后进入事实库并保留来源文件");
    await categories.getByRole("button", { name: /定性资料/ }).click();
    await page.screenshot({ path: path.join(outputDir, "collection.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    const tableLayout = await page.getByRole("table").evaluate((table) => ({
      scroll: table.parentElement.scrollWidth > table.parentElement.clientWidth,
      noWrap: [...table.querySelectorAll("td, th")].every((cell) => getComputedStyle(cell).whiteSpace === "nowrap"),
      pageFits: document.documentElement.scrollWidth === window.innerWidth,
    }));
    check(tableLayout.scroll && tableLayout.noWrap && tableLayout.pageFits, "COLLECTION-NARROW", "窄屏资料表单行，表格容器横向滚动且页面无整体溢出");
    await page.screenshot({ path: path.join(outputDir, "collection-narrow.png"), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });

    await page.getByRole("button", { name: "下一步", exact: true }).click();
    await page.waitForURL(/\/step\/4$/);
    await ready(page);
    await page.getByRole("button", { name: "生成建议大纲", exact: true }).click();
    const suggestions = page.getByLabel("大纲建议列表");
    check(await suggestions.getByText(/验收样本企业 2026 年度的验收议题：资源效率.*2 项确认资料和 2 条确认事实/).isVisible()
      && await suggestions.getByText(/验收议题：待补证据.*0 项确认资料和 0 条确认事实/).isVisible(), "OUTLINE-EVIDENCE", "规则建议读取真实项目画像、已确认评估、最新资料和事实，保留待补证据议题");
    const outlined = await save(page, id, "采用所选建议（2）");
    const suggestedSection = outlined.reportSections.find((item) => item.title === topicName);
    const missingSection = outlined.reportSections.find((item) => item.title === missingTopic);
    check(suggestedSection.materialIds.includes(itemId) && suggestedSection.materialIds.includes(metricItem.id)
      && suggestedSection.factIds.includes(metricFact.id) && outlined.writing.chapters.some((chapter) => chapter.id === missingSection.id)
      && isDeepStrictEqual(outlined.reportSections.filter((section) => withManualMetric.reportSections.some((base) => base.id === section.id)), withManualMetric.reportSections), "OUTLINE-MERGE", "采用规则建议新增两个章节并关联证据，既有章节完整保留");
    await page.getByRole("button", { name: new RegExp(missingTopic) }).click();
    check(await page.getByRole("button", { name: "前往 Step 3 补充资料" }).isVisible(), "OUTLINE-MISSING", "缺少证据的议题章节可保存并标注待补充");

    const title = "验收资源与环境";
    await page.getByRole("button", { name: "新增章节" }).click();
    await page.locator("#new-section-order").fill("10");
    await page.locator("#new-section-title-input").fill(title);
    await page.locator("#new-section-description").fill("核对年度资源管理资料。");
    await page.getByRole("button", { name: "创建章节" }).click();
    await page.getByRole("button", { name: "编辑关联" }).click();
    await page.getByRole("checkbox", { name: new RegExp(topicName) }).check();
    await page.getByText("关联或调整资料与事实", { exact: true }).click();
    await page.getByRole("checkbox", { name: new RegExp(itemName) }).check();
    await page.getByRole("checkbox", { name: new RegExp(metricFact.name) }).check();
    const added = await save(page, id, "保存章节");
    const chapterId = added.reportSections.find((item) => item.title === title).id;
    const chapter = added.reportSections.find((item) => item.id === chapterId);
    check(chapter.topics.includes(topicName) && chapter.materialIds.includes(itemId) && chapter.factIds.includes(metricFact.id), "CHAPTER-LINKS", "人工新增章节，并保存议题、资料及单独指定的事实");

    await openStep(page, id, 3, `?chapterId=${encodeURIComponent(chapterId)}`);
    check(new URL(page.url()).pathname.endsWith("/4") && await page.locator("#section-title").inputValue() === title, "OLD-OUTLINE-LOCATOR", "旧 Step 3 章节深链接跳转 Step 4 对应目录项");
    const renamed = "验收资源管理策略";
    await page.locator("#section-title").fill(renamed);
    await page.locator("#section-order").fill("11");
    const saved = await save(page, id, "保存章节");
    check(saved.writing.chapters.some((item) => item.id === chapterId && item.title === renamed && item.order === "11"), "RENAME-REORDER", "改名及顺序持久化并同步 Step 5 目录");
    await page.screenshot({ path: path.join(outputDir, "outline.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    check(await page.locator("#section-title").isVisible() && await page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth), "OUTLINE-NARROW", "窄屏大纲和章节编辑正常，无全页横向溢出");
    await page.screenshot({ path: path.join(outputDir, "outline-narrow.png"), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "删除章节", exact: true }).click();
    check((await readProject(page, id)).revision === saved.revision, "DELETE-CANCEL", "取消章节移除未保存任何变化");
    page.once("dialog", (dialog) => dialog.accept());
    const removed = await save(page, id, "删除章节");
    check(removed.reportSections.find((item) => item.id === chapterId).sourceState === "upstream-removed"
      && isDeepStrictEqual(removed.writing.chapters.find((item) => item.id === chapterId).blocks, saved.writing.chapters.find((item) => item.id === chapterId).blocks), "ARCHIVE-CHAPTER", "从目录移除章节仍保留正文与关联");
    await page.getByText(/已移除章节（1）/).click();
    const restored = await save(page, id, "恢复章节");
    check(restored.writing.chapters.find((item) => item.id === chapterId).sourceState === "active", "RESTORE-CHAPTER", "恢复章节使用原 ID 和正文");

    await openStep(page, id, 4, `?factId=${encodeURIComponent(metricFact.id)}`);
    check(new URL(page.url()).pathname.endsWith("/3") && await page.getByLabel(`${metricFact.name}数值`).isVisible(), "OLD-FACT-LOCATOR", "旧 Step 4 事实深链接跳转 Step 3 并展开事实");
    await openStep(page, id, 5, `?chapterId=${encodeURIComponent(chapterId)}`);
    check(await page.getByRole("heading", { name: metricFact.name, exact: true }).isVisible(), "STEP5-FACT", "Step 5 可直接查看 Step 4 关联的已确认事实");
    await page.getByRole("tab", { name: "相关资料", exact: true }).click();
    check(await page.getByLabel("章节标题", { exact: true }).inputValue() === renamed
      && await page.getByText(itemName, { exact: true }).isVisible() && await page.getByText(resourceName, { exact: true }).isVisible()
      && !await page.getByRole("tab", { name: "披露要求", exact: true }).count(), "STEP5-RESOURCES", "Step 5 读取更名后的章节、资料任务和已核验定性资料");

    const filesBeforeMigration = await readProjectFiles(page, id);
    const legacyProject = await mutateProject(page, (project, current) => {
      delete project.workflowOrder;
      delete project.departments;
      project.report.currentStep = 3;
      const section = project.reportSections.find((entry) => entry.id === current.chapterId);
      delete section.materialIds;
      const material = project.dataRequirements.find((entry) => entry.id === current.itemId);
      material.section = `${section.order} ${section.title}`;
      delete material.departmentId;
      const block = project.writing.chapters.find((entry) => entry.id === current.chapterId).blocks[0];
      block.sourceReferences = project.facts.find((fact) => fact.id === current.factId).sourceReferences;
    }, { chapterId, itemId, factId: metricFact.id }, id);
    await openStep(page, id, 4, `?chapterId=${encodeURIComponent(chapterId)}`);
    check(await page.getByRole("list", { name: "本章关联资料" }).getByText(new RegExp(itemName)).isVisible(), "LEGACY-MATERIAL-LINK", "读取旧字段恢复历史章节资料关联");
    const upgraded = await save(page, id, "保存章节");
    check(upgraded.workflowOrder === "collection-first" && upgraded.report.currentStep === 4
      && upgraded.reportSections.find((item) => item.id === chapterId).materialIds.includes(itemId)
      && isDeepStrictEqual(upgraded.facts, legacyProject.facts) && isDeepStrictEqual(upgraded.sources, legacyProject.sources)
      && isDeepStrictEqual(upgraded.writing.chapters.map((item) => item.blocks), legacyProject.writing.chapters.map((item) => item.blocks))
      && isDeepStrictEqual(await readProjectFiles(page, id), filesBeforeMigration), "LEGACY-COMPATIBILITY", "保存原版存档只补充新关联和步骤位置，原文件字节、人工确认和正文均保留");

    await page.goto(baseUrl);
    const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "目录与资料链路验收报告", exact: true }) });
    await card.waitFor();
    const download = page.waitForEvent("download");
    await card.getByRole("button", { name: "导出备份" }).click();
    const archive = JSON.parse(fs.readFileSync(await (await download).path(), "utf8"));
    const backupHasOriginal = Buffer.from(archive.files.find((file) => file.name === sourceName).dataBase64, "base64").equals(fs.readFileSync(fixture));
    const restoreId = `${id}-restore`;
    archive.manifest.projectId = restoreId;
    archive.project.projectId = restoreId;
    archive.project.report.id = restoreId;
    for (const file of archive.files) file.projectId = restoreId;
    await page.getByLabel("选择项目备份").setInputFiles({ name: "workflow-restore.esgbackup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(archive)) });
    await page.getByText(/已恢复/).waitFor();
    const restoredCopy = await readProject(page, restoreId);
    const restoredFile = restoredCopy.sources.find((item) => item.id === fileSource.id);
    const restoredDepartmentId = upgraded.dataRequirements.find((item) => item.id === itemId).departmentId;
    check(backupHasOriginal && restoredCopy.departments.some((item) => item.id === restoredDepartmentId && item.name === "能源与资源组")
      && restoredCopy.reportSections.find((item) => item.id === chapterId).materialIds.includes(itemId)
      && restoredCopy.facts.find((item) => item.id === metricFact.id).state === "已确认"
      && restoredCopy.facts.find((item) => item.id === metricFact.id).sourceReferences[0].fileId === restoredFile.fileId
      && restoredCopy.writing.chapters.find((item) => item.id === chapterId).blocks[0].sourceReferences[0].fileId === restoredFile.fileId
      && (await readProjectFiles(page, restoreId)).some((file) => file.fileId === restoredFile.fileId && file.text === originalFiles[0].text), "WORKFLOW-BACKUP", "备份与恢复保留部门、章节资料关联及确认事实，并连接同一原始文件内容");
    const originalCard = card.filter({ has: page.locator("span.font-mono").getByText(id, { exact: true }) });
    await originalCard.getByRole("button", { name: "复制下一年度" }).click();
    await page.getByText(/已复制为 2027 年项目/).waitFor();
    const copiedId = `${id.replace(/-20\d{2}(?:-\d+)?$/, "")}-2027`;
    const copied = await readProject(page, copiedId);
    const copiedFile = copied.sources.find((item) => item.id === fileSource.id);
    check(copied.report.year === 2027 && copied.reportSections.find((item) => item.id === chapterId).materialIds.includes(itemId)
      && !copied.materiality.confirmed && copied.facts.every((item) => item.state === "待人工确认")
      && copied.facts.find((item) => item.id === metricFact.id).sourceReferences[0].fileId === copiedFile.fileId
      && copied.writing.chapters.find((item) => item.id === chapterId).blocks[0].sourceReferences[0].fileId === copiedFile.fileId
      && (await readProjectFiles(page, copiedId)).some((file) => file.fileId === copiedFile.fileId && file.fileId !== fileSource.fileId && file.text === originalFiles[0].text), "WORKFLOW-ANNUAL-COPY", "年度复制保留资料和正文对原始文件的引用，各项目取得独立文件 ID 并重新确认年度数据");

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
