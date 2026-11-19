"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCircle2,
  ClipboardCheck,
  MessageSquareText,
  PencilLine,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { EsgCategory } from "@/lib/types/esg";
import { isPriorityTopic } from "@/lib/project/outline";
import { useProjectData } from "@/components/project/project-data-provider";
import { Notice } from "@/components/ui/notice";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { StepFooter } from "@/components/workbench/step-footer";
import { StepPageHeader } from "@/components/workbench/step-page-header";
import { availableTopicPresets, describeTopicRemoval, unscoredPresetTopic } from "@/lib/project/topics";

type Filter = "全部" | EsgCategory;
type Method = "综合评估" | "管理层评估" | "利益相关方问卷";
type TopicEditor = { id?: string; name: string; category: EsgCategory; financialScore: string; impactScore: string };

function parseScore(value: string): number | null {
  if (!/^(?:[1-4](?:\.\d)?|5(?:\.0)?)$/.test(value)) return null;
  return Number(value);
}

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
  const { project, savedProject, ready, saving, editProject, saveProject, message, setMessage } = useProjectData();
  const topics = project.topics;
  const [filter, setFilter] = useState<Filter>("全部");
  const [query, setQuery] = useState("");
  const [topicEditor, setTopicEditor] = useState<TopicEditor | null>(null);
  const [topicError, setTopicError] = useState("");
  const [presetId, setPresetId] = useState("");
  const [removeTopicId, setRemoveTopicId] = useState<string>();
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const method = project.materiality.method;
  const includedIds = new Set(project.materiality.includedTopicIds);
  const confirmed = project.materiality.confirmed;
  const needsReview = project.materiality.reviewStatus === "待复核";
  const removal = removeTopicId ? describeTopicRemoval(project, removeTopicId, savedProject) : undefined;
  const presets = topicEditor && !topicEditor.id ? availableTopicPresets(topics) : [];

  const filteredTopics = useMemo(
    () => topics.filter((topic) => (filter === "全部" || topic.category === filter) && topic.name.includes(query.trim())),
    [filter, query, topics],
  );
  const assessedTopics = topics.filter((topic) => includedIds.has(topic.id));
  const scoredTopics = assessedTopics.filter((topic) => topic.financialScore >= 1 && topic.impactScore >= 1);
  const priorityTopics = scoredTopics.filter(isPriorityTopic)
    .sort((left, right) => (right.financialScore + right.impactScore) - (left.financialScore + left.impactScore));
  const canConfirm = assessedTopics.length > 0 && scoredTopics.length === assessedTopics.length;

  function toggleTopic(id: string) {
    const removing = includedIds.has(id);
    editProject((current) => ({
      ...current,
      materiality: {
        ...current.materiality,
        includedTopicIds: removing ? current.materiality.includedTopicIds.filter((item) => item !== id) : [...current.materiality.includedTopicIds, id],
        confirmed: false,
        confirmedAt: undefined,
      },
    }));
  }

  function openTopicEditor(id?: string) {
    const topic = id ? topics.find((item) => item.id === id) : undefined;
    setTopicError("");
    setPresetId("");
    setTopicEditor(topic ? { id: topic.id, name: topic.name, category: topic.category, financialScore: topic.financialScore ? String(topic.financialScore) : "", impactScore: topic.impactScore ? String(topic.impactScore) : "" } : { name: "", category: "E", financialScore: "", impactScore: "" });
  }

  function saveTopicEditor() {
    if (!topicEditor) return;
    const name = topicEditor.name.trim();
    if (!name) {
      setTopicError("请填写议题名称。");
      return;
    }
    if (topics.some((item) => item.id !== topicEditor.id && item.name.trim().toLowerCase() === name.toLowerCase())) {
      setTopicError("议题名称已存在，请避免重复。");
      return;
    }
    const financialScore = parseScore(topicEditor.financialScore);
    const impactScore = parseScore(topicEditor.impactScore);
    const unscored = topicEditor.financialScore === "" && topicEditor.impactScore === "";
    if (!unscored && (financialScore === null || impactScore === null)) {
      setTopicError("请同时填写两个评分（1–5 分，最多一位小数），或暂时留空待评分。");
      return;
    }
    const scores = { financialScore: financialScore ?? 0, impactScore: impactScore ?? 0 };
    editProject((current) => {
      const existing = topicEditor.id ? current.topics.find((item) => item.id === topicEditor.id) : undefined;
      const id = existing?.id ?? `topic-user-${crypto.randomUUID()}`;
      const nextTopics = existing
        ? current.topics.map((item) => item.id === id ? { ...item, name, category: topicEditor.category, ...scores, confirmed: false } : item)
        : [...current.topics, { id, name, category: topicEditor.category, origin: "用户新增" as const, ...scores, confirmed: false }];
      const renameLinks = existing && existing.name !== name
        && !current.topics.some((item) => item.id !== id && item.name === existing.name);
      return {
        ...current,
        topics: nextTopics,
        reportSections: renameLinks ? current.reportSections.map((item) => item.topics.includes(existing.name) ? {
          ...item, topics: item.topics.map((topic) => topic === existing.name ? name : topic), topicReviewStatus: "待复核" as const, revision: item.revision + 1,
        } : item) : current.reportSections,
        materiality: {
          ...current.materiality,
          includedTopicIds: existing ? current.materiality.includedTopicIds : [...current.materiality.includedTopicIds, id],
          confirmed: false,
          confirmedAt: undefined,
        },
      };
    });
    setTopicEditor(null);
  }

  async function addPresetTopic() {
    const preset = presets.find((item) => item.id === presetId);
    if (!preset || saving) return;
    setTopicError("");
    const added = await saveProject(2, "添加预设议题", { ...project, topics: [...topics, unscoredPresetTopic(preset)] });
    if (!added) {
      setTopicError("添加未保存，请查看项目提示后重试。");
      return;
    }
    setTopicEditor(null);
    setFilter("全部");
    setQuery("");
    setMessage(`已将“${preset.name}”添加到议题池。勾选后可参与评估。`);
  }

  async function deleteTopic() {
    if (!removal || saving) return;
    setDeleteFailed(false);
    const { topic, assessmentNeedsReview } = removal;
    const deleted = await saveProject(2, "删除议题", undefined, { removeTopicId: topic.id });
    if (!deleted) {
      setDeleteFailed(true);
      return;
    }
    setRemoveTopicId(undefined);
    setTopicEditor(null);
    setMessage(`已删除议题“${topic.name}”。${assessmentNeedsReview ? "请复核受影响的评估及关联。" : ""}`);
  }

  function confirmAssessment(confirmed: boolean) {
    editProject((current) => ({
      ...current,
      materiality: {
        ...current.materiality,
        confirmed,
        confirmedAt: confirmed ? new Date().toISOString() : undefined,
        ...(confirmed ? { reviewStatus: undefined } : {}),
      },
    }));
  }

  function updateScore(id: string, field: "financialScore" | "impactScore", rawValue: string) {
    const value = parseScore(rawValue);
    if (value === null || topics.find((item) => item.id === id)?.[field] === value) return;
    editProject((current) => ({
      ...current,
      topics: current.topics.map((item) => item.id === id ? { ...item, [field]: value, confirmed: false } : item),
      materiality: { ...current.materiality, confirmed: false, confirmedAt: undefined },
    }));
  }

  return (
    <>
      <StepPageHeader
        eyebrow="Step 2 · Materiality"
        title="ESG 实质性议题评估"
        description="调整议题范围，选择评估方式，并从财务重要性与影响重要性两个维度形成评估结果。所有重要性结论均由用户最终确认。"
        completed={confirmed}
        action={
          <button type="button" aria-expanded={historyOpen} aria-controls="materiality-history" onClick={() => setHistoryOpen((value) => !value)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#dbe2de] bg-white px-4 text-xs font-semibold text-[#536159] hover:bg-[#f6f8f7]">
            <ClipboardCheck className="size-4" />查看评估记录
          </button>
        }
      />

      {historyOpen ? <div id="materiality-history" className="mb-5"><TopicRemovalHistory /></div> : null}

      <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[#e0e6e2] bg-[#e7ece9] sm:grid-cols-5">
        {[
          ["01", "议题调整", assessedTopics.length ? "已选择" : "待选择"],
          ["02", "评估方式", "已选择"],
          ["03", "双重重要性", `${scoredTopics.length} 项已评分`],
          ["04", "重要性矩阵", scoredTopics.length ? "已生成" : "待评分"],
          ["05", "结果确认", confirmed ? "已确认" : needsReview ? "待复核" : "待确认"],
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
          description={`当前纳入 ${assessedTopics.length} 项议题，可根据本年度经营与利益相关方关注进行调整`}
          action={<button disabled={!ready || saving} onClick={() => openTopicEditor()} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#edf5f1] px-3 text-[11px] font-semibold text-[#176b52] hover:bg-[#e3f0ea] disabled:opacity-50"><Plus className="size-3.5" />新增议题</button>}
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
                  {item === "全部" ? `全部 ${topics.length}` : `${item} ${topics.filter((topic) => topic.category === item).length}`}
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
                  <button disabled={!ready || saving} onClick={() => openTopicEditor(topic.id)} className="grid size-8 shrink-0 place-items-center rounded-lg text-[#8d9792] hover:bg-[#f2f5f3] hover:text-[#45534b] disabled:opacity-50" aria-label={`编辑${topic.name}`}><PencilLine className="size-3.5" /></button>
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
                  onClick={() => { if (method !== option.name) editProject((current) => ({ ...current, materiality: { ...current.materiality, method: option.name, confirmed: false, confirmedAt: undefined } })); }}
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
          {project.projectKind !== "blank" ? <div className="mt-4 rounded-xl border border-[#e5e9e7] bg-[#fafbfa] p-3.5">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-[#3d4a43]"><Users className="size-3.5 text-[#176b52]" />参与范围</div>
            <div className="mt-2 flex -space-x-1.5">
              {["董", "环", "人", "法", "+12"].map((label, index) => <span key={label} className={`grid size-7 place-items-center rounded-full border-2 border-white text-[9px] font-semibold ${index === 4 ? "bg-[#e8ecea] text-[#67736d]" : "bg-[#264b3c] text-white"}`}>{label}</span>)}
            </div>
            <p className="mt-2 text-[10px] leading-4 text-[#858f8a]">董事会办公室等 5 个内部部门及 12 位外部利益相关方</p>
          </div> : null}
        </SectionCard>
      </div>

      <SectionCard
        className="mt-5"
        title="双重重要性评估"
        description="1–5 分制；分值及评估依据可继续调整"
        action={<StatusBadge tone="blue">{scoredTopics.length} 项已评分</StatusBadge>}
        flush
      >
        <div className="scrollbar-subtle overflow-x-auto">
          <table className="workbench-data-table">
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
                    <td className="px-4 py-3.5"><ScoreMeter value={topic.financialScore} label={`${topic.name}财务重要性`} onChange={(value) => updateScore(topic.id, "financialScore", value)} /></td>
                    <td className="px-4 py-3.5"><ScoreMeter value={topic.impactScore} label={`${topic.name}影响重要性`} onChange={(value) => updateScore(topic.id, "impactScore", value)} /></td>
                    <td className="px-4 py-3.5"><button className="inline-flex items-center gap-1 text-[#287258] hover:underline">查看依据<ArrowUpRight className="size-3" /></button></td>
                    <td className="px-5 py-3.5">{topic.financialScore === 0 || topic.impactScore === 0 ? <StatusBadge tone="amber">待评分</StatusBadge> : topic.confirmed ? <StatusBadge tone="green">已评分</StatusBadge> : <StatusBadge tone="amber">待复核</StatusBadge>}</td>
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
              {scoredTopics.map((topic) => {
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

        <SectionCard title="结果确认" description="确认后的评估结果供报告大纲编制参考" action={needsReview ? <StatusBadge tone="amber">待复核</StatusBadge> : undefined}>
          <div className="flex items-end justify-between rounded-xl bg-[#f2f7f4] p-4">
            <div><div className="text-[10px] text-[#728078]">重点议题</div><div className="mt-1 text-2xl font-semibold text-[#173e30]">{priorityTopics.length}<span className="ml-1 text-[10px] font-medium text-[#7b8b83]">项</span></div></div>
            <BarChart3 className="size-8 text-[#70a38e]" />
          </div>
          <ol aria-label="重点议题排序" className="mt-4 space-y-2">
            {priorityTopics.slice(0, 6).map((topic, index) => (
              <li key={topic.id} className="flex items-center justify-between rounded-lg border border-[#e6eae8] px-3 py-2.5">
                <div className="flex items-center gap-2.5"><span className="text-[10px] font-semibold tabular-nums text-[#9aa29e]">{String(index + 1).padStart(2, "0")}</span><span className="text-[11px] font-semibold text-[#36443c]">{topic.name}</span></div>
                <span className="text-[10px] font-semibold tabular-nums text-[#176b52]">{((topic.financialScore + topic.impactScore) / 2).toFixed(1)}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-[10px] leading-5 text-amber-800">
            <div className="flex items-center gap-2 font-semibold"><Sparkles className="size-3.5" />结果说明</div>
            <p className="mt-1">排序基于已录入评分，仅供整理参考，不代表系统自动作出重要性判断。</p>
            {needsReview ? <p className="mt-1 font-semibold">议题已移除，请核对当前评估范围和评分后重新确认。</p> : null}
          </div>
          <label className="mt-4 flex items-start gap-2.5 rounded-lg border border-[#e2e7e4] p-3 text-[10px] leading-5 text-[#59675f]">
            <input type="checkbox" checked={confirmed} disabled={!canConfirm} onChange={(event) => confirmAssessment(event.target.checked)} className="mt-1 size-3.5 accent-[#176b52]" />
            <span>我已复核评估依据与评分，并确认上述重要性评估结果。</span>
          </label>
          <button
            disabled={!canConfirm}
            onClick={() => confirmAssessment(true)}
            className={`mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${confirmed ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "bg-[#176b52] text-white hover:bg-[#105c46]"}`}
          >
            {confirmed ? <><CheckCircle2 className="size-4" />已由用户确认</> : <><ClipboardCheck className="size-4" />确认评估结果</>}
          </button>
        </SectionCard>
      </div>

      <StepFooter currentStep={2} />

      {topicEditor && !removal ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[#10241c]/40 p-4" role="dialog" aria-modal="true" aria-labelledby="topic-editor-title" onMouseDown={(event) => !saving && event.target === event.currentTarget && setTopicEditor(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e5e9e7] px-5 py-4">
              <div><h2 id="topic-editor-title" className="text-sm font-semibold text-[#26352d]">{topicEditor.id ? "编辑议题" : "新增议题"}</h2><p className="mt-1 text-[10px] text-[#87918c]">修改后重要性结果将回到待确认状态。</p></div>
              <button disabled={saving} aria-label="关闭议题编辑" onClick={() => setTopicEditor(null)} className="grid size-8 place-items-center rounded-lg text-[#7d8882] hover:bg-[#f2f5f3] disabled:opacity-50"><X className="size-4" /></button>
            </div>
            <fieldset disabled={saving} className="space-y-4 p-5">
              {presets.length > 0 ? (
                <div className="rounded-lg border border-[#e5e9e7] p-3">
                  <label htmlFor="topic-preset" className="mb-1.5 block text-[11px] font-semibold text-[#536159]">从预设添加</label>
                  <div className="flex flex-wrap gap-2">
                    <select id="topic-preset" value={presetId} onChange={(event) => setPresetId(event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-[#dce3df] bg-white px-2 text-xs">
                      <option value="">选择预设议题</option>
                      {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.category} · {preset.name}</option>)}
                    </select>
                    <button type="button" disabled={!presetId} onClick={() => void addPresetTopic()} className="h-9 rounded-lg bg-[#edf5f1] px-3 text-[11px] font-semibold text-[#176b52] disabled:opacity-50">添加预设议题</button>
                  </div>
                </div>
              ) : null}
              <div><label htmlFor="topic-name" className="mb-1.5 block text-[11px] font-semibold text-[#536159]">议题名称</label><input id="topic-name" autoFocus value={topicEditor.name} onChange={(event) => setTopicEditor({ ...topicEditor, name: event.target.value })} className="h-10 w-full rounded-lg border border-[#dce3df] px-3 text-xs outline-none focus:border-[#6f9f8c]" /></div>
              <div><label htmlFor="topic-category" className="mb-1.5 block text-[11px] font-semibold text-[#536159]">ESG 类别</label><select id="topic-category" value={topicEditor.category} onChange={(event) => setTopicEditor({ ...topicEditor, category: event.target.value as EsgCategory })} className="h-10 w-full rounded-lg border border-[#dce3df] bg-white px-3 text-xs outline-none"><option value="E">E · 环境</option><option value="S">S · 社会</option><option value="G">G · 治理</option></select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label htmlFor="topic-financial" className="mb-1.5 block text-[11px] font-semibold text-[#536159]">财务重要性</label><input id="topic-financial" type="number" min="1" max="5" step="0.1" value={topicEditor.financialScore} onChange={(event) => setTopicEditor({ ...topicEditor, financialScore: event.target.value })} className="h-10 w-full rounded-lg border border-[#dce3df] px-3 text-xs outline-none" /></div>
                <div><label htmlFor="topic-impact" className="mb-1.5 block text-[11px] font-semibold text-[#536159]">影响重要性</label><input id="topic-impact" type="number" min="1" max="5" step="0.1" value={topicEditor.impactScore} onChange={(event) => setTopicEditor({ ...topicEditor, impactScore: event.target.value })} className="h-10 w-full rounded-lg border border-[#dce3df] px-3 text-xs outline-none" /></div>
              </div>
              {topicError ? <p role="alert" className="text-[10px] text-rose-600">{topicError}</p> : null}
            </fieldset>
            <div className="flex flex-wrap items-center gap-2 border-t border-[#e5e9e7] bg-[#fafbf9] px-5 py-4">
              {topicEditor.id ? (
                <button type="button" disabled={saving} onClick={() => { setDeleteFailed(false); setRemoveTopicId(topicEditor.id); }} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-50 px-3 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"><Trash2 className="size-3.5" />删除议题</button>
              ) : null}
              <div className="ml-auto flex gap-2">
                <button type="button" disabled={saving} onClick={() => setTopicEditor(null)} className="h-9 rounded-lg border border-[#dce3df] px-4 text-[11px] font-semibold text-[#5b6861] disabled:opacity-50">取消</button>
                <button type="button" disabled={saving} onClick={saveTopicEditor} className="h-9 rounded-lg bg-[#176b52] px-4 text-[11px] font-semibold text-white disabled:opacity-50">保存议题</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {removal ? <TopicRemovalDialog removal={removal} saving={saving} error={deleteFailed ? message : ""} onCancel={() => setRemoveTopicId(undefined)} onConfirm={() => void deleteTopic()} /> : null}
    </>
  );
}

function TopicRemovalDialog({ removal, saving, error, onCancel, onConfirm }: {
  removal: NonNullable<ReturnType<typeof describeTopicRemoval>>;
  saving: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog ref={dialogRef} aria-labelledby="topic-removal-title" aria-describedby="topic-removal-impact" onCancel={(event) => { event.preventDefault(); if (!saving) onCancel(); }} className="m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-2xl bg-white p-0 text-[#26352d] shadow-2xl backdrop:bg-[#10241c]/45">
      <div className="p-5 sm:p-6">
        <h2 id="topic-removal-title" className="break-words text-base font-semibold">删除议题“{removal.topic.name}”？</h2>
        <ul id="topic-removal-impact" className="mt-4 list-disc space-y-1 pl-5 text-xs leading-6 text-[#536159]">
          <li>此议题将从当前项目的议题池移除，其他项目和公共模板保留。</li>
          {removal.included ? <li>此议题将退出本次评估，同步更新评分表、矩阵和重点议题排序。</li> : <li>此议题当前未纳入本次评估。</li>}
          {removal.assessmentNeedsReview ? <li>受影响的评估结果将标为待复核，原评分与确认信息保留在评估记录中。</li> : null}
          {removal.sections.length > 0 ? <li>将解除 {removal.sections.length} 个大纲章节的此议题关联，并标为待复核。</li> : null}
          <li>已有报告正文、资料和事实均会保留。</li>
        </ul>
        {error ? <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={saving} onClick={onCancel} className="h-9 rounded-lg border border-[#dce3df] px-4 text-xs font-semibold text-[#5b6861] disabled:opacity-50">取消</button>
          <button type="button" disabled={saving} onClick={onConfirm} className="h-9 rounded-lg bg-rose-700 px-4 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-50">{saving ? "正在删除…" : "确认删除"}</button>
        </div>
      </div>
    </dialog>
  );
}

function TopicRemovalHistory() {
  const { project } = useProjectData();
  const removals = project.impacts.filter((impact) => impact.topicRemoval).reverse();
  return (
    <SectionCard title="议题删除记录">
      {removals.length === 0 ? <p className="text-xs text-[#65736b]">尚无已删除议题。</p> : null}
      <ul className="space-y-3">
        {removals.map((impact) => {
          if (!impact.topicRemoval) return null;
          const { topic, assessment, lastSavedConfirmation, sectionIds } = impact.topicRemoval;
          const wasIncluded = assessment.includedTopicIds.includes(topic.id);
          return (
            <li key={impact.id} className="rounded-lg border border-[#e5e9e7] px-3 py-2 text-xs leading-6 text-[#536159]">
              <div className="flex flex-wrap justify-between gap-x-3"><strong>{topic.name}</strong><time dateTime={impact.createdAt}>{new Date(impact.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</time></div>
              <div>{topic.category} · {assessment.method} · {wasIncluded ? "已纳入评估" : "未纳入评估"}{wasIncluded && assessment.confirmed ? " · 原评估已确认" : ""}</div>
              <div>财务重要性 {topic.financialScore || "未评分"} · 影响重要性 {topic.impactScore || "未评分"}</div>
              {lastSavedConfirmation ? <div>原已保存确认的评分：财务 {lastSavedConfirmation.topic.financialScore} · 影响 {lastSavedConfirmation.topic.impactScore}</div> : null}
              <div>解除 {sectionIds.length} 个大纲章节的关联</div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

function ScoreMeter({ value, label, onChange }: { value: number; label: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex gap-0.5" aria-label={value ? `${value} 分` : "待评分"}>
        {[1, 2, 3, 4, 5].map((score) => <span key={score} className={`h-1.5 w-4 rounded-full ${score <= Math.round(value) ? "bg-[#4b9b7b]" : "bg-[#e3e8e5]"}`} />)}
      </div>
      <input aria-label={label} type="number" min="1" max="5" step="0.1" placeholder="待评分" value={draft ?? (value ? String(value) : "")} onChange={(event) => { const next = event.target.value; setDraft(next); if (parseScore(next) !== null) onChange(next); }} onBlur={() => setDraft(null)} className="h-8 w-16 rounded-md border border-[#dce3df] bg-white px-2 text-xs font-semibold tabular-nums text-[#33423a] outline-none focus:border-[#6f9f8c]" />
    </div>
  );
}
