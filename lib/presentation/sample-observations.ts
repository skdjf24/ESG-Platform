import type { SourceReference } from "@/lib/types/esg";
import type { MetricObservation } from "@/lib/types/presentation";

const mockBoundary = "独立模拟测试边界：测试园区（非企业事实）";

function source(id: string, locator: string, excerpt: string): SourceReference {
  return {
    id: `mock-source-${id}`,
    sourceId: "source-step6-independent-mock",
    fileName: "Step6图表独立模拟测试数据.csv",
    locator,
    excerpt: `${excerpt}；仅用于验证图表统计逻辑，不代表任何企业实际绩效。`,
  };
}

function observation(
  projectId: string,
  id: string,
  metricDefinitionId: string,
  metricName: string,
  categoryLabel: string,
  seriesName: string,
  value: number,
  period: string,
  compositionGroupId?: string,
): MetricObservation {
  return {
    observationId: `mock-observation-${id}`,
    projectId,
    metricId: `mock-metric-${id}`,
    metricDefinitionId,
    metricName,
    categoryLabel,
    seriesName,
    compositionGroupId,
    value,
    rawValue: String(value),
    unit: "MWh",
    reportingPeriod: period,
    reportingBoundary: mockBoundary,
    boundaryStatus: "已核验",
    sourceConfirmationStatus: "已确认",
    comparabilityStatus: "可比",
    sourceReferences: [source(id, `mock/${id}`, `${period} ${categoryLabel} ${value} MWh`)],
    revision: 1,
    confirmationStatus: "已确认",
    sampleKind: "明确模拟样本",
    sampleLabel: "独立模拟测试数据 · 不进入正式披露",
  };
}

/**
 * Independent chart-fixture data. These records are deliberately separated
 * from WritingFact and are never presented as the example enterprise's facts.
 */
export function createChartSampleObservations(projectId: string): MetricObservation[] {
  return [
    observation(projectId, "total-2023", "mock-energy-total", "模拟综合用电量", "综合用电量", "模拟综合用电量", 10_200, "2023年度"),
    observation(projectId, "total-2024", "mock-energy-total", "模拟综合用电量", "综合用电量", "模拟综合用电量", 11_100, "2024年度"),
    observation(projectId, "total-2025", "mock-energy-total", "模拟综合用电量", "综合用电量", "模拟综合用电量", 12_000, "2025年度"),
    observation(projectId, "renewable-2024", "mock-renewable-electricity", "模拟可再生电力", "可再生电力", "可再生电力", 3_200, "2024年度", "mock-energy-mix"),
    observation(projectId, "other-2024", "mock-other-electricity", "模拟其他电力", "其他电力", "其他电力", 7_900, "2024年度", "mock-energy-mix"),
    observation(projectId, "renewable-2025", "mock-renewable-electricity", "模拟可再生电力", "可再生电力", "可再生电力", 4_100, "2025年度", "mock-energy-mix"),
    observation(projectId, "other-2025", "mock-other-electricity", "模拟其他电力", "其他电力", "其他电力", 7_900, "2025年度", "mock-energy-mix"),
  ];
}
