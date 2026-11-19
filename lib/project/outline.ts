import { chapterEvidence, isConfirmedFact, materialSources, materialState } from "@/lib/project/materials";
import type { EsgTopic } from "@/lib/types/esg";
import type { ProjectReportSection, ReportProjectData } from "@/lib/types/project-data";

export function isPriorityTopic(topic: EsgTopic) {
  return topic.financialScore >= 1 && topic.impactScore >= 1 && (topic.financialScore >= 4 || topic.impactScore >= 4.3);
}

export function needsChapterMaterials(evidence: ReturnType<typeof chapterEvidence>) {
  return evidence.materials.some((material) => materialState(material) !== "已确认")
    || evidence.facts.some((fact) => !isConfirmedFact(fact)) || evidence.resources.some((resource) => !resource.confirmed)
    || (!evidence.materials.length && !evidence.facts.length && !evidence.resources.length);
}

export type OutlineSuggestion = {
  id: string;
  title: string;
  description: string;
  topics: string[];
  materialIds: string[];
  factIds: string[];
  existingSectionId?: string;
};

export function suggestReportOutline(project: ReportProjectData): OutlineSuggestion[] {
  const sections = project.reportSections.filter((section) => section.sourceState === "active");
  const enterprise = project.enterprise.name || "本企业";
  const industry = project.enterprise.primaryIndustry?.name || project.enterprise.industryName;
  const profile = `${enterprise} ${project.report.year} 年度${industry ? `（${industry}）` : ""}`;
  const base = (title: string, description: string): OutlineSuggestion => ({
    id: title, title, description, topics: [], materialIds: [], factIds: [], existingSectionId: sections.find((section) => section.title === title)?.id,
  });
  const assessed = project.topics.filter((topic) => project.materiality.includedTopicIds.includes(topic.id))
    .sort((left, right) => Number(isPriorityTopic(right)) - Number(isPriorityTopic(left))
      || (right.impactScore + right.financialScore) - (left.impactScore + left.financialScore));
  const recommendations = assessed.map((topic): OutlineSuggestion => {
    const relatedSections = sections.filter((section) => section.topics.includes(topic.name) || section.title === topic.name);
    const existingEvidence = relatedSections.map((section) => chapterEvidence(project, section.id));
    const materialIds = new Set(project.dataRequirements.filter((material) => material.topicIds?.includes(topic.id)).map((material) => material.id));
    for (const evidence of existingEvidence) for (const material of evidence.materials) materialIds.add(material.id);
    const materials = project.dataRequirements.filter((item) => materialIds.has(item.id));
    const sourceIds = new Set(materials.flatMap((item) => materialSources(project, item).map((source) => source.id)));
    const facts = project.facts.filter((fact) => fact.sourceState !== "upstream-removed" && (fact.topic === topic.name
      || fact.sourceReferences.some((reference) => sourceIds.has(reference.sourceId))));
    const confirmed = facts.filter(isConfirmedFact).length;
    const available = materials.filter((material) => materialState(material) === "已确认").length;
    return {
      id: topic.id, title: topic.name, topics: [topic.name], materialIds: [...materialIds], factIds: facts.map((fact) => fact.id),
      description: `${profile}的${topic.name}管理措施与绩效。已有 ${available} 项确认资料和 ${confirmed} 条确认事实。`,
      existingSectionId: relatedSections.find((section) => section.level === 2 || section.title === topic.name)?.id ?? relatedSections[0]?.id,
    };
  });
  return [
    base("关于本报告", `说明${profile}的报告期间、范围和参考框架。`),
    base("ESG 管理", `介绍${enterprise}的治理安排、利益相关方沟通及重要性评估。`),
    ...recommendations,
    base("附录索引", "整理报告中的指标、单位和来源位置。"),
  ];
}

export function appendSuggestedSections(existing: ProjectReportSection[], suggestions: OutlineSuggestion[]) {
  const active = existing.filter((section) => section.sourceState === "active");
  const titles = new Set(active.map((section) => section.title));
  let order = Math.max(0, ...active.map((section) => Number.parseInt(section.order, 10)).filter(Number.isSafeInteger));
  const sections = [...existing];
  for (const suggestion of suggestions) {
    if (suggestion.existingSectionId || titles.has(suggestion.title)) continue;
    titles.add(suggestion.title);
    sections.push({
      id: `section-user-${crypto.randomUUID()}`, order: String(++order).padStart(2, "0"), title: suggestion.title,
      description: suggestion.description, topics: suggestion.topics, materialIds: suggestion.materialIds, factIds: suggestion.factIds,
      level: 1, requirementCount: 0, state: "待完善", revision: 1, sourceState: "active",
    });
  }
  return sections;
}
