import type { ReportProjectData } from "@/lib/types/project-data";
import type {
  DisclosureCoverageRecord,
  FinalizationReadiness,
  QualityCheckState,
  QualityCheckSummary,
  QualityIssue,
} from "@/lib/types/quality";

export function emptyQualitySummary(): QualityCheckSummary {
  return {
    applicableRequirementCount: 0,
    uncoveredCount: 0,
    partialCoverageCount: 0,
    pendingVerificationCount: 0,
    verifiedCoverageCount: 0,
    blockerCount: 0,
    highCount: 0,
    noticeCount: 0,
    unresolvedCount: 0,
    resolvedCount: 0,
    pendingRecheckCount: 0,
    acceptedExceptionCount: 0,
  };
}

export function createQualityState(): QualityCheckState {
  return {
    schemaVersion: 1,
    issues: [],
    runs: [],
    actions: [],
    coverage: [],
    summary: emptyQualitySummary(),
    readiness: "未检查",
    stale: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function isCompatibleQualityState(value: unknown): value is QualityCheckState {
  return isRecord(value)
    && value.schemaVersion === 1
    && Array.isArray(value.issues)
    && Array.isArray(value.runs)
    && Array.isArray(value.actions)
    && Array.isArray(value.coverage)
    && isRecord(value.summary)
    && typeof value.readiness === "string"
    && typeof value.stale === "boolean";
}

export function ensureQualityState(project: Omit<ReportProjectData, "quality"> & { quality?: unknown }): ReportProjectData {
  if (isCompatibleQualityState(project.quality)) return project as ReportProjectData;
  const migrationId = "migration-quality-check-v1";
  return {
    ...project,
    quality: createQualityState(),
    migrations: project.migrations.some((item) => item.id === migrationId)
      ? project.migrations
      : [...project.migrations, {
        id: migrationId,
        from: "ReportProjectData schema v2 without quality state",
        migratedAt: new Date().toISOString(),
        note: "已补充 Step 7 质量检查状态；原 Step 1–6 数据、正文、图表快照与历史版本保持不变。",
      }],
  } as ReportProjectData;
}

const activeStatuses = new Set<QualityIssue["status"]>(["待处理", "处理中", "待复检"]);

export function readinessForIssues(issues: QualityIssue[], stale: boolean): FinalizationReadiness {
  if (!issues.length) return stale ? "未检查" : "可提交定稿审核";
  if (issues.some((issue) => activeStatuses.has(issue.status) && issue.severity === "阻断")) return "存在阻断问题";
  if (stale || issues.some((issue) => activeStatuses.has(issue.status))) return "待人工确认";
  return "可提交定稿审核";
}

export function summarizeQuality(
  issues: QualityIssue[],
  coverage: DisclosureCoverageRecord[],
  lastRunId?: string,
  lastCheckedAt?: string,
): QualityCheckSummary {
  const unresolved = issues.filter((issue) => activeStatuses.has(issue.status));
  return {
    applicableRequirementCount: coverage.length,
    uncoveredCount: coverage.filter((item) => item.status === "未覆盖").length,
    partialCoverageCount: coverage.filter((item) => item.status === "部分覆盖").length,
    pendingVerificationCount: coverage.filter((item) => item.status === "待核验").length,
    verifiedCoverageCount: coverage.filter((item) => item.status === "已核验覆盖").length,
    blockerCount: unresolved.filter((issue) => issue.severity === "阻断").length,
    highCount: unresolved.filter((issue) => issue.severity === "高").length,
    noticeCount: unresolved.filter((issue) => issue.severity === "提示").length,
    unresolvedCount: unresolved.length,
    resolvedCount: issues.filter((issue) => issue.status === "已复检解决").length,
    pendingRecheckCount: issues.filter((issue) => issue.status === "待复检").length,
    acceptedExceptionCount: issues.filter((issue) => issue.status === "已接受例外").length,
    lastRunId,
    lastCheckedAt,
  };
}
