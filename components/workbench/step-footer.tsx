"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import { useProjectData } from "@/components/project/project-data-provider";
import type { ProjectStep } from "@/lib/types/project-data";

export function StepFooter({ currentStep, showSave = true }: { currentStep: number; showSave?: boolean }) {
  const router = useRouter();
  const { project, dirty, saving, saveProject } = useProjectData();
  const save = () => currentStep <= 6 ? saveProject(currentStep as ProjectStep, `Step ${currentStep} 手动保存`) : Promise.resolve(false);
  const navigate = async (href: string) => {
    if (dirty && currentStep <= 6) {
      const saved = await saveProject(currentStep as ProjectStep, "步骤切换自动保存");
      if (!saved) return;
    }
    router.push(href);
  };
  return (
    <div className="mt-6 flex flex-col-reverse items-stretch justify-between gap-3 rounded-2xl border border-[#e0e6e2] bg-white p-4 sm:flex-row sm:items-center">
      <div>
        {currentStep > 1 ? (
          <button onClick={() => void navigate(`/reports/${project.projectId}/step/${currentStep - 1}`)} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#dbe2de] px-4 text-xs font-semibold text-[#526059] hover:bg-[#f5f7f6] sm:w-auto">
            <ArrowLeft className="size-3.5" />上一步
          </button>
        ) : <button onClick={() => void navigate("/")} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#dbe2de] px-4 text-xs font-semibold text-[#526059] hover:bg-[#f5f7f6] sm:w-auto"><ArrowLeft className="size-3.5" />返回项目</button>}
      </div>
      <div className="flex gap-2">
        {showSave ? <button disabled={saving} onClick={() => void save()} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-[#dbe2de] px-4 text-xs font-semibold text-[#526059] hover:bg-[#f5f7f6] disabled:opacity-50 sm:flex-none"><Save className="size-3.5" />{saving ? "保存中…" : dirty ? "保存草稿" : "已保存"}</button> : null}
        {currentStep < 8 ? (
          <button onClick={() => void navigate(`/reports/${project.projectId}/step/${currentStep + 1}`)} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#176b52] px-4 text-xs font-semibold text-white hover:bg-[#105c46] sm:flex-none">下一步<ArrowRight className="size-3.5" /></button>
        ) : null}
      </div>
    </div>
  );
}
