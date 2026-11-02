import { DOMParser, type Element as XmlElement, type Node as XmlNode } from "@xmldom/xmldom";
import { strFromU8, unzipSync } from "fflate";
import { stableHash } from "@/lib/parsing/candidate-utils";
import { validateFileBytes } from "@/lib/parsing/security";
import type {
  DocumentParser,
  ParsedBlock,
  ParsedDocument,
  ParsedTable,
  ParsedTableCell,
  SourceLocator,
} from "@/lib/types/parsing";

function elements(node: XmlNode, name?: string) {
  const result: XmlElement[] = [];
  for (let index = 0; index < node.childNodes.length; index += 1) {
    const child = node.childNodes.item(index);
    if (child?.nodeType === 1 && (!name || child.nodeName === name)) result.push(child as XmlElement);
  }
  return result;
}

function firstDescendant(node: XmlElement, name: string) {
  return node.getElementsByTagName(name).item(0);
}

function attribute(node: XmlElement | null, localName: string) {
  if (!node) return "";
  return node.getAttribute(`w:${localName}`) ?? node.getAttribute(localName) ?? "";
}

function textOf(node: XmlNode) {
  const parts: string[] = [];
  const visit = (current: XmlNode) => {
    if (current.nodeName === "w:t") parts.push(current.textContent ?? "");
    else if (current.nodeName === "w:tab") parts.push("\t");
    else if (current.nodeName === "w:br") parts.push("\n");
    for (let index = 0; index < current.childNodes.length; index += 1) {
      const child = current.childNodes.item(index);
      if (child) visit(child);
    }
  };
  visit(node);
  return parts.join("").trim();
}

function headingLevel(paragraph: XmlElement, styleNames: Map<string, string>) {
  const styleId = attribute(firstDescendant(paragraph, "w:pStyle"), "val");
  const styleName = styleNames.get(styleId) ?? styleId;
  const match = styleName.match(/(?:heading|标题)\s*([1-6])/i);
  return match ? Number(match[1]) as 1 | 2 | 3 | 4 | 5 | 6 : null;
}

function readStyleNames(xml?: Uint8Array) {
  const names = new Map<string, string>();
  if (!xml) return names;
  const document = new DOMParser().parseFromString(strFromU8(xml), "application/xml");
  const styles = document.getElementsByTagName("w:style");
  for (let index = 0; index < styles.length; index += 1) {
    const style = styles.item(index);
    if (!style) continue;
    const id = attribute(style, "styleId");
    const name = attribute(firstDescendant(style, "w:name"), "val");
    if (id) names.set(id, name || id);
  }
  return names;
}

export class DocxParser implements DocumentParser {
  readonly type = "docx" as const;
  readonly version = "openxml-1/xmldom-0.9.12";

  supports(file: { name: string }) {
    return file.name.toLowerCase().endsWith(".docx");
  }

  async parse(file: Parameters<DocumentParser["parse"]>[0], options: Parameters<DocumentParser["parse"]>[1]) {
    const { bytes } = await validateFileBytes(file);
    options.signal?.throwIfAborted();
    const archive = unzipSync(bytes);
    const documentXml = archive["word/document.xml"];
    if (!documentXml) throw new Error("DOCX 缺少 word/document.xml，文件可能已损坏。");
    const document = new DOMParser().parseFromString(strFromU8(documentXml), "application/xml");
    const body = document.getElementsByTagName("w:body").item(0);
    if (!body) throw new Error("DOCX 正文结构缺失，无法解析。");
    const styleNames = readStyleNames(archive["word/styles.xml"]);
    const now = new Date().toISOString();
    const parsedDocumentId = `parsed-${file.fileId}-${file.checksum.slice(0, 12)}`;
    const blocks: ParsedBlock[] = [];
    const tables: ParsedTable[] = [];
    const headingPath: string[] = [];
    let order = 0;
    let paragraphIndex = 0;
    let tableIndex = 0;

    for (const child of elements(body)) {
      options.signal?.throwIfAborted();
      if (child.nodeName === "w:p") {
        const text = textOf(child);
        if (!text) continue;
        paragraphIndex += 1;
        const level = headingLevel(child, styleNames);
        if (level) {
          headingPath.splice(level - 1);
          headingPath[level - 1] = text;
          headingPath.splice(level);
          const locator: SourceLocator = { fileId: file.fileId, sourceId: options.sourceId, headingPath: [...headingPath], paragraphIndex };
          blocks.push({
            blockId: `block-${stableHash(`${parsedDocumentId}|p|${paragraphIndex}|${text}`)}`,
            kind: "heading",
            order: order++,
            text,
            level,
            headingPath: [...headingPath],
            locator,
          });
        } else {
          const locator: SourceLocator = { fileId: file.fileId, sourceId: options.sourceId, headingPath: [...headingPath], paragraphIndex };
          blocks.push({
            blockId: `block-${stableHash(`${parsedDocumentId}|p|${paragraphIndex}|${text}`)}`,
            kind: "paragraph",
            order: order++,
            text,
            paragraphStyle: firstDescendant(child, "w:numPr") ? "list" : "paragraph",
            headingPath: [...headingPath],
            locator,
          });
        }
        continue;
      }
      if (child.nodeName !== "w:tbl") continue;
      const rows: ParsedTableCell[][] = [];
      const rowNodes = elements(child, "w:tr");
      rowNodes.forEach((rowNode, rowOffset) => {
        const row: ParsedTableCell[] = [];
        elements(rowNode, "w:tc").forEach((cellNode, columnOffset) => {
          const text = textOf(cellNode);
          const locator: SourceLocator = {
            fileId: file.fileId,
            sourceId: options.sourceId,
            headingPath: [...headingPath],
            tableIndex,
            row: rowOffset + 1,
            column: columnOffset + 1,
          };
          row.push({ text, rawValue: text, valueType: "text", locator });
          if (text) blocks.push({
            blockId: `block-${stableHash(`${parsedDocumentId}|t|${tableIndex}|${rowOffset}|${columnOffset}|${text}`)}`,
            kind: "cell",
            order: order++,
            text,
            rawValue: text,
            valueType: "text",
            locator,
          });
        });
        rows.push(row);
      });
      const tableId = `table-${stableHash(`${parsedDocumentId}|${tableIndex}|${JSON.stringify(rows.map((row) => row.map((cell) => cell.text)))}`)}`;
      const locator: SourceLocator = { fileId: file.fileId, sourceId: options.sourceId, headingPath: [...headingPath], tableIndex };
      tables.push({ tableId, name: `表 ${tableIndex + 1}`, order: tableIndex, headingPath: [...headingPath], rows, mergedRanges: [], locator });
      blocks.push({
        blockId: `block-${tableId}`,
        kind: "table",
        tableId,
        order: order++,
        text: rows.map((row) => row.map((cell) => cell.text).join(" | ")).join("\n"),
        rowCount: rows.length,
        columnCount: Math.max(0, ...rows.map((row) => row.length)),
        locator,
      });
      tableIndex += 1;
    }

    const parsed: ParsedDocument = {
      parsedDocumentId,
      projectId: file.projectId,
      fileId: file.fileId,
      sourceId: options.sourceId,
      parserType: "docx",
      parserVersion: this.version,
      status: "parsed",
      createdAt: now,
      updatedAt: now,
      parsedAt: now,
      fileChecksum: file.checksum,
      fileRevision: file.revision,
      sourceKind: options.sourceKind ?? "current",
      documentClassification: "structured",
      blocks,
      tables,
      warnings: blocks.length ? [] : [{ code: "NO_TEXT", message: "DOCX 未检测到可读取的标题、段落或表格文本。" }],
    };
    return { document: parsed, candidates: [] };
  }
}
