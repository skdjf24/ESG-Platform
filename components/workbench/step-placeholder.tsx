import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Clock3,
  FileArchive,
  FileDown,
  FileText,
  LayoutTemplate,
  LockKeyhole,
  PenLine,
  SearchCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { StepFooter } from "@/components/workbench/step-footer";
import { reportSteps } from "@/lib/data/mock-data";

type PlaceholderStep = 5 | 6 | 7 | 8;

interface FutureFeature {
  title: string;
  description: string;
  icon: LucideIcon;
}

const placeholderContent: Record<
  PlaceholderStep,
  {
    summary: string;
    supportingText: string;
    icon: LucideIcon;
    features: FutureFeature[];
  }
> = {
  5: {
    summary: "基于已确认的企业事实与披露要求，辅助形成可审阅的章节初稿。",
    supportingText: "本步骤将在后续版本开放。当前原型不会生成、改写或保存任何报告正文。",
    icon: PenLine,
    features: [
      { title: "章节辅助起草", description: "按报告目录与已确认事实形成章节初稿。", icon: Sparkles },
      { title: "事实引用追溯", description: "在正文中保留事实与原始资料的引用关系。", icon: FileText },
      { title: "人工协同修订", description: "支持责任人审阅、修订与版本对比。", icon: PenLine },
    ],
  },
  6: {
    summary: "将已确认的报告内容转化为清晰、一致的图表与页面版式。",
    supportingText: "本步骤将在后续版本开放。当前原型不提供图表生成、品牌模板或排版编辑能力。",
    icon: LayoutTemplate,
    features: [
      { title: "指标图表配置", description: "为定量指标选择合适的可视化表达。", icon: BarChart3 },
      { title: "报告版式编辑", description: "组织章节、图文与分页结构。", icon: LayoutTemplate },
      { title: "品牌样式管理", description: "统一色彩、字体与页面视觉规范。", icon: FileText },
    ],
  },
  7: {
    summary: "在定稿前检查报告的一致性、可追溯性与披露要求覆盖情况。",
    supportingText: "本步骤将在后续版本开放。当前原型不会自动给出质量或合规结论。",
    icon: ShieldCheck,
    features: [
      { title: "披露覆盖检查", description: "核对适用要求与报告章节的映射情况。", icon: SearchCheck },
      { title: "事实一致性检查", description: "核对正文、指标与已确认事实的引用。", icon: ShieldCheck },
      { title: "问题清单复核", description: "汇总待人工判断的问题并记录处理结果。", icon: FileText },
    ],
  },
  8: {
    summary: "完成人工定稿确认，并生成用于发布与存档的报告文件。",
    supportingText: "本步骤将在后续版本开放。当前原型不会生成文件、锁定版本或执行对外发布。",
    icon: FileDown,
    features: [
      { title: "定稿版本确认", description: "由授权用户确认最终内容与版本。", icon: LockKeyhole },
      { title: "报告文件导出", description: "按最终版式导出报告文件。", icon: FileDown },
      { title: "版本归档", description: "保留定稿文件、确认记录与来源链路。", icon: FileArchive },
    ],
  },
};

export function StepPlaceholder({ step }: { step: PlaceholderStep }) {
  const definition = reportSteps.find((item) => item.number === step);
  const content = placeholderContent[step];
  const MainIcon = content.icon;

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="max-w-3xl">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6f7d76]">Step {step} of 8</span>
            <StatusBadge tone="gray"><Clock3 className="size-3" />待开发</StatusBadge>
          </div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#17221c] sm:text-[28px]">
            {definition?.title}
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#6e7973]">{content.summary}</p>
        </div>
      </div>

      <SectionCard className="relative">
        <div className="soft-grid absolute inset-0 opacity-45" aria-hidden="true" />
        <div className="relative flex min-h-[250px] flex-col items-center justify-center px-4 py-10 text-center">
          <div className="relative mb-5">
            <div className="absolute inset-0 scale-150 rounded-full bg-[#e9f3ee] blur-xl" />
            <div className="relative grid size-16 place-items-center rounded-2xl border border-[#d9e7df] bg-white text-[#176b52] shadow-[0_10px_30px_rgba(23,107,82,0.10)]">
              <MainIcon className="size-7" strokeWidth={1.7} />
            </div>
          </div>
          <StatusBadge tone="amber" dot>后续版本开放</StatusBadge>
          <h2 className="mt-4 text-lg font-semibold text-[#1b2822]">该步骤尚未开放</h2>
          <p className="mt-2 max-w-xl text-xs leading-6 text-[#748079]">{content.supportingText}</p>
        </div>
      </SectionCard>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {content.features.map((feature) => {
          const FeatureIcon = feature.icon;
          return (
            <div
              key={feature.title}
              aria-disabled="true"
              className="relative overflow-hidden rounded-2xl border border-[#e1e6e3] bg-white p-5 opacity-70"
            >
              <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-[#f2f4f3] px-2 py-1 text-[9px] font-semibold text-[#89928e]">
                <LockKeyhole className="size-2.5" />未开放
              </div>
              <div className="grid size-10 place-items-center rounded-xl bg-[#f0f4f2] text-[#6c7a72]">
                <FeatureIcon className="size-[18px]" strokeWidth={1.8} />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-[#2b3731]">{feature.title}</h3>
              <p className="mt-2 pr-2 text-[11px] leading-5 text-[#7e8983]">{feature.description}</p>
            </div>
          );
        })}
      </div>
      <StepFooter currentStep={step} showSave={false} />
    </div>
  );
}
