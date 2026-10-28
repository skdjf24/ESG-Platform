import type { ReportProjectData } from "@/lib/types/project-data";
import type { ReportPageType } from "@/lib/types/presentation";
import type { ContentBlock, WritingChapter } from "@/lib/types/writing";
import { plainText } from "@/lib/writing/document";

export interface PreviewBlock {
  block: ContentBlock;
  fragmentId: string;
  html?: string;
  rows?: string[][];
  continued?: boolean;
}

export interface ReportPreviewPage {
  id: string;
  type: ReportPageType;
  title: string;
  chapterId?: string;
  chapterOrder?: string;
  blocks: PreviewBlock[];
  issues: string[];
}

function orderValue(value: string) {
  return value.split(".").reduce((total, part, index) => total + (Number(part) || 0) / (10 ** index), 0);
}

function blockWeight(block: PreviewBlock) {
  const source = block.block;
  if (source.kind === "heading") return 10;
  if (source.kind === "table") return 15 + Math.max(0, (block.rows ?? source.rows).length - 1) * 6;
  if (source.kind === "chart") return 43;
  if (source.kind === "case") return 24 + Math.ceil(plainText(block.html ?? source.html).length / 70) * 5;
  if (source.kind === "todo") return 20;
  return 14 + Math.ceil(plainText(block.html ?? source.html).length / 75) * 5;
}

function splitHtmlBlock(block: ContentBlock): PreviewBlock[] {
  const textLength = plainText(block.html).length;
  if (textLength <= 620) return [{ block, fragmentId: block.id }];
  const host = typeof document === "undefined" ? null : document.createElement("div");
  if (!host) return [{ block, fragmentId: block.id }];
  host.innerHTML = block.html;
  const elements = [...host.children];
  if (elements.length < 2) return [{ block, fragmentId: block.id }];
  const groups: string[][] = [[]];
  let count = 0;
  for (const element of elements) {
    const length = element.textContent?.length ?? 0;
    if (count > 0 && count + length > 560) { groups.push([]); count = 0; }
    groups.at(-1)?.push(element.outerHTML);
    count += length;
  }
  return groups.map((html, index) => ({ block, fragmentId: `${block.id}-fragment-${index + 1}`, html: html.join(""), continued: index > 0 }));
}

function splitBlock(block: ContentBlock): PreviewBlock[] {
  if (block.kind === "table" && block.rows.length > 9) {
    const header = block.rows[0] ?? [];
    const chunks: PreviewBlock[] = [];
    for (let index = 1; index < block.rows.length; index += 8) {
      chunks.push({ block, fragmentId: `${block.id}-rows-${index}`, rows: [header, ...block.rows.slice(index, index + 8)], continued: index > 1 });
    }
    return chunks;
  }
  if (["paragraph", "case"].includes(block.kind)) return splitHtmlBlock(block);
  return [{ block, fragmentId: block.id }];
}

function pageTypeFor(chapter: WritingChapter, blocks: PreviewBlock[]): ReportPageType {
  if (chapter.id === "section-2") return "about";
  if (chapter.id === "section-7") return "appendix";
  if (blocks.some((item) => item.block.kind === "chart" || item.block.kind === "table")) return "performance";
  if (blocks.some((item) => item.block.kind === "case")) return "case";
  return "content";
}

function issuesFor(blocks: PreviewBlock[]) {
  const issues: string[] = [];
  for (const { block } of blocks) {
    if (block.kind === "chart") issues.push(`图表“${block.title}”需要确认配置与指标版本。`);
    if (block.kind === "todo") issues.push(`内部待办“${block.title}”不会作为已完成披露。`);
    if (block.pendingKind && !block.resolved) issues.push(`“${block.title}”仍为${block.pendingKind}。`);
  }
  return [...new Set(issues)];
}

export function createReportPages(project: ReportProjectData): ReportPreviewPage[] {
  const pages: ReportPreviewPage[] = [
    { id: "page-cover", type: "cover", title: "报告封面", blocks: [], issues: [] },
    { id: "page-toc", type: "toc", title: "自动目录", blocks: [], issues: [] },
  ];
  const chapters = project.writing.chapters
    .filter((chapter) => chapter.sourceState !== "upstream-removed")
    .slice()
    .sort((left, right) => orderValue(left.order) - orderValue(right.order));

  for (const chapter of chapters) {
    if (!chapter.parentId) {
      pages.push({
        id: `page-${chapter.id}-cover`, type: "chapter-cover", title: chapter.title,
        chapterId: chapter.id, chapterOrder: chapter.order, blocks: [], issues: [],
      });
    }
    const fragments = chapter.blocks.filter((block) => block.kind !== "heading").flatMap(splitBlock);
    if (!fragments.length) continue;
    let current: PreviewBlock[] = [];
    let currentWeight = 0;
    let pageIndex = 1;
    const flush = () => {
      if (!current.length) return;
      pages.push({
        id: `page-${chapter.id}-${pageIndex++}`,
        type: pageTypeFor(chapter, current),
        title: chapter.title,
        chapterId: chapter.id,
        chapterOrder: chapter.order,
        blocks: current,
        issues: issuesFor(current),
      });
      current = [];
      currentWeight = 0;
    };
    for (const fragment of fragments) {
      const weight = blockWeight(fragment);
      if (current.length && currentWeight + weight > 82) flush();
      current.push(fragment);
      currentWeight += weight;
    }
    flush();
  }
  return pages;
}

export function previewPageNumber(pageIndex: number) {
  return pageIndex + 1;
}
