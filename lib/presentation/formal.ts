import type { ReportProjectData } from "@/lib/types/project-data";
import type { ReportChart } from "@/lib/types/presentation";
import type { ContentBlock } from "@/lib/types/writing";
import { plainText } from "@/lib/writing/document";

/** Shared exclusion rule for every formal output surface. */
export function formalBlockExclusionReason(
  block: ContentBlock,
  project: ReportProjectData,
  chart?: ReportChart,
) {
  if (block.kind === "todo") return "内部待办";
  if (block.pendingKind && !block.resolved) return block.pendingKind;
  if (block.reviewStatus === "待复核") return "待复核";
  if (block.citations.some((citation) => {
    const fact = project.facts.find((item) => item.id === citation.factId);
    return !fact || fact.state !== "已确认" || fact.revision !== citation.factRevision;
  })) return "引用事实未确认或版本已变化";
  if (block.kind === "chart" && (!chart || chart.status !== "已确认")) return "图表未确认";
  if (block.kind === "chart" && chart?.usesMockData) return "图表使用独立模拟测试数据";
  const text = `${block.title} ${plainText(block.html)} ${block.rows.flat().join(" ")}`;
  if (/Mock|独立模拟测试|编辑示例|示例事实/i.test(text)) return "仅供开发或模拟测试的说明";
  return null;
}
