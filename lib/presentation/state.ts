import type { ReportBoundary, ReportProjectData } from "@/lib/types/project-data";
import type { ChartObservationSnapshot, MetricObservation, ReportChart, ReportPresentationState } from "@/lib/types/presentation";
import type { WritingFact } from "@/lib/types/writing";
import { getReportTheme } from "@/lib/presentation/themes";

function numericValue(raw: string) {
  const normalized = raw.replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function observationIdForFact(factId: string) {
  return `observation-${factId}`;
}

export function observationFromFact(projectId: string, fact: WritingFact, boundary: ReportBoundary): MetricObservation {
  const value = numericValue(fact.value);
  return {
    observationId: observationIdForFact(fact.id),
    projectId,
    metricId: fact.id,
    metricName: fact.name,
    value,
    rawValue: fact.value,
    unit: fact.unit ?? "",
    reportingPeriod: fact.period,
    reportingBoundary: boundary.note,
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
    metricName: observation.metricName,
    value: observation.value,
    unit: observation.unit,
    reportingPeriod: observation.reportingPeriod,
    revision: observation.revision,
    sourceReferences: structuredClone(observation.sourceReferences),
  };
}

export function createPresentationState(projectId: string, facts: WritingFact[], boundary: ReportBoundary): ReportPresentationState {
  const theme = getReportTheme("verdant-professional");
  return {
    schemaVersion: 1,
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
    observations: facts.map((fact) => observationFromFact(projectId, fact, boundary)),
    charts: [],
    preview: { mode: "continuous", readingMode: "editing", zoom: 0.72 },
    revision: 1,
  };
}

export function isPresentationState(value: unknown): value is ReportPresentationState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<ReportPresentationState>;
  return state.schemaVersion === 1 && typeof state.themeId === "string" && Boolean(state.layout)
    && Array.isArray(state.observations) && Array.isArray(state.charts) && Boolean(state.preview)
    && Number.isInteger(state.revision);
}

export function ensurePresentationState(project: Omit<ReportProjectData, "presentation"> & { presentation?: ReportPresentationState }): ReportProjectData {
  if (isPresentationState(project.presentation)) return project as ReportProjectData;
  return {
    ...project,
    presentation: createPresentationState(project.projectId, project.facts, project.boundary),
    migrations: [
      ...project.migrations,
      {
        id: "migration-presentation-v1",
        from: "ReportProjectData schema v2 without presentation",
        migratedAt: new Date().toISOString(),
        note: "已补充 Step 6 轻量主题、版式、指标观测与图表配置；原 Step 1–5 数据、正文和版本保持不变。",
      },
    ],
  };
}

export function synchronizeObservations(project: ReportProjectData, changedFactIds: string[]) {
  const ids = new Set(changedFactIds);
  const current = new Map(project.presentation.observations.map((item) => [item.metricId, item]));
  const nextObservations = project.facts.map((fact) => {
    const derived = observationFromFact(project.projectId, fact, project.boundary);
    const existing = current.get(fact.id);
    return existing && !ids.has(fact.id) ? existing : derived;
  });
  const changedObservationIds = nextObservations.filter((item) => ids.has(item.metricId)).map((item) => item.observationId);
  const changedSet = new Set(changedObservationIds);
  const charts = project.presentation.charts.map((chart) => {
    const affected = chart.metricObservationIds.some((id) => changedSet.has(id));
    if (!affected) return chart;
    const details = chart.observationSnapshots
      .filter((snapshot) => changedSet.has(snapshot.observationId))
      .map((snapshot) => {
        const latest = nextObservations.find((item) => item.observationId === snapshot.observationId);
        return latest ? `${snapshot.metricName}：v${snapshot.revision} → v${latest.revision}（${snapshot.value} → ${latest.rawValue} ${latest.unit}）` : `${snapshot.metricName}：来源已变化`;
      });
    return {
      ...chart,
      status: "需更新" as const,
      layoutReviewStatus: "待复核" as const,
      changeNote: details.join("；") || "关联指标版本已变化，请核对来源后更新图表。",
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
