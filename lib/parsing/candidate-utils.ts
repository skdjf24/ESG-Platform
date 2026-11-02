import type {
  CandidateType,
  ExtractionCandidate,
  ParsedBlock,
  ParsedDocument,
  SourceLocator,
} from "@/lib/types/parsing";

export function stableHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

function locatorIdentity(locator: SourceLocator) {
  return JSON.stringify({
    page: locator.page,
    sheet: locator.sheet,
    cell: locator.cell,
    range: locator.range,
    headingPath: locator.headingPath,
    paragraphIndex: locator.paragraphIndex,
    tableIndex: locator.tableIndex,
    row: locator.row,
    column: locator.column,
  });
}

export function candidateIdentity(input: {
  fileChecksum: string;
  type: CandidateType;
  locator: SourceLocator;
  label: string;
  value?: string | number;
}) {
  const normalized = `${input.label}|${input.value ?? ""}`.trim().replace(/\s+/g, " ").toLowerCase();
  const fingerprint = stableHash(`${input.fileChecksum}|${input.type}|${locatorIdentity(input.locator)}|${normalized}`);
  return { fingerprint, candidateId: `candidate-${fingerprint}` };
}

export function createCandidate(input: Omit<ExtractionCandidate, "candidateId" | "fingerprint" | "status" | "createdAt" | "updatedAt">): ExtractionCandidate {
  const identity = candidateIdentity({
    fileChecksum: input.fileChecksum,
    type: input.type,
    locator: input.sourceLocator,
    label: input.label,
    value: input.value,
  });
  const now = new Date().toISOString();
  return { ...input, ...identity, status: "candidate", createdAt: now, updatedAt: now };
}

export function candidateFromBlock(document: ParsedDocument, block: ParsedBlock, type: CandidateType) {
  return createCandidate({
    projectId: document.projectId,
    fileId: document.fileId,
    sourceId: document.sourceId,
    parsedDocumentId: document.parsedDocumentId,
    parsedBlockId: block.blockId,
    fileChecksum: document.fileChecksum,
    type,
    label: block.kind === "heading" ? block.text : block.text.slice(0, 42) || "未命名候选",
    value: type === "fact" || type === "metric" ? block.text : undefined,
    excerpt: block.text.slice(0, 500),
    sourceLocator: block.locator,
    sourceKind: document.sourceKind,
  });
}

export function formatLocator(locator: SourceLocator) {
  const parts: string[] = [];
  if (locator.sheet) parts.push(`Sheet：${locator.sheet}`);
  if (locator.range) parts.push(`Range：${locator.range}`);
  else if (locator.cell) parts.push(`Cell：${locator.cell}`);
  if (locator.page) parts.push(`第 ${locator.page} 页`);
  if (locator.headingPath?.length) parts.push(locator.headingPath.join(" > "));
  if (locator.paragraphIndex !== undefined) parts.push(`第 ${locator.paragraphIndex} 段`);
  if (locator.tableIndex !== undefined) parts.push(`表 ${locator.tableIndex + 1}`);
  if (locator.row !== undefined && locator.column !== undefined) parts.push(`行 ${locator.row} / 列 ${locator.column}`);
  return parts.join(" · ") || "文件级来源";
}
