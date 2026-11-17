"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { RangeSetBuilder } from "@codemirror/state";
import {
  EditorView,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { ShieldCheck, LayoutList, Code2, Plus, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { isResumeLayoutV2Enabled, parseManagedResume, renderResumeDocument } from "@/lib/typst/resume-document";

const ResumeFormBuilder = dynamic(
  () => import("./resume-form-builder").then((m) => m.ResumeFormBuilder),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center p-6 text-xs font-mono text-text-secondary">
        Loading visual form…
      </div>
    ),
  }
);

const ManagedResumeForm = dynamic(
  () => import("./managed-resume-form").then((m) => m.ManagedResumeForm),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center p-6 text-xs font-mono text-text-secondary">
        Loading guided form…
      </div>
    ),
  }
);

const emberInkEditorTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#151211",
      color: "#d0c5b9",
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: "13px",
    },
    ".cm-scroller": {
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      lineHeight: "1.75",
    },
    ".cm-content": {
      caretColor: "#f7bd3f",
      padding: "14px 0",
    },
    ".cm-line": {
      padding: "0 16px",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#f7bd3f",
      borderLeftWidth: "2px",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "rgba(247, 189, 63, 0.18) !important",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(247, 189, 63, 0.06)",
      boxShadow: "inset 2px 0 #f7bd3f",
    },
    ".cm-gutters": {
      backgroundColor: "#151211",
      color: "rgba(214, 196, 176, 0.45)",
      border: "none",
      paddingLeft: "6px",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(247, 189, 63, 0.06)",
      color: "#f7bd3f",
    },
    ".cm-typst-comment": {
      color: "#9e9287",
      fontStyle: "italic",
    },
    ".cm-typst-keyword": {
      color: "#ff8b3d",
      fontWeight: "600",
    },
    ".cm-typst-fn": {
      color: "#f7bd3f",
      fontWeight: "600",
    },
    ".cm-typst-string": {
      color: "#4f8fff",
    },
  },
  { dark: true }
);

const commentMark = Decoration.mark({ class: "cm-typst-comment" });
const keywordMark = Decoration.mark({ class: "cm-typst-keyword" });
const fnMark = Decoration.mark({ class: "cm-typst-fn" });
const stringMark = Decoration.mark({ class: "cm-typst-string" });

const TYPST_TOKEN_REGEX =
  /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*")|(#[a-zA-Z_][a-zA-Z0-9_-]*)|(\b(?:resume|with)\b)|(\b\d+(?:\.\d+)?(?:%|M|k|x|ms|s)\b|\$\d+(?:\.\d+)?[MKBmkb]?)/g;

const KEYWORD_DIRECTIVES = new Set([
  "#import",
  "#show",
  "#let",
  "#set",
  "#section",
  "#include",
  "#if",
  "#else",
  "#for",
  "#while",
]);

function buildTypstDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    TYPST_TOKEN_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TYPST_TOKEN_REGEX.exec(text)) !== null) {
      const start = from + match.index;
      const end = start + match[0].length;
      if (match[1]) {
        builder.add(start, end, commentMark);
      } else if (match[2] || match[5]) {
        builder.add(start, end, stringMark);
      } else if (match[3]) {
        if (KEYWORD_DIRECTIVES.has(match[3])) {
          builder.add(start, end, keywordMark);
        } else {
          builder.add(start, end, fnMark);
        }
      } else if (match[4]) {
        builder.add(start, end, fnMark);
      }
    }
  }
  return builder.finish();
}

const typstHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildTypstDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildTypstDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

const EDITOR_EXTENSIONS = [
  EditorView.lineWrapping,
  emberInkEditorTheme,
  typstHighlightPlugin,
];

interface CodeEditorProps {
  value: string;
  onChange: (val: string) => void;
}

export function CodeEditor({ value, onChange }: CodeEditorProps) {
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const [markedCount, setMarkedCount] = useState(0);
  const [editorMode, setEditorMode] = useState<"code" | "visual">("code");
  const [reformatAlert, setReformatAlert] = useState<string | null>(null);
  const [pendingReformat, setPendingReformat] = useState<{
    sourceSnapshot: string;
    formattedSource: string;
    description: string;
  } | null>(null);

  useEffect(() => {
    setReformatAlert(null);
  }, [value]);

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
    setReformatAlert(null);
    const snapshot = value;
    const managed = parseManagedResume(snapshot);
    if (managed) {
      setPendingReformat({
        sourceSnapshot: snapshot,
        formattedSource: managed.prefix + renderResumeDocument(managed.document, "comfortable", managed.links),
        description: "Reformat this managed resume as a draft? Existing layout formatting will be normalized.",
      });
      return;
    }
    try {
      const response = await fetch("/templates/starter-resume.typ");
      const starter = await response.text();
      const {
        parseTypstToStructuredModel,
        serializeStructuredModelToTypst,
        legacyFormToResumeDocument,
      } = await import("./resume-form-builder");
      const model = parseTypstToStructuredModel(snapshot);
      const canonical = serializeStructuredModelToTypst(model).trim() === snapshot.trim();
      if (!response.ok || (snapshot.trim() !== starter.trim() && !canonical)) {
        setReformatAlert("This source cannot be reformatted safely. Continue editing it in Typst Code.");
        return;
      }
      setPendingReformat({
        sourceSnapshot: snapshot,
        formattedSource: renderResumeDocument(legacyFormToResumeDocument(model)),
        description: "Reformat this resume as a draft? Review the result before saving.",
      });
    } catch {
      setReformatAlert("Could not verify this source for reformatting.");
    }
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
            className={`flex min-h-11 md:min-h-0 items-center gap-1 rounded-[4px] px-2.5 py-0.5 text-xs font-mono font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              editorMode === "visual"
                ? "bg-elevated text-foreground shadow-xs"
                : "text-text-secondary hover:text-foreground"
            }`}
          >
            <LayoutList className="h-3 w-3 text-primary" />
            <span>Visual Form</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={editorMode === "code"}
            onClick={() => setEditorMode("code")}
            data-testid="editor-mode-code"
            className={`flex min-h-11 md:min-h-0 items-center gap-1 rounded-[4px] px-2.5 py-0.5 text-xs font-mono font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              editorMode === "code"
                ? "bg-elevated text-foreground shadow-xs"
                : "text-text-secondary hover:text-foreground"
            }`}
          >
            <Code2 className="h-3 w-3 text-ember" />
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
                className="flex min-h-11 md:min-h-0 items-center gap-1 px-2 py-0.5 rounded bg-elevated hover:bg-muted border border-outline/70 text-foreground text-xs font-mono font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="h-3 w-3 text-primary" />
                Entry
              </button>
              {markedCount > 0 && (
                <span className="text-xs font-mono tabular-nums text-status-success">
                  {markedCount} mark{markedCount !== 1 ? "s" : ""}
                </span>
              )}
              <button
                type="button"
                onClick={handleMarkVerified}
                title="Mark selected text as verified (Task 7.7)"
                className="flex min-h-11 md:min-h-0 items-center gap-1 px-2 py-0.5 rounded bg-status-success/15 hover:bg-status-success/25 border border-status-success/30 text-status-success text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ShieldCheck className="h-3 w-3" />
                Mark
              </button>
            </>
          )}
          {isResumeLayoutV2Enabled() && <button type="button" onClick={() => void handleReformat()} className="inline-flex min-h-11 md:min-h-0 items-center rounded border border-outline/70 bg-elevated px-2 py-0.5 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Reformat draft</button>}
          <span className="hidden xl:inline font-mono text-xs text-text-muted">
            {editorMode === "visual" ? "Guided" : "resume.typ"}
          </span>
        </div>
      </div>

      {reformatAlert && (
        <div
          role="alert"
          data-testid="reformat-error-alert"
          className="flex items-center justify-between gap-2 border-b border-status-danger/40 bg-status-danger/10 px-3 py-2 text-xs text-status-danger"
        >
          <span>{reformatAlert}</span>
          <button
            type="button"
            onClick={() => setReformatAlert(null)}
            aria-label="Dismiss reformat notice"
            className="rounded-[4px] p-0.5 text-status-danger hover:bg-status-danger/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}

      <div className="relative flex-1 overflow-auto bg-inset">
        {editorMode === "visual" ? (
          parseManagedResume(value) ? <ManagedResumeForm value={value} onChange={onChange} /> : <ResumeFormBuilder value={value} onChange={onChange} />
        ) : (
          <CodeMirror
            ref={editorRef}
            value={value}
            height="100%"
            theme={emberInkEditorTheme}
            extensions={EDITOR_EXTENSIONS}
            onChange={onChange}
            className="h-full text-sm font-mono bg-inset"
          />
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingReformat)}
        onOpenChange={(open) => {
          if (!open) setPendingReformat(null);
        }}
        title="Reformat Resume Draft"
        description={pendingReformat?.description ?? ""}
        confirmLabel="Reformat Draft"
        dialogTestId="reformat-confirm-modal"
        confirmTestId="confirm-reformat-btn"
        cancelTestId="cancel-reformat-btn"
        onConfirm={() => {
          if (!pendingReformat) return;
          if (pendingReformat.sourceSnapshot !== value) {
            setPendingReformat(null);
            setReformatAlert("Resume source changed while confirmation was open. Reformat canceled.");
            return;
          }
          onChange(pendingReformat.formattedSource);
          setPendingReformat(null);
        }}
      />
    </div>
  );
}

