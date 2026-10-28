import type { ReportProjectData } from "@/lib/types/project-data";
import type { ChartObservationSnapshot, MetricObservation, ReportChart, ReportPresentationState } from "@/lib/types/presentation";
import type { WritingFact } from "@/lib/types/writing";
import { validateChartSelection } from "@/lib/presentation/chart-validation";
import { createChartSampleObservations } from "@/lib/presentation/sample-observations";
import { getReportTheme } from "@/lib/presentation/themes";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

interface CompatiblePresentationState {
  schemaVersion: 1 | 2;
  themeId: string;
  layout: Record<string, unknown>;
  observations: unknown[];
  charts: unknown[];
  preview: Record<string, unknown>;
  revision: number;
  savedAt?: unknown;
}

function numericValue(raw: string) {
  const normalized = raw.replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function observationIdForFact(factId: string) {
  return `observation-${factId}`;
}

export function observationFromFact(projectId: string, fact: WritingFact): MetricObservation {
  const value = numericValue(fact.value);
  return {
    observationId: observationIdForFact(fact.id),
    projectId,
    metricId: fact.id,
    metricDefinitionId: fact.metricDefinitionId ?? fact.id,
    metricName: fact.name,
    categoryLabel: fact.categoryLabel ?? fact.name,
    seriesName: fact.seriesName ?? fact.name,
    compositionGroupId: fact.compositionGroupId,
    value,
    rawValue: fact.value,
    unit: fact.unit ?? "",
    reportingPeriod: fact.period,
    // Project-level report scope is context, not evidence of an individual
    // metric's statistical boundary. Only fact-level metadata is used here.
    reportingBoundary: fact.reportingBoundary ?? "",
    boundaryStatus: fact.boundaryStatus ?? "待核验",
    sourceConfirmationStatus: fact.sourceConfirmationStatus ?? (fact.state === "已确认" ? "已确认" : "待确认"),
    comparabilityStatus: fact.comparabilityStatus ?? "待核验",
    sourceReferences: structuredClone(fact.sourceReferences),
    revision: fact.revision,
    confirmationStatus: fact.state === "已确认" && value !== null ? "已确认" : "待确认",
    sampleKind: "项目事实",
  };
}

export function snapshotObservation(observation: MetricObservation): ChartObservationSnapshot | null {
  if (observation.value === null || observation.confirmationStatus !== "已确认") return null;
  return {
    observationId: observation.observationId,
    metricDefinitionId: observation.metricDefinitionId,
    metricName: observation.metricName,
    categoryLabel: observation.categoryLabel,
    seriesName: observation.seriesName,
    compositionGroupId: observation.compositionGroupId,
    value: observation.value,
    unit: observation.unit,
    reportingPeriod: observation.reportingPeriod,
    reportingBoundary: observation.reportingBoundary,
    boundaryStatus: observation.boundaryStatus,
    sourceConfirmationStatus: observation.sourceConfirmationStatus,
    comparabilityStatus: observation.comparabilityStatus,
    revision: observation.revision,
    sourceReferences: structuredClone(observation.sourceReferences),
    sampleKind: observation.sampleKind,
    sampleLabel: observation.sampleLabel,
  };
}

export function createPresentationState(projectId: string, facts: WritingFact[]): ReportPresentationState {
  const theme = getReportTheme("verdant-professional");
  return {
    schemaVersion: 2,
    themeId: theme.id,
    layout: {
      paperSize: "A4",
      orientation: "portrait",
      margins: structuredClone(theme.margins),
      bodyFontSize: theme.body.size,
      lineHeight: theme.body.lineHeight,
      titleFont: theme.fonts.heading,
      bodyFont: theme.fonts.chinese,
      primaryColor: theme.colors.primary,
      secondaryColor: theme.colors.secondary,
      headerEnabled: theme.header.enabled,
      footerEnabled: theme.footer.enabled,
      showPageNumbers: true,
      contentColumns: 1,
    },
    observations: [
      ...facts.map((fact) => observationFromFact(projectId, fact)),
      ...createChartSampleObservations(projectId),
    ],
    charts: [],
    preview: { mode: "continuous", readingMode: "editing", zoom: 0.72 },
    revision: 1,
  };
}

export function isPresentationState(value: unknown): value is ReportPresentationState {
  if (!isRecord(value)) return false;
  return value.schemaVersion === 2 && typeof value.themeId === "string" && isRecord(value.layout)
    && Array.isArray(value.observations) && Array.isArray(value.charts) && isRecord(value.preview)
    && Number.isInteger(value.revision);
}

export function isCompatiblePresentationState(value: unknown): value is CompatiblePresentationState {
  if (!isRecord(value)) return false;
  return [1, 2].includes(Number(value.schemaVersion)) && typeof value.themeId === "string"
    && isRecord(value.layout) && Array.isArray(value.observations) && Array.isArray(value.charts)
    && isRecord(value.preview) && Number.isInteger(value.revision);
}

function normalizeChart(raw: unknown, observations: MetricObservation[]): ReportChart | null {
  if (!isRecord(raw) || typeof raw.chartId !== "string" || typeof raw.blockId !== "string" || typeof raw.chapterId !== "string") return null;
  const type = ["bar", "line", "stacked-bar", "pie", "kpi"].includes(String(raw.type)) ? raw.type as ReportChart["type"] : "bar";
  const metricObservationIds = Array.isArray(raw.metricObservationIds) ? raw.metricObservationIds.filter((item): item is string => typeof item === "string") : [];
  const live = new Map(observations.map((item) => [item.observationId, item]));
  const rawSnapshots = Array.isArray(raw.observationSnapshots) ? raw.observationSnapshots : [];
  const observationSnapshots = rawSnapshots.flatMap((snapshot): ChartObservationSnapshot[] => {
    if (!isRecord(snapshot) || typeof snapshot.observationId !== "string" || typeof snapshot.value !== "number") return [];
    const current = live.get(snapshot.observationId);
    if (!current) return [];
    return [{
      observationId: current.observationId,
      metricDefinitionId: current.metricDefinitionId,
      metricName: typeof snapshot.metricName === "string" ? snapshot.metricName : current.metricName,
      categoryLabel: current.categoryLabel,
      seriesName: current.seriesName,
      compositionGroupId: current.compositionGroupId,
      value: snapshot.value,
      unit: typeof snapshot.unit === "string" ? snapshot.unit : current.unit,
      reportingPeriod: typeof snapshot.reportingPeriod === "string" ? snapshot.reportingPeriod : current.reportingPeriod,
      reportingBoundary: current.reportingBoundary,
      boundaryStatus: current.boundaryStatus,
      sourceConfirmationStatus: current.sourceConfirmationStatus,
      comparabilityStatus: current.comparabilityStatus,
      revision: typeof snapshot.revision === "number" ? snapshot.revision : current.revision,
      sourceReferences: Array.isArray(snapshot.sourceReferences) ? snapshot.sourceReferences as ChartObservationSnapshot["sourceReferences"] : structuredClone(current.sourceReferences),
      sampleKind: current.sampleKind,
      sampleLabel: current.sampleLabel,
    }];
  });
  const selected = metricObservationIds.flatMap((id) => live.get(id) ?? []);
  const unit = typeof raw.unit === "string" ? raw.unit : "";
  const validation = validateChartSelection(type, selected, unit);
  const previousStatus = ["待配置", "待确认", "已确认", "需更新"].includes(String(raw.status)) ? raw.status as ReportChart["status"] : "待配置";
  const status = previousStatus === "已确认" && !validation.valid ? "需更新" : previousStatus;
  return {
    chartId: raw.chartId,
    blockId: raw.blockId,
    chapterId: raw.chapterId,
    metricObservationIds,
    observationSnapshots,
    type,
    title: typeof raw.title === "string" ? raw.title : "未命名图表",
    colors: Array.isArray(raw.colors) ? raw.colors.filter((item): item is string => typeof item === "string") : ["#176b52"],
    showLegend: raw.showLegend !== false,
    showDataLabels: raw.showDataLabels !== false,
    precision: typeof raw.precision === "number" ? raw.precision : 0,
    unit,
    caption: typeof raw.caption === "string" ? raw.caption : "",
    status,
    layoutReviewStatus: status === "已确认" ? "有效" : "待复核",
    changeNote: typeof raw.changeNote === "string" ? raw.changeNote : (!validation.valid && previousStatus === "已确认" ? "数据模型升级后需要重新核验图表统计口径。" : undefined),
    validationIssues: validation.issues,
    validatedAt: typeof raw.validatedAt === "string" ? raw.validatedAt : undefined,
    usesMockData: selected.some((item) => item.sampleKind === "明确模拟样本"),
    revision: typeof raw.revision === "number" ? raw.revision : 1,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
  };
}

export function ensurePresentationState(project: Omit<ReportProjectData, "presentation"> & { presentation?: unknown }): ReportProjectData {
  const base = createPresentationState(project.projectId, project.facts);
  const raw = project.presentation;
  if (!isCompatiblePresentationState(raw)) {
    return {
      ...project,
      presentation: base,
      migrations: [
        ...project.migrations,
        {
          id: "migration-presentation-v2",
          from: "ReportProjectData schema v2 without presentation",
          migratedAt: new Date().toISOString(),
          note: "已补充 Step 6.1 指标口径、图表校验与版式状态；原 Step 1–5 数据、正文和版本保持不变。",
        },
      ],
    } as ReportProjectData;
  }

  const normalized: ReportPresentationState = {
    ...base,
    schemaVersion: 2,
    themeId: raw.themeId,
    layout: { ...base.layout, ...(raw.layout as Partial<ReportPresentationState["layout"]>) },
    observations: base.observations,
    charts: raw.charts.flatMap((chart) => normalizeChart(chart, base.observations) ?? []),
    preview: { ...base.preview, ...(raw.preview as Partial<ReportPresentationState["preview"]>) },
    revision: Number(raw.revision),
    savedAt: typeof raw.savedAt === "string" ? raw.savedAt : undefined,
  };
  const needsMigration = Number(raw.schemaVersion) < 2;
  return {
    ...project,
    presentation: normalized,
    migrations: needsMigration && !project.migrations.some((item) => item.id === "migration-presentation-v2")
      ? [...project.migrations, {
        id: "migration-presentation-v2",
        from: "ReportPresentationState schema v1",
        migratedAt: new Date().toISOString(),
        note: "已升级指标统计边界、可比性、来源确认和图表校验字段；旧图表快照与 Step 1–5 编辑历史保持不变。",
      }]
      : project.migrations,
  } as ReportProjectData;
}

function describeChanges(snapshot: ChartObservationSnapshot, latest: MetricObservation) {
  const changes: string[] = [];
  if (snapshot.value !== latest.value) changes.push(`数值 ${snapshot.value} → ${latest.rawValue}`);
  if (snapshot.unit !== latest.unit) changes.push(`单位 ${snapshot.unit || "未填写"} → ${latest.unit || "未填写"}`);
  if (snapshot.reportingPeriod !== latest.reportingPeriod) changes.push(`报告期 ${snapshot.reportingPeriod} → ${latest.reportingPeriod}`);
  if (snapshot.reportingBoundary !== latest.reportingBoundary || snapshot.boundaryStatus !== latest.boundaryStatus) changes.push("统计边界或核验状态变化");
  if (snapshot.sourceConfirmationStatus !== latest.sourceConfirmationStatus || latest.confirmationStatus !== "已确认") changes.push("来源/指标确认状态变化");
  if (snapshot.revision !== latest.revision) changes.push(`修订 v${snapshot.revision} → v${latest.revision}`);
  if (JSON.stringify(snapshot.sourceReferences) !== JSON.stringify(latest.sourceReferences)) changes.push("来源记录变化");
  return changes;
}

export function synchronizeObservations(project: ReportProjectData, changedFactIds: string[]) {
  const ids = new Set(changedFactIds);
  const current = new Map(project.presentation.observations.map((item) => [item.metricId, item]));
  const factObservations = project.facts.map((fact) => {
    const derived = observationFromFact(project.projectId, fact);
    const existing = current.get(fact.id);
    return existing && !ids.has(fact.id) ? existing : derived;
  });
  const nextObservations = [...factObservations, ...createChartSampleObservations(project.projectId)];
  const changedObservationIds = nextObservations.filter((item) => ids.has(item.metricId)).map((item) => item.observationId);
  const changedSet = new Set(changedObservationIds);
  const charts = project.presentation.charts.map((chart) => {
    const affected = chart.metricObservationIds.some((id) => changedSet.has(id));
    if (!affected) return chart;
    const details = chart.observationSnapshots
      .filter((snapshot) => changedSet.has(snapshot.observationId))
      .flatMap((snapshot) => {
        const latest = nextObservations.find((item) => item.observationId === snapshot.observationId);
        if (!latest) return [`${snapshot.metricName}：来源已变化`];
        const changes = describeChanges(snapshot, latest);
        return [`${snapshot.metricName}：${changes.join("、") || "关联数据已重新保存"}`];
      });
    const selected = chart.metricObservationIds.flatMap((id) => nextObservations.find((item) => item.observationId === id) ?? []);
    return {
      ...chart,
      status: "需更新" as const,
      layoutReviewStatus: "待复核" as const,
      changeNote: details.join("；") || "关联指标版本已变化，请核对来源后更新图表。",
      validationIssues: validateChartSelection(chart.type, selected, chart.unit).issues,
      revision: chart.revision + 1,
    };
  });
  return {
    ...project,
    presentation: {
      ...project.presentation,
      observations: nextObservations,
      charts,
      revision: project.presentation.revision + 1,
    },
  };
}

export function chartSnapshots(chart: ReportChart, observations: MetricObservation[]) {
  return chart.metricObservationIds
    .map((id) => observations.find((item) => item.observationId === id))
    .map((item) => item ? snapshotObservation(item) : null)
    .filter((item): item is ChartObservationSnapshot => Boolean(item));
}
