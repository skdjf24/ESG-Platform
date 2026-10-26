import { Info, Sparkles, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

export function Notice({ children, tone = "info", title }: { children: ReactNode; tone?: "info" | "warning" | "ai"; title?: string }) {
  const styles = {
    info: "border-[#cce1d8] bg-[#f0f7f4] text-[#285846]",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    ai: "border-violet-200 bg-violet-50 text-violet-800",
  };
  const Icon = tone === "warning" ? TriangleAlert : tone === "ai" ? Sparkles : Info;
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${styles[tone]}`}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="text-xs leading-5">
        {title ? <div className="mb-0.5 font-semibold">{title}</div> : null}
        {children}
      </div>
    </div>
  );
}
