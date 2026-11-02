import { finalizeSemanticReview, validateSemanticReviewRequest } from "@/lib/ai/contracts";
import { runOpenAiSemanticReview } from "@/lib/ai/openai-server";
import { aiErrorResponse, assertRateLimit, assertSameOrigin, readLimitedJson } from "@/lib/ai/route-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    assertRateLimit(request);
    const input = validateSemanticReviewRequest(await readLimitedJson(request));
    const result = await runOpenAiSemanticReview(input, { signal: AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]) });
    return Response.json(finalizeSemanticReview(input, result), { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    return aiErrorResponse(cause);
  }
}
