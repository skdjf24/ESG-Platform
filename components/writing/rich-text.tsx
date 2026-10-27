"use client";

import { useLayoutEffect, useRef } from "react";
import { Bold, Italic, List, Quote, Underline } from "lucide-react";
import { sanitizeHtml } from "@/lib/writing/document";

export interface RichTextProps {
  value: string;
  label: string;
  onChange: (html: string) => void;
  onSelection: (text: string) => void;
  compact?: boolean;
}

/** Browser-owned editing surface: only external changes replace its DOM. */
export function RichText({ value, label, onChange, onSelection, compact = false }: RichTextProps) {
  const editor = useRef<HTMLDivElement>(null);
  const emitted = useRef<string | null>(null);
  const composing = useRef(false);

  useLayoutEffect(() => {
    const element = editor.current;
    if (!element || value === emitted.current) return;
    const safe = sanitizeHtml(value);
    if (element.innerHTML !== safe) element.innerHTML = safe;
    emitted.current = value;
  }, [value]);

  function publish() {
    if (!editor.current || composing.current) return;
    const safe = sanitizeHtml(editor.current.innerHTML);
    emitted.current = safe;
    onChange(safe);
  }

  function rememberSelection() {
    const selection = window.getSelection();
    if (selection?.anchorNode && selection.focusNode && editor.current?.contains(selection.anchorNode) && editor.current.contains(selection.focusNode)) {
      onSelection(selection.toString());
    }
  }

  function format(command: "bold" | "italic" | "underline" | "insertUnorderedList" | "formatBlock", value?: string) {
    editor.current?.focus();
    document.execCommand(command, false, value);
    publish();
    rememberSelection();
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#e5ebe7] bg-white focus-within:border-[#91bda9]">
      <div className="flex items-center gap-1 border-b border-[#edf1ee] bg-[#fafcfb] px-2 py-1.5" role="toolbar" aria-label={`${label}格式工具`}>
        {([
          { command: "bold", value: undefined, label: "加粗", icon: Bold },
          { command: "italic", value: undefined, label: "斜体", icon: Italic },
          { command: "underline", value: undefined, label: "下划线", icon: Underline },
          { command: "insertUnorderedList", value: undefined, label: "项目列表", icon: List },
          { command: "formatBlock", value: "blockquote", label: "引用", icon: Quote },
        ] as const).map(({ command, value: commandValue, label: buttonLabel, icon: Icon }) => (
          <button
            key={command}
            type="button"
            aria-label={buttonLabel}
            title={buttonLabel}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => format(command, commandValue)}
            className="grid size-7 place-items-center rounded text-[#5e7066] hover:bg-[#e8f1ec] hover:text-[#176b52]"
          >
            <Icon className="size-3.5" />
          </button>
        ))}
        <span className="ml-auto text-[10px] text-[#8a958e]">可选中文字局部改写</span>
      </div>
      <div
        ref={editor}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label={label}
        aria-multiline="true"
        spellCheck={false}
        onInput={publish}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={() => { composing.current = false; publish(); }}
        onMouseUp={rememberSelection}
        onKeyUp={rememberSelection}
        onPaste={(event) => {
          event.preventDefault();
          document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
          publish();
        }}
        onDrop={(event) => {
          event.preventDefault();
          document.execCommand("insertText", false, event.dataTransfer.getData("text/plain"));
          publish();
        }}
        className={`${compact ? "min-h-[66px]" : "min-h-[110px]"} px-3 py-3 text-[13px] leading-7 text-[#35473d] outline-none [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_b]:font-semibold [&_em]:italic [&_i]:italic`}
      />
    </div>
  );
}
