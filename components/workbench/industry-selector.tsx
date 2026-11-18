"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import type { Enterprise } from "@/lib/types/esg";
import { getIndustry, industryChildren, industryPath, industrySelection, searchIndustries } from "@/lib/industry/classification";

const selectClass = "h-10 min-w-0 w-full rounded-lg border border-[#dce3df] bg-white px-3 text-xs text-[#29362f] outline-none focus:border-[#69a28b]";
type Mode = "primary" | "other";

export function IndustrySelector({ enterprise, onChange }: { enterprise: Enterprise; onChange: (next: Enterprise) => void }) {
  const [mode, setMode] = useState<Mode>("primary");
  const [draftCode, setDraftCode] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const path = industryPath(draftCode);
  const matches = useMemo(() => searchIndustries(query), [query]);
  const primary = enterprise.primaryIndustry ?? industrySelection(enterprise.industryCode);
  const others = enterprise.otherIndustries ?? [];
  const selected = getIndustry(draftCode);

  function choose(code: string) {
    const item = industrySelection(code);
    if (!item) return;
    if (mode === "primary") {
      onChange({ ...enterprise, industryCode: item.code, industryName: item.name, primaryIndustry: item,
        otherIndustries: others.filter((entry) => entry.code !== item.code) });
      setMessage(`主营行业已设置为 ${item.code} · ${item.name}`);
    } else {
      if (item.code === getIndustry(enterprise.industryCode)?.code || others.some((entry) => entry.code === item.code)) {
        setMessage("该行业已选择，请勿重复添加。");
        return;
      }
      onChange({ ...enterprise, otherIndustries: [...others, item] });
      setMessage(`已添加其他经营行业 ${item.code} · ${item.name}`);
    }
    setQuery("");
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#dce5df] bg-[#f6faf7] p-3 text-xs text-[#40584a]">
        <span className="font-semibold">主营行业（必选）：</span>{primary ? `${enterprise.industryCode} · ${enterprise.industryName}` : "尚未选择"}
        {primary ? <p className="mt-1 text-[11px] text-[#69796e]">{industryPath(primary.code).map((item) => `${item.code} ${item.name}`).join(" → ")}</p> : null}
      </div>
      {others.length ? <div className="flex flex-wrap gap-2">{others.map((item) => <span key={item.code} className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#d8e6dd] bg-white px-2.5 py-1 text-[11px] text-[#315c48]">{item.code} · {item.name}<button type="button" aria-label={`删除其他行业 ${item.code}`} onClick={() => onChange({ ...enterprise, otherIndustries: others.filter((entry) => entry.code !== item.code) })}><X className="size-3.5" /></button></span>)}</div> : null}
      <div className="flex gap-2">
        {(["primary", "other"] as Mode[]).map((item) => <button key={item} type="button" onClick={() => { setMode(item); setMessage(""); }} className={`rounded-lg px-3 py-2 text-xs font-semibold ${mode === item ? "bg-[#176b52] text-white" : "border border-[#dce3df] bg-white text-[#536159]"}`}>{item === "primary" ? "设置主营行业" : "添加其他行业"}</button>)}
      </div>
      <div className="relative"><Search className="absolute left-3 top-3 size-4 text-[#87958b]" /><input aria-label="搜索行业代码或名称" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索行业代码或名称，例如 C26、26、软件" className={`${selectClass} pl-9`} /></div>
      {query.trim() ? <div className="max-h-44 overflow-y-auto rounded-lg border border-[#dce3df] bg-white" role="listbox" aria-label="行业搜索结果">
        {matches.length ? matches.map((item) => <button key={item.code} type="button" role="option" aria-selected={draftCode === item.code} onClick={() => { setDraftCode(item.code); setQuery(""); }} className="block w-full border-b border-[#eef2ef] px-3 py-2 text-left text-xs hover:bg-[#f3f8f5]">{item.code} · {item.name}<span className="ml-2 text-[10px] text-[#89978d]">{["", "门类", "大类", "中类", "小类"][item.level]}</span></button>) : <p className="p-3 text-xs text-[#87918c]">未找到匹配行业</p>}
        {matches.length === 60 ? <p className="p-2 text-[10px] text-[#87918c]">结果较多，请输入更完整的代码或名称。</p> : null}
      </div> : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {([0, 1, 2, 3] as const).map((index) => {
          const parent = index === 0 ? null : path[index - 1]?.code;
          const options = parent === undefined ? [] : industryChildren(parent);
          return <div key={index} className="relative min-w-0"><select aria-label={["行业门类", "行业大类", "行业中类", "行业小类"][index]} value={path[index]?.code ?? ""} disabled={index > 0 && !parent} onChange={(event) => setDraftCode(event.target.value || (index ? path[index - 1]?.code ?? "" : ""))} className={`${selectClass} appearance-none pr-8 disabled:bg-[#f3f5f4]`}><option value="">选择{["门类", "大类", "中类", "小类"][index]}</option>{options.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2 top-3 size-4 text-[#87958b]" /></div>;
        })}
      </div>
      {selected ? <p className="text-[11px] text-[#66756b]">当前分类路径：{path.map((item) => `${item.code} ${item.name}`).join(" → ")}</p> : null}
      <button type="button" disabled={!selected} onClick={() => selected && choose(selected.code)} className="h-9 rounded-lg bg-[#176b52] px-4 text-xs font-semibold text-white disabled:opacity-45">{mode === "primary" ? "确认主营行业" : "添加该行业"}</button>
      {message ? <p role="status" className="text-[11px] text-[#52695b]">{message}</p> : null}
    </div>
  );
}
