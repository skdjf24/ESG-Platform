"use client";

import { BarChart3, Check, CircleDashed, FileText, GripVertical, Heading2, Layers3, Link2, ListTodo, Plus, Quote, Table2, Trash2 } from "lucide-react";
import type { BlockKind, ContentBlock, PendingKind } from "@/lib/types/writing";
import { plainText } from "@/lib/writing/document";
import { StatusBadge } from "@/components/ui/status-badge";
import { RichText } from "@/components/writing/rich-text";

const kinds = {
  heading: { label: "标题", icon: Heading2 },
  paragraph: { label: "富文本段落", icon: FileText },
  table: { label: "指标表格", icon: Table2 },
  case: { label: "案例", icon: Quote },
  chart: { label: "图表占位", icon: BarChart3 },
  todo: { label: "内部待办", icon: ListTodo },
} satisfies Record<BlockKind, { label: string; icon: typeof FileText }>;

export interface BlockEditorProps {
  block: ContentBlock;
  selected: boolean;
  onSelect: () => void;
  onChange: (block: ContentBlock) => void;
  onDelete: () => void;
  onSelection: (text: string) => void;
  onConfigureChart?: () => void;
}

export function BlockEditor({ block, selected, onSelect, onChange, onDelete, onSelection, onConfigureChart }: BlockEditorProps) {
  const definition = kinds[block.kind];
  const Icon = definition.icon;
  const isPending = block.kind === "todo" && !block.resolved;
  const change = (patch: Partial<ContentBlock>) => onChange({ ...block, ...patch });

  function updateCell(rowIndex: number, columnIndex: number, value: string) {
    change({ rows: block.rows.map((row, index) => index === rowIndex ? row.map((cell, column) => column === columnIndex ? value : cell) : row) });
  }

  return (
    <article
      id={`block-${block.id}`}
      tabIndex={-1}
      data-block-id={block.id}
      data-block-kind={block.kind}
      onClick={onSelect}
      onFocusCapture={onSelect}
      className={`scroll-mt-24 rounded-xl border bg-white transition-[border-color,box-shadow] ${selected ? "border-[#69a58b] shadow-[0_0_0_2px_rgba(23,107,82,.08)]" : isPending ? "border-amber-200" : "border-[#e1e8e3] hover:border-[#b8cbbf]"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#edf0ee] px-3 py-2">
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-[#7b8981]">
          <GripVertical className="size-3 text-[#b0bbb4]" aria-hidden="true" />
          <Icon className="size-3.5 text-[#3d8062]" />
          <span>{definition.label}</span>
          <span className="ml-1 text-[#a3ada7]">v{block.revision}</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge tone={block.reviewStatus === "已审校" ? "green" : block.reviewStatus === "待复核" ? "amber" : "gray"}>{block.reviewStatus}</StatusBadge>
          <button type="button" aria-label={`删除${block.title}`} title="删除内容块（可撤销）" onClick={(event) => { event.stopPropagation(); onDelete(); }} className="grid size-6 place-items-center rounded text-[#9aa59e] hover:bg-rose-50 hover:text-rose-600"><Trash2 className="size-3" /></button>
        </div>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <input
          aria-label={`${definition.label}块标题`}
          value={block.title}
          onChange={(event) => change({ title: event.target.value })}
          placeholder="输入内容块标题"
          className={`w-full rounded border border-transparent bg-transparent px-1 py-1 font-semibold text-[#253d30] outline-none focus:border-[#b5d0c1] ${block.kind === "heading" ? "text-xl" : "text-sm"}`}
        />

        {(block.kind === "paragraph" || block.kind === "case") && (
          <div className={block.kind === "case" ? "border-l-[3px] border-[#87b49c] pl-3" : ""}>
            <RichText value={block.html} label={`${block.title}正文`} onChange={(html) => change({ html })} onSelection={onSelection} />
          </div>
        )}

        {block.kind === "table" && (
          <div>
            <div className="overflow-x-auto rounded-lg border border-[#e2e9e4]">
              <table className="w-full min-w-[350px] text-left text-xs" aria-label={`${block.title}指标表格`}>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex === 0 ? "bg-[#eff6f2] font-semibold" : "border-t border-[#e7ede9]"}>
                      {row.map((cell, columnIndex) => (
                        <td key={columnIndex} className="p-1.5">
                          <input value={cell} aria-label={`${block.title}第${rowIndex + 1}行第${columnIndex + 1}列`} onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)} className="min-w-[70px] w-full rounded border border-transparent bg-transparent px-2 py-2 text-[12px] text-[#42614e] outline-none focus:border-[#87b49c] focus:bg-white" />
                        </td>
                      ))}
                      <td className="w-7 pr-1.5"><button type="button" aria-label={`删除第${rowIndex + 1}行`} disabled={rowIndex === 0} onClick={() => change({ rows: block.rows.filter((_, index) => index !== rowIndex) })} className="grid size-6 place-items-center rounded text-[#89988e] hover:bg-rose-50 hover:text-rose-600 disabled:invisible"><Trash2 className="size-3" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={() => change({ rows: [...block.rows, Array.from({ length: block.rows[0]?.length || 3 }, () => "")] })} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#eff6f2] px-3 py-1.5 text-[11px] font-medium text-[#176b52]"><Plus className="size-3" />添加数据行</button>
          </div>
        )}

        {block.kind === "chart" && (
          <div className="rounded-lg border border-dashed border-[#bad0c2] bg-[#f7faf8] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 text-xs font-semibold text-[#6f8c7b]"><BarChart3 className="size-5" />图表占位 · Step 6 数据可视化</div>{onConfigureChart ? <button type="button" onClick={(event) => { event.stopPropagation(); onConfigureChart(); }} className="rounded-lg bg-[#176b52] px-3 py-1.5 text-[10px] font-semibold text-white">进入 Step 6 配置</button> : null}</div>
            <RichText compact value={block.html} label={`${block.title}图表说明`} onChange={(html) => change({ html })} onSelection={onSelection} />
          </div>
        )}

        {block.kind === "todo" && (
          <div className={`space-y-3 rounded-lg border p-3 ${block.resolved ? "border-emerald-100 bg-emerald-50/40" : "border-amber-100 bg-amber-50/60"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-amber-800"><CircleDashed className="size-3.5" />内部标记<select aria-label={`${block.title}事项类型`} value={block.pendingKind || "待补充"} onChange={(event) => change({ pendingKind: event.target.value as PendingKind })} className="rounded-md border border-amber-200 bg-white px-2 py-1 text-[11px]"><option>待补充</option><option>待确认</option><option>待更新</option></select></label>
              <label className="flex items-center gap-1.5 text-[11px] text-[#52725e]"><input type="checkbox" checked={Boolean(block.resolved)} onChange={(event) => change({ resolved: event.target.checked })} className="accent-[#176b52]" />已处理{block.resolved && <Check className="size-3" />}</label>
            </div>
            <RichText compact value={block.html} label={`${block.title}待办说明`} onChange={(html) => change({ html })} onSelection={onSelection} />
            <p className="text-[10px] leading-4 text-[#a08342]">内部编制备注，需要人工核实后处理。</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#f0f3f1] px-4 py-2 text-[10px] text-[#8a978f]">
        <div className="flex gap-3"><span className="inline-flex items-center gap-1"><Layers3 className="size-3" />{block.mappings.length} 项披露映射</span><span className="inline-flex items-center gap-1"><Link2 className="size-3" />{block.citations.length} 条事实引用</span></div>
        <span>{block.kind === "table" ? `${Math.max(block.rows.length - 1, 0)} 条数据` : `${plainText(block.html).length} 字`}</span>
      </div>
    </article>
  );
}
