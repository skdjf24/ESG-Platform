"use client";

import { useMemo, useState } from "react";
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
} from "lucide-react";
import { dataRequirements, disclosureRequirements, reportSections } from "@/lib/data/mock-data";
import type { Applicability } from "@/lib/types/esg";
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

function RequirementsMatrix() {
  const [search, setSearch] = useState("");
  const [framework, setFramework] = useState("全部框架");
  const [decisions, setDecisions] = useState<Record<string, Applicability>>(
    Object.fromEntries(disclosureRequirements.map((item) => [item.id, item.applicability])),
  );
  const [confirmedIds, setConfirmedIds] = useState(
    () => new Set(disclosureRequirements.filter((item) => item.userConfirmed).map((item) => item.id)),
  );

  const filteredRequirements = useMemo(() => {
    const query = search.trim().toLowerCase();
    return disclosureRequirements.filter((item) => {
      const frameworkMatches = framework === "全部框架" || item.framework === framework;
      const queryMatches = !query || `${item.framework}${item.code}${item.topic}${item.summary}${item.mappedSection}`.toLowerCase().includes(query);
      return frameworkMatches && queryMatches;
    });
  }, [framework, search]);

  const updateDecision = (id: string, value: Applicability) => {
    setDecisions((current) => ({ ...current, [id]: value }));
    setConfirmedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const confirmDecision = (id: string) => {
    setConfirmedIds((current) => new Set(current).add(id));
  };

  const pendingCount = disclosureRequirements.filter((item) => !confirmedIds.has(item.id)).length;

  return (
    <div className="space-y-5 animate-fade-up">
      <Notice tone="warning" title="适用性须由用户确认">
        系统仅根据已选框架和企业画像提供适用性建议，不会替企业作出结论；请逐项核对并确认。
      </Notice>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "披露要求", value: "58", note: "来自 3 项框架", icon: Layers3, tone: "bg-[#edf5f1] text-[#176b52]" },
          { label: "建议适用", value: "43", note: "系统建议，非最终结论", icon: Sparkles, tone: "bg-violet-50 text-violet-600" },
          { label: "待用户确认", value: String(pendingCount), note: "需人工作出适用性判断", icon: PencilLine, tone: "bg-amber-50 text-amber-600" },
          { label: "已映射章节", value: "58", note: "100% 已关联目录", icon: Link2, tone: "bg-blue-50 text-blue-600" },
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
                const confirmed = confirmedIds.has(item.id);
                return (
                  <tr key={item.id} className="group hover:bg-[#fbfcfb]">
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
                        value={decisions[item.id]}
                        onChange={(event) => updateDecision(item.id, event.target.value as Applicability)}
                        aria-label={`${item.code} 用户确认适用性`}
                        className={`h-8 w-[112px] rounded-lg border bg-white px-2 text-[11px] font-medium outline-none ${decisions[item.id] === "待确认" ? "border-amber-200 text-amber-700" : "border-[#dce3df] text-[#3d554a]"}`}
                      >
                        <option>适用</option>
                        <option>不适用</option>
                        <option>待确认</option>
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <button className="inline-flex items-center gap-1 text-left text-[11px] font-medium text-[#176b52] hover:underline"><Link2 className="size-3" />{item.mappedSection}</button>
                    </td>
                    <td className="px-4 py-4">
                      {confirmed ? (
                        <StatusBadge tone="green"><Check className="size-3" />已确认</StatusBadge>
                      ) : (
                        <button
                          disabled={decisions[item.id] === "待确认"}
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
  const [selectedId, setSelectedId] = useState("section-4-2");
  const selectedSection = reportSections.find((item) => item.id === selectedId) ?? reportSections[0];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.92fr)_minmax(480px,1.35fr)] animate-fade-up">
      <SectionCard
        title="报告目录"
        description="拖动调整章节顺序，选择章节后编辑内容规划。"
        flush
        action={<button className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#edf5f1] px-3 text-[11px] font-semibold text-[#176b52]"><Plus className="size-3.5" />新增章节</button>}
      >
        <div className="border-b border-[#edf0ee] px-5 py-3 text-[10px] text-[#84908a]">共 7 个一级章节 · 1 个示例二级章节</div>
        <div className="scrollbar-subtle max-h-[555px] overflow-y-auto p-3">
          {reportSections.map((section) => {
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
              <input id="section-order" key={`${selectedId}-order`} defaultValue={selectedSection.order} className="h-10 w-full rounded-lg border border-[#dce3df] px-3 text-xs outline-none focus:border-[#6f9f8c]" />
            </div>
            <div>
              <label htmlFor="section-title" className="mb-2 block text-[11px] font-semibold text-[#536159]">章节名称</label>
              <input id="section-title" key={`${selectedId}-title`} defaultValue={selectedSection.title} className="h-10 w-full rounded-lg border border-[#dce3df] px-3 text-xs outline-none focus:border-[#6f9f8c]" />
            </div>
          </div>
          <div>
            <label htmlFor="section-description" className="mb-2 block text-[11px] font-semibold text-[#536159]">章节编制说明</label>
            <textarea id="section-description" key={`${selectedId}-description`} defaultValue={selectedSection.description} rows={4} className="w-full resize-none rounded-lg border border-[#dce3df] px-3 py-2.5 text-xs leading-5 outline-none focus:border-[#6f9f8c]" />
          </div>

          <div className="rounded-xl border border-[#e5e9e7] bg-[#fafcfb] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold text-[#425148]">关联实质性议题</div>
              <button className="text-[10px] font-semibold text-[#176b52]">编辑关联</button>
            </div>
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
                <button className="font-semibold text-[#176b52]">查看映射</button>
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 border-t border-[#edf0ee] pt-5">
            <button className="h-9 rounded-lg border border-[#dce3df] bg-white px-4 text-[11px] font-semibold text-[#5a6860] hover:bg-[#f7f9f8]">取消修改</button>
            <button className="h-9 rounded-lg bg-[#176b52] px-4 text-[11px] font-semibold text-white hover:bg-[#105c46]">保存章节</button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function MaterialsList() {
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

export function StepThree() {
  const [activeTab, setActiveTab] = useState<Tab>("requirements");

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
      {activeTab === "requirements" ? <RequirementsMatrix /> : null}
      {activeTab === "outline" ? <ReportOutline /> : null}
      {activeTab === "materials" ? <MaterialsList /> : null}
      <StepFooter currentStep={3} />
    </>
  );
}
