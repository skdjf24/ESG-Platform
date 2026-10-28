import type { ReportProjectData, ChangeImpact, ProjectStep } from "@/lib/types/project-data";
import type { ContentBlock, WritingDocument, WritingFact } from "@/lib/types/writing";
import { createBlock, reconcileCitations } from "@/lib/writing/document";
import { synchronizeObservations } from "@/lib/presentation/state";

const unique = <T,>(items: T[]) => [...new Set(items)];
const comparable = <T extends object>(value: T, ignored: string[]) => Object.fromEntries(Object.entries(value).filter(([key]) => !ignored.includes(key)));
const changed = (left: object, right: object, ignored: string[] = []) => JSON.stringify(comparable(left, ignored)) !== JSON.stringify(comparable(right, ignored));
const nowIso = () => new Date().toISOString();
const makeId = () => `impact-${globalThis.crypto.randomUUID()}`;
const escapeText = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const normalizeFramework = (value: string) => value.toLowerCase().replace(/standards?|esg|s1\/s2|6\.0|[\s·_-]|指引|准则|标准/g, "");
const frameworkMatches = (projectFramework: string, requirementFramework: string) => {
  const left = normalizeFramework(projectFramework);
  const right = normalizeFramework(requirementFramework);
  return Boolean(left && right && (left.includes(right) || right.includes(left)));
};

export function composeWritingDocument(project: ReportProjectData): WritingDocument {
  return {
    schemaVersion: 1,
    projectId: project.projectId,
    chapters: project.writing.chapters,
    facts: project.facts,
    resources: project.resources,
    policy: project.writing.policy,
    versions: project.writing.versions,
    savedAt: project.writing.savedAt,
  };
}

export function applyWritingDocument(project: ReportProjectData, document: WritingDocument): ReportProjectData {
  return {
    ...project,
    facts: document.facts,
    resources: document.resources,
    writing: {
      schemaVersion: 1,
      chapters: document.chapters,
      policy: document.policy,
      versions: document.versions,
      savedAt: document.savedAt,
    },
  };
}

function createImpact(
  sourceStep: ProjectStep,
  entityType: ChangeImpact["entityType"],
  entityId: string,
  message: string,
  affectedIds: string[],
  targetSteps: ProjectStep[],
): ChangeImpact {
  return {
    id: makeId(), sourceStep, targetSteps, entityType, entityId, message,
    affectedIds: unique(affectedIds), createdAt: nowIso(), status: "待复核",
  };
}

function markRequirementMappings(project: ReportProjectData, requirementIds: string[]): ReportProjectData {
  const ids = new Set(requirementIds);
  if (!ids.size) return project;
  return {
    ...project,
    writing: {
      ...project.writing,
      chapters: project.writing.chapters.map((chapter) => {
        let affected = false;
        const blocks = chapter.blocks.map((block) => {
          if (!block.mappings.some((mapping) => ids.has(mapping.requirementId))) return block;
          affected = true;
          return {
            ...block,
            reviewStatus: "待复核" as const,
            pendingKind: block.pendingKind ?? "待确认" as const,
            resolved: false,
            mappings: block.mappings.map((mapping) => ids.has(mapping.requirementId) ? { ...mapping, coverage: "待核验" as const } : mapping),
          };
        });
        return affected ? { ...chapter, blocks, status: "待完善" as const, reviewStatus: "待复核" as const } : chapter;
      }),
    },
  };
}

function markChartsForContextReview(project: ReportProjectData, message: string): ReportProjectData {
  if (!project.presentation.charts.length) return project;
  return {
    ...project,
    presentation: {
      ...project.presentation,
      revision: project.presentation.revision + 1,
      charts: project.presentation.charts.map((chart) => ({
        ...chart,
        status: "需更新" as const,
        layoutReviewStatus: "待复核" as const,
        changeNote: message,
        revision: chart.revision + 1,
      })),
    },
  };
}

function createChapterHeading(sectionId: string, title: string, requirementIds: string[]): ContentBlock {
  const block = createBlock(sectionId, "heading");
  return {
    ...block,
    id: `${sectionId}-heading`,
    title,
    html: `<h2>${escapeText(title)}</h2>`,
    mappings: requirementIds.map((requirementId) => ({ requirementId, coverage: "待核验" as const })),
  };
}

function factCore(fact: WritingFact) {
  return comparable(fact, ["revision", "confirmedBy", "sourceState"]);
}

export function synchronizeProjectData(previous: ReportProjectData, candidate: ReportProjectData, sourceStep: ProjectStep) {
  let next = structuredClone(candidate);
  const impacts: ChangeImpact[] = [];

  if (sourceStep === 1) {
    if (previous.enterprise.name !== next.enterprise.name) {
      impacts.push(createImpact(1, "enterprise", next.enterprise.id, `企业名称已更新为“${next.enterprise.name}”，Step 5–6 将显示最新名称；已编辑正文不会自动替换。`, [], [5, 6]));
    }
    const reportPeriodChanged = previous.report.year !== next.report.year
      || JSON.stringify(previous.report.reportingPeriod) !== JSON.stringify(next.report.reportingPeriod);
    const reportBoundaryChanged = JSON.stringify(previous.boundary) !== JSON.stringify(next.boundary);
    if (reportPeriodChanged || reportBoundaryChanged) {
      const reason = reportBoundaryChanged
        ? "项目报告边界已变化。指标自身的统计边界未被自动替换，请逐图核验范围后确认更新。"
        : "报告年度或报告期已变化，请核验图表指标期间与当前报告期是否一致。";
      const chartIds = next.presentation.charts.map((chart) => chart.chartId);
      next = markChartsForContextReview(next, reason);
      impacts.push(createImpact(1, "presentation", next.projectId, reason, chartIds, [6]));
    }
    const removedFrameworks = previous.report.frameworks.filter((framework) => !next.report.frameworks.includes(framework));
    const removedTopics = previous.topics.filter((topic) => !next.topics.some((item) => item.id === topic.id));
    const affectedRequirements = next.disclosureRequirements.filter((requirement) => removedFrameworks.some((framework) => frameworkMatches(framework, requirement.framework)) || removedTopics.some((topic) => topic.name === requirement.topic));
    if (affectedRequirements.length) {
      const ids = affectedRequirements.map((item) => item.id);
      next.disclosureRequirements = next.disclosureRequirements.map((item) => ids.includes(item.id) ? { ...item, userConfirmed: false, reviewStatus: "待复核" } : item);
      next = markRequirementMappings(next, ids);
      impacts.push(createImpact(1, removedTopics.length ? "topic" : "framework", removedTopics[0]?.id ?? removedFrameworks[0], "企业画像中的框架或议题已调整，相关披露要求、正文映射及报告版面需要复核。", ids, [2, 3, 5, 6]));
    }
  }

  if (sourceStep === 2) {
    const topicIds = unique([...previous.materiality.includedTopicIds, ...next.materiality.includedTopicIds])
      .filter((id) => previous.materiality.includedTopicIds.includes(id) !== next.materiality.includedTopicIds.includes(id));
    const topicNames = previous.topics.filter((topic) => topicIds.includes(topic.id)).map((topic) => topic.name);
    const requirementIds = next.disclosureRequirements.filter((item) => topicNames.includes(item.topic)).map((item) => item.id);
    if (topicIds.length) {
      next.materiality.revision = Math.max(previous.materiality.revision + 1, next.materiality.revision);
      next.disclosureRequirements = next.disclosureRequirements.map((item) => requirementIds.includes(item.id) ? { ...item, userConfirmed: false, reviewStatus: "待复核" } : item);
      next = markRequirementMappings(next, requirementIds);
      impacts.push(createImpact(2, "topic", topicIds[0], "实质性议题范围已变化，关联披露要求、正文覆盖和报告版面需要复核。", requirementIds, [3, 5, 6]));
    } else if (changed(previous.materiality, next.materiality, ["revision", "confirmedAt"])) {
      next.materiality.revision = Math.max(previous.materiality.revision + 1, next.materiality.revision);
    }
  }

  const changedRequirementIds: string[] = [];
  next.disclosureRequirements = next.disclosureRequirements.map((requirement) => {
    const before = previous.disclosureRequirements.find((item) => item.id === requirement.id);
    if (!before) return { ...requirement, revision: Math.max(1, requirement.revision) };
    if (!changed(before, requirement, ["revision", "reviewStatus"])) return { ...requirement, revision: before.revision };
    changedRequirementIds.push(requirement.id);
    return { ...requirement, revision: Math.max(before.revision + 1, requirement.revision), reviewStatus: requirement.userConfirmed ? "有效" : "待复核" };
  });
  if (sourceStep === 3 && changedRequirementIds.length) {
    next = markRequirementMappings(next, changedRequirementIds);
    impacts.push(createImpact(3, "requirement", changedRequirementIds[0], "披露要求的适用性或章节映射已更新，已有正文映射保留并标记为待核验。", changedRequirementIds, [5, 6]));
  }

  if (sourceStep === 3) {
    const sectionIds = unique([...previous.reportSections.map((item) => item.id), ...next.reportSections.map((item) => item.id)]);
    const activeSectionIds = new Set(next.reportSections.map((item) => item.id));
    for (const id of sectionIds) {
      const before = previous.reportSections.find((item) => item.id === id);
      const current = next.reportSections.find((item) => item.id === id);
      if (before && !current) {
        next.writing.chapters = next.writing.chapters.map((chapter) => chapter.id === id ? { ...chapter, sourceState: "upstream-removed", status: "待完善", reviewStatus: "待复核" } : chapter);
        impacts.push(createImpact(3, "section", id, `目录章节“${before.title}”已从 Step 3 移除；Step 5 正文、历史版本及 Step 6 版面仍保留，等待人工处理。`, [id], [5, 6]));
        continue;
      }
      if (!current) continue;
      const existing = next.writing.chapters.find((chapter) => chapter.id === id);
      const sectionChanged = Boolean(before && changed(before, current, ["revision", "sourceState", "state", "requirementCount"]));
      if (before && sectionChanged) current.revision = Math.max(before.revision + 1, current.revision);
      if (existing) {
        next.writing.chapters = next.writing.chapters.map((chapter) => chapter.id === id ? {
          ...chapter,
          title: current.title,
          order: current.order,
          sourceState: "active",
          ...(sectionChanged ? { status: "待完善" as const, reviewStatus: "待复核" as const } : {}),
        } : chapter);
      } else {
        const mappedIds = next.disclosureRequirements.filter((item) => item.mappedSection === `${current.order} ${current.title}`).map((item) => item.id);
        next.writing.chapters.push({
          id, title: current.title, order: current.order, status: "未开始", reviewStatus: "未审校", revision: 1,
          sourceState: "active", blocks: [createChapterHeading(id, current.title, mappedIds)],
        });
      }
      if (before && sectionChanged) {
        const oldMapping = `${before.order} ${before.title}`;
        const newMapping = `${current.order} ${current.title}`;
        next.disclosureRequirements = next.disclosureRequirements.map((item) => item.mappedSection === oldMapping ? { ...item, mappedSection: newMapping, revision: item.revision + 1, reviewStatus: "待复核", userConfirmed: false } : item);
        impacts.push(createImpact(3, "section", id, `报告目录已更新为“${newMapping}”；Step 5–6 已同步章节信息并保留全部正文块。`, [id], [5, 6]));
      }
    }
    next.writing.chapters = next.writing.chapters.map((chapter) => activeSectionIds.has(chapter.id) ? { ...chapter, sourceState: "active" } : chapter);
  }

  next.dataRequirements = next.dataRequirements.map((requirement) => {
    const before = previous.dataRequirements.find((item) => item.id === requirement.id);
    if (!before) return { ...requirement, revision: Math.max(1, requirement.revision) };
    if (!changed(before, requirement, ["revision", "reviewStatus"])) return { ...requirement, revision: before.revision };
    if (sourceStep === 3) impacts.push(createImpact(3, "data-requirement", requirement.id, `资料需求“${requirement.itemName}”已更新，Step 4 分工与收集状态需要复核。`, [requirement.id], [4]));
    return { ...requirement, revision: Math.max(before.revision + 1, requirement.revision), reviewStatus: sourceStep === 4 ? "有效" : "待复核" };
  });

  if (sourceStep === 4) {
    const candidateFactIds = new Set(next.facts.map((fact) => fact.id));
    for (const before of previous.facts) {
      if (!candidateFactIds.has(before.id)) {
        next.facts.push({ ...before, revision: before.revision + 1, state: "待人工确认", confirmedBy: undefined, sourceState: "upstream-removed" });
      }
    }
    const changedFacts: string[] = [];
    next.facts = next.facts.map((fact) => {
      const before = previous.facts.find((item) => item.id === fact.id);
      if (!before) { changedFacts.push(fact.id); return { ...fact, revision: Math.max(1, fact.revision), sourceState: "active" }; }
      if (JSON.stringify(factCore(before)) === JSON.stringify(factCore(fact))) return { ...fact, revision: before.revision };
      changedFacts.push(fact.id);
      return { ...fact, revision: Math.max(before.revision + 1, fact.revision), sourceState: fact.sourceState ?? "active" };
    });
    if (changedFacts.length) {
      const beforeDocument = composeWritingDocument(next);
      const reconciled = reconcileCitations(beforeDocument);
      next = applyWritingDocument(next, reconciled);
      const affectedBlocks = next.writing.chapters.flatMap((chapter) => chapter.blocks.filter((block) => block.citations.some((citation) => changedFacts.includes(citation.factId))).map((block) => block.id));
      next = synchronizeObservations(next, changedFacts);
      const affectedCharts = next.presentation.charts.filter((chart) => chart.status === "需更新" && chart.metricObservationIds.some((observationId) => changedFacts.some((factId) => observationId === `observation-${factId}`))).map((chart) => chart.chartId);
      impacts.push(createImpact(4, "fact", changedFacts[0], "企业事实或 ESG 指标已更新；相关正文和图表保留旧版本，并标记为待更新。", [...affectedBlocks, ...affectedCharts], [5, 6]));
    }
  }

  next.impacts = [...next.impacts, ...impacts];
  next.updatedAt = nowIso();
  return { project: next, impacts };
}
