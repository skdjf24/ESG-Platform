"use client";

import { createContext, useContext, useEffect, useReducer, useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import type { ProjectStep, ReportProjectData } from "@/lib/types/project-data";
import { createProjectData } from "@/lib/project/seed";
import { projectRepository, ProjectStorageError } from "@/lib/project/repository";

interface ProjectState {
  project: ReportProjectData;
  savedProject: ReportProjectData;
  past: ReportProjectData[];
  future: ReportProjectData[];
  ready: boolean;
  dirty: boolean;
  saving: boolean;
}

type ProjectAction =
  | { type: "loaded"; project: ReportProjectData }
  | { type: "edit"; project: ReportProjectData }
  | { type: "saving" }
  | { type: "saved"; project: ReportProjectData }
  | { type: "save-failed" }
  | { type: "undo" | "redo" };

function reducer(state: ProjectState, action: ProjectAction): ProjectState {
  if (action.type === "loaded") return { project: action.project, savedProject: action.project, past: [], future: [], ready: true, dirty: false, saving: false };
  if (action.type === "edit") return { ...state, project: action.project, past: [...state.past.slice(-49), state.project], future: [], dirty: true };
  if (action.type === "saving") return { ...state, saving: true };
  if (action.type === "save-failed") return { ...state, saving: false };
  if (action.type === "saved") return { ...state, project: action.project, savedProject: action.project, dirty: false, saving: false };
  const stack = action.type === "undo" ? state.past : state.future;
  const snapshot = stack.at(-1);
  if (!snapshot) return state;
  return action.type === "undo"
    ? { ...state, project: snapshot, past: state.past.slice(0, -1), future: [...state.future, state.project], dirty: true }
    : { ...state, project: snapshot, past: [...state.past, state.project], future: state.future.slice(0, -1), dirty: true };
}

interface ProjectDataContextValue extends ProjectState {
  editProject: (next: ReportProjectData | ((current: ReportProjectData) => ReportProjectData)) => void;
  saveProject: (step: ProjectStep, label: string, override?: ReportProjectData) => Promise<boolean>;
  undo: () => void;
  redo: () => void;
  message: string;
  setMessage: (message: string) => void;
  acknowledgeImpact: (impactId: string) => void;
}

const ProjectDataContext = createContext<ProjectDataContextValue | null>(null);

export function ProjectDataProvider({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const seed = createProjectData(projectId);
  const [state, dispatch] = useReducer(reducer, {
    project: seed,
    savedProject: seed,
    past: [],
    future: [],
    ready: false,
    dirty: false,
    saving: false,
  });
  const [message, setMessage] = useState("");
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    let active = true;
    queueMicrotask(async () => {
      try {
        const project = await projectRepository.load(projectId);
        if (active) dispatch({ type: "loaded", project });
      } catch (error) {
        if (!active) return;
        setBlocked(true);
        setMessage(error instanceof Error ? error.message : "项目数据读取失败，已停止本地写入。");
        dispatch({ type: "loaded", project: createProjectData(projectId) });
      }
    });
    return () => { active = false; };
  }, [projectId]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!state.dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [state.dirty]);

  function editProject(next: ReportProjectData | ((current: ReportProjectData) => ReportProjectData)) {
    const current = state.project;
    dispatch({ type: "edit", project: typeof next === "function" ? next(current) : next });
  }

  async function saveProject(step: ProjectStep, label: string, override?: ReportProjectData) {
    const current = state;
    if (!current.ready || current.saving || blocked) {
      setMessage(blocked ? "当前存档处于保护状态，不能覆盖原数据。" : "项目数据尚未就绪，请稍后再保存。");
      return false;
    }
    dispatch({ type: "saving" });
    try {
      const result = await projectRepository.save(projectId, override ?? current.project, {
        step,
        label,
        expectedRevision: current.savedProject.revision,
        previous: current.savedProject,
      });
      dispatch({ type: "saved", project: result.project });
      setMessage(result.impacts.length
        ? `已保存项目数据，并识别 ${result.impacts.length} 项跨步骤影响，请在相关步骤复核。`
        : "已保存项目数据，刷新后仍可恢复。");
      return true;
    } catch (error) {
      dispatch({ type: "save-failed" });
      if (error instanceof ProjectStorageError && ["incompatible", "conflict"].includes(error.code)) setBlocked(true);
      setMessage(error instanceof Error ? error.message : "项目保存失败，当前页面修改仍保留。");
      return false;
    }
  }

  function acknowledgeImpact(impactId: string) {
    editProject((current) => ({ ...current, impacts: current.impacts.map((impact) => impact.id === impactId ? { ...impact, status: "已知悉" } : impact) }));
  }

  const value: ProjectDataContextValue = {
    ...state,
    editProject,
    saveProject,
    undo: () => dispatch({ type: "undo" }),
    redo: () => dispatch({ type: "redo" }),
    message,
    setMessage,
    acknowledgeImpact,
  };

  return (
    <ProjectDataContext.Provider value={value}>
      <div aria-busy={!state.ready}>{children}</div>
      {message ? (
        <div role="status" className="fixed bottom-4 right-4 z-[90] flex max-w-md items-start gap-2 rounded-xl border border-[#cfe0d6] bg-white px-4 py-3 text-xs leading-5 text-[#405b4b] shadow-xl">
          {blocked ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#27805f]" />}
          <span className="flex-1">{message}</span>
          <button onClick={() => setMessage("")} aria-label="关闭项目数据提示" className="text-[#839087]"><X className="size-3.5" /></button>
        </div>
      ) : null}
    </ProjectDataContext.Provider>
  );
}

export function useProjectData() {
  const context = useContext(ProjectDataContext);
  if (!context) throw new Error("useProjectData 必须在 ProjectDataProvider 中使用。");
  return context;
}
