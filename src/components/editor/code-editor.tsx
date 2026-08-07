"use client";

import React, { useRef, useState, useCallback } from "react";
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { ShieldCheck } from "lucide-react";

interface CodeEditorProps {
  value: string;
  onChange: (val: string) => void;
}

export function CodeEditor({ value, onChange }: CodeEditorProps) {
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const [markedCount, setMarkedCount] = useState(0);

  const handleMarkVerified = useCallback(() => {
    const view = editorRef.current?.view;
    if (!view) return;

    const { state, dispatch } = view;
    const selection = state.selection.main;
    const selectedText = state.sliceDoc(selection.from, selection.to);

    const STAMP = `// ✓ @verified:${new Date().toISOString().slice(0, 10)}`;

    if (selectedText.trim()) {
      // Wrap selected text: insert stamp on new line after selection
      const insertion = `\n${STAMP}\n`;
      dispatch(
        state.update({
          changes: { from: selection.to, to: selection.to, insert: insertion },
          scrollIntoView: true,
        })
      );
    } else {
      // No selection: insert stamp at cursor
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

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-md border border-slate-200 bg-slate-900 text-slate-100 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-2 text-xs font-medium text-slate-400">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Typst Source Editor
        </span>
        <div className="flex items-center gap-2">
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
          <span className="font-mono text-[10px] text-slate-500">CodeMirror 6</span>
        </div>
      </div>

      <div className="relative flex-1 overflow-auto">
        <CodeMirror
          ref={editorRef}
          value={value}
          height="100%"
          theme="dark"
          extensions={[EditorView.lineWrapping]}
          onChange={onChange}
          className="h-full text-sm font-mono"
        />
      </div>
    </div>
  );
}
