const DATABASE_NAME = "esg-disclosure-platform";
const DATABASE_VERSION = 1;
const PROJECT_STORE = "projects";
const FILE_STORE = "files";

async function openProjectDatabase(page) {
  return page.evaluate(async ({ databaseName, databaseVersion }) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return true;
  }, { databaseName: DATABASE_NAME, databaseVersion: DATABASE_VERSION });
}

async function readProject(page, projectId = "hualan-2025") {
  return page.evaluate(async ({ databaseName, projectStore, projectId }) => {
    const request = indexedDB.open(databaseName);
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(projectStore, "readonly");
    const get = transaction.objectStore(projectStore).get(projectId);
    const record = await new Promise((resolve, reject) => {
      get.onsuccess = () => resolve(get.result);
      get.onerror = () => reject(get.error);
    });
    database.close();
    return record?.project ?? null;
  }, { databaseName: DATABASE_NAME, projectStore: PROJECT_STORE, projectId });
}

async function writeProject(page, project, projectId = project.projectId) {
  return page.evaluate(async ({ databaseName, projectStore, projectId, project }) => {
    const request = indexedDB.open(databaseName);
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(projectStore, "readwrite");
    const store = transaction.objectStore(projectStore);
    const get = store.get(projectId);
    const previous = await new Promise((resolve, reject) => {
      get.onsuccess = () => resolve(get.result);
      get.onerror = () => reject(get.error);
    });
    store.put({
      ...previous,
      projectId,
      storageSchemaVersion: previous?.storageSchemaVersion ?? 1,
      revision: project.revision,
      updatedAt: project.updatedAt,
      project,
    });
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  }, { databaseName: DATABASE_NAME, projectStore: PROJECT_STORE, projectId, project });
}

async function mutateProject(page, mutator, argument, projectId = "hualan-2025") {
  const project = await readProject(page, projectId);
  if (!project) throw new Error(`IndexedDB project ${projectId} not found`);
  const draft = structuredClone(project);
  const changed = mutator(draft, argument) ?? draft;
  await writeProject(page, changed, projectId);
  return changed;
}

async function clearProjectDatabase(page) {
  return page.evaluate(async ({ databaseName, projectStore, fileStore }) => {
    localStorage.clear();
    const request = indexedDB.open(databaseName);
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const stores = [projectStore, fileStore, "meta"].filter((name) => database.objectStoreNames.contains(name));
    if (!stores.length) { database.close(); return; }
    const transaction = database.transaction(stores, "readwrite");
    for (const store of stores) transaction.objectStore(store).clear();
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  }, { databaseName: DATABASE_NAME, projectStore: PROJECT_STORE, fileStore: FILE_STORE });
}

async function readProjectFiles(page, projectId) {
  return page.evaluate(async ({ databaseName, fileStore, projectId }) => {
    const request = indexedDB.open(databaseName);
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(fileStore, "readonly");
    const getAll = transaction.objectStore(fileStore).index("projectId").getAll(projectId);
    const files = await new Promise((resolve, reject) => {
      getAll.onsuccess = () => resolve(getAll.result);
      getAll.onerror = () => reject(getAll.error);
    });
    database.close();
    return Promise.all(files.map(async (file) => ({
      fileId: file.fileId,
      projectId: file.projectId,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      parserStatus: file.parserStatus,
      text: await file.blob.text(),
    })));
  }, { databaseName: DATABASE_NAME, fileStore: FILE_STORE, projectId });
}

module.exports = {
  clearProjectDatabase,
  openProjectDatabase,
  readProject,
  readProjectFiles,
  writeProject,
  mutateProject,
};
