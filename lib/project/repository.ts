import type { ReportProjectData, ReportProjectRepository, ProjectSaveContext, ProjectSaveResult } from "@/lib/types/project-data";
import { createProjectData } from "@/lib/project/seed";
import { applyWritingDocument, composeWritingDocument, synchronizeProjectData } from "@/lib/project/synchronize";
import { parseStoredDocument, validateWritingDocument } from "@/lib/writing/document";
import { ensurePresentationState, isPresentationState } from "@/lib/presentation/state";

const MAX_LOCAL_SNAPSHOT_BYTES = 4_500_000;
const PROJECT_EVENT = "esg-report-project-saved";

export type ProjectStorageErrorCode = "unavailable" | "incompatible" | "conflict" | "too-large" | "binary-payload";

export class ProjectStorageError extends Error {
  constructor(public readonly code: ProjectStorageErrorCode, message: string) {
    super(message);
    this.name = "ProjectStorageError";
  }
}

export function projectStorageKey(projectId: string) {
  return `esg:report-project:${encodeURIComponent(projectId)}:v2`;
}

export function legacyWritingStorageKey(projectId: string) {
  return `esg:${projectId}:writing:v1`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseProjectData(raw: string, projectId: string): ReportProjectData | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.schemaVersion !== 2 || value.projectId !== projectId) return null;
    if (!Number.isInteger(value.revision) || Number(value.revision) < 1) return null;
    const requiredObjects = ["enterprise", "report", "boundary", "materiality", "writing"];
    const requiredArrays = ["topics", "disclosureRequirements", "reportSections", "dataRequirements", "sources", "facts", "resources", "impacts", "migrations"];
    if (!requiredObjects.every((key) => isRecord(value[key])) || !requiredArrays.every((key) => Array.isArray(value[key]))) return null;
    const legacyCompatible = value as unknown as Omit<ReportProjectData, "presentation"> & { presentation?: ReportProjectData["presentation"] };
    if (legacyCompatible.report.id !== projectId || !validateWritingDocument(composeWritingDocument(legacyCompatible as ReportProjectData), projectId)) return null;
    if (legacyCompatible.presentation && !isPresentationState(legacyCompatible.presentation)) return null;
    const project = ensurePresentationState(legacyCompatible);
    if (new Set(project.topics.map((item) => item.id)).size !== project.topics.length) return null;
    if (new Set(project.disclosureRequirements.map((item) => item.id)).size !== project.disclosureRequirements.length) return null;
    if (new Set(project.reportSections.map((item) => item.id)).size !== project.reportSections.length) return null;
    if (new Set(project.dataRequirements.map((item) => item.id)).size !== project.dataRequirements.length) return null;
    return project;
  } catch {
    return null;
  }
}

function containsBinaryPayload(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof File !== "undefined" && value instanceof File) return true;
  if (typeof Blob !== "undefined" && value instanceof Blob) return true;
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return true;
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => containsBinaryPayload(item, seen));
  return Object.values(value).some((item) => containsBinaryPayload(item, seen));
}

function storageOrThrow(storage?: Storage) {
  if (storage) return storage;
  if (typeof window === "undefined") throw new ProjectStorageError("unavailable", "项目仓库仅在浏览器中可用。");
  return window.localStorage;
}

export class LocalStorageReportProjectRepository implements ReportProjectRepository {
  constructor(private readonly suppliedStorage?: Storage) {}

  async load(projectId: string): Promise<ReportProjectData> {
    const storage = storageOrThrow(this.suppliedStorage);
    let raw: string | null;
    try {
      raw = storage.getItem(projectStorageKey(projectId));
    } catch {
      throw new ProjectStorageError("unavailable", "浏览器不允许读取项目本地存储。");
    }
    if (raw) {
      const stored = parseProjectData(raw, projectId);
      if (!stored) throw new ProjectStorageError("incompatible", "项目存档格式不兼容，原数据已保留且不会被覆盖。");
      return stored;
    }

    let project = createProjectData(projectId);
    let legacyRaw: string | null = null;
    try {
      legacyRaw = storage.getItem(legacyWritingStorageKey(projectId));
    } catch {
      throw new ProjectStorageError("unavailable", "浏览器不允许读取旧版 Step 5 草稿。");
    }
    if (legacyRaw) {
      const legacy = parseStoredDocument(legacyRaw, projectId);
      if (legacy) {
        project = applyWritingDocument(project, legacy);
        project.migrations.push({
          id: "migration-step5-writing-v1",
          from: legacyWritingStorageKey(projectId),
          migratedAt: new Date().toISOString(),
          note: "已将旧版 Step 5 章节、事实、资料、Writing Policy 与版本记录读入统一项目快照；旧键未删除。",
        });
      }
    }
    return project;
  }

  async save(projectId: string, candidate: ReportProjectData, context: ProjectSaveContext): Promise<ProjectSaveResult> {
    const storage = storageOrThrow(this.suppliedStorage);
    if (candidate.projectId !== projectId || candidate.report.id !== projectId) {
      throw new ProjectStorageError("incompatible", "项目 ID 不一致，已阻止跨项目写入。");
    }
    if (containsBinaryPayload(candidate)) {
      throw new ProjectStorageError("binary-payload", "项目快照包含文件二进制内容。请仅保存文件元数据和对象存储引用。");
    }

    let stored: ReportProjectData | null = null;
    try {
      const raw = storage.getItem(projectStorageKey(projectId));
      if (raw) {
        stored = parseProjectData(raw, projectId);
        if (!stored) throw new ProjectStorageError("incompatible", "现有项目存档格式不兼容，已停止保存以保护原数据。");
      }
    } catch (error) {
      if (error instanceof ProjectStorageError) throw error;
      throw new ProjectStorageError("unavailable", "无法读取当前项目存档，已停止保存以避免覆盖。");
    }

    if (stored && stored.revision !== context.expectedRevision) {
      throw new ProjectStorageError("conflict", "项目已在另一个页面更新。请刷新并核对最新数据后再保存。");
    }

    const synchronized = synchronizeProjectData(context.previous, candidate, context.step);
    const savedAt = new Date().toISOString();
    const project: ReportProjectData = {
      ...synchronized.project,
      revision: (stored?.revision ?? context.expectedRevision) + 1,
      lastSavedAt: savedAt,
      updatedAt: savedAt,
      report: { ...synchronized.project.report, updatedAt: savedAt.slice(0, 16).replace("T", " ") },
    };
    const serialized = JSON.stringify(project);
    if (new TextEncoder().encode(serialized).byteLength > MAX_LOCAL_SNAPSHOT_BYTES) {
      throw new ProjectStorageError("too-large", "项目本地快照超过安全容量，请移除文件内容并仅保留元数据。");
    }
    try {
      storage.setItem(projectStorageKey(projectId), serialized);
    } catch {
      throw new ProjectStorageError("unavailable", "项目保存失败：浏览器存储不可用或空间不足。");
    }
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PROJECT_EVENT, { detail: { projectId, revision: project.revision } }));
    return { project, impacts: synchronized.impacts };
  }

  subscribe(projectId: string, onChange: () => void) {
    if (typeof window === "undefined") return () => undefined;
    const key = projectStorageKey(projectId);
    const onStorage = (event: StorageEvent) => { if (event.key === key) onChange(); };
    const onProjectEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string }>).detail;
      if (detail?.projectId === projectId) onChange();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(PROJECT_EVENT, onProjectEvent);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(PROJECT_EVENT, onProjectEvent);
    };
  }
}

export const projectRepository: ReportProjectRepository = new LocalStorageReportProjectRepository();
