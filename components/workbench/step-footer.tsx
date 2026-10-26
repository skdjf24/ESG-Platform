import Link from "next/link";
import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import { reportProject } from "@/lib/data/mock-data";

export function StepFooter({ currentStep, showSave = true }: { currentStep: number; showSave?: boolean }) {
  return (
    <div className="mt-6 flex flex-col-reverse items-stretch justify-between gap-3 rounded-2xl border border-[#e0e6e2] bg-white p-4 sm:flex-row sm:items-center">
      <div>
        {currentStep > 1 ? (
          <Link href={`/reports/${reportProject.id}/step/${currentStep - 1}`} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#dbe2de] px-4 text-xs font-semibold text-[#526059] hover:bg-[#f5f7f6] sm:w-auto">
            <ArrowLeft className="size-3.5" />上一步
          </Link>
        ) : <Link href="/" className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#dbe2de] px-4 text-xs font-semibold text-[#526059] hover:bg-[#f5f7f6] sm:w-auto"><ArrowLeft className="size-3.5" />返回项目</Link>}
      </div>
      <div className="flex gap-2">
        {showSave ? <button className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-[#dbe2de] px-4 text-xs font-semibold text-[#526059] hover:bg-[#f5f7f6] sm:flex-none"><Save className="size-3.5" />保存草稿</button> : null}
        {currentStep < 8 ? (
          <Link href={`/reports/${reportProject.id}/step/${currentStep + 1}`} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#176b52] px-4 text-xs font-semibold text-white hover:bg-[#105c46] sm:flex-none">下一步<ArrowRight className="size-3.5" /></Link>
        ) : null}
      </div>
    </div>
  );
}
