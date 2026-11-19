"use client";

import { useState, type FormEvent } from "react";
import { Building2, Plus, Search, X } from "lucide-react";
import { useProjectData } from "@/components/project/project-data-provider";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { confirmQuantitativeMaterial, materialSources, materialState, materialTopicNames, sectionMaterialIds } from "@/lib/project/materials";
import type { ProjectDataRequirement, ProjectDepartment, QuantitativeMaterial } from "@/lib/types/project-data";

type MaterialCategory = "qualitative" | "quantitative";
const types: ProjectDataRequirement["type"][] = ["定性说明", "制度文件", "案例", "定量数据"];
const methods: ProjectDataRequirement["collectionMethod"][] = ["文件上传", "在线补充", "现有Excel"];
const states = ["待收集", "收集中", "待确认", "已确认"] as const;
const tones = { 待收集: "gray", 收集中: "blue", 待确认: "amber", 已确认: "green" } as const;
const field = "mt-1.5 h-9 w-full min-w-0 rounded-lg border border-[#dce3df] bg-white px-2.5 text-xs text-[#36453c] outline-none focus:border-[#6f9f8c]";
const secondary = "whitespace-nowrap rounded-lg border border-[#dce3df] bg-white px-3 py-2 text-xs font-semibold text-[#51665a] hover:bg-[#f2f7f4] disabled:opacity-50";
const primary = "whitespace-nowrap rounded-lg bg-[#176b52] px-3 py-2 text-xs font-semibold text-white hover:bg-[#105c46] disabled:opacity-50";
const numericFields = [
  ["value", "数值"], ["unit", "单位"], ["period", "统计期间"], ["boundary", "统计范围"], ["locator", "来源位置"],
] as const;

function categoryOf(item: ProjectDataRequirement): MaterialCategory {
  return item.type === "定量数据" ? "quantitative" : "qualitative";
}

function createMaterial(category: MaterialCategory): ProjectDataRequirement {
  return {
    id: `material-${crypto.randomUUID()}`, itemName: "", section: "",
    type: category === "quantitative" ? "定量数据" : "定性说明", suggestedDepartment: "",
    responsibleDepartment: "", adjustedByUser: false, collectionMethod: "文件上传",
    state: "待收集", dueDate: "", revision: 1, reviewStatus: "有效",
  };
}

function toggle(ids: string[] | undefined, id: string) {
  return ids?.includes(id) ? ids.filter((item) => item !== id) : [...(ids ?? []), id];
}

function DepartmentManager({ onClose }: { onClose: () => void }) {
  const { project, saving, saveProject } = useProjectData();
  const departments = project.departments ?? [];
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function saveDepartment(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || departments.some((item) => item.id !== selectedId && item.name === trimmed)) {
      setError("请输入未使用的部门名称。");
      return;
    }
    const existing = departments.find((item) => item.id === selectedId);
    const nextDepartment: ProjectDepartment = { id: existing?.id ?? `department-${crypto.randomUUID()}`, name: trimmed };
    const nextDepartments = existing
      ? departments.map((item) => item.id === existing.id ? nextDepartment : item)
      : [...departments, nextDepartment];
    const dataRequirements = existing ? project.dataRequirements.map((item) => (
      item.departmentId === existing.id || (!item.departmentId && item.responsibleDepartment === existing.name)
        ? { ...item, departmentId: existing.id, responsibleDepartment: trimmed, adjustedByUser: trimmed !== item.suggestedDepartment }
        : item
    )) : project.dataRequirements;
    if (await saveProject(3, existing ? "修改部门名称" : "新增项目部门", { ...project, departments: nextDepartments, dataRequirements })) {
      setSelectedId("");
      setName("");
      setError("");
    }
  }

  return <SectionCard title="项目部门管理" action={<button className={secondary} onClick={onClose}>关闭部门管理</button>}>
    <form onSubmit={(event) => void saveDepartment(event)} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <label className="min-w-0 text-xs font-medium">部门操作
        <select aria-label="部门操作" className={field} value={selectedId} onChange={(event) => {
          setSelectedId(event.target.value);
          setName(departments.find((item) => item.id === event.target.value)?.name ?? "");
          setError("");
        }}>
          <option value="">新增部门</option>
          {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
        </select>
      </label>
      <label className="min-w-0 text-xs font-medium">部门名称
        <input autoFocus required maxLength={80} className={field} value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <button disabled={saving} className={primary}>保存部门</button>
      {error ? <p role="alert" className="text-xs text-rose-700 sm:col-span-3">{error}</p> : null}
    </form>
  </SectionCard>;
}

type MaterialEditorProps = {
  item: ProjectDataRequirement;
  onClose: () => void;
  onSaved: (category: MaterialCategory) => void;
  onReviewSource: (sourceId: string) => void;
};

function MaterialEditor({ item, onClose, onSaved, onReviewSource }: MaterialEditorProps) {
  const { project, saving, saveProject } = useProjectData();
  const [draft, setDraft] = useState(item);
  const [details, setDetails] = useState<QuantitativeMaterial>({
    value: "", unit: "", period: "", boundary: "", locator: "", ...item.quantitative,
  });
  const [error, setError] = useState("");
  const departments = project.departments ?? [];
  const ownerId = draft.departmentId ?? departments.find((department) => department.name === draft.responsibleDepartment)?.id ?? "";
  const stored = project.dataRequirements.find((material) => material.id === item.id);
  const sources = stored ? materialSources(project, stored) : [];
  const resources = project.resources.filter((resource) => resource.sourceReferences.some((reference) => sources.some((source) => source.id === reference.sourceId)));
  const linkedChapters = project.reportSections.filter((section) => section.sourceState === "active" && sectionMaterialIds(project, section).includes(item.id));
  const onlineResources = resources.filter((resource) => resource.sourceReferences.some((reference) => sources.some((source) => source.kind === "online" && source.id === reference.sourceId)));
  const hasReviewableSource = sources.some((source) => source.fileId && source.fileStatus === "available" && source.parserStatus !== "stale")
    || onlineResources.some((resource) => resource.description.trim());
  const hasDraftChanges = JSON.stringify(draft) !== JSON.stringify(item)
    || numericFields.some(([key]) => details[key] !== (item.quantitative?.[key] ?? ""))
    || details.sourceId !== item.quantitative?.sourceId;

  async function saveMaterial(event: FormEvent) {
    event.preventDefault();
    const itemName = draft.itemName.trim();
    if (!itemName) { setError("请填写资料名称。"); return; }
    const quantitative = draft.type === "定量数据" ? {
      value: details.value.trim(), unit: details.unit.trim(), period: details.period.trim(),
      boundary: details.boundary.trim(), sourceId: details.sourceId || undefined, locator: details.locator.trim(),
    } : draft.quantitative;
    const responsibleDepartment = departments.find((department) => department.id === ownerId)?.name ?? "";
    const evidenceChanged = Boolean(stored && (itemName !== stored.itemName || draft.type !== stored.type
      || JSON.stringify(quantitative) !== JSON.stringify(stored.quantitative)
      || JSON.stringify(draft.sourceIds ?? []) !== JSON.stringify(stored.sourceIds ?? [])));
    const recheck = evidenceChanged && materialState(draft) === "已确认";
    const material: ProjectDataRequirement = {
      ...draft, itemName, quantitative, departmentId: ownerId || undefined, responsibleDepartment,
      adjustedByUser: responsibleDepartment !== draft.suggestedDepartment,
      collaboratorDepartmentIds: draft.collaboratorDepartmentIds?.filter((id) => id !== ownerId),
      ...(recheck ? { state: "待确认", reviewStatus: "待复核" } : {}),
    };
    const dataRequirements = stored ? project.dataRequirements.map((entry) => entry.id === stored.id ? material : entry) : [...project.dataRequirements, material];
    if (await saveProject(3, "保存资料", { ...project, dataRequirements })) onSaved(categoryOf(material));
  }

  async function confirmMaterial() {
    if (!stored || hasDraftChanges) return;
    if (!window.confirm(`请确认已核对“${stored.itemName}”的原始来源及范围。`)) return;
    try {
      let next: typeof project;
      if (stored.type === "定量数据" && stored.quantitative?.value) {
        next = confirmQuantitativeMaterial(project, stored);
      } else {
        const confirmedAt = new Date().toISOString();
        next = {
          ...project,
          dataRequirements: project.dataRequirements.map((entry) => entry.id === stored.id
            ? { ...entry, state: "已确认", reviewStatus: "有效", confirmedAt } : entry),
          resources: project.resources.map((resource) => !resource.confirmed && onlineResources.includes(resource) ? {
            ...resource, confirmed: true, confirmedAt, confirmedBy: "当前用户（人工确认）", revision: resource.revision + 1,
          } : resource),
        };
      }
      if (await saveProject(3, "人工确认资料", next)) onSaved(categoryOf(stored));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "资料确认失败。");
    }
  }

  return <SectionCard title={stored ? "资料详情与编辑" : "新增资料"} action={<button onClick={onClose} className={secondary} aria-label="关闭资料编辑"><X className="size-4" /></button>}>
    <form className="space-y-4" onSubmit={(event) => void saveMaterial(event)}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs font-medium sm:col-span-2">资料名称<input autoFocus className={field} required maxLength={160} value={draft.itemName} onChange={(event) => setDraft({ ...draft, itemName: event.target.value })} /></label>
        <label className="text-xs font-medium">资料类型<select aria-label="资料类型" className={field} value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as ProjectDataRequirement["type"] })}>{types.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label className="text-xs font-medium">主要负责部门<select aria-label="主要负责部门" className={field} value={ownerId} onChange={(event) => setDraft({ ...draft, departmentId: event.target.value, responsibleDepartment: departments.find((department) => department.id === event.target.value)?.name ?? "" })}><option value="">待分工</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
        <label className="text-xs font-medium">收集方式<select aria-label="收集方式" className={field} value={draft.collectionMethod} onChange={(event) => setDraft({ ...draft, collectionMethod: event.target.value as ProjectDataRequirement["collectionMethod"] })}>{methods.map((method) => <option key={method}>{method}</option>)}</select></label>
        <label className="text-xs font-medium">收集状态<select aria-label="收集状态" className={field} value={materialState(draft)} onChange={(event) => setDraft({ ...draft, state: event.target.value as ProjectDataRequirement["state"], confirmedAt: undefined })}>
          {states.filter((state) => state !== "已确认" || materialState(draft) === "已确认").map((state) => <option key={state}>{state}</option>)}
        </select></label>
        <label className="text-xs font-medium">截止日期<input type="date" className={field} value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} /></label>
      </div>

      <fieldset className="rounded-lg border border-[#e1e8e3] p-3">
        <legend className="px-1 text-xs font-semibold text-[#51665a]">协作部门</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {departments.filter((department) => department.id !== ownerId).map((department) => <label key={department.id} className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={draft.collaboratorDepartmentIds?.includes(department.id) ?? false} onChange={() => setDraft({ ...draft, collaboratorDepartmentIds: toggle(draft.collaboratorDepartmentIds, department.id) })} className="accent-[#176b52]" />{department.name}
          </label>)}
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-[#e1e8e3] p-3">
        <legend className="px-1 text-xs font-semibold text-[#51665a]">关联 ESG 议题</legend>
        <div className="grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {project.topics.map((topic) => <label key={topic.id} className="flex items-start gap-2 text-xs">
            <input type="checkbox" checked={draft.topicIds?.includes(topic.id) ?? false} onChange={() => setDraft({ ...draft, topicIds: toggle(draft.topicIds, topic.id) })} className="mt-0.5 accent-[#176b52]" />
            <span>{topic.name}{project.materiality.confirmed && project.materiality.includedTopicIds.includes(topic.id) ? <span className="ml-1 text-[#667d70]">· 已确认评估</span> : null}</span>
          </label>)}
        </div>
      </fieldset>

      {draft.type === "定量数据" ? <fieldset className="grid gap-3 rounded-lg border border-[#e1e8e3] p-3 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="px-1 text-xs font-semibold text-[#51665a]">定量记录</legend>
        {numericFields.map(([key, label]) => <label className="min-w-0 text-xs font-medium" key={key}>{label}
          <input className={field} inputMode={key === "value" ? "decimal" : undefined} value={details[key]} onChange={(event) => setDetails({ ...details, [key]: event.target.value })} />
        </label>)}
        <label className="min-w-0 text-xs font-medium">来源文件或表单<select aria-label="来源文件或表单" className={field} value={details.sourceId ?? ""} onChange={(event) => setDetails({ ...details, sourceId: event.target.value || undefined })}>
          <option value="">待补充来源</option>{project.sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
        </select></label>
      </fieldset> : null}

      {project.sources.some((source) => source.materialId !== item.id) ? <details className="rounded-lg border border-[#e1e8e3] p-3">
        <summary className="cursor-pointer text-xs font-semibold text-[#51665a]">关联已有来源</summary>
        <div className="mt-2 grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2">
          {project.sources.filter((source) => source.materialId !== item.id).map((source) => <label key={source.id} className="flex items-start gap-2 break-all text-xs">
            <input type="checkbox" checked={draft.sourceIds?.includes(source.id) ?? false} onChange={() => setDraft({ ...draft, sourceIds: toggle(draft.sourceIds, source.id) })} className="mt-0.5 accent-[#176b52]" />{source.name}
          </label>)}
        </div>
      </details> : null}

      {stored ? <div className="space-y-2 rounded-lg bg-[#f5f8f6] p-3 text-xs leading-5">
        <p>关联章节 · {linkedChapters.map((section) => section.title).join("、") || "暂未关联"}</p>
        {!linkedChapters.length && stored.section ? <p>历史章节记录 · {stored.section}</p> : null}
        {sources.length ? <ul className="space-y-1">{sources.map((source) => <li key={source.id} className="flex flex-wrap items-center justify-between gap-2 break-all">
          {source.name}{source.fileId ? <button type="button" className="font-semibold text-[#176b52] hover:underline" onClick={() => onReviewSource(source.id)}>查阅原文件</button> : null}
        </li>)}</ul> : <p>尚未添加来源。</p>}
        {resources.map((resource) => <details key={resource.id}><summary className="cursor-pointer font-semibold">{resource.title} · {resource.confirmed ? "已确认" : "待确认"}</summary><p className="mt-1 whitespace-pre-wrap break-words">{resource.description}</p></details>)}
      </div> : null}

      {error ? <p role="alert" className="text-xs text-rose-700">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onClose} className={secondary}>取消编辑</button>
        {stored && hasReviewableSource && materialState(stored) !== "已确认" ? <button type="button" onClick={() => void confirmMaterial()} disabled={hasDraftChanges || saving} className={secondary}>人工确认资料</button> : null}
        <button disabled={saving} className={primary}>保存资料</button>
      </div>
    </form>
  </SectionCard>;
}

export function MaterialsWorkspace({ onIntake, onReviewSource }: {
  onIntake: (mode: "upload" | "online", materialId: string) => void;
  onReviewSource: (sourceId: string) => void;
}) {
  const { project, ready, saving } = useProjectData();
  const [category, setCategory] = useState<MaterialCategory>("qualitative");
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<ProjectDataRequirement>();
  const [departmentManager, setDepartmentManager] = useState(false);
  const departments = project.departments ?? [];
  const materialTopics = (item: ProjectDataRequirement) => materialTopicNames(project, item).join("、");
  const collaborators = (item: ProjectDataRequirement) => departments.filter((entry) => item.collaboratorDepartmentIds?.includes(entry.id)).map((entry) => entry.name);
  const search = query.trim().toLocaleLowerCase();
  const visible = project.dataRequirements.filter((item) => categoryOf(item) === category
    && (!department || item.departmentId === department || item.collaboratorDepartmentIds?.includes(department) || (!item.departmentId && departments.find((entry) => entry.id === department)?.name === item.responsibleDepartment))
    && (!topic || item.topicIds?.includes(topic))
    && (!status || materialState(item) === status)
    && (!search || [item.itemName, item.section, item.responsibleDepartment, materialTopics(item), ...collaborators(item)].join(" ").toLocaleLowerCase().includes(search)));
  const selectCategory = (next: MaterialCategory) => { setCategory(next); setEditing(undefined); };

  return <div className="min-w-0 space-y-4">
    {departmentManager ? <DepartmentManager onClose={() => setDepartmentManager(false)} /> : null}
    {editing ? <MaterialEditor key={editing.id} item={editing} onClose={() => setEditing(undefined)} onSaved={selectCategory} onReviewSource={onReviewSource} /> : null}
    <SectionCard title="年度资料清单" action={<div className="flex flex-wrap gap-2">
      <button disabled={!ready || saving} className={secondary} onClick={() => { setDepartmentManager(!departmentManager); setEditing(undefined); }}><Building2 className="mr-1 inline size-3.5" />管理部门</button>
      <button disabled={!ready || saving} className={primary} onClick={() => { setEditing(createMaterial(category)); setDepartmentManager(false); }}><Plus className="mr-1 inline size-3.5" />新增资料</button>
    </div>} flush>
      <div className="space-y-3 px-5 py-4">
        <div className="inline-flex gap-1 rounded-lg bg-[#f1f5f2] p-1" role="group" aria-label="资料分类">
          {([["qualitative", "定性资料"], ["quantitative", "定量资料"]] as const).map(([id, label]) => (
            <button key={id} aria-pressed={category === id} onClick={() => selectCategory(id)} className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold ${category === id ? "bg-[#173e31] text-white" : "text-[#54685c] hover:bg-white"}`}>{label} <span className="ml-0.5 tabular-nums">{project.dataRequirements.filter((item) => categoryOf(item) === id).length}</span></button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-medium">部门筛选<select aria-label="部门筛选" className={field} value={department} onChange={(event) => setDepartment(event.target.value)}><option value="">所有部门</option>{departments.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
          <label className="text-xs font-medium">议题筛选<select aria-label="议题筛选" className={field} value={topic} onChange={(event) => setTopic(event.target.value)}><option value="">所有 ESG 议题</option>{project.topics.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
          <label className="text-xs font-medium">状态筛选<select aria-label="状态筛选" className={field} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">所有状态</option>{states.map((state) => <option key={state}>{state}</option>)}</select></label>
          <label className="relative text-xs font-medium">搜索资料任务<Search className="pointer-events-none absolute bottom-2.5 right-2.5 size-4 text-[#738279]" /><input className={`${field} pr-8`} value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="搜索名称或关键词" /></label>
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-subtle" tabIndex={0} role="region" aria-label="资料列表">
        <table className="workbench-data-table">
          <thead className="bg-[#f8faf9] text-[#55655c]"><tr>
            {["资料名称", "资料类型", "关联议题", "负责部门", "收集方式", "状态", "操作"].map((label) => <th className="px-4 py-3" key={label} scope="col">{label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-[#edf0ee]">
            {visible.map((item) => <tr key={item.id} className="text-[#526259] hover:bg-[#f8faf8]">
              <td className="px-4 py-3 font-semibold text-[#253a2d]">{item.itemName}</td>
              <td className="px-4 py-3">{item.type}</td>
              <td className="px-4 py-3">{materialTopics(item) || "待关联"}</td>
              <td className="px-4 py-3">{item.responsibleDepartment || "待分工"}{collaborators(item).length ? <p className="mt-1 text-[#6c8073]">协作 · {collaborators(item).join("、")}</p> : null}</td>
              <td className="px-4 py-3">{item.collectionMethod}</td>
              <td className="px-4 py-3"><StatusBadge tone={tones[materialState(item)]}>{materialState(item)}</StatusBadge></td>
              <td className="space-x-3 px-4 py-3">
                <button className="font-semibold text-[#176b52] hover:underline" onClick={() => { setEditing(item); setDepartmentManager(false); }}>详情与编辑</button>
                <button className="text-[#506a5b] hover:underline" onClick={() => onIntake("upload", item.id)}>上传</button>
                <button className="text-[#506a5b] hover:underline" onClick={() => onIntake("online", item.id)}>在线补充</button>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {!visible.length ? <p className="border-t border-[#edf0ee] px-5 py-6 text-xs text-[#667a6e]">当前筛选下暂无资料。</p> : null}
    </SectionCard>
  </div>;
}
