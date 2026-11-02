import type { QualityAiSemanticReviewRequest, QualityAiSemanticReviewRun } from "@/lib/types/quality";

export async function runLiveSemanticReview(request: QualityAiSemanticReviewRequest, signal?: AbortSignal): Promise<QualityAiSemanticReviewRun> {
  const response = await fetch("/api/ai/semantic-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message || `AI 语义审校失败（HTTP ${response.status}）。`);
  }
  return await response.json() as QualityAiSemanticReviewRun;
}
