import { createReportPages } from "@/lib/presentation/pages";
import type { ReportProjectData } from "@/lib/types/project-data";
import type {
  DisclosureCoverageRecord,
  QualityCategory,
  QualityCheckScope,
  QualityEvidence,
  QualityIssue,
  QualityRuleDefinition,
  QualitySeverity,
} from "@/lib/types/quality";
import type { ContentBlock, WritingChapter } from "@/lib/types/writing";
import { plainText } from "@/lib/writing/document";

export interface QualityCheckOptions {
  scope: QualityCheckScope;
  chapterId?: string;
  runId: string;
  now: string;
}

type Finding = Omit<QualityIssue, "issueId" | "projectId" | "checkRunId" | "createdAt" | "updatedAt" | "resolvedAt" | "resolutionNote" | "exceptionReason" | "status">;

export interface QualityRuleResult {
  findings: Finding[];
  coverage: DisclosureCoverageRecord[];
  rules: QualityRuleDefinition[];
}

const definitions: QualityRuleDefinition[] = [
  { ruleId: "DISC-001", ruleVersion: "1.0.0", category: "disclosure", defaultSeverity: "阻断", description: "适用披露要求必须关联章节和有效正文。", inputDependencies: ["disclosureRequirements", "writing.chapters.blocks.mappings"] },
  { ruleId: "DISC-002", ruleVersion: "1.0.0", category: "disclosure", defaultSeverity: "高", description: "标题映射不能直接视为充分披露。", inputDependencies: ["writing.chapters.blocks"] },
  { ruleId: "DISC-003", ruleVersion: "1.0.0", category: "disclosure", defaultSeverity: "高", description: "披露映射、适用性和标准修订状态必须有效。", inputDependencies: ["disclosureRequirements", "writing.chapters.blocks.mappings"] },
  { ruleId: "SRC-001", ruleVersion: "1.0.0", category: "source", defaultSeverity: "高", description: "事实引用必须存在、已确认且修订一致。", inputDependencies: ["facts", "writing.chapters.blocks.citations"] },
  { ruleId: "SRC-002", ruleVersion: "1.0.0", category: "source", defaultSeverity: "高", description: "事实和正文引用必须保留可定位原始来源。", inputDependencies: ["facts.sourceReferences", "writing.chapters.blocks.sourceReferences"] },
  { ruleId: "SRC-003", ruleVersion: "1.0.0", category: "source", defaultSeverity: "提示", description: "未建立结构化事实引用的数值陈述需要人工核验。", inputDependencies: ["writing.chapters.blocks"] },
  { ruleId: "DATA-001", ruleVersion: "1.0.0", category: "data", defaultSeverity: "高", description: "同口径、同期、同边界指标不得出现冲突。", inputDependencies: ["presentation.observations"] },
  { ruleId: "DATA-002", ruleVersion: "1.0.0", category: "data", defaultSeverity: "高", description: "正文和指标表中的数值必须与引用事实一致。", inputDependencies: ["facts", "writing.chapters.blocks"] },
  { ruleId: "DATA-003", ruleVersion: "1.0.0", category: "data", defaultSeverity: "高", description: "图表必须使用已确认的当前指标快照。", inputDependencies: ["presentation.charts", "presentation.observations"] },
  { ruleId: "WRITE-001", ruleVersion: "1.0.0", category: "writing", defaultSeverity: "提示", description: "按 Writing Policy 识别需证据支持的空泛或绝对化表述。", inputDependencies: ["writing.policy", "writing.chapters.blocks"] },
  { ruleId: "WRITE-002", ruleVersion: "1.0.0", category: "writing", defaultSeverity: "提示", description: "识别跨章节重复表达。", inputDependencies: ["writing.chapters.blocks"] },
  { ruleId: "WRITE-003", ruleVersion: "1.0.0", category: "writing", defaultSeverity: "高", description: "内部待办和未解决占位不得作为正式披露。", inputDependencies: ["writing.chapters.blocks"] },
  { ruleId: "LAYOUT-001", ruleVersion: "1.0.0", category: "layout", defaultSeverity: "高", description: "目录、章节和正文顺序必须一致。", inputDependencies: ["reportSections", "writing.chapters"] },
  { ruleId: "LAYOUT-002", ruleVersion: "1.0.0", category: "layout", defaultSeverity: "高", description: "图表和版面待复核状态必须处理。", inputDependencies: ["presentation.charts", "presentation.layout", "writing.chapters"] },
  { ruleId: "LAYOUT-003", ruleVersion: "1.0.0", category: "layout", defaultSeverity: "高", description: "浏览器预览中不得静默裁切或隐藏内容。", inputDependencies: ["presentation.layout", "writing.chapters.blocks"] },
];

export const qualityRuleDefinitions = definitions;

const definition = (ruleId: string) => definitions.find((item) => item.ruleId === ruleId)!;
const unique = <T,>(values: T[]) => [...new Set(values)];
const normalize = (value: string) => value.replace(/[\s，。；：、,.!?！？;:（）()“”"']/g, "").toLowerCase();
const normalizedNumber = (value: string) => value.replace(/,/g, "").trim();
const blockText = (block: ContentBlock) => `${block.title}\n${plainText(block.html)}\n${block.rows.flat().join(" ")}`.trim();
const chapterName = (project: ReportProjectData, chapterId?: string) => project.writing.chapters.find((item) => item.id === chapterId)?.title ?? "未定位章节";

function hash(value: string) {
  let result = 5381;
  for (let index = 0; index < value.length; index += 1) result = ((result << 5) + result) ^ value.charCodeAt(index);
  return (result >>> 0).toString(36);
}

function makeFinding(input: {
  ruleId: string;
  identity: string;
  title: string;
  description: string;
  sourceStep: 3 | 4 | 5 | 6 | 7;
  severity?: QualitySeverity;
  chapterId?: string;
  blockId?: string;
  requirementIds?: string[];
  factIds?: string[];
  chartIds?: string[];
  sourceReferences?: QualityIssue["sourceReferences"];
  evidence?: QualityEvidence[];
  suggestedAction: string;
}): Finding {
  const rule = definition(input.ruleId);
  const stableKey = `${input.ruleId}:${input.identity}`;
  const evidence = input.evidence ?? [];
  return {
    stableKey,
    ruleId: input.ruleId,
    ruleVersion: rule.ruleVersion,
    category: rule.category,
    severity: input.severity ?? rule.defaultSeverity,
    title: input.title,
    description: input.description,
    sourceStep: input.sourceStep,
    chapterId: input.chapterId,
    blockId: input.blockId,
    requirementIds: unique(input.requirementIds ?? []),
    factIds: unique(input.factIds ?? []),
    chartIds: unique(input.chartIds ?? []),
    sourceReferences: [...new Map((input.sourceReferences ?? []).map((item) => [item.id, item])).values()],
    evidence,
    suggestedAction: input.suggestedAction,
    findingMethod: "规则检查",
    inputFingerprint: hash(JSON.stringify({ evidence, description: input.description })),
  };
}

function validContentBlock(project: ReportProjectData, block: ContentBlock) {
  if (["heading", "todo"].includes(block.kind)) return false;
  if (block.kind === "chart") return project.presentation.charts.some((chart) => chart.blockId === block.id && chart.status === "已确认");
  if (block.kind === "table") return block.rows.slice(1).some((row) => row.some((cell) => cell.trim()));
  const text = plainText(block.html).replace(/【待[^】]*】/g, "").trim();
  return text.length >= 12;
}

function disclosureRules(project: ReportProjectData, now: string) {
  const findings: Finding[] = [];
  const coverage: DisclosureCoverageRecord[] = [];
  const allBlocks = project.writing.chapters.flatMap((chapter) => chapter.blocks.map((block) => ({ chapter, block })));

  for (const requirement of project.disclosureRequirements) {
    const mapped = allBlocks.filter(({ block }) => block.mappings.some((mapping) => mapping.requirementId === requirement.id));
    if (requirement.applicability !== "适用" || !requirement.userConfirmed) {
      if (!requirement.userConfirmed || requirement.reviewStatus !== "有效") {
        findings.push(makeFinding({
          ruleId: "DISC-003", identity: requirement.id, title: `${requirement.code} 适用性结论待重新确认`,
          description: "平台不会自动判断披露义务。当前适用性或标准版本状态尚未由用户有效确认。", sourceStep: 3,
          requirementIds: [requirement.id], severity: "高",
          evidence: [{ label: "适用性", value: requirement.applicability, entityType: "requirement", entityId: requirement.id }, { label: "确认状态", value: requirement.userConfirmed ? requirement.reviewStatus : "未确认" }],
          suggestedAction: "返回 Step 3 核对标准版本、适用性和必要说明，并由用户确认。",
        }));
      }
      continue;
    }
    const effective = mapped.filter(({ block }) => validContentBlock(project, block));
    const mappedChapterIds = unique(mapped.map(({ chapter }) => chapter.id));
    const mappedBlockIds = mapped.map(({ block }) => block.id);
    const mappedOnlyHeading = mapped.length > 0 && mapped.every(({ block }) => block.kind === "heading");
    const pending = effective.some(({ block }) => Boolean(block.pendingKind && !block.resolved) || block.reviewStatus === "待复核");
    const partial = effective.some(({ block }) => block.mappings.find((item) => item.requirementId === requirement.id)?.coverage === "部分覆盖");
    const verified = effective.length > 0 && effective.every(({ block }) => block.reviewStatus === "已审校" && block.mappings.find((item) => item.requirementId === requirement.id)?.coverage === "已覆盖");
    const status: DisclosureCoverageRecord["status"] = !effective.length ? "未覆盖" : partial || pending ? "部分覆盖" : verified ? "已核验覆盖" : "待核验";
    coverage.push({
      requirementId: requirement.id,
      status,
      reason: !mapped.length ? "没有正文映射" : mappedOnlyHeading ? "仅关联标题" : pending ? "关联内容仍有待处理或待复核状态" : partial ? "正文映射标记为部分覆盖" : verified ? "正文映射与人工审校状态均已确认" : "存在正文，但充分性仍需人工核验",
      chapterIds: mappedChapterIds,
      blockIds: mappedBlockIds,
      assessedAt: now,
      method: "规则检查",
    });
    if (!mapped.length) {
      findings.push(makeFinding({
        ruleId: "DISC-001", identity: requirement.id, title: `${requirement.code} 尚未关联正文`,
        description: `已确认适用的披露要求“${requirement.summary}”没有关联任何正文内容块。`, sourceStep: 3, severity: "阻断",
        requirementIds: [requirement.id], evidence: [{ label: "预期章节", value: requirement.mappedSection, entityType: "requirement", entityId: requirement.id }],
        suggestedAction: "在 Step 3 核对章节映射，并在 Step 5 将有效正文块关联到该披露要求。",
      }));
    } else if (!effective.length) {
      findings.push(makeFinding({
        ruleId: "DISC-002", identity: requirement.id, title: `${requirement.code} 仅有关联标题或无有效内容`,
        description: "存在技术映射，但没有可作为披露内容的正文、表格、案例或已确认图表；不能据此判定为充分披露。", sourceStep: 5, severity: "高",
        chapterId: mapped[0]?.chapter.id, blockId: mapped[0]?.block.id, requirementIds: [requirement.id],
        evidence: mapped.slice(0, 4).map(({ block }) => ({ label: "映射内容块", value: `${block.title}（${block.kind}）`, entityType: "block", entityId: block.id })),
        suggestedAction: "返回 Step 5 补充有来源的有效内容，并由用户核验披露充分性。",
      }));
    } else if (pending || partial || !verified) {
      findings.push(makeFinding({
        ruleId: "DISC-003", identity: `${requirement.id}:coverage`, title: `${requirement.code} 覆盖结论仍需人工核验`,
        description: "规则引擎只能确认正文和状态是否存在，不能替用户判断披露是否充分。当前映射包含部分覆盖、待处理或尚未审校内容。", sourceStep: 5,
        severity: partial || pending ? "高" : "提示", chapterId: effective[0]?.chapter.id, blockId: effective[0]?.block.id, requirementIds: [requirement.id],
        evidence: [{ label: "规则覆盖状态", value: status, entityType: "requirement", entityId: requirement.id }],
        suggestedAction: "核对披露要素、事实来源和正文表述后，由用户确认覆盖结论。",
      }));
    }
  }

  for (const { chapter, block } of allBlocks) {
    for (const mapping of block.mappings) {
      const requirement = project.disclosureRequirements.find((item) => item.id === mapping.requirementId);
      if (requirement && requirement.applicability === "适用") continue;
      findings.push(makeFinding({
        ruleId: "DISC-003", identity: `orphan:${block.id}:${mapping.requirementId}`, title: "正文存在失效或孤立的披露映射",
        description: requirement ? "正文仍关联到当前未确认适用的披露要求。" : "正文关联的披露要求已经不存在。", sourceStep: 5,
        chapterId: chapter.id, blockId: block.id, requirementIds: [mapping.requirementId], severity: "高",
        evidence: [{ label: "内容块", value: block.title, entityType: "block", entityId: block.id }],
        suggestedAction: "核对 Step 3 适用性决定；保留正文的同时修复或解除失效映射。",
      }));
    }
  }
  return { findings, coverage };
}

function sentenceWithTerm(text: string, term: string) {
  return text.split(/(?<=[。！？!?；;])/).find((sentence) => sentence.includes(term))?.trim() ?? text.slice(0, 140);
}

function sourceRules(project: ReportProjectData) {
  const findings: Finding[] = [];
  for (const chapter of project.writing.chapters) {
    for (const block of chapter.blocks) {
      for (const citation of block.citations) {
        const fact = project.facts.find((item) => item.id === citation.factId);
        if (!fact) {
          findings.push(makeFinding({ ruleId: "SRC-001", identity: `${block.id}:${citation.factId}:missing`, title: "正文引用的企业事实已不存在", description: "内容块保留了事实 ID，但统一事实库中找不到对应对象。", sourceStep: 4, severity: "阻断", chapterId: chapter.id, blockId: block.id, factIds: [citation.factId], evidence: [{ label: "内容块", value: block.title, entityType: "block", entityId: block.id }], suggestedAction: "返回 Step 4 恢复或替换事实，并在 Step 5 重新确认引用。" }));
          continue;
        }
        if (fact.state !== "已确认" || fact.sourceState === "upstream-removed") {
          findings.push(makeFinding({ ruleId: "SRC-001", identity: `${block.id}:${fact.id}:confirmation`, title: `引用事实“${fact.name}”未处于已确认状态`, description: "未确认或已由上游撤销的事实不能直接作为正式披露依据。", sourceStep: 4, chapterId: chapter.id, blockId: block.id, factIds: [fact.id], sourceReferences: fact.sourceReferences, evidence: [{ label: "事实状态", value: fact.sourceState === "upstream-removed" ? "上游已移除" : fact.state, entityType: "fact", entityId: fact.id }], suggestedAction: "返回 Step 4 核对事实、统计口径与来源，由用户重新确认。" }));
        }
        if (citation.factRevision !== fact.revision) {
          findings.push(makeFinding({ ruleId: "SRC-001", identity: `${block.id}:${fact.id}:revision`, title: `“${fact.name}”引用版本已过期`, description: `正文引用 v${citation.factRevision}，事实库当前为 v${fact.revision}；正文没有被自动覆盖。`, sourceStep: 5, chapterId: chapter.id, blockId: block.id, factIds: [fact.id], sourceReferences: fact.sourceReferences, evidence: [{ label: "引用版本", value: `v${citation.factRevision}`, entityType: "block", entityId: block.id }, { label: "当前事实版本", value: `v${fact.revision}`, entityType: "fact", entityId: fact.id }], suggestedAction: "核对变更内容后，在 Step 5 更新正文引用并提交复检。" }));
        }
        if (!fact.sourceReferences.length || fact.sourceReferences.some((source) => !source.fileName.trim() || !source.locator.trim())) {
          findings.push(makeFinding({ ruleId: "SRC-002", identity: fact.id, title: `事实“${fact.name}”缺少可定位来源`, description: "来源文件及工作表、页码或位置必须保留；仅有事实值不足以证明来源。", sourceStep: 4, chapterId: chapter.id, blockId: block.id, factIds: [fact.id], sourceReferences: fact.sourceReferences, evidence: [{ label: "来源数量", value: String(fact.sourceReferences.length), entityType: "fact", entityId: fact.id }], suggestedAction: "在 Step 4 补充来源文件和具体定位，并由用户确认。" }));
        }
        const periods = unique(blockText(block).match(/20\d{2}(?:年度|年)/g) ?? []);
        if (periods.length && !periods.some((period) => fact.period.includes(period.slice(0, 4)))) {
          findings.push(makeFinding({ ruleId: "SRC-001", identity: `${block.id}:${fact.id}:period`, title: `正文期间与“${fact.name}”事实期间不一致`, description: "正文出现的年度与引用事实报告期不一致，需要人工核对历史事实和当年事实。", sourceStep: 5, chapterId: chapter.id, blockId: block.id, factIds: [fact.id], sourceReferences: fact.sourceReferences, evidence: [{ label: "正文期间", value: periods.join("、") }, { label: "事实期间", value: fact.period, entityType: "fact", entityId: fact.id }], suggestedAction: "确认正文描述的时间属性，必要时改用正确期间的事实。" }));
        }
      }
      if (["paragraph", "table", "case"].includes(block.kind) && /\d/.test(blockText(block)) && !block.citations.length) {
        findings.push(makeFinding({ ruleId: "SRC-003", identity: block.id, title: `“${block.title}”含数值但没有结构化事实引用`, description: "规则引擎无法据此认定数值真实可靠，也不会虚构数据匹配结果。", sourceStep: 5, severity: "提示", chapterId: chapter.id, blockId: block.id, sourceReferences: block.sourceReferences, evidence: [{ label: "内容摘录", value: blockText(block).slice(0, 160), entityType: "block", entityId: block.id }], suggestedAction: "在 Step 5 关联已有事实；若暂不能结构化，请保留待核验状态并人工审阅。" }));
      }
    }
  }
  return findings;
}

function comparableKey(item: { metricDefinitionId: string; unit: string; reportingPeriod: string; reportingBoundary: string }) {
  return [item.metricDefinitionId, item.unit.trim(), item.reportingPeriod.trim(), item.reportingBoundary.trim()].join("\u0000");
}

function textContainsValue(text: string, value: string) {
  const target = normalizedNumber(value);
  if (!target || !/^-?\d+(\.\d+)?$/.test(target)) return true;
  const normalized = text.replace(/,/g, "");
  return new RegExp(`(^|[^\\d.])${target.replace(".", "\\.")}([^\\d.]|$)`).test(normalized);
}

function dataRules(project: ReportProjectData) {
  const findings: Finding[] = [];
  const observations = project.presentation.observations.filter((item) => item.sampleKind === "项目事实" && item.confirmationStatus === "已确认" && item.boundaryStatus === "已核验" && item.reportingBoundary.trim());
  const groups = new Map<string, typeof observations>();
  observations.forEach((item) => groups.set(comparableKey(item), [...(groups.get(comparableKey(item)) ?? []), item]));
  for (const items of groups.values()) {
    const values = unique(items.map((item) => item.value));
    if (items.length < 2 || values.length < 2) continue;
    findings.push(makeFinding({ ruleId: "DATA-001", identity: comparableKey(items[0]), title: `同口径指标“${items[0].metricName}”存在数值冲突`, description: "仅在指标定义、单位、报告期和已核验统计边界均一致时执行了自动冲突判断。", sourceStep: 4, severity: "高", factIds: items.map((item) => item.metricId), sourceReferences: items.flatMap((item) => item.sourceReferences), evidence: items.map((item) => ({ label: item.observationId, value: `${item.value} ${item.unit} · ${item.reportingPeriod} · ${item.reportingBoundary}`, entityType: "observation", entityId: item.observationId })), suggestedAction: "返回 Step 4 核对重复指标记录、来源及修订版本；不同口径数据请明确区分指标定义。" }));
  }

  for (const chapter of project.writing.chapters) {
    for (const block of chapter.blocks) {
      for (const citation of block.citations) {
        const fact = project.facts.find((item) => item.id === citation.factId);
        if (!fact || !fact.metricDefinitionId || fact.state !== "已确认") continue;
        const text = blockText(block);
        if (/\d/.test(text) && !textContainsValue(text, fact.value)) {
          findings.push(makeFinding({ ruleId: "DATA-002", identity: `${block.id}:${fact.id}`, title: `正文数值与已引用指标“${fact.name}”不一致`, description: "正文或表格中没有找到当前事实值。该判断只针对已经建立指标级事实引用的内容块。", sourceStep: 5, chapterId: chapter.id, blockId: block.id, factIds: [fact.id], sourceReferences: fact.sourceReferences, evidence: [{ label: "正文/表格", value: text.slice(0, 180), entityType: "block", entityId: block.id }, { label: "已确认指标", value: `${fact.value} ${fact.unit ?? ""} · ${fact.period} · ${fact.reportingBoundary ?? "边界待核验"}`, entityType: "fact", entityId: fact.id }], suggestedAction: "核对正文、表格和指标来源；不得在未确认口径的情况下直接修改统计值。" }));
        }
      }
      if (block.kind === "table" && /\d/.test(block.rows.flat().join(" ")) && !block.citations.length) {
        findings.push(makeFinding({ ruleId: "DATA-002", identity: `unlinked-table:${block.id}`, title: `指标表“${block.title}”无法自动核验`, description: "表格单元格尚未建立指标级关联，规则引擎不会虚构与指标库的匹配结果。", sourceStep: 5, severity: "提示", chapterId: chapter.id, blockId: block.id, evidence: [{ label: "表格状态", value: "未建立指标级引用", entityType: "block", entityId: block.id }], suggestedAction: "后续为表格单元格建立指标引用；本轮由用户核对并保留人工确认记录。" }));
      }
    }
  }

  for (const chart of project.presentation.charts) {
    const live = chart.metricObservationIds.flatMap((id) => project.presentation.observations.find((item) => item.observationId === id) ?? []);
    const changed = chart.observationSnapshots.some((snapshot) => {
      const current = live.find((item) => item.observationId === snapshot.observationId);
      return !current || current.value !== snapshot.value || current.unit !== snapshot.unit || current.reportingPeriod !== snapshot.reportingPeriod || current.reportingBoundary !== snapshot.reportingBoundary || current.sourceConfirmationStatus !== snapshot.sourceConfirmationStatus || current.revision !== snapshot.revision;
    });
    if (chart.status === "需更新" || changed) {
      findings.push(makeFinding({ ruleId: "DATA-003", identity: `${chart.chartId}:stale`, title: `图表“${chart.title}”使用旧版或已变化指标`, description: chart.changeNote ?? "图表旧快照与当前指标数值、单位、期间、边界、来源状态或修订版本不一致。旧配置已保留，等待用户确认更新。", sourceStep: 6, chapterId: chart.chapterId, blockId: chart.blockId, chartIds: [chart.chartId], sourceReferences: chart.observationSnapshots.flatMap((item) => item.sourceReferences), evidence: [{ label: "图表状态", value: chart.status, entityType: "chart", entityId: chart.chartId }, { label: "快照数", value: String(chart.observationSnapshots.length) }, { label: "当前指标数", value: String(live.length) }], suggestedAction: "进入 Step 6 查看变动说明和原始来源，确认后更新图表并复核版面。" }));
    } else if (chart.status !== "已确认") {
      findings.push(makeFinding({ ruleId: "DATA-003", identity: `${chart.chartId}:unconfirmed`, title: `图表“${chart.title}”尚未确认`, description: "待配置或待确认图表不能作为正式披露成果。", sourceStep: 6, severity: "高", chapterId: chart.chapterId, blockId: chart.blockId, chartIds: [chart.chartId], evidence: [{ label: "图表状态", value: chart.status, entityType: "chart", entityId: chart.chartId }], suggestedAction: "在 Step 6 选择符合单位、期间、边界和来源要求的指标，并由用户确认图表。" }));
    }
    if (chart.status === "已确认" && live.some((item) => item.confirmationStatus !== "已确认" || item.sourceConfirmationStatus !== "已确认")) {
      findings.push(makeFinding({ ruleId: "DATA-003", identity: `${chart.chartId}:source-confirmation`, title: `图表“${chart.title}”包含未经确认的指标`, description: "指标或来源确认状态变化后，图表不能继续作为已确认成果。", sourceStep: 6, severity: "阻断", chapterId: chart.chapterId, blockId: chart.blockId, chartIds: [chart.chartId], sourceReferences: live.flatMap((item) => item.sourceReferences), evidence: live.map((item) => ({ label: item.metricName, value: `${item.confirmationStatus} / 来源${item.sourceConfirmationStatus}`, entityType: "observation", entityId: item.observationId })), suggestedAction: "返回 Step 4 确认指标与来源，再在 Step 6 更新图表。" }));
    }
  }
  return findings;
}

function writingRules(project: ReportProjectData) {
  const findings: Finding[] = [];
  const vagueRuleEnabled = project.writing.policy.rules.some((item) => item.id === "vague" && item.enabled);
  const terms = unique([...project.writing.policy.vagueTerms, "行业领先", "绝对领先", "零风险"]);
  const sentenceOwners = new Map<string, Array<{ chapter: WritingChapter; block: ContentBlock; sentence: string }>>();
  for (const chapter of project.writing.chapters) {
    for (const block of chapter.blocks) {
      const text = blockText(block);
      if (vagueRuleEnabled) {
        for (const term of terms.filter((candidate) => candidate.trim() && text.includes(candidate))) {
          const sentence = sentenceWithTerm(text, term);
          const unsupported = !block.citations.length && !block.sourceReferences.length;
          findings.push(makeFinding({ ruleId: "WRITE-001", identity: `${block.id}:${term}`, title: `“${term}”需要说明具体依据`, description: unsupported ? "该表述所在内容块没有结构化事实或来源支持，可能属于空泛、绝对化或无依据的绩效评价。" : "该表述已有来源关联，但仍需人工判断证据是否足以支持评价性结论；规则命中不等同于表述错误。", sourceStep: 5, severity: unsupported && ["显著提升", "行业领先", "绝对领先", "零风险"].includes(term) ? "高" : "提示", chapterId: chapter.id, blockId: block.id, factIds: block.citations.map((item) => item.factId), sourceReferences: block.sourceReferences, evidence: [{ label: "问题句子", value: sentence, entityType: "block", entityId: block.id }, { label: "现有证据", value: block.citations.length || block.sourceReferences.length ? "有关联，充分性待人工核验" : "未关联结构化证据", entityType: "policy", entityId: project.writing.policy.id }], suggestedAction: "改为有来源的具体行动、范围、时间和结果；证据不足时删除评价性措辞。" }));
        }
      }
      if ((block.kind === "todo" || (block.pendingKind && !block.resolved)) && block.kind !== "heading") {
        findings.push(makeFinding({ ruleId: "WRITE-003", identity: block.id, title: `内部事项“${block.title}”尚未解决`, description: `内容块仍处于${block.pendingKind ?? "内部待办"}状态；正式阅读必须排除该内容，且定稿前需要处理。`, sourceStep: 5, chapterId: chapter.id, blockId: block.id, requirementIds: block.mappings.map((item) => item.requirementId), factIds: block.citations.map((item) => item.factId), sourceReferences: block.sourceReferences, evidence: [{ label: "内部状态", value: block.pendingKind ?? "待办", entityType: "block", entityId: block.id }], suggestedAction: "返回 Step 5 补充、确认或更新内容；不得将内部占位作为正式披露。" }));
      }
      for (const sentence of plainText(block.html).split(/(?<=[。！？!?；;])/).map((item) => item.trim()).filter((item) => item.length >= 28)) {
        const key = normalize(sentence);
        if (!key) continue;
        sentenceOwners.set(key, [...(sentenceOwners.get(key) ?? []), { chapter, block, sentence }]);
      }
    }
  }
  for (const owners of sentenceOwners.values()) {
    if (new Set(owners.map((item) => item.chapter.id)).size < 2) continue;
    findings.push(makeFinding({ ruleId: "WRITE-002", identity: hash(owners[0].sentence), title: "发现跨章节重复表达", description: "多个章节出现相同长句。重复不一定错误，但可能降低信息密度。", sourceStep: 5, severity: "提示", chapterId: owners[0].chapter.id, blockId: owners[0].block.id, evidence: owners.map((item) => ({ label: chapterName(project, item.chapter.id), value: item.sentence.slice(0, 140), entityType: "block", entityId: item.block.id })), suggestedAction: "人工确认是否需要保留；若语义相同，合并或改为交叉引用。" }));
  }
  return findings;
}

function layoutRules(project: ReportProjectData) {
  const findings: Finding[] = [];
  const activeSections = project.reportSections.filter((item) => item.sourceState !== "upstream-removed");
  const activeChapters = project.writing.chapters.filter((item) => item.sourceState !== "upstream-removed");
  for (const section of activeSections) {
    if (activeChapters.some((chapter) => chapter.id === section.id)) continue;
    findings.push(makeFinding({ ruleId: "LAYOUT-001", identity: `missing:${section.id}`, title: `目录章节“${section.title}”没有报告正文节点`, description: "Step 3 目录存在，但 Step 5/6 没有对应章节。", sourceStep: 3, severity: "阻断", chapterId: section.id, evidence: [{ label: "Step 3 章节", value: `${section.order} ${section.title}`, entityType: "chapter", entityId: section.id }], suggestedAction: "返回 Step 3 保存目录同步，保留已有正文后重新检查。" }));
  }
  const expectedOrder = activeSections.map((item) => item.id).join("|");
  const actualOrder = [...activeChapters].sort((left, right) => left.order.localeCompare(right.order, "zh-CN", { numeric: true })).map((item) => item.id).join("|");
  if (expectedOrder !== actualOrder) {
    findings.push(makeFinding({ ruleId: "LAYOUT-001", identity: "chapter-order", title: "Step 3 目录与报告章节顺序不一致", description: "浏览器预览应按 Step 3/5 章节顺序生成，当前顺序需要核对。", sourceStep: 6, severity: "高", evidence: [{ label: "Step 3 顺序", value: activeSections.map((item) => item.title).join(" → ") }, { label: "Step 5/6 顺序", value: activeChapters.map((item) => item.title).join(" → ") }], suggestedAction: "返回 Step 3 调整目录并保存；Step 5 正文不会被自动删除。" }));
  }
  for (const chart of project.presentation.charts.filter((item) => item.layoutReviewStatus === "待复核")) {
    findings.push(makeFinding({ ruleId: "LAYOUT-002", identity: chart.chartId, title: `图表“${chart.title}”版面待复核`, description: chart.changeNote ?? "图表配置或关联数据变化后，相关页面需要复核。", sourceStep: 6, severity: chart.status === "已确认" ? "提示" : "高", chapterId: chart.chapterId, blockId: chart.blockId, chartIds: [chart.chartId], evidence: [{ label: "图表状态", value: `${chart.status} / 版面${chart.layoutReviewStatus}`, entityType: "chart", entityId: chart.chartId }], suggestedAction: "进入 Step 6 核对图表数据、尺寸和页面位置。" }));
  }
  for (const page of createReportPages(project)) {
    for (const message of page.issues.filter((item) => item.includes("超过当前页面容量"))) {
      const blockId = message.match(/（(block-[^)]+|section-[^)]+)）/)?.[1];
      findings.push(makeFinding({ ruleId: "LAYOUT-003", identity: `${page.id}:${blockId ?? hash(message)}`, title: `预览页面“${page.title}”存在内容溢出风险`, description: message, sourceStep: 6, severity: "高", chapterId: page.chapterId, blockId, evidence: [{ label: "浏览器预览页面", value: page.id, entityType: "page", entityId: page.id }, { label: "检测结果", value: message }], suggestedAction: "在 Step 6 调整字号、行距、边距或拆分内容；不得通过 overflow 隐藏正文。" }));
    }
  }
  return findings;
}

function inScope(finding: Finding, project: ReportProjectData, options: QualityCheckOptions) {
  if (options.scope === "full") return true;
  if (options.scope === "chapter") return Boolean(options.chapterId && finding.chapterId === options.chapterId);
  const pending = project.quality.issues.filter((issue) => issue.status === "待复检");
  if (!pending.length) return false;
  return pending.some((issue) => issue.stableKey === finding.stableKey
    || Boolean(finding.blockId && finding.blockId === issue.blockId)
    || Boolean(finding.chapterId && finding.chapterId === issue.chapterId)
    || finding.requirementIds.some((id) => issue.requirementIds.includes(id))
    || finding.factIds.some((id) => issue.factIds.includes(id))
    || finding.chartIds.some((id) => issue.chartIds.includes(id)));
}

export function runQualityRules(project: ReportProjectData, options: QualityCheckOptions): QualityRuleResult {
  const disclosure = disclosureRules(project, options.now);
  const all = [
    ...disclosure.findings,
    ...sourceRules(project),
    ...dataRules(project),
    ...writingRules(project),
    ...layoutRules(project),
  ];
  return {
    findings: all.filter((finding) => inScope(finding, project, options)),
    coverage: options.scope === "full" ? disclosure.coverage : project.quality.coverage,
    rules: definitions,
  };
}

export function qualityCategoryLabel(category: QualityCategory) {
  return ({ disclosure: "披露完整性", source: "事实与来源", data: "数据一致性", writing: "文字与 Writing Policy", layout: "版式与结构" } satisfies Record<QualityCategory, string>)[category];
}
