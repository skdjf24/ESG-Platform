import { qualityInputFingerprint, qualityRuleSetFingerprint } from "@/lib/quality/validity";
import type { ReportProjectData } from "@/lib/types/project-data";
import type { FinalReportVersion, FinalizationState } from "@/lib/types/finalization";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, canonicalize(item)]));
}

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

export function createFinalizationState(): FinalizationState {
  return { schemaVersion: 1, versions: [], revision: 1 };
}

export function isFinalizationState(value: unknown): value is FinalizationState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<FinalizationState>;
  return state.schemaVersion === 1
    && Array.isArray(state.versions)
    && Number.isInteger(state.revision)
    && Number(state.revision) > 0;
}

export function ensureFinalizationState(
  project: Omit<ReportProjectData, "finalization"> & { finalization?: unknown },
): ReportProjectData {
  if (isFinalizationState(project.finalization)) return project as ReportProjectData;
  const migrationId = "migration-finalization-v1";
  return {
    ...project,
    finalization: createFinalizationState(),
    migrations: project.migrations.some((item) => item.id === migrationId)
      ? project.migrations
      : [...project.migrations, {
        id: migrationId,
        from: "ReportProjectData schema v2 without Step 8 finalization",
        migratedAt: new Date().toISOString(),
        note: "已增加 Step 8 定稿与版本归档状态；Step 1–7 数据、质量运行、人工处理历史和报告内容保持不变。",
      }],
  } as ReportProjectData;
}

/**
 * Fingerprint the disclosure output and the exact Step 7 conclusion used by
 * the finalization gate. Workflow timestamps and save revisions are excluded,
 * so a no-op save cannot invalidate a final version.
 */
export function finalizationFingerprint(project: ReportProjectData) {
  const qualityConclusion = {
    input: qualityInputFingerprint(project),
    rules: qualityRuleSetFingerprint(),
    fullCheck: project.quality.fullCheck,
    issues: project.quality.issues.map((issue) => ({
      issueId: issue.issueId,
      stableKey: issue.stableKey,
      status: issue.status,
      inputFingerprint: issue.inputFingerprint,
      resolutionNote: issue.resolutionNote,
      exceptionReason: issue.exceptionReason,
    })),
    actions: project.quality.actions,
  };
  return `final-v1-${hash(JSON.stringify(canonicalize(qualityConclusion)))}`;
}

export function activeFinalVersion(project: ReportProjectData): FinalReportVersion | undefined {
  return project.finalization.versions.find((item) => item.versionId === project.finalization.activeVersionId);
}

export function isFinalVersionCurrent(project: ReportProjectData, version: FinalReportVersion | undefined) {
  return Boolean(version && version.sourceFingerprint === finalizationFingerprint(project));
}
