"use client";

import { useState, type FormEvent } from "react";
import { BookOpen, ChevronRight, ClipboardList, PencilLine, Plus, X } from "lucide-react";
import type { DataRequirement } from "@/lib/types/esg";
import type { ProjectDataRequirement } from "@/lib/types/project-data";
import { departments } from "@/lib/data/mock-data";
import { useProjectData } from "@/components/project/project-data-provider";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { StepFooter } from "@/components/workbench/step-footer";
import { StepPageHeader } from "@/components/workbench/step-page-header";

type Tab = "outline" | "materials";

const tabs = [
  { id: "outline", label: "报告目录", icon: BookOpen },
  { id: "materials", label: "年度资料清单", icon: ClipboardList },
] as const;

function ReportOutline({ initialChapterId }: { initialChapterId?: string }) {
  const { project, savedProject, editProject, saveProject, saving } = useProjectData();
  const sections = project.reportSections.filter((section) => section.sourceState !== "upstream-removed");
  const [selectedId, setSelectedId] = useState(initialChapterId ?? "section-4-2");
  const [addingSection, setAddingSection] = useState(false);
  const [newSection, setNewSection] = useState({ order: "", title: "", level: 1 as 1 | 2, description: "" });
  const [sectionError, setSectionError] = useState("");
  const [editingTopics, setEditingTopics] = useState(false);
  const selectedSection = sections.find((item) => item.id === selectedId) ?? sections[0];
  const updateSection = (patch: Partial<typeof selectedSection>) => {
    if (!selectedSection) return;
    editProject((current) => ({ ...current, reportSections: current.reportSections.map((item) => item.id === selectedSection.id ? { ...item, ...patch } : item) }));
  };

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
    return saveProject(3, "确认章节议题关联", { ...project, reportSections });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.92fr)_minmax(480px,1.35fr)] animate-fade-up">
      <SectionCard
        title="报告目录"
        description="选择章节后编辑内容规划，可通过章节编号调整顺序。"
        flush
        action={<button onClick={() => setAddingSection(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#edf5f1] px-3 text-[11px] font-semibold text-[#176b52]"><Plus className="size-3.5" />新增章节</button>}
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
                  <span className={`block truncate text-xs font-semibold ${active ? "text-[#174e3d]" : "text-[#344239]"}`}>{section.title}</span>
                </span>
                <ChevronRight className={`size-3.5 shrink-0 ${active ? "text-[#176b52]" : "text-[#b3bbb7]"}`} />
              </button>
            );
          })}
        </div>
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

          <div className="flex justify-end gap-2 border-t border-[#edf0ee] pt-5">
            <button onClick={() => { const saved = savedProject.reportSections.find((item) => item.id === selectedSection.id); if (saved) updateSection(saved); }} className="h-9 rounded-lg border border-[#dce3df] bg-white px-4 text-[11px] font-semibold text-[#5a6860] hover:bg-[#f7f9f8]">取消修改</button>
            <button disabled={saving} onClick={() => void saveProject(3, `保存章节 ${selectedSection.order}`)} className="h-9 rounded-lg bg-[#176b52] px-4 text-[11px] font-semibold text-white hover:bg-[#105c46] disabled:opacity-50">保存章节</button>
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
  );
}

type MaterialDraft = Pick<DataRequirement, "itemName" | "section" | "type" | "responsibleDepartment" | "collectionMethod" | "dueDate"> & { id?: string };

const materialTypes: DataRequirement["type"][] = ["定量数据", "定性说明", "制度文件", "案例"];
const collectionMethods: DataRequirement["collectionMethod"][] = ["文件上传", "在线补充", "现有Excel"];
const materialField = "h-9 w-full min-w-0 rounded-lg border border-[#dce3df] bg-white px-3 text-xs text-[#36453c] outline-none focus:border-[#6f9f8c]";

function MaterialsList() {
  const { project, ready, saving, saveProject } = useProjectData();
  const [draft, setDraft] = useState<MaterialDraft | null>(null);
  const [error, setError] = useState("");
  const items = project.dataRequirements;
  const sectionLabels = [...new Set(project.reportSections.filter((item) => item.sourceState !== "upstream-removed").map((item) => `${item.order} ${item.title}`))];

  function openEditor(item?: ProjectDataRequirement) {
    setError("");
    setDraft(item ? {
      id: item.id, itemName: item.itemName, section: item.section, type: item.type,
      responsibleDepartment: item.responsibleDepartment, collectionMethod: item.collectionMethod, dueDate: item.dueDate,
    } : { itemName: "", section: "", type: "定性说明", responsibleDepartment: "", collectionMethod: "文件上传", dueDate: "" });
  }

  async function saveMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || saving || !ready) return;
    const { id, ...fields } = draft;
    const itemName = fields.itemName.trim();
    if (!itemName) { setError("请填写资料名称。"); return; }
    const existing = items.find((item) => item.id === id);
    const suggestedDepartment = existing?.suggestedDepartment ?? "";
    const state = existing?.state ?? "待分工";
    const next: ProjectDataRequirement = {
      ...existing, ...fields, itemName, id: existing?.id ?? `data-user-${globalThis.crypto.randomUUID()}`,
      suggestedDepartment, adjustedByUser: Boolean(fields.responsibleDepartment && fields.responsibleDepartment !== suggestedDepartment),
      state: state === "待分工" && fields.responsibleDepartment ? "待收集" : state,
      revision: existing?.revision ?? 1, reviewStatus: existing?.reviewStatus ?? "待复核",
    };
    const dataRequirements = existing ? items.map((item) => item.id === existing.id ? next : item) : [...items, next];
    setError("");
    if (await saveProject(3, "保存年度资料清单", { ...project, dataRequirements })) setDraft(null);
    else setError("资料项未保存，请查看项目提示后重试。");
  }

  return (
    <SectionCard
      title="年度资料清单"
      description="按报告目录整理本年度所需资料。保存后，Step 4 会读取这些资料任务。"
      action={<button type="button" disabled={!ready || saving || Boolean(draft)} onClick={() => openEditor()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#edf5f1] px-3 text-xs font-semibold text-[#176b52] disabled:opacity-50"><Plus className="size-4" />新增资料项</button>}
      flush
    >
      {draft ? (
        <form onSubmit={(event) => void saveMaterial(event)} aria-label={draft.id ? "编辑资料项" : "新增资料项"} className="border-b border-[#e5e9e7] bg-[#f8fbf9] p-5 sm:p-6">
          <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="material-name" className="block text-xs font-semibold">资料名称</label>
              <input id="material-name" required value={draft.itemName} onChange={(event) => setDraft({ ...draft, itemName: event.target.value })} className={materialField} />
            </div>
            <div className="space-y-1">
              <label htmlFor="material-section" className="block text-xs font-semibold">对应章节</label>
              <select id="material-section" value={draft.section} onChange={(event) => setDraft({ ...draft, section: event.target.value })} className={materialField}>
                <option value="">未关联章节</option>
                {draft.section && !sectionLabels.includes(draft.section) ? <option value={draft.section}>{draft.section}（历史记录）</option> : null}
                {sectionLabels.map((label) => <option key={label}>{label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="material-type" className="block text-xs font-semibold">资料类型</label>
              <select id="material-type" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as DataRequirement["type"] })} className={materialField}>
                {materialTypes.map((type) => <option key={type}>{type}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="material-department" className="block text-xs font-semibold">责任部门</label>
              <select id="material-department" value={draft.responsibleDepartment} onChange={(event) => setDraft({ ...draft, responsibleDepartment: event.target.value })} className={materialField}>
                <option value="">待分工</option>
                {draft.responsibleDepartment && !departments.includes(draft.responsibleDepartment) ? <option>{draft.responsibleDepartment}</option> : null}
                {departments.map((department) => <option key={department}>{department}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="material-method" className="block text-xs font-semibold">收集方式</label>
              <select id="material-method" value={draft.collectionMethod} onChange={(event) => setDraft({ ...draft, collectionMethod: event.target.value as DataRequirement["collectionMethod"] })} className={materialField}>
                {collectionMethods.map((method) => <option key={method}>{method}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="material-due" className="block text-xs font-semibold">截止日期</label>
              <input id="material-due" type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} className={materialField} />
            </div>
          </fieldset>
          {error ? <p role="alert" className="mt-3 text-xs text-rose-700">{error}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" disabled={saving} onClick={() => setDraft(null)} className="h-9 rounded-lg border border-[#dce3df] bg-white px-4 text-xs font-semibold text-[#5a6860] disabled:opacity-50">取消</button>
            <button type="submit" disabled={saving} className="h-9 rounded-lg bg-[#176b52] px-4 text-xs font-semibold text-white disabled:opacity-50">{saving ? "保存中…" : "保存资料项"}</button>
          </div>
        </form>
      ) : null}
      <div className="scrollbar-subtle overflow-x-auto">
        <table className="workbench-data-table">
          <thead className="bg-[#fafbf9] text-[#536159]"><tr>
            {['资料名称', '对应章节', '资料类型', '责任部门', '收集方式', '截止日期', '状态', '操作'].map((label) => <th key={label} scope="col" className="border-b border-[#e7ebe9] px-4 py-3.5">{label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-[#edf0ee] text-[#4d5b54]">
            {items.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center">暂无资料项，可按报告需要新增。</td></tr> : null}
            {items.map((item) => <tr key={item.id}>
              <td className="px-4 py-4 font-semibold">{item.itemName}</td>
              <td className="px-4 py-4">{item.section || "未关联章节"}</td>
              <td className="px-4 py-4">{item.type}</td>
              <td className="px-4 py-4">{item.responsibleDepartment || "待分工"}</td>
              <td className="px-4 py-4">{item.collectionMethod}</td>
              <td className="px-4 py-4 tabular-nums">{item.dueDate || "—"}</td>
              <td className="px-4 py-4"><StatusBadge tone="gray">{item.state}</StatusBadge></td>
              <td className="px-4 py-4"><button type="button" disabled={saving || Boolean(draft)} aria-label={`编辑${item.itemName}`} onClick={() => openEditor(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#dce3df] px-3 py-1.5 text-xs font-semibold text-[#176b52] disabled:opacity-50"><PencilLine className="size-3.5" />编辑</button></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

export function StepThree({ initialChapterId }: { initialChapterId?: string }) {
  const { saving } = useProjectData();
  const [activeTab, setActiveTab] = useState<Tab>("outline");

  return (
    <>
      <StepPageHeader
        eyebrow="Step 3 · 大纲与资料"
        title="构建报告大纲与年度资料清单"
        description="组织报告章节、关联重要性议题，并维护本年度需要收集的资料。"
      />
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-[#e0e6e2] bg-white p-1.5" aria-label="Step 3 模块" role="group">
        {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={id === activeTab} disabled={saving} onClick={() => setActiveTab(id)} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold ${id === activeTab ? "bg-[#edf5f1] text-[#176b52]" : "text-[#67736d] hover:bg-[#f6f8f7]"}`}><Icon className="size-4" />{label}</button>)}
      </div>
      {activeTab === "outline" ? <ReportOutline initialChapterId={initialChapterId} /> : <MaterialsList />}
      <StepFooter currentStep={3} />
    </>
  );
}
