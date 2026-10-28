"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronLeft,
  FileText,
  Focus,
  LayoutPanelLeft,
  Maximize2,
  Minus,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Save,
  Settings2,
} from "lucide-react";
import { useProjectData } from "@/components/project/project-data-provider";
import { ChartConfigPanel } from "@/components/presentation/chart-config-panel";
import { ReportPageCanvas, type TocEntry } from "@/components/presentation/report-page";
import { createReportPages } from "@/lib/presentation/pages";
import { getReportTheme, reportThemes } from "@/lib/presentation/themes";
import type { ReportChart, ReportLayoutSettings } from "@/lib/types/presentation";
import type { ContentBlock } from "@/lib/types/writing";

const buttonClass = "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#dce4df] bg-white px-3 text-[11px] font-semibold text-[#53665a] hover:bg-[#f3f7f4] disabled:cursor-not-allowed disabled:opacity-40";
const inputClass = "h-9 w-full rounded-lg border border-[#dce4df] bg-white px-2.5 text-[11px] text-[#405047] outline-none focus:border-[#6ea18a]";

export function StepSix({ initialBlockId }: { initialBlockId?: string }) {
  const router = useRouter();
  const { project, editProject, saveProject, dirty, saving, ready, setMessage } = useProjectData();
  const pages = useMemo(() => createReportPages(project), [project]);
  const chartBlocks = useMemo(() => project.writing.chapters.flatMap((chapter) => chapter.blocks.filter((block) => block.kind === "chart")), [project.writing.chapters]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(() => chartBlocks.some((item) => item.id === initialBlockId) ? initialBlockId ?? null : null);
  const [selectedPageId, setSelectedPageId] = useState(() => pages.find((page) => page.blocks.some((fragment) => fragment.block.id === initialBlockId))?.id ?? "page-cover");
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [settingsTab, setSettingsTab] = useState<"theme" | "chart">(() => initialBlockId ? "chart" : "theme");
  const [focusMode, setFocusMode] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const baseTheme = getReportTheme(project.presentation.themeId);
  const theme = {
    ...baseTheme,
    colors: { ...baseTheme.colors, primary: project.presentation.layout.primaryColor, secondary: project.presentation.layout.secondaryColor },
    fonts: { ...baseTheme.fonts, heading: project.presentation.layout.titleFont, chinese: project.presentation.layout.bodyFont },
  };
  const selectedBlock = chartBlocks.find((block) => block.id === selectedBlockId) ?? null;
  const selectedChart = selectedBlock ? project.presentation.charts.find((chart) => chart.blockId === selectedBlock.id) : undefined;
  const selectedPageIndex = Math.max(0, pages.findIndex((page) => page.id === selectedPageId));
  const selectedPage = pages[selectedPageIndex] ?? pages[0];
  const tocEntries: TocEntry[] = useMemo(() => project.writing.chapters.filter((chapter) => chapter.sourceState !== "upstream-removed").map((chapter) => {
    const index = pages.findIndex((page) => page.chapterId === chapter.id);
    return { chapterId: chapter.id, order: chapter.order, title: chapter.title, pageNumber: Math.max(1, index + 1), level: chapter.parentId ? 2 : 1 };
  }), [pages, project.writing.chapters]);
  const issues = pages.flatMap((page) => page.issues.map((message) => ({ pageId: page.id, message })));

  function updatePresentation(patch: Partial<typeof project.presentation>) {
    editProject((current) => ({ ...current, presentation: { ...current.presentation, ...patch } }));
  }

  function updateLayout(patch: Partial<ReportLayoutSettings>) {
    updatePresentation({ layout: { ...project.presentation.layout, ...patch } });
  }

  async function savePresentation(label = "Step 6 版式与图表保存") {
    const now = new Date().toISOString();
    const next = {
      ...project,
      presentation: { ...project.presentation, savedAt: now, revision: project.presentation.revision + 1 },
    };
    return saveProject(6, label, next);
  }

  async function navigateToStepFive(chapterId?: string, blockId?: string) {
    if (dirty) {
      const saved = await savePresentation("返回 Step 5 前自动保存版式");
      if (!saved) return;
    }
    const query = new URLSearchParams();
    if (chapterId) query.set("chapterId", chapterId);
    if (blockId) query.set("blockId", blockId);
    router.push(`/reports/${project.projectId}/step/5${query.size ? `?${query.toString()}` : ""}`);
  }

  function selectPage(pageId: string) {
    setSelectedPageId(pageId);
    if (project.presentation.preview.mode === "continuous") requestAnimationFrame(() => document.getElementById(`preview-${pageId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function chooseChartBlock(block: ContentBlock) {
    setSelectedBlockId(block.id);
    setSettingsTab("chart");
    setSettingsOpen(true);
    const page = pages.find((item) => item.blocks.some((fragment) => fragment.block.id === block.id));
    if (page) selectPage(page.id);
  }

  function updateChart(chart: ReportChart) {
    editProject((current) => ({
      ...current,
      presentation: {
        ...current.presentation,
        charts: current.presentation.charts.some((item) => item.chartId === chart.chartId)
          ? current.presentation.charts.map((item) => item.chartId === chart.chartId ? chart : item)
          : [...current.presentation.charts, chart],
      },
    }));
  }

  function changeTheme(themeId: string) {
    const nextTheme = getReportTheme(themeId);
    updatePresentation({
      themeId,
      layout: {
        ...project.presentation.layout,
        titleFont: nextTheme.fonts.heading,
        bodyFont: nextTheme.fonts.chinese,
        primaryColor: nextTheme.colors.primary,
        secondaryColor: nextTheme.colors.secondary,
      },
    });
    setMessage("已切换报告主题。正文、表格、披露映射和来源引用保持不变，请保存项目版式。");
  }

  function setPreview(patch: Partial<typeof project.presentation.preview>) {
    updatePresentation({ preview: { ...project.presentation.preview, ...patch } });
  }

  if (!ready) return <div className="p-12 text-center text-sm text-[#64776b]">正在读取统一项目数据与报告版式…</div>;

  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#6d8275]">Step 06 · Visualization & layout</p><h1 className="mt-1.5 text-2xl font-semibold tracking-tight">数据可视化、版式与整本报告预览</h1><p className="mt-2 text-xs leading-5 text-[#78877e]">读取 Step 5 已保存正文和 Step 4 已确认指标，形成可追溯的 A4 连续预览。</p></div>
        <div className="flex flex-wrap gap-2"><button onClick={() => void navigateToStepFive(selectedPage.chapterId, selectedBlockId ?? undefined)} className={buttonClass}><ChevronLeft className="size-3.5" />返回 Step 5 编辑</button><button onClick={() => setFocusMode(!focusMode)} className={buttonClass}><Maximize2 className="size-3.5" />{focusMode ? "退出整本预览" : "整本报告预览"}</button><button disabled={saving} onClick={() => void savePresentation()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#176b52] px-4 text-[11px] font-semibold text-white disabled:opacity-50"><Save className="size-3.5" />{saving ? "保存中…" : dirty ? "保存版式" : "版式已保存"}</button></div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dbe6df] bg-white p-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => setPreview({ mode: "single" })} className={`${buttonClass} ${project.presentation.preview.mode === "single" ? "!border-[#83b29e] !bg-[#eaf4ef] !text-[#176b52]" : ""}`}><FileText className="size-3.5" />单页</button>
          <button onClick={() => setPreview({ mode: "continuous" })} className={`${buttonClass} ${project.presentation.preview.mode === "continuous" ? "!border-[#83b29e] !bg-[#eaf4ef] !text-[#176b52]" : ""}`}><BookOpen className="size-3.5" />连续阅读</button>
          <button onClick={() => setPreview({ readingMode: project.presentation.preview.readingMode === "editing" ? "formal" : "editing" })} className={buttonClass}><Focus className="size-3.5" />{project.presentation.preview.readingMode === "editing" ? "编辑预览" : "正式阅读"}</button>
        </div>
        <div className="flex items-center gap-1.5"><button aria-label="缩小预览" onClick={() => setPreview({ zoom: Math.max(.45, Number((project.presentation.preview.zoom - .08).toFixed(2))) })} className={`${buttonClass} !px-2`}><Minus className="size-3.5" /></button><span className="w-12 text-center text-[10px] font-semibold text-[#5d6e64]">{Math.round(project.presentation.preview.zoom * 100)}%</span><button aria-label="放大预览" onClick={() => setPreview({ zoom: Math.min(1, Number((project.presentation.preview.zoom + .08).toFixed(2))) })} className={`${buttonClass} !px-2`}><Plus className="size-3.5" /></button><button onClick={() => setPreview({ zoom: .72 })} className={buttonClass}>适合页面</button><button onClick={() => setSettingsOpen(!settingsOpen)} aria-label={settingsOpen ? "收起版式设置" : "展开版式设置"} className={`${buttonClass} !px-2`}>{settingsOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}</button></div>
      </div>

      <div className={`presentation-grid ${!settingsOpen ? "presentation-grid-settings-closed" : ""} ${focusMode ? "presentation-grid-focus" : ""}`}>
        {!focusMode ? <ReportNavigation pages={pages} selectedPageId={selectedPage.id} tocEntries={tocEntries} chartBlocks={chartBlocks} selectedBlockId={selectedBlockId} onSelectPage={selectPage} onSelectChart={chooseChartBlock} /> : null}

        <section className="min-w-0">
          {issues.length ? <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-800"><span className="inline-flex items-center gap-1.5"><AlertTriangle className="size-3.5" />发现 {issues.length} 项内容或版面待复核；预览不会截断正文。</span><button onClick={() => selectPage(issues[0].pageId)} className="font-semibold text-[#176b52]">定位首项</button></div> : null}
          <div ref={previewRef} className="scrollbar-subtle max-h-[calc(100vh-180px)] overflow-auto rounded-2xl border border-[#dce3df] bg-[#dde5e0] p-5">
            <div className="mx-auto flex min-w-max flex-col items-center gap-7">
              {(project.presentation.preview.mode === "continuous" ? pages : [selectedPage]).map((page) => (
                <ScaledPage key={page.id} pageId={page.id} zoom={project.presentation.preview.zoom}>
                  <ReportPageCanvas
                    page={page}
                    pageNumber={pages.findIndex((item) => item.id === page.id) + 1}
                    project={project}
                    theme={theme}
                    layout={project.presentation.layout}
                    tocEntries={tocEntries}
                    formal={project.presentation.preview.readingMode === "formal"}
                    selectedBlockId={selectedBlockId ?? undefined}
                    onEditBlock={(chapterId, blockId) => {
                      const block = chartBlocks.find((item) => item.id === blockId);
                      if (block) chooseChartBlock(block);
                      else void navigateToStepFive(chapterId, blockId);
                    }}
                  />
                </ScaledPage>
              ))}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-[9px] text-[#85928a]"><span>A4 纵向 · {pages.length} 个浏览器预览页面</span><span>预览页码不等同于 Step 8 最终导出页码</span></div>
        </section>

        {settingsOpen && !focusMode ? <aside className="presentation-settings self-start overflow-hidden rounded-2xl border border-[#dfe7e2] bg-white" aria-label="报告版式设置">
          <div className="flex items-center justify-between border-b border-[#e9eeeb] p-4"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-[#eaf4ef] text-[#176b52]"><Settings2 className="size-4" /></span><div><h2 className="text-sm font-semibold text-[#294333]">版式设置</h2><p className="mt-0.5 text-[9px] text-[#839188]">轻量配置 · 不保存页面栅格图</p></div></div><button onClick={() => setSettingsOpen(false)} aria-label="收起版式设置" className="text-[#819086]"><PanelRightClose className="size-4" /></button></div>
          <div className="grid grid-cols-2 gap-1 border-b border-[#e8eeea] p-2"><button onClick={() => setSettingsTab("theme")} className={`rounded-lg px-2 py-2 text-[10px] font-semibold ${settingsTab === "theme" ? "bg-[#eaf4ef] text-[#176b52]" : "text-[#77877d]"}`}>主题与页面</button><button onClick={() => setSettingsTab("chart")} className={`rounded-lg px-2 py-2 text-[10px] font-semibold ${settingsTab === "chart" ? "bg-[#eaf4ef] text-[#176b52]" : "text-[#77877d]"}`}>图表配置</button></div>
          <div className="scrollbar-subtle max-h-[calc(100vh-240px)] overflow-y-auto p-4">
            {settingsTab === "theme" ? <ThemeAndLayoutPanel themeId={project.presentation.themeId} layout={project.presentation.layout} onTheme={changeTheme} onLayout={updateLayout} /> : <ChartConfigPanel key={`${selectedBlock?.id ?? "none"}-${selectedChart?.revision ?? 0}-${theme.id}`} block={selectedBlock} chart={selectedChart} observations={project.presentation.observations} theme={theme} policy={project.writing.policy} onChange={updateChart} />}
          </div>
        </aside> : null}
      </div>
    </div>
  );
}

function ScaledPage({ pageId, zoom, children }: { pageId: string; zoom: number; children: React.ReactNode }) {
  return <div id={`preview-${pageId}`} className="scroll-mt-4" style={{ width: 794 * zoom, height: 1123 * zoom }}><div style={{ width: 794, height: 1123, transform: `scale(${zoom})`, transformOrigin: "top left" }}>{children}</div></div>;
}

function ReportNavigation({ pages, selectedPageId, tocEntries, chartBlocks, selectedBlockId, onSelectPage, onSelectChart }: { pages: ReturnType<typeof createReportPages>; selectedPageId: string; tocEntries: TocEntry[]; chartBlocks: ContentBlock[]; selectedBlockId: string | null; onSelectPage: (id: string) => void; onSelectChart: (block: ContentBlock) => void }) {
  return <aside className="presentation-navigation self-start overflow-hidden rounded-2xl border border-[#dfe7e2] bg-white"><div className="border-b border-[#e9eeeb] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-[#2d4736]"><LayoutPanelLeft className="size-4 text-[#176b52]" />报告导航</div><p className="mt-1 text-[9px] text-[#87938c]">章节快速定位与页面缩略图</p></div><div className="scrollbar-subtle max-h-[calc(100vh-205px)] overflow-y-auto p-3"><button onClick={() => onSelectPage("page-cover")} className={`mb-1 w-full rounded-lg px-2.5 py-2 text-left text-[10px] font-semibold ${selectedPageId === "page-cover" ? "bg-[#eaf4ef] text-[#176b52]" : "text-[#5d6d64] hover:bg-[#f5f8f6]"}`}>报告封面</button><button onClick={() => onSelectPage("page-toc")} className={`mb-3 w-full rounded-lg px-2.5 py-2 text-left text-[10px] font-semibold ${selectedPageId === "page-toc" ? "bg-[#eaf4ef] text-[#176b52]" : "text-[#5d6d64] hover:bg-[#f5f8f6]"}`}>自动目录</button><p className="mb-2 px-2 text-[9px] font-semibold uppercase tracking-wider text-[#95a098]">章节</p>{tocEntries.map((entry) => { const page = pages.find((item) => item.chapterId === entry.chapterId); return <button key={entry.chapterId} onClick={() => page && onSelectPage(page.id)} className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left ${entry.level === 2 ? "pl-5" : ""} ${page?.id === selectedPageId ? "bg-[#eaf4ef] text-[#176b52]" : "text-[#65756b] hover:bg-[#f5f8f6]"}`}><span className="text-[9px] opacity-60">{entry.order}</span><span className="min-w-0 flex-1 truncate text-[10px] font-medium">{entry.title}</span><span className="text-[8px] opacity-55">{entry.pageNumber}</span></button>; })}<p className="mb-2 mt-4 px-2 text-[9px] font-semibold uppercase tracking-wider text-[#95a098]">图表占位</p>{chartBlocks.map((block) => <button key={block.id} onClick={() => onSelectChart(block)} className={`mb-1 w-full rounded-lg border px-2.5 py-2 text-left text-[10px] ${selectedBlockId === block.id ? "border-[#91bba8] bg-[#eef6f2] text-[#176b52]" : "border-[#e5eae7] text-[#68786e]"}`}>{block.title}</button>)}<p className="mb-2 mt-4 px-2 text-[9px] font-semibold uppercase tracking-wider text-[#95a098]">页面缩略图</p><div className="grid grid-cols-2 gap-2">{pages.map((page, index) => <button key={page.id} onClick={() => onSelectPage(page.id)} aria-label={`预览第 ${index + 1} 页 ${page.title}`} className={`rounded-lg border p-1.5 ${selectedPageId === page.id ? "border-[#176b52] bg-[#edf6f1]" : "border-[#e0e6e2]"}`}><span className="flex aspect-[210/297] flex-col rounded bg-white p-1 shadow-sm"><span className="h-1 rounded" style={{ backgroundColor: selectedPageId === page.id ? "#176b52" : "#cbd8d1" }} /><span className="mt-1 h-1 w-2/3 rounded bg-[#e5ebe7]" /><span className="mt-1 h-1 w-full rounded bg-[#eff3f1]" /><span className="mt-auto text-[7px] text-[#89958e]">{index + 1}</span></span></button>)}</div></div></aside>;
}

function ThemeAndLayoutPanel({ themeId, layout, onTheme, onLayout }: { themeId: string; layout: ReportLayoutSettings; onTheme: (id: string) => void; onLayout: (patch: Partial<ReportLayoutSettings>) => void }) {
  return <div className="space-y-5"><div><p className="mb-2 text-[10px] font-semibold text-[#536159]">报告主题</p><div className="space-y-2">{reportThemes.map((theme) => <button key={theme.id} aria-label={`选择主题 ${theme.name}`} onClick={() => onTheme(theme.id)} className={`w-full rounded-xl border p-3 text-left ${themeId === theme.id ? "border-[#79aa95] bg-[#eef6f2]" : "border-[#e0e6e2]"}`}><div className="flex items-center gap-2"><span className="size-5 rounded-full" style={{ backgroundColor: theme.colors.primary }} /><span className="text-[11px] font-semibold text-[#34483c]">{theme.name}</span>{themeId === theme.id ? <Check className="ml-auto size-3.5 text-[#176b52]" /> : null}</div><p className="mt-2 text-[9px] leading-4 text-[#809087]">{theme.description}</p><div className="mt-2 flex gap-1">{theme.chartStyle.palette.slice(0, 4).map((color) => <span key={color} className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: color }} />)}</div></button>)}</div></div><div className="border-t border-[#e8edea] pt-4"><p className="mb-3 text-[10px] font-semibold text-[#536159]">纸张与页面设置</p><div className="grid grid-cols-2 gap-2"><Field label="纸张"><select aria-label="纸张尺寸" value={layout.paperSize} disabled className={inputClass}><option>A4</option></select></Field><Field label="方向"><select aria-label="页面方向" value={layout.orientation} disabled className={inputClass}><option value="portrait">纵向</option></select></Field></div><div className="mt-3 grid grid-cols-2 gap-2">{(["top", "right", "bottom", "left"] as const).map((side) => <Field key={side} label={`${{ top: "上", right: "右", bottom: "下", left: "左" }[side]}边距 mm`}><input aria-label={`${side} 页面边距`} type="number" min={12} max={28} className={inputClass} value={layout.margins[side]} onChange={(event) => onLayout({ margins: { ...layout.margins, [side]: Number(event.target.value) } })} /></Field>)}</div></div><div className="border-t border-[#e8edea] pt-4"><p className="mb-3 text-[10px] font-semibold text-[#536159]">字体与颜色</p><Field label="标题字体"><select aria-label="标题字体" value={layout.titleFont} onChange={(event) => onLayout({ titleFont: event.target.value })} className={inputClass}><option value={'"PingFang SC", "Microsoft YaHei", sans-serif'}>苹方 / 微软雅黑</option><option value={'"Microsoft YaHei", "PingFang SC", sans-serif'}>微软雅黑 / 苹方</option><option value={'Georgia, "Times New Roman", serif'}>Georgia / Times</option></select></Field><Field label="正文字体"><select aria-label="正文字体" value={layout.bodyFont} onChange={(event) => onLayout({ bodyFont: event.target.value })} className={`${inputClass} mt-2`}><option value={'"PingFang SC", "Microsoft YaHei", sans-serif'}>苹方 / 微软雅黑</option><option value={'"Microsoft YaHei", "PingFang SC", sans-serif'}>微软雅黑 / 苹方</option><option value={'Georgia, "Times New Roman", serif'}>Georgia / Times</option></select></Field><div className="mt-2 grid grid-cols-2 gap-2"><Field label="主色"><input aria-label="报告主色" type="color" value={layout.primaryColor} onChange={(event) => onLayout({ primaryColor: event.target.value })} className="h-9 w-full rounded-lg border border-[#dce4df] bg-white p-1" /></Field><Field label="辅助色"><input aria-label="报告辅助色" type="color" value={layout.secondaryColor} onChange={(event) => onLayout({ secondaryColor: event.target.value })} className="h-9 w-full rounded-lg border border-[#dce4df] bg-white p-1" /></Field></div></div><div className="border-t border-[#e8edea] pt-4"><p className="mb-3 text-[10px] font-semibold text-[#536159]">正文与页面布局</p><div className="grid grid-cols-2 gap-2"><Field label="正文字号"><input aria-label="正文字号" type="number" min={9} max={14} step={.5} className={inputClass} value={layout.bodyFontSize} onChange={(event) => onLayout({ bodyFontSize: Number(event.target.value) })} /></Field><Field label="行距"><input aria-label="正文行距" type="number" min={1.4} max={2.2} step={.05} className={inputClass} value={layout.lineHeight} onChange={(event) => onLayout({ lineHeight: Number(event.target.value) })} /></Field></div><Field label="内容列数"><select aria-label="内容列数" value={layout.contentColumns} onChange={(event) => onLayout({ contentColumns: Number(event.target.value) as 1 | 2 })} className={`${inputClass} mt-2`}><option value={1}>单栏</option><option value={2}>双栏</option></select></Field><div className="mt-3 grid grid-cols-2 gap-2 text-[9px] text-[#63746a]"><Toggle label="页眉" checked={layout.headerEnabled} onChange={(checked) => onLayout({ headerEnabled: checked })} /><Toggle label="页脚" checked={layout.footerEnabled} onChange={(checked) => onLayout({ footerEnabled: checked })} /><Toggle label="预览页码" checked={layout.showPageNumbers} onChange={(checked) => onLayout({ showPageNumbers: checked })} /></div></div><div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-[9px] leading-5 text-blue-800">当前页码为浏览器预览定位结果。Step 8 正式导出需要根据字体、渲染器与输出格式重新分页和计算页码。</div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[9px] font-semibold text-[#6b796f]">{label}</span>{children}</label>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center gap-1.5 rounded-lg border border-[#e1e7e3] p-2"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-[#176b52]" />{label}</label>; }
