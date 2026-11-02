import { extractionCandidateRepository, parsedDocumentRepository } from "@/lib/parsing/repository";
import { documentParserRegistry } from "@/lib/parsing/registry";
import { fileExtension } from "@/lib/parsing/security";
import { projectFileRepository } from "@/lib/project/repository";
import type { ReportProjectData } from "@/lib/types/project-data";
import type { ParsedDocument, ParserType } from "@/lib/types/parsing";

function parserTypeForFile(name: string): ParserType {
  const extension = fileExtension(name);
  if (["xlsx", "xls"].includes(extension)) return "excel";
  if (extension === "docx") return "docx";
  if (extension === "pdf") return "pdf";
  return "image";
}

export class DocumentParsingError extends Error {
  constructor(message: string, public readonly document?: ParsedDocument) {
    super(message);
    this.name = "DocumentParsingError";
  }
}

export async function parseProjectFile(input: {
  projectId: string;
  fileId: string;
  sourceId: string;
  sourceKind?: "current" | "historical";
  signal?: AbortSignal;
}) {
  const file = await projectFileRepository.get(input.projectId, input.fileId);
  if (!file) throw new DocumentParsingError("来源文件缺失，未执行解析。");
  const previous = await parsedDocumentRepository.getByFile(input.projectId, input.fileId);
  const parser = documentParserRegistry.resolve(file);
  const now = new Date().toISOString();
  const parserType = parser?.type ?? parserTypeForFile(file.name);
  const parsedDocumentId = `parsed-${file.fileId}-${file.checksum.slice(0, 12)}`;
  const pending: ParsedDocument = {
    parsedDocumentId,
    projectId: file.projectId,
    fileId: file.fileId,
    sourceId: input.sourceId,
    parserType,
    parserVersion: parser?.version ?? "unsupported-1",
    status: "pending",
    createdAt: now,
    updatedAt: now,
    fileChecksum: file.checksum,
    fileRevision: file.revision,
    sourceKind: input.sourceKind ?? "current",
    blocks: [],
    tables: [],
    warnings: [],
  };
  await parsedDocumentRepository.save(pending);
  await projectFileRepository.updateParsingState(input.projectId, input.fileId, { parserStatus: "pending", parseError: undefined });
  try {
    if (!parser) {
      const extension = fileExtension(file.name);
      throw new Error(extension === "xls"
        ? "当前浏览器解析器不支持旧版二进制 XLS，请另存为 XLSX 后重试。"
        : "当前文件类型尚无可用解析器；图片 OCR 计划在 Phase 2.1 提供。");
    }
    await projectFileRepository.updateParsingState(input.projectId, input.fileId, { parserStatus: "parsing", parserVersion: parser.version });
    await parsedDocumentRepository.save({ ...pending, status: "parsing", updatedAt: new Date().toISOString() });
    const result = await parser.parse(file, { sourceId: input.sourceId, sourceKind: input.sourceKind, signal: input.signal });
    const candidates = await extractionCandidateRepository.mergeParsed(result.candidates);
    const parserVersionChanged = Boolean(previous && previous.parserVersion !== result.document.parserVersion);
    if (parserVersionChanged) await extractionCandidateRepository.markFileNeedsReview(input.projectId, input.fileId);
    await parsedDocumentRepository.save(result.document);
    await projectFileRepository.updateParsingState(input.projectId, input.fileId, {
      parserStatus: "parsed",
      parserVersion: result.document.parserVersion,
      parsedAt: result.document.parsedAt,
      parseError: undefined,
    });
    return { document: result.document, candidates, parserVersionChanged };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知解析错误";
    const failed: ParsedDocument = {
      ...pending,
      status: "failed",
      updatedAt: new Date().toISOString(),
      error: message,
      warnings: [{ code: "PARSE_FAILED", message }],
    };
    await parsedDocumentRepository.save(failed);
    await projectFileRepository.updateParsingState(input.projectId, input.fileId, { parserStatus: "failed", parseError: message, parserVersion: pending.parserVersion });
    throw new DocumentParsingError(message, failed);
  }
}

export async function replaceProjectSourceFile(input: {
  projectId: string;
  fileId: string;
  sourceId: string;
  file: File;
}) {
  const previous = await projectFileRepository.get(input.projectId, input.fileId);
  if (!previous) throw new DocumentParsingError("要替换的来源文件不存在。");
  const next = await projectFileRepository.replace(input.projectId, input.fileId, input.file);
  if (next.checksum === previous.checksum) return { file: next, changed: false };
  await parsedDocumentRepository.markStale(input.projectId, input.fileId, "原始文件已替换；旧解析快照保留为 stale，等待重新解析。");
  await extractionCandidateRepository.markFileNeedsReview(input.projectId, input.fileId);
  return { file: next, changed: true };
}

export function markProjectSourceNeedsReview(project: ReportProjectData, sourceId: string) {
  return {
    ...project,
    sources: project.sources.map((source) => source.id === sourceId ? {
      ...source,
      parserStatus: "stale" as const,
      state: "已上传" as const,
      parsedAt: undefined,
      parseError: undefined,
    } : source),
    facts: project.facts.map((fact) => fact.sourceReferences.some((reference) => reference.sourceId === sourceId) ? {
      ...fact,
      state: "待人工确认" as const,
      confirmedBy: undefined,
      sourceConfirmationStatus: "待确认" as const,
    } : fact),
    resources: project.resources.map((resource) => resource.sourceReferences.some((reference) => reference.sourceId === sourceId) ? {
      ...resource,
      confirmed: false,
      confirmedBy: undefined,
      confirmedAt: undefined,
    } : resource),
  };
}
