"use client";

import { AlertTriangle, ArrowUpRight, BarChart3, FileText, Link2 } from "lucide-react";
import { ReportChartView } from "@/components/presentation/report-chart";
import type { ReportProjectData } from "@/lib/types/project-data";
import type { ReportLayoutSettings, ReportTheme } from "@/lib/types/presentation";
import type { ReportPreviewPage } from "@/lib/presentation/pages";
import { sanitizeHtml } from "@/lib/writing/document";

const MM_TO_PX = 3.78;

export interface TocEntry {
  chapterId: string;
  order: string;
  title: string;
  pageNumber: number;
  level: number;
}

export function ReportPageCanvas({
  page,
  pageNumber,
  project,
  theme,
  layout,
  tocEntries,
  formal,
  selectedBlockId,
  onEditBlock,
}: {
  page: ReportPreviewPage;
  pageNumber: number;
  project: ReportProjectData;
  theme: ReportTheme;
  layout: ReportLayoutSettings;
  tocEntries: TocEntry[];
  formal: boolean;
  selectedBlockId?: string;
  onEditBlock: (chapterId: string, blockId: string) => void;
}) {
  const top = layout.margins.top * MM_TO_PX;
  const right = layout.margins.right * MM_TO_PX;
  const bottom = layout.margins.bottom * MM_TO_PX;
  const left = layout.margins.left * MM_TO_PX;
  const bodyHeight = 1123 - top - bottom;
  const pageStyle = {
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
    fontFamily: theme.fonts.chinese,
    "--report-primary": theme.colors.primary,
    "--report-secondary": theme.colors.secondary,
    "--report-accent": theme.colors.accent,
  } as React.CSSProperties;

  if (page.type === "cover") {
    return (
      <article data-report-page={page.id} data-page-type="cover" className="report-page relative h-[1123px] w-[794px] overflow-hidden bg-white shadow-[0_24px_70px_rgba(21,47,35,.13)]" style={pageStyle}>
        <div className="absolute inset-x-0 top-0 h-3" style={{ backgroundColor: theme.colors.accent }} />
        <div className="absolute -right-40 -top-40 size-[520px] rounded-full opacity-15" style={{ backgroundColor: theme.colors.primary }} />
        <div className="absolute bottom-0 left-0 h-[36%] w-full" style={{ backgroundColor: theme.colors.primary }} />
        <div className="absolute left-[76px] top-[92px] text-[11px] font-semibold uppercase tracking-[.34em]" style={{ color: theme.colors.primary }}>ESG DISCLOSURE REPORT</div>
        <div className="absolute left-[76px] right-[76px] top-[260px]">
          <p className="text-sm font-medium" style={{ color: theme.colors.muted }}>{project.enterprise.name}</p>
          <h1 className="mt-8 max-w-[580px] text-[52px] font-semibold leading-[1.16] tracking-[-.04em]">{project.report.year}<br />环境、社会及治理报告</h1>
          <div className="mt-10 h-1 w-20" style={{ backgroundColor: theme.colors.accent }} />
          <p className="mt-6 max-w-md text-[13px] leading-7" style={{ color: theme.colors.muted }}>基于已保存的报告章节、企业事实和来源关联生成的整本预览。正式导出将在 Step 8 重新计算页码。</p>
        </div>
        <div className="absolute bottom-[106px] left-[76px] text-white">
          <p className="text-[11px] uppercase tracking-[.28em] text-white/60">REPORTING PERIOD</p>
          <p className="mt-3 text-lg font-medium">{project.report.reportingPeriod.start} — {project.report.reportingPeriod.end}</p>
        </div>
      </article>
    );
  }

  if (page.type === "chapter-cover") {
    return (
      <article data-report-page={page.id} data-page-type="chapter-cover" className="report-page relative h-[1123px] w-[794px] overflow-hidden bg-white shadow-[0_24px_70px_rgba(21,47,35,.13)]" style={pageStyle}>
        <div className="absolute inset-y-0 left-0 w-[92px]" style={{ backgroundColor: theme.colors.primary }} />
        <div className="absolute left-[144px] right-[80px] top-[205px]">
          <p className="text-[12px] font-semibold uppercase tracking-[.26em]" style={{ color: theme.colors.secondary }}>CHAPTER {page.chapterOrder}</p>
          <h1 className="mt-7 text-[45px] font-semibold leading-tight tracking-[-.03em]">{page.title}</h1>
          <div className="mt-10 h-1 w-20" style={{ backgroundColor: theme.colors.accent }} />
          <p className="mt-7 max-w-lg text-[14px] leading-8" style={{ color: theme.colors.muted }}>{project.reportSections.find((item) => item.id === page.chapterId)?.description ?? "本章节内容来自已保存的 Step 5 正文。"}</p>
        </div>
        <ReportFooter pageNumber={pageNumber} theme={theme} layout={layout} />
      </article>
    );
  }

  return (
    <article
      data-report-page={page.id}
      data-page-type={page.type}
      className="report-page relative h-[1123px] w-[794px] bg-white shadow-[0_24px_70px_rgba(21,47,35,.13)]"
      style={{ ...pageStyle, padding: `${top}px ${right}px ${bottom}px ${left}px` }}
    >
      {layout.headerEnabled ? <ReportHeader project={project} theme={theme} /> : null}
      <main className="report-page-body flex flex-col" style={{ height: bodyHeight, fontSize: layout.bodyFontSize, lineHeight: layout.lineHeight }}>
        {page.type === "toc" ? <TableOfContents entries={tocEntries} theme={theme} /> : (
          <>
            <div className="mb-7 flex items-end justify-between gap-4 border-b pb-4" style={{ borderColor: `${theme.colors.primary}28` }}>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[.2em]" style={{ color: theme.colors.secondary }}>{page.type.replace("-", " ")} · {page.chapterOrder}</p>
                <h2 className="mt-2 text-[23px] font-semibold leading-tight">{page.title}</h2>
              </div>
              {page.issues.length ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-semibold text-amber-700"><AlertTriangle className="size-3" />{page.issues.length} 项待复核</span> : null}
            </div>
            <div className={`min-h-0 flex-1 content-start gap-5 ${layout.contentColumns === 2 ? "columns-2" : "flex flex-col"}`}>
              {page.blocks.map((fragment) => {
                const block = fragment.block;
                const chart = project.presentation.charts.find((item) => item.blockId === block.id);
                const pending = Boolean(block.pendingKind && !block.resolved);
                if (formal && block.kind === "todo") {
                  return <div key={fragment.fragmentId} className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-[10px] text-slate-500">内部待办已从正式阅读内容中排除：{block.title}</div>;
                }
                return (
                  <button
                    type="button"
                    key={fragment.fragmentId}
                    data-preview-block-id={block.id}
                    onClick={() => onEditBlock(block.chapterId, block.id)}
                    className={`group relative mb-5 block w-full break-inside-avoid text-left ${selectedBlockId === block.id ? "rounded-xl ring-2 ring-offset-4" : ""}`}
                    style={selectedBlockId === block.id ? { outlineColor: theme.colors.primary, color: "inherit" } : { color: "inherit" }}
                    aria-label={`返回 Step 5 编辑 ${block.title}`}
                  >
                    <span className="absolute -right-1 -top-1 z-10 hidden items-center gap-1 rounded-full bg-white px-2 py-1 text-[9px] font-semibold shadow group-hover:inline-flex" style={{ color: theme.colors.primary }}><ArrowUpRight className="size-3" />编辑原文</span>
                    {pending ? <div className="mb-2 inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-[9px] font-semibold text-amber-700"><AlertTriangle className="size-3" />{formal ? `${block.pendingKind} · 不作为已完成披露` : `编辑预览 · ${block.pendingKind}`}</div> : null}
                    {fragment.continued ? <p className="mb-2 text-[9px] font-medium" style={{ color: theme.colors.muted }}>续上页 · {block.title}</p> : null}
                    {block.kind === "paragraph" ? <RichBody html={fragment.html ?? block.html} /> : null}
                    {block.kind === "case" ? <CaseBlock title={block.title} html={fragment.html ?? block.html} theme={theme} /> : null}
                    {block.kind === "table" ? <DataTable title={block.title} rows={fragment.rows ?? block.rows} theme={theme} /> : null}
                    {block.kind === "chart" ? chart ? <ChartBlock chart={chart} theme={theme} /> : <ChartPlaceholder title={block.title} theme={theme} /> : null}
                    {block.kind === "todo" ? <TodoBlock title={block.title} html={block.html} /> : null}
                    <div className="mt-2 flex items-center gap-3 text-[8px]" style={{ color: theme.colors.muted }}>
                      <span className="inline-flex items-center gap-1"><Link2 className="size-2.5" />blockId: {block.id}</span>
                      {block.sourceReferences.length ? <span>{block.sourceReferences.length} 处来源</span> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </main>
      <ReportFooter pageNumber={pageNumber} theme={theme} layout={layout} />
    </article>
  );
}

function ReportHeader({ project, theme }: { project: ReportProjectData; theme: ReportTheme }) {
  return <header className="absolute left-[72px] right-[64px] top-[25px] flex items-center justify-between border-b pb-2 text-[8px] font-medium uppercase tracking-[.12em]" style={{ borderColor: `${theme.colors.primary}22`, color: theme.colors.muted }}><span>{theme.header.template.replace("华澜新材料", project.enterprise.shortName)}</span><span>{project.report.year}</span></header>;
}

function ReportFooter({ pageNumber, theme, layout }: { pageNumber: number; theme: ReportTheme; layout: ReportLayoutSettings }) {
  if (!layout.footerEnabled && !layout.showPageNumbers) return null;
  return <footer className="absolute bottom-[25px] left-[72px] right-[64px] flex items-center justify-between border-t pt-2 text-[8px] font-medium tracking-[.12em]" style={{ borderColor: `${theme.colors.primary}22`, color: theme.colors.muted }}><span>{layout.footerEnabled ? theme.footer.template : ""}</span>{layout.showPageNumbers ? <span>{theme.pageNumber.label} {String(pageNumber).padStart(2, "0")}</span> : null}</footer>;
}

function TableOfContents({ entries, theme }: { entries: TocEntry[]; theme: ReportTheme }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-[.24em]" style={{ color: theme.colors.secondary }}>CONTENTS</p><h1 className="mt-4 text-[34px] font-semibold">目录</h1><div className="mt-10 space-y-1">{entries.map((entry) => <div key={entry.chapterId} className={`flex items-baseline gap-3 border-b py-3 ${entry.level === 2 ? "ml-8" : ""}`} style={{ borderColor: `${theme.colors.primary}18` }}><span className="w-10 shrink-0 text-[10px] font-semibold" style={{ color: theme.colors.secondary }}>{entry.order}</span><span className={`flex-1 ${entry.level === 1 ? "text-[13px] font-semibold" : "text-[11px]"}`}>{entry.title}</span><span className="text-[10px] tabular-nums" style={{ color: theme.colors.muted }}>{entry.pageNumber}</span></div>)}</div><p className="mt-8 text-[9px] leading-5" style={{ color: theme.colors.muted }}>当前为浏览器预览页码，仅用于编排定位；正式导出页码将在 Step 8 根据最终渲染环境重新计算。</p></div>;
}

function RichBody({ html }: { html: string }) {
  return <div className="report-rich-text text-justify leading-[1.9] [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mb-3 [&_strong]:font-semibold [&_ul]:list-disc" dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
}

function DataTable({ title, rows, theme }: { title: string; rows: string[][]; theme: ReportTheme }) {
  return <div><h3 className="mb-3 text-[14px] font-semibold">{title}</h3><table className="w-full table-fixed border-collapse text-[9px]"><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} style={rowIndex === 0 ? { backgroundColor: `${theme.colors.primary}12`, color: theme.colors.primary } : {}}>{row.map((cell, columnIndex) => <td key={columnIndex} className="break-words border px-2 py-2.5 align-top" style={{ borderColor: `${theme.colors.primary}20` }}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

function CaseBlock({ title, html, theme }: { title: string; html: string; theme: ReportTheme }) {
  return <div className="rounded-xl border-l-4 p-5" style={{ borderColor: theme.colors.accent, backgroundColor: `${theme.colors.primary}08` }}><p className="mb-3 text-[9px] font-semibold uppercase tracking-[.18em]" style={{ color: theme.colors.secondary }}>ESG CASE</p><h3 className="mb-3 text-[15px] font-semibold">{title}</h3><RichBody html={html} /></div>;
}

function ChartBlock({ chart, theme }: { chart: ReportProjectData["presentation"]["charts"][number]; theme: ReportTheme }) {
  return <div className="rounded-xl border p-4" style={{ borderColor: `${theme.colors.primary}20` }}><div className="mb-2 flex items-start justify-between gap-3"><div><p className="text-[9px] font-semibold uppercase tracking-[.14em]" style={{ color: theme.colors.secondary }}>ESG METRIC</p><h3 className="mt-1 text-[14px] font-semibold">{chart.title}</h3></div><span className={`rounded-full px-2 py-1 text-[8px] font-semibold ${chart.status === "需更新" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{chart.status}</span></div><ReportChartView chart={chart} /><p className="mt-2 text-[9px] leading-4" style={{ color: theme.colors.muted }}>{chart.caption || "图表说明待补充。"}</p></div>;
}

function ChartPlaceholder({ title, theme }: { title: string; theme: ReportTheme }) {
  return <div className="grid min-h-56 place-items-center rounded-xl border border-dashed p-6 text-center" style={{ borderColor: `${theme.colors.primary}55`, backgroundColor: `${theme.colors.primary}06` }}><div><BarChart3 className="mx-auto size-8" style={{ color: theme.colors.secondary }} /><h3 className="mt-3 text-[14px] font-semibold">{title}</h3><p className="mt-2 text-[10px]" style={{ color: theme.colors.muted }}>待配置 · 请在右侧选择已确认指标</p></div></div>;
}

function TodoBlock({ title, html }: { title: string; html: string }) {
  return <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-amber-900"><p className="flex items-center gap-2 text-[11px] font-semibold"><FileText className="size-3.5" />内部待办 · {title}</p><div className="mt-2 text-[10px] leading-5" dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} /></div>;
}
