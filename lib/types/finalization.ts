import type { QualityCategory, QualityIssueStatus, QualitySeverity } from "@/lib/types/quality";

export interface FinalApprovalDeclarations {
  contentReviewed: boolean;
  sourcesReviewed: boolean;
  authorityConfirmed: boolean;
  exportPreviewReviewed: boolean;
}

export interface FinalIssueRecord {
  issueId: string;
  stableKey: string;
  category: QualityCategory;
  severity: QualitySeverity;
  title: string;
  status: QualityIssueStatus;
  resolutionNote?: string;
  exceptionReason?: string;
  inputFingerprint: string;
}

export interface FinalReportVersion {
  versionId: string;
  versionNumber: number;
  label: string;
  sourceFingerprint: string;
  qualityFullCheckRunId: string;
  qualityInputFingerprint: string;
  qualityRuleSetFingerprint: string;
  projectRevision: number;
  presentationRevision: number;
  enterpriseName: string;
  reportYear: number;
  reportingPeriod: { start: string; end: string };
  pageCount: number;
  issueSummary: { total: number; blockers: number; high: number; notices: number; acceptedExceptions: number };
  issueRecords: FinalIssueRecord[];
  declarations: FinalApprovalDeclarations;
  approvedBy: string;
  approverRole: string;
  approvalNote: string;
  finalizedAt: string;
}

export interface FinalizationState {
  schemaVersion: 1;
  versions: FinalReportVersion[];
  activeVersionId?: string;
  revision: number;
}
