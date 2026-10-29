import type { SourceReference } from "@/lib/types/esg";

export type QualityCategory = "disclosure" | "source" | "data" | "writing" | "layout";
export type QualitySeverity = "阻断" | "高" | "提示";
export type QualityIssueStatus = "待处理" | "处理中" | "待复检" | "已复检解决" | "已接受例外";
export type QualityFindingMethod = "规则检查" | "Mock AI" | "人工确认";
export type QualityCoverageStatus = "未覆盖" | "部分覆盖" | "待核验" | "已核验覆盖";
export type QualityCheckScope = "full" | "chapter" | "changed";
export type QualityRunStatus = "运行中" | "已完成" | "失败";
export type FinalizationReadiness = "未检查" | "检查中" | "存在阻断问题" | "待人工确认" | "可提交定稿审核";

export interface QualityEvidence {
  label: string;
  value: string;
  entityType?: "requirement" | "chapter" | "block" | "fact" | "source" | "observation" | "chart" | "page" | "policy";
  entityId?: string;
}

export interface QualityIssueLocation {
  sourceStep: 3 | 4 | 5 | 6 | 7;
  chapterId?: string;
  blockId?: string;
  requirementId?: string;
  factId?: string;
  chartId?: string;
  label: string;
}

export interface QualityRuleDefinition {
  ruleId: string;
  ruleVersion: string;
  category: QualityCategory;
  defaultSeverity: QualitySeverity;
  description: string;
  inputDependencies: string[];
}

export interface QualityIssue {
  issueId: string;
  stableKey: string;
  projectId: string;
  checkRunId: string;
  ruleId: string;
  ruleVersion: string;
  category: QualityCategory;
  severity: QualitySeverity;
  title: string;
  description: string;
  sourceStep: 3 | 4 | 5 | 6 | 7;
  chapterId?: string;
  blockId?: string;
  locations: QualityIssueLocation[];
  requirementIds: string[];
  factIds: string[];
  chartIds: string[];
  sourceReferences: SourceReference[];
  evidence: QualityEvidence[];
  suggestedAction: string;
  findingMethod: QualityFindingMethod;
  status: QualityIssueStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolutionNote?: string;
  exceptionReason?: string;
  inputFingerprint: string;
}

export interface QualityCheckRun {
  runId: string;
  projectId: string;
  startedAt: string;
  completedAt?: string;
  scope: QualityCheckScope;
  chapterId?: string;
  inputProjectRevision: number;
  inputFingerprint: string;
  ruleSetFingerprint: string;
  ruleVersions: Record<string, string>;
  issueIds: string[];
  status: QualityRunStatus;
  errorMessage?: string;
}

export interface QualityActionRecord {
  actionId: string;
  issueId: string;
  action: "认可问题" | "返回修改" | "标记已处理" | "提交复检" | "接受例外" | "系统复检解决" | "问题重新打开" | "例外失效重新确认" | "记录 Mock AI 建议";
  note: string;
  actor: string;
  createdAt: string;
  method: "人工" | "规则引擎" | "Mock AI";
}

export interface DisclosureCoverageRecord {
  requirementId: string;
  requirementRevision: number;
  requirementFingerprint: string;
  status: QualityCoverageStatus;
  reason: string;
  chapterIds: string[];
  blockIds: string[];
  assessedAt: string;
  method: "规则检查" | "人工确认";
}

export interface QualityFullCheckRecord {
  runId: string;
  inputProjectRevision: number;
  savedProjectRevision: number;
  inputFingerprint: string;
  ruleSetFingerprint: string;
  completedAt: string;
  valid: boolean;
  invalidatedAt?: string;
  invalidationReason?: string;
}

export interface QualityInvalidationRecord {
  invalidationId: string;
  sourceStep: 1 | 2 | 3 | 4 | 5 | 6;
  projectRevision: number;
  reason: string;
  affectedEntityIds: string[];
  affectedIssueIds: string[];
  createdAt: string;
}

export interface Step8QualityGate {
  validFullCheck: boolean;
  canSubmit: boolean;
  readiness: FinalizationReadiness;
  reasons: string[];
  fullCheckRunId?: string;
  checkedProjectRevision?: number;
  currentInputFingerprint: string;
  currentRuleSetFingerprint: string;
}

export interface QualityCheckSummary {
  applicableRequirementCount: number;
  uncoveredCount: number;
  partialCoverageCount: number;
  pendingVerificationCount: number;
  verifiedCoverageCount: number;
  blockerCount: number;
  highCount: number;
  noticeCount: number;
  unresolvedCount: number;
  resolvedCount: number;
  pendingRecheckCount: number;
  acceptedExceptionCount: number;
  lastRunId?: string;
  lastCheckedAt?: string;
}

export interface QualityCheckState {
  schemaVersion: 2;
  issues: QualityIssue[];
  runs: QualityCheckRun[];
  actions: QualityActionRecord[];
  coverage: DisclosureCoverageRecord[];
  summary: QualityCheckSummary;
  readiness: FinalizationReadiness;
  checkedProjectRevision?: number;
  fullCheck?: QualityFullCheckRecord;
  invalidations: QualityInvalidationRecord[];
  stale: boolean;
  savedAt?: string;
}

export type QualityAiOperation = "disclosure-sufficiency" | "unsupported-claim" | "semantic-contradiction" | "vague-language" | "suggest-fix";

export interface QualityAiTaskRequest {
  taskId: string;
  operation: QualityAiOperation;
  projectId: string;
  issue: QualityIssue;
  policyRuleIds: string[];
}

export interface QualityAiTaskResponse {
  taskId: string;
  providerId: string;
  providerMode: "mock" | "live";
  label: string;
  suggestion: string;
  warnings: string[];
  requiresHumanConfirmation: boolean;
}

export interface QualityAiTaskProvider {
  id: string;
  mode: "mock" | "live";
  label: string;
  run(request: QualityAiTaskRequest, signal?: AbortSignal): Promise<QualityAiTaskResponse>;
}
