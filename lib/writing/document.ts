import { dataRequirements, disclosureRequirements, enterpriseFacts, historicalReports, reportProject, reportSections } from '@/lib/data/mock-data';
import type { SourceReference } from '@/lib/types/esg';
import type { BlockKind, ContentBlock, WritingChapter, WritingDocument, WritingPolicy, WritingResource } from '@/lib/types/writing';

const seedTimestamp = '2026-10-26T08:00:00.000Z';
const allowedTags = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote']);

/** Formatting only. Links retain a validated href; images, styles, event handlers and executable content never survive. */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|svg|math|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<[^>]*>/g, (tag) => {
      const match = tag.match(/^<\s*(\/?)\s*([a-z0-9]+)/i);
      if (!match || !allowedTags.has(match[2].toLowerCase())) return '';
      const name = match[2].toLowerCase();
      if (name === 'a') {
        if (match[1]) return '</a>';
        const href = tag.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)?.slice(1).find(Boolean)?.trim() ?? '';
        if (!/^(?:https?:\/\/|mailto:|#)/i.test(href)) return '<a>';
        const safeHref = href.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<a href="${safeHref}" rel="noopener noreferrer">`;
      }
      return name === 'br' ? '<br>' : `<${match[1] ? '/' : ''}${name}>`;
    })
    .replace(/<a><\/a>/gi, '')
    .replace(/<(?!\/?(?:p|br|strong|b|em|i|u|s|a|ul|ol|li|h2|h3|blockquote)\b)/gi, '&lt;');
}

export function plainText(html: string): string {
  return sanitizeHtml(html)
    .replace(/<br\s*\/?\s*>|<\/(?:p|h2|h3|li|blockquote)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, value: string) => {
      const code = Number(value);
      return code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&amp;/gi, '&').trim();
}

const labels: Record<BlockKind, string> = {
  heading: '章节小标题', paragraph: '正文段落', table: 'ESG 指标表',
  case: '案例与制度', chart: '图表占位', todo: '待处理事项',
};

export function createBlock(chapterId: string, kind: BlockKind): ContentBlock {
  return {
    id: `block-${globalThis.crypto.randomUUID()}`, chapterId, kind,
    title: labels[kind], html: kind === 'todo' ? '<p>请补充事项说明及责任人。</p>' : '<p></p>',
    rows: kind === 'table' ? [['指标', '报告期', '数值', '单位'], ['', '2025年度', '', '']] : [],
    mappings: [], citations: [], sourceReferences: [], revision: 1,
    updatedAt: new Date().toISOString(), reviewStatus: '未审校',
    ...(kind === 'todo' ? { pendingKind: '待补充' as const, resolved: false } : {}),
  };
}

function seedBlock(chapterId: string, kind: BlockKind, suffix: string, overrides: Partial<ContentBlock> = {}): ContentBlock {
  return {
    id: `${chapterId}-${suffix}`, chapterId, kind, title: labels[kind], html: '<p></p>',
    rows: [], mappings: [], citations: [], sourceReferences: [], revision: 1,
    updatedAt: seedTimestamp, reviewStatus: '未审校', ...overrides,
  };
}

export function createWritingDocument(): WritingDocument {
  const facts = enterpriseFacts.map((fact) => ({ ...structuredClone(fact), revision: 1, temporalType: '当年事实' as const }));
  const energy = facts.find((fact) => fact.id === 'fact-energy-2025')!;
  const training = facts.find((fact) => fact.id === 'fact-training-2025')!;
  const chapters: WritingChapter[] = reportSections.map((section) => ({
    id: section.id, title: section.title, order: section.order,
    ...(section.level === 2 ? { parentId: 'section-4' } : {}),
    status: section.id === 'section-4-2' || section.id === 'section-5' ? '待完善' : '未开始',
    reviewStatus: '未审校', revision: 1,
    blocks: [seedBlock(section.id, 'heading', 'heading', { title: section.title, html: `<h2>${section.title}</h2>`,
      mappings: disclosureRequirements.filter((req) => section.topics.includes(req.topic)).map((req) => ({ requirementId: req.id, coverage: '待核验' })) })],
  }));
  const chapter = chapters.find((item) => item.id === 'section-4-2')!;
  const mapping = [{ requirementId: 'req-gri-302-1', coverage: '部分覆盖' as const }];
  chapter.blocks.push(
    seedBlock(chapter.id, 'paragraph', 'paragraph', {
      title: '能源管理与统计口径',
      html: '<p>本节用于说明报告期内的能源管理制度、消耗统计口径及相关措施。<strong>能源数据尚待责任部门人工确认</strong>，确认后再作为正式披露依据。</p><p>编辑示例：企业高度重视能源管理。请将空泛表述替换为有来源的具体制度或行动。</p>',
      mappings: structuredClone(mapping), pendingKind: '待确认',
    }),
    seedBlock(chapter.id, 'table', 'table', {
      title: '能源绩效指标 · 待确认草稿',
      rows: [['指标', '报告期', '数值', '单位', '确认状态'], ['综合用电量', energy.period, energy.value, energy.unit ?? '', energy.state]],
      citations: [{ factId: energy.id, factRevision: energy.revision }],
      sourceReferences: structuredClone(energy.sourceReferences), mappings: structuredClone(mapping),
      reviewStatus: '待复核', pendingKind: '待确认',
    }),
    seedBlock(chapter.id, 'case', 'case', {
      title: '节能改造项目说明',
      html: '<p>【待补充】请引用已确认的项目背景、实施范围和证据。当前仅保留 Step 4 的资料任务，不预设项目成效或节能量。</p>',
      mappings: structuredClone(mapping), pendingKind: '待补充',
    }),
    seedBlock(chapter.id, 'chart', 'chart', {
      title: '能源消耗趋势图', html: '<p>图表占位：待确认各期可比数据与统计口径后，在 Step 6 配置图表。</p>',
      mappings: structuredClone(mapping), pendingKind: '待补充',
    }),
    seedBlock(chapter.id, 'todo', 'todo', {
      title: '确认能源数据边界', html: '<p>请安全环保部复核原始 Excel 中的统计范围、计量单位及报告期，并确认综合用电量。</p>',
      pendingKind: '待确认', resolved: false, mappings: structuredClone(mapping),
      sourceReferences: structuredClone(energy.sourceReferences),
    }),
  );
  const social = chapters.find((item) => item.id === 'section-5')!;
  social.blocks.push(seedBlock(social.id, 'paragraph', 'training', {
    title: '员工培训', html: `<p>${training.period}，${training.name}为 ${training.value} ${training.unit}。该数值来自已确认的示例事实，历史资料仅用于比对，不混同为本期数据。</p>`,
    citations: [{ factId: training.id, factRevision: training.revision }],
    sourceReferences: structuredClone(training.sourceReferences),
  }));

  return {
    schemaVersion: 1, projectId: reportProject.id, chapters, facts,
    resources: createWritingResources(), versions: [],
    policy: {
      id: 'policy-esg-default', tone: '专业客观', terminology: '统一使用“华澜新材料”“报告期”“综合用电量”；保留来源中的指标名称、单位及统计口径。',
      vagueTerms: ['高度重视', '显著提升', '全面领先', '成效显著', '持续赋能'],
      rules: [
        { id: 'objective', label: '专业、客观、简洁', enabled: true },
        { id: 'terms', label: '企业术语一致', enabled: true },
        { id: 'sources', label: '事实必须有来源', enabled: true },
        { id: 'numbers', label: '数值和统计口径不得随意修改', enabled: true },
        { id: 'temporal', label: '区分历史事实、当年事实及未来计划', enabled: true },
        { id: 'vague', label: '控制空泛表述', enabled: true },
        { id: 'repetition', label: '减少内容重复', enabled: true },
        { id: 'evidence', label: '禁止新增无依据的绩效、承诺或荣誉', enabled: true },
      ],
    },
  };
}

function createWritingResources(): WritingResource[] {
  return [
  ...dataRequirements.filter((item) => item.type === '案例' || item.id === 'data-ethics').map((item): WritingResource => ({
    id: `resource-${item.id}`, chapterIds: [item.id === 'data-project' ? 'section-4-2' : 'section-6'],
    kind: item.type === '案例' ? '案例' : '制度', title: item.itemName,
    description: `资料任务 ${item.id} · ${item.responsibleDepartment} · ${item.state}。原始内容尚待提交/确认，不能据此编写成果。`,
    confirmed: false, sourceReferences: [], revision: 1,
  })),
  ...historicalReports.map((file): WritingResource => ({
    id: `resource-${file.id}`, chapterIds: reportSections.map((section) => section.id), kind: '历史资料',
    title: file.name, description: '历史报告用于编制口径与往年披露比对；不作为当年绩效。第 42 页为已有示例来源定位。',
    confirmed: false, revision: 1,
    sourceReferences: [{ id: `resource-history-ref-${file.id}`, sourceId: file.id, fileName: file.name, locator: '第 42 页', excerpt: '上年度员工人均培训时长 29.8 小时（历史示例事实）' }],
  })),
  ];
}

export function getChapterResources(resources: WritingResource[], chapterId: string): WritingResource[] {
  return resources.filter((item) => item.chapterIds.includes(chapterId));
}

export function scanWriting(chapter: WritingChapter, policy: WritingPolicy): { blockId: string; term: string; suggestion: string }[] {
  if (!policy.rules.some((rule) => rule.id === 'vague' && rule.enabled)) return [];
  return chapter.blocks.flatMap((block) => {
    const text = `${block.title}\n${plainText(block.html)}\n${block.rows.flat().join(' ')}`;
    return policy.vagueTerms.filter((term) => term.trim() && text.includes(term.trim())).map((term) => ({
      blockId: block.id, term, suggestion: `请复核“${term}”：改为有来源的具体行动、范围与时间；若无依据，请删除该表述。`,
    }));
  });
}

/** Citation snapshots intentionally keep their old revision until the user reconfirms. */
export function reconcileCitations(doc: WritingDocument): WritingDocument {
  return {
    ...doc,
    chapters: doc.chapters.map((chapter) => {
      let stale = false;
      const blocks = chapter.blocks.map((block) => {
        const invalid = block.citations.some((citation) => {
          const fact = doc.facts.find((item) => item.id === citation.factId);
          return !fact || fact.state !== '已确认' || fact.revision !== citation.factRevision;
        });
        if (!invalid) return block;
        stale = true;
        return { ...block, reviewStatus: '待复核' as const, pendingKind: '待更新' as const, mappings: block.mappings.map((mapping) => ({ ...mapping, coverage: '待核验' as const })) };
      });
      return stale ? { ...chapter, blocks, status: '待完善', reviewStatus: '待复核' } : { ...chapter, blocks };
    }),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isString = (value: unknown): value is string => typeof value === 'string';
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);
const isRevision = (value: unknown) => Number.isInteger(value) && Number(value) >= 1;
const reviewStates = ['未审校', '待审校', '已审校', '待复核'];
const chapterStates = ['未开始', '撰写中', '待完善', '待审校', '已审校'];
const pendingStates = ['待补充', '待确认', '待更新'];

function isSource(value: unknown): value is SourceReference {
  return isRecord(value) && ['id', 'sourceId', 'fileName', 'locator', 'excerpt'].every((key) => isString(value[key]));
}

function isBlock(value: unknown): value is ContentBlock {
  return isRecord(value) && ['id', 'chapterId', 'title', 'html', 'updatedAt'].every((key) => isString(value[key]))
    && Object.keys(labels).includes(String(value.kind)) && isRevision(value.revision) && reviewStates.includes(String(value.reviewStatus))
    && (value.pendingKind === undefined || pendingStates.includes(String(value.pendingKind)))
    && (value.resolved === undefined || typeof value.resolved === 'boolean')
    && Array.isArray(value.rows) && value.rows.every(strings)
    && Array.isArray(value.sourceReferences) && value.sourceReferences.every(isSource)
    && Array.isArray(value.mappings) && value.mappings.every((item) => isRecord(item) && isString(item.requirementId) && ['部分覆盖', '已覆盖', '待核验'].includes(String(item.coverage)))
    && Array.isArray(value.citations) && value.citations.every((item) => isRecord(item) && isString(item.factId) && isRevision(item.factRevision));
}

function isChapter(value: unknown): value is WritingChapter {
  return isRecord(value) && ['id', 'title', 'order'].every((key) => isString(value[key]))
    && (value.parentId === undefined || isString(value.parentId)) && isRevision(value.revision)
    && (value.sourceState === undefined || ['active', 'upstream-removed'].includes(String(value.sourceState)))
    && chapterStates.includes(String(value.status)) && reviewStates.includes(String(value.reviewStatus))
    && Array.isArray(value.blocks) && value.blocks.every((block) => isBlock(block) && block.chapterId === value.id)
    && new Set(value.blocks.map((block) => block.id)).size === value.blocks.length;
}

export function validateWritingDocument(value: unknown, expectedProjectId = reportProject.id): value is WritingDocument {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.projectId !== expectedProjectId) return false;
  if (!Array.isArray(value.chapters) || !value.chapters.length || !value.chapters.every(isChapter)) return false;
  if (new Set(value.chapters.map((chapter) => chapter.id)).size !== value.chapters.length) return false;
  if (!Array.isArray(value.facts) || !value.facts.every((fact) => isRecord(fact)
    && ['id', 'name', 'value', 'period', 'topic'].every((key) => isString(fact[key]))
    && (fact.unit === undefined || isString(fact.unit)) && (fact.confirmedBy === undefined || isString(fact.confirmedBy))
    && ['已确认', '待人工确认'].includes(String(fact.state)) && isRevision(fact.revision)
    && ['当年事实', '历史事实', '未来计划'].includes(String(fact.temporalType))
    && (fact.sourceState === undefined || ['active', 'upstream-removed'].includes(String(fact.sourceState)))
    && Array.isArray(fact.sourceReferences) && fact.sourceReferences.every(isSource))) return false;
  if (new Set(value.facts.map((fact) => fact.id)).size !== value.facts.length) return false;
  if (!Array.isArray(value.resources) || !value.resources.every((resource) => isRecord(resource)
    && ['id', 'title', 'description'].every((key) => isString(resource[key]))
    && strings(resource.chapterIds) && ['案例', '制度', '历史资料'].includes(String(resource.kind))
    && typeof resource.confirmed === 'boolean' && isRevision(resource.revision)
    && (resource.confirmedBy === undefined || isString(resource.confirmedBy))
    && (resource.confirmedAt === undefined || isString(resource.confirmedAt))
    && Array.isArray(resource.sourceReferences) && resource.sourceReferences.every(isSource))) return false;
  if (new Set(value.resources.map((resource) => resource.id)).size !== value.resources.length) return false;
  if (!isRecord(value.policy) || !isString(value.policy.id) || !isString(value.policy.terminology)
    || !['专业客观', '简洁直接', '审慎正式'].includes(String(value.policy.tone)) || !strings(value.policy.vagueTerms)
    || !Array.isArray(value.policy.rules) || !value.policy.rules.every((rule) => isRecord(rule) && isString(rule.id) && isString(rule.label) && typeof rule.enabled === 'boolean')) return false;
  return (value.savedAt === undefined || isString(value.savedAt)) && Array.isArray(value.versions) && value.versions.every((version) => isRecord(version)
    && ['id', 'chapterId', 'savedAt', 'label'].every((key) => isString(version[key]))
    && isRevision(version.number) && isChapter(version.snapshot) && version.snapshot.id === version.chapterId);
}

export function parseStoredDocument(raw: string, expectedProjectId = reportProject.id): WritingDocument | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    // Early Step 5 previews did not persist resource confirmations. Add the
    // resource collection without overwriting the rest of that local draft.
    const value: unknown = isRecord(parsed) && parsed.schemaVersion === 1 && parsed.resources === undefined
      ? { ...parsed, resources: createWritingResources() }
      : parsed;
    if (!validateWritingDocument(value, expectedProjectId)) return null;
    const sanitizeChapter = (chapter: WritingChapter): WritingChapter => ({ ...chapter, blocks: chapter.blocks.map((block) => ({ ...block, html: sanitizeHtml(block.html) })) });
    return reconcileCitations({ ...value, chapters: value.chapters.map(sanitizeChapter), versions: value.versions.map((version) => ({ ...version, snapshot: sanitizeChapter(version.snapshot) })) });
  } catch { return null; }
}
