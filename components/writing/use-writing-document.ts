"use client";

import { useProjectData } from "@/components/project/project-data-provider";
import { applyWritingDocument, composeWritingDocument } from "@/lib/project/synchronize";
import type { WritingDocument } from "@/lib/types/writing";

export function useWritingDocument() {
  const projectStore = useProjectData();
  const doc = composeWritingDocument(projectStore.project);
  const savedDocument = composeWritingDocument(projectStore.savedProject);

  async function save(label = "手动保存") {
    const now = new Date().toISOString();
    const changedChapters = doc.chapters.filter((chapter) => {
      const saved = savedDocument.chapters.find((item) => item.id === chapter.id);
      return JSON.stringify(chapter) !== JSON.stringify(saved) || !doc.versions.some((version) => version.chapterId === chapter.id);
    });
    const versions = changedChapters.map((chapter) => ({
      id: crypto.randomUUID(),
      chapterId: chapter.id,
      number: Math.max(0, ...doc.versions.filter((version) => version.chapterId === chapter.id).map((version) => version.number)) + 1,
      savedAt: now,
      label,
      snapshot: structuredClone(chapter),
    }));
    const nextDocument: WritingDocument = { ...doc, savedAt: now, versions: [...doc.versions, ...versions] };
    return projectStore.saveProject(5, label, applyWritingDocument(projectStore.project, nextDocument));
  }

  return {
    doc,
    project: projectStore.project,
    ready: projectStore.ready,
    dirty: projectStore.dirty,
    saving: projectStore.saving,
    message: projectStore.message,
    setMessage: projectStore.setMessage,
    save,
    edit: (nextDocument: WritingDocument) => projectStore.editProject(applyWritingDocument(projectStore.project, nextDocument)),
    undo: projectStore.undo,
    redo: projectStore.redo,
    past: projectStore.past,
    future: projectStore.future,
    acknowledgeImpact: projectStore.acknowledgeImpact,
  };
}
