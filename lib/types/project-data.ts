import type {
  Applicability,
  DataRequirement,
  DisclosureRequirement,
  Enterprise,
  EsgTopic,
  ReportProject,
  ReportSection,
  UploadedSource,
} from "@/lib/types/esg";
import type {
  ChapterVersion,
  WritingChapter,
  WritingFact,
  WritingPolicy,
  WritingResource,
} from "@/lib/types/writing";
import type { ReportPresentationState } from "@/lib/types/presentation";
import type { QualityCheckState } from "@/lib/types/quality";
import type { FinalizationState } from "@/lib/types/finalization";

export type MaterialityMethod = "综合评估" | "管理层评估" | "利益相关方问卷";
export type EntityReviewStatus = "有效" | "待复核";
export type SourceState = "active" | "upstream-removed";
export type ProjectStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface ReportBoundaryItem {
  id: string;
  name: string;
  detail: string;
  included: boolean;
}

export interface ReportBoundary {
  items: ReportBoundaryItem[];
  note: string;
}

export interface MaterialityAssessment {
  method: MaterialityMethod;
  includedTopicIds: string[];
  confirmed: boolean;
  confirmedAt?: string;
  revision: number;
}

export interface ProjectDisclosureRequirement extends DisclosureRequirement {
  revision: number;
  reviewStatus: EntityReviewStatus;
}

export interface ProjectReportSection extends ReportSection {
  revision: number;
  sourceState: SourceState;
}

export interface ProjectDataRequirement extends DataRequirement {
  revision: number;
  reviewStatus: EntityReviewStatus;
}

export interface ProjectWritingState {
  schemaVersion: 1;
  chapters: WritingChapter[];
  policy: WritingPolicy;
  versions: ChapterVersion[];
  savedAt?: string;
}

export type ImpactEntityType = "enterprise" | "framework" | "topic" | "requirement" | "section" | "data-requirement" | "fact" | "chart" | "presentation" | "quality";

export interface ChangeImpact {
  id: string;
  sourceStep: ProjectStep;
  targetSteps: ProjectStep[];
  entityType: ImpactEntityType;
  entityId: string;
  message: string;
  affectedIds: string[];
  createdAt: string;
  status: "待复核" | "已知悉";
}

export interface MigrationRecord {
  id: string;
  from: string;
  migratedAt: string;
  note: string;
}

export interface ReportProjectData {
  schemaVersion: 2;
  projectId: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  lastSavedAt?: string;
  enterprise: Enterprise;
  report: ReportProject;
  boundary: ReportBoundary;
  topics: EsgTopic[];
  materiality: MaterialityAssessment;
  disclosureRequirements: ProjectDisclosureRequirement[];
  reportSections: ProjectReportSection[];
  dataRequirements: ProjectDataRequirement[];
  sources: UploadedSource[];
  facts: WritingFact[];
  resources: WritingResource[];
  writing: ProjectWritingState;
  presentation: ReportPresentationState;
  quality: QualityCheckState;
  finalization: FinalizationState;
  impacts: ChangeImpact[];
  migrations: MigrationRecord[];
}

export interface ProjectSaveContext {
  step: ProjectStep;
  label: string;
  expectedRevision: number;
  previous: ReportProjectData;
}

export interface ProjectSaveResult {
  project: ReportProjectData;
  impacts: ChangeImpact[];
}

export interface ProjectSummary {
  projectId: string;
  title: string;
  enterpriseName: string;
  year: number;
  state: ReportProjectData["report"]["state"];
  progress: number;
  currentStep: number;
  revision: number;
  updatedAt: string;
  fileCount: number;
}

export interface CreateProjectInput {
  projectId?: string;
  title: string;
  enterpriseName: string;
  year: number;
}

export interface ReportProjectRepository {
  load(projectId: string): Promise<ReportProjectData>;
  save(projectId: string, project: ReportProjectData, context: ProjectSaveContext): Promise<ProjectSaveResult>;
  list(): Promise<ProjectSummary[]>;
  create(input: CreateProjectInput): Promise<ReportProjectData>;
  importProject(project: ReportProjectData): Promise<ReportProjectData>;
  exists(projectId: string): Promise<boolean>;
  subscribe(projectId: string, onChange: () => void): () => void;
}

export interface ProjectFileRecord {
  fileId: string;
  projectId: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
  parserStatus: "not-started";
  blob: Blob;
}

export interface ProjectFileRepository {
  save(projectId: string, file: File | Blob, name?: string): Promise<ProjectFileRecord>;
  get(projectId: string, fileId: string): Promise<ProjectFileRecord | null>;
  list(projectId: string): Promise<ProjectFileRecord[]>;
  delete(projectId: string, fileId: string): Promise<void>;
  import(record: ProjectFileRecord): Promise<ProjectFileRecord>;
}

export interface RequirementDecisionUpdate {
  id: string;
  applicability: Applicability;
  userConfirmed: boolean;
}
