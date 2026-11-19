"use client";

import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  FileSpreadsheet,
  FileText,
  Link2,
  MessageSquareText,
  UploadCloud,
  X,
} from "lucide-react";
import { projectFileRepository } from "@/lib/project/repository";
import { useProjectData } from "@/components/project/project-data-provider";
import { Notice } from "@/components/ui/notice";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { StepFooter } from "@/components/workbench/step-footer";
import { StepPageHeader } from "@/components/workbench/step-page-header";
import { MaterialsWorkspace } from "@/components/workbench/materials-workspace";
import { DocumentParsingWorkbench } from "@/components/parsing/document-parsing-workbench";

type Tab = "tasks" | "parse" | "facts";
type IntakeMode = "upload" | "online" | null;

export function StepThree({ initialFactId, initialSourceId }: { initialFactId?: string; initialSourceId?: string }) {
  const { project, editProject, saveProject, setMessage, ready, saving } = useProjectData();
  const dataRequirements = project.dataRequirements;
  const enterpriseFacts = project.facts;
  const [activeTab, setActiveTab] = useState<Tab>(initialFactId ? "facts" : initialSourceId ? "parse" : "tasks");
  const [intakeMode, setIntakeMode] = useState<IntakeMode>(null);
  const [selectedRequirementId, setSelectedRequirementId] = useState(dataRequirements[0]?.id ?? "");
  const effectiveRequirementId = selectedRequirementId;
  const [selectedFile, setSelectedFile] = useState<{ file: File; name: string; size: string; fileType: "PDF" | "XLSX" | "DOCX" } | null>(null);
  const [supplementTitle, setSupplementTitle] = useState(project.projectKind === "sample" ? "节能改造项目说明" : "");
  const [supplementContent, setSupplementContent] = useState("");
  const [intakeError, setIntakeError] = useState("");
  const [parseSourceId, setParseSourceId] = useState(initialSourceId);
  const [intakeBusy, setIntakeBusy] = useState(false);
  const [openFact, setOpenFact] = useState<string | null>(initialFactId ?? "fact-energy-2025");
  const [factDrafts, setFactDrafts] = useState<Record<string, { value: string; unit: string; period: string; reportingBoundary: string }>>({});
  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: "tasks", label: "资料清单", count: dataRequirements.length },
    { id: "parse", label: "解析结果 / 候选确认", count: project.sources.filter((source) => source.fileId).length },
    { id: "facts", label: "企业事实库", count: enterpriseFacts.length },
  ];

  function updateFactDraft(id: string, fact: { value: string; unit?: string; period: string; reportingBoundary?: string }, patch: Partial<{ value: string; unit: string; period: string; reportingBoundary: string }>) {
    setFactDrafts((current) => {
      const base = current[id] ?? { value: fact.value, unit: fact.unit ?? "", period: fact.period, reportingBoundary: fact.reportingBoundary ?? "" };
      return { ...current, [id]: { ...base, ...patch } };
    });
  }

  function applyFactDraft(id: string) {
    const fact = enterpriseFacts.find((item) => item.id === id);
    const draft = factDrafts[id];
    if (!fact || !draft) return;
    const affected = project.writing.chapters.flatMap((chapter) => chapter.blocks.filter((block) => block.citations.some((citation) => citation.factId === id))).length;
    if (affected && !window.confirm(`该指标已被 ${affected} 个正文块引用。更新后正文不会自动改写，但会标记为待更新。是否继续？`)) return;
    editProject((current) => ({ ...current, facts: current.facts.map((item) => item.id === id ? {
      ...item,
      ...draft,
      state: "待人工确认",
      confirmedBy: undefined,
      sourceConfirmationStatus: "待确认",
      boundaryStatus: draft.reportingBoundary !== (item.reportingBoundary ?? "") ? "待核验" : item.boundaryStatus,
    } : item) }));
    setFactDrafts((current) => { const next = { ...current }; delete next[id]; return next; });
  }

  function showSource(sourceId?: string) {
    setParseSourceId(sourceId);
    setActiveTab("parse");
  }

  function openIntake(mode: Exclude<IntakeMode, null>, materialId?: string) {
    setSelectedRequirementId(materialId ?? dataRequirements[0]?.id ?? "");
    setIntakeMode(mode);
  }

  function resetIntake() {
    setIntakeMode(null);
    setSelectedFile(null);
    setSupplementContent("");
    setIntakeError("");
  }

  function handleIntakeFile(file: File) {
    const extension = file.name.split(".").pop()?.toLowerCase();
    const fileType = extension === "pdf" ? "PDF" : extension === "docx" ? "DOCX" : extension === "xlsx" || extension === "xls" ? "XLSX" : null;
    if (!fileType) {
      setSelectedFile(null);
      setIntakeError("仅支持 XLSX、XLS、PDF 或 DOCX 文件。");
      return;
    }
    const size = file.size >= 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`;
    setSelectedFile({ file, name: file.name, size, fileType });
    setIntakeError("");
  }

  async function submitIntake() {
    const requirement = dataRequirements.find((item) => item.id === effectiveRequirementId);
    if (intakeBusy || saving || !ready) return;
    if (!requirement && effectiveRequirementId) {
      setIntakeError("请选择关联资料项。");
      return;
    }
    if (intakeMode === "upload" && !selectedFile) {
      setIntakeError("请先选择文件。文件将保存到当前浏览器的本地文件仓库。");
      return;
    }
    if (intakeMode === "online" && (!supplementTitle.trim() || !supplementContent.trim())) {
      setIntakeError("请填写补充标题和资料内容。");
      return;
    }
    const sourceId = `source-user-${crypto.randomUUID()}`;
    const now = new Date();
    let storedFileId: string | undefined;
    setIntakeBusy(true);
    try {
      const storedFile = intakeMode === "upload" && selectedFile ? await projectFileRepository.save(project.projectId, selectedFile.file) : null;
      storedFileId = storedFile?.fileId;
      const source = intakeMode === "upload" && selectedFile && storedFile ? {
        id: sourceId,
        materialId: requirement?.id,
        name: selectedFile.name,
        kind: "file" as const,
        fileType: selectedFile.fileType,
        fileId: storedFile.fileId,
        mimeType: storedFile.mimeType,
        fileStatus: "available" as const,
        parserStatus: "not-started" as const,
        size: selectedFile.size,
        uploadedAt: now.toISOString().slice(0, 10),
        uploadedBy: project.enterprise.reportingContact.name || "当前用户",
        state: "已上传" as const,
      } : {
        id: sourceId,
        materialId: requirement?.id,
        name: supplementTitle.trim(),
        kind: "online" as const,
        fileType: "表单" as const,
        fileStatus: "metadata-only" as const,
        size: `${supplementContent.trim().length} 字`,
        uploadedAt: now.toISOString().slice(0, 10),
        uploadedBy: project.enterprise.reportingContact.name || "当前用户",
        state: "已上传" as const,
      };
      const onlineResource = intakeMode === "online" ? [{
        id: `resource-${sourceId}`,
        chapterIds: [],
        kind: requirement?.type === "案例" ? "案例" as const : requirement?.type === "制度文件" ? "制度" as const : "定性资料" as const,
        title: supplementTitle.trim(),
        description: supplementContent.trim(),
        confirmed: false,
        sourceReferences: [{ id: `ref-${sourceId}`, sourceId, fileName: `${supplementTitle.trim()}.表单`, locator: "在线补充表单", excerpt: supplementContent.trim().slice(0, 160) }],
        revision: 1,
      }] : [];
      const next = {
        ...project,
        sources: [...project.sources, source],
        resources: [...project.resources, ...onlineResource],
        dataRequirements: project.dataRequirements.map((item) => item.id === requirement?.id ? { ...item, collectionMethod: intakeMode === "online" ? "在线补充" as const : "文件上传" as const, state: "待确认" as const, reviewStatus: "待复核" as const } : item),
      };
      if (!await saveProject(3, intakeMode === "upload" ? "保存资料文件" : "保存在线补充", next)) {
        if (storedFileId) await projectFileRepository.delete(project.projectId, storedFileId).catch(() => undefined);
        return;
      }
      resetIntake();
    } catch (error) {
      const message = error instanceof Error ? error.message : "来源记录保存失败。";
      setIntakeError(message);
      setMessage(message);
      if (storedFileId) await projectFileRepository.delete(project.projectId, storedFileId).catch(() => undefined);
    } finally {
      setIntakeBusy(false);
    }
  }

  return (
    <>
      <StepPageHeader
        eyebrow="Step 03 · Data collection"
        title="ESG资料收集与整理"
        description="按议题和部门收集定性与定量资料，核对来源后人工确认。报告章节可在下一步关联。"
        action={
          <div className="flex gap-2">
            <button
              disabled={!ready || saving} onClick={() => openIntake("online")}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8e0dc] bg-white px-3.5 text-xs font-semibold text-[#4c5b53] transition hover:border-[#9bb6a9] hover:bg-[#f8faf9]"
            >
              <MessageSquareText className="size-3.5" />在线补充
            </button>
            <button
              disabled={!ready || saving} onClick={() => openIntake("upload")}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#176b52] px-3.5 text-xs font-semibold text-white transition hover:bg-[#105c46]"
            >
              <UploadCloud className="size-3.5" />上传资料
            </button>
          </div>
        }
      />

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-[#e0e6e2] bg-white p-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3.5 text-xs font-semibold transition ${activeTab === tab.id ? "bg-[#173e31] text-white shadow-sm" : "text-[#68756e] hover:bg-[#f3f6f4]"}`}
          >
            {tab.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${activeTab === tab.id ? "bg-white/15 text-white/80" : "bg-[#edf1ef] text-[#7d8882]"}`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {activeTab === "tasks" ? <MaterialsWorkspace onIntake={openIntake} onReviewSource={showSource} /> : null}
      {activeTab === "parse" ? <DocumentParsingWorkbench key={parseSourceId ?? "sources"} initialSourceId={parseSourceId} /> : null}

      {activeTab === "facts" ? (
        <div className="space-y-4 animate-fade-up">
          <Notice tone="info" title="事实与原始资料保持关联">
            每条事实均保留来源文件、工作表/单元格或页码定位。报告撰写阶段引用事实时，可回溯至原始证据。
          </Notice>
          <SectionCard
            title="企业事实库"
            description="查看本项目的事实记录与来源链路。"
            flush
          >
            <div className="divide-y divide-[#edf0ee]">
              {enterpriseFacts.map((fact) => {
                const expanded = openFact === fact.id;
                return (
                  <div id={`fact-${fact.id}`} key={fact.id} className={`scroll-mt-24 bg-white ${initialFactId === fact.id ? "ring-1 ring-inset ring-amber-300" : ""}`}>
                    <button onClick={() => setOpenFact(expanded ? null : fact.id)} className="grid w-full gap-3 px-5 py-4 text-left transition hover:bg-[#fbfcfb] sm:grid-cols-[1fr_150px_130px_150px_24px] sm:items-center">
                      <div className="flex items-start gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#edf5f1] text-[#176b52]"><Database className="size-4" /></span>
                        <div>
                          <p className="text-xs font-semibold text-[#2a372f]">{fact.name}</p>
                          <p className="mt-1 text-[10px] text-[#88928d]">{fact.topic} · {fact.period}</p>
                        </div>
                      </div>
                      <div><span className="text-base font-semibold text-[#1f2e26]">{fact.value}</span>{fact.unit ? <span className="ml-1 text-[10px] text-[#7b8680]">{fact.unit}</span> : null}</div>
                      <div><StatusBadge tone={fact.state === "已确认" ? "green" : "amber"} dot>{fact.state}</StatusBadge></div>
                      <div className="inline-flex items-center gap-1.5 text-[10px] text-[#607068]"><Link2 className="size-3.5 text-[#176b52]" />{fact.sourceReferences.length} 个原始来源</div>
                      {expanded ? <ChevronUp className="size-4 text-[#85908a]" /> : <ChevronDown className="size-4 text-[#85908a]" />}
                    </button>
                    {expanded ? (
                      <div className="border-t border-[#edf0ee] bg-[#f8faf9] px-5 py-4 sm:pl-[68px]">
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[#76817b]">来源链路</p>
                        <div className="grid gap-2 lg:grid-cols-2">
                          {fact.sourceReferences.map((source) => (
                            <div key={source.id} className="flex items-start gap-3 rounded-xl border border-[#dfe5e2] bg-white p-3.5">
                              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                                {source.fileName.endsWith(".xlsx") ? <FileSpreadsheet className="size-4" /> : <FileText className="size-4" />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="break-all text-[11px] font-semibold text-[#344139]">{source.fileName}</p>
                                  {project.sources.some((item) => item.id === source.sourceId && item.fileId) ? <button onClick={() => showSource(source.sourceId)} className="shrink-0 text-[11px] font-semibold text-[#176b52] hover:underline">查看原文件</button> : null}
                                </div>
                                <p className="mt-1 text-[10px] font-medium text-[#758079]">定位：{source.locator}</p>
                                <p className="mt-1.5 break-words text-[10px] leading-4 text-[#8b9490]">“{source.excerpt}”</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 rounded-xl border border-[#dfe5e2] bg-white p-3.5">
                          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-semibold text-[#4c5d53]">更新事实值</p><p className="mt-1 text-[9px] text-[#8a958f]">保存项目后自动增加事实修订号；已引用正文仅标记待更新，不自动改写。</p></div><StatusBadge tone="gray">当前 v{fact.revision}</StatusBadge></div>
                          <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_110px_150px_auto]">
                            <input aria-label={`${fact.name}数值`} value={factDrafts[fact.id]?.value ?? fact.value} onChange={(event) => updateFactDraft(fact.id, fact, { value: event.target.value })} className="h-9 rounded-lg border border-[#dce3df] px-3 text-xs outline-none focus:border-[#78a28f]" />
                            <input aria-label={`${fact.name}单位`} value={factDrafts[fact.id]?.unit ?? fact.unit ?? ""} onChange={(event) => updateFactDraft(fact.id, fact, { unit: event.target.value })} className="h-9 rounded-lg border border-[#dce3df] px-3 text-xs outline-none focus:border-[#78a28f]" />
                            <input aria-label={`${fact.name}报告期`} value={factDrafts[fact.id]?.period ?? fact.period} onChange={(event) => updateFactDraft(fact.id, fact, { period: event.target.value })} className="h-9 rounded-lg border border-[#dce3df] px-3 text-xs outline-none focus:border-[#78a28f]" />
                            <button disabled={!factDrafts[fact.id]} onClick={() => applyFactDraft(fact.id)} className="h-9 rounded-lg bg-[#176b52] px-3 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">应用更新</button>
                          </div>
                          <div className="mt-2 grid gap-2 lg:grid-cols-[minmax(0,1fr)_170px]">
                            <input aria-label={`${fact.name}统计边界`} value={factDrafts[fact.id]?.reportingBoundary ?? fact.reportingBoundary ?? ""} onChange={(event) => updateFactDraft(fact.id, fact, { reportingBoundary: event.target.value })} placeholder="请填写该指标经核验的统计边界" className="h-9 rounded-lg border border-[#dce3df] px-3 text-xs outline-none focus:border-[#78a28f]" />
                            <div className="flex h-9 items-center justify-center rounded-lg border border-[#dce3df] bg-[#f8faf9] text-[10px] text-[#65746b]">边界：{fact.boundaryStatus ?? "待核验"} · 来源：{fact.sourceConfirmationStatus ?? "待确认"}</div>
                          </div>
                        </div>
                        {fact.confirmedBy ? <p className="mt-3 inline-flex items-center gap-1.5 text-[9px] text-[#87918c]"><CheckCircle2 className="size-3 text-[#27805f]" />由 {fact.confirmedBy} 人工确认</p> : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      ) : null}

      <StepFooter currentStep={3} />

      {intakeMode ? (
        <div className="fixed inset-0 z-[60] flex justify-end bg-[#10241c]/40 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="intake-title" onMouseDown={(event) => !intakeBusy && event.target === event.currentTarget && resetIntake()}>
          <div className="h-full w-full max-w-[480px] overflow-y-auto bg-white shadow-2xl animate-fade-up">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#e5e9e7] bg-white px-6 py-5">
              <div>
                <span className="mb-3 grid size-10 place-items-center rounded-xl bg-[#eaf4ef] text-[#176b52]">{intakeMode === "upload" ? <UploadCloud className="size-5" /> : <MessageSquareText className="size-5" />}</span>
                <h2 id="intake-title" className="text-base font-semibold text-[#1d2a23]">{intakeMode === "upload" ? "上传资料文件" : "在线补充资料"}</h2>
                <p className="mt-1 text-[11px] text-[#7f8a84]">{intakeMode === "upload" ? "文件保存到本地，可在解析工作台查阅原文。" : "保存后可在资料详情核对并人工确认。"}</p>
              </div>
              <button disabled={intakeBusy} onClick={resetIntake} className="grid size-8 place-items-center rounded-lg text-[#7c8781] hover:bg-[#f1f4f2]" aria-label="关闭"><X className="size-4" /></button>
            </div>
            <div className="space-y-5 p-6">
              <div>
                <label htmlFor="requirement-select" className="mb-2 block text-[11px] font-semibold text-[#3a4740]">关联资料项</label>
                <select id="requirement-select" value={effectiveRequirementId} onChange={(event) => setSelectedRequirementId(event.target.value)} className="h-10 w-full rounded-lg border border-[#dce3df] bg-white px-3 text-xs outline-none focus:border-[#78a28f]">
                  <option value="">暂不关联资料项</option>
                  {dataRequirements.map((item) => <option key={item.id} value={item.id}>{item.itemName}</option>)}
                </select>
              </div>
              {intakeMode === "upload" ? (
                <>
                  <div className="rounded-xl border border-dashed border-[#9db8ab] bg-[#f5faf7] px-6 py-10 text-center">
                    <span className="mx-auto grid size-11 place-items-center rounded-xl bg-white text-[#176b52] shadow-sm"><UploadCloud className="size-5" /></span>
                    <p className="mt-4 text-xs font-semibold text-[#34423a]">拖拽文件至此，或点击选择</p>
                    <p className="mt-1.5 text-[10px] leading-4 text-[#849089]">支持 XLSX、XLS、PDF、DOCX；可直接沿用企业现有 Excel 模板</p>
                    <label className="mt-4 inline-flex h-8 cursor-pointer items-center rounded-lg border border-[#d4ded9] bg-white px-3 text-[10px] font-semibold text-[#526159]">选择文件<input type="file" aria-label="选择资料文件" accept=".xlsx,.xls,.pdf,.docx" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleIntakeFile(file); event.target.value = ""; }} /></label>
                    {selectedFile ? <p className="mt-3 text-[10px] font-semibold text-[#176b52]">已选择：{selectedFile.name} · {selectedFile.size}</p> : null}
                  </div>
                  <Notice tone="info">提交后文件保持“待解析”；只有真实 Parser 成功运行后才生成单元格、页码及候选，且候选不会自动入库。</Notice>
                </>
              ) : (
                <>
                  <div>
                    <label htmlFor="supplement-title" className="mb-2 block text-[11px] font-semibold text-[#3a4740]">补充标题</label>
                    <input id="supplement-title" value={supplementTitle} onChange={(event) => setSupplementTitle(event.target.value)} className="h-10 w-full rounded-lg border border-[#dce3df] px-3 text-xs outline-none focus:border-[#78a28f]" />
                  </div>
                  <div>
                    <label htmlFor="supplement-content" className="mb-2 block text-[11px] font-semibold text-[#3a4740]">资料内容</label>
                    <textarea id="supplement-content" rows={8} value={supplementContent} onChange={(event) => setSupplementContent(event.target.value)} placeholder="请按企业实际情况补充项目背景、实施范围、年度进展与成效……" className="w-full resize-none rounded-lg border border-[#dce3df] p-3 text-xs leading-6 outline-none placeholder:text-[#a0aaa4] focus:border-[#78a28f]" />
                  </div>
                  <div className="rounded-xl border border-[#e1e6e3] bg-[#f8faf9] p-4">
                    <p className="text-[10px] font-semibold text-[#4a5750]">来源记录</p>
                    <p className="mt-1.5 text-[10px] leading-5 text-[#849089]">提交后将记录填写人、填写时间与对应表单字段，作为事实来源链路的一部分。</p>
                  </div>
                </>
              )}
              {intakeError ? <p role="alert" className="text-[10px] text-rose-600">{intakeError}</p> : null}
            </div>
            <div className="sticky bottom-0 mt-auto flex justify-end gap-2 border-t border-[#e5e9e7] bg-[#fafbf9] px-6 py-4">
              <button disabled={intakeBusy} onClick={resetIntake} className="h-9 rounded-lg border border-[#dce3df] bg-white px-4 text-[11px] font-semibold text-[#5b6861]">取消</button>
              <button disabled={intakeBusy || saving || !ready} onClick={() => void submitIntake()} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#176b52] px-4 text-[11px] font-semibold text-white">保存来源记录<ArrowRight className="size-3.5" /></button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
