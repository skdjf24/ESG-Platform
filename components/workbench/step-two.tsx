"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ListFilter,
  MessageSquareText,
  PencilLine,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import { esgTopics } from "@/lib/data/mock-data";
import type { EsgCategory } from "@/lib/types/esg";
import { Notice } from "@/components/ui/notice";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { StepFooter } from "@/components/workbench/step-footer";
import { StepPageHeader } from "@/components/workbench/step-page-header";

type Filter = "全部" | EsgCategory;
type Method = "综合评估" | "管理层评估" | "利益相关方问卷";

const categoryStyles: Record<EsgCategory, { badge: string; dot: string; label: string }> = {
  E: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", label: "环境" },
  S: { badge: "bg-sky-50 text-sky-700 border-sky-200", dot: "bg-sky-500", label: "社会" },
  G: { badge: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500", label: "治理" },
};

const methodOptions: Array<{
  name: Method;
  icon: typeof Users;
  description: string;
  note: string;
}> = [
  { name: "综合评估", icon: SlidersHorizontal, description: "管理层研判与利益相关方反馈结合", note: "当前选择 · 建议" },
  { name: "管理层评估", icon: Users, description: "由企业管理层集中讨论并评分", note: "适合内部快速评估" },
  { name: "利益相关方问卷", icon: MessageSquareText, description: "汇总内外部利益相关方问卷结果", note: "适合广泛征询意见" },
];

export function StepTwo() {
  const [filter, setFilter] = useState<Filter>("全部");
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState<Method>("综合评估");
  const [includedIds, setIncludedIds] = useState(() => new Set(esgTopics.map((topic) => topic.id)));
  const [confirmed, setConfirmed] = useState(true);

  const filteredTopics = useMemo(
    () => esgTopics.filter((topic) => (filter === "全部" || topic.category === filter) && topic.name.includes(query.trim())),
    [filter, query],
  );
  const assessedTopics = esgTopics.filter((topic) => includedIds.has(topic.id));
  const priorityTopics = assessedTopics.filter((topic) => topic.financialScore >= 4 || topic.impactScore >= 4.3);

  function toggleTopic(id: string) {
    setIncludedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirmed(false);
  }

  return (
    <>
      <StepPageHeader
        eyebrow="Step 2 · Materiality"
        title="ESG 实质性议题评估"
        description="调整议题范围，选择评估方式，并从财务重要性与影响重要性两个维度形成评估结果。所有重要性结论均由用户最终确认。"
        completed
        action={
          <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#dbe2de] bg-white px-4 text-xs font-semibold text-[#536159] hover:bg-[#f6f8f7]">
            <ClipboardCheck className="size-4" />查看评估记录
          </button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[#e0e6e2] bg-[#e7ece9] sm:grid-cols-5">
        {[
          ["01", "议题调整", "已完成"],
          ["02", "评估方式", "已选择"],
          ["03", "双重重要性", "9 项已评分"],
          ["04", "重要性矩阵", "已生成"],
          ["05", "结果确认", confirmed ? "已确认" : "待确认"],
        ].map(([number, label, state], index) => (
          <div key={number} className={`bg-white px-4 py-3.5 ${index === 4 && !confirmed ? "sm:bg-amber-50/40" : ""}`}>
            <div className="flex items-center gap-2">
              <span className={`grid size-5 place-items-center rounded-full text-[9px] font-bold ${index < 4 || confirmed ? "bg-[#e8f3ee] text-[#176b52]" : "bg-amber-100 text-amber-700"}`}>
                {index < 4 || confirmed ? <Check className="size-3" /> : number}
              </span>
              <span className="text-[11px] font-semibold text-[#35433b]">{label}</span>
            </div>
            <div className="mt-1.5 pl-7 text-[9px] text-[#8a948e]">{state}</div>
          </div>
        ))}
      </div>

      <Notice tone="info" title="判断边界">
        系统仅协助整理评分与生成矩阵，不替代企业作出重要性结论。请由项目负责人结合评估依据完成确认。
      </Notice>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.42fr)_minmax(310px,.58fr)]">
        <SectionCard
          title="议题池与议题调整"
          description={`当前纳入 ${includedIds.size} 项议题，可根据本年度经营与利益相关方关注进行调整`}
          action={<button className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#edf5f1] px-3 text-[11px] font-semibold text-[#176b52] hover:bg-[#e3f0ea]"><Plus className="size-3.5" />新增议题</button>}
          flush
        >
          <div className="flex flex-col gap-3 border-b border-[#edf0ee] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex gap-1.5">
              {(["全部", "E", "S", "G"] as Filter[]).map((item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={`h-8 rounded-lg px-3 text-[11px] font-semibold transition ${filter === item ? "bg-[#183d30] text-white" : "bg-[#f3f6f4] text-[#647169] hover:bg-[#e9eeeb]"}`}
                >
                  {item === "全部" ? `全部 ${esgTopics.length}` : `${item} ${esgTopics.filter((topic) => topic.category === item).length}`}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#97a09b]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="搜索议题" placeholder="搜索议题" className="h-8 w-full rounded-lg border border-[#dfe5e1] bg-white pl-8 pr-3 text-[11px] outline-none placeholder:text-[#a3aba7] focus:border-[#75a490] sm:w-44" />
            </div>
          </div>
          <div className="divide-y divide-[#edf0ee]">
            {filteredTopics.map((topic) => {
              const active = includedIds.has(topic.id);
              const style = categoryStyles[topic.category];
              return (
                <div key={topic.id} className={`flex items-center gap-3 px-5 py-3.5 transition sm:px-6 ${active ? "bg-white" : "bg-[#fafbfa] opacity-60"}`}>
                  <button
                    onClick={() => toggleTopic(topic.id)}
                    aria-label={`${active ? "移出" : "纳入"}${topic.name}`}
                    className={`grid size-[18px] shrink-0 place-items-center rounded border ${active ? "border-[#176b52] bg-[#176b52] text-white" : "border-[#bdc7c1] bg-white text-transparent"}`}
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </button>
                  <span className={`inline-flex size-7 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold ${style.badge}`}>{topic.category}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-[#26342c]">{topic.name}</span>
                      <span className="text-[9px] text-[#929b96]">来源：{topic.origin}</span>
                    </div>
                    <div className="mt-1 text-[10px] text-[#85908a]">{style.label}类议题 · {active ? "已纳入本次评估" : "暂不纳入"}</div>
                  </div>
                  <button className="grid size-8 shrink-0 place-items-center rounded-lg text-[#8d9792] hover:bg-[#f2f5f3] hover:text-[#45534b]" aria-label={`编辑${topic.name}`}><PencilLine className="size-3.5" /></button>
                </div>
              );
            })}
            {filteredTopics.length === 0 ? <div className="px-6 py-10 text-center text-xs text-[#87918c]">未找到匹配议题</div> : null}
          </div>
        </SectionCard>

        <SectionCard title="评估方式" description="选择本次评估的组织方式">
          <div className="space-y-2.5">
            {methodOptions.map((option) => {
              const active = method === option.name;
              return (
                <button
                  key={option.name}
                  onClick={() => setMethod(option.name)}
                  className={`w-full rounded-xl border p-3.5 text-left transition ${active ? "border-[#73a48f] bg-[#f0f7f4] shadow-[0_0_0_2px_rgba(23,107,82,.05)]" : "border-[#e2e7e4] bg-white hover:border-[#b9c9c1]"}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${active ? "bg-[#176b52] text-white" : "bg-[#f1f4f2] text-[#67746d]"}`}><option.icon className="size-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#28362e]">{option.name}</span>
                        <span className={`grid size-4 place-items-center rounded-full border ${active ? "border-[#176b52] bg-[#176b52] text-white" : "border-[#cbd3cf] text-transparent"}`}><Check className="size-2.5" strokeWidth={3} /></span>
                      </span>
                      <span className="mt-1 block text-[10px] leading-4 text-[#78837d]">{option.description}</span>
                      <span className={`mt-2 block text-[9px] font-medium ${active ? "text-[#176b52]" : "text-[#9aa29e]"}`}>{option.note}</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-4 rounded-xl border border-[#e5e9e7] bg-[#fafbfa] p-3.5">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-[#3d4a43]"><Users className="size-3.5 text-[#176b52]" />参与范围</div>
            <div className="mt-2 flex -space-x-1.5">
              {["董", "环", "人", "法", "+12"].map((label, index) => <span key={label} className={`grid size-7 place-items-center rounded-full border-2 border-white text-[9px] font-semibold ${index === 4 ? "bg-[#e8ecea] text-[#67736d]" : "bg-[#264b3c] text-white"}`}>{label}</span>)}
            </div>
            <p className="mt-2 text-[10px] leading-4 text-[#858f8a]">董事会办公室等 5 个内部部门及 12 位外部利益相关方</p>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        className="mt-5"
        title="双重重要性评估"
        description="1–5 分制；分值及评估依据可继续调整"
        action={<div className="flex items-center gap-2"><StatusBadge tone="blue">{assessedTopics.length} 项已评分</StatusBadge><button className="hidden h-8 items-center gap-1.5 rounded-lg border border-[#dce3df] px-3 text-[11px] font-semibold text-[#5f6c65] hover:bg-[#f6f8f7] sm:inline-flex"><ListFilter className="size-3.5" />筛选</button></div>}
        flush
      >
        <div className="scrollbar-subtle overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse text-left">
            <thead className="bg-[#f7f9f8] text-[10px] font-semibold uppercase tracking-wide text-[#7d8782]">
              <tr>
                <th className="px-6 py-3">议题</th>
                <th className="px-4 py-3">财务重要性</th>
                <th className="px-4 py-3">影响重要性</th>
                <th className="px-4 py-3">评估依据</th>
                <th className="px-5 py-3">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0ee]">
              {assessedTopics.map((topic) => {
                const style = categoryStyles[topic.category];
                return (
                  <tr key={topic.id} className="text-[11px] text-[#4f5e56] hover:bg-[#fafcfb]">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2.5"><span className={`size-2 rounded-full ${style.dot}`} /><span className="font-semibold text-[#2a372f]">{topic.name}</span></div>
                    </td>
                    <td className="px-4 py-3.5"><ScoreMeter value={topic.financialScore} /></td>
                    <td className="px-4 py-3.5"><ScoreMeter value={topic.impactScore} /></td>
                    <td className="px-4 py-3.5"><button className="inline-flex items-center gap-1 text-[#287258] hover:underline">查看依据<ArrowUpRight className="size-3" /></button></td>
                    <td className="px-5 py-3.5">{topic.confirmed ? <StatusBadge tone="green">已评分</StatusBadge> : <StatusBadge tone="amber">待复核</StatusBadge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.28fr)_minmax(340px,.72fr)]">
        <SectionCard title="重要性矩阵" description="横轴为影响重要性，纵轴为财务重要性；位置基于当前评分自动映射" action={<StatusBadge tone="gray">评分区间 1–5</StatusBadge>}>
          <div className="relative pb-6 pl-7">
            <span className="absolute left-0 top-1/2 -translate-x-[44%] -translate-y-1/2 -rotate-90 whitespace-nowrap text-[9px] font-semibold text-[#7d8982]">财务重要性</span>
            <div className="matrix-grid relative h-[330px] overflow-hidden rounded-xl border border-[#dfe5e1] bg-gradient-to-tr from-white via-[#f7faf8] to-[#eaf4ef]">
              <div className="absolute inset-x-0 top-[25%] border-t border-dashed border-[#b7c8c0]" />
              <div className="absolute bottom-0 left-[75%] top-0 border-l border-dashed border-[#b7c8c0]" />
              <span className="absolute right-3 top-3 rounded-md bg-white/80 px-2 py-1 text-[9px] font-semibold text-[#176b52] shadow-sm">重点关注区</span>
              {assessedTopics.map((topic) => {
                const style = categoryStyles[topic.category];
                const left = 6 + ((topic.impactScore - 1) / 4) * 84;
                const bottom = 6 + ((topic.financialScore - 1) / 4) * 84;
                return (
                  <div key={topic.id} className="group absolute -translate-x-1/2 translate-y-1/2" style={{ left: `${left}%`, bottom: `${bottom}%` }}>
                    <span className={`block size-3.5 rounded-full border-2 border-white shadow-sm ring-1 ring-black/10 ${style.dot}`} />
                    <span className="pointer-events-none absolute left-1/2 top-4 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[#17241e] px-2 py-1 text-[9px] text-white shadow-lg group-hover:block">{topic.name} · {topic.financialScore}/{topic.impactScore}</span>
                  </div>
                );
              })}
              <span className="absolute bottom-1.5 left-2 text-[9px] text-[#9aa39e]">低</span><span className="absolute right-2 top-1.5 text-[9px] text-[#708079]">高</span>
            </div>
            <div className="mt-2 text-center text-[9px] font-semibold text-[#7d8982]">影响重要性</div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 border-t border-[#edf0ee] pt-4">
            {(Object.keys(categoryStyles) as EsgCategory[]).map((category) => <span key={category} className="flex items-center gap-1.5 text-[10px] text-[#6f7b74]"><span className={`size-2 rounded-full ${categoryStyles[category].dot}`} />{categoryStyles[category].label}</span>)}
          </div>
        </SectionCard>

        <SectionCard title="结果确认" description="确认后将作为披露框架与报告大纲的输入">
          <div className="flex items-end justify-between rounded-xl bg-[#f2f7f4] p-4">
            <div><div className="text-[10px] text-[#728078]">重点议题</div><div className="mt-1 text-2xl font-semibold text-[#173e30]">{priorityTopics.length}<span className="ml-1 text-[10px] font-medium text-[#7b8b83]">项</span></div></div>
            <BarChart3 className="size-8 text-[#70a38e]" />
          </div>
          <div className="mt-4 space-y-2">
            {priorityTopics.slice(0, 6).map((topic, index) => (
              <div key={topic.id} className="flex items-center justify-between rounded-lg border border-[#e6eae8] px-3 py-2.5">
                <div className="flex items-center gap-2.5"><span className="text-[10px] font-semibold tabular-nums text-[#9aa29e]">{String(index + 1).padStart(2, "0")}</span><span className="text-[11px] font-semibold text-[#36443c]">{topic.name}</span></div>
                <span className="text-[10px] font-semibold tabular-nums text-[#176b52]">{((topic.financialScore + topic.impactScore) / 2).toFixed(1)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-[10px] leading-5 text-amber-800">
            <div className="flex items-center gap-2 font-semibold"><Sparkles className="size-3.5" />结果说明</div>
            <p className="mt-1">排序基于已录入评分，仅供整理参考，不代表系统自动作出重要性判断。</p>
          </div>
          <label className="mt-4 flex items-start gap-2.5 rounded-lg border border-[#e2e7e4] p-3 text-[10px] leading-5 text-[#59675f]">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 size-3.5 accent-[#176b52]" />
            <span>我已复核评估依据与评分，并确认上述重要性评估结果。</span>
          </label>
          <button
            onClick={() => setConfirmed(true)}
            className={`mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-xs font-semibold transition ${confirmed ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "bg-[#176b52] text-white hover:bg-[#105c46]"}`}
          >
            {confirmed ? <><CheckCircle2 className="size-4" />已由用户确认</> : <><ClipboardCheck className="size-4" />确认评估结果</>}
          </button>
        </SectionCard>
      </div>

      <StepFooter currentStep={2} />
    </>
  );
}

function ScoreMeter({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex gap-0.5" aria-label={`${value} 分`}>
        {[1, 2, 3, 4, 5].map((score) => <span key={score} className={`h-1.5 w-4 rounded-full ${score <= Math.round(value) ? "bg-[#4b9b7b]" : "bg-[#e3e8e5]"}`} />)}
      </div>
      <span className="w-6 text-[10px] font-semibold tabular-nums text-[#33423a]">{value.toFixed(1)}</span>
    </div>
  );
}
