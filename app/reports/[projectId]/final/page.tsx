import { ProjectDataProvider } from "@/components/project/project-data-provider";
import { FinalReport } from "@/components/presentation/final-report";
import { projectIdFromRoute } from "@/lib/project/route-id";

export default async function FinalReportPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId: routeProjectId } = await params;
  const projectId = projectIdFromRoute(routeProjectId);
  return <ProjectDataProvider projectId={projectId}><FinalReport /></ProjectDataProvider>;
}
