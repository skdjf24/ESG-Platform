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

function decodeText(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, raw: string) => {
      const code = Number(raw);
      return code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .replace(/&amp;/gi, "&");
}

function preferredBreak(text: string, limit: number) {
  if (text.length <= limit) return text.length;
  const minimum = Math.max(1, Math.floor(limit * 0.6));
  for (let index = limit - 1; index >= minimum; index -= 1) {
    if (/[。！？；.!?;、，,\s]/.test(text[index])) return index + 1;
  }
  return limit;
}

/**
 * Split sanitized rich text without flattening inline emphasis or list
 * structure. Open tags are closed at a page boundary and reopened in the next
 * fragment so every fragment remains independently renderable HTML.
 */
export function splitRichTextHtml(html: string, limit: number): string[] {
  const safe = sanitizeHtml(html);
  if (!safe || plainText(safe).length <= limit) return safe ? [safe] : [];
  const tokens = safe.match(/<[^>]+>|[^<]+/g) ?? [];
  const chunks: string[] = [];
  const openTags: string[] = [];
  let current = "";
  let textLength = 0;

  const closeOpenTags = () => [...openTags].reverse().map((name) => `</${name}>`).join("");
  const reopenTags = () => openTags.map((name) => `<${name}>`).join("");
  const flush = () => {
    if (!textLength) return;
    chunks.push(`${current}${closeOpenTags()}`);
    current = reopenTags();
    textLength = 0;
  };

  for (const token of tokens) {
    if (token.startsWith("<")) {
      const closing = token.match(/^<\/([a-z0-9]+)>$/i);
      const opening = token.match(/^<([a-z0-9]+)(?:\s[^>]*)?>$/i);
      const openingName = opening?.[1].toLowerCase();
      // Lists consume one visual line per item even when their text is short.
      // Account for that structural height and prefer a page break before the
      // next item, while the stack only contains its list container.
      if (openingName === "li") {
        const lineWeight = Math.max(14, Math.floor(limit / 10));
        if (textLength && textLength + lineWeight > limit) flush();
        textLength += lineWeight;
      } else if (["p", "h2", "h3", "blockquote"].includes(openingName ?? "")) {
        const blockSpacing = Math.max(4, Math.floor(limit / 28));
        if (textLength && textLength + blockSpacing > limit) flush();
        textLength += blockSpacing;
      }
      current += token;
      if (closing) {
        const index = openTags.lastIndexOf(closing[1].toLowerCase());
        if (index >= 0) openTags.splice(index, 1);
      } else if (opening && opening[1].toLowerCase() !== "br") {
        openTags.push(opening[1].toLowerCase());
      }
      continue;
    }

    let remaining = decodeText(token);
    while (remaining) {
      if (textLength >= limit) flush();
      const room = Math.max(1, limit - textLength);
      const take = preferredBreak(remaining, room);
      const part = remaining.slice(0, take);
      current += escapeHtml(part);
      textLength += part.length;
      remaining = remaining.slice(take);
      if (remaining) flush();
    }
  }
  flush();
  return chunks;
}

function splitHtmlBlock(block: ContentBlock, capacity: number): PreviewBlock[] {
  // Keep fragments small enough that a preceding in-section heading can stay
  // with the first paragraph after typography or margin changes.
  const groupLimit = Math.max(180, Math.min(520, Math.floor((capacity - 23) / 5) * 78));
  return splitRichTextHtml(block.html, groupLimit).map((html, index) => ({
    block,
    fragmentId: index ? `${block.id}-fragment-${index + 1}` : block.id,
    html,
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
