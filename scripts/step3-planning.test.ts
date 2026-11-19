import assert from "node:assert/strict";
import test from "node:test";
import { createBlankProjectData, createSampleProjectData } from "@/lib/project/seed";
import { normalizeProjectData } from "@/lib/project/repository";
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
  const { project } = synchronizeProjectData(before, draft, 3);
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
  assert.deepEqual(project.writing, before.writing);
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
