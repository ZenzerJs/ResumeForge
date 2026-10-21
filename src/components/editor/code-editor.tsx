"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { ShieldCheck, LayoutList, Code2, Plus } from "lucide-react";
import { ResumeFormBuilder } from "./resume-form-builder";

interface CodeEditorProps {
  value: string;
  onChange: (val: string) => void;
}

export function CodeEditor({ value, onChange }: CodeEditorProps) {
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const [markedCount, setMarkedCount] = useState(0);
  const [editorMode, setEditorMode] = useState<"code" | "visual">("code");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "visual") {
      setEditorMode("visual");
    }
  }, []);

  const handleMarkVerified = useCallback(() => {
    const view = editorRef.current?.view;
    if (!view) return;

    const { state, dispatch } = view;
    const selection = state.selection.main;
    const selectedText = state.sliceDoc(selection.from, selection.to);

    const STAMP = `// ✓ @verified:${new Date().toISOString().slice(0, 10)}`;

    if (selectedText.trim()) {
      const insertion = `\n${STAMP}\n`;
      dispatch(
        state.update({
          changes: { from: selection.to, to: selection.to, insert: insertion },
          scrollIntoView: true,
        })
      );
    } else {
      const insertion = `${STAMP}\n`;
      dispatch(
        state.update({
          changes: { from: selection.from, to: selection.from, insert: insertion },
          scrollIntoView: true,
        })
      );
    }
    setMarkedCount((n) => n + 1);
  }, []);

  const handleInsertEntrySnippet = useCallback(() => {
    const snippet = `\n#entry(\n  title: "Organization Name",\n  role: "Role Title",\n  location: "City, State",\n  date: "2024 – Present",\n  details: [\n    - Delivered measurable technical impact.\n  ]\n)\n`;
    onChange((value || "") + snippet);
  }, [value, onChange]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-md border border-slate-800/80 bg-slate-900 text-slate-100 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-400">
        <div
          className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900 p-0.5"
          role="tablist"
          aria-label="Editor input mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={editorMode === "visual"}
            onClick={() => setEditorMode("visual")}
            data-testid="editor-mode-visual"
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-mono font-semibold transition ${
              editorMode === "visual"
                ? "bg-[#ff8c00] text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <LayoutList className="h-3 w-3" />
            <span>Visual Form</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={editorMode === "code"}
            onClick={() => setEditorMode("code")}
            data-testid="editor-mode-code"
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-mono font-semibold transition ${
              editorMode === "code"
                ? "bg-[#ff8c00] text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Code2 className="h-3 w-3" />
            <span>Typst Source</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {editorMode === "code" && (
            <>
              <button
                type="button"
                onClick={handleInsertEntrySnippet}
                data-testid="insert-entry-snippet-btn"
                title="Insert a new Experience/Project entry block"
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[10px] font-mono font-semibold transition"
              >
                <Plus className="h-3 w-3 text-[#ff8c00]" />
                Entry
              </button>
              {markedCount > 0 && (
                <span className="text-[10px] font-mono text-emerald-500">
                  {markedCount} mark{markedCount !== 1 ? "s" : ""}
                </span>
              )}
              <button
                type="button"
                onClick={handleMarkVerified}
                title="Mark selected text as verified (Task 7.7)"
                className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold transition"
              >
                <ShieldCheck className="h-3 w-3" />
                Mark
              </button>
            </>
          )}
          <span className="hidden sm:inline font-mono text-[10px] text-slate-500">
            {editorMode === "visual" ? "Guided Mode" : "CodeMirror 6"}
          </span>
        </div>
      </div>

      <div className="relative flex-1 overflow-auto">
        {editorMode === "visual" ? (
          <ResumeFormBuilder value={value} onChange={onChange} />
        ) : (
          <CodeMirror
            ref={editorRef}
            value={value}
            height="100%"
            theme="dark"
            extensions={[EditorView.lineWrapping]}
            onChange={onChange}
            className="h-full text-sm font-mono"
          />
        )}
      </div>
    </div>
  );
}

