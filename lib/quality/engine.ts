import { summarizeQuality } from "@/lib/quality/state";
import { runQualityRules, type QualityCheckOptions } from "@/lib/quality/rules";
import { getStep8QualityGate, qualityInputFingerprint, qualityRuleSetFingerprint } from "@/lib/quality/validity";
import type { ReportProjectData } from "@/lib/types/project-data";
import type { QualityActionRecord, QualityCheckRun, QualityIssue, QualityIssueStatus, QualityInvalidationRecord } from "@/lib/types/quality";

const makeId = (prefix: string) => `${prefix}-${globalThis.crypto.randomUUID()}`;

function issueId(stableKey: string) {
  let result = 2166136261;
  for (let index = 0; index < stableKey.length; index += 1) {
    result ^= stableKey.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return `quality-${(result >>> 0).toString(36)}`;
}

function existingInScope(issue: QualityIssue, project: ReportProjectData, options: QualityCheckOptions) {
  if (options.scope === "full") return true;
  if (options.scope === "chapter") return issue.chapterId === options.chapterId
    || issue.locations.some((location) => location.chapterId === options.chapterId);
  return issue.status === "待复检";
}

function issueMatchesEntities(issue: QualityIssue, entityIds: string[]) {
  if (!entityIds.length) return true;
  const issueIds = [
    issue.chapterId,
    issue.blockId,
    ...issue.requirementIds,
    ...issue.factIds,
    ...issue.chartIds,
    ...issue.locations.flatMap((location) => [location.chapterId, location.blockId, location.requirementId, location.factId, location.chartId]),
  ];
  return entityIds.some((id) => issueIds.includes(id));
}

export function executeQualityCheck(
  project: ReportProjectData,
  scope: QualityCheckOptions["scope"],
  chapterId?: string,
): ReportProjectData {
  const now = new Date().toISOString();
  const runId = makeId("quality-run");
  const options: QualityCheckOptions = { scope, chapterId, runId, now };
  const result = runQualityRules(project, options);
  const previousByKey = new Map(project.quality.issues.map((issue) => [issue.stableKey, issue]));
  const detectedKeys = new Set(result.findings.map((finding) => finding.stableKey));
  const actions: QualityActionRecord[] = [];
  const issues: QualityIssue[] = result.findings.map((finding) => {
    const previous = previousByKey.get(finding.stableKey);
    const keepException = previous?.status === "已接受例外" && previous.inputFingerprint === finding.inputFingerprint;
    const status: QualityIssueStatus = keepException ? "已接受例外" : previous?.status === "处理中" ? "处理中" : "待处理";
    if (previous?.status === "已复检解决") {
      actions.push({
        actionId: makeId("quality-action"), issueId: previous.issueId, action: "问题重新打开",
        note: "问题在后续规则检查中重新出现；原解决记录保留。", actor: "确定性规则引擎", createdAt: now, method: "规则引擎",
      });
    }
    if (previous?.status === "已接受例外" && !keepException) {
      actions.push({
        actionId: makeId("quality-action"), issueId: previous.issueId, action: "例外失效重新确认",
        note: "问题输入已经变化，原例外理由不能自动沿用。", actor: "确定性规则引擎", createdAt: now, method: "规则引擎",
      });
    }
    return {
      ...finding,
      issueId: previous?.issueId ?? issueId(finding.stableKey),
      projectId: project.projectId,
      checkRunId: runId,
      status,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
      resolvedAt: undefined,
      exceptionReason: keepException ? previous?.exceptionReason : undefined,
      resolutionNote: keepException ? previous?.resolutionNote : undefined,
    };
  });

  for (const previous of project.quality.issues) {
    if (detectedKeys.has(previous.stableKey)) continue;
    if (!existingInScope(previous, project, options)) {
      issues.push(previous);
      continue;
    }
    if (previous.status === "已接受例外") {
      issues.push(previous);
      continue;
    }
    if (previous.status === "已复检解决") {
      issues.push(previous);
      continue;
    }
    const resolved: QualityIssue = {
      ...previous,
      checkRunId: runId,
      status: "已复检解决",
      resolvedAt: now,
      updatedAt: now,
      resolutionNote: previous.resolutionNote ?? "确定性规则复检未再次命中。",
    };
    issues.push(resolved);
    actions.push({
      actionId: makeId("quality-action"),
      issueId: previous.issueId,
      action: "系统复检解决",
      note: "规则复检未再次命中；保留原问题及处理历史。",
      actor: "确定性规则引擎",
      createdAt: now,
      method: "规则引擎",
    });
  }

  const ruleVersions = Object.fromEntries(result.rules.map((rule) => [rule.ruleId, rule.ruleVersion]));
  const inputFingerprint = qualityInputFingerprint(project);
  const ruleSetFingerprint = qualityRuleSetFingerprint();
  const run: QualityCheckRun = {
    runId,
    projectId: project.projectId,
    startedAt: now,
    completedAt: now,
    scope,
    chapterId,
    inputProjectRevision: project.revision,
    inputFingerprint,
    ruleSetFingerprint,
    ruleVersions,
    issueIds: result.findings.map((finding) => previousByKey.get(finding.stableKey)?.issueId ?? issueId(finding.stableKey)),
    status: "已完成",
  };
  const coverage = result.coverage;
  const summary = summarizeQuality(issues, coverage, runId, now);
  const nextQuality = {
    ...project.quality,
    issues: issues.sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    runs: [...project.quality.runs, run],
    actions: [...project.quality.actions, ...actions],
    coverage,
    summary,
    checkedProjectRevision: scope === "full" ? project.revision + 1 : project.quality.checkedProjectRevision,
    fullCheck: scope === "full" ? {
      runId,
      inputProjectRevision: project.revision,
      savedProjectRevision: project.revision + 1,
      inputFingerprint,
      ruleSetFingerprint,
      completedAt: now,
      valid: true,
    } : project.quality.fullCheck,
    stale: scope === "full" ? false : project.quality.stale,
    savedAt: now,
  } as ReportProjectData["quality"];
  const nextProject: ReportProjectData = {
    ...project,
    quality: nextQuality,
  };
  nextProject.quality.readiness = getStep8QualityGate(nextProject).readiness;
  return nextProject;
}

export function updateQualityIssue(
  project: ReportProjectData,
  issueIdValue: string,
  status: QualityIssueStatus,
  note: string,
  action: QualityActionRecord["action"],
  method: QualityActionRecord["method"] = "人工",
): ReportProjectData {
  const now = new Date().toISOString();
  const target = project.quality.issues.find((issue) => issue.issueId === issueIdValue);
  if (!target) return project;
  if (status === "已接受例外" && target.severity === "阻断") return project;
  const issues = project.quality.issues.map((issue) => issue.issueId === issueIdValue ? {
    ...issue,
    status,
    updatedAt: now,
    resolutionNote: note || issue.resolutionNote,
    exceptionReason: status === "已接受例外" ? note : issue.exceptionReason,
    resolvedAt: status === "已复检解决" ? now : undefined,
  } : issue);
  const record: QualityActionRecord = {
    actionId: makeId("quality-action"),
    issueId: issueIdValue,
    action,
    note,
    actor: "当前用户",
    createdAt: now,
    method,
  };
  const summary = summarizeQuality(issues, project.quality.coverage, project.quality.summary.lastRunId, project.quality.summary.lastCheckedAt);
  const nextProject: ReportProjectData = {
    ...project,
    quality: {
      ...project.quality,
      issues,
      actions: [...project.quality.actions, record],
      summary,
      savedAt: now,
    },
  };
  nextProject.quality.readiness = getStep8QualityGate(nextProject).readiness;
  return nextProject;
}

export function markQualityChecksStale(
  project: ReportProjectData,
  note: string,
  sourceStep: QualityInvalidationRecord["sourceStep"],
  affectedEntityIds: string[] = [],
): ReportProjectData {
  if (!project.quality.runs.length && !project.quality.fullCheck) return project;
  const now = new Date().toISOString();
  const directlyAffected = project.quality.issues.filter((issue) => issueMatchesEntities(issue, affectedEntityIds));
  // Project-level inputs (for example the enterprise name) may not have a direct
  // entity ID on an issue, but still affect terminology and formal report output.
  const affectedIssues = directlyAffected.length || !affectedEntityIds.length ? directlyAffected : project.quality.issues;
  const affectedIssueIds = new Set(affectedIssues.map((issue) => issue.issueId));
  const invalidationActions: QualityActionRecord[] = affectedIssues
    .filter((issue) => issue.status === "已接受例外")
    .map((issue) => ({
      actionId: makeId("quality-action"),
      issueId: issue.issueId,
      action: "例外失效重新确认" as const,
      note: `${note} 原例外结论已失效，需要重新确认。`,
      actor: "项目数据同步",
      createdAt: now,
      method: "规则引擎" as const,
    }));
  const issues = project.quality.issues.map((issue) => affectedIssueIds.has(issue.issueId) ? {
    ...issue,
    status: "待复检" as const,
    updatedAt: now,
    resolvedAt: undefined,
    exceptionReason: undefined,
    resolutionNote: note,
  } : issue);
  const invalidation: QualityInvalidationRecord = {
    invalidationId: makeId("quality-invalidation"),
    sourceStep,
    projectRevision: project.revision + 1,
    reason: note,
    affectedEntityIds: [...new Set(affectedEntityIds)],
    affectedIssueIds: affectedIssues.map((issue) => issue.issueId),
    createdAt: now,
  };
  const nextProject: ReportProjectData = {
    ...project,
    quality: {
      ...project.quality,
      issues,
      fullCheck: project.quality.fullCheck ? {
        ...project.quality.fullCheck,
        valid: false,
        invalidatedAt: now,
        invalidationReason: note,
      } : undefined,
      invalidations: [...project.quality.invalidations, invalidation],
      actions: [...project.quality.actions, ...invalidationActions],
      stale: true,
      summary: summarizeQuality(issues, project.quality.coverage, project.quality.summary.lastRunId, project.quality.summary.lastCheckedAt),
    },
  };
  nextProject.quality.readiness = getStep8QualityGate(nextProject).readiness;
  return nextProject;
}
