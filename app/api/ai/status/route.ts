import { aiServerStatus } from "@/lib/ai/provider-server";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(aiServerStatus(), { headers: { "Cache-Control": "no-store" } });
}
