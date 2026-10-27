"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  FileSpreadsheet,
  FileText,
  Link2,
  MessageSquareText,
  MoreHorizontal,
  Paperclip,
  RotateCcw,
  Search,
  Sparkles,
  UploadCloud,
  UserRoundPen,
  X,
} from "lucide-react";
import {
  aiNormalizationResults,
  departments,
} from "@/lib/data/mock-data";
import type { CollectionState } from "@/lib/types/esg";
import { useProjectData } from "@/components/project/project-data-provider";
import { Notice } from "@/components/ui/notice";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { StepFooter } from "@/components/workbench/step-footer";
import { StepPageHeader } from "@/components/workbench/step-page-header";

type Tab = "tasks" | "normalize" | "facts";
type IntakeMode = "upload" | "online" | null;

const statusTone: Record<CollectionState, "green" | "blue" | "amber" | "gray"> = {
  待分工: "amber",
  待收集: "gray",
  收集中: "blue",
  待确认: "amber",
  已确认: "green",
};

export function StepFour() {
  const { project, editProject } = useProjectData();
  const dataRequirements = project.dataRequirements;
  const enterpriseFacts = project.facts;
  const energyFact = enterpriseFacts.find((fact) => fact.id === "fact-energy-2025");
  const [activeTab, setActiveTab] = useState<Tab>("tasks");
  const [intakeMode, setIntakeMode] = useState<IntakeMode>(null);
  const [query, setQuery] = useState("");
  const [openFact, setOpenFact] = useState<string | null>("fact-energy-2025");
  const [factDrafts, setFactDrafts] = useState<Record<string, { value: string; unit: string; period: string }>>({});
  const reviewConfirmed = energyFact?.state === "已确认";
  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: "tasks", label: "资料任务", count: dataRequirements.length },
    { id: "normalize", label: "规整与确认", count: aiNormalizationResults.length },
    { id: "facts", label: "企业事实库", count: enterpriseFacts.length },
  ];

  const visibleRequirements = useMemo(
    () => dataRequirements.filter((item) => `${item.itemName}${item.section}${item.responsibleDepartment}`.includes(query.trim())),
    [dataRequirements, query],
  );

  function updateFactDraft(id: string, fact: { value: string; unit?: string; period: string }, patch: Partial<{ value: string; unit: string; period: string }>) {
    setFactDrafts((current) => {
      const base = current[id] ?? { value: fact.value, unit: fact.unit ?? "", period: fact.period };
      return { ...current, [id]: { ...base, ...patch } };
    });
  }

  function applyFactDraft(id: string) {
    const fact = enterpriseFacts.find((item) => item.id === id);
    const draft = factDrafts[id];
    if (!fact || !draft) return;
    const affected = project.writing.chapters.flatMap((chapter) => chapter.blocks.filter((block) => block.citations.some((citation) => citation.factId === id))).length;
    if (affected && !window.confirm(`该指标已被 ${affected} 个正文块引用。更新后正文不会自动改写，但会标记为待更新。是否继续？`)) return;
    editProject((current) => ({ ...current, facts: current.facts.map((item) => item.id === id ? { ...item, ...draft, state: "待人工确认", confirmedBy: undefined } : item) }));
    setFactDrafts((current) => { const next = { ...current }; delete next[id]; return next; });
  }

  function setEnergyConfirmation(confirmed: boolean) {
    if (!energyFact) return;
    editProject((current) => ({ ...current, facts: current.facts.map((fact) => fact.id === energyFact.id ? { ...fact, state: confirmed ? "已确认" : "待人工确认", confirmedBy: confirmed ? "当前用户" : undefined } : fact) }));
  }

  return (
    <>
      <StepPageHeader
        eyebrow="Step 04 · Data collection"
        title="ESG 资料收集、汇总与规整"
        description="基于已确认的资料清单分配责任部门，收集文件或在线补充内容，并在人工确认后沉淀为可追溯的企业事实。"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setIntakeMode("online")}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8e0dc] bg-white px-3.5 text-xs font-semibold text-[#4c5b53] transition hover:border-[#9bb6a9] hover:bg-[#f8faf9]"
            >
              <MessageSquareText className="size-3.5" />在线补充
            </button>
            <button
              onClick={() => setIntakeMode("upload")}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#176b52] px-3.5 text-xs font-semibold text-white transition hover:bg-[#105c46]"
            >
              <UploadCloud className="size-3.5" />上传资料
            </button>
          </div>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "年度资料", value: String(dataRequirements.length), note: "来自 Step 3 已保存资料清单", icon: FileText, color: "text-[#176b52] bg-[#eaf4ef]" },
          { label: "待分工", value: String(dataRequirements.filter((item) => item.state === "待分工").length), note: "需指定责任部门", icon: UserRoundPen, color: "text-amber-700 bg-amber-50" },
          { label: "收集中", value: String(dataRequirements.filter((item) => item.state === "收集中" || item.state === "待收集").length), note: "文件与在线补充", icon: CalendarClock, color: "text-blue-700 bg-blue-50" },
          { label: "已入事实库", value: String(enterpriseFacts.filter((fact) => fact.state === "已确认").length), note: "均保留来源关联", icon: Database, color: "text-violet-700 bg-violet-50" },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center justify-between rounded-2xl border border-[#e1e7e3] bg-white p-4">
            <div>
              <p className="text-[11px] font-medium text-[#7a857f]">{stat.label}</p>
              <p className="mt-1.5 text-[23px] font-semibold tracking-tight text-[#1c2922]">{stat.value}</p>
              <p className="mt-0.5 text-[10px] text-[#919a95]">{stat.note}</p>
            </div>
            <span className={`grid size-10 place-items-center rounded-xl ${stat.color}`}><stat.icon className="size-[18px]" /></span>
          </div>
        ))}
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-[#e0e6e2] bg-white p-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3.5 text-xs font-semibold transition ${activeTab === tab.id ? "bg-[#173e31] text-white shadow-sm" : "text-[#68756e] hover:bg-[#f3f6f4]"}`}
          >
            {tab.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${activeTab === tab.id ? "bg-white/15 text-white/80" : "bg-[#edf1ef] text-[#7d8882]"}`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {activeTab === "tasks" ? (
        <div className="space-y-4 animate-fade-up">
          <Notice tone="info" title="责任部门由用户最终确定">
            系统会依据资料主题给出建议部门，您可以在下表中直接调整。建议不会替代企业内部的分工决定。
          </Notice>

          <SectionCard
            title="本年度 ESG 报告所需资料"
            description="资料清单继承自 Step 3；尚未收集的任务仅标记为“待收集”，不预判数据缺失。"
            action={
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#8e9893]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="搜索资料任务"
                  placeholder="搜索资料或部门"
                  className="h-9 w-full rounded-lg border border-[#dde4e0] bg-[#fafbfa] pl-8 pr-3 text-[11px] outline-none focus:border-[#78a28f] focus:bg-white"
                />
              </div>
            }
            flush
          >
            <div className="scrollbar-subtle overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse text-left">
                <thead className="bg-[#f8faf9] text-[10px] font-semibold uppercase tracking-wide text-[#78837d]">
                  <tr>
                    <th className="w-[270px] px-5 py-3.5">资料项</th>
                    <th className="px-4 py-3.5">关联章节</th>
                    <th className="px-4 py-3.5">责任部门</th>
                    <th className="px-4 py-3.5">收集方式</th>
                    <th className="px-4 py-3.5">截止日期</th>
                    <th className="px-4 py-3.5">状态</th>
                    <th className="px-4 py-3.5 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0ee]">
                  {visibleRequirements.map((item) => {
                    const wasAdjusted = item.responsibleDepartment !== item.suggestedDepartment;
                    return (
                      <tr key={item.id} className="group bg-white transition hover:bg-[#fbfcfb]">
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${item.collectionMethod === "现有Excel" ? "bg-emerald-50 text-emerald-700" : item.collectionMethod === "在线补充" ? "bg-blue-50 text-blue-700" : "bg-slate-50 text-slate-600"}`}>
                              {item.collectionMethod === "现有Excel" ? <FileSpreadsheet className="size-4" /> : item.collectionMethod === "在线补充" ? <MessageSquareText className="size-4" /> : <Paperclip className="size-4" />}
                            </span>
                            <div>
                              <p className="text-xs font-semibold leading-5 text-[#25322b]">{item.itemName}</p>
                              <p className="mt-0.5 text-[10px] text-[#929a96]">{item.type}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-[11px] leading-5 text-[#66736c]">{item.section}</td>
                        <td className="px-4 py-4 align-top">
                          <div className="relative w-[158px]">
                            <Building2 className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-[#87928c]" />
                            <select
                              aria-label={`${item.itemName}责任部门`}
                              value={item.responsibleDepartment}
                              onChange={(event) => editProject((current) => ({ ...current, dataRequirements: current.dataRequirements.map((requirement) => requirement.id === item.id ? { ...requirement, responsibleDepartment: event.target.value, adjustedByUser: event.target.value !== requirement.suggestedDepartment, reviewStatus: "有效" } : requirement) }))}
                              className="h-8 w-full appearance-none rounded-lg border border-[#dfe5e2] bg-white pl-8 pr-7 text-[10px] font-medium text-[#4c5952] outline-none focus:border-[#78a28f]"
                            >
                              {departments.map((department) => <option key={department}>{department}</option>)}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 size-3 text-[#8d9691]" />
                          </div>
                          <p className="mt-1.5 text-[9px] text-[#929c97]">
                            系统建议：{item.suggestedDepartment}
                            {wasAdjusted ? <span className="ml-1 text-[#ad7424]">· 已人工调整</span> : null}
                          </p>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-[#f2f5f3] px-2 py-1 text-[10px] font-medium text-[#59665f]">
                            {item.collectionMethod === "现有Excel" ? <FileSpreadsheet className="size-3" /> : item.collectionMethod === "在线补充" ? <MessageSquareText className="size-3" /> : <UploadCloud className="size-3" />}
                            {item.collectionMethod === "现有Excel" ? "沿用现有 Excel" : item.collectionMethod}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top text-[11px] text-[#66736c]">{item.dueDate.slice(5).replace("-", ".")}</td>
                        <td className="px-4 py-4 align-top"><StatusBadge tone={statusTone[item.state]} dot>{item.state}</StatusBadge></td>
                        <td className="px-4 py-4 text-right align-top">
                          <button className="rounded-lg p-1.5 text-[#7e8983] hover:bg-[#eef2f0]" aria-label={`${item.itemName}更多操作`}><MoreHorizontal className="size-4" /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#edf0ee] bg-[#fafcfb] px-5 py-3 text-[10px] text-[#7b8780]">
              <span>显示 {visibleRequirements.length} / {dataRequirements.length} 项资料</span>
              <span className="inline-flex items-center gap-1.5"><FileSpreadsheet className="size-3.5 text-[#27805f]" />支持直接沿用企业现有 Excel 收集模板</span>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === "normalize" ? (
        <div className="space-y-4 animate-fade-up">
          <Notice tone="ai" title="示例 AI 规整结果">
            以下内容为模拟结果，仅用于展示未来交互。任何提取内容均需用户对照原始资料后人工确认，系统不会自动写入事实库。
          </Notice>

          <SectionCard
            title="资料规整结果预览"
            description="对照原始资料位置核验结构化字段，再决定是否确认入库。"
            action={reviewConfirmed ? <StatusBadge tone="green"><CheckCircle2 className="size-3" />已模拟确认</StatusBadge> : <StatusBadge tone="amber" dot>待人工确认</StatusBadge>}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e6eae8] bg-[#fafbf9] px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><FileSpreadsheet className="size-[18px]" /></span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[#2b3831]">{aiNormalizationResults[0].sourceFile}</p>
                  <p className="mt-1 text-[10px] text-[#8b9590]">原始定位：{aiNormalizationResults[0].sourceLocator} · 上传于 2026-10-24</p>
                </div>
              </div>
              <button className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#176b52] hover:underline"><Link2 className="size-3.5" />查看原始资料</button>
            </div>

            <div className="grid overflow-hidden rounded-xl border border-[#e1e6e3] lg:grid-cols-2">
              <div className="border-b border-[#e1e6e3] bg-[#fbfcfb] lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between border-b border-[#e6eae8] px-4 py-3">
                  <span className="text-[11px] font-semibold text-[#4b5851]">原始资料片段</span>
                  <span className="text-[9px] text-[#939c97]">能源统计 · F10:F13</span>
                </div>
                <div className="p-4">
                  <div className="overflow-hidden rounded-lg border border-[#e0e5e2] bg-white font-mono text-[10px]">
                    <div className="grid grid-cols-[36px_1fr_100px] bg-[#f0f3f1] text-[#7a8580]"><span className="border-r px-2 py-2">行</span><span className="border-r px-3 py-2">指标名称</span><span className="px-3 py-2">数值</span></div>
                    <div className="grid grid-cols-[36px_1fr_100px] text-[#5d6962]"><span className="border-r px-2 py-2">11</span><span className="border-r px-3 py-2">外购电力</span><span className="px-3 py-2">11,920</span></div>
                    <div className="grid grid-cols-[36px_1fr_100px] bg-amber-50/80 text-[#3d4a43] ring-1 ring-inset ring-amber-200"><span className="border-r px-2 py-2">12</span><span className="border-r px-3 py-2 font-semibold">综合用电量</span><span className="px-3 py-2 font-semibold">12,680 MWh</span></div>
                    <div className="grid grid-cols-[36px_1fr_100px] text-[#5d6962]"><span className="border-r px-2 py-2">13</span><span className="border-r px-3 py-2">可再生电力</span><span className="px-3 py-2">1,860</span></div>
                  </div>
                  <p className="mt-3 text-[10px] leading-5 text-[#87918c]">高亮内容来自上传文件中的指定工作表与单元格，便于逐项复核。</p>
                </div>
              </div>

              <div className="bg-white">
                <div className="flex items-center justify-between border-b border-[#e6eae8] px-4 py-3">
                  <span className="inline-flex items-center gap-2 text-[11px] font-semibold text-[#4b5851]"><Sparkles className="size-3.5 text-violet-600" />结构化预览</span>
                  <StatusBadge tone="teal">示例 AI 结果</StatusBadge>
                </div>
                <div className="grid gap-4 p-4 sm:grid-cols-2">
                  {[
                    ["指标名称", aiNormalizationResults[0].extractedField],
                    ["数值与单位", aiNormalizationResults[0].extractedValue],
                    ["报告期间", aiNormalizationResults[0].period],
                    ["关联章节", "4.2 资源与能源管理"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-[9px] font-medium text-[#8b9590]">{label}</p>
                      <p className="mt-1.5 text-xs font-semibold text-[#2e3b34]">{value}</p>
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <label htmlFor="review-note" className="text-[9px] font-medium text-[#8b9590]">人工核验备注</label>
                    <textarea id="review-note" rows={2} placeholder="可补充口径说明或调整原因" className="mt-1.5 w-full resize-none rounded-lg border border-[#dde4e0] px-3 py-2 text-[11px] outline-none placeholder:text-[#a5ada9] focus:border-[#78a28f]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <button onClick={() => setEnergyConfirmation(false)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#dce3df] px-3.5 text-[11px] font-semibold text-[#59665f] hover:bg-[#f7f9f8]"><RotateCcw className="size-3.5" />退回调整</button>
              <button onClick={() => setEnergyConfirmation(true)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#176b52] px-3.5 text-[11px] font-semibold text-white hover:bg-[#105c46]"><Check className="size-3.5" />人工确认并模拟入库</button>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === "facts" ? (
        <div className="space-y-4 animate-fade-up">
          <Notice tone="info" title="事实与原始资料保持关联">
            每条事实均保留来源文件、工作表/单元格或页码定位。报告撰写阶段引用事实时，可回溯至原始证据。
          </Notice>
          <SectionCard
            title="企业事实库"
            description="当前展示本项目的典型事实记录与来源链路。"
            action={<button className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dce3df] px-3 text-[10px] font-semibold text-[#59665f] hover:bg-[#f5f7f6]"><Database className="size-3.5" />筛选事实</button>}
            flush
          >
            <div className="divide-y divide-[#edf0ee]">
              {enterpriseFacts.map((fact) => {
                const expanded = openFact === fact.id;
                return (
                  <div key={fact.id} className="bg-white">
                    <button onClick={() => setOpenFact(expanded ? null : fact.id)} className="grid w-full gap-3 px-5 py-4 text-left transition hover:bg-[#fbfcfb] sm:grid-cols-[1fr_150px_130px_150px_24px] sm:items-center">
                      <div className="flex items-start gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#edf5f1] text-[#176b52]"><Database className="size-4" /></span>
                        <div>
                          <p className="text-xs font-semibold text-[#2a372f]">{fact.name}</p>
                          <p className="mt-1 text-[10px] text-[#88928d]">{fact.topic} · {fact.period}</p>
                        </div>
                      </div>
                      <div><span className="text-base font-semibold text-[#1f2e26]">{fact.value}</span>{fact.unit ? <span className="ml-1 text-[10px] text-[#7b8680]">{fact.unit}</span> : null}</div>
                      <div><StatusBadge tone={fact.state === "已确认" ? "green" : "amber"} dot>{fact.state}</StatusBadge></div>
                      <div className="inline-flex items-center gap-1.5 text-[10px] text-[#607068]"><Link2 className="size-3.5 text-[#176b52]" />{fact.sourceReferences.length} 个原始来源</div>
                      {expanded ? <ChevronUp className="size-4 text-[#85908a]" /> : <ChevronDown className="size-4 text-[#85908a]" />}
                    </button>
                    {expanded ? (
                      <div className="border-t border-[#edf0ee] bg-[#f8faf9] px-5 py-4 sm:pl-[68px]">
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[#76817b]">来源链路</p>
                        <div className="grid gap-2 lg:grid-cols-2">
                          {fact.sourceReferences.map((source) => (
                            <div key={source.id} className="flex items-start gap-3 rounded-xl border border-[#dfe5e2] bg-white p-3.5">
                              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                                {source.fileName.endsWith(".xlsx") ? <FileSpreadsheet className="size-4" /> : <FileText className="size-4" />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="truncate text-[11px] font-semibold text-[#344139]">{source.fileName}</p>
                                  <button className="shrink-0 text-[9px] font-semibold text-[#176b52] hover:underline">查看</button>
                                </div>
                                <p className="mt-1 text-[10px] font-medium text-[#758079]">定位：{source.locator}</p>
                                <p className="mt-1.5 line-clamp-2 text-[10px] leading-4 text-[#8b9490]">“{source.excerpt}”</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 rounded-xl border border-[#dfe5e2] bg-white p-3.5">
                          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-semibold text-[#4c5d53]">更新事实值</p><p className="mt-1 text-[9px] text-[#8a958f]">保存项目后自动增加事实修订号；已引用正文仅标记待更新，不自动改写。</p></div><StatusBadge tone="gray">当前 v{fact.revision}</StatusBadge></div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_110px_150px_auto]">
                            <input aria-label={`${fact.name}数值`} value={factDrafts[fact.id]?.value ?? fact.value} onChange={(event) => updateFactDraft(fact.id, fact, { value: event.target.value })} className="h-9 rounded-lg border border-[#dce3df] px-3 text-xs outline-none focus:border-[#78a28f]" />
                            <input aria-label={`${fact.name}单位`} value={factDrafts[fact.id]?.unit ?? fact.unit ?? ""} onChange={(event) => updateFactDraft(fact.id, fact, { unit: event.target.value })} className="h-9 rounded-lg border border-[#dce3df] px-3 text-xs outline-none focus:border-[#78a28f]" />
                            <input aria-label={`${fact.name}报告期`} value={factDrafts[fact.id]?.period ?? fact.period} onChange={(event) => updateFactDraft(fact.id, fact, { period: event.target.value })} className="h-9 rounded-lg border border-[#dce3df] px-3 text-xs outline-none focus:border-[#78a28f]" />
                            <button disabled={!factDrafts[fact.id]} onClick={() => applyFactDraft(fact.id)} className="h-9 rounded-lg bg-[#176b52] px-3 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">应用更新</button>
                          </div>
                        </div>
                        {fact.confirmedBy ? <p className="mt-3 inline-flex items-center gap-1.5 text-[9px] text-[#87918c]"><CheckCircle2 className="size-3 text-[#27805f]" />由 {fact.confirmedBy} 人工确认</p> : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      ) : null}

      <StepFooter currentStep={4} />

      {intakeMode ? (
        <div className="fixed inset-0 z-[60] flex justify-end bg-[#10241c]/40 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="intake-title" onMouseDown={(event) => event.target === event.currentTarget && setIntakeMode(null)}>
          <div className="h-full w-full max-w-[480px] overflow-y-auto bg-white shadow-2xl animate-fade-up">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#e5e9e7] bg-white px-6 py-5">
              <div>
                <span className="mb-3 grid size-10 place-items-center rounded-xl bg-[#eaf4ef] text-[#176b52]">{intakeMode === "upload" ? <UploadCloud className="size-5" /> : <MessageSquareText className="size-5" />}</span>
                <h2 id="intake-title" className="text-base font-semibold text-[#1d2a23]">{intakeMode === "upload" ? "上传资料文件" : "在线补充资料"}</h2>
                <p className="mt-1 text-[11px] text-[#7f8a84]">模拟收集操作，不会上传或保存真实文件。</p>
              </div>
              <button onClick={() => setIntakeMode(null)} className="grid size-8 place-items-center rounded-lg text-[#7c8781] hover:bg-[#f1f4f2]" aria-label="关闭"><X className="size-4" /></button>
            </div>
            <div className="space-y-5 p-6">
              <div>
                <label htmlFor="requirement-select" className="mb-2 block text-[11px] font-semibold text-[#3a4740]">关联资料项</label>
                <select id="requirement-select" className="h-10 w-full rounded-lg border border-[#dce3df] bg-white px-3 text-xs outline-none focus:border-[#78a28f]">
                  {dataRequirements.map((item) => <option key={item.id}>{item.itemName}</option>)}
                </select>
              </div>
              {intakeMode === "upload" ? (
                <>
                  <div className="rounded-xl border border-dashed border-[#9db8ab] bg-[#f5faf7] px-6 py-10 text-center">
                    <span className="mx-auto grid size-11 place-items-center rounded-xl bg-white text-[#176b52] shadow-sm"><UploadCloud className="size-5" /></span>
                    <p className="mt-4 text-xs font-semibold text-[#34423a]">拖拽文件至此，或点击选择</p>
                    <p className="mt-1.5 text-[10px] leading-4 text-[#849089]">支持 XLSX、XLS、PDF、DOCX；可直接沿用企业现有 Excel 模板</p>
                    <button className="mt-4 h-8 rounded-lg border border-[#d4ded9] bg-white px-3 text-[10px] font-semibold text-[#526159]">选择文件</button>
                  </div>
                  <Notice tone="info">平台保留文件名、工作表/单元格或页码信息，用于建立事实与原始资料的来源关联。</Notice>
                </>
              ) : (
                <>
                  <div>
                    <label htmlFor="supplement-title" className="mb-2 block text-[11px] font-semibold text-[#3a4740]">补充标题</label>
                    <input id="supplement-title" defaultValue="节能改造项目说明" className="h-10 w-full rounded-lg border border-[#dce3df] px-3 text-xs outline-none focus:border-[#78a28f]" />
                  </div>
                  <div>
                    <label htmlFor="supplement-content" className="mb-2 block text-[11px] font-semibold text-[#3a4740]">资料内容</label>
                    <textarea id="supplement-content" rows={8} placeholder="请按企业实际情况补充项目背景、实施范围、年度进展与成效……" className="w-full resize-none rounded-lg border border-[#dce3df] p-3 text-xs leading-6 outline-none placeholder:text-[#a0aaa4] focus:border-[#78a28f]" />
                  </div>
                  <div className="rounded-xl border border-[#e1e6e3] bg-[#f8faf9] p-4">
                    <p className="text-[10px] font-semibold text-[#4a5750]">来源记录</p>
                    <p className="mt-1.5 text-[10px] leading-5 text-[#849089]">提交后将记录填写人、填写时间与对应表单字段，作为事实来源链路的一部分。</p>
                  </div>
                </>
              )}
            </div>
            <div className="sticky bottom-0 mt-auto flex justify-end gap-2 border-t border-[#e5e9e7] bg-[#fafbf9] px-6 py-4">
              <button onClick={() => setIntakeMode(null)} className="h-9 rounded-lg border border-[#dce3df] bg-white px-4 text-[11px] font-semibold text-[#5b6861]">取消</button>
              <button onClick={() => setIntakeMode(null)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#176b52] px-4 text-[11px] font-semibold text-white">模拟提交<ArrowRight className="size-3.5" /></button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
