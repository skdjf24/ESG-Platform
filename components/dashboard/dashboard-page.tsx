"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArchiveRestore,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleHelp,
  CopyPlus,
  Database,
  Download,
  FileText,
  FolderOpen,
  HardDrive,
  LayoutDashboard,
  Plus,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { BrandMark } from "@/components/ui/brand-mark";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { Notice } from "@/components/ui/notice";
import { projectRepository } from "@/lib/project/repository";
import { copyProjectToNextYear, downloadProjectBackup, restoreProjectBackup } from "@/lib/project/operations";
import { requestPersistentStorage, storageEstimate } from "@/lib/project/indexed-db";
import type { ProjectSummary } from "@/lib/types/project-data";

function formatBytes(value?: number) {
  if (typeof value !== "number") return "未知";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function DashboardPage() {
  const router = useRouter();
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [storage, setStorage] = useState<{ usage?: number; quota?: number; persisted: boolean; supported: boolean }>({ persisted: false, supported: false });
  const [draft, setDraft] = useState({ title: "", enterpriseName: "", year: new Date().getFullYear() });

  async function refreshProjects() {
    try {
      setProjects(await projectRepository.list());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "项目列表读取失败。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    queueMicrotask(async () => {
      try {
        const [projectItems, estimate, persistence] = await Promise.all([
          projectRepository.list(),
          storageEstimate(),
          requestPersistentStorage(),
        ]);
        if (!active) return;
        setProjects(projectItems);
        setStorage({ usage: estimate.usage, quota: estimate.quota, ...persistence });
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "项目列表读取失败。");
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

  const visibleProjects = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value ? projects.filter((project) => `${project.title}${project.enterpriseName}${project.year}`.toLowerCase().includes(value)) : projects;
  }, [projects, query]);

  async function createProject() {
    if (!draft.title.trim() || !draft.enterpriseName.trim() || !Number.isInteger(draft.year)) {
      setMessage("请完整填写报告名称、企业名称和报告年度。");
      return;
    }
    setBusy(true);
    try {
      const project = await projectRepository.create({ title: draft.title.trim(), enterpriseName: draft.enterpriseName.trim(), year: draft.year });
      setIsCreateOpen(false);
      router.push(`/reports/${project.projectId}/step/1`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "项目创建失败。");
    } finally {
      setBusy(false);
    }
  }

  async function restore(file: File) {
    setBusy(true);
    try {
      const project = await restoreProjectBackup(file);
      await refreshProjects();
      setMessage(`已恢复“${project.report.title}”，原有同 ID 项目未被覆盖。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "项目备份恢复失败。");
    } finally {
      setBusy(false);
    }
  }

  async function copyNextYear(projectId: string) {
    setBusy(true);
    try {
      const project = await copyProjectToNextYear(projectId);
      await refreshProjects();
      setMessage(`已复制为 ${project.report.year} 年项目；年度确认、Facts、Step 7 与 Step 8 已重置。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "年度复制失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6f5]">
      <header className="sticky top-0 z-30 border-b border-[#e4e9e6] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-[1480px] items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-10"><BrandMark /><nav className="hidden md:block"><Link href="/" className="flex items-center gap-2 rounded-lg bg-[#edf5f1] px-3 py-2 text-sm font-semibold text-[#176b52]"><LayoutDashboard className="size-4" />报告项目</Link></nav></div>
          <div className="flex items-center gap-3 text-[10px] text-[#68766e]"><HardDrive className="size-4 text-[#176b52]" /><span>本地 IndexedDB · {storage.persisted ? "持久存储已授权" : storage.supported ? "已请求持久存储" : "浏览器管理存储"}</span><button aria-label="帮助" className="grid size-9 place-items-center rounded-full hover:bg-[#f2f5f3]"><CircleHelp className="size-[18px]" /></button></div>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] px-5 pb-16 pt-8 lg:px-8 lg:pt-10">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div><h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[#17201c] sm:text-[32px]">我的 ESG 报告项目</h1><p className="mt-2 text-sm text-[#6e7973]">项目结构化数据与原始文件分别保存在当前浏览器的 IndexedDB。</p></div>
          <div className="flex flex-wrap gap-2">
            <input ref={restoreInputRef} type="file" accept=".json,.esgbackup.json,application/json" aria-label="选择项目备份" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void restore(file); event.target.value = ""; }} />
            <button disabled={busy} onClick={() => restoreInputRef.current?.click()} className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#d6dfda] bg-white px-4 text-xs font-semibold text-[#506057] disabled:opacity-50"><ArchiveRestore className="size-4" />恢复备份</button>
            <button disabled={busy} onClick={() => { setDraft({ title: "", enterpriseName: "", year: new Date().getFullYear() }); setIsCreateOpen(true); }} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#176b52] px-5 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(23,107,82,0.18)] disabled:opacity-50"><Plus className="size-4" />新建报告</button>
          </div>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { label: "报告项目", value: projects.length, note: `${projects.filter((item) => item.state !== "finalized").length} 个正在编制`, icon: FolderOpen },
            { label: "真实文件", value: projects.reduce((sum, item) => sum + item.fileCount, 0), note: "项目间完全隔离", icon: Database },
            { label: "本地空间", value: formatBytes(storage.usage), note: `配额 ${formatBytes(storage.quota)}`, icon: ShieldCheck },
          ].map((item) => <div key={item.label} className="flex items-center justify-between rounded-2xl border border-[#e2e7e4] bg-white p-5"><div><p className="text-xs font-medium text-[#7b8580]">{item.label}</p><p className="mt-2 text-2xl font-semibold text-[#1a2721]">{item.value}</p><p className="mt-1 text-[11px] text-[#84908a]">{item.note}</p></div><div className="grid size-11 place-items-center rounded-xl bg-[#edf5f1] text-[#176b52]"><item.icon className="size-5" /></div></div>)}
        </section>

        <section className="mt-9">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold text-[#202c26]">本地项目</h2><p className="mt-1 text-xs text-[#7b8580]">打开、备份或复制现有项目</p></div><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#929b96]" /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="搜索报告项目" placeholder="搜索项目" className="h-9 w-56 rounded-lg border border-[#dfe5e1] bg-white pl-9 pr-3 text-xs outline-none" /></div></div>
          {loading ? <div className="rounded-2xl border border-[#e0e6e2] bg-white p-10 text-center text-sm text-[#75817a]">正在读取本地项目数据库…</div> : null}
          {!loading && !visibleProjects.length ? <div className="rounded-2xl border border-dashed border-[#bfd0c7] bg-white p-12 text-center"><FolderOpen className="mx-auto size-8 text-[#7ba08f]" /><h3 className="mt-3 text-sm font-semibold text-[#2f4037]">尚无本地项目</h3><p className="mt-2 text-xs text-[#7d8982]">创建新项目，或恢复包含真实文件字节的项目备份。</p></div> : null}
          <div className="grid gap-4 xl:grid-cols-2">
            {visibleProjects.map((project) => (
              <article key={project.projectId} className="rounded-2xl border border-[#dfe5e1] bg-white p-6 shadow-[0_10px_30px_rgba(26,47,38,0.04)]">
                <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#163f32] text-xs font-semibold text-white">{project.enterpriseName.slice(0, 2)}</span><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[#17231d]">{project.title}</h3><StatusBadge tone={project.state === "finalized" ? "green" : "blue"}>{project.state === "finalized" ? "已定稿" : "编制中"}</StatusBadge></div><div className="mt-2 flex flex-wrap gap-3 text-[10px] text-[#748079]"><span className="inline-flex items-center gap-1"><Building2 className="size-3" />{project.enterpriseName}</span><span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />{project.year}</span><span className="inline-flex items-center gap-1"><FileText className="size-3" />{project.fileCount} 个文件</span></div></div></div><span className="rounded bg-[#f1f4f2] px-2 py-1 font-mono text-[9px] text-[#69766f]">{project.projectId}</span></div>
                <div className="mt-5"><div className="mb-2 flex justify-between text-[10px]"><span>Step {project.currentStep} · revision {project.revision}</span><span>{project.progress}%</span></div><ProgressBar value={project.progress} /></div>
                <div className="mt-5 flex flex-wrap justify-between gap-2 border-t border-[#edf0ee] pt-4"><div className="flex gap-2"><button disabled={busy} onClick={() => void downloadProjectBackup(project.projectId).catch((error) => setMessage(error instanceof Error ? error.message : "备份失败"))} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#d8e0dc] px-3 text-[10px] font-semibold text-[#536159] disabled:opacity-40"><Download className="size-3.5" />导出备份</button><button disabled={busy} onClick={() => void copyNextYear(project.projectId)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#d8e0dc] px-3 text-[10px] font-semibold text-[#536159] disabled:opacity-40"><CopyPlus className="size-3.5" />复制下一年度</button></div><Link href={`/reports/${project.projectId}/step/${project.currentStep}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#176b52] px-4 text-[10px] font-semibold text-white">打开项目<ArrowRight className="size-3.5" /></Link></div>
              </article>
            ))}
          </div>
        </section>
      </main>

      {message ? <div role="status" className="fixed bottom-4 right-4 z-[80] flex max-w-md items-start gap-2 rounded-xl border border-[#d4e1da] bg-white px-4 py-3 text-xs leading-5 text-[#405b4b] shadow-xl"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#27805f]" /><span className="flex-1">{message}</span><button aria-label="关闭提示" onClick={() => setMessage("")}><X className="size-3.5" /></button></div> : null}

      {isCreateOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-[#10241c]/45 p-4" role="dialog" aria-modal="true" aria-labelledby="create-report-title" onMouseDown={(event) => event.target === event.currentTarget && setIsCreateOpen(false)}><div className="w-full max-w-[590px] rounded-2xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-[#e8ecea] px-6 py-5"><div><div className="mb-2 grid size-10 place-items-center rounded-xl bg-[#eaf4ef] text-[#176b52]"><Plus className="size-5" /></div><h2 id="create-report-title" className="text-lg font-semibold">新建 ESG 报告</h2><p className="mt-1 text-xs text-[#7a8580]">每个项目获得独立 projectId 和存储空间。</p></div><button aria-label="关闭" onClick={() => setIsCreateOpen(false)}><X className="size-4" /></button></div><div className="space-y-4 p-6"><div><label htmlFor="report-name" className="mb-2 block text-xs font-semibold">报告名称</label><input id="report-name" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="h-10 w-full rounded-lg border border-[#dce3df] px-3 text-sm" /></div><div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="enterprise" className="mb-2 block text-xs font-semibold">企业名称</label><input id="enterprise" value={draft.enterpriseName} onChange={(event) => setDraft({ ...draft, enterpriseName: event.target.value })} className="h-10 w-full rounded-lg border border-[#dce3df] px-3 text-sm" /></div><div><label htmlFor="report-year" className="mb-2 block text-xs font-semibold">报告年度</label><input id="report-year" type="number" min="2000" max="2100" value={draft.year} onChange={(event) => setDraft({ ...draft, year: Number(event.target.value) })} className="h-10 w-full rounded-lg border border-[#dce3df] px-3 text-sm" /></div></div><Notice tone="warning" title="本地项目">数据仅保存在当前浏览器。请定期导出包含文件字节的项目备份。</Notice></div><div className="flex justify-end gap-3 border-t border-[#e8ecea] bg-[#fafbf9] px-6 py-4"><button onClick={() => setIsCreateOpen(false)} className="h-10 rounded-lg border border-[#dbe2de] px-4 text-xs font-semibold">取消</button><button disabled={busy} onClick={() => void createProject()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#176b52] px-4 text-xs font-semibold text-white disabled:opacity-50">创建并开始<ArrowRight className="size-3.5" /></button></div></div></div> : null}
    </div>
  );
}
