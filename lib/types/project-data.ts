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

export type MaterialityMethod = "综合评估" | "管理层评估" | "利益相关方问卷";
export type EntityReviewStatus = "有效" | "待复核";
export type SourceState = "active" | "upstream-removed";
export type ProjectStep = 1 | 2 | 3 | 4 | 5 | 6;

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

export type ImpactEntityType = "enterprise" | "framework" | "topic" | "requirement" | "section" | "data-requirement" | "fact" | "chart" | "presentation";

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

export interface ReportProjectRepository {
  load(projectId: string): Promise<ReportProjectData>;
  save(projectId: string, project: ReportProjectData, context: ProjectSaveContext): Promise<ProjectSaveResult>;
  subscribe(projectId: string, onChange: () => void): () => void;
}

export interface RequirementDecisionUpdate {
  id: string;
  applicability: Applicability;
  userConfirmed: boolean;
}
