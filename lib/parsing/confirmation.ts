import { formatLocator, stableHash } from "@/lib/parsing/candidate-utils";
import type { SourceReference } from "@/lib/types/esg";
import type { ExtractionCandidate } from "@/lib/types/parsing";
import type { ReportProjectData } from "@/lib/types/project-data";
import type { WritingFact, WritingResource } from "@/lib/types/writing";

export interface CandidateConfirmationDraft {
  type: ExtractionCandidate["type"];
  label: string;
  value?: string | number;
  unit?: string;
  period?: string;
  boundary?: string;
  note?: string;
}

function sourceReference(candidate: ExtractionCandidate, project: ReportProjectData): SourceReference {
  const source = project.sources.find((item) => item.id === candidate.sourceId);
  return {
    id: `ref-${candidate.candidateId}`,
    sourceId: candidate.sourceId,
    fileName: source?.name ?? "原始文件",
    locator: formatLocator(candidate.sourceLocator),
    excerpt: candidate.excerpt,
    fileId: candidate.fileId,
    parsedDocumentId: candidate.parsedDocumentId,
    parsedBlockId: candidate.parsedBlockId,
    sourceLocator: structuredClone(candidate.sourceLocator),
  };
}

export function applyCandidateConfirmation(
  project: ReportProjectData,
  candidate: ExtractionCandidate,
  draft: CandidateConfirmationDraft,
) {
  const label = draft.label.trim();
  if (!label) throw new Error("候选名称不能为空。");
  const now = new Date().toISOString();
  const reference = sourceReference(candidate, project);
  let next = project;
  let confirmedEntityId: string;
  if (draft.type === "fact" || draft.type === "metric") {
    const value = String(draft.value ?? "").trim();
    if (!value) throw new Error("事实或指标值不能为空。");
    if (draft.type === "metric" && !Number.isFinite(Number(value.replace(/,/g, "").replace(/%$/, "")))) throw new Error("指标候选必须填写可解析的数值。");
    confirmedEntityId = `fact-${candidate.candidateId}`;
    const existing = project.facts.find((fact) => fact.id === confirmedEntityId);
    const fact: WritingFact = {
      id: confirmedEntityId,
      name: label,
      value,
      unit: draft.unit?.trim(),
      period: draft.period?.trim() || (candidate.sourceKind === "historical" ? "历史期间待核验" : String(project.report.year)),
      topic: draft.note?.trim() || "文件解析人工确认",
      state: "已确认",
      sourceReferences: [reference],
      confirmedBy: "当前用户（人工确认）",
      metricDefinitionId: draft.type === "metric" ? `metric-${stableHash(label.toLowerCase())}` : undefined,
      categoryLabel: draft.type === "metric" ? label : undefined,
      seriesName: draft.type === "metric" ? label : undefined,
      reportingBoundary: draft.boundary?.trim() ?? "",
      boundaryStatus: draft.boundary?.trim() ? "已核验" : "待核验",
      sourceConfirmationStatus: "已确认",
      comparabilityStatus: "待核验",
      revision: existing?.revision ?? 1,
      temporalType: candidate.sourceKind === "historical" ? "历史事实" : "当年事实",
      sourceState: "active",
    };
    next = { ...project, facts: existing ? project.facts.map((item) => item.id === fact.id ? fact : item) : [...project.facts, fact] };
  } else {
    confirmedEntityId = `resource-${candidate.candidateId}`;
    const existing = project.resources.find((resource) => resource.id === confirmedEntityId);
    const firstChapter = project.writing.chapters.find((chapter) => chapter.sourceState !== "upstream-removed");
    const resource: WritingResource = {
      id: confirmedEntityId,
      chapterIds: existing?.chapterIds ?? (firstChapter ? [firstChapter.id] : []),
      kind: candidate.sourceKind === "historical" ? "历史资料" : draft.type === "policy" ? "制度" : "案例",
      title: label,
      description: String(draft.value ?? candidate.excerpt).trim(),
      confirmed: true,
      sourceReferences: [reference],
      revision: existing?.revision ?? 1,
      confirmedBy: "当前用户（人工确认）",
      confirmedAt: now,
    };
    next = { ...project, resources: existing ? project.resources.map((item) => item.id === resource.id ? resource : item) : [...project.resources, resource] };
  }
  return {
    project: next,
    candidate: {
      ...candidate,
      ...draft,
      label,
      status: "confirmed" as const,
      confirmedEntityId,
      reviewedAt: now,
      updatedAt: now,
    },
    confirmedEntityId,
  };
}

export function rejectCandidate(candidate: ExtractionCandidate) {
  const now = new Date().toISOString();
  return { ...candidate, status: "rejected" as const, reviewedAt: now, updatedAt: now };
}
