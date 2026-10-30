import { ProjectDataProvider } from "@/components/project/project-data-provider";
import { FinalReport } from "@/components/presentation/final-report";

export default async function FinalReportPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectDataProvider projectId={projectId}><FinalReport /></ProjectDataProvider>;
}
