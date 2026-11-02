import { stableHash } from "@/lib/parsing/candidate-utils";
import { MAX_PDF_PAGES, validateFileBytes } from "@/lib/parsing/security";
import type { DocumentParser, ParsedBlock, ParsedDocument } from "@/lib/types/parsing";

interface PdfTextItem {
  str: string;
  transform?: number[];
  hasEOL?: boolean;
}

function isPdfTextItem(value: unknown): value is PdfTextItem {
  return value !== null && typeof value === "object" && "str" in value && typeof (value as PdfTextItem).str === "string";
}

function pageText(items: unknown[]) {
  const textItems = items.filter(isPdfTextItem);
  const lines: string[] = [];
  let line = "";
  let previousY: number | undefined;
  for (const item of textItems) {
    const y = item.transform?.[5];
    const startsNewLine = previousY !== undefined && y !== undefined && Math.abs(y - previousY) > 2;
    if (startsNewLine && line.trim()) {
      lines.push(line.trim());
      line = "";
    }
    line += `${line && !line.endsWith(" ") ? " " : ""}${item.str}`;
    if (item.hasEOL && line.trim()) {
      lines.push(line.trim());
      line = "";
    }
    if (y !== undefined) previousY = y;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

export class PdfParser implements DocumentParser {
  readonly type = "pdf" as const;
  readonly version = "pdfjs-4.10.38/text-1";

  supports(file: { name: string }) {
    return file.name.toLowerCase().endsWith(".pdf");
  }

  async parse(file: Parameters<DocumentParser["parse"]>[0], options: Parameters<DocumentParser["parse"]>[1]) {
    const { bytes } = await validateFileBytes(file);
    options.signal?.throwIfAborted();
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    if (typeof window !== "undefined") {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
    }
    const loadingTask = pdfjs.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true });
    const pdf = await loadingTask.promise;
    if (pdf.numPages > MAX_PDF_PAGES) {
      await pdf.destroy();
      throw new Error(`PDF 共 ${pdf.numPages} 页，超过 ${MAX_PDF_PAGES} 页解析上限。`);
    }
    const now = new Date().toISOString();
    const parsedDocumentId = `parsed-${file.fileId}-${file.checksum.slice(0, 12)}`;
    const blocks: ParsedBlock[] = [];
    let order = 0;
    let totalTextLength = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      options.signal?.throwIfAborted();
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines = pageText(content.items);
      const text = lines.join("\n");
      totalTextLength += text.trim().length;
      blocks.push({
        blockId: `block-${stableHash(`${parsedDocumentId}|page|${pageNumber}|${text}`)}`,
        kind: "page-text",
        order: order++,
        text,
        page: pageNumber,
        lineCount: lines.length,
        locator: { fileId: file.fileId, sourceId: options.sourceId, page: pageNumber },
      });
      page.cleanup();
    }
    await pdf.destroy();
    const scanSuspected = totalTextLength < Math.max(10, pdf.numPages * 5);
    const parsed: ParsedDocument = {
      parsedDocumentId,
      projectId: file.projectId,
      fileId: file.fileId,
      sourceId: options.sourceId,
      parserType: "pdf",
      parserVersion: this.version,
      status: "parsed",
      createdAt: now,
      updatedAt: now,
      parsedAt: now,
      fileChecksum: file.checksum,
      fileRevision: file.revision,
      sourceKind: options.sourceKind ?? "current",
      documentClassification: scanSuspected ? "scan-suspected" : "text",
      pageCount: pdf.numPages,
      blocks,
      tables: [],
      warnings: scanSuspected ? [{ code: "SCAN_SUSPECTED", message: "未检测到可直接读取文本，可能为扫描件；本阶段未启用 OCR。" }] : [{ code: "PDF_TABLE_LIMIT", message: "PDF 仅保留页面文本和页码定位，不对不可靠表格结构作自动推断。" }],
    };
    return { document: parsed, candidates: [] };
  }
}
