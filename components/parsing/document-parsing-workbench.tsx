"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Download,
  FileSearch,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Replace,
  ShieldCheck,
  X,
} from "lucide-react";
import { candidateFromBlock, formatLocator } from "@/lib/parsing/candidate-utils";
import { applyCandidateConfirmation, rejectCandidate, type CandidateConfirmationDraft } from "@/lib/parsing/confirmation";
import { extractionCandidateRepository, parsedDocumentRepository } from "@/lib/parsing/repository";
import { DocumentParsingError, markProjectSourceNeedsReview, parseProjectFile, replaceProjectSourceFile } from "@/lib/parsing/service";
import { projectFileRepository } from "@/lib/project/repository";
import type { UploadedSource } from "@/lib/types/esg";
import type { ExtractionCandidate, ParsedBlock, ParsedDocument, ParserStatus } from "@/lib/types/parsing";
import type { ProjectFileRecord, ReportProjectData } from "@/lib/types/project-data";
import { useProjectData } from "@/components/project/project-data-provider";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";

const statusLabel: Record<ParserStatus, string> = {
  "not-started": "已保存 · 待解析",
  pending: "等待解析",
  parsing: "解析中",
  parsed: "解析完成",
  failed: "解析失败",
  stale: "需重新解析",
};
const inputClass = "h-9 w-full rounded-lg border border-[#dce3df] bg-white px-2.5 text-[10px] text-[#344239] outline-none focus:border-[#78a28f]";

const statusTone: Record<ParserStatus, "gray" | "blue" | "green" | "amber" | "red"> = {
  "not-started": "gray",
  pending: "blue",
  parsing: "blue",
  parsed: "green",
  failed: "red",
  stale: "amber",
};

function fileTypeFor(name: string): UploadedSource["fileType"] {
  const extension = name.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "PDF";
  if (extension === "docx") return "DOCX";
  return "XLSX";
}

function displaySize(size: number) {
  return size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;
}

function updateSourceFromDocument(project: ReportProjectData, document: ParsedDocument, candidates: ExtractionCandidate[]) {
  return {
    ...project,
    sources: project.sources.map((source) => source.id === document.sourceId ? {
      ...source,
      parserStatus: document.status,
      parserVersion: document.parserVersion,
      parsedAt: document.parsedAt,
      parseError: document.error,
      candidateCount: candidates.length,
      confirmedCandidateCount: candidates.filter((candidate) => candidate.status === "confirmed").length,
      state: document.status === "parsed" ? "已解析" as const : document.status === "parsing" ? "解析中" as const : "已上传" as const,
    } : source),
  };
}

function SourceIcon({ type }: { type: UploadedSource["fileType"] }) {
  return type === "XLSX" ? <FileSpreadsheet className="size-4" /> : <FileText className="size-4" />;
}

export function DocumentParsingWorkbench() {
  const { project, editProject, saveProject, setMessage } = useProjectData();
  const [documents, setDocuments] = useState<ParsedDocument[]>([]);
  const [candidates, setCandidates] = useState<ExtractionCandidate[]>([]);
  const [files, setFiles] = useState<ProjectFileRecord[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("");
  const [selectedBlockId, setSelectedBlockId] = useState<string>();
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>();
  const [draft, setDraft] = useState<CandidateConfirmationDraft | null>(null);
  const [busyFileId, setBusyFileId] = useState<string>();
  const [workbenchError, setWorkbenchError] = useState("");
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const sources = project.sources.filter((source) => source.fileId);
  const selectedSource = sources.find((source) => source.id === selectedSourceId) ?? sources[0];
  const selectedFile = files.find((file) => file.fileId === selectedSource?.fileId);
  const document = documents.find((item) => item.fileId === selectedSource?.fileId);
  const fileCandidates = candidates.filter((candidate) => candidate.fileId === selectedSource?.fileId);
  const selectedCandidate = fileCandidates.find((candidate) => candidate.candidateId === selectedCandidateId);
  const selectedBlock = document?.blocks.find((block) => block.blockId === selectedBlockId);

  const refreshArtifacts = useCallback(async () => {
    const [nextDocuments, nextCandidates, nextFiles] = await Promise.all([
      parsedDocumentRepository.listByProject(project.projectId),
      extractionCandidateRepository.listByProject(project.projectId),
      projectFileRepository.list(project.projectId),
    ]);
    setDocuments(nextDocuments);
    setCandidates(nextCandidates);
    setFiles(nextFiles);
  }, [project.projectId]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      void refreshArtifacts().catch((error) => {
        if (active) setWorkbenchError(error instanceof Error ? error.message : "解析仓库读取失败。");
      });
    });
    return () => { active = false; };
  }, [refreshArtifacts]);

  function selectSource(sourceId: string) {
    setSelectedSourceId(sourceId);
    setSelectedCandidateId(undefined);
    setSelectedBlockId(undefined);
    setDraft(null);
    setSelectedSegment("");
  }

  function selectCandidate(candidate: ExtractionCandidate) {
    setSelectedCandidateId(candidate.candidateId);
    setDraft({
      type: candidate.type,
      label: candidate.label,
      value: candidate.value,
      unit: candidate.unit ?? "",
      period: candidate.period ?? "",
      boundary: candidate.boundary ?? "",
      note: candidate.note ?? "",
    });
  }

  async function runParse() {
    if (!selectedSource?.fileId) return;
    setBusyFileId(selectedSource.fileId);
    setWorkbenchError("");
    try {
      const outcome = await parseProjectFile({
        projectId: project.projectId,
        fileId: selectedSource.fileId,
        sourceId: selectedSource.id,
        sourceKind: selectedSource.kind === "historical" ? "historical" : "current",
      });
      let base = outcome.parserVersionChanged ? markProjectSourceNeedsReview(project, selectedSource.id) : project;
      base = updateSourceFromDocument(base, outcome.document, outcome.candidates);
      editProject(base);
      await saveProject(4, outcome.parserVersionChanged ? "重新解析并标记来源复核" : "保存文件解析结果", base);
      setMessage(`已使用 ${outcome.document.parserVersion} 在浏览器本地解析；生成 ${outcome.candidates.length} 条规则候选，尚未自动入库。`);
    } catch (error) {
      const documentError = error instanceof DocumentParsingError ? error.document : undefined;
      const message = error instanceof Error ? error.message : "文件解析失败。";
      if (documentError) {
        const next = updateSourceFromDocument(project, documentError, fileCandidates);
        editProject(next);
        await saveProject(4, "记录文件解析失败", next);
      }
      setWorkbenchError(message);
    } finally {
      await refreshArtifacts();
      setBusyFileId(undefined);
    }
  }

  async function createManualCandidate(type: ExtractionCandidate["type"]) {
    if (!document || !selectedBlock) return;
    const candidate = candidateFromBlock(document, selectedBlock, type);
    const existing = await extractionCandidateRepository.get(candidate.candidateId);
    if (!existing) await extractionCandidateRepository.save(candidate);
    await refreshArtifacts();
    setSelectedCandidateId(candidate.candidateId);
    setDraft({ type: candidate.type, label: candidate.label, value: candidate.value, unit: candidate.unit ?? "", period: candidate.period ?? "", boundary: candidate.boundary ?? "", note: candidate.note ?? "" });
    setMessage(existing ? "相同来源位置的候选已存在，未重复创建。" : "已基于所选原始片段创建规则候选；需人工编辑并确认后才会入库。");
  }

  async function confirmCandidate() {
    if (!selectedCandidate || !draft) return;
    setWorkbenchError("");
    try {
      const result = applyCandidateConfirmation(project, selectedCandidate, draft);
      const next = {
        ...result.project,
        sources: result.project.sources.map((source) => source.id === selectedCandidate.sourceId ? {
          ...source,
          confirmedCandidateCount: fileCandidates.filter((candidate) => candidate.status === "confirmed" || candidate.candidateId === selectedCandidate.candidateId).length,
        } : source),
      };
      editProject(next);
      if (!await saveProject(4, `人工确认${draft.type === "metric" ? "指标" : "资料"}候选`, next)) return;
      await extractionCandidateRepository.save(result.candidate);
      await refreshArtifacts();
      setMessage(draft.type === "metric"
        ? "指标已人工确认并进入企业事实及 MetricObservation 链路；Step 5/6 可读取，Step 7 已按现有机制待复检。"
        : "候选已人工确认入库并保留 File → ParsedBlock → SourceReference 完整定位。");
    } catch (error) {
      setWorkbenchError(error instanceof Error ? error.message : "候选确认失败。");
    }
  }

  async function rejectSelectedCandidate() {
    if (!selectedCandidate) return;
    await extractionCandidateRepository.save(rejectCandidate(selectedCandidate));
    await refreshArtifacts();
    setMessage("候选已拒绝并保留审核记录；同文件、位置与内容重新解析时不会重复创建。");
  }

  async function replaceFile(file: File) {
    if (!selectedSource?.fileId) return;
    setBusyFileId(selectedSource.fileId);
    setWorkbenchError("");
    try {
      const result = await replaceProjectSourceFile({ projectId: project.projectId, fileId: selectedSource.fileId, sourceId: selectedSource.id, file });
      if (!result.changed) {
        setMessage("新文件校验和与现有文件一致，未创建伪版本或重复候选。");
        return;
      }
      const base = markProjectSourceNeedsReview(project, selectedSource.id);
      const next = {
        ...base,
        sources: base.sources.map((source) => source.id === selectedSource.id ? {
          ...source,
          name: file.name,
          fileType: fileTypeFor(file.name),
          mimeType: file.type,
          size: displaySize(file.size),
          parserStatus: "stale" as const,
          candidateCount: fileCandidates.length,
        } : source),
      };
      editProject(next);
      await saveProject(4, "替换原始资料并标记下游复核", next);
      await refreshArtifacts();
      setMessage("原始文件已替换；旧解析快照保留为 stale，已确认事实未被覆盖，相关下游内容已进入待复核。");
    } catch (error) {
      setWorkbenchError(error instanceof Error ? error.message : "文件替换失败。");
    } finally {
      setBusyFileId(undefined);
    }
  }

  async function downloadOriginal() {
    if (!selectedFile) return;
    const url = URL.createObjectURL(selectedFile.blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = selectedFile.name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const activeSegment = selectedSegment || (document?.parserType === "excel" ? `sheet:${document.sheetNames?.[0] ?? ""}` : document?.parserType === "pdf" ? "page:1" : "");
  const segmentBlocks = (() => {
    if (!document) return [];
    if (activeSegment.startsWith("page:")) {
      const page = Number(activeSegment.slice(5));
      return document.blocks.filter((block) => block.locator.page === page);
    }
    if (activeSegment.startsWith("heading:")) {
      const heading = activeSegment.slice(8);
      return document.blocks.filter((block) => block.locator.headingPath?.join(" > ").startsWith(heading));
    }
    return document.blocks.filter((block) => block.kind !== "cell");
  })();

  return (
    <div className="space-y-4">
      <Notice tone="info" title="真实本地解析 · 人工确认后入库">
        文件内容仅在当前浏览器解析，不上传第三方。Excel 候选来自可复现表头规则，不是 AI；DOCX/PDF 由用户选择原文片段创建候选。
      </Notice>
      {workbenchError ? <Notice tone="warning" title="可恢复的解析错误">{workbenchError} 可修正文件后点击“重新解析”，项目其余页面不受影响。</Notice> : null}
      <div className="grid min-h-[650px] overflow-hidden rounded-2xl border border-[#dfe6e2] bg-white shadow-sm xl:grid-cols-[260px_minmax(0,1fr)_330px]">
        <aside className="border-b border-[#e4e9e6] bg-[#f8faf9] xl:border-b-0 xl:border-r">
          <div className="border-b border-[#e4e9e6] px-4 py-4">
            <p className="text-xs font-semibold text-[#2c3932]">文件与结构导航</p>
            <p className="mt-1 text-[10px] text-[#829089]">按项目隔离的原始文件</p>
          </div>
          <div className="max-h-[300px] overflow-y-auto p-2 xl:max-h-none">
            {sources.length ? sources.map((source) => {
              const active = source.id === selectedSource?.id;
              const file = files.find((item) => item.fileId === source.fileId);
              const status = file?.parserStatus ?? source.parserStatus ?? "not-started";
              return (
                <button key={source.id} onClick={() => selectSource(source.id)} className={`mb-1 w-full rounded-xl border p-3 text-left transition ${active ? "border-[#9fc4b4] bg-white shadow-sm" : "border-transparent hover:bg-white"}`}>
                  <div className="flex items-start gap-2.5">
                    <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${source.fileType === "XLSX" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}><SourceIcon type={source.fileType} /></span>
                    <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-[#344239]">{source.name}</p><p className="mt-1 text-[9px] text-[#85918a]">{source.kind === "historical" ? "历史资料" : "本期资料"} · r{file?.revision ?? 1}</p></div>
                  </div>
                  <div className="mt-2"><StatusBadge tone={statusTone[status]}>{statusLabel[status]}</StatusBadge></div>
                </button>
              );
            }) : <p className="p-4 text-[11px] leading-5 text-[#87928c]">尚无真实文件。请先在“上传资料”中保存 XLSX、DOCX 或 PDF。</p>}
          </div>
          {document?.status === "parsed" ? (
            <div className="border-t border-[#e4e9e6] p-3">
              <p className="mb-2 px-1 text-[9px] font-semibold uppercase tracking-wider text-[#7c8982]">解析结构</p>
              {document.parserType === "excel" ? document.sheetNames?.map((sheet) => <SegmentButton key={sheet} active={activeSegment === `sheet:${sheet}`} onClick={() => setSelectedSegment(`sheet:${sheet}`)}>{sheet}</SegmentButton>) : null}
              {document.parserType === "pdf" ? Array.from({ length: document.pageCount ?? 0 }, (_, index) => index + 1).map((page) => <SegmentButton key={page} active={activeSegment === `page:${page}`} onClick={() => setSelectedSegment(`page:${page}`)}>第 {page} 页</SegmentButton>) : null}
              {document.parserType === "docx" ? document.blocks.filter((block) => block.kind === "heading").map((block) => {
                const path = block.locator.headingPath?.join(" > ") ?? block.text;
                return <SegmentButton key={block.blockId} active={activeSegment === `heading:${path}`} onClick={() => setSelectedSegment(`heading:${path}`)}>{block.text}</SegmentButton>;
              }) : null}
            </div>
          ) : null}
        </aside>

        <main className="min-w-0 border-b border-[#e4e9e6] xl:border-b-0 xl:border-r">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e4e9e6] px-5 py-4">
            <div><p className="text-sm font-semibold text-[#26342c]">{selectedSource?.name ?? "解析结果"}</p><p className="mt-1 text-[10px] text-[#7e8a83]">{selectedFile ? `SHA-256 ${selectedFile.checksum.slice(0, 12)}… · ${displaySize(selectedFile.size)}` : "请选择文件"}</p></div>
            {selectedSource?.fileId ? (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => void downloadOriginal()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dce3df] px-2.5 text-[10px] font-semibold text-[#58675e]"><Download className="size-3.5" />原始文件</button>
                <input ref={replaceInputRef} type="file" className="sr-only" aria-label="替换来源文件" accept=".xlsx,.xls,.docx,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void replaceFile(file); event.target.value = ""; }} />
                <button onClick={() => replaceInputRef.current?.click()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dce3df] px-2.5 text-[10px] font-semibold text-[#58675e]"><Replace className="size-3.5" />替换文件</button>
                <button disabled={busyFileId === selectedSource.fileId} onClick={() => void runParse()} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#176b52] px-3 text-[10px] font-semibold text-white disabled:opacity-60">{busyFileId === selectedSource.fileId ? <LoaderCircle className="size-3.5 animate-spin" /> : document ? <RefreshCw className="size-3.5" /> : <FileSearch className="size-3.5" />}{document ? "重新解析" : "开始解析"}</button>
              </div>
            ) : null}
          </div>
          <div className="max-h-[720px] min-h-[540px] overflow-auto p-5">
            {!selectedSource ? <EmptyState title="尚无来源文件" detail="上传文件后可在此执行真实浏览器解析。" /> : null}
            {selectedSource && (!document || document.status === "pending" || document.status === "parsing") ? <EmptyState title={document?.status === "parsing" ? "正在解析" : "等待解析"} detail="原始文件仍是唯一证据源；解析前不会生成任何事实。" loading={document?.status === "parsing"} /> : null}
            {document?.status === "failed" ? <EmptyState title="解析失败" detail={document.error ?? "文件可能损坏或格式不受支持。"} error /> : null}
            {document?.status === "stale" ? <EmptyState title="旧解析结果已失效" detail="原始文件版本已变化；旧快照保留，但不能作为新候选确认依据。请重新解析。" error /> : null}
            {document?.status === "parsed" && document.documentClassification === "scan-suspected" ? <Notice tone="warning" title="可能为扫描型 PDF">未检测到可直接读取文本。本阶段没有 OCR，不会伪装为已识别内容。</Notice> : null}
            {document?.status === "parsed" && document.parserType === "excel" ? <ExcelPreview document={document} sheet={activeSegment.replace(/^sheet:/, "")} onSelectBlock={setSelectedBlockId} selectedBlockId={selectedBlockId} /> : null}
            {document?.status === "parsed" && document.parserType !== "excel" ? (
              <div className="space-y-3">
                {segmentBlocks.map((block) => <ParsedBlockCard key={block.blockId} block={block} selected={block.blockId === selectedBlockId} onSelect={() => setSelectedBlockId(block.blockId)} />)}
                {!segmentBlocks.length ? <EmptyState title="该位置没有可读取文本" detail="可查看其他页面/章节；扫描件需在 Phase 2.1 OCR 后处理。" /> : null}
              </div>
            ) : null}
          </div>
          {document?.status === "parsed" ? <div className="flex flex-wrap items-center gap-4 border-t border-[#e4e9e6] bg-[#fafcfb] px-5 py-3 text-[9px] text-[#75827b]"><span>Parser：{document.parserVersion}</span><span>块：{document.blocks.length}</span><span>表：{document.tables.length}</span><span>解析：{document.parsedAt?.slice(0, 19).replace("T", " ")}</span></div> : null}
        </main>

        <aside className="min-w-0 bg-[#fbfcfb]">
          <div className="border-b border-[#e4e9e6] px-4 py-4"><p className="text-xs font-semibold text-[#2c3932]">候选与人工确认</p><p className="mt-1 text-[10px] text-[#829089]">候选 {fileCandidates.length} · 已确认 {fileCandidates.filter((item) => item.status === "confirmed").length}</p></div>
          <div className="max-h-[720px] overflow-y-auto p-4">
            {fileCandidates.length ? (
              <div className="mb-4 space-y-1.5">
                {fileCandidates.map((candidate) => (
                  <button key={candidate.candidateId} onClick={() => selectCandidate(candidate)} className={`w-full rounded-lg border px-3 py-2.5 text-left ${selectedCandidate?.candidateId === candidate.candidateId ? "border-[#9fc4b4] bg-white" : "border-[#e2e7e4] bg-[#fafbf9]"}`}>
                    <div className="flex items-center justify-between gap-2"><span className="truncate text-[10px] font-semibold text-[#3c4a42]">{candidate.label}</span><StatusBadge tone={candidate.status === "confirmed" ? "green" : candidate.status === "rejected" ? "red" : candidate.status === "needs-review" ? "amber" : "blue"}>{candidate.status}</StatusBadge></div>
                    <p className="mt-1 truncate text-[9px] text-[#87928c]">{candidate.type} · {formatLocator(candidate.sourceLocator)}</p>
                  </button>
                ))}
              </div>
            ) : null}
            {!selectedCandidate && selectedBlock ? (
              <div className="rounded-xl border border-[#dce4df] bg-white p-4">
                <p className="text-[11px] font-semibold text-[#35433b]">从所选原文创建候选</p><p className="mt-2 line-clamp-4 text-[10px] leading-5 text-[#718078]">{selectedBlock.text}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">{(["fact", "metric", "policy", "case"] as const).map((type) => <button key={type} onClick={() => void createManualCandidate(type)} className="h-8 rounded-lg border border-[#dce3df] text-[10px] font-semibold text-[#4f5f56]">创建{type === "fact" ? "事实" : type === "metric" ? "指标" : type === "policy" ? "制度" : "案例"}候选</button>)}</div>
              </div>
            ) : null}
            {!selectedCandidate && !selectedBlock ? <EmptyState title="选择候选或原文片段" detail="Excel 会按表头规则生成候选；DOCX/PDF 需先选择原文。" /> : null}
            {selectedCandidate && draft ? (
              <div className="space-y-3">
                {selectedBlock ? <button onClick={() => { setSelectedCandidateId(undefined); setDraft(null); }} className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-[#b8d0c5] bg-white text-[10px] font-semibold text-[#176b52]"><FileSearch className="size-3.5" />基于当前所选片段新增候选</button> : null}
                {selectedCandidate.sourceKind === "historical" ? <Notice tone="warning">历史报告候选只会写入“历史事实/历史资料”，不会自动作为本年度事实。</Notice> : null}
                <Field label="候选类型"><select aria-label="候选类型" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as CandidateConfirmationDraft["type"] })} className={inputClass}><option value="fact">事实</option><option value="metric">指标</option><option value="policy">制度</option><option value="case">案例</option></select></Field>
                <Field label="名称"><input aria-label="候选名称" value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} className={inputClass} /></Field>
                <Field label="值 / 内容"><textarea aria-label="候选值" rows={3} value={String(draft.value ?? "")} onChange={(event) => setDraft({ ...draft, value: event.target.value })} className={`${inputClass} h-auto py-2`} /></Field>
                <div className="grid grid-cols-2 gap-2"><Field label="单位"><input aria-label="候选单位" value={draft.unit ?? ""} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} className={inputClass} /></Field><Field label="期间"><input aria-label="候选期间" value={draft.period ?? ""} onChange={(event) => setDraft({ ...draft, period: event.target.value })} className={inputClass} /></Field></div>
                <Field label="统计边界"><input aria-label="候选统计边界" value={draft.boundary ?? ""} onChange={(event) => setDraft({ ...draft, boundary: event.target.value })} placeholder="需由用户核验" className={inputClass} /></Field>
                <Field label="人工备注"><textarea aria-label="候选备注" rows={2} value={draft.note ?? ""} onChange={(event) => setDraft({ ...draft, note: event.target.value })} className={`${inputClass} h-auto py-2`} /></Field>
                <div className="rounded-lg border border-[#e0e6e2] bg-white p-3 text-[9px] leading-4 text-[#6e7b74]"><p className="font-semibold text-[#4a5a51]"><MapPin className="mr-1 inline size-3" />来源定位</p><p className="mt-1">{formatLocator(selectedCandidate.sourceLocator)}</p><p className="mt-1 line-clamp-3">“{selectedCandidate.excerpt}”</p></div>
                <div className="grid grid-cols-2 gap-2"><button onClick={() => void rejectSelectedCandidate()} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#dce3df] text-[10px] font-semibold text-[#68756e]"><X className="size-3.5" />拒绝</button><button disabled={selectedCandidate.status === "rejected"} onClick={() => void confirmCandidate()} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#176b52] text-[10px] font-semibold text-white disabled:opacity-40"><Check className="size-3.5" />人工确认入库</button></div>
                {selectedCandidate.status === "confirmed" ? <p className="flex items-center gap-1.5 text-[9px] text-[#27805f]"><ShieldCheck className="size-3.5" />已人工确认：{selectedCandidate.confirmedEntityId}</p> : null}
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

function SegmentButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`mb-1 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[10px] ${active ? "bg-[#e7f2ed] font-semibold text-[#176b52]" : "text-[#627068] hover:bg-white"}`}><span className="truncate">{children}</span><ChevronRight className="size-3" /></button>;
}

function EmptyState({ title, detail, loading, error }: { title: string; detail: string; loading?: boolean; error?: boolean }) {
  return <div className="grid min-h-64 place-items-center text-center"><div><span className={`mx-auto grid size-12 place-items-center rounded-2xl ${error ? "bg-rose-50 text-rose-600" : "bg-[#edf4f0] text-[#176b52]"}`}>{loading ? <LoaderCircle className="size-5 animate-spin" /> : error ? <AlertTriangle className="size-5" /> : <FileSearch className="size-5" />}</span><p className="mt-4 text-xs font-semibold text-[#35433b]">{title}</p><p className="mx-auto mt-2 max-w-sm text-[10px] leading-5 text-[#7e8b84]">{detail}</p></div></div>;
}

function ParsedBlockCard({ block, selected, onSelect }: { block: ParsedBlock; selected: boolean; onSelect: () => void }) {
  return <button onClick={onSelect} className={`w-full rounded-xl border p-4 text-left transition ${selected ? "border-[#76a48f] bg-[#f5faf7] ring-1 ring-[#176b52]/10" : "border-[#e0e6e2] bg-white hover:border-[#b9cbc2]"}`}><div className="flex items-center justify-between gap-3"><span className="text-[9px] font-semibold uppercase tracking-wider text-[#7c8982]">{block.kind}</span><span className="text-[9px] text-[#8a958f]">{formatLocator(block.locator)}</span></div><p className={`${block.kind === "heading" ? "text-sm font-semibold" : "text-[11px] leading-6"} mt-2 whitespace-pre-wrap text-[#35433b]`}>{block.text || "（无可读取文本）"}</p></button>;
}

function ExcelPreview({ document, sheet, onSelectBlock, selectedBlockId }: { document: ParsedDocument; sheet: string; onSelectBlock: (id: string) => void; selectedBlockId?: string }) {
  const table = document.tables.find((item) => item.sheet === sheet) ?? document.tables[0];
  if (!table) return <EmptyState title="空工作簿" detail="未检测到可预览工作表。" />;
  const rows = table.rows.slice(0, 60);
  const columnCount = Math.min(30, Math.max(0, ...rows.map((row) => row.length)));
  return <div><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold text-[#344239]">{table.name}</p><p className="mt-1 text-[9px] text-[#7d8982]">{table.range} · 合并区域 {table.mergedRanges.length} · 原始值预览</p></div><StatusBadge tone="green">真实解析</StatusBadge></div><div className="overflow-auto rounded-xl border border-[#dfe5e2]"><table className="workbench-data-table font-mono"><thead><tr className="bg-[#eef2f0] text-[#66736c]"><th className="sticky left-0 z-10 border-b border-r px-2 py-2">#</th>{Array.from({ length: columnCount }, (_, index) => <th key={index} className="min-w-24 border-b border-r px-2 py-2">{String.fromCharCode(65 + index)}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="odd:bg-white even:bg-[#fafcfb]"><th className="sticky left-0 border-b border-r bg-[#f1f4f2] px-2 py-2 text-[#7d8982]">{rowIndex + 1}</th>{Array.from({ length: columnCount }, (_, columnIndex) => { const cell = row[columnIndex]; const block = document.blocks.find((item) => item.kind === "cell" && item.locator.sheet === table.sheet && item.locator.row === rowIndex + 1 && item.locator.column === columnIndex + 1); return <td key={columnIndex} title={cell ? formatLocator(cell.locator) : undefined} onClick={() => block && onSelectBlock(block.blockId)} className={`cursor-pointer border-b border-r px-2 py-2 text-[#445149] ${block?.blockId === selectedBlockId ? "bg-amber-100 ring-1 ring-inset ring-amber-300" : "hover:bg-emerald-50"}`}>{cell?.text ?? ""}{cell?.formula ? <span className="ml-1 text-violet-600">ƒ</span> : null}</td>; })}</tr>)}</tbody></table></div>{table.rows.length > rows.length ? <p className="mt-2 text-[9px] text-amber-700">界面仅预览前 {rows.length} 行；全部非空单元格仍已解析并保存在结构化结果中。</p> : null}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[9px] font-semibold text-[#65736b]">{label}</span>{children}</label>;
}
