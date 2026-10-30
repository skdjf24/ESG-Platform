"use client";

import { useRef, useState } from "react";
import {
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDot,
  FileCheck2,
  FileText,
  Globe2,
  MapPin,
  Paperclip,
  Plus,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import { frameworks } from "@/lib/data/mock-data";
import type { EsgCategory, ListingStatus } from "@/lib/types/esg";
import { useProjectData } from "@/components/project/project-data-provider";
import { Notice } from "@/components/ui/notice";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { StepFooter } from "@/components/workbench/step-footer";
import { StepPageHeader } from "@/components/workbench/step-page-header";

const fieldClass = "h-10 w-full rounded-lg border border-[#dce3df] bg-white px-3 text-[13px] text-[#29362f] outline-none transition placeholder:text-[#a0aaa4] focus:border-[#69a28b] focus:ring-2 focus:ring-[#176b52]/10";
const listingOptions: ListingStatus[] = ["A股", "H股", "A+H", "未上市"];
const industryOptions = [
  { code: "C26", name: "化学原料和化学制品制造业" },
  { code: "C27", name: "医药制造业" },
  { code: "C29", name: "橡胶和塑料制品业" },
  { code: "D44", name: "电力、热力生产和供应业" },
  { code: "I65", name: "软件和信息技术服务业" },
] as const;
const categoryMeta: Record<EsgCategory, { label: string; className: string }> = {
  E: { label: "环境", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  S: { label: "社会", className: "border-blue-200 bg-blue-50 text-blue-700" },
  G: { label: "治理", className: "border-violet-200 bg-violet-50 text-violet-700" },
};

export function StepOne() {
  const { project, editProject, saveProject, dirty, saving } = useProjectData();
  const historyInputRef = useRef<HTMLInputElement>(null);
  const [historyMessage, setHistoryMessage] = useState("");
  const { enterprise, report, topics, boundary } = project;
  const listingStatus = enterprise.listingStatus;
  const selectedFrameworks = report.frameworks;

  const toggleFramework = (framework: string) => {
    editProject((current) => ({ ...current, report: { ...current.report, frameworks: current.report.frameworks.includes(framework) ? current.report.frameworks.filter((item) => item !== framework) : [...current.report.frameworks, framework] } }));
  };

  function removeTopic(topicId: string) {
    const topic = topics.find((item) => item.id === topicId);
    if (!topic) return;
    const affected = project.disclosureRequirements.filter((item) => item.topic === topic.name).length;
    if (affected && !window.confirm(`移除“${topic.name}”将影响 ${affected} 项披露要求。已有正文和映射不会删除，但会标记为待复核。是否继续？`)) return;
    editProject((current) => ({ ...current, topics: current.topics.filter((item) => item.id !== topicId) }));
  }

  function addHistoricalReport(file: File) {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "pdf" && extension !== "docx") {
      setHistoryMessage("仅支持 PDF 或 DOCX 历史报告。");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setHistoryMessage("文件超过 50 MB，本地原型未创建来源记录。");
      return;
    }
    const fileType = extension === "pdf" ? "PDF" : "DOCX";
    const size = file.size >= 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`;
    editProject((current) => ({
      ...current,
      sources: [...current.sources, {
        id: `source-history-${Date.now()}`,
        name: file.name,
        kind: "historical",
        fileType,
        size,
        uploadedAt: new Date().toISOString().slice(0, 10),
        uploadedBy: current.enterprise.reportingContact.name || "当前用户",
        state: "已上传",
      }],
    }));
    setHistoryMessage("已在当前草稿中创建历史报告元数据。文件内容不会存入浏览器，也不会自动解析。");
  }

  return (
    <div className="animate-fade-up">
      <StepPageHeader
        eyebrow="Step 1 · 基础设置"
        title="创建报告与企业基础画像"
        description="确认本年度报告的企业信息、编制边界与参考框架，并建立可继续调整的初始 ESG 议题池。"
        completed
        action={<button disabled={saving} onClick={() => void saveProject(1, "Step 1 基础信息保存")} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#dce3df] bg-white px-4 text-xs font-semibold text-[#506057] hover:bg-[#f7f9f8] disabled:opacity-50"><FileCheck2 className="size-4 text-[#176b52]" />{saving ? "保存中…" : dirty ? "保存基础信息" : "基础信息已保存"}</button>}
      />

      <Notice tone="warning" title="披露义务由企业自行确认">
        平台不会根据上市身份或行业自动判断企业是否具有强制披露义务。请结合适用监管规则与专业意见，由企业完成确认。
      </Notice>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)]">
        <div className="space-y-5">
          <SectionCard title="企业基本信息" description="用于报告抬头、披露范围及后续章节引用。">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="企业全称" icon={<Building2 className="size-3.5" />}><input aria-label="企业全称" className={fieldClass} value={enterprise.name} onChange={(event) => editProject((current) => ({ ...current, enterprise: { ...current.enterprise, name: event.target.value } }))} /></Field>
              <Field label="统一社会信用代码"><input aria-label="统一社会信用代码" className={fieldClass} value={enterprise.unifiedSocialCreditCode} onChange={(event) => editProject((current) => ({ ...current, enterprise: { ...current.enterprise, unifiedSocialCreditCode: event.target.value } }))} /></Field>
              <Field label="总部所在地" icon={<MapPin className="size-3.5" />}><input aria-label="总部所在地" className={fieldClass} value={enterprise.headquarters} onChange={(event) => editProject((current) => ({ ...current, enterprise: { ...current.enterprise, headquarters: event.target.value } }))} /></Field>
              <Field label="员工人数" icon={<Users className="size-3.5" />}><div className="relative"><input aria-label="员工人数" className={`${fieldClass} pr-12`} type="number" value={enterprise.employeeCount} onChange={(event) => editProject((current) => ({ ...current, enterprise: { ...current.enterprise, employeeCount: Number(event.target.value) || 0 } }))} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8b9590]">人</span></div></Field>
              <Field label="报告年度与报告期" icon={<CalendarDays className="size-3.5" />}><div className="grid grid-cols-[90px_1fr_12px_1fr] items-center gap-2"><input aria-label="报告年度" className={fieldClass} type="number" value={report.year} onChange={(event) => editProject((current) => ({ ...current, report: { ...current.report, year: Number(event.target.value) || current.report.year } }))} /><input aria-label="报告期开始" className={fieldClass} value={report.reportingPeriod.start} onChange={(event) => editProject((current) => ({ ...current, report: { ...current.report, reportingPeriod: { ...current.report.reportingPeriod, start: event.target.value } } }))} /><span className="text-[#a0aaa4]">—</span><input aria-label="报告期结束" className={fieldClass} value={report.reportingPeriod.end} onChange={(event) => editProject((current) => ({ ...current, report: { ...current.report, reportingPeriod: { ...current.report.reportingPeriod, end: event.target.value } } }))} /></div></Field>
              <Field label="报告联系人"><div className="grid grid-cols-[.8fr_1.2fr] gap-2"><input aria-label="报告联系人姓名" className={fieldClass} value={enterprise.reportingContact.name} onChange={(event) => editProject((current) => ({ ...current, enterprise: { ...current.enterprise, reportingContact: { ...current.enterprise.reportingContact, name: event.target.value } } }))} /><input aria-label="报告联系人部门" className={fieldClass} value={enterprise.reportingContact.department} onChange={(event) => editProject((current) => ({ ...current, enterprise: { ...current.enterprise, reportingContact: { ...current.enterprise.reportingContact, department: event.target.value } } }))} /></div></Field>
            </div>
          </SectionCard>

          <SectionCard title="行业与上市身份" description="行业依据 GB/T 4754 选择；上市身份仅记录，不触发披露义务判断。">
            <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
              <Field label="GB/T 4754 国民经济行业分类">
                <div className="relative">
                  <select
                    aria-label="行业分类"
                    value={enterprise.industryCode}
                    onChange={(event) => {
                      const selected = industryOptions.find((item) => item.code === event.target.value);
                      if (!selected) return;
                      editProject((current) => ({ ...current, enterprise: { ...current.enterprise, industryCode: selected.code, industryName: selected.name } }));
                    }}
                    className={`${fieldClass} appearance-none pr-9`}
                  >
                    {industryOptions.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#85908a]" />
                </div>
                <p className="mt-2 text-[11px] text-[#87918c]">当前分类：{enterprise.industryCode} · {enterprise.industryName}</p>
              </Field>
              <Field label="资本市场身份">
                <div className="grid grid-cols-4 gap-2">
                  {listingOptions.map((item) => (
                    <button key={item} type="button" onClick={() => editProject((current) => ({ ...current, enterprise: { ...current.enterprise, listingStatus: item as ListingStatus } }))} className={`h-10 rounded-lg border text-xs font-semibold transition ${listingStatus === item ? "border-[#176b52] bg-[#eef6f2] text-[#176b52] ring-1 ring-[#176b52]/10" : "border-[#dfe5e1] bg-white text-[#68746e] hover:border-[#b9c9c1]"}`}>
                      {item}
                    </button>
                  ))}
                </div>
                {listingStatus !== "未上市" ? <p className="mt-2 text-[11px] text-[#87918c]">证券代码：{enterprise.stockCode}</p> : null}
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="披露框架" description="可多选。后续披露要求仍需逐条确认适用性。" action={<StatusBadge tone="teal">已选择 {selectedFrameworks.length} 项</StatusBadge>}>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {frameworks.map((framework) => {
                const selected = selectedFrameworks.includes(framework);
                return (
                  <label key={framework} className={`flex min-h-12 items-center gap-3 rounded-xl border px-3.5 py-3 transition ${selected ? "border-[#9bc6b4] bg-[#f1f8f5]" : "border-[#e0e5e2] hover:bg-[#fafcfb]"}`}>
                    <input type="checkbox" checked={selected} onChange={() => toggleFramework(framework)} className="sr-only" />
                    <span className={`grid size-5 shrink-0 place-items-center rounded-md border ${selected ? "border-[#176b52] bg-[#176b52] text-white" : "border-[#cbd3cf] bg-white"}`}>{selected ? <Check className="size-3" strokeWidth={3} /> : null}</span>
                    <span className={`text-xs font-medium ${selected ? "text-[#245443]" : "text-[#56635c]"}`}>{framework}</span>
                  </label>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="初始 ESG 议题池" description="综合所选框架与历史报告形成，可由用户增删调整。" action={<button className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dce3df] px-3 text-[11px] font-semibold text-[#4e5e55] hover:bg-[#f5f8f6]"><Plus className="size-3.5" />新增议题</button>}>
            <div className="space-y-5">
              {(["E", "S", "G"] as EsgCategory[]).map((category) => (
                <div key={category} className="grid gap-3 sm:grid-cols-[100px_1fr]">
                  <div className="flex items-center gap-2 self-start pt-1">
                    <span className={`grid size-7 place-items-center rounded-lg border text-[11px] font-bold ${categoryMeta[category].className}`}>{category}</span>
                    <span className="text-xs font-semibold text-[#4b5851]">{categoryMeta[category].label}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {topics.filter((topic) => topic.category === category).map((topic) => (
                      <span key={topic.id} className="inline-flex items-center gap-2 rounded-lg border border-[#e0e6e2] bg-[#fafcfb] px-3 py-2 text-xs font-medium text-[#405047]">
                        {topic.name}<span className="text-[9px] font-normal text-[#98a19c]">{topic.origin}</span>
                        <button aria-label={`移除${topic.name}`} onClick={() => removeTopic(topic.id)} className="text-[#a5aea9] hover:text-rose-500"><X className="size-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard title="报告边界" description="勾选本年度纳入披露的组织范围。">
            <div className="space-y-3">
              {boundary.items.map((item) => (
                <label key={item.name} className="flex items-start gap-3 rounded-xl border border-[#e1e6e3] p-3.5 hover:bg-[#fafcfb]">
                  <input type="checkbox" checked={item.included} onChange={(event) => editProject((current) => ({ ...current, boundary: { ...current.boundary, items: current.boundary.items.map((entry) => entry.id === item.id ? { ...entry, included: event.target.checked } : entry) } }))} className="mt-0.5 size-4 accent-[#176b52]" />
                  <span><span className="block text-xs font-semibold text-[#35443c]">{item.name}</span><span className="mt-1 block text-[10px] text-[#8b9590]">{item.detail}</span></span>
                </label>
              ))}
            </div>
            <div className="mt-4">
              <label htmlFor="boundary-note" className="mb-2 block text-[11px] font-semibold text-[#56635c]">边界说明</label>
              <textarea id="boundary-note" value={boundary.note} onChange={(event) => editProject((current) => ({ ...current, boundary: { ...current.boundary, note: event.target.value } }))} className="min-h-24 w-full resize-none rounded-lg border border-[#dce3df] p-3 text-xs leading-5 outline-none focus:border-[#69a28b]" />
            </div>
          </SectionCard>

          <SectionCard title="历史报告" description="本地原型只保存文件元数据，不保存文件内容，也不执行解析。">
            <input
              ref={historyInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              aria-label="选择历史报告文件"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) addHistoricalReport(file);
                event.target.value = "";
              }}
            />
            <button type="button" onClick={() => historyInputRef.current?.click()} className="soft-grid flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#a9c9bb] bg-[#f5faf7] px-4 py-7 text-center hover:bg-[#f0f7f3]">
              <span className="grid size-10 place-items-center rounded-xl bg-white text-[#176b52] shadow-sm"><UploadCloud className="size-5" /></span>
              <span className="mt-3 text-xs font-semibold text-[#33463c]">点击选择历史报告</span>
              <span className="mt-1 text-[10px] text-[#87938d]">支持 PDF、DOCX，单个文件不超过 50 MB</span>
              <span className="mt-2 rounded-full bg-blue-50 px-2 py-1 text-[9px] font-semibold text-blue-700">仅保存本地元数据</span>
            </button>
            {historyMessage ? <p role="status" className="mt-2 text-[10px] leading-4 text-[#66736c]">{historyMessage}</p> : null}
            <div className="mt-4 space-y-2">
              {project.sources.filter((source) => source.kind === "historical").map((report) => (
                <div key={report.id} className="flex items-center gap-3 rounded-xl border border-[#e3e8e5] p-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-600"><FileText className="size-4" /></span>
                  <div className="min-w-0 flex-1"><div className="truncate text-[11px] font-semibold text-[#38463e]">{report.name}</div><div className="mt-1 text-[9px] text-[#929c97]">{report.size} · {report.uploadedAt}</div></div>
                  <StatusBadge tone="green">{report.state}</StatusBadge>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="画像摘要" description="基于当前已填写信息实时汇总。">
            <div className="space-y-3">
              {[
                { icon: Globe2, label: "行业", value: `${enterprise.industryCode} ${enterprise.industryName}` },
                { icon: CircleDot, label: "上市身份", value: listingStatus },
                { icon: Paperclip, label: "披露框架", value: `${selectedFrameworks.length} 项` },
                { icon: FileText, label: "初始议题", value: `${topics.length} 项` },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-4 border-b border-[#edf0ee] pb-3 last:border-0 last:pb-0">
                  <span className="flex items-center gap-2 text-[11px] text-[#7b8680]"><item.icon className="size-3.5" />{item.label}</span>
                  <span className="max-w-[210px] truncate text-right text-[11px] font-semibold text-[#35443c]">{item.value}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <StepFooter currentStep={1} />
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#536159]">{icon}{label}</label>
      {children}
    </div>
  );
}
