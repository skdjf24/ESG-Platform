"use client";

import { useState } from "react";
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
import { enterprise, esgTopics, frameworks, historicalReports, reportProject } from "@/lib/data/mock-data";
import type { EsgCategory, ListingStatus } from "@/lib/types/esg";
import { Notice } from "@/components/ui/notice";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { StepFooter } from "@/components/workbench/step-footer";
import { StepPageHeader } from "@/components/workbench/step-page-header";

const fieldClass = "h-10 w-full rounded-lg border border-[#dce3df] bg-white px-3 text-[13px] text-[#29362f] outline-none transition placeholder:text-[#a0aaa4] focus:border-[#69a28b] focus:ring-2 focus:ring-[#176b52]/10";
const listingOptions: ListingStatus[] = ["A股", "H股", "A+H", "未上市"];
const categoryMeta: Record<EsgCategory, { label: string; className: string }> = {
  E: { label: "环境", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  S: { label: "社会", className: "border-blue-200 bg-blue-50 text-blue-700" },
  G: { label: "治理", className: "border-violet-200 bg-violet-50 text-violet-700" },
};

export function StepOne() {
  const [listingStatus, setListingStatus] = useState<ListingStatus>(enterprise.listingStatus);
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>(reportProject.frameworks);
  const [topics, setTopics] = useState(esgTopics);

  const toggleFramework = (framework: string) => {
    setSelectedFrameworks((current) => current.includes(framework) ? current.filter((item) => item !== framework) : [...current, framework]);
  };

  return (
    <div className="animate-fade-up">
      <StepPageHeader
        eyebrow="Step 1 · 基础设置"
        title="创建报告与企业基础画像"
        description="确认本年度报告的企业信息、编制边界与参考框架，并建立可继续调整的初始 ESG 议题池。"
        completed
        action={<button className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#dce3df] bg-white px-4 text-xs font-semibold text-[#506057] hover:bg-[#f7f9f8]"><FileCheck2 className="size-4 text-[#176b52]" />基础信息已保存</button>}
      />

      <Notice tone="warning" title="披露义务由企业自行确认">
        平台不会根据上市身份或行业自动判断企业是否具有强制披露义务。请结合适用监管规则与专业意见，由企业完成确认。
      </Notice>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)]">
        <div className="space-y-5">
          <SectionCard title="企业基本信息" description="用于报告抬头、披露范围及后续章节引用。">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="企业全称" icon={<Building2 className="size-3.5" />}><input className={fieldClass} defaultValue={enterprise.name} /></Field>
              <Field label="统一社会信用代码"><input className={fieldClass} defaultValue={enterprise.unifiedSocialCreditCode} /></Field>
              <Field label="总部所在地" icon={<MapPin className="size-3.5" />}><input className={fieldClass} defaultValue={enterprise.headquarters} /></Field>
              <Field label="员工人数" icon={<Users className="size-3.5" />}><div className="relative"><input className={`${fieldClass} pr-12`} type="number" defaultValue={enterprise.employeeCount} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8b9590]">人</span></div></Field>
              <Field label="报告期" icon={<CalendarDays className="size-3.5" />}><div className="flex items-center gap-2"><input className={fieldClass} defaultValue="2025-01-01" /><span className="text-[#a0aaa4]">—</span><input className={fieldClass} defaultValue="2025-12-31" /></div></Field>
              <Field label="报告联系人"><div className="grid grid-cols-[.8fr_1.2fr] gap-2"><input className={fieldClass} defaultValue={enterprise.reportingContact.name} /><input className={fieldClass} defaultValue={enterprise.reportingContact.department} /></div></Field>
            </div>
          </SectionCard>

          <SectionCard title="行业与上市身份" description="行业依据 GB/T 4754 选择；上市身份仅记录，不触发披露义务判断。">
            <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
              <Field label="GB/T 4754 国民经济行业分类">
                <button className={`${fieldClass} flex items-center justify-between text-left`}>
                  <span><span className="mr-2 rounded bg-[#eef3f0] px-1.5 py-0.5 font-mono text-[11px] text-[#53635a]">{enterprise.industryCode}</span>{enterprise.industryName}</span>
                  <ChevronDown className="size-4 text-[#85908a]" />
                </button>
                <p className="mt-2 text-[11px] text-[#87918c]">门类 C 制造业 · 大类 26 化学原料和化学制品制造业</p>
              </Field>
              <Field label="资本市场身份">
                <div className="grid grid-cols-4 gap-2">
                  {listingOptions.map((item) => (
                    <button key={item} type="button" onClick={() => setListingStatus(item)} className={`h-10 rounded-lg border text-xs font-semibold transition ${listingStatus === item ? "border-[#176b52] bg-[#eef6f2] text-[#176b52] ring-1 ring-[#176b52]/10" : "border-[#dfe5e1] bg-white text-[#68746e] hover:border-[#b9c9c1]"}`}>
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
                        <button aria-label={`移除${topic.name}`} onClick={() => setTopics((current) => current.filter((item) => item.id !== topic.id))} className="text-[#a5aea9] hover:text-rose-500"><X className="size-3" /></button>
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
              {[
                { name: "集团总部", detail: "华澜新材料总部", checked: true },
                { name: "境内控股子公司", detail: "12 家生产及经营主体", checked: true },
                { name: "境外控股子公司", detail: "2 家海外经营主体", checked: true },
                { name: "参股公司", detail: "按重大影响程度选择", checked: false },
              ].map((item) => (
                <label key={item.name} className="flex items-start gap-3 rounded-xl border border-[#e1e6e3] p-3.5 hover:bg-[#fafcfb]">
                  <input type="checkbox" defaultChecked={item.checked} className="mt-0.5 size-4 accent-[#176b52]" />
                  <span><span className="block text-xs font-semibold text-[#35443c]">{item.name}</span><span className="mt-1 block text-[10px] text-[#8b9590]">{item.detail}</span></span>
                </label>
              ))}
            </div>
            <div className="mt-4">
              <label htmlFor="boundary-note" className="mb-2 block text-[11px] font-semibold text-[#56635c]">边界说明</label>
              <textarea id="boundary-note" defaultValue="覆盖华澜新材料总部及财务并表范围内的控股子公司；如无特别说明，环境与社会绩效数据均按此边界统计。" className="min-h-24 w-full resize-none rounded-lg border border-[#dce3df] p-3 text-xs leading-5 outline-none focus:border-[#69a28b]" />
            </div>
          </SectionCard>

          <SectionCard title="历史报告" description="用于提取已有披露信息，仅展示模拟上传流程。">
            <button className="soft-grid flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#a9c9bb] bg-[#f5faf7] px-4 py-7 text-center hover:bg-[#f0f7f3]">
              <span className="grid size-10 place-items-center rounded-xl bg-white text-[#176b52] shadow-sm"><UploadCloud className="size-5" /></span>
              <span className="mt-3 text-xs font-semibold text-[#33463c]">拖拽或点击上传历史报告</span>
              <span className="mt-1 text-[10px] text-[#87938d]">支持 PDF、DOCX，单个文件不超过 50 MB</span>
              <span className="mt-2 rounded-full bg-violet-50 px-2 py-1 text-[9px] font-semibold text-violet-700">模拟上传</span>
            </button>
            <div className="mt-4 space-y-2">
              {historicalReports.map((report) => (
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
