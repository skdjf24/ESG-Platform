"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ExternalLink, Link2, Loader2, Sparkles } from "lucide-react";
import { mockPresentationAiProvider } from "@/lib/presentation/mock-ai";
import { validateChartSelection } from "@/lib/presentation/chart-validation";
import { chartSnapshots } from "@/lib/presentation/state";
import type { ContentBlock, WritingPolicy } from "@/lib/types/writing";
import type { MetricObservation, PresentationAiOperation, ReportChart, ReportChartType, ReportTheme } from "@/lib/types/presentation";

const fieldClass = "h-9 w-full rounded-lg border border-[#dce4df] bg-white px-2.5 text-[11px] text-[#405047] outline-none focus:border-[#6ea18a]";
const chartTypes: Array<{ id: ReportChartType; label: string }> = [
  { id: "bar", label: "柱状图" },
  { id: "line", label: "折线图" },
  { id: "stacked-bar", label: "堆叠柱状图" },
  { id: "pie", label: "饼图" },
  { id: "kpi", label: "关键绩效指标卡" },
];
function draftChart(block: ContentBlock, theme: ReportTheme, existing?: ReportChart): ReportChart {
  return existing ?? {
    chartId: `chart-${block.id}`,
    blockId: block.id,
    chapterId: block.chapterId,
    metricObservationIds: [],
    observationSnapshots: [],
    type: "bar",
    title: block.title,
    colors: theme.chartStyle.palette.slice(0, 3),
    showLegend: true,
    showDataLabels: true,
    precision: 0,
    unit: "",
    caption: "",
    status: "待配置",
    layoutReviewStatus: "待复核",
    revision: 1,
    updatedAt: new Date().toISOString(),
  };
}

export function ChartConfigPanel({
  block,
  chart,
  observations,
  theme,
  policy,
  onChange,
}: {
  block: ContentBlock | null;
  chart?: ReportChart;
  observations: MetricObservation[];
  theme: ReportTheme;
  policy: WritingPolicy;
  onChange: (chart: ReportChart) => void;
}) {
  const [draft, setDraft] = useState<ReportChart | null>(() => block ? draftChart(block, theme, chart) : null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [aiOperation, setAiOperation] = useState<PresentationAiOperation>("recommend-chart");
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const available = useMemo(() => observations.filter((item) => item.value !== null), [observations]);
  if (!block || !draft) return <div className="rounded-xl border border-dashed border-[#d9e3dd] p-5 text-center text-[11px] leading-5 text-[#819087]">请在预览或章节列表中选择一个图表占位块。</div>;

  const selected = observations.filter((item) => draft.metricObservationIds.includes(item.observationId));
  const validation = validateChartSelection(draft.type, selected, draft.unit);
  const canConfirm = validation.valid;

  function toggleObservation(id: string) {
    setDraft((current) => current ? {
      ...current,
      metricObservationIds: current.metricObservationIds.includes(id)
        ? current.metricObservationIds.filter((item) => item !== id)
        : [...current.metricObservationIds, id],
      status: "待确认",
      layoutReviewStatus: "待复核",
    } : current);
  }

  function apply(confirm: boolean) {
    const activeDraft = draft;
    if (!activeDraft || !activeDraft.metricObservationIds.length) return;
    const currentValidation = validateChartSelection(activeDraft.type, selected, activeDraft.unit);
    if (confirm && !currentValidation.valid) return;
    const snapshots = chartSnapshots(activeDraft, observations);
    const next: ReportChart = {
      ...activeDraft,
      observationSnapshots: confirm ? snapshots : (activeDraft.status === "需更新" ? activeDraft.observationSnapshots : snapshots),
      status: confirm && currentValidation.valid ? "已确认" : activeDraft.status === "需更新" ? "需更新" : "待确认",
      layoutReviewStatus: confirm && currentValidation.valid ? "有效" : "待复核",
      changeNote: confirm ? undefined : activeDraft.changeNote,
      validationIssues: currentValidation.issues,
      validatedAt: confirm ? new Date().toISOString() : activeDraft.validatedAt,
      usesMockData: selected.some((item) => item.sampleKind === "明确模拟样本"),
      revision: chart ? chart.revision + 1 : 1,
      updatedAt: new Date().toISOString(),
    };
    setDraft(next);
    onChange(next);
  }

  async function runAi() {
    const activeDraft = draft;
    const activeBlock = block;
    if (!activeDraft || !activeBlock) return;
    setAiLoading(true);
    setAiSuggestion("");
    try {
      const response = await mockPresentationAiProvider.run({
        taskId: crypto.randomUUID(), operation: aiOperation, blockId: activeBlock.id,
        chart: activeDraft, observations: selected, theme, policy,
      });
      setAiSuggestion(`${response.label}：${response.suggestion}`);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {draft.status === "需更新" ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-5 text-amber-800"><div className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="size-3.5" />指标版本发生变化</div><p className="mt-1">{draft.changeNote}</p><p className="mt-1">旧图表数据仍保留，确认更新前不会替换。</p></div> : null}

      <Field label="图表标题"><input aria-label="图表标题" className={fieldClass} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value, status: draft.status === "已确认" ? "待确认" : draft.status })} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="图表类型"><select aria-label="图表类型" className={fieldClass} value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as ReportChartType, status: "待确认" })}>{chartTypes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
        <Field label="数值精度"><select aria-label="数值精度" className={fieldClass} value={draft.precision} onChange={(event) => setDraft({ ...draft, precision: Number(event.target.value), status: "待确认" })}><option value={0}>整数</option><option value={1}>1 位小数</option><option value={2}>2 位小数</option></select></Field>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold text-[#536159]">选择指标、分类与年度</span><span className="text-[9px] text-[#8a958f]">{available.length} 项数值观测</span></div>
        <div className="max-h-48 space-y-2 overflow-y-auto pr-1 scrollbar-subtle">
          {available.map((item) => {
            const checked = draft.metricObservationIds.includes(item.observationId);
            return <label key={item.observationId} className={`block rounded-xl border p-3 transition ${checked ? "border-[#82b49f] bg-[#f0f7f3]" : "border-[#e0e6e2] bg-white"}`}>
              <div className="flex items-start gap-2"><input aria-label={`选择指标 ${item.metricName} ${item.reportingPeriod}`} type="checkbox" checked={checked} onChange={() => toggleObservation(item.observationId)} className="mt-0.5 accent-[#176b52]" /><span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#30453a]">{item.metricName}{item.sampleKind === "明确模拟样本" ? <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[8px] text-violet-700">独立模拟测试</span> : null}</span><span className="mt-1 block text-[9px] text-[#84928a]">{item.reportingPeriod} · {item.categoryLabel} · {item.rawValue} {item.unit} · v{item.revision}</span><span className="mt-1 block text-[8px] text-[#93a097]">指标{item.confirmationStatus} · 边界{item.boundaryStatus} · 来源{item.sourceConfirmationStatus} · {item.comparabilityStatus}</span></span></div>
              <button type="button" onClick={(event) => { event.preventDefault(); setSourceId(sourceId === item.observationId ? null : item.observationId); }} className="mt-2 inline-flex items-center gap-1 text-[9px] font-semibold text-[#176b52]"><ExternalLink className="size-3" />查看原始来源</button>
              {sourceId === item.observationId ? <div className="mt-2 space-y-2 rounded-lg bg-white p-2 text-[9px] leading-4 text-[#66776c]">{item.sourceReferences.map((source) => <div key={source.id}><div className="font-semibold text-[#3d5848]">{source.fileName}</div><div>{source.locator} · {source.excerpt}</div></div>)}{!item.sourceReferences.length ? <div className="text-amber-700">未关联来源</div> : null}<div>统计边界：{item.reportingBoundary || "待核验"}</div><div>来源确认：{item.sourceConfirmationStatus} · 修订 v{item.revision}</div></div> : null}
            </label>;
          })}
          {!available.length ? <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 p-3 text-[10px] leading-5 text-amber-800">暂无可用于配置的数值观测。请先在 Step 4 核对来源并人工确认指标。</div> : null}
        </div>
      </div>

      <div aria-label="图表数据有效性检查" className={`rounded-xl border p-3 text-[9px] leading-5 ${validation.valid ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
        <p className="font-semibold">数据有效性检查 · {validation.valid ? "可确认" : `${validation.issues.length} 项阻断`}</p>
        {validation.issues.map((issue) => <p key={issue} className="mt-1">• {issue}</p>)}
        {validation.warnings.map((warning) => <p key={warning} className="mt-1 text-violet-700">• {warning}</p>)}
        {validation.valid && !validation.warnings.length ? <p className="mt-1">单位、期间、统计边界、可比性、确认状态、来源及修订版本均满足当前图表类型要求。</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="单位"><input aria-label="图表单位" className={fieldClass} value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value, status: "待确认" })} placeholder={selected[0]?.unit || "沿用指标单位"} /></Field>
        <Field label="主色"><input aria-label="图表主色" type="color" className="h-9 w-full rounded-lg border border-[#dce4df] bg-white p-1" value={draft.colors[0] ?? theme.colors.primary} onChange={(event) => setDraft({ ...draft, colors: [event.target.value, ...draft.colors.slice(1)], status: "待确认" })} /></Field>
      </div>
      <div className="flex gap-4 text-[10px] text-[#5f7066]"><label className="flex items-center gap-1.5"><input type="checkbox" checked={draft.showLegend} onChange={(event) => setDraft({ ...draft, showLegend: event.target.checked, status: "待确认" })} className="accent-[#176b52]" />显示图例</label><label className="flex items-center gap-1.5"><input type="checkbox" checked={draft.showDataLabels} onChange={(event) => setDraft({ ...draft, showDataLabels: event.target.checked, status: "待确认" })} className="accent-[#176b52]" />数据标签</label></div>
      <Field label="图注"><textarea aria-label="图表图注" rows={3} value={draft.caption} onChange={(event) => setDraft({ ...draft, caption: event.target.value, status: "待确认" })} className="w-full resize-none rounded-lg border border-[#dce4df] p-2.5 text-[11px] leading-5 outline-none focus:border-[#6ea18a]" placeholder="说明口径、边界和来源" /></Field>

      <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3">
        <div className="flex gap-2"><div className="relative flex-1"><select aria-label="版式 AI 操作" value={aiOperation} onChange={(event) => setAiOperation(event.target.value as PresentationAiOperation)} className="h-8 w-full appearance-none rounded-lg border border-violet-200 bg-white px-2 pr-7 text-[10px]"><option value="recommend-chart">推荐图表类型</option><option value="generate-caption">生成图表说明</option><option value="recommend-layout">推荐章节版式</option><option value="detect-layout-issues">识别版面问题</option></select><ChevronDown className="pointer-events-none absolute right-2 top-2.5 size-3 text-violet-500" /></div><button onClick={() => void runAi()} disabled={aiLoading} className="inline-flex h-8 items-center gap-1 rounded-lg bg-violet-600 px-2.5 text-[10px] font-semibold text-white disabled:opacity-50">{aiLoading ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}Mock AI</button></div>
        {aiSuggestion ? <p className="mt-2 text-[10px] leading-5 text-violet-800">{aiSuggestion}<br /><span className="font-semibold">仅为本地规则示例，需人工确认。</span></p> : null}
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-[#e8edea] pt-4">
        <button disabled={!draft.metricObservationIds.length} onClick={() => apply(false)} className="h-9 rounded-lg border border-[#cfdad4] bg-white text-[10px] font-semibold text-[#52645a] disabled:opacity-40">应用配置</button>
        <button disabled={!canConfirm} onClick={() => apply(true)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#176b52] text-[10px] font-semibold text-white disabled:opacity-40"><Check className="size-3.5" />{draft.status === "需更新" ? "确认并更新图表" : "人工确认图表"}</button>
      </div>
      <div className="flex items-center justify-between text-[9px] text-[#87948c]"><span className="inline-flex items-center gap-1"><Link2 className="size-3" />{draft.blockId}</span><span>{draft.status} · 版面{draft.layoutReviewStatus}</span></div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-[#536159]">{label}</span>{children}</label>;
}
