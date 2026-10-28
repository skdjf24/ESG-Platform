import type { QualityAiTaskProvider } from "@/lib/types/quality";

const delay = (milliseconds: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(resolve, milliseconds);
  signal?.addEventListener("abort", () => {
    clearTimeout(timer);
    reject(new DOMException("任务已取消", "AbortError"));
  }, { once: true });
});

export const mockQualityAiProvider: QualityAiTaskProvider = {
  id: "mock-quality-review-v1",
  mode: "mock",
  label: "Mock AI 审校演示",
  async run(request, signal) {
    await delay(450, signal);
    return {
      taskId: request.taskId,
      providerId: this.id,
      providerMode: "mock",
      label: this.label,
      suggestion: `建议先核对“${request.issue.title}”关联的原始来源、统计口径和用户确认状态，再将评价性表述改写为可验证的具体事实。此为固定 Mock 流程示例，不代表已完成语义审校。`,
      warnings: [
        "Mock 响应不会判断法规义务、披露充分性或事实真实性。",
        "建议不会自动写入正式正文，必须由用户确认后返回对应步骤修改。",
      ],
      requiresHumanConfirmation: true,
    };
  },
};
