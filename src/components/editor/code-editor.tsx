"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { ShieldCheck, LayoutList, Code2, Plus } from "lucide-react";
import { ResumeFormBuilder, legacyFormToResumeDocument, parseTypstToStructuredModel, serializeStructuredModelToTypst } from "./resume-form-builder";
import { ManagedResumeForm } from "./managed-resume-form";
import { isResumeLayoutV2Enabled, parseManagedResume, renderResumeDocument } from "@/lib/typst/resume-document";

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

  const handleReformat = async () => {
    const managed = parseManagedResume(value);
    if (managed) {
      if (window.confirm("Reformat this managed resume as a draft?")) onChange(managed.prefix + renderResumeDocument(managed.document, "comfortable", managed.links));
      return;
    }
    try {
      const response = await fetch("/templates/starter-resume.typ");
      const starter = await response.text();
      const model = parseTypstToStructuredModel(value);
      const canonical = serializeStructuredModelToTypst(model).trim() === value.trim();
      if (!response.ok || (value.trim() !== starter.trim() && !canonical)) {
        window.alert("This source cannot be reformatted safely. Continue editing it in Typst Code.");
        return;
      }
      if (window.confirm("Reformat this resume as a draft? Review the result before saving.")) onChange(renderResumeDocument(legacyFormToResumeDocument(model)));
    } catch { window.alert("Could not verify this source for reformatting."); }
  };

  const handleInsertEntrySnippet = useCallback(() => {
    const snippet = value.includes("// ResumeForge layout v2")
      ? `\n#entry(title: "", role: "", location: "", date: "")\n- \n`
      : `\n#entry(\n  title: "Organization Name",\n  role: "Role Title",\n  location: "City, State",\n  date: "2024 – Present",\n  details: [\n    - Delivered measurable technical impact.\n  ]\n)\n`;
    const view = editorRef.current?.view;
    if (view) {
      const position = view.state.selection.main.to;
      view.dispatch(view.state.update({ changes: { from: position, insert: snippet }, selection: { anchor: position + snippet.length }, scrollIntoView: true }));
      view.focus();
    } else onChange((value || "") + snippet);
  }, [value, onChange]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-b-[6px] border-x border-b border-outline/70 bg-panel text-foreground">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 border-b border-outline/70 bg-panel px-2.5 py-0.5 text-xs text-text-secondary md:h-8 md:flex-nowrap">
        <div
          className="flex items-center gap-0.5 rounded border border-outline/70 bg-inset p-0.5"
          role="tablist"
          aria-label="Editor input mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={editorMode === "visual"}
            onClick={() => setEditorMode("visual")}
            data-testid="editor-mode-visual"
            className={`flex items-center gap-1 rounded-[4px] px-2 py-0.5 text-[11px] font-mono font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              editorMode === "visual"
                ? "bg-primary text-primary-foreground"
                : "text-text-secondary hover:text-foreground"
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
            className={`flex items-center gap-1 rounded-[4px] px-2 py-0.5 text-[11px] font-mono font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              editorMode === "code"
                ? "bg-primary text-primary-foreground"
                : "text-text-secondary hover:text-foreground"
            }`}
          >
            <Code2 className="h-3 w-3" />
            <span>Typst Source</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {editorMode === "code" && (
            <>
              <button
                type="button"
                onClick={handleInsertEntrySnippet}
                data-testid="insert-entry-snippet-btn"
                title="Insert a new Experience/Project entry block"
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-elevated hover:bg-muted border border-outline/70 text-foreground text-[11px] font-mono font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="h-3 w-3 text-primary" />
                Entry
              </button>
              {markedCount > 0 && (
                <span className="text-[10px] font-mono tabular-nums text-status-success">
                  {markedCount} mark{markedCount !== 1 ? "s" : ""}
                </span>
              )}
              <button
                type="button"
                onClick={handleMarkVerified}
                title="Mark selected text as verified (Task 7.7)"
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-status-success/15 hover:bg-status-success/25 border border-status-success/30 text-status-success text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ShieldCheck className="h-3 w-3" />
                Mark
              </button>
            </>
          )}
          {isResumeLayoutV2Enabled() && <button type="button" onClick={() => void handleReformat()} className="rounded border border-outline/70 bg-elevated px-2 py-0.5 text-[11px] font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Reformat draft</button>}
          <span className="hidden xl:inline font-mono text-[10px] text-text-muted">
            {editorMode === "visual" ? "Guided" : "CM6"}
          </span>
        </div>
      </div>

      <div className="relative flex-1 overflow-auto">
        {editorMode === "visual" ? (
          parseManagedResume(value) ? <ManagedResumeForm value={value} onChange={onChange} /> : <ResumeFormBuilder value={value} onChange={onChange} />
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

