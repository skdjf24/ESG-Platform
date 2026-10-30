import type {
  CreateProjectInput,
  ProjectFileRecord,
  ProjectFileRepository,
  ProjectSaveContext,
  ProjectSaveResult,
  ProjectSummary,
  ReportProjectData,
  ReportProjectRepository,
} from "@/lib/types/project-data";
import { createProjectData } from "@/lib/project/seed";
import { applyWritingDocument, composeWritingDocument, synchronizeProjectData } from "@/lib/project/synchronize";
import { parseStoredDocument, validateWritingDocument } from "@/lib/writing/document";
import { ensurePresentationState, isCompatiblePresentationState } from "@/lib/presentation/state";
import { ensureQualityState, isCompatibleQualityState } from "@/lib/quality/state";
import { ensureFinalizationState, isFinalizationState } from "@/lib/finalization/state";
import {
  ensureStorageCapacity,
  FILE_STORE,
  META_STORE,
  openProjectDatabase,
  PROJECT_STORE,
  requestPersistentStorage,
  requestResult,
  transactionDone,
} from "@/lib/project/indexed-db";

const STORAGE_SCHEMA_VERSION = 1;
const PROJECT_EVENT = "esg-report-project-saved";
const PROJECT_CHANNEL = "esg-report-project-events";

interface StoredProjectRecord {
  projectId: string;
  storageSchemaVersion: 1;
  revision: number;
  updatedAt: string;
  project: ReportProjectData;
}

export type ProjectStorageErrorCode = "unavailable" | "incompatible" | "conflict" | "too-large" | "binary-payload" | "not-found" | "referenced";

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

function restoreReferencedSourceMetadata(project: ReportProjectData): ReportProjectData {
  const knownSourceIds = new Set(project.sources.map((item) => item.id));
  const references = [...project.facts, ...project.resources].flatMap((item) => item.sourceReferences);
  const missing = references.filter((reference, index) => !knownSourceIds.has(reference.sourceId) && references.findIndex((item) => item.sourceId === reference.sourceId) === index);
  if (!missing.length) return project;
  return {
    ...project,
    sources: [...project.sources, ...missing.map((reference) => {
      const extension = reference.fileName.split(".").pop()?.toLowerCase();
      return {
        id: reference.sourceId,
        name: reference.fileName,
        kind: "file" as const,
        fileType: extension === "pdf" ? "PDF" as const : extension === "docx" ? "DOCX" as const : "XLSX" as const,
        fileStatus: "metadata-only" as const,
        uploadedAt: project.createdAt.slice(0, 10),
        uploadedBy: "历史存档迁移",
        state: "已解析" as const,
      };
    })],
    migrations: project.migrations.some((item) => item.id === "migration-referenced-source-metadata-v1") ? project.migrations : [...project.migrations, {
      id: "migration-referenced-source-metadata-v1",
      from: "embedded-source-references",
      migratedAt: new Date().toISOString(),
      note: `从既有事实与资料的来源快照恢复 ${missing.length} 条缺失来源元数据；未生成或解析任何文件内容。`,
    }],
  };
}

export function normalizeProjectData(value: unknown, expectedProjectId: string): ReportProjectData {
  if (!isRecord(value) || value.schemaVersion !== 2 || value.projectId !== expectedProjectId) throw new ProjectStorageError("incompatible", "项目存档格式或项目 ID 不兼容。");
  const requiredObjects = ["enterprise", "report", "boundary", "materiality", "writing"];
  const requiredArrays = ["topics", "disclosureRequirements", "reportSections", "dataRequirements", "sources", "facts", "resources", "impacts", "migrations"];
  if (!requiredObjects.every((key) => isRecord(value[key])) || !requiredArrays.every((key) => Array.isArray(value[key]))) throw new ProjectStorageError("incompatible", "项目存档缺少必要字段，原数据未被覆盖。");
  const legacyCompatible = value as unknown as Omit<ReportProjectData, "presentation" | "quality" | "finalization"> & { presentation?: unknown; quality?: unknown; finalization?: unknown };
  if (legacyCompatible.report.id !== expectedProjectId || !validateWritingDocument(composeWritingDocument(legacyCompatible as ReportProjectData), expectedProjectId)) throw new ProjectStorageError("incompatible", "项目正文或项目标识校验失败，原数据未被覆盖。");
  if (legacyCompatible.presentation && !isCompatiblePresentationState(legacyCompatible.presentation)) throw new ProjectStorageError("incompatible", "项目排版数据损坏，原数据未被覆盖。");
  if (legacyCompatible.quality && !isCompatibleQualityState(legacyCompatible.quality)) throw new ProjectStorageError("incompatible", "项目质量数据损坏，原数据未被覆盖。");
  if (legacyCompatible.finalization && !isFinalizationState(legacyCompatible.finalization)) throw new ProjectStorageError("incompatible", "项目定稿数据损坏，原数据未被覆盖。");
  const project = ensureFinalizationState(ensureQualityState(ensurePresentationState(legacyCompatible as Omit<ReportProjectData, "presentation"> & { presentation?: unknown })));
  for (const collection of [project.topics, project.disclosureRequirements, project.reportSections, project.dataRequirements]) {
    if (new Set(collection.map((item) => item.id)).size !== collection.length) throw new ProjectStorageError("incompatible", "项目存档包含重复 ID，已停止读取以保护数据。");
  }
  return restoreReferencedSourceMetadata(project);
}

function parseLegacyProject(raw: string, projectId: string) {
  try {
    return normalizeProjectData(JSON.parse(raw), projectId);
  } catch {
    return null;
  }
}

function recordFor(project: ReportProjectData): StoredProjectRecord {
  return { projectId: project.projectId, storageSchemaVersion: STORAGE_SCHEMA_VERSION, revision: project.revision, updatedAt: project.updatedAt, project };
}

function slugify(value: string) {
  const slug = value.toLowerCase().trim().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "").slice(0, 42);
  return slug || "esg-project";
}

async function filesForProject(projectId: string) {
  const database = await openProjectDatabase();
  const transaction = database.transaction(FILE_STORE, "readonly");
  const files = await requestResult(transaction.objectStore(FILE_STORE).index("projectId").getAll(projectId)) as ProjectFileRecord[];
  await transactionDone(transaction);
  return files;
}

async function reconcileFileStatus(project: ReportProjectData) {
  const files = await filesForProject(project.projectId);
  const fileIds = new Set(files.map((file) => file.fileId));
  return {
    ...project,
    sources: project.sources.map((source) => source.fileId ? {
      ...source,
      fileStatus: fileIds.has(source.fileId) ? "available" as const : "missing" as const,
      parserStatus: source.parserStatus ?? "not-started" as const,
    } : {
      ...source,
      state: "已上传" as const,
      fileStatus: source.fileStatus ?? "metadata-only" as const,
      parserStatus: source.parserStatus ?? "not-started" as const,
    }),
  };
}

function announceProjectChange(projectId: string, revision: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PROJECT_EVENT, { detail: { projectId, revision } }));
  try {
    const channel = new BroadcastChannel(PROJECT_CHANNEL);
    channel.postMessage({ projectId, revision });
    channel.close();
  } catch {
    // BroadcastChannel is optional; the same-page custom event still works.
  }
}

export class IndexedDbReportProjectRepository implements ReportProjectRepository {
  private async migrateLegacyProject(projectId: string) {
    if (typeof window === "undefined") return null;
    const database = await openProjectDatabase();
    const read = database.transaction(PROJECT_STORE, "readonly");
    const existing = await requestResult(read.objectStore(PROJECT_STORE).get(projectId)) as StoredProjectRecord | undefined;
    await transactionDone(read);
    if (existing) return existing.project;
    const raw = window.localStorage.getItem(projectStorageKey(projectId));
    let project = raw ? parseLegacyProject(raw, projectId) : null;
    if (raw && !project) throw new ProjectStorageError("incompatible", "检测到损坏或不兼容的旧项目存档；原 localStorage 数据已保留，未创建替代项目。");
    if (!project) {
      const legacyWriting = window.localStorage.getItem(legacyWritingStorageKey(projectId));
      const document = legacyWriting ? parseStoredDocument(legacyWriting, projectId) : null;
      if (legacyWriting && !document) throw new ProjectStorageError("incompatible", "检测到损坏的旧 Step 5 草稿；原 localStorage 数据已保留，未创建替代项目。");
      if (document) {
        project = applyWritingDocument(createProjectData(projectId), document);
        project.migrations.push({ id: "migration-step5-writing-v1", from: legacyWritingStorageKey(projectId), migratedAt: new Date().toISOString(), note: "已将旧版 Step 5 草稿迁入 IndexedDB；旧 localStorage 键未删除。" });
      }
    }
    if (!project) return null;
    if (!project.migrations.some((item) => item.id === "migration-localstorage-project-v2")) project.migrations.push({
      id: "migration-localstorage-project-v2",
      from: projectStorageKey(projectId),
      migratedAt: new Date().toISOString(),
      note: "已将完整 Step 1–8 项目快照迁入 IndexedDB；旧 localStorage 数据保留且不会自动删除。",
    });
    const write = database.transaction([PROJECT_STORE, META_STORE], "readwrite");
    write.objectStore(PROJECT_STORE).put(recordFor(project));
    write.objectStore(META_STORE).put({ key: "storage-schema", version: STORAGE_SCHEMA_VERSION, migratedAt: new Date().toISOString() });
    await transactionDone(write);
    return project;
  }

  private async migrateAllLegacyProjects() {
    if (typeof window === "undefined") return;
    const ids: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      const match = key?.match(/^esg:report-project:(.+):v2$/);
      if (match) {
        try { ids.push(decodeURIComponent(match[1])); } catch { /* Ignore keys that could not have been produced by projectStorageKey(). */ }
      }
    }
    await Promise.all(ids.map((id) => this.migrateLegacyProject(id)));
  }

  async load(projectId: string): Promise<ReportProjectData> {
    await this.migrateLegacyProject(projectId);
    const database = await openProjectDatabase();
    const transaction = database.transaction(PROJECT_STORE, "readonly");
    const record = await requestResult(transaction.objectStore(PROJECT_STORE).get(projectId)) as StoredProjectRecord | undefined;
    await transactionDone(transaction);
    if (!record) {
      const project = createProjectData(projectId);
      await this.importProject(project);
      return reconcileFileStatus(project);
    }
    if (record.storageSchemaVersion !== STORAGE_SCHEMA_VERSION) throw new ProjectStorageError("incompatible", "本地项目存储版本不兼容，原数据未被覆盖。");
    return reconcileFileStatus(normalizeProjectData(record.project, projectId));
  }

  async list(): Promise<ProjectSummary[]> {
    await this.migrateAllLegacyProjects();
    const database = await openProjectDatabase();
    const transaction = database.transaction([PROJECT_STORE, FILE_STORE], "readonly");
    const records = await requestResult(transaction.objectStore(PROJECT_STORE).getAll()) as StoredProjectRecord[];
    const files = await requestResult(transaction.objectStore(FILE_STORE).getAll()) as ProjectFileRecord[];
    await transactionDone(transaction);
    const fileCounts = new Map<string, number>();
    for (const file of files) fileCounts.set(file.projectId, (fileCounts.get(file.projectId) ?? 0) + 1);
    return records.map((record) => {
      const project = normalizeProjectData(record.project, record.projectId);
      return {
        projectId: project.projectId,
        title: project.report.title,
        enterpriseName: project.enterprise.name,
        year: project.report.year,
        state: project.report.state,
        progress: project.report.progress,
        currentStep: project.report.currentStep,
        revision: project.revision,
        updatedAt: project.updatedAt,
        fileCount: fileCounts.get(project.projectId) ?? 0,
      };
    }).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async exists(projectId: string) {
    await this.migrateLegacyProject(projectId);
    const database = await openProjectDatabase();
    const transaction = database.transaction(PROJECT_STORE, "readonly");
    const key = await requestResult(transaction.objectStore(PROJECT_STORE).getKey(projectId));
    await transactionDone(transaction);
    return key !== undefined;
  }

  async create(input: CreateProjectInput) {
    const baseId = input.projectId?.trim() || `${slugify(input.enterpriseName)}-${input.year}`;
    let projectId = baseId;
    let suffix = 2;
    while (await this.exists(projectId)) projectId = `${baseId}-${suffix++}`;
    const project = createProjectData(projectId, input);
    return this.importProject(project);
  }

  async importProject(candidate: ReportProjectData) {
    const project = normalizeProjectData(candidate, candidate.projectId);
    if (await this.exists(project.projectId)) throw new ProjectStorageError("conflict", `项目 ${project.projectId} 已存在，恢复操作未覆盖原项目。`);
    await ensureStorageCapacity(new TextEncoder().encode(JSON.stringify(project)).byteLength);
    const database = await openProjectDatabase();
    const transaction = database.transaction(PROJECT_STORE, "readwrite");
    transaction.objectStore(PROJECT_STORE).add(recordFor(project));
    await transactionDone(transaction);
    announceProjectChange(project.projectId, project.revision);
    return project;
  }

  async save(projectId: string, candidate: ReportProjectData, context: ProjectSaveContext): Promise<ProjectSaveResult> {
    if (candidate.projectId !== projectId || candidate.report.id !== projectId) throw new ProjectStorageError("incompatible", "项目 ID 不一致，已阻止跨项目写入。");
    if (containsBinaryPayload(candidate)) throw new ProjectStorageError("binary-payload", "结构化项目数据包含文件二进制内容；文件必须写入独立文件仓库。");
    const synchronized = synchronizeProjectData(context.previous, candidate, context.step);
    const serializedBytes = new TextEncoder().encode(JSON.stringify(synchronized.project)).byteLength;
    await ensureStorageCapacity(serializedBytes);
    const database = await openProjectDatabase();
    const transaction = database.transaction(PROJECT_STORE, "readwrite");
    const store = transaction.objectStore(PROJECT_STORE);
    const stored = await requestResult(store.get(projectId)) as StoredProjectRecord | undefined;
    if (!stored) {
      transaction.abort();
      throw new ProjectStorageError("not-found", "项目不存在，已停止保存以避免写入错误项目。");
    }
    if (stored.revision !== context.expectedRevision) {
      transaction.abort();
      throw new ProjectStorageError("conflict", "项目已在另一个页面更新。请刷新并核对最新数据后再保存。");
    }
    const savedAt = new Date().toISOString();
    const project: ReportProjectData = {
      ...synchronized.project,
      revision: stored.revision + 1,
      lastSavedAt: savedAt,
      updatedAt: savedAt,
      report: { ...synchronized.project.report, updatedAt: savedAt.slice(0, 16).replace("T", " ") },
    };
    store.put(recordFor(project));
    await transactionDone(transaction);
    announceProjectChange(projectId, project.revision);
    return { project, impacts: synchronized.impacts };
  }

  subscribe(projectId: string, onChange: () => void) {
    if (typeof window === "undefined") return () => undefined;
    const onProjectEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string }>).detail;
      if (detail?.projectId === projectId) onChange();
    };
    window.addEventListener(PROJECT_EVENT, onProjectEvent);
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(PROJECT_CHANNEL);
      channel.onmessage = (event) => { if (event.data?.projectId === projectId) onChange(); };
    } catch {
      channel = null;
    }
    return () => {
      window.removeEventListener(PROJECT_EVENT, onProjectEvent);
      channel?.close();
    };
  }
}

export class IndexedDbProjectFileRepository implements ProjectFileRepository {
  async save(projectId: string, file: File | Blob, name?: string): Promise<ProjectFileRecord> {
    await ensureStorageCapacity(file.size);
    await requestPersistentStorage();
    const record: ProjectFileRecord = {
      fileId: crypto.randomUUID(),
      projectId,
      name: name ?? (typeof File !== "undefined" && file instanceof File ? file.name : "unnamed-file"),
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      createdAt: new Date().toISOString(),
      parserStatus: "not-started",
      blob: file,
    };
    const database = await openProjectDatabase();
    const transaction = database.transaction([PROJECT_STORE, FILE_STORE], "readwrite");
    const projectKey = await requestResult(transaction.objectStore(PROJECT_STORE).getKey(projectId));
    if (projectKey === undefined) {
      transaction.abort();
      throw new ProjectStorageError("not-found", "项目不存在，未保存文件字节。请先创建或打开有效项目。");
    }
    transaction.objectStore(FILE_STORE).add(record);
    await transactionDone(transaction);
    return record;
  }

  async import(record: ProjectFileRecord) {
    if (record.parserStatus !== "not-started") throw new ProjectStorageError("incompatible", "Phase 1 备份中的解析状态无效，已停止恢复。");
    await ensureStorageCapacity(record.size);
    const database = await openProjectDatabase();
    const transaction = database.transaction(FILE_STORE, "readwrite");
    transaction.objectStore(FILE_STORE).add(record);
    await transactionDone(transaction);
    return record;
  }

  async get(projectId: string, fileId: string) {
    const database = await openProjectDatabase();
    const transaction = database.transaction(FILE_STORE, "readonly");
    const record = await requestResult(transaction.objectStore(FILE_STORE).get(fileId)) as ProjectFileRecord | undefined;
    await transactionDone(transaction);
    return record?.projectId === projectId ? record : null;
  }

  async list(projectId: string) {
    return filesForProject(projectId);
  }

  async delete(projectId: string, fileId: string) {
    const database = await openProjectDatabase();
    const transaction = database.transaction([PROJECT_STORE, FILE_STORE], "readwrite");
    const projectRecord = await requestResult(transaction.objectStore(PROJECT_STORE).get(projectId)) as StoredProjectRecord | undefined;
    const fileRecord = await requestResult(transaction.objectStore(FILE_STORE).get(fileId)) as ProjectFileRecord | undefined;
    if (!fileRecord || fileRecord.projectId !== projectId) {
      transaction.abort();
      throw new ProjectStorageError("not-found", "文件不存在或不属于当前项目。");
    }
    if (projectRecord?.project.sources.some((source) => source.fileId === fileId)) {
      transaction.abort();
      throw new ProjectStorageError("referenced", "文件仍被来源记录引用。请先解除来源关联，再删除文件。");
    }
    transaction.objectStore(FILE_STORE).delete(fileId);
    await transactionDone(transaction);
  }
}

export const projectRepository: ReportProjectRepository = new IndexedDbReportProjectRepository();
export const projectFileRepository: ProjectFileRepository = new IndexedDbProjectFileRepository();
