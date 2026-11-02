import { openAiServerStatus } from "@/lib/ai/openai-server";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(openAiServerStatus(), { headers: { "Cache-Control": "no-store" } });
}
