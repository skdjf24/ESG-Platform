import {
  EXTRACTION_CANDIDATE_STORE,
  openProjectDatabase,
  PARSED_DOCUMENT_STORE,
  requestResult,
  transactionDone,
} from "@/lib/project/indexed-db";
import type {
  ExtractionCandidate,
  ExtractionCandidateRepository,
  ParsedDocument,
  ParsedDocumentRepository,
} from "@/lib/types/parsing";

export class IndexedDbParsedDocumentRepository implements ParsedDocumentRepository {
  async get(parsedDocumentId: string) {
    const database = await openProjectDatabase();
    const transaction = database.transaction(PARSED_DOCUMENT_STORE, "readonly");
    const document = await requestResult(transaction.objectStore(PARSED_DOCUMENT_STORE).get(parsedDocumentId)) as ParsedDocument | undefined;
    await transactionDone(transaction);
    return document ?? null;
  }

  async getByFile(projectId: string, fileId: string) {
    const database = await openProjectDatabase();
    const transaction = database.transaction(PARSED_DOCUMENT_STORE, "readonly");
    const documents = await requestResult(transaction.objectStore(PARSED_DOCUMENT_STORE).index("projectAndFile").getAll([projectId, fileId])) as ParsedDocument[];
    await transactionDone(transaction);
    return documents.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
  }

  async listByProject(projectId: string) {
    const database = await openProjectDatabase();
    const transaction = database.transaction(PARSED_DOCUMENT_STORE, "readonly");
    const documents = await requestResult(transaction.objectStore(PARSED_DOCUMENT_STORE).index("projectId").getAll(projectId)) as ParsedDocument[];
    await transactionDone(transaction);
    return documents.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async save(document: ParsedDocument) {
    const database = await openProjectDatabase();
    const transaction = database.transaction(PARSED_DOCUMENT_STORE, "readwrite");
    transaction.objectStore(PARSED_DOCUMENT_STORE).put(document);
    await transactionDone(transaction);
  }

  async markStale(projectId: string, fileId: string, reason: string) {
    const database = await openProjectDatabase();
    const transaction = database.transaction(PARSED_DOCUMENT_STORE, "readwrite");
    const store = transaction.objectStore(PARSED_DOCUMENT_STORE);
    const documents = await requestResult(store.index("projectAndFile").getAll([projectId, fileId])) as ParsedDocument[];
    const now = new Date().toISOString();
    for (const document of documents) store.put({
      ...document,
      status: "stale",
      updatedAt: now,
      warnings: [...document.warnings, { code: "SOURCE_CHANGED", message: reason }],
    } satisfies ParsedDocument);
    await transactionDone(transaction);
  }

  async deleteByFile(projectId: string, fileId: string) {
    const database = await openProjectDatabase();
    const transaction = database.transaction(PARSED_DOCUMENT_STORE, "readwrite");
    const store = transaction.objectStore(PARSED_DOCUMENT_STORE);
    const keys = await requestResult(store.index("projectAndFile").getAllKeys([projectId, fileId]));
    for (const key of keys) store.delete(key);
    await transactionDone(transaction);
  }
}

export class IndexedDbExtractionCandidateRepository implements ExtractionCandidateRepository {
  async get(candidateId: string) {
    const database = await openProjectDatabase();
    const transaction = database.transaction(EXTRACTION_CANDIDATE_STORE, "readonly");
    const candidate = await requestResult(transaction.objectStore(EXTRACTION_CANDIDATE_STORE).get(candidateId)) as ExtractionCandidate | undefined;
    await transactionDone(transaction);
    return candidate ?? null;
  }

  async listByProject(projectId: string) {
    const database = await openProjectDatabase();
    const transaction = database.transaction(EXTRACTION_CANDIDATE_STORE, "readonly");
    const candidates = await requestResult(transaction.objectStore(EXTRACTION_CANDIDATE_STORE).index("projectId").getAll(projectId)) as ExtractionCandidate[];
    await transactionDone(transaction);
    return candidates.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async listByFile(projectId: string, fileId: string) {
    const database = await openProjectDatabase();
    const transaction = database.transaction(EXTRACTION_CANDIDATE_STORE, "readonly");
    const candidates = await requestResult(transaction.objectStore(EXTRACTION_CANDIDATE_STORE).index("projectAndFile").getAll([projectId, fileId])) as ExtractionCandidate[];
    await transactionDone(transaction);
    return candidates.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async mergeParsed(candidates: ExtractionCandidate[]) {
    if (!candidates.length) return [];
    const database = await openProjectDatabase();
    const transaction = database.transaction(EXTRACTION_CANDIDATE_STORE, "readwrite");
    const store = transaction.objectStore(EXTRACTION_CANDIDATE_STORE);
    const merged: ExtractionCandidate[] = [];
    for (const candidate of candidates) {
      const existing = await requestResult(store.get(candidate.candidateId)) as ExtractionCandidate | undefined;
      const next = existing ? {
        ...candidate,
        label: existing.label,
        value: existing.value,
        unit: existing.unit,
        period: existing.period,
        boundary: existing.boundary,
        note: existing.note,
        status: existing.status,
        reviewedAt: existing.reviewedAt,
        confirmedEntityId: existing.confirmedEntityId,
        createdAt: existing.createdAt,
      } : candidate;
      store.put(next);
      merged.push(next);
    }
    await transactionDone(transaction);
    return merged;
  }

  async save(candidate: ExtractionCandidate) {
    const database = await openProjectDatabase();
    const transaction = database.transaction(EXTRACTION_CANDIDATE_STORE, "readwrite");
    transaction.objectStore(EXTRACTION_CANDIDATE_STORE).put(candidate);
    await transactionDone(transaction);
  }

  async markFileNeedsReview(projectId: string, fileId: string) {
    const database = await openProjectDatabase();
    const transaction = database.transaction(EXTRACTION_CANDIDATE_STORE, "readwrite");
    const store = transaction.objectStore(EXTRACTION_CANDIDATE_STORE);
    const candidates = await requestResult(store.index("projectAndFile").getAll([projectId, fileId])) as ExtractionCandidate[];
    const updatedAt = new Date().toISOString();
    for (const candidate of candidates) {
      if (candidate.status === "rejected") continue;
      store.put({ ...candidate, status: "needs-review", updatedAt } satisfies ExtractionCandidate);
    }
    await transactionDone(transaction);
  }
}

export const parsedDocumentRepository: ParsedDocumentRepository = new IndexedDbParsedDocumentRepository();
export const extractionCandidateRepository: ExtractionCandidateRepository = new IndexedDbExtractionCandidateRepository();
