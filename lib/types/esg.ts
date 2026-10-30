export type ListingStatus = "A股" | "H股" | "A+H" | "未上市";
export type EsgCategory = "E" | "S" | "G";
export type StepState = "completed" | "in-progress" | "not-started";
export type ProjectState = "draft" | "reviewing" | "finalized";
export type Applicability = "适用" | "不适用" | "待确认";
export type CollectionState = "待分工" | "待收集" | "收集中" | "待确认" | "已确认";
export type SourceKind = "file" | "online" | "historical" | "manual";

export interface Enterprise {
  id: string;
  name: string;
  shortName: string;
  unifiedSocialCreditCode: string;
  industryCode: string;
  industryName: string;
  listingStatus: ListingStatus;
  stockCode?: string;
  headquarters: string;
  employeeCount: number;
  reportingContact: {
    name: string;
    department: string;
    email: string;
  };
}

export interface ReportStep {
  number: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  shortTitle: string;
  title: string;
  description: string;
  state: StepState;
}

export interface ReportProject {
  id: string;
  enterpriseId: string;
  title: string;
  year: number;
  reportingPeriod: { start: string; end: string };
  frameworks: string[];
  state: ProjectState;
  progress: number;
  currentStep: number;
  updatedAt: string;
  owner: string;
}

export interface UploadedSource {
  id: string;
  name: string;
  kind: SourceKind;
  fileType: "PDF" | "XLSX" | "DOCX" | "表单";
  fileId?: string;
  mimeType?: string;
  fileStatus?: "available" | "missing" | "metadata-only";
  parserStatus?: "not-started";
  size?: string;
  uploadedAt: string;
  uploadedBy: string;
  state: "已上传" | "解析中" | "已解析";
}

export interface EsgTopic {
  id: string;
  category: EsgCategory;
  name: string;
  origin: "披露框架" | "历史报告" | "用户新增";
  financialScore: number;
  impactScore: number;
  confirmed: boolean;
}

export interface DisclosureRequirement {
  id: string;
  framework: string;
  code: string;
  topic: string;
  summary: string;
  systemSuggestion: Applicability;
  applicability: Applicability;
  mappedSection: string;
  userConfirmed: boolean;
}

export interface ReportSection {
  id: string;
  order: string;
  title: string;
  level: 1 | 2;
  description: string;
  topics: string[];
  requirementCount: number;
  state: "待完善" | "已就绪";
}

export interface DataRequirement {
  id: string;
  itemName: string;
  section: string;
  type: "定量数据" | "定性说明" | "制度文件" | "案例";
  suggestedDepartment: string;
  responsibleDepartment: string;
  adjustedByUser: boolean;
  collectionMethod: "文件上传" | "在线补充" | "现有Excel";
  state: CollectionState;
  dueDate: string;
}

export interface SourceReference {
  id: string;
  sourceId: string;
  fileName: string;
  locator: string;
  excerpt: string;
}

export interface EnterpriseFact {
  id: string;
  name: string;
  value: string;
  unit?: string;
  period: string;
  topic: string;
  state: "待人工确认" | "已确认";
  sourceReferences: SourceReference[];
  confirmedBy?: string;
  metricDefinitionId?: string;
  categoryLabel?: string;
  seriesName?: string;
  compositionGroupId?: string;
  reportingBoundary?: string;
  boundaryStatus?: "待核验" | "已核验";
  sourceConfirmationStatus?: "待确认" | "已确认";
  comparabilityStatus?: "待核验" | "可比" | "不可比";
}

export interface AiNormalizationResult {
  id: string;
  dataRequirementId: string;
  label: "示例 AI 规整结果";
  sourceFile: string;
  sourceLocator: string;
  extractedField: string;
  extractedValue: string;
  period: string;
  state: "待人工确认" | "已确认";
}
