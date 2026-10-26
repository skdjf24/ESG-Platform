import type { ReactNode } from "react";

type Tone = "green" | "blue" | "amber" | "gray" | "red" | "teal";

const toneStyles: Record<Tone, string> = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  gray: "border-slate-200 bg-slate-50 text-slate-600",
  red: "border-rose-200 bg-rose-50 text-rose-700",
  teal: "border-teal-200 bg-teal-50 text-teal-700",
};

export function StatusBadge({ children, tone = "gray", dot = false }: { children: ReactNode; tone?: Tone; dot?: boolean }) {
  return (
    <span className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none ${toneStyles[tone]}`}>
      {dot ? <span className="size-1.5 rounded-full bg-current opacity-75" /> : null}
      {children}
    </span>
  );
}
