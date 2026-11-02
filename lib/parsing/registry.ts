import { DocxParser } from "@/lib/parsing/parsers/docx-parser";
import { ExcelParser } from "@/lib/parsing/parsers/excel-parser";
import { PdfParser } from "@/lib/parsing/parsers/pdf-parser";
import type { DocumentParser, DocumentParserRegistry } from "@/lib/types/parsing";
import type { ProjectFileRecord } from "@/lib/types/project-data";

export class BrowserDocumentParserRegistry implements DocumentParserRegistry {
  constructor(private readonly parsers: DocumentParser[] = [new ExcelParser(), new DocxParser(), new PdfParser()]) {}

  resolve(file: ProjectFileRecord) {
    return this.parsers.find((parser) => parser.supports(file)) ?? null;
  }
}

export const documentParserRegistry: DocumentParserRegistry = new BrowserDocumentParserRegistry();
