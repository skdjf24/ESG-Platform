"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  GripVertical,
  Layers3,
  Link2,
  ListFilter,
  PencilLine,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type { Applicability } from "@/lib/types/esg";
import { useProjectData } from "@/components/project/project-data-provider";
import { Notice } from "@/components/ui/notice";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { StepFooter } from "@/components/workbench/step-footer";
import { StepPageHeader } from "@/components/workbench/step-page-header";

type Tab = "requirements" | "outline" | "materials";

const tabs: Array<{ id: Tab; label: string; detail: string; icon: typeof Layers3 }> = [
  { id: "requirements", label: "披露要求矩阵", detail: "58 项要求", icon: Layers3 },
  { id: "outline", label: "报告目录", detail: "7 个章节", icon: BookOpen },
  { id: "materials", label: "年度资料清单", detail: "32 项资料", icon: ClipboardList },
];

function TabNavigation({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  return (
    <div className="mb-5 overflow-x-auto rounded-xl border border-[#e0e6e2] bg-white p-1.5">
      <div className="grid min-w-[650px] grid-cols-3 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex items-center justify-center gap-3 rounded-lg px-4 py-2.5 text-left transition ${selected ? "bg-[#edf5f1] text-[#176b52] shadow-[inset_0_0_0_1px_rgba(23,107,82,.06)]" : "text-[#67736d] hover:bg-[#f6f8f7]"}`}
            >
              <Icon className="size-4 shrink-0" />
              <span>
                <span className="block text-xs font-semibold">{tab.label}</span>
                <span className={`mt-0.5 block text-[10px] ${selected ? "text-[#548574]" : "text-[#9aa29e]"}`}>{tab.detail}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RequirementsMatrix({ initialRequirementId }: { initialRequirementId?: string }) {
  const { project, editProject } = useProjectData();
  const requirements = project.disclosureRequirements;
  const sections = project.reportSections.filter((item) => item.sourceState === "active");
  const [search, setSearch] = useState(() => requirements.find((item) => item.id === initialRequirementId)?.code ?? "");
  const [framework, setFramework] = useState("全部框架");

  useEffect(() => {
    if (!initialRequirementId) return;
    const requirement = requirements.find((item) => item.id === initialRequirementId);
    if (requirement) {
      requestAnimationFrame(() => document.getElementById(`requirement-${initialRequirementId}`)?.scrollIntoView({ block: "center" }));
    }
  }, [initialRequirementId, requirements]);

  const filteredRequirements = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requirements.filter((item) => {
      const frameworkMatches = framework === "全部框架" || item.framework === framework;
      const queryMatches = !query || `${item.framework}${item.code}${item.topic}${item.summary}${item.mappedSection}`.toLowerCase().includes(query);
      return frameworkMatches && queryMatches;
    });
  }, [framework, requirements, search]);

  const updateDecision = (id: string, value: Applicability) => {
    editProject((current) => ({ ...current, disclosureRequirements: current.disclosureRequirements.map((item) => item.id === id ? { ...item, applicability: value, userConfirmed: false, reviewStatus: "待复核" } : item) }));
  };

  const confirmDecision = (id: string) => {
    editProject((current) => ({ ...current, disclosureRequirements: current.disclosureRequirements.map((item) => item.id === id ? { ...item, userConfirmed: true, reviewStatus: "有效" } : item) }));
  };

  const updateMapping = (id: string, mappedSection: string) => {
    editProject((current) => {
      const nextRequirements = current.disclosureRequirements.map((item) => item.id === id ? { ...item, mappedSection, userConfirmed: false, reviewStatus: "待复核" as const } : item);
      return {
        ...current,
        disclosureRequirements: nextRequirements,
        reportSections: current.reportSections.map((section) => ({
          ...section,
          requirementCount: nextRequirements.filter((item) => item.mappedSection === `${section.order} ${section.title}`).length,
        })),
      };
    });
  };

  const pendingCount = requirements.filter((item) => !item.userConfirmed).length;

  return (
    <div className="space-y-5 animate-fade-up">
      <Notice tone="warning" title="适用性须由用户确认">
        系统仅根据已选框架和企业画像提供适用性建议，不会替企业作出结论；请逐项核对并确认。
      </Notice>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "披露要求", value: String(requirements.length), note: `来自 ${new Set(requirements.map((item) => item.framework)).size} 项框架`, icon: Layers3, tone: "bg-[#edf5f1] text-[#176b52]" },
          { label: "建议适用", value: String(requirements.filter((item) => item.systemSuggestion === "适用").length), note: "系统建议，非最终结论", icon: Sparkles, tone: "bg-violet-50 text-violet-600" },
          { label: "待用户确认", value: String(pendingCount), note: "需人工作出适用性判断", icon: PencilLine, tone: "bg-amber-50 text-amber-600" },
          { label: "已映射章节", value: String(requirements.filter((item) => item.mappedSection.trim()).length), note: "可由用户调整对应目录", icon: Link2, tone: "bg-blue-50 text-blue-600" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-4 rounded-xl border border-[#e3e8e5] bg-white p-4">
            <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${item.tone}`}><item.icon className="size-[18px]" /></span>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2"><span className="text-xl font-semibold text-[#1c2922]">{item.value}</span><span className="text-xs font-semibold text-[#526159]">{item.label}</span></div>
              <p className="mt-0.5 truncate text-[10px] text-[#8b9590]">{item.note}</p>
            </div>
          </div>
        ))}
      </div>

      <SectionCard
        title="披露要求矩阵"
        description="核对每项要求的适用性，并确认与报告章节的映射关系。"
        flush
        action={
          <button className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dce3df] bg-white px-3 text-[11px] font-semibold text-[#5a6860] hover:bg-[#f6f8f7]">
            <Download className="size-3.5" />导出矩阵
          </button>
        }
      >
        <div className="flex flex-col gap-3 border-b border-[#edf0ee] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="relative w-full sm:max-w-[320px]">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#98a19c]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索条款、议题或章节"
              aria-label="搜索披露要求"
              className="h-9 w-full rounded-lg border border-[#dfe5e1] bg-[#fafcfb] pl-9 pr-3 text-xs text-[#2e3d35] outline-none placeholder:text-[#9ba49f] focus:border-[#6f9f8c] focus:bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <ListFilter className="size-3.5 text-[#8a948f]" />
            <select
              value={framework}
              onChange={(event) => setFramework(event.target.value)}
              aria-label="筛选披露框架"
              className="h-9 rounded-lg border border-[#dfe5e1] bg-white px-3 text-xs text-[#536159] outline-none focus:border-[#6f9f8c]"
            >
              <option>全部框架</option>
              <option>GRI</option>
              <option>上交所</option>
              <option>CASS-ESG</option>
            </select>
          </div>
        </div>

        <div className="scrollbar-subtle overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse text-left">
            <thead className="bg-[#fafbf9] text-[10px] font-semibold uppercase tracking-wide text-[#7a8580]">
              <tr>
                <th className="sticky left-0 z-10 w-[125px] border-b border-[#e7ebe9] bg-[#fafbf9] px-6 py-3.5">框架 / 条款</th>
                <th className="w-[130px] border-b border-[#e7ebe9] px-4 py-3.5">关联议题</th>
                <th className="border-b border-[#e7ebe9] px-4 py-3.5">披露要求</th>
                <th className="w-[126px] border-b border-[#e7ebe9] px-4 py-3.5">系统建议</th>
                <th className="w-[150px] border-b border-[#e7ebe9] px-4 py-3.5">用户确认适用性</th>
                <th className="w-[180px] border-b border-[#e7ebe9] px-4 py-3.5">对应章节</th>
                <th className="w-[102px] border-b border-[#e7ebe9] px-4 py-3.5">确认状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0ee] text-xs">
              {filteredRequirements.map((item) => {
                const confirmed = item.userConfirmed;
                return (
                  <tr id={`requirement-${item.id}`} key={item.id} className={`group scroll-mt-24 hover:bg-[#fbfcfb] ${initialRequirementId === item.id ? "bg-amber-50/60" : ""}`}>
                    <td className="sticky left-0 z-10 bg-white px-6 py-4 group-hover:bg-[#fbfcfb]">
                      <span className="font-semibold text-[#26362d]">{item.framework}</span>
                      <span className="ml-2 text-[11px] text-[#708078]">{item.code}</span>
                    </td>
                    <td className="px-4 py-4"><StatusBadge tone="teal">{item.topic}</StatusBadge></td>
                    <td className="px-4 py-4 leading-5 text-[#4d5b54]">{item.summary}</td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-violet-700"><Sparkles className="size-3" />建议{item.systemSuggestion}</span>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={item.applicability}
                        onChange={(event) => updateDecision(item.id, event.target.value as Applicability)}
                        aria-label={`${item.code} 用户确认适用性`}
                        className={`h-8 w-[112px] rounded-lg border bg-white px-2 text-[11px] font-medium outline-none ${item.applicability === "待确认" ? "border-amber-200 text-amber-700" : "border-[#dce3df] text-[#3d554a]"}`}
                      >
                        <option>适用</option>
                        <option>不适用</option>
                        <option>待确认</option>
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <div className="relative">
                        <Link2 className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-[#176b52]" />
                        <select aria-label={`${item.code} 对应章节`} value={item.mappedSection} onChange={(event) => updateMapping(item.id, event.target.value)} className="h-8 w-full rounded-lg border border-[#dce3df] bg-white pl-7 pr-2 text-[10px] font-medium text-[#176b52] outline-none focus:border-[#6f9f8c]">
                          <option value="">未映射</option>
                          {sections.map((section) => <option key={section.id} value={`${section.order} ${section.title}`}>{section.order} {section.title}</option>)}
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {confirmed ? (
                        <StatusBadge tone="green"><Check className="size-3" />已确认</StatusBadge>
                      ) : (
                        <button
                          disabled={item.applicability === "待确认"}
                          onClick={() => confirmDecision(item.id)}
                          className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          人工确认
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[#edf0ee] px-6 py-3 text-[10px] text-[#88928d]">
          <span>显示 {filteredRequirements.length} 条示例数据 · 全部共 58 项</span>
          <span>适用性结论以用户确认为准</span>
        </div>
      </SectionCard>
    </div>
  );
}

function ReportOutline() {
  const { project, savedProject, editProject, saveProject } = useProjectData();
  const sections = project.reportSections;
  const [selectedId, setSelectedId] = useState("section-4-2");
  const [addingSection, setAddingSection] = useState(false);
  const [newSection, setNewSection] = useState({ order: "", title: "", level: 1 as 1 | 2, description: "" });
  const [sectionError, setSectionError] = useState("");
  const [editingTopics, setEditingTopics] = useState(false);
  const [showMappings, setShowMappings] = useState(false);
  const selectedSection = sections.find((item) => item.id === selectedId) ?? sections[0];
  const updateSection = (patch: Partial<typeof selectedSection>) => {
    if (!selectedSection) return;
    editProject((current) => ({ ...current, reportSections: current.reportSections.map((item) => item.id === selectedSection.id ? { ...item, ...patch } : item) }));
  };
  const selectedMappingKey = `${selectedSection.order} ${selectedSection.title}`;
  const mappedRequirements = project.disclosureRequirements.filter((item) => item.mappedSection === selectedMappingKey);

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
    const id = `section-user-${Date.now()}`;
    editProject((current) => ({ ...current, reportSections: [...current.reportSections, { id, order, title, level: newSection.level, description: newSection.description.trim(), topics: [], requirementCount: 0, state: "待完善", revision: 1, sourceState: "active" }] }));
    setSelectedId(id);
    setAddingSection(false);
    setNewSection({ order: "", title: "", level: 1, description: "" });
    setSectionError("");
  }

  function toggleSectionTopic(topicName: string) {
    updateSection({ topics: selectedSection.topics.includes(topicName) ? selectedSection.topics.filter((item) => item !== topicName) : [...selectedSection.topics, topicName] });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.92fr)_minmax(480px,1.35fr)] animate-fade-up">
      <SectionCard
        title="报告目录"
        description="拖动调整章节顺序，选择章节后编辑内容规划。"
        flush
        action={<button onClick={() => setAddingSection(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#edf5f1] px-3 text-[11px] font-semibold text-[#176b52]"><Plus className="size-3.5" />新增章节</button>}
      >
        <div className="border-b border-[#edf0ee] px-5 py-3 text-[10px] text-[#84908a]">共 7 个一级章节 · 1 个示例二级章节</div>
        <div className="scrollbar-subtle max-h-[555px] overflow-y-auto p-3">
          {sections.map((section) => {
            const active = section.id === selectedId;
            return (
              <button
                key={section.id}
                onClick={() => setSelectedId(section.id)}
                className={`mb-1 flex w-full items-center gap-2 rounded-xl border px-3 py-3 text-left transition ${section.level === 2 ? "pl-8" : ""} ${active ? "border-[#bbd7cc] bg-[#edf5f1]" : "border-transparent hover:border-[#e4e9e6] hover:bg-[#fafcfb]"}`}
              >
                <GripVertical className="size-3.5 shrink-0 text-[#b0b8b4]" />
                <span className={`grid size-7 shrink-0 place-items-center rounded-lg text-[10px] font-semibold ${active ? "bg-[#176b52] text-white" : "bg-[#f0f3f1] text-[#6c7872]"}`}>{section.order}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-xs font-semibold ${active ? "text-[#174e3d]" : "text-[#344239]"}`}>{section.title}</span>
                  <span className="mt-0.5 block text-[9px] text-[#929c97]">{section.requirementCount} 项披露要求</span>
                </span>
                <ChevronRight className={`size-3.5 shrink-0 ${active ? "text-[#176b52]" : "text-[#b3bbb7]"}`} />
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="章节编辑"
        description={`正在编辑 ${selectedSection.order} ${selectedSection.title}`}
        action={<StatusBadge tone={selectedSection.state === "已就绪" ? "green" : "amber"}>{selectedSection.state}</StatusBadge>}
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
          </div>

          <div className="rounded-xl border border-[#e5e9e7] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold text-[#425148]">披露要求覆盖</div>
                <p className="mt-1 text-[10px] text-[#8a948f]">该章节已映射的框架条款</p>
              </div>
              <div className="text-right"><span className="text-lg font-semibold text-[#1f3329]">{selectedSection.requirementCount}</span><span className="ml-1 text-[10px] text-[#8a948f]">项</span></div>
            </div>
            {selectedSection.requirementCount > 0 ? (
              <div className="mt-3 flex items-center justify-between rounded-lg bg-[#f2f7f5] px-3 py-2.5 text-[10px] text-[#567066]">
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-[#27825f]" />已与披露要求矩阵同步</span>
                <button onClick={() => setShowMappings((value) => !value)} className="font-semibold text-[#176b52]">{showMappings ? "收起映射" : "查看映射"}</button>
              </div>
            ) : null}
            {showMappings ? <div className="mt-3 space-y-2">{mappedRequirements.length ? mappedRequirements.map((item) => <div key={item.id} className="rounded-lg border border-[#e4e9e6] bg-[#fafcfb] px-3 py-2 text-[10px] text-[#536159]"><span className="font-semibold text-[#315244]">{item.framework} {item.code}</span><span className="ml-2">{item.summary}</span></div>) : <p className="text-[10px] text-[#8a948f]">当前章节尚无披露要求映射。</p>}</div> : null}
          </div>

          <div className="flex justify-end gap-2 border-t border-[#edf0ee] pt-5">
            <button onClick={() => { const saved = savedProject.reportSections.find((item) => item.id === selectedSection.id); if (saved) updateSection(saved); }} className="h-9 rounded-lg border border-[#dce3df] bg-white px-4 text-[11px] font-semibold text-[#5a6860] hover:bg-[#f7f9f8]">取消修改</button>
            <button onClick={() => void saveProject(3, `保存章节 ${selectedSection.order}`)} className="h-9 rounded-lg bg-[#176b52] px-4 text-[11px] font-semibold text-white hover:bg-[#105c46]">保存章节</button>
          </div>
        </div>
      </SectionCard>

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

function MaterialsList() {
  const { project } = useProjectData();
  const dataRequirements = project.dataRequirements;
  return (
    <div className="space-y-5 animate-fade-up">
      <Notice>
        本清单由已确认的适用披露要求与报告目录汇总形成。责任部门为系统建议，下一步可由用户进行分工与调整。
      </Notice>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "本年度所需资料", value: "32", note: "覆盖 7 个报告章节", icon: ClipboardList },
          { label: "定量数据", value: "14", note: "含能源、排放与员工指标", icon: FileSpreadsheet },
          { label: "定性与制度资料", value: "18", note: "含管理制度、说明与案例", icon: FileText },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-[#e3e8e5] bg-white p-4">
            <div className="flex items-start justify-between">
              <span className="grid size-9 place-items-center rounded-lg bg-[#edf5f1] text-[#176b52]"><item.icon className="size-4" /></span>
              <span className="text-xl font-semibold text-[#1d2c24]">{item.value}</span>
            </div>
            <p className="mt-3 text-xs font-semibold text-[#3b4941]">{item.label}</p>
            <p className="mt-1 text-[10px] text-[#8a948f]">{item.note}</p>
          </div>
        ))}
      </div>

      <SectionCard
        title="本年度 ESG 报告所需资料清单"
        description="从披露要求自动汇总的资料项；此处不生成独立模板，支持后续沿用企业现有 Excel。"
        flush
        action={<button className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dce3df] bg-white px-3 text-[11px] font-semibold text-[#5a6860] hover:bg-[#f6f8f7]"><Download className="size-3.5" />导出清单</button>}
      >
        <div className="scrollbar-subtle overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead className="bg-[#fafbf9] text-[10px] font-semibold text-[#7a8580]">
              <tr>
                <th className="border-b border-[#e7ebe9] px-6 py-3.5">资料名称</th>
                <th className="w-[190px] border-b border-[#e7ebe9] px-4 py-3.5">对应章节</th>
                <th className="w-[105px] border-b border-[#e7ebe9] px-4 py-3.5">资料类型</th>
                <th className="w-[135px] border-b border-[#e7ebe9] px-4 py-3.5">建议责任部门</th>
                <th className="w-[120px] border-b border-[#e7ebe9] px-4 py-3.5">收集方式</th>
                <th className="w-[90px] border-b border-[#e7ebe9] px-4 py-3.5">清单状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0ee] text-xs">
              {dataRequirements.map((item) => (
                <tr key={item.id} className="hover:bg-[#fbfcfb]">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-[#304038]">{item.itemName}</div>
                    <div className="mt-1 text-[10px] text-[#929c97]">资料项 {item.id.replace("data-", "").toUpperCase()}</div>
                  </td>
                  <td className="px-4 py-4 text-[11px] text-[#5a6860]">{item.section}</td>
                  <td className="px-4 py-4"><StatusBadge tone="gray">{item.type}</StatusBadge></td>
                  <td className="px-4 py-4">
                    <div className="text-[11px] font-medium text-[#3c4c43]">{item.suggestedDepartment}</div>
                    <div className="mt-1 inline-flex items-center gap-1 text-[9px] text-violet-600"><Sparkles className="size-2.5" />系统建议</div>
                  </td>
                  <td className="px-4 py-4 text-[11px] text-[#5a6860]">{item.collectionMethod}</td>
                  <td className="px-4 py-4"><StatusBadge tone="green"><Check className="size-3" />已生成</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-2 border-t border-[#edf0ee] px-6 py-3 text-[10px] text-[#88928d] sm:flex-row sm:items-center sm:justify-between">
          <span>显示 5 条典型资料项 · 完整清单共 32 项</span>
          <span>责任部门将在 Step 4 由用户最终确认</span>
        </div>
      </SectionCard>
    </div>
  );
}

export function StepThree({ initialRequirementId }: { initialRequirementId?: string }) {
  const [activeTab, setActiveTab] = useState<Tab>(initialRequirementId ? "requirements" : "requirements");

  return (
    <>
      <StepPageHeader
        eyebrow="Step 3 · 框架与大纲"
        title="构建披露框架与报告大纲"
        description="将已选披露框架映射到报告章节，逐项确认适用性，并形成可执行的本年度资料清单。"
        completed
        action={
          <div className="rounded-xl border border-[#dfe6e2] bg-white px-4 py-3 text-right">
            <div className="text-[10px] text-[#8a948f]">框架映射完成度</div>
            <div className="mt-0.5 text-lg font-semibold text-[#176b52]">100%</div>
          </div>
        }
      />
      <TabNavigation active={activeTab} onChange={setActiveTab} />
      {activeTab === "requirements" ? <RequirementsMatrix initialRequirementId={initialRequirementId} /> : null}
      {activeTab === "outline" ? <ReportOutline /> : null}
      {activeTab === "materials" ? <MaterialsList /> : null}
      <StepFooter currentStep={3} />
    </>
  );
}
