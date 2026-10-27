"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, LoaderCircle, RefreshCw, ShieldCheck, Sparkles, X } from "lucide-react";
import { operationLabels } from "@/lib/writing/mock-ai";
import type { AiTaskProvider, AiTaskRequest, AiTaskResponse } from "@/lib/types/writing";

interface AiDialogProps {
  request: AiTaskRequest;
  provider: AiTaskProvider;
  onAccept: (response: AiTaskResponse) => void;
  onClose: () => void;
}

export function AiDialog(props: AiDialogProps) {
  // A different source revision or selection creates a new session. Suggestions
  // from the previous source can never be accepted against newer content.
  return <AiSession key={JSON.stringify(props.request)} {...props} />;
}

function AiSession({ request, provider, onAccept, onClose }: AiDialogProps) {
  const [response, setResponse] = useState<AiTaskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>("button")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
      if (event.key !== "Tab" || !dialog) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex='0']"));
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      controllerRef.current?.abort();
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, []);

  async function generate() {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setResponse(null);
    setReviewed(false);
    setError("");
    try {
      const result = await provider.run(request, controller.signal);
      if (!controller.signal.aborted && controllerRef.current === controller) setResponse(result);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "示例任务未完成，请重试。");
    } finally {
      if (!controller.signal.aborted && controllerRef.current === controller) setLoading(false);
    }
  }

  const confirmedCount = request.facts.filter((fact) => fact.state === "已确认").length;
  const canAccept = Boolean(response && response.taskId === request.taskId && reviewed && !loading);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#10241c]/50 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="ai-dialog-title" className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/30 bg-[#f7faf8] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[#e1e8e4] bg-white p-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600"><Sparkles className="size-5" /></span>
            <div>
              <div className="flex flex-wrap items-center gap-2"><h2 id="ai-dialog-title" className="text-base font-semibold text-[#20362b]">{operationLabels[request.operation]}</h2><span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">{provider.label}</span></div>
              <p className="mt-1 text-xs leading-5 text-[#728179]">{request.chapter.order} {request.chapter.title} · {request.selectedText ? "仅处理选中文字" : request.blockId ? "当前内容块" : "当前章节"}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="关闭 AI 对照" className="grid size-8 shrink-0 place-items-center rounded-lg text-[#7b8981] hover:bg-[#f1f5f2]"><X className="size-4" /></button>
        </header>

        <div className="overflow-y-auto p-5 sm:p-6">
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs leading-5 text-violet-800"><Sparkles className="mt-0.5 size-4 shrink-0" /><p>{provider.mode === "mock" ? "本轮使用固定规则与 Mock 响应演示流程，未接入真实 AI。" : "当前建议由已配置的 AI 服务生成。"}建议不会自动写入正文，请对照来源核验数值、统计口径与时间范围后接受。</p></div>
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[#63766b]"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-[#176b52]" />Writing Policy：{request.policy.tone}</span><span>已确认事实 {confirmedCount} 条</span><span>关联披露要求 {request.requirementIds.length} 项</span></div>
          <div className="grid gap-4 md:grid-cols-2">
            <section className="overflow-hidden rounded-xl border border-[#dfe7e2] bg-white">
              <div className="flex items-center justify-between border-b border-[#e9eeeb] bg-[#f7f9f8] px-4 py-3"><h3 className="text-xs font-semibold text-[#58695e]">原文</h3><span className="text-[10px] text-[#8a978f]">{request.selectedText ? "选中范围" : "保留原文"}</span></div>
              <div className="min-h-52 whitespace-pre-wrap break-words px-4 py-4 text-[13px] leading-7 text-[#44584b]">{request.selectedText || request.sourceText || "该章节暂无正文，可生成初稿结构。"}</div>
            </section>
            <section aria-live="polite" className="overflow-hidden rounded-xl border border-[#b9d8ca] bg-white">
              <div className="flex items-center justify-between border-b border-[#dceae3] bg-[#edf7f1] px-4 py-3"><h3 className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#176b52]"><Sparkles className="size-3.5" />{response?.label ?? provider.label}</h3><ArrowRight className="size-3.5 text-[#5f9a81]" /></div>
              {loading ? <div className="flex min-h-52 items-center justify-center gap-2 text-xs text-[#6b8174]"><LoaderCircle className="size-4 animate-spin" />正在运行示例任务…</div> : response ? <div className="min-h-52 whitespace-pre-wrap break-words px-4 py-4 text-[13px] leading-7 text-[#284c39]">{response.suggestion}</div> : <div className="flex min-h-52 flex-col items-center justify-center gap-2 px-6 text-center"><Sparkles className="size-7 text-[#bfd2c7]" /><p className="text-xs leading-6 text-[#8a9a90]">点击“生成”查看建议版本。<br />原文将保留至您明确接受。</p></div>}
            </section>
          </div>
          {error ? <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p> : null}
          {response?.warnings.length ? <ul className="mt-4 list-disc space-y-1 rounded-xl border border-amber-200 bg-amber-50 py-3 pl-8 pr-4 text-[11px] leading-5 text-amber-800">{response.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul> : null}
          {response ? <label className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#dfe7e2] bg-white p-3.5 text-xs leading-5 text-[#53675b]"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} className="mt-0.5 size-4 accent-[#176b52]" /><span>我已检查建议与原始资料的一致性，确认将建议应用到本次选择的范围。</span></label> : null}
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-[#e1e8e4] bg-white px-5 py-4 sm:px-6">
          <button onClick={onClose} className="h-10 rounded-lg border border-[#dbe4de] px-4 text-xs font-semibold text-[#5b6e61] hover:bg-[#f4f7f5]">取消</button>
          <button onClick={generate} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#c8dbd0] bg-[#f1f8f4] px-4 text-xs font-semibold text-[#176b52] hover:bg-[#e5f2eb] disabled:opacity-50">{loading ? <LoaderCircle className="size-3.5 animate-spin" /> : response ? <RefreshCw className="size-3.5" /> : <Sparkles className="size-3.5" />}{response ? "重新生成" : "生成"}</button>
          <button onClick={() => { if (canAccept && response) onAccept(response); }} disabled={!canAccept} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#176b52] px-4 text-xs font-semibold text-white hover:bg-[#10543f] disabled:cursor-not-allowed disabled:opacity-40"><Check className="size-3.5" />接受建议</button>
        </footer>
      </div>
    </div>
  );
}
