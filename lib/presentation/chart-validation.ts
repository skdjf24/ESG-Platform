import type { MetricObservation, ReportChartType } from "@/lib/types/presentation";

export interface ChartValidationResult {
  valid: boolean;
  issues: string[];
  warnings: string[];
}

const unique = (values: string[]) => [...new Set(values)];

function same(values: string[]) {
  return unique(values).length <= 1;
}

function commonChecks(observations: MetricObservation[]) {
  const issues: string[] = [];
  observations.forEach((item) => {
    const label = `${item.metricName}（${item.reportingPeriod}）`;
    if (item.confirmationStatus !== "已确认" || item.value === null) issues.push(`${label}尚未确认为可用数值。`);
    if (!item.unit.trim()) issues.push(`${label}缺少计量单位。`);
    if (!item.reportingPeriod.trim()) issues.push(`${label}缺少报告期间。`);
    if (!item.reportingBoundary.trim() || item.boundaryStatus !== "已核验") issues.push(`${label}的统计边界尚未核验。`);
    if (item.sourceConfirmationStatus !== "已确认") issues.push(`${label}的来源确认状态不是“已确认”。`);
    if (!item.sourceReferences.length) issues.push(`${label}没有可追溯的数据来源。`);
    if (!Number.isInteger(item.revision) || item.revision < 1) issues.push(`${label}缺少有效修订版本。`);
    if (item.comparabilityStatus === "不可比") issues.push(`${label}已标记为不可比。`);
  });
  if (observations.length > 1 && observations.some((item) => item.comparabilityStatus !== "可比")) {
    issues.push("多项指标组合需要逐项确认可比性。");
  }
  if (unique(observations.map((item) => item.observationId)).length !== observations.length) issues.push("选择中存在重复指标观测。 ");
  return issues;
}

export function validateChartSelection(type: ReportChartType, observations: MetricObservation[], displayUnit?: string): ChartValidationResult {
  const issues = observations.length ? commonChecks(observations) : ["请至少选择一项指标观测。"];
  const warnings: string[] = [];
  const units = observations.map((item) => item.unit.trim());
  const periods = observations.map((item) => item.reportingPeriod.trim());
  const boundaries = observations.map((item) => item.reportingBoundary.trim());

  if (displayUnit?.trim() && observations.length && !same([displayUnit.trim(), ...units])) {
    issues.push("图表显示单位与指标单位不一致；当前原型不执行单位换算。");
  }

  if (observations.some((item) => item.sampleKind === "明确模拟样本")) {
    warnings.push("包含独立模拟测试数据；可用于验证图表交互，但不会作为正式披露内容。 ");
  }

  if (type === "line") {
    if (observations.length < 2) issues.push("折线图至少需要同一指标的两个可比报告期间。 ");
    if (!same(observations.map((item) => item.metricDefinitionId))) issues.push("折线图只能选择同一指标定义的时间序列。 ");
    if (!same(units)) issues.push("折线图各期数据单位必须一致。 ");
    if (!same(boundaries)) issues.push("折线图各期数据统计边界必须一致。 ");
    if (unique(periods).length !== periods.length) issues.push("折线图同一指标的报告期间不得重复。 ");
    if (observations.some((item) => item.comparabilityStatus !== "可比")) issues.push("折线图要求每个期间的数据均已确认具有可比性。 ");
  }

  if (type === "stacked-bar") {
    const series = unique(observations.map((item) => item.seriesName));
    const categories = unique(periods);
    if (series.length < 2) issues.push("堆叠柱状图至少需要两个数据系列。 ");
    if (categories.length < 1) issues.push("堆叠柱状图缺少可用分类。 ");
    if (!same(units)) issues.push("堆叠系列的单位必须一致。 ");
    if (!same(boundaries)) issues.push("堆叠系列的统计边界必须一致。 ");
    if (observations.some((item) => !item.compositionGroupId) || !same(observations.map((item) => item.compositionGroupId ?? ""))) {
      issues.push("堆叠柱状图各系列必须属于同一构成组。 ");
    }
    const expected = [...categories].sort().join("|");
    series.forEach((seriesName) => {
      const actual = unique(observations.filter((item) => item.seriesName === seriesName).map((item) => item.reportingPeriod)).sort().join("|");
      if (actual !== expected) issues.push(`堆叠系列“${seriesName}”缺少与其他系列一致的分类期间。`);
    });
  }

  if (type === "pie") {
    if (observations.length < 2) issues.push("饼图至少需要两个构成项目。 ");
    if (!same(periods)) issues.push("饼图构成项目必须属于同一报告期间。 ");
    if (!same(units)) issues.push("饼图构成项目的单位必须一致。 ");
    if (!same(boundaries)) issues.push("饼图构成项目的统计边界必须一致。 ");
    const groups = observations.map((item) => item.compositionGroupId ?? "");
    if (groups.some((item) => !item) || !same(groups)) issues.push("饼图仅允许选择同一构成组的数据。 ");
    if (unique(observations.map((item) => item.categoryLabel)).length !== observations.length) issues.push("饼图构成分类不得重复。 ");
    if (observations.some((item) => (item.value ?? 0) < 0) || observations.reduce((total, item) => total + (item.value ?? 0), 0) <= 0) issues.push("饼图构成值必须为非负数且合计大于零。 ");
  }

  if (type === "bar") {
    if (!same(units)) issues.push("同一柱状图中的指标单位必须一致。 ");
    if (!same(boundaries)) issues.push("同一柱状图中的指标统计边界必须一致。 ");
    const samePeriod = same(periods);
    const sameMetric = same(observations.map((item) => item.metricDefinitionId));
    if (observations.length > 1 && !samePeriod && !sameMetric) issues.push("柱状图多项数据必须是同一期间的分类比较，或同一指标的期间比较。 ");
  }

  return { valid: issues.length === 0, issues: unique(issues.map((item) => item.trim())), warnings: unique(warnings.map((item) => item.trim())) };
}
