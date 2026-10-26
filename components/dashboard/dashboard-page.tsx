"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  FolderOpen,
  LayoutDashboard,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { enterprise, reportProject, reportSteps } from "@/lib/data/mock-data";
import { BrandMark } from "@/components/ui/brand-mark";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { Notice } from "@/components/ui/notice";

export function DashboardPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f4f6f5]">
      <header className="sticky top-0 z-30 border-b border-[#e4e9e6] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-[1480px] items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-10">
            <BrandMark />
            <nav className="hidden items-center gap-1 md:flex" aria-label="主导航">
              <Link href="/" className="flex items-center gap-2 rounded-lg bg-[#edf5f1] px-3 py-2 text-sm font-semibold text-[#176b52]">
                <LayoutDashboard className="size-4" />报告项目
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <button className="grid size-9 place-items-center rounded-full text-[#65716b] transition hover:bg-[#f2f5f3]" aria-label="帮助">
              <CircleHelp className="size-[18px]" />
            </button>
            <button className="relative grid size-9 place-items-center rounded-full text-[#65716b] transition hover:bg-[#f2f5f3]" aria-label="通知">
              <Bell className="size-[18px]" />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#c58a3d] ring-2 ring-white" />
            </button>
            <div className="ml-2 flex items-center gap-2 border-l border-[#e6eae8] pl-4">
              <div className="grid size-9 place-items-center rounded-full bg-[#203f33] text-xs font-semibold text-white">林悦</div>
              <div className="hidden leading-tight sm:block">
                <div className="text-xs font-semibold text-[#25312b]">林悦</div>
                <div className="mt-0.5 text-[10px] text-[#8a938e]">报告负责人</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] px-5 pb-16 pt-8 lg:px-8 lg:pt-10">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-[#78827d]">
              <span>工作空间</span><ChevronRight className="size-3.5" /><span className="text-[#334039]">报告项目</span>
            </div>
            <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[#17201c] sm:text-[32px]">我的 ESG 报告项目</h1>
            <p className="mt-2 text-sm text-[#6e7973]">集中管理报告编制进度、协作任务与资料状态。</p>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#176b52] px-5 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(23,107,82,0.18)] transition hover:bg-[#105c46]"
          >
            <Plus className="size-4" />新建报告
          </button>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { label: "报告项目", value: "1", unit: "个", icon: FolderOpen, note: "1 个正在编制" },
            { label: "本周待办", value: "6", unit: "项", icon: Clock3, note: "其中 2 项待确认" },
            { label: "已确认事实", value: "28", unit: "条", icon: ShieldCheck, note: "全部保留来源关联" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-2xl border border-[#e2e7e4] bg-white p-5">
              <div>
                <p className="text-xs font-medium text-[#7b8580]">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-[#1a2721]">{item.value}<span className="ml-1 text-xs font-medium text-[#8c9590]">{item.unit}</span></p>
                <p className="mt-1 text-[11px] text-[#84908a]">{item.note}</p>
              </div>
              <div className="grid size-11 place-items-center rounded-xl bg-[#edf5f1] text-[#176b52]"><item.icon className="size-5" /></div>
            </div>
          ))}
        </section>

        <section className="mt-9">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#202c26]">进行中的项目</h2>
              <p className="mt-1 text-xs text-[#7b8580]">最近更新的报告项目</p>
            </div>
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#929b96]" />
              <input aria-label="搜索报告项目" placeholder="搜索项目" className="h-9 w-56 rounded-lg border border-[#dfe5e1] bg-white pl-9 pr-3 text-xs outline-none placeholder:text-[#a0aaa4] focus:border-[#71a28f]" />
            </div>
          </div>

          <article className="group overflow-hidden rounded-2xl border border-[#dfe5e1] bg-white shadow-[0_10px_30px_rgba(26,47,38,0.05)]">
            <div className="grid lg:grid-cols-[1fr_330px]">
              <div className="p-6 sm:p-7">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-4">
                    <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#163f32] text-sm font-semibold text-white shadow-sm">HL</div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-[#17231d]">{reportProject.title}</h3>
                        <StatusBadge tone="blue" dot>编制中</StatusBadge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#707b75]">
                        <span className="inline-flex items-center gap-1.5"><Building2 className="size-3.5" />{enterprise.name}</span>
                        <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />报告期 2025 年度</span>
                        <span className="inline-flex items-center gap-1.5"><FileText className="size-3.5" />{reportProject.frameworks.length} 项披露框架</span>
                      </div>
                    </div>
                  </div>
                  <button className="grid size-8 place-items-center self-end rounded-lg text-[#7b8580] hover:bg-[#f2f5f3] sm:self-auto" aria-label="更多项目操作"><MoreHorizontal className="size-5" /></button>
                </div>

                <div className="mt-7 rounded-xl border border-[#e8ecea] bg-[#fafcfb] p-4">
                  <div className="mb-3 flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#334038]">整体进度</span>
                    <span className="font-semibold text-[#176b52]">{reportProject.progress}%</span>
                  </div>
                  <ProgressBar value={reportProject.progress} />
                  <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
                    {reportSteps.map((step) => (
                      <Link
                        key={step.number}
                        href={`/reports/${reportProject.id}/step/${step.number}`}
                        aria-label={`打开第 ${step.number} 步：${step.title}`}
                        className="group/step"
                      >
                        <div className={`h-1.5 rounded-full transition ${step.state === "completed" ? "bg-[#38a47c]" : step.state === "in-progress" ? "bg-[#d1a65d]" : "bg-[#dfe5e2]"}`} />
                        <div className={`mt-1.5 text-center text-[9px] font-medium ${step.state === "in-progress" ? "text-[#946a25]" : "text-[#929c97]"}`}>STEP {step.number}</div>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[#edf0ee] pt-5">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#26342d]">
                      <span className="grid size-5 place-items-center rounded-full bg-amber-100 text-[10px] text-amber-700">4</span>
                      当前：资料收集、汇总与规整
                    </div>
                    <p className="mt-1.5 text-[11px] text-[#89928d]">更新于 {reportProject.updatedAt} · 负责人 {reportProject.owner}</p>
                  </div>
                  <Link href={`/reports/${reportProject.id}/step/${reportProject.currentStep}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#176b52] px-4 text-xs font-semibold text-white transition hover:bg-[#105c46]">
                    继续编辑<ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>

              <aside className="border-t border-[#e6ebe8] bg-[#f6faf8] p-6 lg:border-l lg:border-t-0">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#2c3b33]"><Sparkles className="size-4 text-[#b1833f]" />下一步建议</div>
                <p className="mt-3 text-sm font-semibold leading-6 text-[#1d2c24]">确认能源数据的规整结果</p>
                <p className="mt-1.5 text-xs leading-5 text-[#6f7d75]">系统已生成 1 条示例 AI 规整结果，需人工核对原始 Excel 后确认入库。</p>
                <div className="mt-5 space-y-3">
                  {[
                    { text: "5 项资料任务已分配", done: true },
                    { text: "2 项资料等待人工确认", done: false },
                    { text: "1 项责任部门待调整", done: false },
                  ].map((item) => (
                    <div key={item.text} className="flex items-center gap-2 text-[11px] text-[#617068]">
                      <CheckCircle2 className={`size-3.5 ${item.done ? "text-[#27825f]" : "text-[#c7cfcb]"}`} />{item.text}
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </article>
        </section>
      </main>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10241c]/45 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="create-report-title" onMouseDown={(event) => event.target === event.currentTarget && setIsCreateOpen(false)}>
          <div className="animate-fade-up w-full max-w-[590px] overflow-hidden rounded-2xl border border-white/30 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#e8ecea] px-6 py-5">
              <div>
                <div className="mb-2 grid size-10 place-items-center rounded-xl bg-[#eaf4ef] text-[#176b52]"><Plus className="size-5" /></div>
                <h2 id="create-report-title" className="text-lg font-semibold text-[#17231d]">新建 ESG 报告</h2>
                <p className="mt-1 text-xs text-[#7a8580]">填写基本信息后，从企业画像开始编制。</p>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="grid size-8 place-items-center rounded-lg text-[#7d8782] hover:bg-[#f2f4f3]" aria-label="关闭"><X className="size-4" /></button>
            </div>
            <div className="space-y-5 p-6">
              <div>
                <label htmlFor="report-name" className="mb-2 block text-xs font-semibold text-[#34423a]">报告名称</label>
                <input id="report-name" defaultValue="华澜新材料 2025 年度 ESG 报告" className="h-10 w-full rounded-lg border border-[#dce3df] px-3 text-sm outline-none focus:border-[#5c9a82]" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="enterprise" className="mb-2 block text-xs font-semibold text-[#34423a]">企业名称</label>
                  <input id="enterprise" defaultValue={enterprise.name} className="h-10 w-full rounded-lg border border-[#dce3df] px-3 text-sm outline-none focus:border-[#5c9a82]" />
                </div>
                <div>
                  <label htmlFor="report-year" className="mb-2 block text-xs font-semibold text-[#34423a]">报告年度</label>
                  <select id="report-year" defaultValue="2025" className="h-10 w-full rounded-lg border border-[#dce3df] bg-white px-3 text-sm outline-none focus:border-[#5c9a82]">
                    <option>2025</option><option>2026</option>
                  </select>
                </div>
              </div>
              <Notice tone="warning" title="披露义务需由企业确认">
                平台不会自动判断企业是否具有强制披露义务，请结合适用监管要求自行确认。
              </Notice>
            </div>
            <div className="flex justify-end gap-3 border-t border-[#e8ecea] bg-[#fafbf9] px-6 py-4">
              <button onClick={() => setIsCreateOpen(false)} className="h-10 rounded-lg border border-[#dbe2de] bg-white px-4 text-xs font-semibold text-[#536059] hover:bg-[#f5f7f6]">取消</button>
              <Link href={`/reports/${reportProject.id}/step/1`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#176b52] px-4 text-xs font-semibold text-white hover:bg-[#105c46]">创建并开始<ArrowRight className="size-3.5" /></Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
