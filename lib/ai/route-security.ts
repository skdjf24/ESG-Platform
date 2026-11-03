import { AI_MAX_BODY_BYTES } from "@/lib/ai/contracts";

const buckets = new Map<string, { startedAt: number; count: number }>();
const WINDOW_MS = 5 * 60_000;
const MAX_REQUESTS = 20;

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const target = new URL(request.url);
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const expectedOrigin = `${forwardedProtocol ? `${forwardedProtocol}:` : target.protocol}//${forwardedHost || request.headers.get("host") || target.host}`;
  if (new URL(origin).origin !== expectedOrigin) throw new Error("CROSS_ORIGIN_REJECTED");
}

export function assertRateLimit(request: Request) {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    buckets.set(key, { startedAt: now, count: 1 });
    return;
  }
  current.count += 1;
  if (current.count > MAX_REQUESTS) throw new Error("LOCAL_RATE_LIMITED");
}

export async function readLimitedJson(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > AI_MAX_BODY_BYTES) throw new Error("PAYLOAD_TOO_LARGE");
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > AI_MAX_BODY_BYTES) throw new Error("PAYLOAD_TOO_LARGE");
  try { return JSON.parse(body); } catch { throw new Error("INVALID_JSON"); }
}

export function aiErrorResponse(cause: unknown) {
  const code = cause instanceof Error ? cause.message : "AI_REQUEST_FAILED";
  const status = code === "AI_NOT_CONFIGURED" || code === "AI_PROVIDER_CONFIG_INVALID" ? 503
    : code === "LOCAL_RATE_LIMITED" || code === "AI_RATE_LIMITED" ? 429
      : code === "AI_PROVIDER_TIMEOUT" ? 504
        : code === "AI_UPSTREAM_UNAVAILABLE" || code === "AI_PROVIDER_UNREACHABLE" ? 502
        : code === "CROSS_ORIGIN_REJECTED" ? 403
          : code.startsWith("INVALID") || code === "DUPLICATE_EVIDENCE_ID" || code === "PAYLOAD_TOO_LARGE" || code === "UNKNOWN_EVIDENCE_CITATION" ? 400
            : 502;
  const messages: Record<string, string> = {
    AI_NOT_CONFIGURED: "服务端尚未完成 AI Provider 配置，请检查 Provider、Base URL 与模型设置。",
    AI_PROVIDER_CONFIG_INVALID: "AI Provider 配置无效，请检查服务端 Base URL 与 Provider 类型。",
    AI_PROVIDER_UNREACHABLE: "当前 AI 服务无法连接；如使用 LM Studio，请确认本地服务已启动且地址可访问。",
    AI_PROVIDER_TIMEOUT: "AI 服务响应超时，请确认 Provider 服务状态后重试。",
    AI_INVALID_STRUCTURED_OUTPUT: "AI Provider 未返回符合约定的结构化结果，建议已被拦截。",
    LOCAL_RATE_LIMITED: "AI 请求过于频繁，请稍后重试。",
    AI_RATE_LIMITED: "AI 服务当前限流，请稍后重试。",
    AI_UPSTREAM_UNAVAILABLE: "AI 服务暂时不可用，请稍后重试。",
    CROSS_ORIGIN_REJECTED: "请求来源不受信任。",
    PAYLOAD_TOO_LARGE: "发送给 AI 的正文或证据过多，请缩小审校范围。",
    UNKNOWN_EVIDENCE_CITATION: "AI 返回了输入中不存在的来源引用，建议已被拦截。",
    INVALID_SEMANTIC_FINDING_REFERENCE: "AI 返回了无法定位的审校结果，建议已被拦截。",
  };
  return Response.json({ error: { code, message: messages[code] ?? "AI 请求未完成；未修改任何项目数据。" } }, { status });
}
