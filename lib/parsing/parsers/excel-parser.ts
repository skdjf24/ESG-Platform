import type ExcelJS from "exceljs";
import { createCandidate, stableHash } from "@/lib/parsing/candidate-utils";
import { MAX_EXCEL_CELLS, validateFileBytes } from "@/lib/parsing/security";
import type {
  DocumentParser,
  ExtractionCandidate,
  ParsedBlock,
  ParsedCellBlock,
  ParsedDocument,
  ParsedTable,
  ParsedTableCell,
  SourceLocator,
} from "@/lib/types/parsing";

function columnName(column: number) {
  let value = column;
  let name = "";
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

function rawCellValue(cell: ExcelJS.Cell) {
  const value = cell.value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    if ("formula" in value) return (value as ExcelJS.CellFormulaValue).result ?? null;
    if ("richText" in value) return (value as ExcelJS.CellRichTextValue).richText.map((item) => item.text).join("");
    if ("text" in value) return String((value as { text: string }).text);
  }
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : value === null ? null : cell.text;
}

function cellDetails(cell: ExcelJS.Cell): Pick<ParsedCellBlock, "rawValue" | "valueType" | "formula" | "cachedValue"> {
  const value = cell.value;
  if (value && typeof value === "object" && "formula" in value) {
    const formula = value as ExcelJS.CellFormulaValue;
    const result = formula.result;
    return {
      rawValue: typeof result === "string" || typeof result === "number" || typeof result === "boolean" || result === null ? result : cell.text,
      valueType: "formula",
      formula: formula.formula,
      cachedValue: typeof result === "string" || typeof result === "number" || typeof result === "boolean" || result === null ? result : cell.text,
    };
  }
  if (value instanceof Date) return { rawValue: value.toISOString(), valueType: "date" };
  if (typeof value === "number") return { rawValue: value, valueType: cell.numFmt?.includes("%") ? "percentage" : "number" };
  if (typeof value === "boolean") return { rawValue: value, valueType: "boolean" };
  if (value === null) return { rawValue: null, valueType: "blank" };
  return { rawValue: String(rawCellValue(cell) ?? ""), valueType: "text" };
}

function numberFromCell(cell: ExcelJS.Cell) {
  const raw = rawCellValue(cell);
  if (typeof raw === "number" && Number.isFinite(raw)) return cell.numFmt?.includes("%") ? raw * 100 : raw;
  if (typeof raw !== "string") return null;
  const normalized = raw.replace(/,/g, "").replace(/%$/, "").trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function tableCell(cell: ExcelJS.Cell, locator: SourceLocator): ParsedTableCell {
  const details = cellDetails(cell);
  return { text: cell.text, ...details, locator };
}

function findMetricCandidates(
  worksheet: ExcelJS.Worksheet,
  base: Pick<ParsedDocument, "projectId" | "fileId" | "sourceId" | "parsedDocumentId" | "fileChecksum" | "sourceKind">,
) {
  const candidates: ExtractionCandidate[] = [];
  const maxHeaderRow = Math.min(worksheet.rowCount, 30);
  for (let headerRow = 1; headerRow <= maxHeaderRow; headerRow += 1) {
    const row = worksheet.getRow(headerRow);
    const values = Array.from({ length: Math.max(worksheet.columnCount, row.cellCount) }, (_, index) => worksheet.getCell(headerRow, index + 1).text.trim());
    const yearColumns = values.flatMap((text, index) => /^(19|20)\d{2}(?:年|年度)?$/.test(text) ? [{ column: index + 1, period: text.replace(/年$/, "年度") }] : []);
    if (!yearColumns.length) continue;
    const labelColumn = values.findIndex((text) => /指标|名称|项目|项目名称/.test(text)) + 1 || 1;
    const unitColumn = values.findIndex((text) => /单位/.test(text)) + 1;
    for (let rowNumber = headerRow + 1; rowNumber <= Math.min(worksheet.rowCount, headerRow + 500); rowNumber += 1) {
      const label = worksheet.getCell(rowNumber, labelColumn).text.trim();
      if (!label) continue;
      const unit = unitColumn ? worksheet.getCell(rowNumber, unitColumn).text.trim() : "";
      for (const year of yearColumns) {
        const cell = worksheet.getCell(rowNumber, year.column);
        const value = numberFromCell(cell);
        if (value === null) continue;
        const cellAddress = `${columnName(year.column)}${rowNumber}`;
        const range = `${columnName(labelColumn)}${rowNumber}:${columnName(Math.max(year.column, unitColumn || year.column))}${rowNumber}`;
        const locator: SourceLocator = {
          fileId: base.fileId,
          sourceId: base.sourceId,
          sheet: worksheet.name,
          cell: cellAddress,
          range,
          row: rowNumber,
          column: year.column,
        };
        candidates.push(createCandidate({
          ...base,
          type: "metric",
          label,
          value,
          unit,
          period: year.period,
          excerpt: `${label} | ${year.period} | ${cell.text} | ${unit}`,
          sourceLocator: locator,
        }));
      }
    }
    break;
  }
  return candidates;
}

export class ExcelParser implements DocumentParser {
  readonly type = "excel" as const;
  readonly version = "exceljs-4.4.0/rules-1";

  supports(file: { name: string }) {
    return file.name.toLowerCase().endsWith(".xlsx");
  }

  async parse(file: Parameters<DocumentParser["parse"]>[0], options: Parameters<DocumentParser["parse"]>[1]) {
    const { bytes } = await validateFileBytes(file);
    options.signal?.throwIfAborted();
    const excelJsModule = await import("exceljs");
    const workbook = new excelJsModule.default.Workbook();
    await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    options.signal?.throwIfAborted();
    const now = new Date().toISOString();
    const parsedDocumentId = `parsed-${file.fileId}-${file.checksum.slice(0, 12)}`;
    const blocks: ParsedBlock[] = [];
    const tables: ParsedTable[] = [];
    let order = 0;
    let nonEmptyCells = 0;
    const documentBase = {
      projectId: file.projectId,
      fileId: file.fileId,
      sourceId: options.sourceId,
      parsedDocumentId,
      fileChecksum: file.checksum,
      sourceKind: options.sourceKind ?? "current",
    } as const;

    workbook.eachSheet((worksheet) => {
      const maxRow = worksheet.rowCount;
      const maxColumn = worksheet.columnCount;
      const rows: ParsedTableCell[][] = [];
      for (let rowNumber = 1; rowNumber <= maxRow; rowNumber += 1) {
        const cells: ParsedTableCell[] = [];
        for (let column = 1; column <= maxColumn; column += 1) {
          const cell = worksheet.getCell(rowNumber, column);
          const locator: SourceLocator = { fileId: file.fileId, sourceId: options.sourceId, sheet: worksheet.name, cell: cell.address, row: rowNumber, column };
          cells.push(tableCell(cell, locator));
          if (cell.value === null || cell.text.trim() === "") continue;
          nonEmptyCells += 1;
          if (nonEmptyCells > MAX_EXCEL_CELLS) throw new Error(`工作簿非空单元格超过 ${MAX_EXCEL_CELLS} 个，请拆分文件后重试。`);
          const details = cellDetails(cell);
          blocks.push({
            blockId: `block-${stableHash(`${parsedDocumentId}|${worksheet.name}|${cell.address}`)}`,
            kind: "cell",
            order: order++,
            text: cell.text,
            locator,
            ...details,
          });
        }
        rows.push(cells);
      }
      const range = maxRow && maxColumn ? `A1:${columnName(maxColumn)}${maxRow}` : "A1";
      const tableId = `table-${stableHash(`${parsedDocumentId}|${worksheet.name}|${range}`)}`;
      const mergedRanges = Array.isArray(worksheet.model.merges) ? [...worksheet.model.merges] : [];
      tables.push({
        tableId,
        name: worksheet.name,
        order: tables.length,
        sheet: worksheet.name,
        range,
        rows,
        mergedRanges,
        locator: { fileId: file.fileId, sourceId: options.sourceId, sheet: worksheet.name, range },
      });
      blocks.push({
        blockId: `block-${tableId}`,
        kind: "table",
        tableId,
        order: order++,
        text: `${worksheet.name} ${range}`,
        rowCount: rows.length,
        columnCount: maxColumn,
        locator: { fileId: file.fileId, sourceId: options.sourceId, sheet: worksheet.name, range },
      });
    });

    const document: ParsedDocument = {
      ...documentBase,
      parserType: "excel",
      parserVersion: this.version,
      status: "parsed",
      createdAt: now,
      updatedAt: now,
      parsedAt: now,
      fileRevision: file.revision,
      documentClassification: "structured",
      sheetNames: workbook.worksheets.map((sheet) => sheet.name),
      blocks,
      tables,
      warnings: workbook.worksheets.length ? [] : [{ code: "EMPTY_WORKBOOK", message: "工作簿不包含可读取工作表。" }],
    };
    const candidates = workbook.worksheets.flatMap((worksheet) => findMetricCandidates(worksheet, documentBase));
    return { document, candidates };
  }
}
