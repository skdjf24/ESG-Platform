import type { PresentationAiTaskProvider } from "@/lib/types/presentation";

const suggestions = {
  "recommend-chart": "Mock 建议：当前仅有单期、同口径指标时优先使用 KPI 卡片或柱状图；不要补齐不存在的历史年度。",
  "generate-caption": "Mock 建议图注：数据来自已确认的项目事实及其原始资料定位，统计边界和口径以来源记录为准。",
  "recommend-layout": "Mock 建议：指标页采用单栏标题、上方图表、下方来源与口径说明，避免压缩正文或截断表格。",
  "detect-layout-issues": "Mock 检查：请人工核对长表格、待确认内容、跨页标题以及预览页码；最终导出页码应在 Step 8 重新计算。",
} as const;

export const mockPresentationAiProvider: PresentationAiTaskProvider = {
  id: "mock-presentation-v1",
  mode: "mock",
  label: "Mock 版式助手",
  async run(request, signal) {
    if (signal?.aborted) throw new DOMException("Task cancelled", "AbortError");
    await new Promise((resolve) => setTimeout(resolve, 260));
    if (signal?.aborted) throw new DOMException("Task cancelled", "AbortError");
    return {
      taskId: request.taskId,
      providerId: "mock-presentation-v1",
      providerMode: "mock",
      label: "Mock 示例建议",
      suggestion: suggestions[request.operation],
      warnings: ["本结果为本地规则演示，不是完整 AI 版面分析。", "不得据此新增绩效、指标、成果或承诺。"],
    };
  },
};
