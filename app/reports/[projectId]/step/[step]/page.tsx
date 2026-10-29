import { notFound } from "next/navigation";
import { ProjectDataProvider } from "@/components/project/project-data-provider";
import { StepFour } from "@/components/workbench/step-four";
import { StepFive } from "@/components/workbench/step-five";
import { StepSix } from "@/components/workbench/step-six";
import { StepSeven } from "@/components/workbench/step-seven";
import { StepEight } from "@/components/workbench/step-eight";
import { StepOne } from "@/components/workbench/step-one";
import { StepThree } from "@/components/workbench/step-three";
import { StepTwo } from "@/components/workbench/step-two";
import { WorkbenchShell } from "@/components/workbench/workbench-shell";

export default async function ReportStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; step: string }>;
  searchParams: Promise<{ chapterId?: string; blockId?: string; requirementId?: string; factId?: string }>;
}) {
  const { projectId, step: stepParam } = await params;
  const { chapterId, blockId, requirementId, factId } = await searchParams;
  const step = Number(stepParam);

  if (projectId !== "hualan-2025" || !Number.isInteger(step) || step < 1 || step > 8) {
    notFound();
  }

  return (
    <ProjectDataProvider projectId={projectId}>
      <WorkbenchShell currentStep={step}>
        {step === 1 ? <StepOne /> : null}
        {step === 2 ? <StepTwo /> : null}
        {step === 3 ? <StepThree initialRequirementId={requirementId} /> : null}
        {step === 4 ? <StepFour initialFactId={factId} /> : null}
        {step === 5 ? <StepFive initialChapterId={chapterId} initialBlockId={blockId} /> : null}
        {step === 6 ? <StepSix initialBlockId={blockId} /> : null}
        {step === 7 ? <StepSeven /> : null}
        {step === 8 ? <StepEight /> : null}
      </WorkbenchShell>
    </ProjectDataProvider>
  );
}

export function generateStaticParams() {
  return Array.from({ length: 8 }, (_, index) => ({
    projectId: "hualan-2025",
    step: String(index + 1),
  }));
}
