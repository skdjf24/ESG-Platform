import { createFinalizationState } from "@/lib/finalization/state";
import { createPresentationState } from "@/lib/presentation/state";
import { createQualityState } from "@/lib/quality/state";
import { ensureStorageCapacity, FILE_STORE, openProjectDatabase, PROJECT_STORE, requestResult, transactionDone } from "@/lib/project/indexed-db";
import { normalizeProjectData, projectFileRepository, projectRepository, ProjectStorageError } from "@/lib/project/repository";
import type { ProjectFileRecord, ReportProjectData } from "@/lib/types/project-data";

export const PROJECT_BACKUP_SCHEMA_VERSION = 1;

interface BackupFile {
  fileId: string;
  projectId: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
  parserStatus: "not-started";
  dataBase64: string;
}

export interface ProjectBackupArchive {
  manifest: {
    schemaVersion: 1;
    exportedAt: string;
    projectId: string;
    projectSchemaVersion: number;
    projectRevision: number;
    fileCount: number;
  };
  project: ReportProjectData;
  files: BackupFile[];
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 32_768;
  for (let index = 0; index < bytes.length; index += chunkSize) binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function backupFileName(project: ReportProjectData) {
  return `${project.projectId}-backup-${new Date().toISOString().slice(0, 10)}.esgbackup.json`;
}

export async function createProjectBackup(projectId: string) {
  const project = await projectRepository.load(projectId);
  const records = await projectFileRepository.list(projectId);
  const files: BackupFile[] = [];
  for (const record of records) {
    files.push({
      fileId: record.fileId,
      projectId: record.projectId,
      name: record.name,
      mimeType: record.mimeType,
      size: record.size,
      createdAt: record.createdAt,
      parserStatus: "not-started",
      dataBase64: bytesToBase64(new Uint8Array(await record.blob.arrayBuffer())),
    });
  }
  const archive: ProjectBackupArchive = {
    manifest: {
      schemaVersion: PROJECT_BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      projectId,
      projectSchemaVersion: project.schemaVersion,
      projectRevision: project.revision,
      fileCount: files.length,
    },
    project,
    files,
  };
  return { archive, blob: new Blob([JSON.stringify(archive)], { type: "application/json" }), fileName: backupFileName(project) };
}

export async function downloadProjectBackup(projectId: string) {
  const { blob, fileName } = await createProjectBackup(projectId);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function putProjectAndFiles(project: ReportProjectData, files: ProjectFileRecord[]) {
  const totalSize = new TextEncoder().encode(JSON.stringify(project)).byteLength + files.reduce((sum, file) => sum + file.size, 0);
  await ensureStorageCapacity(totalSize);
  const database = await openProjectDatabase();
  const transaction = database.transaction([PROJECT_STORE, FILE_STORE], "readwrite");
  const projects = transaction.objectStore(PROJECT_STORE);
  const existing = await requestResult(projects.getKey(project.projectId));
  if (existing !== undefined) {
    transaction.abort();
    throw new ProjectStorageError("conflict", `项目 ${project.projectId} 已存在；恢复/复制操作未覆盖原项目。`);
  }
  projects.add({ projectId: project.projectId, storageSchemaVersion: 1, revision: project.revision, updatedAt: project.updatedAt, project });
  const fileStore = transaction.objectStore(FILE_STORE);
  for (const file of files) fileStore.add(file);
  await transactionDone(transaction);
}

export async function restoreProjectBackup(file: File) {
  let archive: ProjectBackupArchive;
  try {
    archive = JSON.parse(await file.text()) as ProjectBackupArchive;
  } catch {
    throw new ProjectStorageError("incompatible", "备份文件不是有效 JSON，未写入任何项目数据。");
  }
  if (!archive?.manifest || archive.manifest.schemaVersion !== PROJECT_BACKUP_SCHEMA_VERSION || !Array.isArray(archive.files)) throw new ProjectStorageError("incompatible", "备份 manifest/schemaVersion 不受支持，未写入任何项目数据。");
  if (archive.manifest.projectId !== archive.project?.projectId || archive.manifest.fileCount !== archive.files.length) throw new ProjectStorageError("incompatible", "备份 manifest 与项目或文件数量不一致，未写入任何项目数据。");
  if (archive.manifest.projectSchemaVersion !== archive.project.schemaVersion || archive.manifest.projectRevision !== archive.project.revision) throw new ProjectStorageError("incompatible", "备份 manifest 与项目 schema/revision 不一致，未写入任何项目数据。");
  const normalizedProject = normalizeProjectData(archive.project, archive.manifest.projectId);
  const archivedFileIds = new Set(archive.files.map((item) => item.fileId));
  if (archivedFileIds.size !== archive.files.length) throw new ProjectStorageError("incompatible", "备份包含重复 fileId，未写入任何项目数据。");
  const unavailable = normalizedProject.sources.filter((source) => source.fileId && source.fileStatus === "available" && !archivedFileIds.has(source.fileId));
  if (unavailable.length) throw new ProjectStorageError("incompatible", `备份缺少 ${unavailable.length} 个来源文件字节，未恢复项目。`);
  const fileIdMap = new Map(archive.files.map((item) => [item.fileId, crypto.randomUUID()]));
  const files = archive.files.map((item) => {
    const bytes = base64ToBytes(item.dataBase64);
    if (bytes.byteLength !== item.size || item.projectId !== normalizedProject.projectId || item.parserStatus !== "not-started") throw new ProjectStorageError("incompatible", `备份文件 ${item.name} 校验失败，未写入任何项目数据。`);
    return {
      fileId: fileIdMap.get(item.fileId)!,
      projectId: item.projectId,
      name: item.name,
      mimeType: item.mimeType,
      size: item.size,
      createdAt: item.createdAt,
      parserStatus: item.parserStatus,
      blob: new Blob([bytes], { type: item.mimeType }),
    } satisfies ProjectFileRecord;
  });
  const project = {
    ...normalizedProject,
    sources: normalizedProject.sources.map((source) => source.fileId ? { ...source, fileId: fileIdMap.get(source.fileId) } : source),
  };
  await putProjectAndFiles(project, files);
  return project;
}

function nextProjectId(project: ReportProjectData, year: number) {
  const withoutYear = project.projectId.replace(/-20\d{2}(?:-\d+)?$/, "");
  return `${withoutYear}-${year}`;
}

export async function copyProjectToNextYear(projectId: string, targetYear?: number) {
  const source = await projectRepository.load(projectId);
  const year = targetYear ?? source.report.year + 1;
  let newProjectId = nextProjectId(source, year);
  let suffix = 2;
  while (await projectRepository.exists(newProjectId)) newProjectId = `${nextProjectId(source, year)}-${suffix++}`;
  const sourceFiles = await projectFileRepository.list(projectId);
  const fileIdMap = new Map<string, string>();
  const files = sourceFiles.map((file) => {
    const fileId = crypto.randomUUID();
    fileIdMap.set(file.fileId, fileId);
    return { ...file, fileId, projectId: newProjectId, createdAt: new Date().toISOString(), parserStatus: "not-started" as const };
  });
  const now = new Date().toISOString();
  const facts = structuredClone(source.facts).map((fact) => ({ ...fact, state: "待人工确认" as const, confirmedBy: undefined, sourceConfirmationStatus: "待确认" as const, boundaryStatus: "待核验" as const, comparabilityStatus: "待核验" as const, revision: fact.revision + 1 }));
  const project: ReportProjectData = {
    ...structuredClone(source),
    projectId: newProjectId,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    lastSavedAt: undefined,
    report: {
      ...source.report,
      id: newProjectId,
      title: source.report.title.replace(String(source.report.year), String(year)),
      year,
      reportingPeriod: { start: `${year}.01.01`, end: `${year}.12.31` },
      state: "draft",
      progress: 0,
      currentStep: 1,
      updatedAt: now.slice(0, 16).replace("T", " "),
    },
    materiality: { ...source.materiality, confirmed: false, confirmedAt: undefined, revision: source.materiality.revision + 1 },
    disclosureRequirements: source.disclosureRequirements.map((item) => ({ ...item, userConfirmed: false, reviewStatus: "待复核", revision: item.revision + 1 })),
    dataRequirements: source.dataRequirements.map((item) => ({ ...item, state: "待收集", reviewStatus: "待复核", revision: item.revision + 1 })),
    sources: source.sources.map((item) => {
      const copiedFileId = item.fileId ? fileIdMap.get(item.fileId) : undefined;
      return {
        ...item,
        fileId: copiedFileId,
        fileStatus: copiedFileId ? "available" as const : item.fileId ? "missing" as const : item.fileStatus,
        parserStatus: "not-started" as const,
      };
    }),
    facts,
    resources: source.resources.map((item) => ({ ...item, confirmed: false, confirmedBy: undefined, confirmedAt: undefined, revision: item.revision + 1 })),
    writing: {
      ...source.writing,
      chapters: source.writing.chapters.map((chapter) => ({ ...chapter, status: "待完善", reviewStatus: "待复核", revision: chapter.revision + 1, blocks: chapter.blocks.map((block) => ({ ...block, reviewStatus: "待复核", pendingKind: "待更新", resolved: false, revision: block.revision + 1 })) })),
      versions: [],
      savedAt: undefined,
    },
    presentation: createPresentationState(newProjectId, facts),
    quality: createQualityState(),
    finalization: createFinalizationState(),
    impacts: [],
    migrations: [...source.migrations, { id: `copy-next-year-${newProjectId}`, from: source.projectId, migratedAt: now, note: `从 ${source.report.year} 年项目复制结构到 ${year} 年；Materiality、Requirement、Facts、Step 7 和 Step 8 状态已重置。` }],
  };
  await putProjectAndFiles(project, files);
  return project;
}
