import type { SourceReference } from "@/lib/types/esg";
import type { WritingPolicy } from "@/lib/types/writing";

export type PaperSize = "A4";
export type PageOrientation = "portrait";
export type ReportPageType = "cover" | "about" | "toc" | "chapter-cover" | "content" | "performance" | "case" | "appendix";
export type ReportChartType = "bar" | "line" | "stacked-bar" | "pie" | "kpi";
export type ReportChartStatus = "待配置" | "待确认" | "已确认" | "需更新";
export type LayoutReviewStatus = "有效" | "待复核";
export type PresentationPreviewMode = "single" | "continuous";
export type PresentationReadingMode = "editing" | "formal";

export interface ReportTheme {
  id: string;
  name: string;
  description: string;
  paper: { size: PaperSize; widthMm: number; heightMm: number };
  margins: { top: number; right: number; bottom: number; left: number };
  colors: { primary: string; secondary: string; accent: string; background: string; surface: string; text: string; muted: string };
  fonts: { chinese: string; english: string; heading: string };
  headings: Array<{ level: 1 | 2 | 3; size: number; lineHeight: number; weight: number }>;
  body: { size: number; lineHeight: number };
  header: { enabled: boolean; template: string };
  footer: { enabled: boolean; template: string };
  pageNumber: { startAt: number; format: "arabic"; showOnCover: boolean; label: string };
  chartStyle: { palette: string[]; showGrid: boolean; roundedBars: boolean; legendPosition: "top" | "bottom" };
}

export interface MetricObservation {
  observationId: string;
  projectId: string;
  metricId: string;
  metricName: string;
  value: number | null;
  rawValue: string;
  unit: string;
  reportingPeriod: string;
  reportingBoundary: string;
  sourceReferences: SourceReference[];
  revision: number;
  confirmationStatus: "待确认" | "已确认";
  sampleKind: "项目事实" | "明确模拟样本";
}

export interface ChartObservationSnapshot {
  observationId: string;
  metricName: string;
  value: number;
  unit: string;
  reportingPeriod: string;
  revision: number;
  sourceReferences: SourceReference[];
}

export interface ReportChart {
  chartId: string;
  blockId: string;
  chapterId: string;
  metricObservationIds: string[];
  observationSnapshots: ChartObservationSnapshot[];
  type: ReportChartType;
  title: string;
  colors: string[];
  showLegend: boolean;
  showDataLabels: boolean;
  precision: number;
  unit: string;
  caption: string;
  status: ReportChartStatus;
  layoutReviewStatus: LayoutReviewStatus;
  changeNote?: string;
  revision: number;
  updatedAt: string;
}

export interface ReportLayoutSettings {
  paperSize: PaperSize;
  orientation: PageOrientation;
  margins: { top: number; right: number; bottom: number; left: number };
  bodyFontSize: number;
  lineHeight: number;
  titleFont: string;
  bodyFont: string;
  primaryColor: string;
  secondaryColor: string;
  headerEnabled: boolean;
  footerEnabled: boolean;
  showPageNumbers: boolean;
  contentColumns: 1 | 2;
}

export interface ReportPresentationState {
  schemaVersion: 1;
  themeId: string;
  layout: ReportLayoutSettings;
  observations: MetricObservation[];
  charts: ReportChart[];
  preview: { mode: PresentationPreviewMode; readingMode: PresentationReadingMode; zoom: number };
  revision: number;
  savedAt?: string;
}

export type PresentationAiOperation = "recommend-chart" | "generate-caption" | "recommend-layout" | "detect-layout-issues";

export interface PresentationAiTaskRequest {
  taskId: string;
  operation: PresentationAiOperation;
  blockId?: string;
  chart?: ReportChart;
  observations: MetricObservation[];
  theme: ReportTheme;
  policy: WritingPolicy;
}

export interface PresentationAiTaskResponse {
  taskId: string;
  providerId: string;
  providerMode: "mock" | "live";
  label: string;
  suggestion: string;
  warnings: string[];
}

export interface PresentationAiTaskProvider {
  id: string;
  mode: "mock" | "live";
  label: string;
  run(request: PresentationAiTaskRequest, signal?: AbortSignal): Promise<PresentationAiTaskResponse>;
}
