import records from "@/lib/industry/gbt4754-2017-amended.json";

export type IndustryLevel = 1 | 2 | 3 | 4;

export interface IndustryClassification {
  code: string;
  name: string;
  level: IndustryLevel;
  parentCode: string | null;
}

export const industryStandard = {
  version: "GB/T 4754-2017（2019 年第 1 号修改单）",
  updatedAt: "2026-11-17",
  source: "https://www.stats.gov.cn/sj/tjbz/gmjjhyfl/202501/P020250116506795831658.pdf",
  counts: { sections: 20, divisions: 97, groups: 473, classes: 1382 },
} as const;

export const industries: IndustryClassification[] = records.map((item) => ({
  ...item,
  level: item.level as IndustryLevel,
}));

const byCode = new Map(industries.map((item) => [item.code, item]));
const byParent = new Map<string | null, IndustryClassification[]>();
for (const item of industries) {
  const siblings = byParent.get(item.parentCode) ?? [];
  siblings.push(item);
  byParent.set(item.parentCode, siblings);
}

/** Historical records used a section prefix (for example C26). Preserve their
 * stored value until the user explicitly changes the selection. */
export function getIndustry(code: string): IndustryClassification | undefined {
  return byCode.get(code) ?? (code.length > 1 && /^[A-T]\d{2,4}$/.test(code) ? byCode.get(code.slice(1)) : undefined);
}

export function industryPath(code: string): IndustryClassification[] {
  const path: IndustryClassification[] = [];
  let item = getIndustry(code);
  while (item) {
    path.unshift(item);
    item = item.parentCode ? byCode.get(item.parentCode) : undefined;
  }
  return path;
}

export function industryChildren(parentCode: string | null): IndustryClassification[] {
  return byParent.get(parentCode) ?? [];
}

export function searchIndustries(query: string, limit = 60): IndustryClassification[] {
  const term = query.trim().toLowerCase();
  if (!term) return [];
  return industries.filter((item) => item.code.toLowerCase().includes(term) || item.name.toLowerCase().includes(term)
    || (item.level === 2 && `${item.parentCode}${item.code}`.toLowerCase().includes(term))).slice(0, limit);
}

export function industrySelection(code: string): IndustryClassification | undefined {
  const item = getIndustry(code);
  return item && { ...item };
}
