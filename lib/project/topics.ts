import { esgTopics } from "@/lib/data/mock-data";
import type { EsgTopic } from "@/lib/types/esg";
import type { ReportProjectData } from "@/lib/types/project-data";

export function unscoredPresetTopic({ id, name, category }: EsgTopic): EsgTopic {
  return { id, name, category, origin: "通用候选", financialScore: 0, impactScore: 0, confirmed: false };
}

export function availableTopicPresets(topics: EsgTopic[]) {
  return esgTopics.filter((preset) => !topics.some((topic) =>
    topic.id === preset.id || topic.name.trim().toLowerCase() === preset.name.toLowerCase()));
}

export function describeTopicRemoval(project: ReportProjectData, id: string, savedProject: ReportProjectData) {
  const topic = project.topics.find((item) => item.id === id);
  if (!topic) return undefined;
  // Legacy associations are by name. Keep them if another topic still owns that name.
  const sharedName = project.topics.some((item) => item.id !== id && item.name === topic.name);
  const requirements = sharedName ? [] : project.disclosureRequirements.filter((item) => item.topic === topic.name);
  const sections = sharedName ? [] : project.reportSections.filter((item) => item.topics.includes(topic.name));
  const included = project.materiality.includedTopicIds.includes(id);
  const scored = topic.financialScore >= 1 || topic.impactScore >= 1;
  const savedTopic = savedProject.topics.find((item) => item.id === id);
  const lastSavedConfirmation = !project.materiality.confirmed && savedProject.materiality.confirmed
    && savedProject.materiality.includedTopicIds.includes(id) && savedTopic
    ? { topic: savedTopic, assessment: savedProject.materiality }
    : undefined;
  const assessmentNeedsReview = included || scored || topic.confirmed || Boolean(lastSavedConfirmation)
    || requirements.length > 0 || sections.length > 0;
  return { topic, requirements, sections, included, lastSavedConfirmation, assessmentNeedsReview };
}
