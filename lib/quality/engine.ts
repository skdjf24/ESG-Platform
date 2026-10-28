import { readinessForIssues, summarizeQuality } from "@/lib/quality/state";
import { runQualityRules, type QualityCheckOptions } from "@/lib/quality/rules";
import type { ReportProjectData } from "@/lib/types/project-data";
import type { QualityActionRecord, QualityCheckRun, QualityIssue, QualityIssueStatus } from "@/lib/types/quality";

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
  if (options.scope === "chapter") return issue.chapterId === options.chapterId;
  return issue.status === "待复检";
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
  const issues: QualityIssue[] = result.findings.map((finding) => {
    const previous = previousByKey.get(finding.stableKey);
    const keepException = previous?.status === "已接受例外" && previous.inputFingerprint === finding.inputFingerprint;
    const status: QualityIssueStatus = keepException ? "已接受例外" : previous?.status === "处理中" ? "处理中" : "待处理";
    return {
      ...finding,
      issueId: previous?.issueId ?? issueId(finding.stableKey),
      projectId: project.projectId,
      checkRunId: runId,
      status,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
      exceptionReason: keepException ? previous?.exceptionReason : undefined,
      resolutionNote: keepException ? previous?.resolutionNote : undefined,
    };
  });

  const actions: QualityActionRecord[] = [];
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
  const run: QualityCheckRun = {
    runId,
    projectId: project.projectId,
    startedAt: now,
    completedAt: now,
    scope,
    chapterId,
    inputProjectRevision: project.revision,
    ruleVersions,
    issueIds: result.findings.map((finding) => previousByKey.get(finding.stableKey)?.issueId ?? issueId(finding.stableKey)),
    status: "已完成",
  };
  const coverage = result.coverage;
  const summary = summarizeQuality(issues, coverage, runId, now);
  const readiness = readinessForIssues(issues, false);
  return {
    ...project,
    quality: {
      ...project.quality,
      issues: issues.sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
      runs: [...project.quality.runs, run].slice(-50),
      actions: [...project.quality.actions, ...actions].slice(-300),
      coverage,
      summary,
      readiness,
      checkedProjectRevision: project.revision + 1,
      stale: false,
      savedAt: now,
    },
  };
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
  return {
    ...project,
    quality: {
      ...project.quality,
      issues,
      actions: [...project.quality.actions, record].slice(-300),
      summary,
      readiness: readinessForIssues(issues, project.quality.stale),
      savedAt: now,
    },
  };
}

export function markQualityChecksStale(project: ReportProjectData, note: string): ReportProjectData {
  if (!project.quality.runs.length) return project;
  const now = new Date().toISOString();
  const issues = project.quality.issues.map((issue) => issue.status === "已复检解决" ? issue : {
    ...issue,
    status: "待复检" as const,
    updatedAt: now,
    resolutionNote: note,
  });
  return {
    ...project,
    quality: {
      ...project.quality,
      issues,
      stale: true,
      readiness: readinessForIssues(issues, true),
      summary: summarizeQuality(issues, project.quality.coverage, project.quality.summary.lastRunId, project.quality.summary.lastCheckedAt),
    },
  };
}
