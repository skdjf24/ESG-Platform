import type { CollectionState } from "@/lib/types/esg";
import type { ProjectDataRequirement, ProjectDepartment, ProjectReportSection, ReportProjectData } from "@/lib/types/project-data";
import type { WritingFact } from "@/lib/types/writing";
import { stableHash } from "@/lib/parsing/candidate-utils";

export const defaultDepartments: ProjectDepartment[] = [
  { id: "board-office", name: "董事会办公室" },
  { id: "hr", name: "人力资源部" },
  { id: "finance", name: "财务部" },
  { id: "operations", name: "生产运营部" },
  { id: "ehs", name: "安全环保部" },
  { id: "procurement", name: "采购部" },
  { id: "legal", name: "法务合规部" },
];

export function materialState(material: ProjectDataRequirement): Exclude<CollectionState, "待分工"> {
  if (material.state === "待分工") return "待收集";
  return material.state === "已确认" && material.reviewStatus === "待复核" ? "待确认" : material.state;
}

export function sectionMaterialIds(project: ReportProjectData, section: ProjectReportSection) {
  return section.materialIds ?? project.dataRequirements.filter((material) => material.section === `${section.order} ${section.title}`).map((material) => material.id);
}

export function materialSources(project: ReportProjectData, material: ProjectDataRequirement) {
  return project.sources.filter((source) => source.materialId === material.id || material.sourceIds?.includes(source.id) || source.id === material.quantitative?.sourceId);
}

export function materialTopicNames(project: ReportProjectData, material: ProjectDataRequirement) {
  return (material.topicIds ?? []).map((id) => project.topics.find((topic) => topic.id === id)?.name
    ?? project.impacts.find((impact) => impact.topicRemoval?.topic.id === id)?.topicRemoval?.topic.name
    ?? "历史议题");
}

export function chapterEvidence(project: ReportProjectData, chapterId: string) {
  const section = project.reportSections.find((item) => item.id === chapterId);
  const materialIds = section ? sectionMaterialIds(project, section) : [];
  const materials = project.dataRequirements.filter((item) => materialIds.includes(item.id));
  const sourceIds = new Set(materials.flatMap((material) => materialSources(project, material).map((source) => source.id)));
  const isLinked = (item: Pick<WritingFact, "sourceReferences">) => item.sourceReferences.some((reference) => sourceIds.has(reference.sourceId));
  const facts = project.facts.filter((fact) => section?.factIds?.includes(fact.id) || section?.topics.includes(fact.topic) || isLinked(fact));
  const resources = project.resources.filter((resource) => resource.chapterIds.includes(chapterId) || isLinked(resource));
  return { materials, sources: project.sources.filter((source) => sourceIds.has(source.id)), facts, resources };
}

export function isConfirmedFact(fact: WritingFact) {
  return fact.sourceState !== "upstream-removed" && fact.state === "已确认" && fact.sourceConfirmationStatus !== "待确认";
}

export const manualMaterialFactId = (id: string) => `fact-manual-${id}`;

export function confirmQuantitativeMaterial(project: ReportProjectData, material: ProjectDataRequirement): ReportProjectData {
  const draft = material.quantitative;
  const source = project.sources.find((item) => item.id === draft?.sourceId);
  const normalizedValue = draft?.value.replace(/[,，]/g, "").trim();
  if (material.type !== "定量数据" || !draft || !normalizedValue || !Number.isFinite(Number(normalizedValue))
    || !draft.unit || !draft.period || !draft.boundary || !draft.locator) {
    throw new Error("请先填写有效数值、单位、统计期间、统计范围和原始来源位置。");
  }
  if (!source || source.fileStatus === "missing" || source.parserStatus === "stale" || ((source.kind === "file" || source.kind === "historical") && !source.fileId)) {
    throw new Error("请选择可查阅的来源。若原始文件已修订，请重新解析后再确认。");
  }
  const id = manualMaterialFactId(material.id);
  const previousFact = project.facts.find((item) => item.id === id);
  const fact: WritingFact = {
    id,
    name: material.itemName,
    value: normalizedValue,
    unit: draft.unit,
    period: draft.period,
    metricDefinitionId: `metric-${stableHash(material.itemName.toLowerCase())}`,
    reportingBoundary: draft.boundary,
    topic: project.topics.find((item) => material.topicIds?.includes(item.id))?.name ?? "人工录入指标",
    state: "已确认",
    sourceState: "active",
    boundaryStatus: "已核验",
    sourceConfirmationStatus: "已确认",
    comparabilityStatus: "待核验",
    confirmedBy: "当前用户（人工确认）",
    temporalType: source.kind === "historical" ? "历史事实" : "当年事实",
    revision: previousFact?.revision ?? 1,
    sourceReferences: [{ id: `ref-${id}`, sourceId: source.id, fileName: source.name, fileId: source.fileId, locator: draft.locator, excerpt: "" }],
  };
  return {
    ...project,
    facts: previousFact ? project.facts.map((item) => item.id === id ? fact : item) : [...project.facts, fact],
    dataRequirements: project.dataRequirements.map((item) => item.id === material.id ? {
      ...item, state: "已确认", reviewStatus: "有效", confirmedAt: new Date().toISOString(),
    } : item),
  };
}
