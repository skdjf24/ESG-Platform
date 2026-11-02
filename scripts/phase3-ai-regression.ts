import assert from "node:assert/strict";
import { createAiEvidence } from "../lib/ai/evidence";
import { finalizeSemanticReview, finalizeWritingResponse, validateSemanticReviewRequest, validateWritingAiRequest, type SemanticModelOutput, type WritingAiApiRequest, type WritingModelOutput } from "../lib/ai/contracts";
import { runOpenAiSemanticReview, runOpenAiWriting } from "../lib/ai/openai-server";
import { createProjectData } from "../lib/project/seed";
import { getStep8QualityGate } from "../lib/quality/validity";

const results: string[] = [];
function check(condition: unknown, label: string) {
  assert.ok(condition, label);
  results.push(label);
  console.log(`PASS ${label}`);
}

function fakeResponse(output: unknown, id = "resp_phase3") {
  return new Response(JSON.stringify({ id, model: "gpt-test", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(output) }] }] }), { status: 200, headers: { "Content-Type": "application/json" } });
}

async function main() {
  const project = createProjectData("phase3-regression");
  const evidence = createAiEvidence(project.facts, project.resources);
  check(evidence.every((item) => item.sourceReferences.length > 0), "仅组装带来源的 AI 证据");
  check(evidence.every((item) => item.kind !== "fact" || project.facts.find((fact) => fact.id === item.entityId)?.state === "已确认"), "未确认事实不进入 AI 证据");

  const chapter = project.writing.chapters.find((item) => item.blocks.some((block) => block.kind === "paragraph"))!;
  const request: WritingAiApiRequest = validateWritingAiRequest({
    taskId: "task-writing",
    operation: "draft",
    chapter: { id: chapter.id, title: chapter.title, order: chapter.order, revision: chapter.revision },
    sourceText: "原文",
    requirementIds: [],
    policy: project.writing.policy,
    evidence,
  });
  let capturedBody = "";
  let capturedAuthorization = "";
  const writingOutput: WritingModelOutput = {
    suggestion: "证据约束建议",
    citations: evidence[0] ? [{ evidenceId: evidence[0].evidenceId, claim: evidence[0].content }] : [],
    unsupportedClaims: [],
    warnings: [],
  };
  const writingResult = await runOpenAiWriting(request, {
    apiKey: "server-secret-never-client",
    model: "gpt-test",
    fetchImpl: async (_input, init) => {
      capturedBody = String(init?.body ?? "");
      capturedAuthorization = new Headers(init?.headers).get("authorization") ?? "";
      return fakeResponse(writingOutput);
    },
  });
  check(JSON.parse(capturedBody).store === false, "Responses API 显式 store:false");
  check(!capturedBody.includes("server-secret-never-client") && capturedAuthorization === "Bearer server-secret-never-client", "API Key 仅位于服务端 Authorization header");
  check(JSON.parse(capturedBody).text.format.type === "json_schema" && JSON.parse(capturedBody).text.format.strict === true, "AI 输出使用严格 JSON Schema");
  await assert.rejects(() => runOpenAiWriting(request, { apiKey: "" }), /AI_NOT_CONFIGURED/);
  check(true, "未配置服务端 API Key 时明确阻止请求");
  const response = finalizeWritingResponse(request, writingResult);
  check(response.providerMode === "live" && response.requiresConfirmation, "真实写作建议必须人工确认");
  check(response.citations.every((citation) => request.evidence.some((item) => item.evidenceId === citation.evidenceId)), "写作引用只能指向输入证据");

  assert.throws(() => finalizeWritingResponse(request, { responseId: "bad", model: "gpt-test", output: { ...writingOutput, citations: [{ evidenceId: "fact:unknown", claim: "伪引用" }] } }), /UNKNOWN_EVIDENCE_CITATION/);
  check(true, "未知来源引用被服务端拦截");
  const uncitedDraft = finalizeWritingResponse(request, { responseId: "uncited", model: "gpt-test", output: { ...writingOutput, citations: [], unsupportedClaims: [] } });
  check(uncitedDraft.unsupportedClaims.length === 1, "新增内容没有来源引用时自动进入禁止接受清单");

  const block = chapter.blocks.find((item) => item.kind === "paragraph")!;
  const semanticRequest = validateSemanticReviewRequest({
    taskId: "task-review",
    projectId: project.projectId,
    projectRevision: project.revision,
    policyRuleIds: project.writing.policy.rules.filter((rule) => rule.enabled).map((rule) => rule.id),
    blocks: [{ chapterId: chapter.id, chapterTitle: chapter.title, blockId: block.id, blockTitle: block.title, text: "高度重视", evidenceIds: [] }],
    evidence,
  });
  const semanticOutput: SemanticModelOutput = { findings: [{ category: "vague-language", severity: "提示", chapterId: chapter.id, blockId: block.id, title: "空泛表述", description: "缺少可验证内容", suggestion: "改为具体行动", evidenceIds: [], confidence: "高" }], warnings: ["需人工确认"] };
  const semanticResult = await runOpenAiSemanticReview(semanticRequest, { apiKey: "server-secret-never-client", model: "gpt-test", fetchImpl: async () => fakeResponse(semanticOutput, "resp_review") });
  const review = finalizeSemanticReview(semanticRequest, semanticResult);
  check(review.findings[0]?.blockId === block.id && !review.acceptedByUser, "AI 语义发现可定位且默认未接受");
  assert.throws(() => finalizeSemanticReview(semanticRequest, { ...semanticResult, output: { ...semanticOutput, findings: [{ ...semanticOutput.findings[0], blockId: "unknown" }] } }), /INVALID_SEMANTIC_FINDING_REFERENCE/);
  check(true, "无法定位的语义发现被服务端拦截");

  const gateBefore = getStep8QualityGate(project);
  const withReview = { ...project, quality: { ...project.quality, aiReviews: [{ ...review, acceptedByUser: true, acceptedAt: new Date().toISOString() }] } };
  const gateAfter = getStep8QualityGate(withReview);
  check(JSON.stringify(gateBefore) === JSON.stringify(gateAfter), "AI 审校记录不改变确定性 Step 8 Gate");

  console.log(`RESULT ${results.length} PASS / 0 FAIL`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
