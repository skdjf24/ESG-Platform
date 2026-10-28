import { validateChartSelection } from "../lib/presentation/chart-validation.ts";

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`PASS ${message}`);
}

const base = {
  projectId: "independent-test",
  metricId: "mock-metric-a",
  metricDefinitionId: "mock-definition",
  metricName: "独立测试指标",
  categoryLabel: "类别 A",
  seriesName: "系列 A",
  value: 10,
  rawValue: "10",
  unit: "MWh",
  reportingPeriod: "2025年度",
  reportingBoundary: "独立模拟测试边界（非企业事实）",
  boundaryStatus: "已核验",
  sourceConfirmationStatus: "已确认",
  comparabilityStatus: "可比",
  sourceReferences: [{ id: "mock-ref-a", sourceId: "mock-source", fileName: "独立模拟测试数据.csv", locator: "A2", excerpt: "非企业事实" }],
  revision: 1,
  confirmationStatus: "已确认",
  sampleKind: "明确模拟样本",
  sampleLabel: "独立模拟测试数据 · 不进入正式披露",
  compositionGroupId: "mock-composition",
};

const duplicateStack = [
  { ...base, observationId: "mock-a-1" },
  { ...base, observationId: "mock-a-2", metricId: "mock-metric-a-duplicate", value: 12, rawValue: "12" },
  { ...base, observationId: "mock-b-1", metricId: "mock-metric-b", seriesName: "系列 B", categoryLabel: "类别 B", value: 8, rawValue: "8" },
];

const result = validateChartSelection("stacked-bar", duplicateStack);
assert(!result.valid, "重复“期间 + 系列”的堆叠图选择不可确认");
assert(result.issues.some((issue) => issue.includes("2025年度 + 系列 A") && issue.includes("只能对应一项观测")), "校验结果给出具体重复期间与系列");
assert(result.warnings.some((warning) => warning.includes("独立模拟测试数据")), "独立模拟数据明确标注且不冒充企业指标");

console.log(`RESULT valid=${result.valid} issues=${result.issues.length} warnings=${result.warnings.length}`);
