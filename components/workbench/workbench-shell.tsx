"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleHelp,
  FileText,
  Menu,
  X,
} from "lucide-react";
import { BrandMark } from "@/components/ui/brand-mark";
import { ProgressBar } from "@/components/ui/progress-bar";
import { enterprise, reportProject, reportSteps } from "@/lib/data/mock-data";

function SidebarContent({ currentStep, onNavigate }: { currentStep: number; onNavigate?: () => void }) {
  return (
    <>
      <div className="flex h-[68px] items-center border-b border-white/10 px-5">
        <BrandMark inverse />
      </div>
      <div className="border-b border-white/10 px-5 py-5">
        <Link href="/" className="mb-4 inline-flex items-center gap-1 text-[11px] font-medium text-white/55 transition hover:text-white">
          <ChevronLeft className="size-3.5" />返回项目首页
        </Link>
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10 text-[11px] font-semibold text-emerald-100">HL</div>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-white">华澜新材料</div>
            <div className="mt-1 truncate text-[10px] text-white/45">2025 年度 ESG 报告</div>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-2 flex justify-between text-[10px] text-white/50"><span>编制进度</span><span>{reportProject.progress}%</span></div>
          <ProgressBar value={reportProject.progress} className="bg-white/10 [&>div]:bg-[#62c39d]" />
        </div>
      </div>

      <nav className="scrollbar-subtle flex-1 overflow-y-auto px-3 py-4" aria-label="报告编制步骤">
        <div className="mb-3 px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/35">报告编制流程</div>
        <ol className="space-y-1">
          {reportSteps.map((step) => {
            const active = currentStep === step.number;
            const passed = step.number < currentStep;
            return (
              <li key={step.number}>
                <Link
                  onClick={onNavigate}
                  href={`/reports/${reportProject.id}/step/${step.number}`}
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${active ? "bg-white/11 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]" : "text-white/58 hover:bg-white/[0.06] hover:text-white/85"}`}
                >
                  {active ? <span className="absolute -left-3 top-2.5 h-8 w-[3px] rounded-r-full bg-[#6fd5ab]" /> : null}
                  <span className={`grid size-7 shrink-0 place-items-center rounded-lg border text-[10px] font-semibold ${passed ? "border-emerald-400/20 bg-emerald-400/15 text-emerald-200" : active ? "border-white/20 bg-white/10 text-white" : "border-white/10 bg-transparent text-white/40"}`}>
                    {passed ? <Check className="size-3.5" strokeWidth={2.6} /> : step.number}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-[9px] font-medium uppercase tracking-wider ${active ? "text-emerald-200/75" : "text-white/30"}`}>Step {step.number}</span>
                    <span className="mt-0.5 block truncate text-[12px] font-medium">{step.shortTitle}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="rounded-xl bg-white/[0.05] p-3">
          <div className="flex items-center gap-2 text-[11px] font-medium text-white/75"><FileText className="size-3.5 text-emerald-200" />项目信息</div>
          <div className="mt-2 text-[10px] leading-4 text-white/40">报告期：2025.01.01—12.31<br />负责人：{reportProject.owner}</div>
        </div>
      </div>
    </>
  );
}

export function WorkbenchShell({ currentStep, children }: { currentStep: number; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = reportSteps.find((step) => step.number === currentStep) ?? reportSteps[0];

  return (
    <div className="min-h-screen bg-[#f4f6f5]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col bg-[#13241d] lg:flex">
        <SidebarContent currentStep={currentStep} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-[#0b1712]/55 backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-label="关闭步骤导航" />
          <aside className="animate-fade-up absolute inset-y-0 left-0 flex w-[288px] flex-col bg-[#13241d] shadow-2xl">
            <button onClick={() => setMobileOpen(false)} className="absolute right-4 top-5 z-10 grid size-8 place-items-center rounded-lg bg-white/10 text-white/70" aria-label="关闭"><X className="size-4" /></button>
            <SidebarContent currentStep={currentStep} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="lg:ml-[264px]">
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-[#e1e6e3] bg-white/95 px-4 backdrop-blur sm:px-6 xl:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#e1e6e3] text-[#4f5e56] lg:hidden" aria-label="打开步骤导航"><Menu className="size-[18px]" /></button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] text-[#8a938e]">
                <span className="hidden sm:inline">{enterprise.shortName} 2025 ESG 报告</span><span className="hidden sm:inline">/</span><span>Step {currentStep}</span>
              </div>
              <div className="mt-0.5 truncate text-xs font-semibold text-[#26332c] sm:text-sm">{current.title}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="mr-1 hidden items-center gap-1.5 text-[10px] text-[#83908a] sm:flex"><Check className="size-3 text-[#2b8a65]" />已保存 14:32</div>
            <button className="hidden size-9 place-items-center rounded-lg text-[#65716b] hover:bg-[#f1f4f2] sm:grid" aria-label="帮助"><CircleHelp className="size-[17px]" /></button>
            <button className="relative grid size-9 place-items-center rounded-lg text-[#65716b] hover:bg-[#f1f4f2]" aria-label="通知"><Bell className="size-[17px]" /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-amber-500 ring-2 ring-white" /></button>
            <button className="ml-1 flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-[#f3f5f4]">
              <span className="grid size-7 place-items-center rounded-full bg-[#234a3a] text-[9px] font-semibold text-white">林</span><ChevronDown className="hidden size-3 text-[#77827c] sm:block" />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-7 xl:px-8 xl:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
