import type { ReportTheme } from "@/lib/types/presentation";

export const reportThemes: ReportTheme[] = [
  {
    id: "verdant-professional",
    name: "澜绿专业",
    description: "克制的深绿色与暖金色，适合制造业 ESG 正式报告。",
    paper: { size: "A4", widthMm: 210, heightMm: 297 },
    margins: { top: 18, right: 18, bottom: 18, left: 20 },
    colors: { primary: "#176b52", secondary: "#2f8b6d", accent: "#c9a86a", background: "#edf4f0", surface: "#ffffff", text: "#20352a", muted: "#728279" },
    fonts: { chinese: '"PingFang SC", "Microsoft YaHei", sans-serif', english: 'Inter, Arial, sans-serif', heading: '"PingFang SC", "Microsoft YaHei", sans-serif' },
    headings: [{ level: 1, size: 30, lineHeight: 1.25, weight: 650 }, { level: 2, size: 21, lineHeight: 1.35, weight: 620 }, { level: 3, size: 15, lineHeight: 1.45, weight: 600 }],
    body: { size: 11, lineHeight: 1.8 },
    header: { enabled: true, template: "{{enterpriseName}} · {{reportYear}} ESG 报告" },
    footer: { enabled: true, template: "ESG DISCLOSURE REPORT" },
    pageNumber: { startAt: 1, format: "arabic", showOnCover: false, label: "预览页" },
    chartStyle: { palette: ["#176b52", "#5aa98a", "#c9a86a", "#7f9f91", "#b9d6c8"], showGrid: true, roundedBars: true, legendPosition: "bottom" },
  },
  {
    id: "slate-insight",
    name: "蓝灰研报",
    description: "蓝灰信息层级与冷色图表，适合数据密集型披露。",
    paper: { size: "A4", widthMm: 210, heightMm: 297 },
    margins: { top: 17, right: 17, bottom: 18, left: 17 },
    colors: { primary: "#315b7d", secondary: "#688ba5", accent: "#b7814f", background: "#edf2f5", surface: "#ffffff", text: "#263746", muted: "#72808b" },
    fonts: { chinese: '"Microsoft YaHei", "PingFang SC", sans-serif', english: 'Georgia, "Times New Roman", serif', heading: '"Microsoft YaHei", "PingFang SC", sans-serif' },
    headings: [{ level: 1, size: 29, lineHeight: 1.25, weight: 650 }, { level: 2, size: 20, lineHeight: 1.35, weight: 620 }, { level: 3, size: 15, lineHeight: 1.45, weight: 600 }],
    body: { size: 11, lineHeight: 1.75 },
    header: { enabled: true, template: "{{enterpriseName}} · ESG PERFORMANCE & GOVERNANCE" },
    footer: { enabled: true, template: "ESG DISCLOSURE REPORT" },
    pageNumber: { startAt: 1, format: "arabic", showOnCover: false, label: "预览页" },
    chartStyle: { palette: ["#315b7d", "#6c9bb7", "#b7814f", "#93a8b6", "#b8cad4"], showGrid: true, roundedBars: false, legendPosition: "top" },
  },
];

export function getReportTheme(themeId: string) {
  return reportThemes.find((theme) => theme.id === themeId) ?? reportThemes[0];
}
