import type { ReportProjectData } from "@/lib/types/project-data";
import type { ReportPageType } from "@/lib/types/presentation";
import type { ContentBlock, WritingChapter } from "@/lib/types/writing";
import { plainText, sanitizeHtml } from "@/lib/writing/document";

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

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function pageCapacity(project: ReportProjectData) {
  const layout = project.presentation.layout;
  const availableMm = 297 - layout.margins.top - layout.margins.bottom;
  const verticalFactor = availableMm / 261;
  const typographyFactor = (10.5 / layout.bodyFontSize) * (1.75 / layout.lineHeight);
  return Math.max(46, Math.min(104, Math.round(82 * verticalFactor * typographyFactor)));
}

function blockWeight(block: PreviewBlock) {
  const source = block.block;
  if (source.kind === "heading") return 11;
  if (source.kind === "table") return 14 + Math.max(0, (block.rows ?? source.rows).length - 1) * 6;
  if (source.kind === "chart") return 43;
  if (source.kind === "case") return 22 + Math.ceil(plainText(block.html ?? source.html).length / 75) * 5;
  if (source.kind === "todo") return 20;
  return 12 + Math.ceil(plainText(block.html ?? source.html).length / 78) * 5;
}

function splitText(text: string, limit: number) {
  const pieces = text.split(/(?<=[。！？；.!?;])\s*/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces.length ? pieces : [text]) {
    let remaining = piece;
    while (remaining.length > limit) {
      if (current) { chunks.push(current); current = ""; }
      chunks.push(remaining.slice(0, limit));
      remaining = remaining.slice(limit);
    }
    if (current && current.length + remaining.length > limit) { chunks.push(current); current = ""; }
    current += remaining;
  }
  if (current) chunks.push(current);
  return chunks;
}

function htmlElements(html: string) {
  const safe = sanitizeHtml(html);
  const elements = safe.match(/<(?:p|h2|h3|blockquote|ul|ol)\b[^>]*>[\s\S]*?<\/(?:p|h2|h3|blockquote|ul|ol)>/gi);
  return elements?.length ? elements : safe ? [safe] : [];
}

function splitHtmlBlock(block: ContentBlock, capacity: number): PreviewBlock[] {
  // Keep fragments small enough that a preceding in-section heading can stay
  // with the first paragraph after typography or margin changes.
  const groupLimit = Math.max(180, Math.min(520, Math.floor((capacity - 23) / 5) * 78));
  const pieceLimit = Math.max(160, Math.min(420, groupLimit));
  const elements = htmlElements(block.html);
  const pieces = elements.flatMap((element) => {
    const text = plainText(element);
    if (text.length <= pieceLimit) return [element];
    return splitText(text, pieceLimit).map((part) => `<p>${escapeHtml(part)}</p>`);
  });
  const groups: string[][] = [[]];
  let count = 0;
  for (const piece of pieces) {
    const length = plainText(piece).length;
    if (count && count + length > groupLimit) { groups.push([]); count = 0; }
    groups.at(-1)?.push(piece);
    count += length;
  }
  return groups.filter((group) => group.length).map((group, index) => ({
    block,
    fragmentId: index ? `${block.id}-fragment-${index + 1}` : block.id,
    html: group.join(""),
    continued: index > 0,
  }));
}

function splitBlock(block: ContentBlock, capacity: number): PreviewBlock[] {
  if (block.kind === "table" && block.rows.length > 2) {
    const header = block.rows[0] ?? [];
    const rowsPerPage = Math.max(4, Math.min(9, Math.floor((capacity - 18) / 6)));
    const chunks: PreviewBlock[] = [];
    for (let index = 1; index < block.rows.length; index += rowsPerPage) {
      chunks.push({ block, fragmentId: `${block.id}-rows-${index}`, rows: [header, ...block.rows.slice(index, index + rowsPerPage)], continued: index > 1 });
    }
    return chunks;
  }
  if (["paragraph", "case"].includes(block.kind)) return splitHtmlBlock(block, capacity);
  return [{ block, fragmentId: block.id }];
}

function pageTypeFor(chapter: WritingChapter, blocks: PreviewBlock[]): ReportPageType {
  if (chapter.id === "section-2") return "about";
  if (chapter.id === "section-7") return "appendix";
  if (blocks.some((item) => item.block.kind === "chart" || item.block.kind === "table")) return "performance";
  if (blocks.some((item) => item.block.kind === "case")) return "case";
  return "content";
}

function issuesFor(blocks: PreviewBlock[], capacity: number) {
  const issues: string[] = [];
  for (const fragment of blocks) {
    const { block } = fragment;
    if (block.kind === "chart") issues.push(`图表“${block.title}”（${block.id}）需要确认配置与指标版本。`);
    if (block.kind === "todo") issues.push(`内部待办“${block.title}”（${block.id}）不会作为正式披露。`);
    if (block.pendingKind && !block.resolved) issues.push(`“${block.title}”（${block.id}）仍为${block.pendingKind}。`);
    if (blockWeight(fragment) > capacity) issues.push(`内容块“${block.title}”（${block.id}）超过当前页面容量，请调整字号、行距或拆分内容。`);
  }
  return [...new Set(issues)];
}

function chapterFragments(chapter: WritingChapter, capacity: number) {
  return chapter.blocks.flatMap((block, index) => {
    // The first seed heading duplicates the chapter-page title. Every later
    // Step 5 heading is a genuine in-chapter heading and must remain visible.
    if (index === 0 && block.kind === "heading" && block.title.trim() === chapter.title.trim()) return [];
    return splitBlock(block, capacity);
  });
}

export function createReportPages(project: ReportProjectData): ReportPreviewPage[] {
  const pages: ReportPreviewPage[] = [
    { id: "page-cover", type: "cover", title: "报告封面", blocks: [], issues: [] },
    { id: "page-toc", type: "toc", title: "自动目录", blocks: [], issues: [] },
  ];
  const capacity = pageCapacity(project);
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
    const fragments = chapterFragments(chapter, capacity);
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
        issues: issuesFor(current, capacity),
      });
      current = [];
      currentWeight = 0;
    };
    fragments.forEach((fragment, index) => {
      const weight = blockWeight(fragment);
      const nextWeight = fragments[index + 1] ? blockWeight(fragments[index + 1]) : 0;
      if (fragment.block.kind === "heading" && current.length && currentWeight + weight + nextWeight > capacity) flush();
      if (current.length && currentWeight + weight > capacity) flush();
      current.push(fragment);
      currentWeight += weight;
    });
    flush();
  }
  return pages;
}

export function previewPageNumber(pageIndex: number) {
  return pageIndex + 1;
}
