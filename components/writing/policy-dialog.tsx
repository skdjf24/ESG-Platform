"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Settings2, ShieldCheck, X } from "lucide-react";
import type { WritingPolicy } from "@/lib/types/writing";

interface PolicyDialogProps {
  policy: WritingPolicy;
  onSave: (policy: WritingPolicy) => void;
  onClose: () => void;
}

export function PolicyDialog({ policy, onSave, onClose }: PolicyDialogProps) {
  const [draft, setDraft] = useState<WritingPolicy>(() => structuredClone(policy));
  const [terms, setTerms] = useState(policy.vagueTerms.join("、"));
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>("button")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); }
      if (event.key !== "Tab" || !dialog) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex='0']"));
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previousFocus?.focus(); };
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#10241c]/50 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="policy-dialog-title" className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[#e3eae6] p-5 sm:px-6">
          <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#edf6f1] text-[#176b52]"><Settings2 className="size-5" /></span><div><h2 id="policy-dialog-title" className="text-base font-semibold text-[#20362b]">Writing Policy · 写作规范</h2><p className="mt-1 text-xs leading-5 text-[#7c8a81]">当前报告统一使用的术语、语气与事实约束。</p></div></div>
          <button onClick={onClose} aria-label="关闭写作规范" className="grid size-8 place-items-center rounded-lg text-[#7b8981] hover:bg-[#f1f5f2]"><X className="size-4" /></button>
        </header>
        <div className="space-y-5 overflow-y-auto p-5 sm:p-6">
          <div className="flex gap-2.5 rounded-xl border border-[#cde1d5] bg-[#f0f7f3] p-3.5 text-xs leading-5 text-[#37634b]"><ShieldCheck className="mt-0.5 size-4 shrink-0" /><p>规范随 AI 任务一同传入。空泛表述检查仅采用词语匹配规则；完整语义审校尚未接入。</p></div>
          <div><label htmlFor="writing-tone" className="mb-2 block text-xs font-semibold text-[#455c4e]">默认语气</label><select id="writing-tone" value={draft.tone} onChange={(event) => setDraft({ ...draft, tone: event.target.value as WritingPolicy["tone"] })} className="h-10 w-full rounded-lg border border-[#dce5de] bg-white px-3 text-sm outline-none focus:border-[#70a58a]"><option>专业客观</option><option>简洁直接</option><option>审慎正式</option></select></div>
          <div><label htmlFor="writing-terminology" className="mb-2 block text-xs font-semibold text-[#455c4e]">企业术语与称谓</label><textarea id="writing-terminology" value={draft.terminology} onChange={(event) => setDraft({ ...draft, terminology: event.target.value })} rows={3} className="w-full resize-y rounded-lg border border-[#dce5de] px-3 py-2.5 text-sm leading-6 outline-none focus:border-[#70a58a]" /></div>
          <fieldset><legend className="mb-2 text-xs font-semibold text-[#455c4e]">写作规则</legend><div className="grid gap-2 sm:grid-cols-2">{draft.rules.map((rule) => <label key={rule.id} className="flex items-start gap-2.5 rounded-lg border border-[#e2e9e4] p-3 text-xs leading-5 text-[#52685b]"><input type="checkbox" checked={rule.enabled} onChange={(event) => setDraft({ ...draft, rules: draft.rules.map((item) => item.id === rule.id ? { ...item, enabled: event.target.checked } : item) })} className="mt-0.5 size-4 shrink-0 accent-[#176b52]" /><span>{rule.label}</span></label>)}</div></fieldset>
          <div><label htmlFor="writing-vague-terms" className="mb-2 block text-xs font-semibold text-[#455c4e]">空泛表述检查词</label><textarea id="writing-vague-terms" value={terms} onChange={(event) => setTerms(event.target.value)} rows={2} className="w-full resize-y rounded-lg border border-[#dce5de] px-3 py-2.5 text-sm leading-6 outline-none focus:border-[#70a58a]" /><p className="mt-1.5 text-[11px] text-[#8b978f]">用顿号、逗号或换行分隔。检查结果供人工判断，不等同于合规结论。</p></div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-[#e3eae6] bg-[#f9fbfa] px-5 py-4 sm:px-6"><button onClick={onClose} className="h-10 rounded-lg border border-[#dbe4de] bg-white px-4 text-xs font-semibold text-[#5b6e61] hover:bg-[#f4f7f5]">取消</button><button onClick={() => onSave({ ...draft, vagueTerms: [...new Set(terms.split(/[、,，\n]+/).map((term) => term.trim()).filter(Boolean))] })} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#176b52] px-4 text-xs font-semibold text-white hover:bg-[#10543f]"><Check className="size-3.5" />应用写作规范</button></footer>
      </div>
    </div>
  );
}
