import { finalizeWritingResponse, validateWritingAiRequest } from "@/lib/ai/contracts";
import { runAiWriting } from "@/lib/ai/provider-server";
import { aiErrorResponse, assertRateLimit, assertSameOrigin, readLimitedJson } from "@/lib/ai/route-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    assertRateLimit(request);
    const input = validateWritingAiRequest(await readLimitedJson(request));
    const result = await runAiWriting(input, { signal: AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]) });
    return Response.json(finalizeWritingResponse(input, result), { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    return aiErrorResponse(cause);
  }
}
