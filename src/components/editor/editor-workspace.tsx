"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CodeEditor } from "./code-editor";
import { PreviewPanel } from "./preview-panel";
import { AiSidebar } from "./ai-sidebar";
import { compileTypstToSvg } from "@/lib/typst/compiler";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { usePanelRef } from "react-resizable-panels";
import {
  parsePersistedLayout,
  serializeLayoutState,
  EDITOR_LAYOUT_STORAGE_KEY,
} from "@/lib/editor/layout-persistence";
import { handleSaveShortcut } from "@/lib/editor/shortcut-handler";
import {
  Code2,
  Eye,
  Bot,
  Save,
  BookOpen,
  Check,
  Loader2,
  Settings,
  ShieldCheck,
  Sparkles,
  FileText,
  AlertTriangle,
  Briefcase,
  RotateCcw,
  Undo2,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TopNav } from "@/components/navigation/top-nav";

const STORAGE_KEY = "resumeforge_typst_source";

export type DocumentType = "MASTER_RESUME" | "RESUME_VARIANT" | "LOCAL_FALLBACK";

export interface DocumentMetadata {
  type: DocumentType;
  title: string;
  id?: string;
}

export function EditorWorkspace() {
  const searchParams = useSearchParams();
  const variantIdParam = searchParams.get("variantId");
  const resumeIdParam = searchParams.get("resumeId");

  const [source, setSource] = useState<string>("");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; line?: number; column?: number } | null>(null);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"editor" | "preview" | "ai">("editor");

  // Task 10.5: Typst Repair Assist active error context state
  const [repairContext, setRepairContext] = useState<{
    compileError: string;
    line?: number;
    column?: number;
    sourceExcerpt?: string;
  } | null>(null);

  const [isSavingMaster, setIsSavingMaster] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Task 9.3: Ctrl+S / Cmd+S save & instant recompile shortcut state
  const [showShortcutSaveToast, setShowShortcutSaveToast] = useState<boolean>(false);

  // Task 7.9: Save as Master + Revert & Undo safety state
  const [showSaveConfirm, setShowSaveConfirm] = useState<boolean>(false);
  const [lastSnapshotId, setLastSnapshotId] = useState<string | null>(null);
  const [isUndoing, setIsUndoing] = useState<boolean>(false);
  const [undoSuccess, setUndoSuccess] = useState<boolean>(false);

  // Task B1: Canonical Document Loading & Metadata State
  const [isLoadingDocument, setIsLoadingDocument] = useState<boolean>(true);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [docMetadata, setDocMetadata] = useState<DocumentMetadata>({
    type: "LOCAL_FALLBACK",
    title: "Local Workspace",
  });

  // Task 9.1: PDF Conversion Path status banner dismissal state with sessionStorage persistence
  const [isConversionBannerDismissed, setIsConversionBannerDismissed] = useState<boolean>(false);

  useEffect(() => {
    if (docMetadata.id && typeof window !== "undefined") {
      const isDismissed = sessionStorage.getItem(`resumeforge_dismissed_banner_${docMetadata.id}`);
      if (isDismissed === "true") {
        setIsConversionBannerDismissed(true);
      }
    }
  }, [docMetadata.id]);

  const handleDismissConversionBanner = () => {
    setIsConversionBannerDismissed(true);
    if (docMetadata.id && typeof window !== "undefined") {
      sessionStorage.setItem(`resumeforge_dismissed_banner_${docMetadata.id}`, "true");
    }
  };

  // Task 9.2: Resizable 3-pane layout state & imperatively controlled AI collapse
  const aiPanelRef = usePanelRef();
  const [initialLayoutState] = useState(() => {
    if (typeof window === "undefined") return parsePersistedLayout(null);
    return parsePersistedLayout(localStorage.getItem(EDITOR_LAYOUT_STORAGE_KEY));
  });

  const [layout, setLayout] = useState<Record<string, number>>(initialLayoutState.sizes);
  const [isAiCollapsed, setIsAiCollapsed] = useState<boolean>(initialLayoutState.isAiCollapsed);
  const isAiCollapsedRef = useRef<boolean>(isAiCollapsed);

  useEffect(() => {
    isAiCollapsedRef.current = isAiCollapsed;
  }, [isAiCollapsed]);

  const updateAiCollapsedState = useCallback((collapsed: boolean) => {
    setIsAiCollapsed(collapsed);
    isAiCollapsedRef.current = collapsed;
  }, []);

  // Collapse panel on mount if layout was persisted as collapsed
  useEffect(() => {
    if (isAiCollapsed) {
      const timer = setTimeout(() => {
        aiPanelRef.current?.collapse();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [aiPanelRef, isAiCollapsed]);

  const persistLayoutState = (sizes: Record<string, number>, collapsed: boolean) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        EDITOR_LAYOUT_STORAGE_KEY,
        serializeLayoutState(sizes, collapsed)
      );
    } catch {
      // ignore write errors
    }
  };

  const handleLayoutChange = (layoutMap: Record<string, number>) => {
    setLayout(layoutMap);
    persistLayoutState(layoutMap, isAiCollapsedRef.current);
  };

  const toggleAiSidebarCollapse = () => {
    const panel = aiPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
      updateAiCollapsedState(false);
      persistLayoutState(layout, false);
    } else {
      panel.collapse();
      updateAiCollapsedState(true);
      persistLayoutState(layout, true);
    }
  };

  // Load initial starter template fallback
  const loadStarterTemplate = useCallback(async () => {
    try {
      const res = await fetch("/templates/starter-resume.typ");
      if (res.ok) {
        const text = await res.text();
        return text;
      }
    } catch {
      // Fallback
    }
    return "// Starter Typst Resume\n#set page(paper: \"us-letter\")\n= My Resume\n";
  }, []);

  /**
   * Task B1: Canonical Loading Priority Algorithm
   * 1. variantId: fetch GET /api/variants/[id]
   * 2. resumeId: fetch GET /api/resumes/[id]
   * 3. no param: fetch GET /api/resumes to load canonical SQLite master resume
   * 4. fallback: localStorage or starter template only when no DB record exists
   */
  const loadCanonicalDocument = useCallback(async () => {
    setIsLoadingDocument(true);
    setDocumentError(null);

    try {
      // Priority 1: variantId param
      if (variantIdParam && variantIdParam.trim().length > 0) {
        const res = await fetch(`/api/variants/${variantIdParam.trim()}`);
        const json = await res.json();
        if (res.ok && json.success && json.data) {
          setSource(json.data.typstContent);
          setDocMetadata({
            type: "RESUME_VARIANT",
            title: json.data.variantTitle || "Tailored Variant",
            id: json.data.id,
          });
          setIsLoadingDocument(false);
          return;
        } else {
          setDocumentError(json.error || `ResumeVariant not found: ${variantIdParam}`);
          setIsLoadingDocument(false);
          return;
        }
      }

      // Priority 2: resumeId param
      if (resumeIdParam && resumeIdParam.trim().length > 0) {
        const res = await fetch(`/api/resumes/${resumeIdParam.trim()}`);
        const json = await res.json();
        if (res.ok && json.success && json.data) {
          setSource(json.data.typstSource);
          setDocMetadata({
            type: json.data.isMaster ? "MASTER_RESUME" : "LOCAL_FALLBACK",
            title: json.data.title || (json.data.isMaster ? "Master Resume" : "Resume"),
            id: json.data.id,
          });
          setIsLoadingDocument(false);
          return;
        } else {
          setDocumentError(json.error || `Resume not found: ${resumeIdParam}`);
          setIsLoadingDocument(false);
          return;
        }
      }

      // Priority 3: No param -> fetch canonical SQLite master resume
      const res = await fetch("/api/resumes");
      const json = await res.json();
      if (res.ok && json.success && Array.isArray(json.data) && json.data.length > 0) {
        const master = json.data.find((r: { isMaster: boolean }) => r.isMaster) || json.data[0];
        setSource(master.typstSource);
        setDocMetadata({
          type: master.isMaster ? "MASTER_RESUME" : "LOCAL_FALLBACK",
          title: master.title || "Master Resume",
          id: master.id,
        });

        // Sync localStorage with DB master content so localStorage does NOT overwrite DB content
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, master.typstSource);
        }
        setIsLoadingDocument(false);
        return;
      }
    } catch (err) {
      console.error("Database document fetch error:", err);
    }

    // Priority 4: Fallback to localStorage or starter template only when no DB record exists
    const savedLocal = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (savedLocal && savedLocal.trim().length > 0) {
      setSource(savedLocal);
      setDocMetadata({
        type: "LOCAL_FALLBACK",
        title: "Local Draft",
      });
    } else {
      const starter = await loadStarterTemplate();
      setSource(starter);
      setDocMetadata({
        type: "LOCAL_FALLBACK",
        title: "Starter Template",
      });
    }

    setIsLoadingDocument(false);
  }, [variantIdParam, resumeIdParam, loadStarterTemplate]);

  useEffect(() => {
    loadCanonicalDocument();
  }, [loadCanonicalDocument]);

  // Compile Typst whenever source changes
  const runCompile = useCallback(async (codeToCompile: string) => {
    if (!codeToCompile || codeToCompile.trim().length === 0) return;
    setIsCompiling(true);

    const result = await compileTypstToSvg(codeToCompile);
    setIsCompiling(false);

    if (result.success) {
      setSvg(result.svg);
      setError(null);
    } else {
      setError(result.error);
    }
  }, []);

  useEffect(() => {
    if (source) {
      runCompile(source);
    }
  }, [source, runCompile]);

  // Task 9.3: Ctrl+S / Cmd+S save & instant recompile handler
  const isSavingShortcutRef = useRef<boolean>(false);
  const sourceRef = useRef<string>(source);

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  const handleShortcutSave = useCallback(async () => {
    const currentSource = sourceRef.current;
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, currentSource);
    }
    setShowShortcutSaveToast(true);
    setTimeout(() => setShowShortcutSaveToast(false), 2000);

    await runCompile(currentSource);
  }, [runCompile]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleSaveShortcut({
        event: e,
        onSave: handleShortcutSave,
        isLockedRef: isSavingShortcutRef,
      }).catch(console.error);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleShortcutSave]);

  const handleSourceChange = (newVal: string) => {
    setSource(newVal);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, newVal);
    }
  };

  const handleTriggerRepair = useCallback(
    (context: { compileError: string; line?: number; column?: number; sourceExcerpt?: string }) => {
      setRepairContext(context);
      if (isAiCollapsedRef.current && aiPanelRef.current) {
        aiPanelRef.current.expand();
        updateAiCollapsedState(false);
      }
      setActiveTab("ai");
    },
    [aiPanelRef, updateAiCollapsedState]
  );

  const handleApplyRepair = useCallback(
    (newSource: string) => {
      handleSourceChange(newSource);
      runCompile(newSource);
    },
    [runCompile]
  );

  const handleResetTemplate = async () => {
    const starter = await loadStarterTemplate();
    handleSourceChange(starter);
  };

  const handleSaveAsMaster = async () => {
    setShowSaveConfirm(true);
  };

  const handleConfirmSaveAsMaster = async () => {
    if (!source || source.trim().length === 0) return;
    try {
      setIsSavingMaster(true);
      setSaveSuccess(false);

      const res = await fetch("/api/resumes/save-master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: docMetadata.id,
          title: "Master Resume",
          typstSource: source,
          confirmOverwrite: true,
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setSaveSuccess(true);
        if (json.snapshotId) {
          setLastSnapshotId(json.snapshotId);
        }
        setDocMetadata({
          type: "MASTER_RESUME",
          title: "Master Resume",
          id: json.data?.id,
        });
        setShowSaveConfirm(false);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save master resume:", err);
    } finally {
      setIsSavingMaster(false);
    }
  };

  const handleRevertToMaster = async () => {
    if (!confirm("Revert live editor buffer to the persisted Master Resume? Any unsaved edits in this buffer will be discarded.")) {
      return;
    }
    await loadCanonicalDocument();
    setLastSnapshotId(null);
  };

  const handleUndoOverwrite = async () => {
    if (!lastSnapshotId) return;
    try {
      setIsUndoing(true);
      const res = await fetch("/api/resumes/undo-master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId: lastSnapshotId }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        const restoredSource = json.data.typstSource;
        setSource(restoredSource);
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, restoredSource);
        }
        setLastSnapshotId(null);
        setUndoSuccess(true);
        setTimeout(() => setUndoSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed to undo master overwrite:", err);
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <div className="dark flex h-dvh w-screen flex-col overflow-hidden text-foreground" style={{ backgroundColor: "#0A0E17" }}>
      {/* Top Navbar — shared TopNav with badge + action slot */}
      <TopNav
        badge={
          <div className="hidden sm:flex items-center gap-2" data-testid="document-type-badge">
            {docMetadata.type === "MASTER_RESUME" && (
              <span
                data-testid="doc-badge-master"
                className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/60 flex items-center gap-1.5 shadow-sm"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                Master Resume ({docMetadata.title})
              </span>
            )}
            {docMetadata.type === "RESUME_VARIANT" && (
              <span
                data-testid="doc-badge-variant"
                className="text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-950/60 text-sky-300 border border-sky-800/60 flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                Tailored Variant ({docMetadata.title})
              </span>
            )}
            {docMetadata.type === "LOCAL_FALLBACK" && (
              <span
                data-testid="doc-badge-fallback"
                className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-900 text-slate-300 border border-slate-700/60 flex items-center gap-1.5"
              >
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                {docMetadata.title}
              </span>
            )}
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            {showShortcutSaveToast && (
              <div
                data-testid="shortcut-save-toast"
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950/90 border border-emerald-700/80 text-emerald-200 text-xs font-medium rounded-md shadow-lg transition-all"
              >
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>Draft Saved &amp; Recompiled</span>
              </div>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleRevertToMaster}
              data-testid="revert-to-master-btn"
              className="text-xs border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 gap-1.5"
              title="Discard unsaved live buffer changes and reload persisted Master Resume"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Revert to Master</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleSaveAsMaster}
              disabled={isSavingMaster}
              data-testid="save-as-master-btn"
              className="text-xs font-semibold gap-1.5 transition-all"
              style={{
                background: saveSuccess
                  ? "linear-gradient(135deg, #10B981, #059669)"
                  : "linear-gradient(135deg, #F59E0B, #D97706)",
                color: "#0A0E17",
                boxShadow: saveSuccess
                  ? "0 0 12px rgba(16,185,129,0.25)"
                  : "0 0 12px rgba(245,158,11,0.2)",
              }}
            >
              {isSavingMaster ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : saveSuccess ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {saveSuccess ? "Saved as Master!" : "Save as Master Resume"}
            </Button>

            {isAiCollapsed && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={toggleAiSidebarCollapse}
                data-testid="expand-ai-sidebar-btn"
                className="h-8 gap-1.5 text-xs hidden lg:flex border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                title="Expand AI Sidebar"
              >
                <Bot className="h-3.5 w-3.5 text-amber-400" />
                <span>AI Assistant</span>
              </Button>
            )}

            {/* Mobile Tab Selectors (< lg screens) */}
            <div
              className="flex items-center gap-1 rounded-lg border border-border bg-background p-1 lg:hidden"
              role="tablist"
              aria-label="Workspace panels"
            >
            <Button
              type="button"
              size="sm"
              variant={activeTab === "editor" ? "default" : "ghost"}
              onClick={() => setActiveTab("editor")}
              className="h-8 px-2 text-xs"
              aria-selected={activeTab === "editor"}
            >
              <Code2 className="h-3.5 w-3.5" />
              Editor
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeTab === "preview" ? "default" : "ghost"}
              onClick={() => setActiveTab("preview")}
              className="h-8 px-2 text-xs"
              aria-selected={activeTab === "preview"}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeTab === "ai" ? "default" : "ghost"}
              onClick={() => setActiveTab("ai")}
              className="h-8 px-2 text-xs"
              aria-selected={activeTab === "ai"}
            >
              <Bot className="h-3.5 w-3.5" />
              AI
            </Button>
            </div>
          </div>
        }
      />

      {/* Task B1: Explicit Loading & Recoverable Error States */}
      {isLoadingDocument && (
        <div
          data-testid="editor-loading-state"
          className="flex h-8 items-center justify-center bg-slate-900 border-b border-slate-800 text-xs text-slate-400 gap-2 font-mono"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
          Loading document from database...
        </div>
      )}

      {documentError && (
        <div
          data-testid="editor-error-state"
          className="flex items-center justify-between px-4 py-2 bg-red-950/90 border-b border-red-800 text-xs text-red-200"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{documentError}</span>
          </div>
          <button
            type="button"
            onClick={() => setDocumentError(null)}
            className="px-2.5 py-1 bg-red-900/60 hover:bg-red-800 text-red-100 rounded text-[11px] font-medium transition"
          >
            Dismiss Error
          </button>
        </div>
      )}

      {/* Task 9.1: PDF Conversion Status Banners */}
      {!isConversionBannerDismissed && source.includes("// @conversion-path: fallback") && (
        <div
          data-testid="pdf-conversion-fallback-banner"
          className="flex items-center justify-between px-4 py-2 bg-amber-950/80 border-b border-amber-800 text-xs text-amber-200"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>AI conversion unavailable — used basic formatting</span>
          </div>
          <button
            type="button"
            onClick={handleDismissConversionBanner}
            className="p-1 text-amber-300 hover:text-white transition"
            title="Dismiss banner"
            data-testid="dismiss-conversion-banner-btn"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {!isConversionBannerDismissed && source.includes("// @conversion-path: ai") && (
        <div
          data-testid="pdf-conversion-ai-banner"
          className="flex items-center justify-between px-4 py-2 bg-emerald-950/80 border-b border-emerald-800 text-xs text-emerald-200"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>AI-Converted Draft — Converted using BYOK AI provider</span>
          </div>
          <button
            type="button"
            onClick={handleDismissConversionBanner}
            className="p-1 text-emerald-300 hover:text-white transition"
            title="Dismiss banner"
            data-testid="dismiss-conversion-banner-btn"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}


      {/* Task 7.9: Undo Overwrite Notification Banner */}
      {lastSnapshotId && (
        <div
          data-testid="undo-overwrite-banner"
          className="flex items-center justify-between px-4 py-2 bg-amber-950/90 border-b border-amber-800 text-xs text-amber-200"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-amber-400" />
            <span>Master Resume overwritten. A pre-save snapshot was saved to database history.</span>
          </div>
          <button
            type="button"
            onClick={handleUndoOverwrite}
            disabled={isUndoing}
            data-testid="undo-overwrite-btn"
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded text-xs font-semibold transition"
          >
            {isUndoing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
            Undo Overwrite
          </button>
        </div>
      )}

      {undoSuccess && (
        <div
          data-testid="undo-success-banner"
          className="flex items-center gap-2 px-4 py-2 bg-emerald-950/90 border-b border-emerald-800 text-xs text-emerald-300"
        >
          <Check className="h-4 w-4 text-emerald-400" />
          <span>Restored Master Resume to pre-overwrite snapshot!</span>
        </div>
      )}

      {/* Task 7.9: Confirmation Modal for Save as Master */}
      {showSaveConfirm && (
        <div
          data-testid="save-master-confirm-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-white font-semibold text-base">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                Confirm Overwrite Master Resume
              </div>
              <button
                type="button"
                onClick={() => setShowSaveConfirm(false)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Saving will overwrite your persisted <strong className="text-white">Master Resume</strong> with the current editor buffer content.
            </p>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] text-amber-300/90 space-y-1">
              <p className="font-semibold text-amber-300">✓ Automatic Pre-Save Snapshot</p>
              <p className="text-slate-400">
                A snapshot of your current Master Resume will be recorded in database history before overwriting, allowing instant Undo.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveConfirm(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSaveAsMaster}
                disabled={isSavingMaster}
                data-testid="confirm-save-master-btn"
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-lg shadow-amber-500/20 transition"
              >
                {isSavingMaster ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Confirm Overwrite &amp; Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Body */}
      <main className="flex flex-1 overflow-hidden bg-background p-2 md:p-3">
        {/* Desktop 3-Panel Resizable Layout (>= lg screens) */}
        <ResizablePanelGroup
          id="editor-resizable-panel-group"
          orientation="horizontal"
          onLayoutChange={handleLayoutChange}
          className="hidden lg:flex h-full w-full gap-1.5"
          data-testid="editor-resizable-panel-group"
        >
          {/* Panel 1: CodeMirror Editor */}
          <ResizablePanel
            id="panel-code"
            defaultSize={layout["panel-code"] ?? 45}
            minSize={20}
            className="h-full overflow-hidden"
            data-testid="editor-code-panel"
          >
            <CodeEditor value={source} onChange={handleSourceChange} />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Panel 2: Live Preview */}
          <ResizablePanel
            id="panel-preview"
            defaultSize={layout["panel-preview"] ?? 35}
            minSize={25}
            className="h-full overflow-hidden"
            data-testid="editor-preview-panel"
          >
            <PreviewPanel
              svg={svg}
              error={error}
              source={source}
              isCompiling={isCompiling}
              onResetTemplate={handleResetTemplate}
              onTriggerRepair={handleTriggerRepair}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Panel 3: AI Sidebar (Collapsible) */}
          <ResizablePanel
            id="panel-ai"
            panelRef={aiPanelRef}
            defaultSize={isAiCollapsed ? 0 : (layout["panel-ai"] ?? 20)}
            minSize={15}
            collapsible={true}
            collapsedSize={0}
            onResize={(size) => {
              const isCurrentlyCollapsed = size.asPercentage <= 2;
              if (isCurrentlyCollapsed !== isAiCollapsedRef.current) {
                updateAiCollapsedState(isCurrentlyCollapsed);
                persistLayoutState(layout, isCurrentlyCollapsed);
              }
            }}
            className="h-full overflow-hidden"
            data-testid="editor-ai-panel"
          >
            <AiSidebar
              source={source}
              onApplyToBuffer={handleApplyRepair}
              isCollapsed={isAiCollapsed}
              onToggleCollapse={toggleAiSidebarCollapse}
              repairContext={repairContext}
              onDismissRepair={() => setRepairContext(null)}
            />
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* Mobile Tabbed View (< lg screens) */}
        <div className="flex h-full w-full flex-col lg:hidden">
          {activeTab === "editor" && (
            <div className="h-full w-full overflow-hidden">
              <CodeEditor value={source} onChange={handleSourceChange} />
            </div>
          )}
          {activeTab === "preview" && (
            <div className="h-full w-full overflow-hidden">
              <PreviewPanel
                svg={svg}
                error={error}
                source={source}
                isCompiling={isCompiling}
                onResetTemplate={handleResetTemplate}
                onTriggerRepair={handleTriggerRepair}
              />
            </div>
          )}
          {activeTab === "ai" && (
            <div className="h-full w-full overflow-hidden">
              <AiSidebar
                source={source}
                onApplyToBuffer={handleApplyRepair}
                repairContext={repairContext}
                onDismissRepair={() => setRepairContext(null)}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
