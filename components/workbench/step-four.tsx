"use client";

import { useState } from "react";
import { ChevronRight, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ProjectReportSection } from "@/lib/types/project-data";
import { useProjectData } from "@/components/project/project-data-provider";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { StepFooter } from "@/components/workbench/step-footer";
import { StepPageHeader } from "@/components/workbench/step-page-header";
import { chapterEvidence, isConfirmedFact, materialState, sectionMaterialIds } from "@/lib/project/materials";
import { appendSuggestedSections, needsChapterMaterials, suggestReportOutline } from "@/lib/project/outline";
import { formatProjectStep } from "@/lib/project/route-id";

export function StepFour({ initialChapterId }: { initialChapterId?: string }) {
  const router = useRouter();
  const { project, savedProject, editProject, saveProject, saving, ready, dirty } = useProjectData();
  const sections = project.reportSections.filter((section) => section.sourceState !== "upstream-removed")
    .sort((left, right) => left.order.localeCompare(right.order, "zh-CN", { numeric: true }));
  const [selectedId, setSelectedId] = useState(initialChapterId ?? "section-4-2");
  const [addingSection, setAddingSection] = useState(false);
  const [newSection, setNewSection] = useState({ order: "", title: "", level: 1 as 1 | 2, description: "" });
  const [sectionError, setSectionError] = useState("");
  const [editingTopics, setEditingTopics] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [excludedSuggestions, setExcludedSuggestions] = useState<string[]>([]);
  const suggestions = showSuggestions ? suggestReportOutline(project) : [];
  const chosen = suggestions.filter((item) => !item.existingSectionId && !excludedSuggestions.includes(item.id));
  const removedSections = project.reportSections.filter((section) => section.sourceState === "upstream-removed");
  const selectedSection = sections.find((item) => item.id === selectedId) ?? sections[0];
  const updateSection = (patch: Partial<ProjectReportSection>) => {
    if (!selectedSection) return;
    editProject((current) => ({ ...current, reportSections: current.reportSections.map((item) => item.id === selectedSection.id ? { ...item, ...patch } : item) }));
  };

  async function goToCollection() {
    if (!dirty || await saveProject(4, "离开前保存报告大纲")) router.push(formatProjectStep(project.projectId, 3));
  }

  async function removeSection() {
    if (!selectedSection || !window.confirm(`从报告目录移除“${selectedSection.title}”？该章节的正文、资料引用和图表会保留，以便复核或恢复。`)) return;
    const reportSections = project.reportSections.map((item) => item.id === selectedSection.id ? { ...item, sourceState: "upstream-removed" as const } : item);
    if (await saveProject(4, "移除报告章节", { ...project, reportSections })) setSelectedId("");
  }

  async function restoreSection(id: string) {
    const reportSections = project.reportSections.map((item) => item.id === id ? { ...item, sourceState: "active" as const } : item);
    if (await saveProject(4, "恢复报告章节", { ...project, reportSections })) setSelectedId(id);
  }

  function toggleEvidence(kind: "materialIds" | "factIds", id: string) {
    if (!selectedSection) return;
    const ids = kind === "materialIds" ? sectionMaterialIds(project, selectedSection) : selectedSection.factIds ?? [];
    updateSection({ [kind]: ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id] });
  }

  async function applySuggestions() {
    const reportSections = appendSuggestedSections(project.reportSections, chosen);
    if (await saveProject(4, "采用大纲建议", { ...project, reportSections })) {
      setSelectedId(reportSections.at(-chosen.length)?.id ?? "");
      setShowSuggestions(false);
    }
  }

  function addSection() {
    const order = newSection.order.trim();
    const title = newSection.title.trim();
    if (!order || !title) {
      setSectionError("请填写章节编号和章节名称。");
      return;
    }
    if (sections.some((item) => item.order === order || item.title === title)) {
      setSectionError("章节编号或名称已存在。");
      return;
    }
    const id = `section-user-${globalThis.crypto.randomUUID()}`;
    editProject((current) => ({ ...current, reportSections: [...current.reportSections, { id, order, title, level: newSection.level, description: newSection.description.trim(), topics: [], requirementCount: 0, state: "待完善", revision: 1, sourceState: "active" }] }));
    setSelectedId(id);
    setAddingSection(false);
    setNewSection({ order: "", title: "", level: 1, description: "" });
    setSectionError("");
  }

  function toggleSectionTopic(topicName: string) {
    if (!selectedSection) return;
    updateSection({ topics: selectedSection.topics.includes(topicName) ? selectedSection.topics.filter((item) => item !== topicName) : [...selectedSection.topics, topicName] });
  }

  function confirmSectionTopics() {
    if (!selectedSection) return;
    const reportSections = project.reportSections.map((item) => item.id === selectedSection.id ? { ...item, topicReviewStatus: undefined } : item);
    return saveProject(4, "确认章节议题关联", { ...project, reportSections });
  }

  const evidence = selectedSection ? chapterEvidence(project, selectedSection.id) : undefined;

  return (
    <>
      <StepPageHeader eyebrow="Step 04 · Report outline" title="报告大纲生成与调整"
        description="结合企业画像、重要性评估和已收集资料拟定报告大纲，在章节中关联资料及事实。" />
      <SectionCard className="mb-4" title="大纲建议"
        description={project.materiality.confirmed ? "使用已确认的重要性议题、企业画像和资料，按规则生成建议。" : "重要性评估尚未确认，可根据当前纳入的议题和已收集资料生成草稿。"}
        action={<button disabled={!ready || saving} onClick={() => { setExcludedSuggestions([]); setShowSuggestions(true); }} className="rounded-lg bg-[#176b52] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">生成建议大纲</button>}>
        {showSuggestions ? <div className="space-y-3">
          <p className="text-xs leading-5 text-[#68796e]">由规则生成，适用性由用户复核。采用建议只会添加选中的新章节。</p>
          <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border border-[#e1e8e3] p-3" aria-label="大纲建议列表">
            {suggestions.map((item) => <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-[#f6f9f7] p-2.5" key={item.id}>
              <div className="min-w-0 flex-1 text-xs leading-5 text-[#53665a]">
                {item.existingSectionId ? <p className="font-semibold">{item.title} · 已有章节</p> : <label className="flex items-center gap-2 font-semibold">
                  <input type="checkbox" checked={!excludedSuggestions.includes(item.id)} onChange={() => setExcludedSuggestions((ids) => ids.includes(item.id) ? ids.filter((id) => id !== item.id) : [...ids, item.id])} className="accent-[#176b52]" />{item.title}
                </label>}
                <p className="break-words">{item.description}</p>
              </div>
              {item.existingSectionId ? <button onClick={() => { setSelectedId(item.existingSectionId ?? ""); setShowSuggestions(false); }} className="text-xs font-semibold text-[#176b52] hover:underline">打开章节</button> : null}
            </div>)}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button onClick={() => setShowSuggestions(false)} className="rounded-lg border border-[#dce3df] px-3 py-2 text-xs text-[#53665a]">关闭建议</button>
            <button disabled={!chosen.length || saving} onClick={() => void applySuggestions()} className="rounded-lg bg-[#176b52] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">采用所选建议（{chosen.length}）</button>
          </div>
        </div> : <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#53665a]">
          <span>{project.dataRequirements.length} 项资料 · {project.facts.filter(isConfirmedFact).length} 条已确认事实</span>
          <button onClick={() => void goToCollection()} disabled={saving} className="font-semibold text-[#176b52] hover:underline">返回 Step 3 补充资料</button>
        </div>}
      </SectionCard>
      <div className="grid gap-5 xl:grid-cols-[minmax(240px,0.85fr)_minmax(0,1.45fr)] animate-fade-up">
      <SectionCard
        title="报告目录"
        description="选择章节后编辑内容规划，可通过章节编号调整顺序。"
        flush
        action={<button disabled={!ready || saving} onClick={() => setAddingSection(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#edf5f1] px-3 text-[11px] font-semibold text-[#176b52]"><Plus className="size-3.5" />新增章节</button>}
      >
        <div className="border-b border-[#edf0ee] px-5 py-3 text-[10px] text-[#84908a]">共 {sections.filter((item) => item.level === 1).length} 个一级章节 · {sections.filter((item) => item.level === 2).length} 个二级章节</div>
        <div className="scrollbar-subtle max-h-[555px] overflow-y-auto p-3">
          {sections.length === 0 ? <p className="p-3 text-xs text-[#7c8981]">暂无章节，请先新增章节。</p> : null}
          {sections.map((section) => {
            const active = section.id === selectedSection?.id;
            return (
              <button
                key={section.id}
                onClick={() => setSelectedId(section.id)}
                className={`mb-1 flex w-full items-center gap-2 rounded-xl border px-3 py-3 text-left transition ${section.level === 2 ? "pl-8" : ""} ${active ? "border-[#bbd7cc] bg-[#edf5f1]" : "border-transparent hover:border-[#e4e9e6] hover:bg-[#fafcfb]"}`}
              >
                <span className={`grid size-7 shrink-0 place-items-center rounded-lg text-[10px] font-semibold ${active ? "bg-[#176b52] text-white" : "bg-[#f0f3f1] text-[#6c7872]"}`}>{section.order}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block break-words text-xs font-semibold ${active ? "text-[#174e3d]" : "text-[#344239]"}`}>{section.title}</span>
                  {needsChapterMaterials(chapterEvidence(project, section.id)) ? <span className="text-[11px] text-amber-800">待补充</span> : null}
                </span>
                <ChevronRight className={`size-3.5 shrink-0 ${active ? "text-[#176b52]" : "text-[#b3bbb7]"}`} />
              </button>
            );
          })}
        </div>
        {removedSections.length ? <details className="border-t border-[#edf0ee] p-4 text-xs">
          <summary className="cursor-pointer font-semibold text-[#53665a]">已移除章节（{removedSections.length}）</summary>
          {removedSections.map((section) => <div key={section.id} className="mt-2 flex flex-wrap justify-between gap-2"><span>{section.order} {section.title}</span><button disabled={saving} className="font-semibold text-[#176b52]" onClick={() => void restoreSection(section.id)}>恢复章节</button></div>)}
        </details> : null}
      </SectionCard>

      {selectedSection ? <SectionCard
        title="章节编辑"
        description={`正在编辑 ${selectedSection.order} ${selectedSection.title}`}
        action={selectedSection.topicReviewStatus ? <StatusBadge tone="amber">待复核</StatusBadge> : <StatusBadge tone={selectedSection.state === "已就绪" ? "green" : "amber"}>{selectedSection.state}</StatusBadge>}
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
            <div>
              <label htmlFor="section-order" className="mb-2 block text-[11px] font-semibold text-[#536159]">章节编号</label>
              <input id="section-order" value={selectedSection.order} onChange={(event) => updateSection({ order: event.target.value })} className="h-10 w-full rounded-lg border border-[#dce3df] px-3 text-xs outline-none focus:border-[#6f9f8c]" />
            </div>
            <div>
              <label htmlFor="section-title" className="mb-2 block text-[11px] font-semibold text-[#536159]">章节名称</label>
              <input id="section-title" value={selectedSection.title} onChange={(event) => updateSection({ title: event.target.value })} className="h-10 w-full rounded-lg border border-[#dce3df] px-3 text-xs outline-none focus:border-[#6f9f8c]" />
            </div>
          </div>
          <div>
            <label htmlFor="section-description" className="mb-2 block text-[11px] font-semibold text-[#536159]">章节编制说明</label>
            <textarea id="section-description" value={selectedSection.description} onChange={(event) => updateSection({ description: event.target.value })} rows={4} className="w-full resize-none rounded-lg border border-[#dce3df] px-3 py-2.5 text-xs leading-5 outline-none focus:border-[#6f9f8c]" />
          </div>

          <div className="rounded-xl border border-[#e5e9e7] bg-[#fafcfb] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold text-[#425148]">关联实质性议题</div>
              <button onClick={() => setEditingTopics((value) => !value)} className="text-[10px] font-semibold text-[#176b52]">{editingTopics ? "完成关联" : "编辑关联"}</button>
            </div>
            {editingTopics ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{project.topics.map((topic) => <label key={topic.id} className="flex items-center gap-2 rounded-lg border border-[#e1e6e3] bg-white px-3 py-2 text-[10px] text-[#4f5e56]"><input type="checkbox" checked={selectedSection.topics.includes(topic.name)} onChange={() => toggleSectionTopic(topic.name)} className="accent-[#176b52]" />{topic.category} · {topic.name}</label>)}</div> : null}
            <div className="mt-3 flex min-h-7 flex-wrap gap-2">
              {selectedSection.topics.length ? selectedSection.topics.map((topic) => <StatusBadge key={topic} tone="teal">{topic}</StatusBadge>) : <span className="text-[11px] text-[#949e99]">暂未关联议题</span>}
            </div>
            {selectedSection.topicReviewStatus ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <p>评估的议题范围、名称或评分有变化，请复核此章节的议题关联。</p>
                <button type="button" disabled={saving} onClick={() => void confirmSectionTopics()} className="font-semibold hover:underline disabled:opacity-50">确认议题关联</button>
              </div>
            ) : null}
          </div>

          {evidence ? <div className="space-y-3 rounded-xl border border-[#e1e8e3] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-[#40594a]">章节资料与事实</h3>
              {needsChapterMaterials(evidence) ? <StatusBadge tone="amber">待补充</StatusBadge> : <StatusBadge tone="green">已有资料</StatusBadge>}
            </div>
            <ul aria-label="本章关联资料" className="space-y-1 break-words text-xs leading-5 text-[#53665a]">
              {evidence.materials.map((material) => <li key={material.id}>{material.itemName} · {materialState(material)}</li>)}
              {evidence.resources.map((resource) => <li key={resource.id}>{resource.title} · {resource.confirmed ? "已确认" : "待确认"}</li>)}
              {evidence.facts.map((fact) => <li key={fact.id}>{fact.name} · {isConfirmedFact(fact) ? "已确认" : "待确认"}</li>)}
              {evidence.sources.map((source) => <li key={source.id}>来源 · {source.name}</li>)}
            </ul>
            {needsChapterMaterials(evidence) ? <button onClick={() => void goToCollection()} disabled={saving} className="text-xs font-semibold text-[#176b52] hover:underline">前往 Step 3 补充资料</button> : null}
            <details className="border-t border-[#e9eeeb] pt-3">
              <summary className="cursor-pointer text-xs font-semibold text-[#40594a]">关联或调整资料与事实</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <fieldset className="min-w-0 space-y-2">
                  <legend className="mb-2 text-xs font-semibold text-[#53665a]">资料</legend>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {project.dataRequirements.map((material) => <label key={material.id} className="flex items-start gap-2 break-words text-xs">
                      <input className="mt-0.5 accent-[#176b52]" type="checkbox" checked={evidence.materials.includes(material)} onChange={() => toggleEvidence("materialIds", material.id)} />
                      <span className="min-w-0">{material.itemName} · {materialState(material)}</span>
                    </label>)}
                    {!project.dataRequirements.length ? <p className="text-xs text-[#77867c]">Step 3 暂无资料。</p> : null}
                  </div>
                </fieldset>
                <fieldset className="min-w-0 space-y-2">
                  <legend className="mb-2 text-xs font-semibold text-[#53665a]">企业事实</legend>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {project.facts.filter((fact) => fact.sourceState !== "upstream-removed").map((fact) => <label key={fact.id} className="flex items-start gap-2 break-words text-xs">
                      <input className="mt-0.5 accent-[#176b52]" type="checkbox" checked={selectedSection.factIds?.includes(fact.id) ?? false} onChange={() => toggleEvidence("factIds", fact.id)} />
                      <span className="min-w-0">{fact.name} · {isConfirmedFact(fact) ? "已确认" : "待确认"}{evidence.facts.includes(fact) && !selectedSection.factIds?.includes(fact.id) ? " · 来自议题或资料" : ""}</span>
                    </label>)}
                    {!project.facts.length ? <p className="text-xs text-[#77867c]">事实库暂无记录。</p> : null}
                  </div>
                </fieldset>
              </div>
            </details>
          </div> : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-[#edf0ee] pt-5">
            <button disabled={!ready || saving} onClick={() => void removeSection()} className="mr-auto rounded-lg border border-rose-200 px-3 py-2 text-[11px] font-semibold text-rose-700 hover:bg-rose-50">删除章节</button>
            <button onClick={() => { const saved = savedProject.reportSections.find((item) => item.id === selectedSection.id); if (saved) updateSection(saved); }} className="h-9 rounded-lg border border-[#dce3df] bg-white px-4 text-[11px] font-semibold text-[#5a6860] hover:bg-[#f7f9f8]">取消修改</button>
            <button disabled={saving} onClick={() => void saveProject(4, `保存章节 ${selectedSection.order}`)} className="h-9 rounded-lg bg-[#176b52] px-4 text-[11px] font-semibold text-white hover:bg-[#105c46] disabled:opacity-50">保存章节</button>
          </div>
        </div>
      </SectionCard> : null}

      {addingSection ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[#10241c]/40 p-4" role="dialog" aria-modal="true" aria-labelledby="add-section-title" onMouseDown={(event) => event.target === event.currentTarget && setAddingSection(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e5e9e7] px-5 py-4"><div><h2 id="add-section-title" className="text-sm font-semibold text-[#26352d]">新增报告章节</h2><p className="mt-1 text-[10px] text-[#87918c]">保存项目后将同步创建 Step 5 章节，不会删除既有正文。</p></div><button aria-label="关闭新增章节" onClick={() => setAddingSection(false)} className="grid size-8 place-items-center rounded-lg text-[#7d8882] hover:bg-[#f2f5f3]"><X className="size-4" /></button></div>
            <div className="space-y-4 p-5"><div className="grid grid-cols-[110px_1fr] gap-3"><div><label htmlFor="new-section-order" className="mb-1.5 block text-[11px] font-semibold text-[#536159]">章节编号</label><input id="new-section-order" value={newSection.order} onChange={(event) => setNewSection({ ...newSection, order: event.target.value })} placeholder="如 8" className="h-10 w-full rounded-lg border border-[#dce3df] px-3 text-xs outline-none" /></div><div><label htmlFor="new-section-title-input" className="mb-1.5 block text-[11px] font-semibold text-[#536159]">章节名称</label><input id="new-section-title-input" value={newSection.title} onChange={(event) => setNewSection({ ...newSection, title: event.target.value })} className="h-10 w-full rounded-lg border border-[#dce3df] px-3 text-xs outline-none" /></div></div><div><label htmlFor="new-section-level" className="mb-1.5 block text-[11px] font-semibold text-[#536159]">章节层级</label><select id="new-section-level" value={newSection.level} onChange={(event) => setNewSection({ ...newSection, level: Number(event.target.value) as 1 | 2 })} className="h-10 w-full rounded-lg border border-[#dce3df] bg-white px-3 text-xs"><option value={1}>一级章节</option><option value={2}>二级章节</option></select></div><div><label htmlFor="new-section-description" className="mb-1.5 block text-[11px] font-semibold text-[#536159]">编制说明</label><textarea id="new-section-description" rows={3} value={newSection.description} onChange={(event) => setNewSection({ ...newSection, description: event.target.value })} className="w-full rounded-lg border border-[#dce3df] px-3 py-2 text-xs outline-none" /></div>{sectionError ? <p role="alert" className="text-[10px] text-rose-600">{sectionError}</p> : null}</div>
            <div className="flex justify-end gap-2 border-t border-[#e5e9e7] bg-[#fafbf9] px-5 py-4"><button onClick={() => setAddingSection(false)} className="h-9 rounded-lg border border-[#dce3df] px-4 text-[11px] font-semibold text-[#5b6861]">取消</button><button onClick={addSection} className="h-9 rounded-lg bg-[#176b52] px-4 text-[11px] font-semibold text-white">创建章节</button></div>
          </div>
        </div>
      ) : null}
      </div>
      <StepFooter currentStep={4} />
    </>
  );
}
