import { notFound } from "next/navigation";
import { ProjectDataProvider } from "@/components/project/project-data-provider";
import { FinalReport } from "@/components/presentation/final-report";

export default async function FinalReportPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (projectId !== "hualan-2025") notFound();
  return <ProjectDataProvider projectId={projectId}><FinalReport /></ProjectDataProvider>;
}
