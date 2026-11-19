import assert from "node:assert/strict";
import test from "node:test";
import { esgTopics } from "@/lib/data/mock-data";
import { normalizeProjectData } from "@/lib/project/repository";
import { createBlankProjectData, createSampleProjectData } from "@/lib/project/seed";
import { synchronizeProjectData } from "@/lib/project/synchronize";
import { availableTopicPresets, describeTopicRemoval, unscoredPresetTopic } from "@/lib/project/topics";

test("removes a scored topic and clears only its live links while archiving the original assessment", () => {
  const before = createSampleProjectData("legacy-topic-removal");
  delete before.projectKind;
  const other = createSampleProjectData("other-project");
  const originalTopic = before.topics.find((topic) => topic.id === "topic-energy")!;
  const originalClause = before.disclosureRequirements.find(({ id }) => id === "req-gri-302-1")!;
  const originalChapters = before.writing.chapters;

  const { project: after, impacts } = synchronizeProjectData(before, before, 2, originalTopic.id);
  assert.equal(after.topics.length, before.topics.length - 1);
  assert.ok(!after.topics.some(({ id }) => id === originalTopic.id));
  assert.ok(!after.materiality.includedTopicIds.includes(originalTopic.id));
  assert.equal(after.materiality.confirmed, false);
  assert.equal(after.materiality.confirmedAt, undefined);
  assert.equal(after.materiality.reviewStatus, "待复核");
  assert.equal(after.materiality.revision, before.materiality.revision + 1);

  const clause = after.disclosureRequirements.find(({ id }) => id === originalClause.id)!;
  assert.deepEqual(clause, {
    ...originalClause, topic: "", originalTopic: originalTopic.name,
    userConfirmed: false, reviewStatus: "待复核", revision: originalClause.revision + 1,
  });
  assert.deepEqual(after.disclosureRequirements.filter(({ id }) => id !== clause.id), before.disclosureRequirements.filter(({ id }) => id !== clause.id));
  assert.deepEqual(after.reportSections.map(({ id }) => id), before.reportSections.map(({ id }) => id));
  assert.deepEqual(after.reportSections.filter(({ topicReviewStatus }) => topicReviewStatus === "待复核").map(({ id }) => id), ["section-4", "section-4-2"]);
  assert.ok(after.reportSections.every(({ topics }) => !topics.includes(originalTopic.name)));
  assert.deepEqual(after.reportSections.find(({ id }) => id === "section-4")?.topics, ["气候变化", "污染物排放"]);
  assert.equal(after.writing.chapters.find(({ id }) => id === "section-4-2")?.reviewStatus, "待复核");
  assert.deepEqual(after.writing.chapters.flatMap(({ blocks }) => blocks.map(({ id, html, citations }) => ({ id, html, citations }))),
    originalChapters.flatMap(({ blocks }) => blocks.map(({ id, html, citations }) => ({ id, html, citations }))));
  for (const key of ["sources", "facts", "dataRequirements", "resources", "presentation", "finalization"] as const) {
    assert.deepEqual(after[key], before[key]);
  }
  assert.deepEqual(after.writing.versions, before.writing.versions);

  assert.equal(impacts.length, 1);
  assert.equal(impacts[0].entityId, originalTopic.id);
  assert.deepEqual(impacts[0].topicRemoval?.topic, originalTopic);
  assert.deepEqual(impacts[0].topicRemoval?.assessment, before.materiality);
  assert.equal(impacts[0].topicRemoval?.requirements[0].userConfirmed, true);
  assert.deepEqual(impacts[0].topicRemoval?.sectionIds, ["section-4", "section-4-2"]);
  assert.deepEqual(normalizeProjectData(JSON.parse(JSON.stringify(after)), before.projectId).impacts, JSON.parse(JSON.stringify(after.impacts)));
  assert.equal(before.topics.length, other.topics.length);
  assert.ok(other.topics.some(({ id }) => id === originalTopic.id));
});

test("removes an unsaved custom topic and preserves other draft edits", () => {
  const before = createBlankProjectData("draft-topic-removal");
  const draft = structuredClone(before);
  draft.topics[0].financialScore = 3;
  draft.topics.push({ id: "custom", name: "社区参与", category: "S", origin: "用户新增", financialScore: 4.4, impactScore: 4.7, confirmed: false });
  draft.materiality.includedTopicIds.push("custom");
  const { project, impacts } = synchronizeProjectData(before, draft, 2, "custom");
  assert.equal(project.topics.length, before.topics.length);
  assert.equal(project.topics[0].financialScore, 3);
  assert.ok(!project.materiality.includedTopicIds.includes("custom"));
  assert.equal(impacts.find((impact) => impact.topicRemoval)?.topicRemoval?.topic.impactScore, 4.7);
  assert.throws(() => synchronizeProjectData(project, project, 2, "custom"), /议题已不在当前项目中/);
});

test("keeps the saved confirmation when deleting after new scores were entered", () => {
  const saved = createSampleProjectData("delete-after-unsaved-score");
  const draft = structuredClone(saved);
  draft.topics.find(({ id }) => id === "topic-energy")!.financialScore = 4.8;
  draft.materiality.confirmed = false;
  draft.materiality.confirmedAt = undefined;
  const { impacts } = synchronizeProjectData(saved, draft, 2, "topic-energy");
  const record = impacts.find(({ topicRemoval }) => topicRemoval)?.topicRemoval;
  assert.equal(record?.topic.financialScore, 4.8);
  assert.equal(record?.lastSavedConfirmation?.topic.financialScore, 4.2);
  assert.equal(record?.lastSavedConfirmation?.assessment.confirmedAt, saved.materiality.confirmedAt);
});

test("deletion of a historic duplicate name never drops the other topic's associations", () => {
  const before = createSampleProjectData("duplicate-topic-history");
  const duplicate = { ...before.topics.find(({ id }) => id === "topic-energy")!, id: "historic-energy" };
  before.topics.push(duplicate);
  before.materiality.includedTopicIds.push(duplicate.id);
  const { project: after } = synchronizeProjectData(before, before, 2, duplicate.id);
  assert.ok(after.topics.some(({ id }) => id === "topic-energy"));
  assert.ok(after.materiality.includedTopicIds.includes("topic-energy"));
  assert.deepEqual(after.disclosureRequirements, before.disclosureRequirements);
  assert.deepEqual(after.reportSections, before.reportSections);
});

test("an excluded topic used downstream is still detached and reviewed", () => {
  const before = createSampleProjectData("delete-excluded-topic");
  const topic = before.topics.find(({ id }) => id === "topic-energy")!;
  Object.assign(topic, { financialScore: 0, impactScore: 0, confirmed: false });
  before.materiality.includedTopicIds = before.materiality.includedTopicIds.filter((id) => id !== topic.id);
  assert.equal(describeTopicRemoval(before, topic.id, before)?.included, false);
  const { project: after } = synchronizeProjectData(before, before, 2, topic.id);
  assert.equal(after.materiality.reviewStatus, "待复核");
  assert.equal(after.disclosureRequirements.find(({ id }) => id === "req-gri-302-1")?.topic, "");
  assert.equal(after.reportSections.find(({ id }) => id === "section-4-2")?.topicReviewStatus, "待复核");
});

test("an unused topic does not invalidate an unrelated confirmation and the preset can be re-added without scores", () => {
  const before = createBlankProjectData("restore-preset");
  before.materiality.includedTopicIds = ["topic-climate"];
  before.materiality.confirmed = true;
  const { project: after } = synchronizeProjectData(before, before, 2, "topic-energy");
  assert.deepEqual(after.materiality, before.materiality);
  const template = availableTopicPresets(after.topics).find(({ id }) => id === "topic-energy")!;
  assert.equal(esgTopics.find(({ id }) => id === template.id)?.financialScore, 4.2);
  const restored = unscoredPresetTopic(template);
  assert.equal(restored.financialScore, 0);
  assert.equal(restored.impactScore, 0);
  assert.equal(restored.confirmed, false);
  assert.equal(restored.origin, "通用候选");
  assert.ok(!availableTopicPresets([...after.topics, restored]).some(({ id }) => id === restored.id));
  assert.ok(!availableTopicPresets([...after.topics, { ...restored, id: "user-energy" }]).some(({ id }) => id === restored.id));
});
