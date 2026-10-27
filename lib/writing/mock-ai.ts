import type { AiOperation, AiTaskProvider, AiTaskRequest, AiTaskResponse, WritingFact } from '@/lib/types/writing';
import { plainText } from './document';

export const operationLabels: Record<AiOperation, string> = {
  draft: '生成章节初稿', rewrite: '选中文字局部改写', expand: '扩写',
  shorten: '精简', tone: '调整语气', update: '根据新增资料更新正文',
};

function waitForMock(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('已取消 Mock 任务', 'AbortError')); return; }
    const abort = () => { clearTimeout(timer); reject(new DOMException('已取消 Mock 任务', 'AbortError')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, 450);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

function factSentence(fact: WritingFact): string {
  return `${fact.temporalType}：${fact.period}，${fact.name}为 ${fact.value}${fact.unit ? ` ${fact.unit}` : ''}。来源：${fact.sourceReferences.map((source) => `${source.fileName}（${source.locator}）`).join('；')}。`;
}

function neutralize(text: string, request: AiTaskRequest): string {
  if (!request.policy.rules.some((rule) => rule.id === 'vague' && rule.enabled)) return text;
  return request.policy.vagueTerms.reduce((result, term) => term.trim() ? result.split(term.trim()).join('【待以具体证据说明】') : result, text);
}

/** Local deterministic demo adapter. No remote calls and no claims of semantic AI review. */
export const mockAiProvider: AiTaskProvider = {
  id: 'mock-local-rules',
  mode: 'mock',
  label: 'Mock 示例建议',
  async run(request: AiTaskRequest, signal?: AbortSignal): Promise<AiTaskResponse> {
    await waitForMock(signal);
    const source = plainText(request.selectedText || request.sourceText);
    const facts = request.facts.filter((fact) => fact.state === '已确认' && fact.sourceReferences.length > 0);
    const evidence = facts.map(factSentence).join('\n');
    const clean = neutralize(source, request);
    let suggestion = clean;
    let usedFacts: WritingFact[] = [];
    switch (request.operation) {
      case 'draft':
        usedFacts = facts;
        suggestion = `${request.chapter.title}\n\n${evidence || '【待补充】本章节尚无可用于正文的已确认事实，请先核对资料包与原始来源。'}\n\n【待确认】请逐项复核本章对应披露要求、统计范围及指标口径。`;
        break;
      case 'rewrite':
        suggestion = clean === source ? `就本节披露事项，${source || '【待补充选中文本】'}` : clean;
        break;
      case 'expand':
        suggestion = `${clean}\n\n【待补充】请结合原始资料，进一步说明实施范围、责任部门、时间区间与证据定位。未经确认的成效不写入正文。`;
        break;
      case 'shorten': {
        // Remove only exact repeated sentences, so numeric values and statistical scope are retained.
        const sentences = clean.match(/[^。！？\n]+[。！？]?/g) ?? [clean];
        suggestion = [...new Set(sentences.map((sentence) => sentence.trim()).filter(Boolean))].join('');
        break;
      }
      case 'tone':
        suggestion = request.policy.tone === '审慎正式' ? `根据目前已录入资料，${clean}` : request.policy.tone === '简洁直接' ? clean.replace(/就本节披露事项，/g, '') : `本节说明如下：\n${clean}`;
        break;
      case 'update':
        usedFacts = facts;
        suggestion = `${clean}\n\n${evidence ? `已确认资料补充：\n${evidence}` : '【待更新】尚无可引用的新增已确认资料；原正文保持，待用户补充证据。'}`;
        break;
    }
    return {
      taskId: request.taskId, providerId: 'mock-local-rules', providerMode: 'mock', label: 'Mock 示例建议', original: source,
      suggestion, citedFactIds: usedFacts.map((fact) => fact.id), requiresConfirmation: true,
      warnings: [
        '本结果由本地固定规则演示生成，未调用真实 AI，也不构成完整语义审校。',
        '接受前请对照来源确认；数值和单位取自输入事实，统计口径仍需用户复核。',
        ...(request.facts.some((fact) => fact.state !== '已确认') ? ['待人工确认的事实未用于新增正文。'] : []),
        ...(request.operation === 'shorten' && suggestion === clean ? ['没有可移除的重复句，已保留原文，避免更改事实或数值。'] : []),
      ],
    };
  },
};
