import assert from "node:assert/strict";
import { createBlankProjectData, createSampleProjectData } from "../lib/project/seed";
import { normalizeProjectData } from "../lib/project/repository";
import { getIndustry, industries, industryChildren, industryPath, searchIndustries } from "../lib/industry/classification";
import { projectIdFromRoute } from "../lib/project/route-id";

const results: string[] = [];
function check(id: string, condition: boolean) {
  assert.ok(condition, id);
  results.push(id);
  console.log(`PASS ${id}`);
}

const blank = createBlankProjectData("p0-test-2026", { title: "远山实业 ESG 报告", enterpriseName: "远山实业", year: 2026 });
const sample = createSampleProjectData("p0-sample-2025");
check("blank-identity", blank.projectKind === "blank" && blank.enterprise.name === "远山实业" && blank.report.title === "远山实业 ESG 报告" && blank.report.year === 2026);
check("blank-profile", blank.enterprise.unifiedSocialCreditCode === "" && blank.enterprise.headquarters === "" && blank.enterprise.employeeCount === null && blank.enterprise.stockCode === "" && blank.enterprise.reportingContact.name === "");
check("blank-boundary-framework", blank.boundary.items.length === 0 && blank.boundary.note === "" && blank.report.frameworks.length === 0);
check("blank-topics", blank.topics.length > 0 && blank.topics.every((topic) => topic.origin === "通用候选" && topic.financialScore === 0 && topic.impactScore === 0 && !topic.confirmed) && !blank.materiality.confirmed);
check("blank-step3", blank.disclosureRequirements.length === 0 && blank.dataRequirements.length === 0 && blank.reportSections.every((section) => section.state === "待完善" && section.requirementCount === 0));
check("blank-step4-6", blank.sources.length === 0 && blank.facts.length === 0 && blank.resources.length === 0 && blank.writing.chapters.every((chapter) => chapter.blocks.length === 0) && blank.presentation.observations.length === 0 && blank.presentation.charts.length === 0);
check("blank-step7-8", blank.quality.runs.length === 0 && !blank.quality.fullCheck && blank.finalization.versions.length === 0 && blank.report.progress === 0 && blank.report.currentStep === 1);
check("blank-no-sample-text", !/华澜新材料|林悦|12860|12,680|独立模拟测试/.test(JSON.stringify(blank)));
check("blank-timestamps", blank.createdAt === blank.updatedAt && Math.abs(Date.now() - Date.parse(blank.createdAt)) < 10_000);
check("sample-preserved", sample.projectKind === "sample" && sample.facts.length > 0 && sample.sources.length > 0 && sample.writing.chapters.some((chapter) => chapter.blocks.length > 1) && sample.presentation.observations.length > 0);
check("normalize-legacy", normalizeProjectData({ ...sample, projectKind: undefined }, sample.projectId).facts.length === sample.facts.length);
check("project-isolation", blank.enterprise !== sample.enterprise && blank.facts !== sample.facts && blank.writing.chapters !== sample.writing.chapters);
check("unicode-route-id", projectIdFromRoute(encodeURIComponent("远山实业-2026")) === "远山实业-2026" && projectIdFromRoute("ascii-2026") === "ascii-2026");

const counts = [1, 2, 3, 4].map((level) => industries.filter((item) => item.level === level).length);
check("official-counts", counts.join(",") === "20,97,473,1382");
check("unique-codes", new Set(industries.map((item) => item.code)).size === industries.length);
check("parent-hierarchy", industries.every((item) => item.level === 1 ? item.parentCode === null : Boolean(item.parentCode && industries.some((parent) => parent.code === item.parentCode && parent.level === item.level - 1))));
check("legacy-c26-c27", getIndustry("C26")?.code === "26" && getIndustry("C27")?.code === "27" && industryPath("C26").map((item) => item.code).join("/") === "C/26");
check("amendment-9233", getIndustry("9233")?.name === "人民检察院" && industryPath("9233").map((item) => item.code).join("/") === "S/92/923/9233");
check("code-name-search", searchIndustries("C26").some((item) => item.code === "26") && searchIndustries("软件和信息技术服务业").some((item) => item.code === "65"));
check("cascading", industryChildren(null).length === 20 && industryChildren("C").some((item) => item.code === "26") && industryChildren("26").length > 0);
console.log(`P0 INIT/INDUSTRY ${results.length} PASS / 0 FAIL`);
