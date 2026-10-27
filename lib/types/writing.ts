import type { EnterpriseFact, SourceReference } from './esg';

export type BlockKind = 'heading' | 'paragraph' | 'table' | 'case' | 'chart' | 'todo';
export type ChapterStatus = '未开始' | '撰写中' | '待完善' | '待审校' | '已审校';
export type ReviewStatus = '未审校' | '待审校' | '已审校' | '待复核';
export type CoverageStatus = '部分覆盖' | '已覆盖' | '待核验';
export type PendingKind = '待补充' | '待确认' | '待更新';
export interface DisclosureMapping { requirementId: string; coverage: CoverageStatus }
export interface FactCitation { factId: string; factRevision: number }
export interface ContentBlock {
  id: string; chapterId: string; kind: BlockKind; title: string; html: string;
  rows: string[][]; mappings: DisclosureMapping[]; citations: FactCitation[];
  sourceReferences: SourceReference[]; revision: number; updatedAt: string;
  reviewStatus: ReviewStatus; pendingKind?: PendingKind; resolved?: boolean;
}
export interface WritingChapter {
  id: string; title: string; order: string; parentId?: string;
  status: ChapterStatus; reviewStatus: ReviewStatus; revision: number;
  blocks: ContentBlock[]; sourceState?: 'active' | 'upstream-removed';
}
export interface WritingFact extends EnterpriseFact {
  revision: number; temporalType: '当年事实' | '历史事实' | '未来计划';
  sourceState?: 'active' | 'upstream-removed';
}
export interface WritingResource {
  id: string; chapterIds: string[]; kind: '案例' | '制度' | '历史资料';
  title: string; description: string; confirmed: boolean; sourceReferences: SourceReference[];
  revision: number; confirmedBy?: string; confirmedAt?: string;
}
export interface WritingRule { id: string; label: string; enabled: boolean }
export interface WritingPolicy {
  id: string; tone: '专业客观' | '简洁直接' | '审慎正式';
  terminology: string; rules: WritingRule[]; vagueTerms: string[];
}
export interface ChapterVersion {
  id: string; chapterId: string; number: number; savedAt: string; label: string;
  snapshot: WritingChapter;
}
export interface WritingDocument {
  schemaVersion: 1; projectId: string; chapters: WritingChapter[];
  facts: WritingFact[]; resources: WritingResource[]; policy: WritingPolicy;
  versions: ChapterVersion[]; savedAt?: string;
}
export type AiOperation = 'draft' | 'rewrite' | 'expand' | 'shorten' | 'tone' | 'update';
export interface AiTaskRequest {
  taskId: string; operation: AiOperation; chapter: WritingChapter;
  blockId?: string; selectedText?: string; sourceText: string;
  facts: WritingFact[]; requirementIds: string[]; policy: WritingPolicy;
}
export interface AiTaskResponse {
  taskId: string; providerId: string; providerMode: 'mock' | 'live'; label: string;
  original: string; suggestion: string; citedFactIds: string[];
  warnings: string[]; requiresConfirmation: boolean;
}
export interface AiTaskProvider {
  id: string; mode: 'mock' | 'live'; label: string;
  run(request: AiTaskRequest, signal?: AbortSignal): Promise<AiTaskResponse>;
}
