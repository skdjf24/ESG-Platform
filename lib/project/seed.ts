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
import { createWritingDocument } from "@/lib/writing/document";

const seedTimestamp = "2026-10-26T08:00:00.000Z";

export function createProjectData(projectId: string): ReportProjectData {
  const writingDocument = createWritingDocument();
  return {
    schemaVersion: 2,
    projectId,
    revision: 1,
    createdAt: seedTimestamp,
    updatedAt: seedTimestamp,
    enterprise: structuredClone(enterprise),
    report: { ...structuredClone(reportProject), id: projectId },
    boundary: {
      items: [
        { id: "boundary-headquarters", name: "集团总部", detail: "华澜新材料总部", included: true },
        { id: "boundary-domestic", name: "境内控股子公司", detail: "12 家生产及经营主体", included: true },
        { id: "boundary-overseas", name: "境外控股子公司", detail: "2 家海外经营主体", included: true },
        { id: "boundary-associates", name: "参股公司", detail: "按重大影响程度选择", included: false },
      ],
      note: "覆盖华澜新材料总部及财务并表范围内的控股子公司；如无特别说明，环境与社会绩效数据均按此边界统计。",
    },
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
    // Only metadata is stored. Browser File/Blob payloads are intentionally
    // outside the project snapshot and must use object storage in production.
    sources: structuredClone(historicalReports),
    facts: structuredClone(writingDocument.facts),
    resources: structuredClone(writingDocument.resources),
    writing: {
      schemaVersion: 1,
      chapters: structuredClone(writingDocument.chapters),
      policy: structuredClone(writingDocument.policy),
      versions: structuredClone(writingDocument.versions),
      savedAt: writingDocument.savedAt,
    },
    impacts: [],
    migrations: [],
  };
}
