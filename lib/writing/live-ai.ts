import type { AiTaskProvider, AiTaskRequest, AiTaskResponse } from "@/lib/types/writing";
import type { WritingAiApiRequest } from "@/lib/ai/contracts";

async function apiError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return body?.error?.message || `AI 请求失败（HTTP ${response.status}）。`;
}

export const liveAiProvider: AiTaskProvider = {
  id: "openai-responses",
  mode: "live",
  label: "真实 AI · 证据约束",
  async run(request: AiTaskRequest, signal?: AbortSignal): Promise<AiTaskResponse> {
    const body: WritingAiApiRequest = {
      taskId: request.taskId,
      operation: request.operation,
      chapter: { id: request.chapter.id, title: request.chapter.title, order: request.chapter.order, revision: request.chapter.revision },
      blockId: request.blockId,
      selectedText: request.selectedText,
      sourceText: request.sourceText,
      requirementIds: request.requirementIds,
      policy: request.policy,
      evidence: request.evidence,
    };
    const response = await fetch("/api/ai/writing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal,
    });
    if (!response.ok) throw new Error(await apiError(response));
    return await response.json() as AiTaskResponse;
  },
};
