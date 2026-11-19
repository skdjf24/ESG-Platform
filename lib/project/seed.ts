import {
  dataRequirements,
  disclosureRequirements,
  enterprise,
  esgTopics,
  historicalReports,
  reportProject,
  reportSections,
} from "@/lib/data/mock-data";
import type { ReportProjectData } from "@/lib/types/project-data";
import { createBlankWritingDocument, createWritingDocument } from "@/lib/writing/document";
import { createPresentationState } from "@/lib/presentation/state";
import { createQualityState } from "@/lib/quality/state";
import { createFinalizationState } from "@/lib/finalization/state";
import { defaultDepartments } from "@/lib/project/materials";
import { unscoredPresetTopic } from "@/lib/project/topics";

const seedTimestamp = "2026-10-26T08:00:00.000Z";

interface SeedOptions { title?: string; enterpriseName?: string; year?: number }

export function createBlankProjectData(projectId: string, options?: SeedOptions): ReportProjectData {
  const now = new Date().toISOString();
  const year = options?.year ?? new Date().getFullYear();
  const enterpriseName = options?.enterpriseName?.trim() ?? "";
  const writingDocument = createBlankWritingDocument(projectId);
  return {
    schemaVersion: 2,
    workflowOrder: "collection-first",
    departments: structuredClone(defaultDepartments),
    projectKind: "blank",
    projectId,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    enterprise: {
      id: `enterprise-${projectId}`,
      name: enterpriseName,
      shortName: enterpriseName,
      unifiedSocialCreditCode: "",
      industryCode: "",
      industryName: "",
      otherIndustries: [],
      listingStatus: "未上市",
      stockCode: "",
      headquarters: "",
      employeeCount: null,
      reportingContact: { name: "", department: "", email: "" },
    },
    report: {
      id: projectId,
      enterpriseId: `enterprise-${projectId}`,
      title: options?.title?.trim() ?? "",
      year,
      reportingPeriod: { start: `${year}-01-01`, end: `${year}-12-31` },
      frameworks: [],
      state: "draft",
      progress: 0,
      currentStep: 1,
      updatedAt: now,
      owner: "",
    },
    boundary: { items: [], note: "" },
    topics: esgTopics.map(unscoredPresetTopic),
    materiality: { method: "综合评估", includedTopicIds: esgTopics.map((topic) => topic.id), confirmed: false, revision: 1 },
    disclosureRequirements: [],
    reportSections: reportSections.map((section) => ({ ...structuredClone(section), description: "", topics: [],
      requirementCount: 0, state: "待完善" as const, revision: 1, sourceState: "active" as const })),
    dataRequirements: [],
    sources: [],
    facts: [],
    resources: [],
    writing: { schemaVersion: 1, chapters: writingDocument.chapters, policy: writingDocument.policy, versions: [] },
    presentation: createPresentationState(projectId, [], false),
    quality: createQualityState(),
    finalization: createFinalizationState(),
    impacts: [],
    migrations: [],
  };
}

export function createSampleProjectData(projectId: string, options?: SeedOptions): ReportProjectData {
  const writingDocument = createWritingDocument();
  const boundary = {
    items: [
      { id: "boundary-headquarters", name: "集团总部", detail: "华澜新材料总部", included: true },
      { id: "boundary-domestic", name: "境内控股子公司", detail: "12 家生产及经营主体", included: true },
      { id: "boundary-overseas", name: "境外控股子公司", detail: "2 家海外经营主体", included: true },
      { id: "boundary-associates", name: "参股公司", detail: "按重大影响程度选择", included: false },
    ],
    note: "覆盖华澜新材料总部及财务并表范围内的控股子公司；如无特别说明，环境与社会绩效数据均按此边界统计。",
  };
  const facts = structuredClone(writingDocument.facts);
  const year = options?.year ?? reportProject.year;
  const enterpriseData = structuredClone(enterprise);
  if (options?.enterpriseName) {
    enterpriseData.name = options.enterpriseName;
    enterpriseData.shortName = options.enterpriseName.slice(0, 8);
  }
  const reportData = { ...structuredClone(reportProject), id: projectId, year };
  if (options?.title) reportData.title = options.title;
  reportData.reportingPeriod = { start: `${year}.01.01`, end: `${year}.12.31` };
  return {
    schemaVersion: 2,
    workflowOrder: "collection-first",
    departments: structuredClone(defaultDepartments),
    projectKind: "sample",
    projectId,
    revision: 1,
    createdAt: seedTimestamp,
    updatedAt: seedTimestamp,
    enterprise: enterpriseData,
    report: reportData,
    boundary,
    topics: structuredClone(esgTopics),
    materiality: {
      method: "综合评估",
      includedTopicIds: esgTopics.map((topic) => topic.id),
      confirmed: true,
      confirmedAt: seedTimestamp,
      revision: 1,
    },
    disclosureRequirements: disclosureRequirements.map((item) => ({
      ...structuredClone(item),
      revision: 1,
      reviewStatus: "有效",
    })),
    reportSections: reportSections.map((item) => ({
      ...structuredClone(item),
      revision: 1,
      sourceState: "active",
    })),
    dataRequirements: dataRequirements.map((item) => ({
      ...structuredClone(item),
      revision: 1,
      reviewStatus: "有效",
    })),
    // The sample source rows contain metadata only. They are deliberately not
    // represented as parsed files until a user supplies real bytes.
    sources: structuredClone(historicalReports).map((source) => ({
      ...source,
      state: "已上传" as const,
      fileStatus: "metadata-only" as const,
      parserStatus: "not-started" as const,
    })),
    facts,
    resources: structuredClone(writingDocument.resources),
    writing: {
      schemaVersion: 1,
      chapters: structuredClone(writingDocument.chapters),
      policy: structuredClone(writingDocument.policy),
      versions: structuredClone(writingDocument.versions),
      savedAt: writingDocument.savedAt,
    },
    presentation: createPresentationState(projectId, facts),
    quality: createQualityState(),
    finalization: createFinalizationState(),
    impacts: [],
    migrations: [],
  };
}
