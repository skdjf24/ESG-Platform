import type { AiEvidenceItem, AiOperation, AiTaskResponse, WritingPolicy } from "@/lib/types/writing";
import type { QualityAiSemanticFinding, QualityAiSemanticReviewRequest, QualityAiSemanticReviewRun } from "@/lib/types/quality";

export const AI_PROMPT_VERSION = "phase3-evidence-v1";
export const AI_MAX_BODY_BYTES = 280_000;
export const AI_MAX_EVIDENCE = 80;
export const AI_MAX_BLOCKS = 120;
export const AI_MAX_TEXT_CHARS = 120_000;

export interface WritingAiApiRequest {
  taskId: string;
  operation: AiOperation;
  chapter: { id: string; title: string; order: string; revision: number };
  blockId?: string;
  selectedText?: string;
  sourceText: string;
  requirementIds: string[];
  policy: WritingPolicy;
  evidence: AiEvidenceItem[];
}

export interface OpenAiStructuredResult<T> {
  responseId: string;
  model: string;
  output: T;
}

export interface WritingModelOutput {
  suggestion: string;
  citations: Array<{ evidenceId: string; claim: string }>;
  unsupportedClaims: string[];
  warnings: string[];
}

export interface SemanticModelOutput {
  findings: Omit<QualityAiSemanticFinding, "findingId">[];
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isEvidence(value: unknown): value is AiEvidenceItem {
  return isRecord(value)
    && typeof value.evidenceId === "string"
    && ["fact", "resource"].includes(String(value.kind))
    && typeof value.entityId === "string"
    && Number.isInteger(value.revision)
    && typeof value.title === "string"
    && typeof value.content === "string"
    && Array.isArray(value.sourceReferences)
    && value.sourceReferences.every((source) => isRecord(source)
      && ["id", "sourceId", "fileName", "locator", "excerpt"].every((key) => typeof source[key] === "string"));
}

export function validateWritingAiRequest(value: unknown): WritingAiApiRequest {
  if (!isRecord(value) || typeof value.taskId !== "string" || !["draft", "rewrite", "expand", "shorten", "tone", "update"].includes(String(value.operation))) {
    throw new Error("INVALID_REQUEST");
  }
  const chapter = value.chapter;
  if (!isRecord(chapter) || !["id", "title", "order"].every((key) => typeof chapter[key] === "string") || !Number.isInteger(chapter.revision)) {
    throw new Error("INVALID_CHAPTER");
  }
  if (typeof value.sourceText !== "string" || value.sourceText.length > AI_MAX_TEXT_CHARS || (value.selectedText !== undefined && typeof value.selectedText !== "string")) {
    throw new Error("INVALID_SOURCE_TEXT");
  }
  if (!strings(value.requirementIds) || !isRecord(value.policy) || !Array.isArray(value.evidence) || value.evidence.length > AI_MAX_EVIDENCE || !value.evidence.every(isEvidence)) {
    throw new Error("INVALID_EVIDENCE");
  }
  const evidenceIds = value.evidence.map((item) => item.evidenceId);
  if (new Set(evidenceIds).size !== evidenceIds.length) throw new Error("DUPLICATE_EVIDENCE_ID");
  return value as unknown as WritingAiApiRequest;
}

export function validateSemanticReviewRequest(value: unknown): QualityAiSemanticReviewRequest {
  if (!isRecord(value) || typeof value.taskId !== "string" || typeof value.projectId !== "string" || !Number.isInteger(value.projectRevision)) throw new Error("INVALID_REQUEST");
  if (!strings(value.policyRuleIds) || !Array.isArray(value.blocks) || value.blocks.length > AI_MAX_BLOCKS || !Array.isArray(value.evidence) || value.evidence.length > AI_MAX_EVIDENCE) throw new Error("INVALID_REVIEW_INPUT");
  if (!value.evidence.every(isEvidence)) throw new Error("INVALID_EVIDENCE");
  const evidenceIds = new Set(value.evidence.map((item) => item.evidenceId));
  const validBlocks = value.blocks.every((block) => isRecord(block)
    && ["chapterId", "chapterTitle", "blockId", "blockTitle", "text"].every((key) => typeof block[key] === "string")
    && strings(block.evidenceIds)
    && block.evidenceIds.every((id) => evidenceIds.has(id)));
  if (!validBlocks || value.blocks.reduce((sum, block) => sum + String((block as Record<string, unknown>).text).length, 0) > AI_MAX_TEXT_CHARS) throw new Error("INVALID_BLOCKS");
  return value as unknown as QualityAiSemanticReviewRequest;
}

export function finalizeWritingResponse(request: WritingAiApiRequest, result: OpenAiStructuredResult<WritingModelOutput>): AiTaskResponse {
  const allowed = new Map(request.evidence.map((item) => [item.evidenceId, item]));
  const invalidCitation = result.output.citations.find((citation) => !allowed.has(citation.evidenceId));
  if (invalidCitation) throw new Error("UNKNOWN_EVIDENCE_CITATION");
  const citedFactIds = [...new Set(result.output.citations.map((citation) => allowed.get(citation.evidenceId)).filter((item) => item?.kind === "fact").map((item) => item!.entityId))];
  const unsupportedClaims = [...result.output.unsupportedClaims];
  if (["draft", "expand", "update"].includes(request.operation) && result.output.suggestion.trim() && result.output.citations.length === 0 && unsupportedClaims.length === 0) {
    unsupportedClaims.push("AI 未为新增内容提供可验证的输入证据引用。");
  }
  return {
    taskId: request.taskId,
    providerId: "openai-responses",
    providerMode: "live",
    label: "真实 AI · 证据约束建议",
    original: request.selectedText || request.sourceText,
    suggestion: result.output.suggestion,
    citations: result.output.citations,
    citedFactIds,
    unsupportedClaims,
    warnings: result.output.warnings,
    requiresConfirmation: true,
    model: result.model,
    responseId: result.responseId,
    generatedAt: new Date().toISOString(),
  };
}

export function finalizeSemanticReview(request: QualityAiSemanticReviewRequest, result: OpenAiStructuredResult<SemanticModelOutput>): QualityAiSemanticReviewRun {
  const blockIds = new Set(request.blocks.map((block) => block.blockId));
  const chapterIds = new Set(request.blocks.map((block) => block.chapterId));
  const evidenceIds = new Set(request.evidence.map((item) => item.evidenceId));
  for (const finding of result.output.findings) {
    if (!blockIds.has(finding.blockId) || !chapterIds.has(finding.chapterId) || finding.evidenceIds.some((id) => !evidenceIds.has(id))) throw new Error("INVALID_SEMANTIC_FINDING_REFERENCE");
  }
  return {
    taskId: request.taskId,
    projectId: request.projectId,
    projectRevision: request.projectRevision,
    providerId: "openai-responses",
    providerMode: "live",
    model: result.model,
    responseId: result.responseId,
    generatedAt: new Date().toISOString(),
    findings: result.output.findings.map((finding, index) => ({ ...finding, findingId: `${request.taskId}:${index + 1}` })),
    warnings: result.output.warnings,
    acceptedByUser: false,
  };
}
