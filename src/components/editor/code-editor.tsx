"use client";

import React from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";

interface CodeEditorProps {
  value: string;
  onChange: (val: string) => void;
}

export function CodeEditor({ value, onChange }: CodeEditorProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-md border border-slate-200 bg-slate-900 text-slate-100 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-2 text-xs font-medium text-slate-400">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-indigo-500" />
          Typst Source Editor
        </span>
        <span className="font-mono text-[10px] text-slate-500">CodeMirror 6</span>
      </div>

      <div className="relative flex-1 overflow-auto">
        <CodeMirror
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
