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
    schemaVersion: 2,
    issues: [],
    runs: [],
    actions: [],
    coverage: [],
    summary: emptyQualitySummary(),
    readiness: "未检查",
    invalidations: [],
    stale: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function dedupeIssues(issues: QualityIssue[]) {
  const byKey = new Map<string, QualityIssue>();
  for (const issue of issues) {
    const previous = byKey.get(issue.stableKey);
    if (!previous) {
      byKey.set(issue.stableKey, issue);
      continue;
    }
    const locations = [...new Map([...previous.locations, ...issue.locations].map((location) => [
      [location.sourceStep, location.chapterId, location.blockId, location.requirementId, location.factId, location.chartId].join(":"),
      location,
    ])).values()];
    const newer = previous.updatedAt >= issue.updatedAt ? previous : issue;
    byKey.set(issue.stableKey, {
      ...newer,
      issueId: previous.issueId,
      locations,
      requirementIds: [...new Set([...previous.requirementIds, ...issue.requirementIds])],
      factIds: [...new Set([...previous.factIds, ...issue.factIds])],
      chartIds: [...new Set([...previous.chartIds, ...issue.chartIds])],
      sourceReferences: [...new Map([...previous.sourceReferences, ...issue.sourceReferences].map((source) => [source.id, source])).values()],
      evidence: [...new Map([...previous.evidence, ...issue.evidence].map((evidence) => [
        [evidence.label, evidence.value, evidence.entityType, evidence.entityId].join(":"), evidence,
      ])).values()],
      createdAt: previous.createdAt <= issue.createdAt ? previous.createdAt : issue.createdAt,
      updatedAt: previous.updatedAt >= issue.updatedAt ? previous.updatedAt : issue.updatedAt,
    });
  }
  return [...byKey.values()];
}

export function isCompatibleQualityState(value: unknown): boolean {
  return isRecord(value)
    && [1, 2].includes(Number(value.schemaVersion))
    && Array.isArray(value.issues)
    && Array.isArray(value.runs)
    && Array.isArray(value.actions)
    && Array.isArray(value.coverage)
    && isRecord(value.summary)
    && typeof value.readiness === "string"
    && typeof value.stale === "boolean";
}

export function ensureQualityState(project: Omit<ReportProjectData, "quality"> & { quality?: unknown }): ReportProjectData {
  const raw = project.quality;
  const isCurrent = isCompatibleQualityState(raw)
    && isRecord(raw)
    && raw.schemaVersion === 2
    && Array.isArray(raw.invalidations)
    && (raw.issues as unknown[]).every((issue) => isRecord(issue) && Array.isArray(issue.locations))
    && (raw.runs as unknown[]).every((run) => isRecord(run) && typeof run.inputFingerprint === "string" && typeof run.ruleSetFingerprint === "string")
    && (raw.coverage as unknown[]).every((coverage) => isRecord(coverage) && typeof coverage.requirementFingerprint === "string");
  if (isCurrent) return project as ReportProjectData;
  const migrationId = isCompatibleQualityState(raw) ? "migration-quality-check-v2" : "migration-quality-check-v1";
  const previous = isCompatibleQualityState(raw) && isRecord(raw) ? raw : null;
  const issues = dedupeIssues(previous && Array.isArray(previous.issues) ? previous.issues.map((item) => {
    const issue = item as QualityIssue;
    return {
      ...issue,
      locations: Array.isArray(issue.locations) && issue.locations.length ? issue.locations : [{
        sourceStep: issue.sourceStep,
        chapterId: issue.chapterId,
        blockId: issue.blockId,
        requirementId: issue.requirementIds?.[0],
        factId: issue.factIds?.[0],
        chartId: issue.chartIds?.[0],
        label: issue.blockId ?? issue.chapterId ?? issue.factIds?.[0] ?? issue.requirementIds?.[0] ?? `Step ${issue.sourceStep}`,
      }],
    };
  }) : []);
  const runs = previous && Array.isArray(previous.runs) ? previous.runs.map((item) => ({
    ...(item as QualityCheckState["runs"][number]),
    inputFingerprint: (item as Partial<QualityCheckState["runs"][number]>).inputFingerprint ?? "legacy-unverified",
    ruleSetFingerprint: (item as Partial<QualityCheckState["runs"][number]>).ruleSetFingerprint ?? "legacy-unverified",
  })) : [];
  const coverage = previous && Array.isArray(previous.coverage) ? previous.coverage.map((item) => ({
    ...(item as QualityCheckState["coverage"][number]),
    requirementRevision: (item as Partial<QualityCheckState["coverage"][number]>).requirementRevision ?? 0,
    requirementFingerprint: (item as Partial<QualityCheckState["coverage"][number]>).requirementFingerprint ?? "legacy-unverified",
  })) : [];
  const quality: QualityCheckState = {
    ...createQualityState(),
    issues,
    runs,
    actions: previous && Array.isArray(previous.actions) ? previous.actions as QualityCheckState["actions"] : [],
    coverage,
    summary: previous && isRecord(previous.summary) ? previous.summary as unknown as QualityCheckState["summary"] : emptyQualitySummary(),
    readiness: runs.length ? "待人工确认" : "未检查",
    checkedProjectRevision: typeof previous?.checkedProjectRevision === "number" ? previous.checkedProjectRevision : undefined,
    stale: runs.length > 0,
    savedAt: typeof previous?.savedAt === "string" ? previous.savedAt : undefined,
  };
  return {
    ...project,
    quality,
    migrations: project.migrations.some((item) => item.id === migrationId)
      ? project.migrations
      : [...project.migrations, {
        id: migrationId,
        from: previous ? "QualityCheckState schema v1" : "ReportProjectData schema v2 without quality state",
        migratedAt: new Date().toISOString(),
        note: previous
          ? "已升级 Step 7 全面检查有效性与多位置问题模型；旧运行、问题和人工处理历史保留，原全面检查需重新执行。"
          : "已补充 Step 7 质量检查状态；原 Step 1–6 数据、正文、图表快照与历史版本保持不变。",
      }],
  } as ReportProjectData;
}

const activeStatuses = new Set<QualityIssue["status"]>(["待处理", "处理中", "待复检"]);

export function readinessForIssues(issues: QualityIssue[], stale: boolean, validFullCheck: boolean): FinalizationReadiness {
  if (!validFullCheck) return issues.length || stale ? "待人工确认" : "未检查";
  if (!issues.length) return "可提交定稿审核";
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
