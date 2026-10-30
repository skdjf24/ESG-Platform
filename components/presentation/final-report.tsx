"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { useProjectData } from "@/components/project/project-data-provider";
import { ReportPageCanvas, type TocEntry } from "@/components/presentation/report-page";
import { activeFinalVersion, isFinalVersionCurrent } from "@/lib/finalization/state";
import { createReportPages } from "@/lib/presentation/pages";
import { getReportTheme } from "@/lib/presentation/themes";

export function FinalReport() {
  const router = useRouter();
  const { project, ready } = useProjectData();
  const pages = useMemo(() => createReportPages(project), [project]);
  const version = activeFinalVersion(project);
  const current = isFinalVersionCurrent(project, version);
  const baseTheme = getReportTheme(project.presentation.themeId);
  const theme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: project.presentation.layout.primaryColor,
      secondary: project.presentation.layout.secondaryColor,
    },
    fonts: {
      ...baseTheme.fonts,
      heading: project.presentation.layout.titleFont,
      chinese: project.presentation.layout.bodyFont,
    },
  };
  const tocEntries: TocEntry[] = project.writing.chapters.filter((chapter) => chapter.sourceState !== "upstream-removed").map((chapter) => {
    const index = pages.findIndex((page) => page.chapterId === chapter.id);
    return {
      chapterId: chapter.id,
      order: chapter.order,
      title: chapter.title,
      pageNumber: Math.max(1, index + 1),
      level: chapter.parentId ? 2 : 1,
    };
  });

  if (!ready) return <div className="grid min-h-screen place-items-center text-sm text-[#607269]">正在读取定稿版本…</div>;
  if (!version || !current) {
    return <div className="grid min-h-screen place-items-center bg-[#f4f6f5] p-6"><div className="max-w-lg rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-xl"><h1 className="text-xl font-semibold text-[#293d32]">没有可输出的当前定稿</h1><p className="mt-3 text-xs leading-6 text-[#748079]">尚未创建定稿版本，或报告输入、规则版本及 Step 7 人工结论已经变化。请返回 Step 8 重新完成门禁检查。</p><button type="button" onClick={() => router.push(`/reports/${project.projectId}/step/8`)} className="mt-5 rounded-lg bg-[#176b52] px-4 py-2 text-xs font-semibold text-white">返回 Step 8</button></div></div>;
  }

  return (
    <div className="final-report-shell min-h-screen bg-[#dfe5e1]">
      <header className="final-report-toolbar sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-[#d7dfda] bg-white/95 px-5 py-3 shadow-sm backdrop-blur">
        <div><p className="text-xs font-semibold text-[#2f4337]">{version.label}</p><p className="mt-1 text-[9px] text-[#7d8a82]">最终导出页码 · {pages.length} 页 · 来源指纹 {version.sourceFingerprint}</p></div>
        <div className="flex gap-2"><button type="button" onClick={() => router.push(`/reports/${project.projectId}/step/8`)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#d7dfda] px-3 text-[10px] font-semibold text-[#53665a]"><ArrowLeft className="size-3.5" />返回 Step 8</button><button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#176b52] px-4 text-[10px] font-semibold text-white"><Printer className="size-3.5" />打印 / 保存 PDF</button></div>
      </header>
      <main className="final-report-pages mx-auto flex w-fit flex-col gap-7 py-8">
        {pages.map((page, index) => <div key={page.id} className="final-report-page"><ReportPageCanvas page={page} pageNumber={index + 1} project={project} theme={theme} layout={project.presentation.layout} tocEntries={tocEntries} formal selectedBlockId={undefined} onEditBlock={() => undefined} /></div>)}
      </main>
    </div>
  );
}
