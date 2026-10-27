"use client";

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { AlertTriangle, BookOpen, ChevronDown, ChevronRight, FileClock, ListChecks, PanelRightClose, PanelRightOpen, Plus, Redo2, Save, Search, Settings2, Sparkles, Undo2, X } from 'lucide-react';
import { BlockEditor } from '@/components/writing/block-editor';
import { ResourcePanel } from '@/components/writing/resource-panel';
import { AiDialog } from '@/components/writing/ai-dialog';
import { PolicyDialog } from '@/components/writing/policy-dialog';
import { useWritingDocument } from '@/components/writing/use-writing-document';
import { createBlock, getChapterResources, plainText, sanitizeHtml, scanWriting } from '@/lib/writing/document';
import { mockAiProvider, operationLabels } from '@/lib/writing/mock-ai';
import type { AiOperation, AiTaskRequest, AiTaskResponse, BlockKind, ContentBlock, WritingChapter } from '@/lib/types/writing';

const button = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#dce5df] bg-white px-3 text-xs font-medium text-[#52675a] hover:bg-[#f0f6f2] disabled:cursor-not-allowed disabled:opacity-40';
const blockLabels: Record<BlockKind, string> = { heading: '标题', paragraph: '富文本段落', table: '指标表格', case: '案例', chart: '图表占位', todo: '待处理事项' };
const escapeText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const textHtml = (text: string) => text.split('\n').map(line => `<p>${escapeText(line)}</p>`).join('');
const headingHtml = (text: string) => `<h2>${escapeText(text)}</h2>`;
const desktopResourceQuery = '(min-width: 1280px)';
const subscribeDesktopResource = (notify: () => void) => {
  const query = window.matchMedia(desktopResourceQuery);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
const getDesktopResource = () => window.matchMedia(desktopResourceQuery).matches;
const getServerDesktopResource = () => false;

/** Replace a unique text selection while retaining formatting outside its DOM range. */
function replaceSelection(html: string, selection: string, replacement: string): string | null {
  const host = document.createElement('div'); host.innerHTML = sanitizeHtml(html);
  const text = host.textContent ?? ''; const start = text.indexOf(selection);
  if (start < 0 || text.indexOf(selection, start + selection.length) >= 0) return null;
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  let offset = 0; let node: Node | null; const range = document.createRange(); let started = false;
  while ((node = walker.nextNode())) {
    const end = offset + (node.textContent?.length ?? 0);
    if (!started && start >= offset && start < end) { range.setStart(node, start - offset); started = true; }
    if (started && start + selection.length <= end) { range.setEnd(node, start + selection.length - offset); range.deleteContents(); range.insertNode(document.createTextNode(replacement)); return sanitizeHtml(host.innerHTML); }
    offset = end;
  }
  return null;
}

export function StepFive() {
  const store = useWritingDocument();
  const { doc } = store;
  const [chapterId, setChapterId] = useState('section-4-2');
  const [blockId, setBlockId] = useState('section-4-2-paragraph');
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const desktopResource = useSyncExternalStore(subscribeDesktopResource, getDesktopResource, getServerDesktopResource);
  const [panelOverride, setPanelOverride] = useState<boolean | null>(null);
  const panelOpen = panelOverride ?? desktopResource;
  const setPanelOpen = setPanelOverride;
  const [policyOpen, setPolicyOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [selection, setSelection] = useState<{ blockId: string; text: string } | null>(null);
  const [operation, setOperation] = useState<AiOperation>('draft');
  const [aiRequest, setAiRequest] = useState<AiTaskRequest | null>(null);
  const chapter = doc.chapters.find(c => c.id === chapterId) ?? doc.chapters[0];
  const selectedBlock = chapter.blocks.find(b => b.id === blockId);
  const issues = scanWriting(chapter, doc.policy);
  const pending = chapter.blocks.filter(b => (b.pendingKind && !b.resolved) || b.reviewStatus === '待复核');
  const versions = doc.versions.filter(v => v.chapterId === chapter.id).slice().reverse();
  const upstreamImpacts = store.project.impacts.filter(impact => impact.status === '待复核' && impact.targetSteps.includes(5));

  function changeChapter(next: WritingChapter) {
    store.edit({ ...doc, chapters: doc.chapters.map(c => c.id === next.id ? { ...next, revision: c.revision + 1 } : c) });
  }
  function changeBlock(next: ContentBlock) {
    const previous = chapter.blocks.find(b => b.id === next.id);
    const contentChanged = previous && (previous.html !== next.html || previous.title !== next.title || JSON.stringify(previous.rows) !== JSON.stringify(next.rows));
    changeChapter({ ...chapter, status: '撰写中', reviewStatus: chapter.reviewStatus === '已审校' ? '待复核' : chapter.reviewStatus,
      blocks: chapter.blocks.map(b => b.id === next.id ? { ...next, html: next.kind === 'heading' ? headingHtml(next.title) : sanitizeHtml(next.html), revision: b.revision + 1, updatedAt: new Date().toISOString(), reviewStatus: contentChanged ? '待复核' : next.reviewStatus } : b) });
  }
  function selectChapter(id: string) {
    setChapterId(id); setBlockId(doc.chapters.find(c => c.id === id)?.blocks[0]?.id ?? ''); setSelection(null);
  }
  function focusBlock(id: string) {
    setBlockId(id);
    requestAnimationFrame(() => {
      const element = document.getElementById(`block-${id}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element?.focus({ preventScroll: true });
    });
  }
  function addBlock(kind: BlockKind) {
    const block = createBlock(chapter.id, kind);
    changeChapter({ ...chapter, status: '撰写中', reviewStatus: '未审校', blocks: [...chapter.blocks, block] }); setBlockId(block.id);
  }
  function startAi() {
    if (operation !== 'draft' && (!selectedBlock || selectedBlock.kind === 'table' || selectedBlock.kind === 'heading')) { store.setMessage('请先选择正文段落、案例或说明内容块。'); return; }
    const text = selection?.blockId === blockId ? selection.text : '';
    if (operation === 'rewrite' && !text) { store.setMessage('请在当前正文块中选中文字，再执行局部改写。'); return; }
    const topics = store.project.reportSections.find(s => s.id === chapter.id)?.topics ?? [];
    const facts = doc.facts.filter(f => topics.includes(f.topic) || chapter.blocks.some(b => b.citations.some(c => c.factId === f.id)));
    setAiRequest({ taskId: crypto.randomUUID(), operation, chapter: structuredClone(chapter), blockId: operation === 'draft' ? undefined : selectedBlock?.id,
      selectedText: operation === 'rewrite' ? text : undefined, sourceText: operation === 'draft' ? chapter.blocks.map(b => plainText(b.html)).join('\n') : plainText(selectedBlock?.html ?? ''),
      facts: structuredClone(facts), requirementIds: [...new Set(chapter.blocks.flatMap(b => b.mappings.map(m => m.requirementId)))], policy: structuredClone(doc.policy) });
  }
  function acceptAi(response: AiTaskResponse) {
    const request = aiRequest;
    if (!request || request.taskId !== response.taskId || request.chapter.id !== chapter.id || request.chapter.revision !== chapter.revision) { store.setMessage('正文版本已变化，请重新生成建议。'); return; }
    const staleEvidence = response.citedFactIds.some((id) => {
      const requested = request.facts.find(fact => fact.id === id);
      const current = doc.facts.find(fact => fact.id === id);
      return !requested || !current || current.state !== '已确认'
        || requested.revision !== current.revision || requested.value !== current.value
        || requested.period !== current.period || requested.unit !== current.unit
        || JSON.stringify(requested.sourceReferences) !== JSON.stringify(current.sourceReferences);
    });
    if (staleEvidence) { store.setMessage('AI 任务使用的事实或来源已经变化，请重新生成建议。'); return; }
    const target = chapter.blocks.find(b => b.id === request.blockId);
    const facts = doc.facts.filter(f => response.citedFactIds.includes(f.id) && f.state === '已确认');
    const newBlock = request.operation === 'draft' ? createBlock(chapter.id, 'paragraph') : target;
    if (!newBlock) return;
    const html = request.operation === 'rewrite' && request.selectedText ? replaceSelection(newBlock.html, request.selectedText, response.suggestion) : textHtml(response.suggestion);
    if (html === null) { store.setMessage('所选文字跨段落、重复或已变化，无法安全定位。请选取唯一的段内文字后重新生成。'); return; }
    const next: ContentBlock = { ...newBlock, title: request.operation === 'draft' ? '章节初稿 · Mock 示例' : newBlock.title, html,
      citations: [...newBlock.citations.filter(c => !facts.some(f => f.id === c.factId)), ...facts.map(f => ({ factId: f.id, factRevision: f.revision }))],
      sourceReferences: [...new Map([...newBlock.sourceReferences, ...facts.flatMap(f => f.sourceReferences)].map(s => [s.id, s])).values()],
      mappings: request.operation === 'draft' ? request.requirementIds.map(requirementId => ({ requirementId, coverage: '待核验' })) : newBlock.mappings,
      reviewStatus: '待复核', pendingKind: '待确认', resolved: false, revision: newBlock.revision + 1, updatedAt: new Date().toISOString() };
    changeChapter({ ...chapter, status: '待完善', reviewStatus: '待复核', blocks: request.operation === 'draft' ? [...chapter.blocks, next] : chapter.blocks.map(b => b.id === next.id ? next : b) });
    setBlockId(next.id); setAiRequest(null); setSelection(null); store.setMessage('已接受 Mock 示例建议，请人工复核后保存。');
  }
  function setStatus(status: WritingChapter['status']) {
    if (status === '已审校' && (pending.length || chapter.blocks.some(b => b.mappings.some(m => m.coverage === '待核验')))) { store.setMessage('请先处理内部标记、待复核引用及待核验的披露映射，再确认已审校。'); return; }
    changeChapter({ ...chapter, status, reviewStatus: status === '已审校' ? '已审校' : status === '待审校' ? '待审校' : chapter.reviewStatus });
  }

  if (!store.ready) return <div className="p-12 text-center text-sm text-[#63776a]">正在读取本地编制草稿…</div>;
  return <div className="writing-workbench">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#6d8275]">Step 05 · Report writing</p><h1 className="mt-1.5 text-2xl font-semibold tracking-tight">报告内容生成与编辑</h1><p className="mt-2 text-xs leading-5 text-[#78877e]">连接披露要求、企业事实与正文，让每一项披露有据可查。</p></div>
      <div className="flex flex-wrap gap-2"><button className={button} onClick={() => setPolicyOpen(true)}><Settings2 className="size-3.5" />Writing Policy</button><button className={button} onClick={() => setVersionsOpen(true)}><FileClock className="size-3.5" />版本记录</button><button className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#176b52] px-4 text-xs font-semibold text-white hover:bg-[#10543e]" onClick={() => store.save()}><Save className="size-3.5" />保存报告草稿</button></div>
    </div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#dbe7df] bg-[#eff6f2] px-4 py-2.5 text-[11px] text-[#587463]"><span>当前企业：{store.project.enterprise.name} · AI 操作使用 Mock 响应 · 项目数据按 projectId 本地隔离</span><span role="status">{store.dirty ? '● 有未保存更改' : doc.savedAt ? `已本地保存 ${new Date(doc.savedAt).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit' })}` : '初始示例 · 尚未保存'}</span></div>
    {upstreamImpacts.length ? <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3"><div className="flex items-center gap-2 text-xs font-semibold text-amber-900"><AlertTriangle className="size-4" />上游数据有 {upstreamImpacts.length} 项变化，正文未被自动覆盖</div><div className="mt-2 space-y-2">{upstreamImpacts.slice(-3).map(impact => <div key={impact.id} className="flex items-start justify-between gap-3 rounded-lg bg-white/75 px-3 py-2 text-[11px] leading-5 text-amber-900"><span>{impact.message}</span><button onClick={() => store.acknowledgeImpact(impact.id)} className="shrink-0 font-semibold text-[#176b52]">已知悉</button></div>)}</div></div> : null}
    {store.message && <div role="status" className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">{store.message}<button aria-label="关闭提示" onClick={() => store.setMessage('')}><X className="size-4" /></button></div>}
    <div className={`writing-grid ${panelOpen ? '' : 'writing-grid-closed'}`}>
      <aside className="writing-tree self-start rounded-xl border border-[#e1e7e3] bg-white">
        <div className="flex items-center gap-2 border-b border-[#edf0ee] p-4 text-sm font-semibold"><BookOpen className="size-4 text-[#176b52]" />报告目录<span className="ml-auto text-[10px] font-normal text-[#89978e]">Step 3</span></div>
        <div className="relative m-3"><Search className="absolute left-2.5 top-2.5 size-3.5 text-[#8f9c94]" /><input className="h-9 w-full rounded-lg border border-[#dfe7e1] pl-8 pr-2 text-xs" placeholder="搜索章节" aria-label="搜索章节" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <div className="space-y-1 px-2 pb-4">{doc.chapters.filter(c => (!search || c.title.includes(search)) && (search || !c.parentId || !collapsed.includes(c.parentId))).map(c => <div key={c.id} className={`flex rounded-lg ${c.id === chapter.id ? 'bg-[#eaf4ee]' : 'hover:bg-[#f7f9f8]'} ${c.parentId ? 'ml-3' : ''}`}>
          {doc.chapters.some(item => item.parentId === c.id) && <button aria-label={`${collapsed.includes(c.id) ? '展开' : '折叠'}${c.title}`} aria-expanded={!collapsed.includes(c.id)} onClick={() => setCollapsed(collapsed.includes(c.id) ? collapsed.filter(id => id !== c.id) : [...collapsed, c.id])} className="pl-1 text-[#84978a]">{collapsed.includes(c.id) ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}</button>}
          <button onClick={() => selectChapter(c.id)} className="min-w-0 flex-1 p-2.5 text-left" aria-current={c.id === chapter.id ? 'page' : undefined}><div className={`text-xs font-medium ${c.id === chapter.id ? 'text-[#176b52]' : 'text-[#53685a]'}`}><span className="mr-1.5 text-[10px] opacity-60">{c.order}</span>{c.title}</div><div className="mt-1 text-[10px] text-[#95a198]">{c.sourceState === 'upstream-removed' ? '上游已移除 · 正文保留' : c.status}</div></button>
        </div>)}</div>
        <div className="border-t border-[#edf0ee] p-3 text-[10px] leading-5 text-[#89988e]">{doc.chapters.length} 个目录节点<br />章节编辑与审校状态分别记录</div>
      </aside>
      <section className="min-w-0">
        <div className="mb-3 rounded-xl border border-[#e0e7e2] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-widest text-[#8d9b92]">Chapter {chapter.order}</span><select value={chapter.status} aria-label="章节状态" onChange={e => setStatus(e.target.value as WritingChapter['status'])} className="rounded-lg border border-[#dde6df] bg-[#f7faf8] px-2 py-1 text-[11px] text-[#52715e]">{['未开始','撰写中','待完善','待审校','已审校'].map(status => <option key={status}>{status}</option>)}</select></div>
          <input aria-label="章节标题" className="my-2 w-full rounded border border-transparent bg-transparent py-1 text-xl font-semibold focus:border-[#9dc4ae]" value={chapter.title} onChange={e => changeChapter({ ...chapter, title: e.target.value, status: '撰写中', reviewStatus: '待复核' })} />
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#839389]"><span>{chapter.blocks.length} 个内容块 · 审校：{chapter.reviewStatus} · 修订 {chapter.revision}</span><span>{pending.length} 项待处理</span></div>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-[#e0e7e2] bg-white p-2">
          <button className={button + ' !px-2'} disabled={!store.past.length} onClick={store.undo} aria-label="撤销"><Undo2 className="size-4" /></button><button className={button + ' !px-2'} disabled={!store.future.length} onClick={store.redo} aria-label="重做"><Redo2 className="size-4" /></button>
          <select aria-label="AI 操作" value={operation} onChange={e => setOperation(e.target.value as AiOperation)} className="h-9 min-w-0 flex-1 rounded-lg border border-[#e0e6e2] bg-white px-2 text-xs">{Object.entries(operationLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
          <button onClick={startAi} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#eaf3ee] px-3 text-xs font-semibold text-[#176b52]"><Sparkles className="size-3.5" />Mock AI</button>
          <button className={button + ' !px-2'} aria-label="空泛表述检查" onClick={() => setScanOpen(!scanOpen)}><ListChecks className="size-4" /></button>
          <button className={button + ' !px-2'} aria-label={panelOpen ? '折叠章节资料包' : '展开章节资料包'} aria-expanded={panelOpen} aria-controls="writing-resource-panel" onClick={() => setPanelOpen(!panelOpen)}>{panelOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}</button>
        </div>
        {selection?.text && selection.blockId === blockId && <p className="mb-3 rounded-lg bg-violet-50 p-2.5 text-[11px] text-violet-700">已选文字：{selection.text.slice(0, 100)}{selection.text.length > 100 ? '…' : ''}</p>}
        {scanOpen && <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="text-xs font-semibold text-amber-900">空泛表述检查 · 词语匹配规则</div><p className="my-2 text-[11px] leading-5 text-amber-800">仅检测配置词语，供人工复核，不代表完整 AI 语义审校。</p>{issues.map((issue, i) => <button key={i} onClick={() => focusBlock(issue.blockId)} className="mt-2 block w-full rounded-lg bg-white/80 p-2 text-left text-xs leading-5 text-amber-900">{issue.suggestion}</button>)}{!issues.length && <p className="text-xs">未命中当前规则词。仍需人工审阅。</p>}</div>}
        <div className="space-y-4">{chapter.blocks.map(block => <div key={block.id}>
          <BlockEditor block={block} selected={selectedBlock?.id === block.id} onSelect={() => { if (blockId !== block.id) { setBlockId(block.id); setSelection(null); } }} onChange={changeBlock} onDelete={() => { const remaining = chapter.blocks.filter(b => b.id !== block.id); changeChapter({ ...chapter, status: '撰写中', reviewStatus: '待复核', blocks: remaining }); if (blockId === block.id) setBlockId(remaining[0]?.id ?? ''); setSelection(null); }} onSelection={text => setSelection({ blockId: block.id, text })} />
          {selectedBlock?.id === block.id && <div className="mt-1 flex flex-wrap items-center gap-2 px-1 text-[10px] text-[#7a8f80]"><label>内部标记 <select aria-label="当前块内部标记" value={block.pendingKind ?? ''} onChange={e => changeBlock({ ...block, pendingKind: e.target.value ? e.target.value as ContentBlock['pendingKind'] : undefined, resolved: false })} className="rounded border border-[#dce5df] bg-white p-1"><option value="">无</option><option>待补充</option><option>待确认</option><option>待更新</option></select></label><button onClick={() => changeBlock({ ...block, pendingKind: undefined, resolved: true, reviewStatus: '已审校' })} className="ml-auto rounded border border-[#dce5df] bg-white px-2 py-1 text-[#176b52]">人工确认此块已审校</button></div>}
        </div>)}</div>
        <div className="mt-4 flex flex-wrap gap-2 rounded-xl border border-dashed border-[#bed2c5] bg-white/60 p-3">{Object.entries(blockLabels).map(([kind, label]) => <button key={kind} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-[11px] text-[#4f775e] hover:bg-[#eaf4ee]" onClick={() => addBlock(kind as BlockKind)}><Plus className="size-3" />{label}</button>)}</div>
      </section>
      {panelOpen && <div className="writing-resources min-w-0 self-start"><ResourcePanel chapter={chapter} block={selectedBlock} facts={doc.facts} resources={getChapterResources(doc.resources, chapter.id)} onBlockChange={changeBlock} onFactChange={fact => store.edit({ ...doc, facts: doc.facts.map(f => f.id === fact.id ? fact : f) })} onResourceChange={resource => store.edit({ ...doc, resources: doc.resources.map(item => item.id === resource.id ? resource : item) })} onFocusBlock={focusBlock} onClose={() => setPanelOpen(false)} /></div>}
    </div>
    <div className="mt-6 flex justify-between border-t border-[#dfe7e1] pt-4 text-xs text-[#587764]"><Link onClick={() => { if (store.dirty) void store.save('步骤切换自动保存'); }} href={`/reports/${store.project.projectId}/step/4`}>← 返回资料收集</Link><Link onClick={() => { if (store.dirty) void store.save('步骤切换自动保存'); }} href={`/reports/${store.project.projectId}/step/6`}>Step 6 可视化排版（待开发） →</Link></div>
    {policyOpen && <PolicyDialog policy={doc.policy} onSave={policy => { store.edit({ ...doc, policy }); setPolicyOpen(false); store.setMessage('写作规范已应用，请保存报告草稿。'); }} onClose={() => setPolicyOpen(false)} />}
    {aiRequest && <AiDialog request={aiRequest} provider={mockAiProvider} onAccept={acceptAi} onClose={() => setAiRequest(null)} />}
    {versionsOpen && <div className="fixed inset-0 z-[65] grid place-items-center bg-[#12271d]/40 p-4" onKeyDown={e => e.key === 'Escape' && setVersionsOpen(false)}><section role="dialog" aria-modal="true" aria-label="章节版本记录" className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-center justify-between"><h2 className="text-base font-semibold">章节版本记录</h2><button autoFocus onClick={() => setVersionsOpen(false)} aria-label="关闭版本记录"><X className="size-4" /></button></div><p className="my-3 text-xs leading-5 text-[#7b8d80]">{chapter.title} · 恢复版本后可撤销，保存时产生新记录。历史版本保留。</p>{versions.length ? versions.map(v => <div key={v.id} className="mb-2 rounded-xl border border-[#e1e7e3] p-3"><div className="flex items-center justify-between text-xs"><span className="font-semibold">v{v.number} · {v.label}</span><button className="text-[#176b52]" onClick={() => { const restored = structuredClone(v.snapshot); changeChapter({ ...restored, revision: chapter.revision, status: '待完善', reviewStatus: '待复核', blocks: restored.blocks.map(b => ({ ...b, reviewStatus: '待复核' })) }); setBlockId(restored.blocks[0]?.id ?? ''); setSelection(null); setVersionsOpen(false); store.setMessage(`已恢复 v${v.number}，请复核来源并保存为新版本。`); }}>恢复此版本</button></div><p className="mt-2 text-[10px] text-[#87978d]">{new Date(v.savedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} · {v.snapshot.blocks.length} 个内容块</p></div>) : <p className="py-8 text-center text-sm text-[#89998e]">保存草稿后建立版本记录</p>}</section></div>}
  </div>;
}
