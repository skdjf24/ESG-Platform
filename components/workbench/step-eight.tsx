"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Archive, CheckCircle2, Download, ExternalLink,
  FileCheck2, FileDown, History, LockKeyhole, ShieldCheck,
} from "lucide-react";
import { useProjectData } from "@/components/project/project-data-provider";
import { StepFooter } from "@/components/workbench/step-footer";
import { activeFinalVersion, finalizationFingerprint, isFinalVersionCurrent } from "@/lib/finalization/state";
import { createReportPages } from "@/lib/presentation/pages";
import { getStep8QualityGate } from "@/lib/quality/validity";
import type { FinalApprovalDeclarations, FinalReportVersion } from "@/lib/types/finalization";
import type { QualityIssue } from "@/lib/types/quality";

const declarationLabels: Record<keyof FinalApprovalDeclarations, string> = {
  contentReviewed: "已核对报告正文、目录和正式阅读内容",
  sourcesReviewed: "已核对关键事实、指标、来源和修订版本",
  authorityConfirmed: "确认本人具备提交本次定稿的内部授权",
  exportPreviewReviewed: "已核对最终版式、页码及打印/PDF 预览",
};

const activeStatuses = new Set(["待处理", "处理中", "待复检"]);

export function StepEight() {
  const router = useRouter();
  const { project, saveProject, saving, setMessage, ready } = useProjectData();
  const gate = useMemo(() => getStep8QualityGate(project), [project]);
  const activeIssues = useMemo(
    () => project.quality.issues.filter((issue) => activeStatuses.has(issue.status)),
    [project.quality.issues],
  );
  const activeVersion = activeFinalVersion(project);
  const versionCurrent = isFinalVersionCurrent(project, activeVersion);
  const pageCount = useMemo(() => createReportPages(project).length, [project]);
  const [approvedBy, setApprovedBy] = useState("");
  const [approverRole, setApproverRole] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [declarations, setDeclarations] = useState<FinalApprovalDeclarations>({
    contentReviewed: false,
    sourcesReviewed: false,
    authorityConfirmed: false,
    exportPreviewReviewed: false,
  });
  const formComplete = approvedBy.trim().length >= 2
    && approverRole.trim().length >= 2
    && Object.values(declarations).every(Boolean);

  function issueUrl(issue: QualityIssue) {
    const location = issue.locations[0];
    const params = new URLSearchParams();
    if (location?.chapterId ?? issue.chapterId) params.set("chapterId", location?.chapterId ?? issue.chapterId ?? "");
    if (location?.blockId ?? issue.blockId) params.set("blockId", location?.blockId ?? issue.blockId ?? "");
    if (location?.requirementId ?? issue.requirementIds[0]) params.set("requirementId", location?.requirementId ?? issue.requirementIds[0] ?? "");
    if (location?.factId ?? issue.factIds[0]) params.set("factId", location?.factId ?? issue.factIds[0] ?? "");
    const step = location?.sourceStep ?? issue.sourceStep;
    return `/reports/${project.projectId}/step/${step}${params.size ? `?${params.toString()}` : ""}`;
  }

  async function finalize() {
    const currentGate = getStep8QualityGate(project);
    if (!currentGate.canSubmit || !currentGate.fullCheckRunId) {
      setMessage(`Step 7 定稿门禁未通过：${currentGate.reasons.join("；") || `仍有 ${activeIssues.length} 项活动问题`}`);
      return;
    }
    if (!formComplete) {
      setMessage("请填写定稿确认人、授权角色并完成四项人工声明。原型记录不构成电子签名。");
      return;
    }
    if (versionCurrent) {
      setMessage("当前数据已经形成有效定稿；数据变化后才需要创建新版本。");
      return;
    }
    const finalizedAt = new Date().toISOString();
    const versionNumber = Math.max(0, ...project.finalization.versions.map((item) => item.versionNumber)) + 1;
    const version: FinalReportVersion = {
      versionId: `final-${globalThis.crypto.randomUUID()}`,
      versionNumber,
      label: `V${versionNumber}.0 · ${project.report.year} 年度 ESG 报告`,
      sourceFingerprint: finalizationFingerprint(project),
      qualityFullCheckRunId: currentGate.fullCheckRunId,
      qualityInputFingerprint: currentGate.currentInputFingerprint,
      qualityRuleSetFingerprint: currentGate.currentRuleSetFingerprint,
      projectRevision: project.revision,
      presentationRevision: project.presentation.revision,
      enterpriseName: project.enterprise.name,
      reportYear: project.report.year,
      reportingPeriod: structuredClone(project.report.reportingPeriod),
      pageCount,
      issueSummary: {
        total: project.quality.issues.length,
        blockers: project.quality.summary.blockerCount,
        high: project.quality.summary.highCount,
        notices: project.quality.summary.noticeCount,
        acceptedExceptions: project.quality.summary.acceptedExceptionCount,
      },
      issueRecords: project.quality.issues.map((issue) => ({
        issueId: issue.issueId,
        stableKey: issue.stableKey,
        category: issue.category,
        severity: issue.severity,
        title: issue.title,
        status: issue.status,
        resolutionNote: issue.resolutionNote,
        exceptionReason: issue.exceptionReason,
        inputFingerprint: issue.inputFingerprint,
      })),
      declarations: structuredClone(declarations),
      approvedBy: approvedBy.trim(),
      approverRole: approverRole.trim(),
      approvalNote: approvalNote.trim(),
      finalizedAt,
    };
    const next = {
      ...project,
      finalization: {
        ...project.finalization,
        versions: [...project.finalization.versions, version],
        activeVersionId: version.versionId,
        revision: project.finalization.revision + 1,
      },
    };
    if (await saveProject(8, `Step 8 定稿 ${version.label}`, next)) {
      setMessage(`${version.label} 已形成定稿记录。请打开最终打印版复核，并按需保存为 PDF。`);
    }
  }

  function downloadArchive(version: FinalReportVersion) {
    if (!isFinalVersionCurrent(project, version)) {
      setMessage("当前项目已发生变化，不能从旧定稿生成新的归档包。请重新执行 Step 7 全面检查并创建新版本。");
      return;
    }
    const { finalization: _finalization, ...sourceSnapshot } = project;
    void _finalization;
    const payload = {
      archiveSchemaVersion: 1,
      exportedAt: new Date().toISOString(),
      simulatedPrototype: true,
      version,
      sourceSnapshot,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.enterprise.shortName}-${project.report.year}-ESG-V${version.versionNumber}.0-archive.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!ready) return <div className="p-12 text-center text-sm text-[#64776b]">正在读取 Step 7 质量状态与定稿记录…</div>;

  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#6d8275]">Step 08 · Finalization & export</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">定稿与导出</h1>
          <p className="mt-2 text-xs leading-5 text-[#78877e]">直接读取 Step 7.1 的全面检查有效性、质量输入指纹和规则集指纹，形成可追溯定稿版本。</p>
        </div>
        {activeVersion ? <VersionBadge version={activeVersion} current={versionCurrent} /> : null}
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard icon={ShieldCheck} label="Step 7 Gate" value={gate.validFullCheck ? 1 : 0} detail={gate.readiness} tone={gate.canSubmit ? "green" : "red"} />
        <StatusCard icon={AlertTriangle} label="活动问题" value={activeIssues.length} detail={`${project.quality.summary.blockerCount} 项阻断`} tone={activeIssues.length ? "red" : "green"} />
        <StatusCard icon={FileCheck2} label="最终页面" value={pageCount} detail="按当前字体与版式重算" tone="gray" />
        <StatusCard icon={History} label="定稿版本" value={project.finalization.versions.length} detail={activeVersion ? activeVersion.label : "尚未创建"} tone="blue" />
      </div>

      {!gate.canSubmit ? (
        <section className="mb-5 rounded-2xl border border-red-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600"><LockKeyhole className="size-4" /></span>
            <div><h2 className="text-sm font-semibold text-red-900">定稿门禁未通过</h2><p className="mt-1 text-[11px] leading-5 text-red-700">Step 8 不会自行改写或绕过 Step 7 结论。请先完成有效全面检查并关闭全部活动问题。</p></div>
          </div>
          {gate.reasons.length ? <ul className="mt-4 space-y-1 text-[10px] leading-5 text-red-800">{gate.reasons.map((reason) => <li key={reason}>· {reason}</li>)}</ul> : null}
          <div className="mt-4 space-y-2">{activeIssues.slice(0, 8).map((issue) => (
            <div key={issue.issueId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50/50 px-3 py-2.5">
              <div><p className="text-[10px] font-semibold text-red-900">{issue.severity} · {issue.title}</p><p className="mt-1 text-[9px] text-red-700">{issue.description}</p></div>
              <button type="button" onClick={() => router.push(issueUrl(issue))} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[9px] font-semibold text-red-700">定位 Step {issue.sourceStep}</button>
            </div>
          ))}</div>
          <button type="button" onClick={() => router.push(`/reports/${project.projectId}/step/7`)} className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-[10px] font-semibold text-white">返回 Step 7 复核</button>
        </section>
      ) : (
        <section className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-[11px] text-emerald-900"><div className="flex items-center gap-2"><CheckCircle2 className="size-4" /><span className="font-semibold">Step 7.1 定稿门禁已通过：全面检查、输入指纹及规则集指纹均为当前有效版本。</span></div></section>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-[#dfe6e2] bg-white p-5">
          <div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-[#eaf4ef] text-[#176b52]"><LockKeyhole className="size-4" /></span><div><h2 className="text-sm font-semibold text-[#293d32]">人工定稿确认</h2><p className="mt-0.5 text-[9px] text-[#839087]">签署信息仅用于原型版本记录，不构成电子签名。</p></div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Field label="定稿确认人"><input aria-label="定稿确认人" value={approvedBy} onChange={(event) => setApprovedBy(event.target.value)} placeholder="请输入姓名" className="h-10 w-full rounded-lg border border-[#dce4df] px-3 text-[11px] outline-none focus:border-[#78a28f]" /></Field>
            <Field label="职务 / 授权角色"><input aria-label="定稿授权角色" value={approverRole} onChange={(event) => setApproverRole(event.target.value)} placeholder="例如：ESG 报告负责人" className="h-10 w-full rounded-lg border border-[#dce4df] px-3 text-[11px] outline-none focus:border-[#78a28f]" /></Field>
          </div>
          <Field label="定稿说明（选填）"><textarea aria-label="定稿说明" value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} rows={3} placeholder="记录本版本适用范围、特殊说明或审批依据" className="w-full resize-none rounded-lg border border-[#dce4df] p-3 text-[11px] outline-none focus:border-[#78a28f]" /></Field>
          <div className="mt-4 space-y-2">{(Object.keys(declarationLabels) as Array<keyof FinalApprovalDeclarations>).map((key) => <label key={key} className="flex cursor-pointer items-start gap-2 rounded-xl border border-[#e3e9e5] p-3 text-[10px] leading-5 text-[#526359]"><input type="checkbox" checked={declarations[key]} onChange={(event) => setDeclarations((current) => ({ ...current, [key]: event.target.checked }))} className="mt-0.5 accent-[#176b52]" /><span>{declarationLabels[key]}</span></label>)}</div>
          <button type="button" disabled={saving || !gate.canSubmit || !formComplete || versionCurrent} onClick={() => void finalize()} className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-[#176b52] px-5 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><FileCheck2 className="size-4" />{saving ? "正在形成定稿…" : versionCurrent ? "当前数据已完成定稿" : "确认并创建新定稿版本"}</button>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-[#dfe6e2] bg-white p-5"><div className="flex items-center gap-2"><FileDown className="size-4 text-[#176b52]" /><h2 className="text-sm font-semibold text-[#293d32]">最终输出</h2></div><p className="mt-2 text-[10px] leading-5 text-[#78877e]">仅当前项目与定稿指纹一致时允许输出；PDF 由浏览器打印功能保存。</p><div className="mt-4 space-y-2"><button type="button" disabled={!activeVersion || !versionCurrent} onClick={() => window.open(`/reports/${project.projectId}/final`, "_blank", "noopener,noreferrer")} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#244d3c] text-[10px] font-semibold text-white disabled:opacity-35"><ExternalLink className="size-3.5" />打开最终打印版</button><button type="button" disabled={!activeVersion || !versionCurrent} onClick={() => activeVersion && downloadArchive(activeVersion)} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#cfdad4] text-[10px] font-semibold text-[#176b52] disabled:opacity-35"><Download className="size-3.5" />下载审计归档 JSON</button></div></section>
          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-[10px] leading-5 text-blue-900"><p className="font-semibold">输出边界</p><p className="mt-1">不会自动对外发布，不生成服务器端电子签章；归档包明确标记为原型模拟输出。</p></section>
        </aside>
      </div>

      {project.finalization.versions.length ? <section className="mt-5 rounded-2xl border border-[#dfe6e2] bg-white p-5"><div className="flex items-center gap-2"><Archive className="size-4 text-[#176b52]" /><h2 className="text-sm font-semibold text-[#293d32]">版本归档记录</h2></div><div className="mt-4 space-y-2">{project.finalization.versions.slice().reverse().map((version) => { const current = isFinalVersionCurrent(project, version); return <div key={version.versionId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e4e9e6] px-4 py-3"><div><div className="flex items-center gap-2"><p className="text-[11px] font-semibold text-[#34483c]">{version.label}</p><span className={`rounded-full px-2 py-1 text-[8px] font-semibold ${current ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{current ? "当前有效" : "历史记录"}</span></div><p className="mt-1 text-[9px] text-[#829087]">{version.approvedBy} · {version.approverRole} · {new Date(version.finalizedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })} · {version.pageCount} 页</p></div><p className="text-[9px] text-[#829087]">来源指纹 {version.sourceFingerprint}</p></div>; })}</div></section> : null}

      <StepFooter currentStep={8} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="mt-3 block"><span className="mb-1.5 block text-[10px] font-semibold text-[#64736b]">{label}</span>{children}</label>;
}

function StatusCard({ icon: Icon, label, value, detail, tone }: { icon: typeof ShieldCheck; label: string; value: number; detail: string; tone: "blue" | "red" | "green" | "gray" }) {
  const colors = { blue: "bg-blue-50 text-blue-800", red: "bg-red-50 text-red-800", green: "bg-emerald-50 text-emerald-800", gray: "bg-slate-50 text-slate-700" };
  return <div className={`rounded-2xl border border-black/5 p-4 ${colors[tone]}`}><div className="flex items-center gap-2 text-[10px] font-semibold"><Icon className="size-4" />{label}</div><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-[9px] opacity-70">{detail}</p></div>;
}

function VersionBadge({ version, current }: { version: FinalReportVersion; current: boolean }) {
  return <div className={`rounded-xl border px-4 py-3 text-right ${current ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><p className={`text-[9px] font-semibold ${current ? "text-emerald-700" : "text-amber-700"}`}>{current ? "当前有效定稿" : "定稿已失效"}</p><p className={`mt-1 text-sm font-semibold ${current ? "text-emerald-900" : "text-amber-900"}`}>{current ? version.label : "源数据或 Step 7 结论已变化"}</p></div>;
}
