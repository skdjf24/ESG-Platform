"use client";

import { useState } from "react";
import { BookOpen, Check, CheckCircle2, ChevronRight, ClipboardList, Database, ExternalLink, FileText, Link2, PanelRightClose, Plus, RefreshCw, Search, ShieldCheck, Unlink, X } from "lucide-react";
import { useProjectData } from "@/components/project/project-data-provider";
import type { SourceReference } from "@/lib/types/esg";
import type { ContentBlock, CoverageStatus, WritingChapter, WritingFact, WritingResource } from "@/lib/types/writing";
import { StatusBadge } from "@/components/ui/status-badge";

type Tab = "facts" | "requirements" | "resources" | "pending";
interface ResourcePanelProps {
  chapter: WritingChapter;
  block: ContentBlock | undefined;
  facts: WritingFact[];
  resources: WritingResource[];
  onBlockChange: (block: ContentBlock) => void;
  onFactChange: (fact: WritingFact) => void;
  onResourceChange: (resource: WritingResource) => void;
  onFocusBlock: (id: string) => void;
  onClose: () => void;
}

const buttonClass = "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-[#dce5df] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#476153] hover:bg-[#f0f7f3] disabled:cursor-not-allowed disabled:opacity-45";

function uniqueReferences(references: SourceReference[]) {
  return references.filter((reference, index) => references.findIndex((item) => item.id === reference.id) === index);
}

export function ResourcePanel({ chapter, block, facts, resources, onBlockChange, onFactChange, onResourceChange, onFocusBlock, onClose }: ResourcePanelProps) {
  const { project } = useProjectData();
  const disclosureRequirements = project.disclosureRequirements;
  const reportSections = project.reportSections;
  const [tab, setTab] = useState<Tab>("facts");
  const [allFacts, setAllFacts] = useState(false);
  const [allRequirements, setAllRequirements] = useState(false);
  const [factQuery, setFactQuery] = useState("");
  const [confirmedChecks, setConfirmedChecks] = useState<Record<string, boolean>>({});
  const [resourceChecks, setResourceChecks] = useState<Record<string, boolean>>({});
  const [sourceView, setSourceView] = useState<{ title: string; sources: SourceReference[] } | null>(null);
  const [expandedRequirement, setExpandedRequirement] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const topicNames = reportSections.find((section) => section.id === chapter.id)?.topics ?? [];
  const relatedRequirements = disclosureRequirements.filter((item) => topicNames.includes(item.topic) || chapter.blocks.some((itemBlock) => itemBlock.mappings.some((mapping) => mapping.requirementId === item.id)));
  const relatedFacts = facts.filter((fact) => topicNames.includes(fact.topic) || chapter.blocks.some((itemBlock) => itemBlock.citations.some((citation) => citation.factId === fact.id)));
  const visibleFacts = (allFacts ? facts : relatedFacts).filter((fact) => `${fact.name}${fact.topic}${fact.period}`.includes(factQuery.trim()));
  const pendingBlocks = chapter.blocks.filter((item) => (item.pendingKind && !item.resolved) || item.reviewStatus === "待复核");
  const chapterResources = resources.filter((resource) => resource.chapterIds.includes(chapter.id));

  function toggleFact(fact: WritingFact) {
    if (!block || fact.state !== "已确认") return;
    const cited = block.citations.some((citation) => citation.factId === fact.id);
    const citations = cited ? block.citations.filter((citation) => citation.factId !== fact.id) : [...block.citations, { factId: fact.id, factRevision: fact.revision }];
    const remainingFactSourceIds = new Set(facts.filter((item) => citations.some((citation) => citation.factId === item.id)).flatMap((item) => item.sourceReferences.map((source) => source.id)));
    const removedIds = new Set(fact.sourceReferences.map((source) => source.id));
    const references = cited
      ? block.sourceReferences.filter((source) => !removedIds.has(source.id) || remainingFactSourceIds.has(source.id))
      : uniqueReferences([...block.sourceReferences, ...fact.sourceReferences]);
    onBlockChange({ ...block, citations, sourceReferences: references, reviewStatus: "待复核" });
    setMessage(cited ? `已解除“${fact.name}”引用；请复核正文表述。` : `已将“${fact.name}”关联至当前正文块，保留来源定位。`);
  }

  function toggleResource(resource: WritingResource) {
    if (!block || !resource.confirmed || resource.sourceReferences.length === 0) return;
    const cited = resource.sourceReferences.every((source) => block.sourceReferences.some((item) => item.id === source.id));
    const ids = new Set(resource.sourceReferences.map((source) => source.id));
    const factSourceIds = new Set(facts.filter((fact) => block.citations.some((citation) => citation.factId === fact.id)).flatMap((fact) => fact.sourceReferences.map((source) => source.id)));
    onBlockChange({ ...block, sourceReferences: cited ? block.sourceReferences.filter((source) => !ids.has(source.id) || factSourceIds.has(source.id)) : uniqueReferences([...block.sourceReferences, ...resource.sourceReferences]), reviewStatus: "待复核" });
    setMessage(cited ? "已解除资料来源引用；被其他事实使用的来源将保留。" : "已关联资料来源，请在正文中核对引用的时间与范围。");
  }

  function toggleMapping(id: string) {
    if (!block) return;
    const mapped = block.mappings.some((mapping) => mapping.requirementId === id);
    onBlockChange({ ...block, mappings: mapped ? block.mappings.filter((mapping) => mapping.requirementId !== id) : [...block.mappings, { requirementId: id, coverage: "待核验" }], reviewStatus: "待复核" });
    setMessage(mapped ? "已解除当前正文块的披露映射。" : "已添加披露映射，覆盖情况待用户核验。");
  }

  return (
    <aside id="writing-resource-panel" className="min-w-0 overflow-hidden rounded-2xl border border-[#dfe7e2] bg-white" aria-label="章节资料包">
      <div className="flex items-center justify-between border-b border-[#e9efeb] px-4 py-4">
        <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-[#eaf4ef] text-[#176b52]"><Database className="size-4" /></span><div><h2 className="text-sm font-semibold text-[#263e30]">章节资料包</h2><p className="mt-0.5 text-[10px] text-[#839188]">来源可追溯 · 结论由用户确认</p></div></div>
        <button className="grid size-8 place-items-center rounded-lg text-[#819086] hover:bg-[#f0f5f2]" onClick={onClose} aria-label="折叠章节资料包"><PanelRightClose className="size-4" /></button>
      </div>
      <div className="border-b border-[#e8eeea] bg-[#f8fbf9] px-4 py-3"><p className="text-[10px] text-[#809085]">当前引用目标</p><p className="mt-1 truncate text-xs font-semibold text-[#41604d]">{block ? block.title || "未命名内容块" : "请先选中正文块"}</p></div>
      <div className="grid grid-cols-4 gap-1 border-b border-[#e8eeea] p-2" role="tablist" aria-label="资料包分类">
        {([{ id: "facts", label: "事实指标", icon: Database }, { id: "requirements", label: "披露要求", icon: BookOpen }, { id: "resources", label: "相关资料", icon: FileText }, { id: "pending", label: "待处理", icon: ClipboardList }] as const).map((item, index, tabs) => <button key={item.id} id={`resource-tab-${item.id}`} data-resource-tab={item.id} type="button" role="tab" aria-selected={tab === item.id} aria-controls={`resource-panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)} onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
          const next = tabs[nextIndex];
          setTab(next.id);
          event.currentTarget.parentElement?.querySelector<HTMLElement>(`[data-resource-tab="${next.id}"]`)?.focus();
        }} className={`flex flex-col items-center gap-1.5 rounded-lg px-1 py-2.5 text-[10px] font-medium ${tab === item.id ? "bg-[#eaf4ef] text-[#176b52]" : "text-[#809086] hover:bg-[#f4f7f5]"}`}><item.icon className="size-3.5" />{item.label}{item.id === "pending" && pendingBlocks.length > 0 ? <span className="sr-only">{pendingBlocks.length} 项</span> : null}</button>)}
      </div>
      <div id={`resource-panel-${tab}`} role="tabpanel" aria-labelledby={`resource-tab-${tab}`} className="scrollbar-subtle max-h-[calc(100vh-290px)] min-h-72 space-y-3 overflow-y-auto p-3">
        {message ? <div role="status" className="flex items-start gap-2 rounded-lg border border-[#cfe6d8] bg-[#f0f8f3] p-2.5 text-[11px] leading-5 text-[#346448]"><CheckCircle2 className="mt-1 size-3.5 shrink-0" /><span className="flex-1">{message}</span><button onClick={() => setMessage("")} aria-label="关闭资料操作提示"><X className="size-3" /></button></div> : null}
        {tab === "facts" ? <>
          <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-[#4b6052]">{allFacts ? "全部已有事实" : "本章企业事实与指标"}</span><button onClick={() => setAllFacts(!allFacts)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#176b52]"><Plus className="size-3" />{allFacts ? "仅看本章" : "添加已有事实"}</button></div>
          <label className="relative block"><Search className="absolute left-2.5 top-2.5 size-3.5 text-[#97a49b]" /><input value={factQuery} onChange={(event) => setFactQuery(event.target.value)} placeholder="搜索已有事实" aria-label="搜索已有事实" className="h-9 w-full rounded-lg border border-[#e0e8e2] bg-[#fafcfb] pl-8 pr-2 text-xs outline-none focus:border-[#70a48a]" /></label>
          <p className="text-[10px] leading-5 text-[#869389]">已确认指标可以引用；待确认事实需先查看来源并由用户确认。全部数据为示例。</p>
          {visibleFacts.map((fact) => {
            const citation = block?.citations.find((item) => item.factId === fact.id);
            const stale = citation && citation.factRevision !== fact.revision;
            return <article key={fact.id} className="rounded-xl border border-[#e0e8e2] p-3" data-testid={`fact-${fact.id}`}>
              <div className="flex flex-wrap items-center gap-2"><StatusBadge tone={fact.state === "已确认" ? "green" : "amber"}>{fact.state}</StatusBadge><span className="text-[10px] text-[#89958c]">v{fact.revision} · {fact.temporalType}</span></div>
              <h3 className="mt-3 text-xs font-semibold text-[#344c3d]">{fact.name}</h3><p className="mt-1 text-xl font-semibold tracking-tight text-[#214c35]">{fact.value}<span className="ml-1.5 text-xs font-normal text-[#748779]">{fact.unit}</span></p><p className="mt-1 text-[10px] text-[#91a094]">{fact.period} · {fact.topic}</p>
              {stale ? <p className="mt-2 rounded bg-amber-50 p-2 text-[10px] leading-5 text-amber-800">引用版本 v{citation.factRevision}，来源已更新至 v{fact.revision}，正文待复核。</p> : null}
              <button onClick={() => setSourceView({ title: fact.name, sources: fact.sourceReferences })} className="mt-3 inline-flex items-center gap-1 text-[11px] text-[#176b52]"><ExternalLink className="size-3" />查看来源 · {fact.sourceReferences.length} 处</button>
              {fact.state !== "已确认" ? <div className="mt-3 border-t border-[#eef2ef] pt-3"><label className="flex items-start gap-2 text-[10px] leading-5 text-[#687c6e]"><input type="checkbox" checked={Boolean(confirmedChecks[fact.id])} onChange={(event) => setConfirmedChecks((current) => ({ ...current, [fact.id]: event.target.checked }))} className="mt-1 accent-[#176b52]" /><span>我已核对原始来源、数值和统计口径</span></label><button className={`${buttonClass} mt-2 w-full`} disabled={!confirmedChecks[fact.id]} onClick={() => { onFactChange({ ...fact, state: "已确认", confirmedBy: "当前用户", revision: fact.revision + 1 }); setMessage(`“${fact.name}”已由用户确认，可选择引用。`); }}><ShieldCheck className="size-3.5" />确认该事实</button></div> : null}
              <div className="mt-3 flex flex-wrap gap-2"><button className={buttonClass} disabled={!block || fact.state !== "已确认"} onClick={() => toggleFact(fact)}>{citation ? <Unlink className="size-3" /> : <Link2 className="size-3" />}{citation ? "解除引用" : "引用资料"}</button>{stale && fact.state === "已确认" ? <button className={buttonClass} onClick={() => { if (block) { onBlockChange({ ...block, citations: block.citations.map((item) => item.factId === fact.id ? { ...item, factRevision: fact.revision } : item), sourceReferences: uniqueReferences([...block.sourceReferences, ...fact.sourceReferences]), reviewStatus: "待复核" }); setMessage("引用版本已更新，请对照来源审阅正文后确认审校。"); } }}><RefreshCw className="size-3" />更新引用</button> : null}</div>
              <button onClick={() => { onFactChange({ ...fact, revision: fact.revision + 1, state: "待人工确认", confirmedBy: undefined }); setConfirmedChecks((current) => ({ ...current, [fact.id]: false })); setMessage("已模拟来源版本变化，数值未改变；相关正文需要重新复核。"); }} className="mt-3 text-[10px] text-[#8c9a90] underline decoration-dotted underline-offset-4">模拟来源更新（不改数值）</button>
            </article>;
          })}
          {visibleFacts.length === 0 ? <EmptyState text="本章暂无匹配事实，可从已有事实库选择。" /> : null}
        </> : null}
        {tab === "requirements" ? <>
          <div className="flex items-center justify-between"><span className="text-xs font-semibold text-[#4b6052]">关联披露要求</span><button className="text-[11px] font-semibold text-[#176b52]" onClick={() => setAllRequirements(!allRequirements)}>{allRequirements ? "本章要求" : "添加映射"}</button></div>
          <p className="text-[10px] leading-5 text-[#869389]">将要求关联至选中的内容块。覆盖状态由用户核验，不代表合规结论。</p>
          {(allRequirements ? disclosureRequirements : relatedRequirements).map((requirement) => {
            const mapping = block?.mappings.find((item) => item.requirementId === requirement.id);
            return <article key={requirement.id} className="rounded-xl border border-[#e0e8e2] p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-[#28513a]">{requirement.framework} {requirement.code}</span>{mapping ? <Link2 className="size-3.5 text-[#3d9971]" /> : null}</div><p className="mt-2 text-xs leading-5 text-[#536d5c]">{requirement.summary}</p><p className="mt-1 text-[10px] text-[#8c9b90]">{requirement.topic} · {requirement.userConfirmed ? "用户已确认适用性" : "适用性待确认"}</p>
              <button className="mt-2 flex items-center gap-1 text-[11px] text-[#176b52]" onClick={() => setExpandedRequirement(expandedRequirement === requirement.id ? null : requirement.id)}><ChevronRight className={`size-3 transition ${expandedRequirement === requirement.id ? "rotate-90" : ""}`} />查看对应要求</button>
              {expandedRequirement === requirement.id ? <div className="mt-2 rounded-lg bg-[#f4f8f5] p-2.5 text-[10px] leading-5 text-[#6c8072]">映射章节：{requirement.mappedSection}<br />适用性：{requirement.applicability}<br />本项为第一版披露要求示例，正式编制时须复核原始标准条文。</div> : null}
              <div className="mt-3 flex flex-wrap items-center gap-2"><button className={buttonClass} disabled={!block} onClick={() => toggleMapping(requirement.id)}>{mapping ? <Unlink className="size-3" /> : <Plus className="size-3" />}{mapping ? "解除映射" : "关联正文块"}</button>{mapping ? <select aria-label={`${requirement.code} 覆盖状态`} value={mapping.coverage} onChange={(event) => block && onBlockChange({ ...block, mappings: block.mappings.map((item) => item.requirementId === requirement.id ? { ...item, coverage: event.target.value as CoverageStatus } : item), reviewStatus: "待复核" })} className="h-8 rounded-lg border border-[#dce5df] bg-white px-2 text-[11px] text-[#657b6c]"><option>部分覆盖</option><option>已覆盖</option><option>待核验</option></select> : null}</div>
            </article>;
          })}
          {(allRequirements ? disclosureRequirements : relatedRequirements).length === 0 ? <EmptyState text="暂无本章要求，可从现有披露矩阵添加映射。" /> : null}
        </> : null}
        {tab === "resources" ? <>
          <p className="text-[10px] leading-5 text-[#869389]">案例、制度与历史资料来自已有资料清单。未提供正文的资料仅显示待补充提示。</p>
          {chapterResources.map((resource) => {
            const confirmed = resource.confirmed;
            const cited = Boolean(block && resource.sourceReferences.length > 0 && resource.sourceReferences.every((source) => block.sourceReferences.some((item) => item.id === source.id)));
            return <article key={resource.id} className="rounded-xl border border-[#e0e8e2] p-3"><div className="flex flex-wrap items-center gap-2"><StatusBadge tone="gray">{resource.kind}</StatusBadge><span className={`text-[10px] ${confirmed ? "text-[#35825a]" : "text-amber-700"}`}>{confirmed ? "已确认" : "待确认"}</span><span className="text-[10px] text-[#89958c]">v{resource.revision}</span></div><h3 className="mt-3 text-xs font-semibold leading-5 text-[#3e5b49]">{resource.title}</h3><p className="mt-1 text-[11px] leading-5 text-[#849589]">{resource.description}</p><button className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#176b52]" onClick={() => setSourceView({ title: resource.title, sources: resource.sourceReferences })}><ExternalLink className="size-3" />查看来源</button>
              {!confirmed && resource.sourceReferences.length > 0 ? <div className="mt-3 border-t border-[#eef2ef] pt-3"><label className="flex items-start gap-2 text-[10px] leading-5 text-[#657d6c]"><input type="checkbox" checked={Boolean(resourceChecks[resource.id])} onChange={(event) => setResourceChecks((current) => ({ ...current, [resource.id]: event.target.checked }))} className="mt-1 accent-[#176b52]" /><span>我已人工核对该资料、来源定位及时间范围</span></label><button className={`${buttonClass} mt-2 w-full`} disabled={!resourceChecks[resource.id]} onClick={() => { onResourceChange({ ...resource, confirmed: true, confirmedBy: "当前用户", confirmedAt: new Date().toISOString(), revision: resource.revision + 1 }); setMessage(`“${resource.title}”已由用户确认，确认状态将随草稿保存。`); }}><ShieldCheck className="size-3.5" />确认该资料</button></div> : null}
              <button className={`${buttonClass} mt-3 w-full`} disabled={!block || !confirmed || resource.sourceReferences.length === 0} onClick={() => toggleResource(resource)}>{cited ? <Unlink className="size-3" /> : <Link2 className="size-3" />}{cited ? "解除资料引用" : "引用资料来源"}</button>
            </article>;
          })}
          {chapterResources.length === 0 ? <EmptyState text="本章暂无案例、制度或历史资料关联。" /> : null}
          {block && block.sourceReferences.length > 0 ? <div className="rounded-xl border border-[#e0e8e2] bg-[#f7faf8] p-3"><h3 className="text-xs font-semibold text-[#4c6555]">当前块的来源关联</h3>{block.sourceReferences.map((source) => <button key={source.id} className="mt-2 block w-full truncate text-left text-[11px] text-[#176b52]" onClick={() => setSourceView({ title: source.fileName, sources: [source] })}>{source.fileName} · {source.locator}</button>)}</div> : null}
        </> : null}
        {tab === "pending" ? <><p className="text-[10px] leading-5 text-[#869389]">汇总本章内部占位和来源变更，点击可定位对应内容块。</p>{pendingBlocks.map((item) => <button key={item.id} onClick={() => onFocusBlock(item.id)} className="w-full rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-left"><div className="flex items-center justify-between"><StatusBadge tone="amber">{item.reviewStatus === "待复核" ? "待复核" : item.pendingKind}</StatusBadge><ChevronRight className="size-3.5 text-amber-600" /></div><p className="mt-2 text-xs font-semibold leading-5 text-[#626348]">{item.title || "未命名内容块"}</p><p className="mt-1 text-[10px] text-[#8d927e]">定位正文 · {item.id.slice(-8)}</p></button>)}{pendingBlocks.length === 0 ? <div className="rounded-xl border border-[#dce9df] bg-[#f5faf6] p-5 text-center"><CheckCircle2 className="mx-auto size-6 text-[#6aab7e]" /><p className="mt-2 text-xs text-[#6b8573]">本章暂无待处理事项</p></div> : null}</> : null}
      </div>
      {sourceView ? <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#12271d]/45 p-4 backdrop-blur-[2px]" onKeyDown={(event) => event.key === "Escape" && setSourceView(null)} onMouseDown={(event) => event.target === event.currentTarget && setSourceView(null)}><section role="dialog" aria-modal="true" aria-labelledby="writing-source-title" className="max-h-[80vh] w-full max-w-xl overflow-auto rounded-2xl bg-white shadow-2xl"><header className="flex items-start justify-between gap-3 border-b border-[#e5ece7] p-5"><div><p className="text-[10px] font-semibold tracking-wider text-[#819387]">原始资料 · 来源定位</p><h2 id="writing-source-title" className="mt-1 text-base font-semibold text-[#274735]">{sourceView.title}</h2></div><button autoFocus onClick={() => setSourceView(null)} className="grid size-8 place-items-center rounded-lg text-[#708779] hover:bg-[#edf4ef]" aria-label="关闭来源详情"><X className="size-4" /></button></header><div className="space-y-3 p-5">{sourceView.sources.map((source) => <article key={source.id} className="rounded-xl border border-[#dce6df] p-4"><div className="flex gap-2"><FileText className="mt-0.5 size-4 shrink-0 text-[#36805a]" /><h3 className="break-all text-sm font-semibold text-[#44634f]">{source.fileName}</h3></div><p className="mt-2 text-xs font-medium text-[#548366]">定位：{source.locator}</p><blockquote className="mt-3 border-l-2 border-[#98c4a7] bg-[#f3f8f4] p-3 text-xs leading-6 text-[#6b8273]">{source.excerpt}</blockquote><p className="mt-2 break-all font-mono text-[10px] text-[#9aaba0]">来源 ID：{source.sourceId} · 引用 ID：{source.id}</p></article>)}{sourceView.sources.length === 0 ? <EmptyState text="当前资料尚未提交，暂无可查看的来源内容。" /> : null}<p className="text-[11px] leading-5 text-[#93a197]">此处展示模拟资料的文件名、定位及摘录；当前版本不包含真实原文件下载。</p></div><footer className="flex justify-end border-t border-[#e5ece7] p-4"><button className={buttonClass} onClick={() => setSourceView(null)}><Check className="size-3" />完成查看</button></footer></section></div> : null}
    </aside>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-[#dce6df] px-4 py-6 text-center text-xs leading-6 text-[#8a9c8f]">{text}</div>;
}
