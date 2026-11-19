import assert from "node:assert/strict";
import test from "node:test";
import { createBlankProjectData, createSampleProjectData } from "@/lib/project/seed";
import { normalizeProjectData } from "@/lib/project/repository";
import { chapterEvidence, confirmQuantitativeMaterial, materialState } from "@/lib/project/materials";
import { appendSuggestedSections, needsChapterMaterials, suggestReportOutline } from "@/lib/project/outline";
import { synchronizeProjectData } from "@/lib/project/synchronize";
import { executeQualityCheck } from "@/lib/quality/engine";
import { getStep8QualityGate, qualityInputFingerprint } from "@/lib/quality/validity";
import type { QualityCheckState } from "@/lib/types/quality";
import { createBlock } from "@/lib/writing/document";
import legacyQuality from "./fixtures/legacy-disclosure-quality.json";

test("renaming and adding chapters synchronizes materials and writing, preserving the old disclosure snapshot", () => {
  const before = createSampleProjectData("outline-legacy-project");
  const draft = structuredClone(before);
  const section = draft.reportSections.find(({ id }) => id === "section-4-2")!;
  section.title = "能耗与节能措施";
  section.order = "4.1";
  draft.reportSections.push({ id: "section-test", order: "1.1", title: "报告说明补充", level: 2, description: "", topics: ["能源管理"], state: "待完善", sourceState: "active", requirementCount: 0, revision: 1 });
  const { project } = synchronizeProjectData(before, draft, 4);
  assert.equal(project.dataRequirements.find(({ id }) => id === "data-energy")?.section, "4.1 能耗与节能措施");
  assert.deepEqual(project.reportSections.slice(0, 2).map(({ id }) => id), ["section-1", "section-test"]);
  const renamed = project.writing.chapters.find(({ id }) => id === section.id)!;
  const original = before.writing.chapters.find(({ id }) => id === section.id)!;
  assert.equal(renamed.title, section.title);
  assert.deepEqual(renamed.blocks, original.blocks);
  assert.deepEqual(project.writing.chapters.find(({ id }) => id === "section-test")?.blocks[0].mappings, []);
  assert.deepEqual(project.disclosureRequirements, before.disclosureRequirements);
  assert.deepEqual(project.facts, before.facts);
  assert.deepEqual(project.sources, before.sources);
});

test("changing framework references does not change archived applicability or the current quality fingerprint", () => {
  const before = createSampleProjectData("reference-frameworks");
  const draft = structuredClone(before);
  draft.report.frameworks = ["北交所指引"];
  const { project } = synchronizeProjectData(before, draft, 1);
  assert.deepEqual(project.report.frameworks, ["北交所指引"]);
  assert.deepEqual(project.disclosureRequirements, before.disclosureRequirements);
  assert.deepEqual(project.writing.chapters, before.writing.chapters);
  assert.equal(qualityInputFingerprint(project), qualityInputFingerprint(before));
});

test("saving materials alone preserves edits in the writing workbench", () => {
  const before = createSampleProjectData("keep-authored-content");
  before.writing.chapters[0].title = "用户已编辑的正文标题";
  const draft = structuredClone(before);
  draft.dataRequirements[0].itemName = "年度能源利用记录";
  const { project } = synchronizeProjectData(before, draft, 3);
  assert.deepEqual(project.writing.chapters.map((chapter) => chapter.blocks), before.writing.chapters.map((chapter) => chapter.blocks));
  assert.equal(project.writing.chapters[0].title, before.writing.chapters[0].title);
  assert.equal(project.writing.chapters.find((chapter) => chapter.id === "section-4-2")?.reviewStatus, "待复核");
  assert.equal(project.dataRequirements[0].itemName, "年度能源利用记录");
});

test("a new full check retains retired issues, coverage and actions without blocking Step 8", () => {
  const before = createBlankProjectData("legacy-disclosure-fixture");
  before.quality = { ...before.quality, ...structuredClone(legacyQuality) as Pick<QualityCheckState, "issues" | "runs" | "coverage" | "actions" | "fullCheck"> };
  const loaded = normalizeProjectData(JSON.parse(JSON.stringify(before)), before.projectId);
  assert.ok(!getStep8QualityGate(loaded).validFullCheck);
  const checked = executeQualityCheck(loaded, "full");
  assert.deepEqual(checked.quality.issues, loaded.quality.issues);
  assert.deepEqual(checked.quality.actions, loaded.quality.actions);
  assert.deepEqual(checked.quality.coverage, loaded.quality.coverage);
  assert.deepEqual(checked.quality.runs[0], loaded.quality.runs[0]);
  assert.deepEqual(checked.quality.runs.at(-1)?.issueIds, []);
  assert.equal(checked.quality.summary.verifiedCoverageCount, 0);
  assert.equal(checked.quality.summary.blockerCount, 0);
  assert.ok(getStep8QualityGate(checked).canSubmit);
});

test("historical mappings do not affect current input, but a missing factual citation still blocks finalization", () => {
  const project = createBlankProjectData("evidence-is-checked");
  const chapter = project.writing.chapters[0];
  const block = createBlock(chapter.id, "paragraph");
  block.html = "<p>本报告介绍节能措施及日常维护工作。</p>";
  chapter.blocks.push(block);
  const fingerprint = qualityInputFingerprint(project);
  block.mappings.push({ requirementId: "obsolete-clause", coverage: "待核验" });
  project.reportSections[0].requirementCount = 99;
  assert.equal(qualityInputFingerprint(project), fingerprint);
  assert.ok(getStep8QualityGate(executeQualityCheck(project, "full")).canSubmit);
  block.citations.push({ factId: "missing-source-fact", factRevision: 1 });
  const checked = executeQualityCheck(project, "full");
  assert.ok(checked.quality.issues.some((issue) => issue.ruleId === "SRC-001" && issue.severity === "阻断"));
  assert.ok(!getStep8QualityGate(checked).canSubmit);
});

test("pre-swap project records migrate once without replacing authorship, evidence or confirmations", () => {
  const legacy = createSampleProjectData("legacy-workflow-order");
  delete legacy.workflowOrder;
  delete legacy.departments;
  legacy.report.currentStep = 4;
  legacy.dataRequirements[0].responsibleDepartment = "历史自定义部门";
  legacy.dataRequirements[0].state = "已确认";
  const loaded = normalizeProjectData(legacy, legacy.projectId);
  assert.equal(loaded.report.currentStep, 3);
  assert.equal(loaded.dataRequirements[0].state, "已确认");
  assert.equal(loaded.departments?.find((item) => item.id === loaded.dataRequirements[0].departmentId)?.name, "历史自定义部门");
  assert.ok(chapterEvidence(loaded, "section-4-2").materials.some((item) => item.id === "data-energy"));
  assert.deepEqual(loaded.writing, legacy.writing);
  assert.deepEqual(loaded.sources, legacy.sources);
  assert.deepEqual(loaded.facts, legacy.facts);
  assert.deepEqual(loaded.disclosureRequirements, legacy.disclosureRequirements);
  assert.deepEqual(normalizeProjectData(loaded, legacy.projectId), loaded);
});

test("outline suggestions keep evaluated topics with missing material and merge only new sections", () => {
  const project = createBlankProjectData("outline-suggestions", { enterpriseName: "测试企业", year: 2026 });
  const [first, second] = project.topics;
  project.materiality = { ...project.materiality, includedTopicIds: [first.id, second.id], confirmed: true };
  project.topics = [{ ...first, financialScore: 4.5, impactScore: 4.6 }, { ...second, financialScore: 4.0, impactScore: 4.2 }];
  const material = { ...createSampleProjectData("other").dataRequirements[0], section: "", id: "unassigned", topicIds: [first.id] };
  project.dataRequirements = [material];
  const suggestions = suggestReportOutline(project);
  assert.deepEqual(suggestions.find((item) => item.id === first.id)?.materialIds, [material.id]);
  assert.deepEqual(suggestions.find((item) => item.id === second.id)?.materialIds, []);
  assert.match(suggestions.find((item) => item.id === first.id)!.description, /测试企业 2026/);
  const reportSections = appendSuggestedSections(project.reportSections, suggestions);
  assert.deepEqual(reportSections.slice(0, project.reportSections.length), project.reportSections);
  const added = reportSections.find((section) => section.title === second.name)!;
  assert.ok(added);
  const saved = synchronizeProjectData(project, { ...project, reportSections }, 4).project;
  assert.ok(needsChapterMaterials(chapterEvidence(saved, added.id)));
  assert.ok(saved.writing.chapters.some((chapter) => chapter.id === added.id));
  assert.deepEqual(appendSuggestedSections(saved.reportSections, suggestReportOutline(saved)), saved.reportSections);
});

test("structured metric stays draft until confirmation, then source and revision propagate to writing and charts", () => {
  const project = createBlankProjectData("material-metric");
  const template = createSampleProjectData("other");
  const [source] = template.sources;
  const material = {
    ...template.dataRequirements[0], section: "", id: "unassigned", state: "待确认" as const,
    quantitative: { value: "1,234.5", unit: "MWh", period: "2026", boundary: "总部", locator: "能源!B4", sourceId: source.id },
  };
  project.dataRequirements = [material];
  project.sources = [{ ...source, kind: "file", fileStatus: "available", fileId: "isolated-test-file" }];
  project.reportSections[0].materialIds = [material.id];
  assert.deepEqual(chapterEvidence(project, project.reportSections[0].id).facts, []);
  assert.throws(() => confirmQuantitativeMaterial(project, { ...material, quantitative: { ...material.quantitative, value: ",," } }));
  const confirmed = synchronizeProjectData(project, confirmQuantitativeMaterial(project, material), 3).project;
  const fact = confirmed.facts[0];
  assert.equal(fact.value, "1234.5");
  assert.equal(fact.sourceReferences[0].locator, "能源!B4");
  assert.equal(confirmed.presentation.observations[0].confirmationStatus, "已确认");
  assert.equal(materialState(confirmed.dataRequirements[0]), "已确认");
  assert.ok(chapterEvidence(confirmed, project.reportSections[0].id).facts.some((item) => item.id === fact.id));

  const block = createBlock(confirmed.writing.chapters[0].id, "paragraph");
  confirmed.writing.chapters[0].blocks.push(block);
  block.citations.push({ factId: fact.id, factRevision: fact.revision });
  const draft = structuredClone(confirmed);
  draft.dataRequirements[0].quantitative!.value = "1400";
  draft.dataRequirements[0].state = "待确认";
  const revised = synchronizeProjectData(confirmed, draft, 3).project;
  assert.equal(revised.facts[0].state, "待人工确认");
  assert.equal(revised.facts[0].value, fact.value);
  assert.equal(revised.writing.chapters[0].blocks[0].html, block.html);
  assert.deepEqual(revised.writing.chapters[0].blocks[0].citations, block.citations);
  assert.equal(revised.writing.chapters[0].blocks[0].reviewStatus, "待复核");
});

test("archiving and restoring an outline section preserves its authored blocks and review records", () => {
  const project = createBlankProjectData("archive-outline");
  const chapter = project.writing.chapters[0];
  const block = createBlock(chapter.id, "paragraph");
  block.citations.push({ factId: "missing-test-fact", factRevision: 1 });
  chapter.blocks.push(block);
  const draft = structuredClone(project);
  draft.reportSections[0].sourceState = "upstream-removed";
  const removed = synchronizeProjectData(project, draft, 4).project;
  assert.equal(removed.writing.chapters[0].sourceState, "upstream-removed");
  assert.deepEqual(removed.writing.chapters[0].blocks, chapter.blocks);
  assert.ok(getStep8QualityGate(executeQualityCheck(removed, "full")).canSubmit);
  const restoredDraft = structuredClone(removed);
  restoredDraft.reportSections[0].sourceState = "active";
  const restored = synchronizeProjectData(removed, restoredDraft, 4).project;
  assert.deepEqual(restored.writing.chapters[0].blocks, chapter.blocks);
  assert.equal(restored.writing.chapters[0].sourceState, "active");
  assert.ok(!getStep8QualityGate(executeQualityCheck(restored, "full")).canSubmit);
});
