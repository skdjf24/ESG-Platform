import { qualityRuleDefinitions } from "@/lib/quality/rules";
import type { ReportProjectData } from "@/lib/types/project-data";
import type { FinalizationReadiness, Step8QualityGate } from "@/lib/types/quality";

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

/** Fingerprint only the report inputs consumed by deterministic quality rules. */
export function qualityInputFingerprint(project: ReportProjectData) {
  const report = { ...project.report };
  delete (report as Partial<typeof report>).updatedAt;
  const snapshot = {
    enterprise: project.enterprise,
    report,
    boundary: project.boundary,
    topics: project.topics,
    materiality: project.materiality,
    disclosureRequirements: project.disclosureRequirements,
    reportSections: project.reportSections,
    dataRequirements: project.dataRequirements,
    sources: project.sources,
    facts: project.facts,
    resources: project.resources,
    writing: { chapters: project.writing.chapters, policy: project.writing.policy },
    presentation: {
      themeId: project.presentation.themeId,
      layout: project.presentation.layout,
      observations: project.presentation.observations,
      charts: project.presentation.charts,
    },
  };
  return `quality-input-v1-${hash(JSON.stringify(canonicalize(snapshot)))}`;
}

export function qualityRuleSetFingerprint() {
  const rules = qualityRuleDefinitions
    .map((rule) => ({ ruleId: rule.ruleId, ruleVersion: rule.ruleVersion, inputDependencies: [...rule.inputDependencies].sort() }))
    .sort((left, right) => left.ruleId.localeCompare(right.ruleId));
  return `quality-rules-v1-${hash(JSON.stringify(rules))}`;
}

export function getStep8QualityGate(project: ReportProjectData): Step8QualityGate {
  const currentInputFingerprint = qualityInputFingerprint(project);
  const currentRuleSetFingerprint = qualityRuleSetFingerprint();
  const fullCheck = project.quality.fullCheck;
  const reasons: string[] = [];
  if (!fullCheck) reasons.push("当前项目尚未完成全面检查。");
  if (fullCheck && !fullCheck.valid) reasons.push(fullCheck.invalidationReason ?? "最近一次全面检查已经失效。");
  if (project.quality.stale) reasons.push("上游数据已变化，整本报告需要重新进行全面检查。");
  if (fullCheck && fullCheck.inputFingerprint !== currentInputFingerprint) reasons.push("当前报告输入与最近一次全面检查快照不一致。");
  if (fullCheck && fullCheck.ruleSetFingerprint !== currentRuleSetFingerprint) reasons.push("质量规则版本已变化，需要重新进行全面检查。");
  const fullRun = fullCheck ? project.quality.runs.find((run) => run.runId === fullCheck.runId) : undefined;
  if (fullCheck && (!fullRun || fullRun.scope !== "full" || fullRun.status !== "已完成")) reasons.push("全面检查运行记录不存在或未成功完成。");
  const validFullCheck = reasons.length === 0;
  const active = project.quality.issues.filter((issue) => ["待处理", "处理中", "待复检"].includes(issue.status));
  const blockers = active.filter((issue) => issue.severity === "阻断");
  let readiness: FinalizationReadiness;
  if (!fullCheck) readiness = "未检查";
  else if (!validFullCheck) readiness = "待人工确认";
  else if (blockers.length) readiness = "存在阻断问题";
  else if (active.length) readiness = "待人工确认";
  else readiness = "可提交定稿审核";
  return {
    validFullCheck,
    canSubmit: validFullCheck && active.length === 0,
    readiness,
    reasons,
    fullCheckRunId: fullCheck?.runId,
    checkedProjectRevision: fullCheck?.savedProjectRevision,
    currentInputFingerprint,
    currentRuleSetFingerprint,
  };
}
