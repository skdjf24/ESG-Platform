import { Leaf } from "lucide-react";

export function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className="flex items-center gap-3" aria-label="衡迹 ESG">
      <span className={`grid size-9 place-items-center rounded-xl ${inverse ? "bg-white/12 text-emerald-200" : "bg-[#176b52] text-white"}`}>
        <Leaf className="size-[18px]" strokeWidth={2.2} />
      </span>
      <div className="leading-none">
        <div className={`text-[15px] font-semibold tracking-[0.18em] ${inverse ? "text-white" : "text-[#17201c]"}`}>衡迹 ESG</div>
        <div className={`mt-1 text-[9px] font-medium uppercase tracking-[0.24em] ${inverse ? "text-white/45" : "text-[#819087]"}`}>Disclosure Studio</div>
      </div>
    </div>
  );
}
