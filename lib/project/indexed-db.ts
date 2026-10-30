export const PROJECT_DATABASE_NAME = "esg-disclosure-platform";
export const PROJECT_DATABASE_VERSION = 1;
export const PROJECT_STORE = "projects";
export const FILE_STORE = "files";
export const META_STORE = "meta";

let databasePromise: Promise<IDBDatabase> | null = null;

export class IndexedDbStorageError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "IndexedDbStorageError";
  }
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB 请求失败"));
  });
}

export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB 事务已中止"));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB 事务失败"));
  });
}

export function openProjectDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  if (typeof indexedDB === "undefined") return Promise.reject(new IndexedDbStorageError("当前浏览器不支持 IndexedDB，无法使用本地项目存储。"));
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(PROJECT_DATABASE_NAME, PROJECT_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROJECT_STORE)) {
        const projects = database.createObjectStore(PROJECT_STORE, { keyPath: "projectId" });
        projects.createIndex("updatedAt", "updatedAt");
      }
      if (!database.objectStoreNames.contains(FILE_STORE)) {
        const files = database.createObjectStore(FILE_STORE, { keyPath: "fileId" });
        files.createIndex("projectId", "projectId");
        files.createIndex("projectAndName", ["projectId", "name"]);
      }
      if (!database.objectStoreNames.contains(META_STORE)) database.createObjectStore(META_STORE, { keyPath: "key" });
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(new IndexedDbStorageError("无法打开本地项目数据库。", request.error));
    };
    request.onblocked = () => reject(new IndexedDbStorageError("本地数据库升级被其他页面阻止，请关闭其他项目页面后重试。"));
  });
  return databasePromise;
}

export async function storageEstimate() {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return { usage: undefined, quota: undefined, available: undefined };
  const estimate = await navigator.storage.estimate();
  const usage = estimate.usage;
  const quota = estimate.quota;
  return { usage, quota, available: typeof usage === "number" && typeof quota === "number" ? Math.max(0, quota - usage) : undefined };
}

export async function requestPersistentStorage() {
  if (typeof navigator === "undefined" || !navigator.storage) return { supported: false, persisted: false };
  const alreadyPersisted = await navigator.storage.persisted?.().catch(() => false) ?? false;
  if (alreadyPersisted) return { supported: true, persisted: true };
  if (!navigator.storage.persist) return { supported: false, persisted: false };
  const persisted = await navigator.storage.persist().catch(() => false);
  return { supported: true, persisted };
}

export async function ensureStorageCapacity(additionalBytes: number) {
  const estimate = await storageEstimate();
  if (typeof estimate.available === "number" && estimate.available < additionalBytes + 1_000_000) {
    throw new IndexedDbStorageError(`本地存储剩余空间不足，需要至少 ${Math.ceil((additionalBytes + 1_000_000) / 1024 / 1024)} MB 可用空间。`);
  }
  return estimate;
}
