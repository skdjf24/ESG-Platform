import { defaultDepartments, sectionMaterialIds } from "@/lib/project/materials";
import type { ReportProjectData } from "@/lib/types/project-data";

function newStep<T extends number>(step: T): Exclude<T, 3 | 4> | 3 | 4 {
  return step === 3 ? 4 : step === 4 ? 3 : step as Exclude<T, 3 | 4>;
}

function updateStepLabels(value: string) {
  return value.replace(/\bStep ([34])\b/g, (_, digit: string) => `Step ${newStep(Number(digit))}`);
}

export function normalizeCollectionWorkflow(project: ReportProjectData): ReportProjectData {
  const departments = project.departments ?? [
    ...defaultDepartments,
    ...[...new Set(project.dataRequirements.flatMap((item) => [item.responsibleDepartment, item.suggestedDepartment]))]
      .filter((name) => name.trim() && !defaultDepartments.some((department) => department.name === name))
      .map((name) => ({ id: `legacy:${name}`, name })),
  ];
  if (project.workflowOrder === "collection-first") return project.departments ? project : { ...project, departments };

  return {
    ...project,
    workflowOrder: "collection-first",
    departments,
    report: { ...project.report, currentStep: newStep(project.report.currentStep) },
    reportSections: project.reportSections.map((section) => {
      const materialIds = sectionMaterialIds(project, section);
      return materialIds.length ? { ...section, materialIds } : section;
    }),
    dataRequirements: project.dataRequirements.map((item) => {
      const departmentId = item.departmentId ?? departments.find((department) => department.name === item.responsibleDepartment)?.id;
      return departmentId ? { ...item, departmentId } : item;
    }),
    impacts: project.impacts.map((impact) => ({
      ...impact, sourceStep: newStep(impact.sourceStep), targetSteps: impact.targetSteps.map(newStep), message: updateStepLabels(impact.message),
    })),
    quality: {
      ...project.quality,
      invalidations: project.quality.invalidations.map((item) => ({ ...item, sourceStep: newStep(item.sourceStep) })),
      issues: project.quality.issues.map((issue) => ({
        ...issue, sourceStep: newStep(issue.sourceStep),
        locations: issue.locations.map((location) => ({ ...location, sourceStep: newStep(location.sourceStep), label: updateStepLabels(location.label) })),
        description: updateStepLabels(issue.description),
        suggestedAction: updateStepLabels(issue.suggestedAction),
      })),
    },
  };
}
