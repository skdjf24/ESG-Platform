"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertOctagon,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  ExternalLink,
  FileCheck2,
  FileSearch,
  Filter,
  History,
  LayoutTemplate,
  Link2,
  ListChecks,
  LoaderCircle,
  MapPin,
  Play,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useProjectData } from "@/components/project/project-data-provider";
import { executeQualityCheck, updateQualityIssue } from "@/lib/quality/engine";
import { mockQualityAiProvider } from "@/lib/quality/mock-ai";
import { qualityCategoryLabel } from "@/lib/quality/rules";
import type {
  QualityAiTaskResponse,
  QualityCategory,
  QualityCheckScope,
  QualityIssue,
  QualityIssueStatus,
  QualitySeverity,
} from "@/lib/types/quality";

const categories: Array<{ id: QualityCategory | "all"; label: string; icon: typeof ShieldCheck }> = [
  { id: "all", label: "全部检查", icon: ListChecks },
  { id: "disclosure", label: "披露完整性", icon: ClipboardCheck },
  { id: "source", label: "事实与来源", icon: Link2 },
  { id: "data", label: "数据一致性", icon: FileSearch },
  { id: "writing", label: "文字与 Writing Policy", icon: FileCheck2 },
  { id: "layout", label: "版式与结构", icon: LayoutTemplate },
];

const severityClass: Record<QualitySeverity, string> = {
  阻断: "border-rose-200 bg-rose-50 text-rose-700",
  高: "border-amber-200 bg-amber-50 text-amber-700",
  提示: "border-blue-200 bg-blue-50 text-blue-700",
};
const statusClass: Record<QualityIssueStatus, string> = {
  待处理: "bg-rose-50 text-rose-700",
  处理中: "bg-blue-50 text-blue-700",
  待复检: "bg-amber-50 text-amber-700",
  已复检解决: "bg-emerald-50 text-emerald-700",
  已接受例外: "bg-slate-100 text-slate-600",
};
const button = "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#dce4df] bg-white px-3 text-[11px] font-semibold text-[#53665a] hover:bg-[#f3f7f4] disabled:cursor-not-allowed disabled:opacity-40";
const severityRank: Record<QualitySeverity, number> = { 阻断: 0, 高: 1, 提示: 2 };

export function StepSeven() {
  const router = useRouter();
  const { project, ready, saving, saveProject, editProject, setMessage } = useProjectData();
  const [category, setCategory] = useState<QualityCategory | "all">("all");
  const [severity, setSeverity] = useState<QualitySeverity | "all">("all");
  const [status, setStatus] = useState<QualityIssueStatus | "all">("all");
  const [chapterId, setChapterId] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"severity" | "updated">("severity");
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(() => project.quality.issues.find((issue) => issue.status !== "已复检解决")?.issueId ?? null);
  const [running, setRunning] = useState<QualityCheckScope | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [note, setNote] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<QualityAiTaskResponse | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);

  const issues = useMemo(() => project.quality.issues.filter((issue) => {
    const text = `${issue.title}${issue.description}${issue.suggestedAction}`.toLowerCase();
    return (category === "all" || issue.category === category)
      && (severity === "all" || issue.severity === severity)
      && (status === "all" || issue.status === status)
      && (chapterId === "all" || issue.chapterId === chapterId)
      && (!query.trim() || text.includes(query.trim().toLowerCase()));
  }).sort((left, right) => sort === "severity"
    ? severityRank[left.severity] - severityRank[right.severity] || right.updatedAt.localeCompare(left.updatedAt)
    : right.updatedAt.localeCompare(left.updatedAt)), [category, chapterId, project.quality.issues, query, severity, sort, status]);
  const selected = project.quality.issues.find((issue) => issue.issueId === selectedIssueId) ?? issues[0] ?? null;
  const summary = project.quality.summary;
  const latestRun = project.quality.runs.at(-1);
  const stale = project.quality.stale || Boolean(project.quality.checkedProjectRevision && project.quality.checkedProjectRevision !== project.revision);

  async function persist(next: typeof project, label: string) {
    editProject(next);
    const saved = await saveProject(7, label, next);
    if (!saved) return false;
    return true;
  }

  async function runCheck(scope: QualityCheckScope, targetChapterId?: string) {
    if (scope === "changed" && !project.quality.issues.some((issue) => issue.status === "待复检")) {
      setMessage("当前没有待复检问题；如需重新评估全部内容，请开始全面检查。");
      return;
    }
    const chapter = targetChapterId ?? (chapterId !== "all" ? chapterId : selected?.chapterId ?? project.writing.chapters[0]?.id);
    if (scope === "chapter" && !chapter) return;
    setRunning(scope);
    await new Promise((resolve) => setTimeout(resolve, 180));
    const next = executeQualityCheck(project, scope, scope === "chapter" ? chapter : undefined);
    const saved = await persist(next, scope === "full" ? "Step 7 全面质量检查" : scope === "chapter" ? "Step 7 当前章节检查" : "Step 7 修改项复检");
    if (saved) {
      const first = next.quality.issues.find((issue) => issue.checkRunId === next.quality.summary.lastRunId && issue.status !== "已复检解决");
      setSelectedIssueId(first?.issueId ?? selectedIssueId);
      setMessage(`确定性规则检查已完成：本次发现 ${next.quality.runs.at(-1)?.issueIds.length ?? 0} 项；披露充分性和事实真实性仍由用户确认。`);
    }
    setRunning(null);
  }

  async function recordStatus(nextStatus: QualityIssueStatus, action: Parameters<typeof updateQualityIssue>[4]) {
    if (!selected) return;
    if ((nextStatus === "已接受例外" || nextStatus === "待复检") && !note.trim()) {
      setMessage(nextStatus === "已接受例外" ? "接受例外必须填写理由。" : "请填写处理说明后再提交复检。");
      return;
    }
    if (nextStatus === "已接受例外" && selected.severity === "阻断") {
      setMessage("阻断问题不能通过普通例外绕过，请返回前序步骤修复并重新检查。");
      return;
    }
    const next = updateQualityIssue(project, selected.issueId, nextStatus, note.trim(), action);
    if (await persist(next, `Step 7 ${action}`)) setNote("");
  }

  async function recheckSelected() {
    if (!selected) return;
    const marked = updateQualityIssue(project, selected.issueId, "待复检", note.trim() || "用户发起单项复检。", "提交复检");
    const checked = executeQualityCheck(marked, "changed");
    if (await persist(checked, "Step 7 单项问题复检")) {
      setNote("");
      setMessage("已重新运行相关确定性规则；问题记录和处理历史均已保留。");
    }
  }

  function locationUrl(issue: QualityIssue) {
    const params = new URLSearchParams();
    if (issue.chapterId) params.set("chapterId", issue.chapterId);
    if (issue.blockId) params.set("blockId", issue.blockId);
    if (issue.requirementIds[0]) params.set("requirementId", issue.requirementIds[0]);
    if (issue.factIds[0]) params.set("factId", issue.factIds[0]);
    if (issue.chartIds[0]) params.set("chartId", issue.chartIds[0]);
    return `/reports/${project.projectId}/step/${issue.sourceStep}${params.size ? `?${params.toString()}` : ""}`;
  }

  async function askAi() {
    if (!selected) return;
    setAiLoading(true);
    setAiResponse(null);
    try {
      const response = await mockQualityAiProvider.run({
        taskId: crypto.randomUUID(), operation: "suggest-fix", projectId: project.projectId,
        issue: selected, policyRuleIds: project.writing.policy.rules.filter((rule) => rule.enabled).map((rule) => rule.id),
      });
      setAiResponse(response);
    } finally {
      setAiLoading(false);
    }
  }

  async function recordAiSuggestion() {
    if (!selected || !aiResponse) return;
    const next = updateQualityIssue(project, selected.issueId, selected.status, aiResponse.suggestion, "记录 Mock AI 建议", "Mock AI");
    if (await persist(next, "Step 7 记录 Mock AI 建议")) setMessage("已将 Mock 建议记录到处理历史；未修改正式正文。 ");
  }

  if (!ready) return <div className="p-12 text-center text-sm text-[#64776b]">正在读取统一项目数据与质量检查历史…</div>;

  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#6d8275]">Step 07 · Quality assurance</p><h1 className="mt-1.5 text-2xl font-semibold tracking-tight">报告质量与披露完整性检查</h1><p className="mt-2 text-xs leading-5 text-[#78877e]">读取披露要求、正文、事实来源、指标快照和预览页面；平台流程状态不代表法律合规认证或外部鉴证。</p></div>
        <div className="flex flex-wrap gap-2">
          <button className={button} onClick={() => setHistoryOpen(true)}><History className="size-3.5" />查看检查历史</button>
          <button className={button} onClick={() => setReportOpen(true)}><FileCheck2 className="size-3.5" />生成检查报告</button>
          <button disabled={saving || running !== null} onClick={() => void runCheck("full")} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#176b52] px-4 text-[11px] font-semibold text-white disabled:opacity-50">{running === "full" ? <LoaderCircle className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}开始全面检查</button>
        </div>
      </div>

      <section className="mb-4 rounded-2xl border border-[#dfe7e2] bg-white p-4" aria-label="质量检查概览">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#edf1ef] pb-3">
          <div><h2 className="text-sm font-semibold text-[#263b30]">{project.report.title}</h2><p className="mt-1 text-[10px] text-[#839188]">报告年度 {project.report.year} · 项目修订 v{project.revision} · {latestRun ? `最近检查 v${latestRun.inputProjectRevision} / ${new Date(latestRun.completedAt ?? latestRun.startedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}` : "尚未运行检查"}</p></div>
          <div className="flex flex-wrap items-center gap-2">
            {stale ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700"><AlertTriangle className="size-3" />上游已变化 · 待复检</span> : null}
            <span className="rounded-full bg-[#edf5f1] px-2.5 py-1 text-[10px] font-semibold text-[#176b52]">定稿准备：{project.quality.readiness}</span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-9">
          {[
            ["已检查要求", summary.applicableRequirementCount, "text-[#176b52]"], ["覆盖/待核验", summary.verifiedCoverageCount + summary.pendingVerificationCount, "text-emerald-700"], ["问题总数", summary.unresolvedCount, "text-[#25352c]"], ["阻断", summary.blockerCount, "text-rose-700"], ["高优先级", summary.highCount, "text-amber-700"], ["提示", summary.noticeCount, "text-blue-700"], ["已解决", summary.resolvedCount, "text-emerald-700"], ["待复检", summary.pendingRecheckCount, "text-amber-700"], ["接受例外", summary.acceptedExceptionCount, "text-slate-600"],
          ].map(([label, value, color]) => <div key={String(label)} className="rounded-xl bg-[#f7f9f8] px-3 py-2"><p className="text-[9px] text-[#87938c]">{label}</p><p className={`mt-1 text-lg font-semibold ${color}`}>{value}</p></div>)}
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#dfe7e2] bg-white p-2.5">
        <button disabled={running !== null || saving} onClick={() => void runCheck("chapter")} className={button}><ClipboardCheck className="size-3.5" />检查当前章节</button>
        <button disabled={running !== null || saving} onClick={() => void runCheck("changed")} className={button}><RefreshCcw className="size-3.5" />重新检查已修改项</button>
        <span className="ml-auto text-[10px] text-[#87938c]">确定性规则真实执行 · Mock AI 仅提供演示建议 · 覆盖充分性由用户确认</span>
      </div>

      <div className="quality-grid">
        <aside className="quality-sidebar self-start overflow-hidden rounded-2xl border border-[#dfe7e2] bg-white">
          <div className="border-b border-[#edf1ef] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-[#2d4736]"><Filter className="size-4 text-[#176b52]" />检查分类与筛选</div></div>
          <div className="space-y-1 p-2">{categories.map((item) => { const Icon = item.icon; const count = item.id === "all" ? project.quality.issues.length : project.quality.issues.filter((issue) => issue.category === item.id).length; return <button key={item.id} onClick={() => setCategory(item.id)} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left text-[10px] font-semibold ${category === item.id ? "bg-[#eaf4ef] text-[#176b52]" : "text-[#65756b] hover:bg-[#f5f8f6]"}`}><Icon className="size-3.5" /><span className="min-w-0 flex-1">{item.label}</span><span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[9px]">{count}</span></button>; })}</div>
          <div className="space-y-3 border-t border-[#edf1ef] p-3">
            <FilterField label="严重程度"><select aria-label="按严重程度筛选" value={severity} onChange={(event) => setSeverity(event.target.value as QualitySeverity | "all")}><option value="all">全部严重程度</option><option>阻断</option><option>高</option><option>提示</option></select></FilterField>
            <FilterField label="处理状态"><select aria-label="按处理状态筛选" value={status} onChange={(event) => setStatus(event.target.value as QualityIssueStatus | "all")}><option value="all">全部状态</option>{["待处理", "处理中", "待复检", "已复检解决", "已接受例外"].map((item) => <option key={item}>{item}</option>)}</select></FilterField>
            <FilterField label="所属章节"><select aria-label="按章节筛选" value={chapterId} onChange={(event) => setChapterId(event.target.value)}><option value="all">全部章节</option>{project.writing.chapters.map((chapter) => <option value={chapter.id} key={chapter.id}>{chapter.order} {chapter.title}</option>)}</select></FilterField>
          </div>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-[#dfe7e2] bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-[#edf1ef] p-3">
            <div className="relative min-w-[190px] flex-1"><Search className="absolute left-3 top-2.5 size-3.5 text-[#94a098]" /><input aria-label="搜索质量问题" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索问题、依据或建议" className="h-9 w-full rounded-lg border border-[#dfe6e1] bg-[#fafcfb] pl-9 pr-3 text-[11px] outline-none focus:border-[#6f9f8c]" /></div>
            <select aria-label="问题排序" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="h-9 rounded-lg border border-[#dfe6e1] bg-white px-2.5 text-[10px]"><option value="severity">严重程度优先</option><option value="updated">最近更新优先</option></select>
          </div>
          <div className="scrollbar-subtle max-h-[680px] overflow-y-auto" aria-label="质量问题清单">
            {issues.length ? issues.map((issue) => <button key={issue.issueId} onClick={() => { setSelectedIssueId(issue.issueId); setAiResponse(null); setSourceOpen(false); }} className={`block w-full border-b border-[#edf1ef] p-4 text-left transition ${selected?.issueId === issue.issueId ? "bg-[#f0f7f3]" : "hover:bg-[#fafcfb]"}`}>
              <div className="flex items-start gap-3"><span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border ${severityClass[issue.severity]}`}>{issue.severity === "阻断" ? <AlertOctagon className="size-4" /> : issue.severity === "高" ? <AlertTriangle className="size-4" /> : <CircleAlert className="size-4" />}</span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-1.5"><span className="text-xs font-semibold leading-5 text-[#26362d]">{issue.title}</span><span className={`rounded-full px-2 py-0.5 text-[8px] font-semibold ${statusClass[issue.status]}`}>{issue.status}</span></span><span className="mt-1.5 block text-[10px] leading-4 text-[#7b8981]">{qualityCategoryLabel(issue.category)} · {issue.chapterId ? chapterName(project, issue.chapterId) : `Step ${issue.sourceStep}`} · {issue.findingMethod}</span><span className="mt-2 line-clamp-2 block text-[10px] leading-5 text-[#617068]">{issue.description}</span></span><ChevronRight className="mt-2 size-3.5 shrink-0 text-[#96a099]" /></div>
            </button>) : <div className="grid min-h-72 place-items-center p-8 text-center"><div><CheckCircle2 className="mx-auto size-8 text-[#68a48b]" /><p className="mt-3 text-sm font-semibold text-[#385444]">当前筛选没有问题</p><p className="mt-1 text-[10px] leading-5 text-[#87938c]">这不代表报告已经获得合规认证；请运行检查并完成必要的人工核验。</p></div></div>}
          </div>
        </section>

        <aside className="quality-detail self-start overflow-hidden rounded-2xl border border-[#dfe7e2] bg-white" aria-label="质量问题详情">
          {selected ? <>
            <div className="border-b border-[#edf1ef] p-4"><div className="flex items-start justify-between gap-2"><span className={`rounded-full border px-2 py-1 text-[9px] font-semibold ${severityClass[selected.severity]}`}>{selected.severity}</span><span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${statusClass[selected.status]}`}>{selected.status}</span></div><h2 className="mt-3 text-sm font-semibold leading-6 text-[#25382e]">{selected.title}</h2><p className="mt-1 text-[9px] text-[#8a9690]">{selected.ruleId} v{selected.ruleVersion} · {selected.findingMethod}</p></div>
            <div className="scrollbar-subtle max-h-[590px] space-y-4 overflow-y-auto p-4 text-[10px] leading-5">
              <Detail title="具体问题"><p>{selected.description}</p></Detail>
              <Detail title="触发依据"><div className="space-y-2">{selected.evidence.map((item, index) => <div key={`${item.label}-${index}`} className="rounded-lg bg-[#f6f8f7] p-2"><span className="font-semibold text-[#506159]">{item.label}</span><p className="mt-0.5 text-[#68766e]">{item.value}</p></div>)}</div></Detail>
              <Detail title="关联对象"><div className="flex flex-wrap gap-1.5">{selected.requirementIds.map((id) => <Tag key={id}>要求 {id}</Tag>)}{selected.factIds.map((id) => <Tag key={id}>事实 {id}</Tag>)}{selected.chartIds.map((id) => <Tag key={id}>图表 {id}</Tag>)}{selected.blockId ? <Tag>内容块 {selected.blockId}</Tag> : null}</div></Detail>
              <Detail title="修改建议"><p>{selected.suggestedAction}</p></Detail>
              {selected.sourceReferences.length ? <Detail title="原始资料来源"><button onClick={() => setSourceOpen(!sourceOpen)} className="inline-flex items-center gap-1 font-semibold text-[#176b52]"><ExternalLink className="size-3" />{sourceOpen ? "收起来源" : `查看 ${selected.sourceReferences.length} 个来源`}</button>{sourceOpen ? <div className="mt-2 space-y-2">{selected.sourceReferences.map((source) => <div key={source.id} className="rounded-lg border border-[#e1e8e3] p-2"><p className="font-semibold">{source.fileName}</p><p className="text-[#7b8981]">{source.locator} · {source.excerpt}</p></div>)}</div> : null}</Detail> : null}
              <Detail title="处理记录"><div className="space-y-2">{project.quality.actions.filter((item) => item.issueId === selected.issueId).map((item) => <div key={item.actionId} className="border-l-2 border-[#b9d0c3] pl-2"><p className="font-semibold">{item.action} · {item.method}</p><p className="text-[#7c8982]">{item.note || "无补充说明"}</p><p className="text-[8px] text-[#9aa39e]">{new Date(item.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</p></div>)}{!project.quality.actions.some((item) => item.issueId === selected.issueId) ? <p className="text-[#8b9790]">尚无人工处理记录。</p> : null}</div></Detail>
              <label className="block"><span className="mb-1 block font-semibold text-[#4c5d53]">处理说明 / 例外理由</span><textarea aria-label="问题处理说明" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="接受例外和提交复检时必须填写" className="w-full resize-none rounded-lg border border-[#dce5df] p-2 text-[10px] outline-none focus:border-[#6f9f8c]" /></label>
              {aiResponse ? <div className="rounded-xl border border-violet-200 bg-violet-50 p-3"><p className="flex items-center gap-1 font-semibold text-violet-800"><Bot className="size-3.5" />{aiResponse.label}</p><p className="mt-2 text-violet-800">{aiResponse.suggestion}</p>{aiResponse.warnings.map((warning) => <p key={warning} className="mt-1 text-[9px] text-violet-600">· {warning}</p>)}<button onClick={() => void recordAiSuggestion()} className="mt-2 font-semibold text-violet-800">记录建议（不修改正文）</button></div> : null}
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-[#edf1ef] p-3">
              <button onClick={() => router.push(locationUrl(selected))} className={button}><MapPin className="size-3.5" />定位问题</button>
              <button onClick={() => router.push(locationUrl(selected))} className={button}>返回修改</button>
              <button disabled={aiLoading} onClick={() => void askAi()} className={button}>{aiLoading ? <LoaderCircle className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}AI 建议修正</button>
              <button onClick={() => void recordStatus("处理中", "认可问题")} className={button}>认可问题</button>
              <button onClick={() => void recordStatus("待复检", "标记已处理")} className={button}>标记已处理</button>
              <button disabled={selected.severity === "阻断"} onClick={() => void recordStatus("已接受例外", "接受例外")} className={button}>接受例外</button>
              <button onClick={() => void recheckSelected()} className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#176b52] px-3 text-[11px] font-semibold text-white"><RefreshCcw className="size-3.5" />重新检查</button>
            </div>
          </> : <div className="grid min-h-96 place-items-center p-8 text-center text-xs text-[#8b9790]">请选择一个问题查看详情。</div>}
        </aside>
      </div>

      {historyOpen ? <Modal title="检查历史" onClose={() => setHistoryOpen(false)}><div className="space-y-2">{[...project.quality.runs].reverse().map((run) => <div key={run.runId} className="rounded-xl border border-[#e1e8e3] p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">{run.scope === "full" ? "全面检查" : run.scope === "chapter" ? "章节检查" : "修改项复检"}</span><span className="text-[9px] text-[#176b52]">{run.status}</span></div><p className="mt-1 text-[10px] text-[#78867e]">输入项目 v{run.inputProjectRevision} · {run.issueIds.length} 项命中 · {Object.keys(run.ruleVersions).length} 条规则</p><p className="mt-1 text-[9px] text-[#99a19d]">{new Date(run.completedAt ?? run.startedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</p></div>)}{!project.quality.runs.length ? <p className="py-10 text-center text-xs text-[#89958e]">尚无检查运行记录</p> : null}</div></Modal> : null}
      {reportOpen ? <Modal title="质量检查报告（内部流程摘要）" onClose={() => setReportOpen(false)}><div className="rounded-xl bg-[#f5f8f6] p-4 text-xs leading-6"><p className="font-semibold">{project.report.title}</p><p>最近检查：{summary.lastCheckedAt ? new Date(summary.lastCheckedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) : "未检查"}</p><p>披露覆盖：未覆盖 {summary.uncoveredCount} / 部分覆盖 {summary.partialCoverageCount} / 待核验 {summary.pendingVerificationCount} / 已核验覆盖 {summary.verifiedCoverageCount}</p><p>未解决问题：{summary.unresolvedCount}（阻断 {summary.blockerCount}、高 {summary.highCount}、提示 {summary.noticeCount}）</p><p>定稿准备状态：{project.quality.readiness}</p></div><p className="mt-4 text-[10px] leading-5 text-amber-700">本摘要来自平台内部规则检查，不代表法律合规认证、外部鉴证或 Step 8 最终定稿结论。</p></Modal> : null}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1 block text-[9px] font-semibold text-[#77857d]">{label}</span><span className="block [&_select]:h-9 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-[#dfe6e1] [&_select]:bg-white [&_select]:px-2 [&_select]:text-[10px]">{children}</span></label>; }
function Detail({ title, children }: { title: string; children: React.ReactNode }) { return <section><h3 className="mb-1.5 text-[10px] font-semibold text-[#46584e]">{title}</h3><div className="text-[#68776f]">{children}</div></section>; }
function Tag({ children }: { children: React.ReactNode }) { return <span className="max-w-full truncate rounded-full bg-[#eef3f0] px-2 py-1 text-[8px] text-[#5e7065]">{children}</span>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-[70] grid place-items-center bg-[#13251d]/45 p-4"><section role="dialog" aria-modal="true" aria-label={title} className="max-h-[82vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold">{title}</h2><button onClick={onClose} aria-label={`关闭${title}`}><X className="size-4" /></button></div>{children}</section></div>; }
function chapterName(project: ReturnType<typeof useProjectData>["project"], id: string) { return project.writing.chapters.find((item) => item.id === id)?.title ?? id; }
