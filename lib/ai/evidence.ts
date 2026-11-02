import type { AiEvidenceItem, WritingFact, WritingResource } from "@/lib/types/writing";

export function createAiEvidence(facts: WritingFact[], resources: WritingResource[]): AiEvidenceItem[] {
  const factEvidence = facts
    .filter((fact) => fact.state === "已确认" && fact.sourceReferences.length > 0)
    .map((fact): AiEvidenceItem => ({
      evidenceId: `fact:${fact.id}`,
      kind: "fact",
      entityId: fact.id,
      revision: fact.revision,
      title: fact.name,
      content: `${fact.temporalType}；${fact.period}；${fact.name}=${fact.value}${fact.unit ? ` ${fact.unit}` : ""}${fact.reportingBoundary ? `；统计边界=${fact.reportingBoundary}` : ""}`,
      period: fact.period,
      unit: fact.unit,
      sourceReferences: structuredClone(fact.sourceReferences),
    }));
  const resourceEvidence = resources
    .filter((resource) => resource.confirmed && resource.sourceReferences.length > 0)
    .map((resource): AiEvidenceItem => ({
      evidenceId: `resource:${resource.id}`,
      kind: "resource",
      entityId: resource.id,
      revision: resource.revision,
      title: resource.title,
      content: resource.description,
      sourceReferences: structuredClone(resource.sourceReferences),
    }));
  return [...factEvidence, ...resourceEvidence];
}
