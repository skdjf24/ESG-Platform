import type { ProjectFileRecord } from "@/lib/types/project-data";

export type ParserType = "excel" | "docx" | "pdf" | "image";
export type ParserStatus = "not-started" | "pending" | "parsing" | "parsed" | "failed" | "stale";
export type CandidateType = "fact" | "metric" | "policy" | "case";
export type CandidateStatus = "candidate" | "confirmed" | "rejected" | "needs-review";

export interface SourceLocator {
  fileId: string;
  sourceId: string;
  parsedBlockId?: string;
  page?: number;
  sheet?: string;
  cell?: string;
  range?: string;
  headingPath?: string[];
  paragraphIndex?: number;
  tableIndex?: number;
  row?: number;
  column?: number;
}

interface ParsedBlockBase {
  blockId: string;
  order: number;
  text: string;
  locator: SourceLocator;
}

export interface ParsedHeadingBlock extends ParsedBlockBase {
  kind: "heading";
  level: 1 | 2 | 3 | 4 | 5 | 6;
  headingPath: string[];
}

export interface ParsedParagraphBlock extends ParsedBlockBase {
  kind: "paragraph";
  paragraphStyle: "paragraph" | "list";
  headingPath: string[];
}

export interface ParsedCellBlock extends ParsedBlockBase {
  kind: "cell";
  rawValue: string | number | boolean | null;
  valueType: "text" | "number" | "percentage" | "date" | "boolean" | "formula" | "blank";
  formula?: string;
  cachedValue?: string | number | boolean | null;
  unitHint?: string;
}

export interface ParsedTableBlock extends ParsedBlockBase {
  kind: "table";
  tableId: string;
  rowCount: number;
  columnCount: number;
}

export interface ParsedPageTextBlock extends ParsedBlockBase {
  kind: "page-text";
  page: number;
  lineCount: number;
}

export type ParsedBlock = ParsedHeadingBlock | ParsedParagraphBlock | ParsedCellBlock | ParsedTableBlock | ParsedPageTextBlock;

export interface ParsedTableCell {
  text: string;
  rawValue?: string | number | boolean | null;
  formula?: string;
  cachedValue?: string | number | boolean | null;
  valueType?: ParsedCellBlock["valueType"];
  locator: SourceLocator;
}

export interface ParsedTable {
  tableId: string;
  name: string;
  order: number;
  range?: string;
  sheet?: string;
  page?: number;
  headingPath?: string[];
  rows: ParsedTableCell[][];
  mergedRanges: string[];
  locator: SourceLocator;
}

export interface ParseWarning {
  code: string;
  message: string;
  locator?: SourceLocator;
}

export interface ParsedDocument {
  parsedDocumentId: string;
  projectId: string;
  fileId: string;
  sourceId: string;
  parserType: ParserType;
  parserVersion: string;
  status: Exclude<ParserStatus, "not-started">;
  createdAt: string;
  updatedAt: string;
  parsedAt?: string;
  fileChecksum: string;
  fileRevision: number;
  sourceKind: "current" | "historical";
  documentClassification?: "structured" | "text" | "scan-suspected";
  pageCount?: number;
  sheetNames?: string[];
  blocks: ParsedBlock[];
  tables: ParsedTable[];
  warnings: ParseWarning[];
  error?: string;
}

export interface ExtractionCandidate {
  candidateId: string;
  fingerprint: string;
  projectId: string;
  fileId: string;
  sourceId: string;
  parsedDocumentId: string;
  parsedBlockId?: string;
  fileChecksum: string;
  type: CandidateType;
  label: string;
  value?: string | number;
  unit?: string;
  period?: string;
  boundary?: string;
  note?: string;
  excerpt: string;
  sourceLocator: SourceLocator;
  sourceKind: "current" | "historical";
  status: CandidateStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  confirmedEntityId?: string;
}

export interface ParseOptions {
  sourceId: string;
  sourceKind?: "current" | "historical";
  signal?: AbortSignal;
}

export interface ParseResult {
  document: ParsedDocument;
  candidates: ExtractionCandidate[];
}

export interface DocumentParser {
  readonly type: ParserType;
  readonly version: string;
  supports(file: ProjectFileRecord): boolean;
  parse(file: ProjectFileRecord, options: ParseOptions): Promise<ParseResult>;
}

export interface DocumentParserRegistry {
  resolve(file: ProjectFileRecord): DocumentParser | null;
}

export interface ParsedDocumentRepository {
  get(parsedDocumentId: string): Promise<ParsedDocument | null>;
  getByFile(projectId: string, fileId: string): Promise<ParsedDocument | null>;
  listByProject(projectId: string): Promise<ParsedDocument[]>;
  save(document: ParsedDocument): Promise<void>;
  markStale(projectId: string, fileId: string, reason: string): Promise<void>;
  deleteByFile(projectId: string, fileId: string): Promise<void>;
}

export interface ExtractionCandidateRepository {
  get(candidateId: string): Promise<ExtractionCandidate | null>;
  listByProject(projectId: string): Promise<ExtractionCandidate[]>;
  listByFile(projectId: string, fileId: string): Promise<ExtractionCandidate[]>;
  mergeParsed(candidates: ExtractionCandidate[]): Promise<ExtractionCandidate[]>;
  save(candidate: ExtractionCandidate): Promise<void>;
  markFileNeedsReview(projectId: string, fileId: string): Promise<void>;
}
