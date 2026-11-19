import type { ReportProjectData, ChangeImpact, ProjectStep } from "@/lib/types/project-data";
import type { ContentBlock, WritingDocument, WritingFact } from "@/lib/types/writing";
import { createBlock, reconcileCitations } from "@/lib/writing/document";
import { synchronizeObservations } from "@/lib/presentation/state";
import { markQualityChecksStale } from "@/lib/quality/engine";
import { qualityInputFingerprint } from "@/lib/quality/validity";
import { describeTopicRemoval } from "@/lib/project/topics";
import { chapterEvidence, manualMaterialFactId } from "@/lib/project/materials";

const unique = <T,>(items: T[]) => [...new Set(items)];
const comparable = <T extends object>(value: T, ignored: string[]) => Object.fromEntries(Object.entries(value).filter(([key]) => !ignored.includes(key)));
const changed = (left: object, right: object, ignored: string[] = []) => JSON.stringify(comparable(left, ignored)) !== JSON.stringify(comparable(right, ignored));
const nowIso = () => new Date().toISOString();
const makeId = () => `impact-${globalThis.crypto.randomUUID()}`;
const escapeText = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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

function createChapterHeading(sectionId: string, title: string): ContentBlock {
  const block = createBlock(sectionId, "heading");
  return {
    ...block,
    id: `${sectionId}-heading`,
    title,
    html: `<h2>${escapeText(title)}</h2>`,
  };
}

function factCore(fact: WritingFact) {
  return comparable(fact, ["revision", "confirmedBy", "sourceState"]);
}

export function synchronizeProjectData(previous: ReportProjectData, candidate: ReportProjectData, sourceStep: ProjectStep, removeTopicId?: string) {
  let next = structuredClone(candidate);
  const impacts: ChangeImpact[] = [];

  if (sourceStep === 1) {
    if (previous.enterprise.name !== next.enterprise.name) {
      impacts.push(createImpact(1, "enterprise", next.enterprise.id, `企业名称已更新为“${next.enterprise.name}”，Step 5–8 将读取最新名称；已编辑正文不会自动替换。`, [], [5, 6, 7, 8]));
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
      impacts.push(createImpact(1, "presentation", next.projectId, reason, chartIds, [6, 7, 8]));
    }

  }

  if (sourceStep === 2) {
    if (removeTopicId !== undefined) {
      const removal = describeTopicRemoval(next, removeTopicId, previous);
      if (!removal) throw new Error("议题已不在当前项目中，请刷新后重试。");
      const { topic, sections, assessmentNeedsReview, lastSavedConfirmation } = removal;
      const assessment = next.materiality;
      const sectionIds = new Set(sections.map((item) => item.id));
      const hasDownstreamLinks = sectionIds.size > 0;

      next.topics = next.topics.filter((item) => item.id !== topic.id);
      next.materiality = {
        ...assessment,
        includedTopicIds: assessment.includedTopicIds.filter((id) => id !== topic.id),
        ...(assessmentNeedsReview ? { confirmed: false, confirmedAt: undefined, reviewStatus: "待复核" as const } : {}),
      };
      next.reportSections = next.reportSections.map((item) => sectionIds.has(item.id) ? {
        ...item,
        topics: item.topics.filter((name) => name !== topic.name),
        topicReviewStatus: "待复核",
        revision: item.revision + 1,
      } : item);
      next.writing.chapters = next.writing.chapters.map((chapter) => sectionIds.has(chapter.id) ? {
        ...chapter, status: "待完善", reviewStatus: "待复核",
      } : chapter);

      const materials = next.dataRequirements.filter((item) => item.topicIds?.includes(topic.id));
      const targetSteps: ProjectStep[] = [...(materials.length ? [3 as const] : []), ...(hasDownstreamLinks ? [4, 5] as const : []), 7, 8];
      const impact = createImpact(2, "topic", topic.id,
        `已从当前项目移除议题“${topic.name}”。${hasDownstreamLinks ? "已解除相关大纲关联。请复核章节议题与资料引用。" : "原评分及确认信息保留在评估记录。"}`,
        [...sectionIds, ...materials.map((item) => item.id)], targetSteps);
      impacts.push({
        ...impact,
        status: assessmentNeedsReview || previous.quality.runs.length || previous.quality.fullCheck ? "待复核" : "已知悉",
        topicRemoval: {
          topic,
          assessment,
          lastSavedConfirmation,
          sectionIds: [...sectionIds],
        },
      });
      if (assessmentNeedsReview) next.materiality.revision = Math.max(previous.materiality.revision + 1, assessment.revision);
    }

    const topicIds = unique([...previous.materiality.includedTopicIds, ...next.materiality.includedTopicIds])
      .filter((id) => id !== removeTopicId && (previous.materiality.includedTopicIds.includes(id) !== next.materiality.includedTopicIds.includes(id)));
    const changedScoresOrTopics = next.topics.filter((topic) => {
      const before = previous.topics.find((item) => item.id === topic.id);
      return next.materiality.includedTopicIds.includes(topic.id) && Boolean(before && (
        before.financialScore !== topic.financialScore || before.impactScore !== topic.impactScore
        || before.name !== topic.name || before.category !== topic.category
      ));
    }).map((topic) => topic.id);
    const methodChanged = previous.materiality.method !== next.materiality.method;
    const affectedTopicIds = unique([...topicIds, ...changedScoresOrTopics, ...(methodChanged ? next.materiality.includedTopicIds : [])]);
    const topicNames = unique([...previous.topics, ...next.topics].filter((topic) => affectedTopicIds.includes(topic.id)).map((topic) => topic.name));
    if (affectedTopicIds.length) {
      next.materiality.revision = Math.max(previous.materiality.revision + 1, next.materiality.revision);
      const affectedSections = next.reportSections.filter((section) => section.sourceState !== "upstream-removed" && section.topics.some((name) => topicNames.includes(name)));
      const affectedSectionIds = new Set(affectedSections.map((section) => section.id));
      next.reportSections = next.reportSections.map((section) => affectedSectionIds.has(section.id) && section.topicReviewStatus !== "待复核" ? {
        ...section, topicReviewStatus: "待复核", revision: section.revision + 1,
      } : section);
      impacts.push(createImpact(2, "topic", affectedTopicIds[0], affectedSectionIds.size
        ? "重要性评估已更新，请复核相关报告章节的议题关联。"
        : "重要性评估已更新，历史检查记录保留。", [...affectedSectionIds], [3, 4, 7, 8]));
    } else if (changed(previous.materiality, next.materiality, ["revision", "confirmedAt"])) {
      next.materiality.revision = Math.max(previous.materiality.revision + 1, next.materiality.revision);
    }
  }

  if (sourceStep === 4) {
    const sectionIds = unique([...previous.reportSections.map((item) => item.id), ...next.reportSections.map((item) => item.id)]);
    const activeSections = next.reportSections.filter((item) => item.sourceState !== "upstream-removed");
    const activeSectionIds = new Set(activeSections.map((item) => item.id));
    const sectionRenames = new Map<string, string>();
    const layoutChanges = new Set<string>();
    for (const id of sectionIds) {
      const before = previous.reportSections.find((item) => item.id === id);
      const current = next.reportSections.find((item) => item.id === id);
      if (before && before.sourceState !== "upstream-removed" && !activeSectionIds.has(id)) {
        if (current) current.revision = before.revision + 1;
        layoutChanges.add(id);
        next.writing.chapters = next.writing.chapters.map((chapter) => chapter.id === id ? { ...chapter, sourceState: "upstream-removed", status: "待完善", reviewStatus: "待复核" } : chapter);
        impacts.push(createImpact(4, "section", id, `目录章节“${before.title}”已从 Step 4 移除；Step 5 正文、历史版本及 Step 6 版面仍保留，等待人工处理、质量复检和定稿复核。`, [id], [5, 6, 7, 8]));
        continue;
      }
      if (!current || !activeSectionIds.has(id)) continue;
      if (!before || before.sourceState === "upstream-removed" || before.order !== current.order || before.title !== current.title) {
        current.order = current.order.trim();
        current.title = current.title.trim();
        if (!current.order || !current.title) throw new Error("请填写章节编号和章节名称。");
        if (activeSections.some((item) => item.id !== id && (item.order.trim() === current.order || item.title.trim() === current.title))) {
          throw new Error("章节编号或名称已存在。");
        }
      }
      const existing = next.writing.chapters.find((chapter) => chapter.id === id);
      const sectionChanged = Boolean(before && changed(before, current, ["revision", "sourceState", "state", "requirementCount", "topicReviewStatus"]));
      if (before && (sectionChanged || before.topicReviewStatus !== current.topicReviewStatus || before.sourceState !== current.sourceState)) current.revision = Math.max(before.revision + 1, current.revision);
      if (existing) {
        if (sectionChanged || !before || existing.sourceState === "upstream-removed") {
          next.writing.chapters = next.writing.chapters.map((chapter) => chapter.id === id ? {
            ...chapter,
            title: before?.title === current.title ? chapter.title : current.title,
            order: before?.order === current.order ? chapter.order : current.order,
            sourceState: "active",
            ...(sectionChanged ? { status: "待完善" as const, reviewStatus: "待复核" as const } : {}),
          } : chapter);
        }
      } else {
        next.writing.chapters.push({
          id, title: current.title, order: current.order, status: "未开始", reviewStatus: "未审校", revision: 1,
          sourceState: "active", blocks: [createChapterHeading(id, current.title)],
        });
      }
      if (before && sectionChanged) {
        const previousLabel = `${before.order} ${before.title}`;
        const nextLabel = `${current.order} ${current.title}`;
        if (previousLabel !== nextLabel) sectionRenames.set(previousLabel, nextLabel);
        impacts.push(createImpact(4, "section", id, `报告目录已更新为“${nextLabel}”，资料关联与正文目录已同步。`, [id], [3, 5, 6, 7, 8]));
      }
      if (before && (before.order !== current.order || before.title !== current.title || before.sourceState !== current.sourceState)) layoutChanges.add(id);
    }
    next.dataRequirements = next.dataRequirements.map((item) => {
      const section = sectionRenames.get(item.section);
      return section && previous.dataRequirements.some((before) => before.id === item.id && before.section === item.section)
        ? { ...item, section } : item;
    });
    next.presentation.charts = next.presentation.charts.map((chart) => layoutChanges.has(chart.chapterId) ? {
      ...chart, layoutReviewStatus: "待复核", changeNote: "报告章节已调整，请复核图表所在章节及版面。", revision: chart.revision + 1,
    } : chart);
    next.reportSections.sort((left, right) => left.order.localeCompare(right.order, "zh-CN", { numeric: true }));
  }

  const unconfirmedManualFacts = new Set<string>();
  next.dataRequirements = next.dataRequirements.map((requirement) => {
    const before = previous.dataRequirements.find((item) => item.id === requirement.id);
    if (!before) return { ...requirement, revision: Math.max(1, requirement.revision) };
    if (!changed(before, requirement, ["revision", "reviewStatus"])) return { ...requirement, revision: before.revision };
    if (sourceStep === 3 && (requirement.type !== before.type || requirement.itemName !== before.itemName
      || JSON.stringify(requirement.quantitative) !== JSON.stringify(before.quantitative))) {
      unconfirmedManualFacts.add(manualMaterialFactId(requirement.id));
    }
    return { ...requirement, revision: Math.max(before.revision + 1, requirement.revision) };
  });

  if (sourceStep === 3) {
    next.facts = next.facts.map((fact) => unconfirmedManualFacts.has(fact.id) ? {
      ...fact, state: "待人工确认", confirmedBy: undefined, sourceConfirmationStatus: "待确认",
    } : fact);
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
      impacts.push(createImpact(3, "fact", changedFacts[0], "企业事实或 ESG 指标已更新；相关正文和图表保留旧版本，质量结论与定稿状态标记为待复核。", [...affectedBlocks, ...affectedCharts], [4, 5, 6, 7, 8]));
    }

    const revisedResources = next.resources.filter((item) => {
      const before = previous.resources.find((resource) => resource.id === item.id);
      return before && changed(before, item, ["revision"]);
    });
    const revisedSourceRefs = new Set(revisedResources.flatMap((item) => [item, previous.resources.find((resource) => resource.id === item.id)]
      .flatMap((resource) => resource?.sourceReferences.map((reference) => reference.id) ?? [])));
    const affectedSections = new Set(next.reportSections.filter((section) => section.sourceState === "active" &&
      JSON.stringify(chapterEvidence(previous, section.id)) !== JSON.stringify(chapterEvidence(next, section.id))).map((section) => section.id));
    next.writing.chapters = next.writing.chapters.map((chapter) => {
      const usesRevisedSource = chapter.blocks.some((block) => block.sourceReferences.some((reference) => revisedSourceRefs.has(reference.id)));
      if (!affectedSections.has(chapter.id) && !usesRevisedSource) return chapter;
      return {
        ...chapter, status: "待完善", reviewStatus: "待复核",
        blocks: usesRevisedSource ? chapter.blocks.map((block) => block.sourceReferences.some((reference) => revisedSourceRefs.has(reference.id))
          ? { ...block, reviewStatus: "待复核", pendingKind: "待更新", resolved: false } : block) : chapter.blocks,
      };
    });
    if (affectedSections.size) impacts.push(createImpact(3, "data-requirement", next.projectId,
      "关联资料或来源已更新，请复核报告大纲和章节资料包。", [...affectedSections], [4, 5, 7, 8]));
  }

  next.impacts = [...next.impacts, ...impacts];
  const qualityInputsChanged = sourceStep <= 6 && qualityInputFingerprint(previous) !== qualityInputFingerprint(next);
  if (qualityInputsChanged && (previous.quality.runs.length || previous.quality.fullCheck)) {
    const affectedEntityIds = unique(impacts.flatMap((impact) => [impact.entityId, ...impact.affectedIds]));
    next = markQualityChecksStale(
      next,
      `Step ${sourceStep} 的已保存输入发生变化；旧检查记录保留，相关结论等待重新检查。`,
      sourceStep as 1 | 2 | 3 | 4 | 5 | 6,
      affectedEntityIds,
    );
  }
  next.updatedAt = nowIso();
  return { project: next, impacts };
}
