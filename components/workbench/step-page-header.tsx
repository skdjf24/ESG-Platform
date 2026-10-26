import { CheckCircle2 } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";

export function StepPageHeader({
  eyebrow,
  title,
  description,
  completed = false,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  completed?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
      <div className="max-w-3xl">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6f7d76]">{eyebrow}</span>
          {completed ? <StatusBadge tone="green"><CheckCircle2 className="size-3" />已完成</StatusBadge> : <StatusBadge tone="amber" dot>进行中</StatusBadge>}
        </div>
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#17221c] sm:text-[28px]">{title}</h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#6e7973]">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
