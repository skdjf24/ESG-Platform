import type {
  AiNormalizationResult,
  DataRequirement,
  DisclosureRequirement,
  Enterprise,
  EnterpriseFact,
  EsgTopic,
  ReportProject,
  ReportSection,
  ReportStep,
  UploadedSource,
} from "@/lib/types/esg";

export const enterprise: Enterprise = {
  id: "enterprise-hualan",
  name: "华澜新材料股份有限公司",
  shortName: "华澜新材",
  unifiedSocialCreditCode: "91310000MA1FL8XQ7P",
  industryCode: "C26",
  industryName: "化学原料和化学制品制造业",
  listingStatus: "A股",
  stockCode: "688218.SH",
  headquarters: "上海市浦东新区",
  employeeCount: 4280,
  reportingContact: {
    name: "林悦",
    department: "董事会办公室",
    email: "lin.yue@example.com",
  },
};

export const reportProject: ReportProject = {
  id: "hualan-2025",
  enterpriseId: enterprise.id,
  title: "华澜新材料 2025 年度 ESG 报告",
  year: 2025,
  reportingPeriod: { start: "2025-01-01", end: "2025-12-31" },
  frameworks: ["上交所指引", "GRI Standards", "CASS-ESG 6.0"],
  state: "draft",
  progress: 46,
  currentStep: 4,
  updatedAt: "2026-10-26 14:32",
  owner: "林悦",
};

export const reportSteps: ReportStep[] = [
  { number: 1, shortTitle: "创建与画像", title: "创建报告与企业基础画像", description: "确认企业信息、报告范围与初始议题池", state: "completed" },
  { number: 2, shortTitle: "议题评估", title: "ESG 实质性议题评估", description: "开展双重重要性评估并由用户确认", state: "completed" },
  { number: 3, shortTitle: "框架与大纲", title: "构建披露框架与报告大纲", description: "映射披露要求并形成资料清单", state: "completed" },
  { number: 4, shortTitle: "资料收集", title: "ESG 资料收集、汇总与规整", description: "分工、收集并建立可追溯事实库", state: "in-progress" },
  { number: 5, shortTitle: "辅助撰写", title: "AI 辅助报告撰写", description: "基于已确认事实辅助生成章节初稿", state: "not-started" },
  { number: 6, shortTitle: "可视化排版", title: "可视化与报告排版", description: "图表、版式与品牌样式编辑", state: "not-started" },
  { number: 7, shortTitle: "质量检查", title: "质量与合规检查", description: "一致性、完整性与披露要求检查", state: "not-started" },
  { number: 8, shortTitle: "定稿导出", title: "定稿与导出", description: "版本确认并导出最终报告", state: "not-started" },
];

export const historicalReports: UploadedSource[] = [
  {
    id: "source-history-2024",
    name: "华澜新材料2024年度ESG报告.pdf",
    kind: "historical",
    fileType: "PDF",
    size: "12.8 MB",
    uploadedAt: "2026-10-18",
    uploadedBy: "林悦",
    state: "已解析",
  },
];

export const esgTopics: EsgTopic[] = [
  { id: "topic-climate", category: "E", name: "气候变化", origin: "披露框架", financialScore: 4.6, impactScore: 4.4, confirmed: true },
  { id: "topic-energy", category: "E", name: "能源管理", origin: "历史报告", financialScore: 4.2, impactScore: 4.5, confirmed: true },
  { id: "topic-water", category: "E", name: "水资源管理", origin: "披露框架", financialScore: 3.6, impactScore: 4.1, confirmed: true },
  { id: "topic-emission", category: "E", name: "污染物排放", origin: "披露框架", financialScore: 4.0, impactScore: 4.6, confirmed: true },
  { id: "topic-safety", category: "S", name: "职业健康与安全", origin: "披露框架", financialScore: 4.0, impactScore: 4.7, confirmed: true },
  { id: "topic-talent", category: "S", name: "员工发展", origin: "历史报告", financialScore: 3.8, impactScore: 3.9, confirmed: true },
  { id: "topic-supply", category: "S", name: "供应链管理", origin: "用户新增", financialScore: 3.9, impactScore: 3.7, confirmed: true },
  { id: "topic-ethics", category: "G", name: "商业道德", origin: "披露框架", financialScore: 4.3, impactScore: 4.2, confirmed: true },
  { id: "topic-data", category: "G", name: "数据安全", origin: "用户新增", financialScore: 4.1, impactScore: 3.8, confirmed: true },
];

export const disclosureRequirements: DisclosureRequirement[] = [
  { id: "req-gri-302-1", framework: "GRI", code: "302-1", topic: "能源管理", summary: "组织内部的能源消耗量", systemSuggestion: "适用", applicability: "适用", mappedSection: "4.2 资源与能源管理", userConfirmed: true },
  { id: "req-sse-4", framework: "上交所", code: "第四章", topic: "气候变化", summary: "应对气候变化相关治理与行动", systemSuggestion: "适用", applicability: "适用", mappedSection: "4.1 应对气候变化", userConfirmed: true },
  { id: "req-gri-403", framework: "GRI", code: "403-9", topic: "职业健康与安全", summary: "工伤相关指标与管理措施", systemSuggestion: "适用", applicability: "适用", mappedSection: "5.1 员工健康与安全", userConfirmed: true },
  { id: "req-cass-m3", framework: "CASS-ESG", code: "M3.2", topic: "污染物排放", summary: "废气、废水与固体废物管理", systemSuggestion: "适用", applicability: "适用", mappedSection: "4.3 污染防治", userConfirmed: true },
  { id: "req-gri-2-27", framework: "GRI", code: "2-27", topic: "商业道德", summary: "遵守法律法规", systemSuggestion: "适用", applicability: "适用", mappedSection: "6.2 合规经营", userConfirmed: true },
];

export const reportSections: ReportSection[] = [
  { id: "section-1", order: "01", title: "董事长致辞", level: 1, description: "回顾年度关键进展并说明 ESG 承诺", topics: [], requirementCount: 0, state: "待完善" },
  { id: "section-2", order: "02", title: "关于本报告", level: 1, description: "说明编制依据、报告范围与称谓", topics: [], requirementCount: 4, state: "已就绪" },
  { id: "section-3", order: "03", title: "ESG 管理", level: 1, description: "治理架构、利益相关方沟通与实质性议题", topics: ["商业道德"], requirementCount: 8, state: "已就绪" },
  { id: "section-4", order: "04", title: "环境责任", level: 1, description: "气候、能源、资源与污染防治", topics: ["气候变化", "能源管理", "污染物排放"], requirementCount: 16, state: "已就绪" },
  { id: "section-4-2", order: "4.2", title: "资源与能源管理", level: 2, description: "能源管理制度、消耗与节能成效", topics: ["能源管理"], requirementCount: 5, state: "已就绪" },
  { id: "section-5", order: "05", title: "社会责任", level: 1, description: "员工、供应链与社区责任", topics: ["职业健康与安全", "员工发展"], requirementCount: 14, state: "待完善" },
  { id: "section-6", order: "06", title: "公司治理", level: 1, description: "治理结构、风控与商业道德", topics: ["商业道德", "数据安全"], requirementCount: 11, state: "已就绪" },
  { id: "section-7", order: "07", title: "附录索引", level: 1, description: "指标索引及意见反馈", topics: [], requirementCount: 6, state: "待完善" },
];

export const dataRequirements: DataRequirement[] = [
  { id: "data-energy", itemName: "2025 年综合能源消耗量", section: "4.2 资源与能源管理", type: "定量数据", suggestedDepartment: "生产运营部", responsibleDepartment: "安全环保部", adjustedByUser: true, collectionMethod: "现有Excel", state: "待确认", dueDate: "2026-11-05" },
  { id: "data-ghg", itemName: "温室气体排放量及核算边界", section: "4.1 应对气候变化", type: "定量数据", suggestedDepartment: "安全环保部", responsibleDepartment: "安全环保部", adjustedByUser: false, collectionMethod: "文件上传", state: "收集中", dueDate: "2026-11-08" },
  { id: "data-safety", itemName: "工伤与安全生产培训数据", section: "5.1 员工健康与安全", type: "定量数据", suggestedDepartment: "人力资源部", responsibleDepartment: "人力资源部", adjustedByUser: false, collectionMethod: "现有Excel", state: "待收集", dueDate: "2026-11-10" },
  { id: "data-project", itemName: "节能改造项目说明", section: "4.2 资源与能源管理", type: "案例", suggestedDepartment: "生产运营部", responsibleDepartment: "生产运营部", adjustedByUser: false, collectionMethod: "在线补充", state: "待确认", dueDate: "2026-11-05" },
  { id: "data-ethics", itemName: "商业道德培训与举报机制", section: "6.2 合规经营", type: "定性说明", suggestedDepartment: "法务合规部", responsibleDepartment: "法务合规部", adjustedByUser: false, collectionMethod: "文件上传", state: "待分工", dueDate: "2026-11-12" },
];

export const aiNormalizationResults: AiNormalizationResult[] = [
  {
    id: "ai-result-energy",
    dataRequirementId: "data-energy",
    label: "示例 AI 规整结果",
    sourceFile: "2025年度能源与排放统计表.xlsx",
    sourceLocator: "能源统计!F12",
    extractedField: "综合用电量",
    extractedValue: "12,680 MWh",
    period: "2025年度",
    state: "待人工确认",
  },
];

export const enterpriseFacts: EnterpriseFact[] = [
  {
    id: "fact-energy-2025",
    name: "综合用电量",
    value: "12,680",
    unit: "MWh",
    period: "2025年度",
    topic: "能源管理",
    state: "待人工确认",
    sourceReferences: [{ id: "ref-1", sourceId: "source-energy-xlsx", fileName: "2025年度能源与排放统计表.xlsx", locator: "能源统计!F12", excerpt: "综合用电量：12,680 MWh" }],
  },
  {
    id: "fact-training-2025",
    name: "员工人均培训时长",
    value: "32.6",
    unit: "小时",
    period: "2025年度",
    topic: "员工发展",
    state: "已确认",
    confirmedBy: "周敏",
    sourceReferences: [
      { id: "ref-2", sourceId: "source-hr-xlsx", fileName: "2025年度员工培训统计.xlsx", locator: "年度汇总!D28", excerpt: "员工人均培训时长 32.6 小时" },
      { id: "ref-3", sourceId: "source-history-2024", fileName: "华澜新材料2024年度ESG报告.pdf", locator: "第 42 页", excerpt: "上年度员工人均培训时长 29.8 小时" },
    ],
  },
];

export const departments = ["安全环保部", "生产运营部", "人力资源部", "法务合规部", "董事会办公室", "财务部"];

export const frameworks = ["上交所指引", "深交所指引", "港交所 ESG 指引", "GRI Standards", "ISSB S1/S2", "CASS-ESG 6.0"];
