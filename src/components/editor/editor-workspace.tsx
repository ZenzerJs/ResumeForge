"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { compileTypstToSvg } from "@/lib/typst/compiler";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { usePanelRef } from "react-resizable-panels";
import {
  parsePersistedLayout,
  serializeLayoutState,
  EDITOR_LAYOUT_STORAGE_KEY,
  DEFAULT_EDITOR_LAYOUT,
} from "@/lib/editor/layout-persistence";
import { handleSaveShortcut } from "@/lib/editor/shortcut-handler";
import {
  Code2,
  Eye,
  Bot,
  MessageSquare,
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
import { AppShell } from "@/components/design-system/app-shell";
import { EditorWorkspaceSkeleton } from "@/components/editor/editor-workspace-skeleton";

const STORAGE_KEY = "resumeforge_typst_source";
const COMPILE_DEBOUNCE_MS = 400;
const SOURCE_PERSIST_MS = 500;

import { ConfirmMasterDialog } from "./confirm-master-dialog";
import { AiAssistantWindow } from "./ai-assistant-window";
import { ResumeFacts } from "@/lib/facts/types";
import { extractResumeFacts } from "@/lib/facts/extract";

const CodeEditor = dynamic(() => import("./code-editor").then((m) => ({ default: m.CodeEditor })), {
  ssr: false,
});
const PreviewPanel = dynamic(
  () => import("./preview-panel").then((m) => ({ default: m.PreviewPanel })),
  { ssr: false }
);
const AiSidebar = dynamic(() => import("./ai-sidebar").then((m) => ({ default: m.AiSidebar })), {
  ssr: false,
});

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
  const [baselineSource, setBaselineSource] = useState<string>("");
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
  const [draftEvidenceFromMaster, setDraftEvidenceFromMaster] = useState<boolean>(true);
  const [evidenceExtractToast, setEvidenceExtractToast] = useState<string | null>(null);
  const [isExtractingEvidence, setIsExtractingEvidence] = useState<boolean>(false);
  // Phase 11: Master Fact Snapshot state
  const [masterFacts, setMasterFacts] = useState<ResumeFacts | null>(null);

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
  // Restore localStorage sizes only after mount to avoid SSR/client hydration mismatch.
  const aiPanelRef = usePanelRef();
  const [layout, setLayout] = useState<Record<string, number>>(DEFAULT_EDITOR_LAYOUT.sizes);
  const [isAiCollapsed, setIsAiCollapsed] = useState<boolean>(DEFAULT_EDITOR_LAYOUT.isAiCollapsed);
  const [isAiPoppedOut, setIsAiPoppedOut] = useState<boolean>(false);
  const [aiMode, setAiMode] = useState<"chat" | "tailor">("chat");
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const isAiCollapsedRef = useRef<boolean>(isAiCollapsed);
  const skipResizePersistRef = useRef(false);
  const suppressResizePersistUntilRef = useRef(0);

  useEffect(() => {
    const persisted = parsePersistedLayout(
      localStorage.getItem(EDITOR_LAYOUT_STORAGE_KEY)
    );
    setLayout(persisted.sizes);
    setIsAiCollapsed(persisted.isAiCollapsed);
    isAiCollapsedRef.current = persisted.isAiCollapsed;

    try {
      const popped = localStorage.getItem("resumeforge_ai_popped_out");
      if (popped === "true") {
        setIsAiPoppedOut(true);
      }
    } catch {
      // ignore
    }

    // Ignore spurious onResize while the panel group mounts / restores collapse.
    suppressResizePersistUntilRef.current = Date.now() + 750;
    setIsLayoutReady(true);
  }, []);

  useEffect(() => {
    isAiCollapsedRef.current = isAiCollapsed;
  }, [isAiCollapsed]);

  const updateAiCollapsedState = useCallback((collapsed: boolean) => {
    setIsAiCollapsed(collapsed);
    isAiCollapsedRef.current = collapsed;
  }, []);

  // Collapse panel on mount if layout was persisted as collapsed or popped out
  useEffect(() => {
    if (!isLayoutReady) return;
    if (isAiCollapsed || isAiPoppedOut) {
      suppressResizePersistUntilRef.current = Date.now() + 750;
      const timer = setTimeout(() => {
        aiPanelRef.current?.collapse();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [aiPanelRef, isAiCollapsed, isAiPoppedOut, isLayoutReady]);

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

  const handleLayoutChange = useCallback((layoutData: any) => {
    let layoutMap: Record<string, number>;
    if (Array.isArray(layoutData)) {
      layoutMap = {
        "panel-code": layoutData[0] ?? 45,
        "panel-preview": layoutData[1] ?? 35,
        "panel-ai": layoutData[2] ?? 20,
      };
    } else if (layoutData && typeof layoutData === "object") {
      layoutMap = layoutData;
    } else {
      return;
    }
    setLayout(layoutMap);
    if (Date.now() < suppressResizePersistUntilRef.current) return;
    persistLayoutState(layoutMap, isAiCollapsedRef.current);
  }, []);

  const handleToggleAiPopOut = useCallback(() => {
    setIsAiPoppedOut((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("resumeforge_ai_popped_out", String(next));
        } catch {
          // ignore
        }
      }
      if (next) {
        aiPanelRef.current?.collapse();
        updateAiCollapsedState(true);
      } else {
        aiPanelRef.current?.expand();
        updateAiCollapsedState(false);
      }
      return next;
    });
  }, [aiPanelRef, updateAiCollapsedState]);

  const toggleAiSidebarCollapse = () => {
    const panel = aiPanelRef.current;
    if (!panel) return;
    skipResizePersistRef.current = true;
    suppressResizePersistUntilRef.current = Date.now() + 500;
    if (panel.isCollapsed()) {
      panel.expand();
      updateAiCollapsedState(false);
      persistLayoutState(layout, false);
    } else {
      panel.collapse();
      updateAiCollapsedState(true);
      persistLayoutState(layout, true);
    }
    window.setTimeout(() => {
      skipResizePersistRef.current = false;
    }, 500);
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
    if (isLoadingDocument) return;
    setBaselineSource(source);
    // Capture the loaded buffer once loading completes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingDocument]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (source !== baselineSource) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [source, baselineSource]);

  useEffect(() => {
    loadCanonicalDocument();
  }, [loadCanonicalDocument]);

  const compileGeneration = useRef(0);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runCompile = useCallback(async (codeToCompile: string) => {
    if (!codeToCompile || codeToCompile.trim().length === 0) return;
    const generation = ++compileGeneration.current;
    setIsCompiling(true);

    const result = await compileTypstToSvg(codeToCompile);
    if (generation !== compileGeneration.current) return;

    setIsCompiling(false);

    if (result.success) {
      setSvg(result.svg);
      setError(null);
    } else {
      setError(result.error);
    }
  }, []);

  useEffect(() => {
    if (!source) return;
    const timer = window.setTimeout(() => {
      void runCompile(source);
    }, COMPILE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
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
    if (typeof window === "undefined") return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, newVal);
    }, SOURCE_PERSIST_MS);
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
    // Default checkbox: checked when Evidence Bank is empty; otherwise unchecked
    try {
      const res = await fetch("/api/evidence");
      const json = await res.json();
      const items = Array.isArray(json?.data) ? json.data : [];
      const activeCount = items.filter((i: { status?: string }) => i.status !== "archived").length;
      setDraftEvidenceFromMaster(activeCount === 0);
    } catch {
      setDraftEvidenceFromMaster(true);
    }
  };

  const runEvidenceExtractAfterSave = async (typstSource: string) => {
    try {
      setIsExtractingEvidence(true);
      let providerConfig: Record<string, unknown> | undefined;
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("resumeforge_ai_settings");
        if (stored) {
          providerConfig = JSON.parse(stored);
        }
      }
      if (!providerConfig?.provider || !providerConfig?.apiKey) {
        setEvidenceExtractToast("Configure an AI provider in Settings to draft Evidence Bank items.");
        setTimeout(() => setEvidenceExtractToast(null), 8000);
        return;
      }

      const res = await fetch("/api/ai/extract-evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typstSource, providerConfig }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        const n = json.data?.persist?.createdCount ?? 0;
        const dup = json.data?.persist?.skippedDuplicateDraftCount ?? 0;
        const ver = json.data?.persist?.skippedVerifiedCount ?? 0;

        const msg =
          n > 0
            ? `${n} draft evidence item${n === 1 ? "" : "s"} created — review in Library`
            : dup > 0 || ver > 0
            ? `No new items — ${dup} already drafted, ${ver} verified (edit in Library)`
            : "No extractable evidence found in this resume.";

        setEvidenceExtractToast(msg);
      } else {
        const detailsStr = json.details ? ` (${JSON.stringify(json.details)})` : "";
        setEvidenceExtractToast((json.error || "Evidence extract failed.") + detailsStr);
      }
      setTimeout(() => setEvidenceExtractToast(null), 8000);
    } catch (err) {
      console.error("Evidence extract failed:", err);
      setEvidenceExtractToast("Evidence extract failed.");
      setTimeout(() => setEvidenceExtractToast(null), 6000);
    } finally {
      setIsExtractingEvidence(false);
    }
  };

  const handleConfirmSaveAsMaster = async () => {
    if (!source || source.trim().length === 0) {
      setDocumentError("Resume source is still loading. Try saving again in a moment.");
      return;
    }
    const shouldExtractEvidence = draftEvidenceFromMaster;
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
        setBaselineSource(source);
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

        if (shouldExtractEvidence) {
          await runEvidenceExtractAfterSave(source);
        }
      } else {
        setDocumentError(json.error || "Failed to save Master Resume.");
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
        setBaselineSource(restoredSource);
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
    <AppShell
      variant="editor"
      isCompiling={isCompiling}
      badge={
          <div className="hidden sm:flex items-center gap-2" data-testid="document-type-badge">
            {docMetadata.type === "MASTER_RESUME" && (
              <span
                data-testid="doc-badge-master"
                className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/60 flex items-center gap-1.5 shadow-sm"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                Master Resume
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
              disabled={isSavingMaster || isLoadingDocument}
              data-testid="save-as-master-btn"
              className="text-xs font-semibold gap-1.5 transition-colors"
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

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                if (isAiPoppedOut) {
                  handleToggleAiPopOut();
                } else if (isAiCollapsed) {
                  toggleAiSidebarCollapse();
                } else {
                  handleToggleAiPopOut();
                }
              }}
              data-testid={isAiCollapsed ? "expand-ai-sidebar-btn" : "toggle-ai-assistant-btn"}
              className={cn(
                "h-8 shrink-0 gap-1.5 text-xs hidden lg:inline-flex transition-all",
                isAiPoppedOut || !isAiCollapsed
                  ? "border-amber-500/50 bg-amber-500/20 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-amber-400"
              )}
              title={
                isAiPoppedOut
                  ? "AI Assistant is popped out in floating window (Click to dock)"
                  : isAiCollapsed
                  ? "Expand AI Assistant"
                  : "Pop out AI Assistant into floating window"
              }
            >
              <Bot className="h-3.5 w-3.5 text-amber-400" />
              <span>AI Assistant</span>
              {isAiPoppedOut && (
                <span className="text-[9px] bg-amber-500/30 px-1 py-0.5 rounded font-mono text-amber-200">
                  POP-OUT
                </span>
              )}
            </Button>

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
              {aiMode === "chat" ? (
                <MessageSquare className="h-3.5 w-3.5" />
              ) : (
                <Bot className="h-3.5 w-3.5" />
              )}
              {aiMode === "chat" ? "Chat" : "Tailor"}
            </Button>
            </div>
          </div>
        }
      >

      {/* Task B1: Explicit Loading & Recoverable Error States */}
      {isLoadingDocument && (
        <div
          data-testid="editor-loading-state"
          className="absolute inset-0 z-30"
          aria-busy="true"
          aria-label="Loading document"
        >
          <EditorWorkspaceSkeleton showNav={false} className="h-full max-h-none" />
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
            className="p-2 text-amber-300 hover:text-white transition min-h-11 min-w-11 inline-flex items-center justify-center"
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
            className="p-2 text-emerald-300 hover:text-white transition min-h-11 min-w-11 inline-flex items-center justify-center"
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

      {evidenceExtractToast && (
        <div
          data-testid="evidence-extract-toast"
          className="flex items-center gap-2 px-4 py-2 bg-sky-950/90 border-b border-sky-800 text-xs text-sky-200"
        >
          <BookOpen className="h-4 w-4 text-sky-400 shrink-0" />
          <span>{evidenceExtractToast}</span>
          {evidenceExtractToast.includes("Library") && (
            <Link
              href="/library"
              className="ml-auto text-sky-300 underline underline-offset-2 hover:text-sky-100"
            >
              Open Library
            </Link>
          )}
        </div>
      )}

      {/* Phase 11: Confirm-Before-Master Fact Freezing Dialog */}
      <ConfirmMasterDialog
        open={showSaveConfirm}
        onOpenChange={setShowSaveConfirm}
        typstSource={source}
        title={docMetadata.title}
        onConfirm={handleConfirmSaveAsMaster}
        isSaving={isSavingMaster}
      />

      {/* Main Workspace Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden bg-background p-2 md:p-3">
        {/* Desktop 3-Panel Resizable Layout (>= lg screens) — client-only to avoid SSR style hydration mismatch */}
        {isLayoutReady ? (
          <ResizablePanelGroup
            id="editor-resizable-panel-group"
            orientation="horizontal"
            onLayoutChange={handleLayoutChange}
            className="hidden lg:flex h-full w-full"
            data-testid="editor-resizable-panel-group"
          >
            {/* Panel 1: CodeMirror Editor */}
            <ResizablePanel
              id="panel-code"
              defaultSize={layout["panel-code"] ?? 45}
              minSize={20}
              className="h-full overflow-hidden"
              data-testid="panel-code"
            >
              <div className="h-full min-h-0">
                <CodeEditor value={source} onChange={handleSourceChange} />
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Panel 2: Live Preview */}
            <ResizablePanel
              id="panel-preview"
              defaultSize={layout["panel-preview"] ?? 35}
              minSize={25}
              className="h-full overflow-hidden"
              data-testid="panel-preview"
            >
              <div className="h-full min-h-0">
                <PreviewPanel
                  svg={svg}
                  error={error}
                  source={source}
                  isCompiling={isCompiling}
                  masterFacts={masterFacts}
                  onResetTemplate={handleResetTemplate}
                  onTriggerRepair={handleTriggerRepair}
                />
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Panel 3: AI Sidebar (Collapsible) */}
            <ResizablePanel
              id="panel-ai"
              panelRef={aiPanelRef}
              defaultSize={isAiCollapsed || isAiPoppedOut ? 0 : (layout["panel-ai"] ?? 20)}
              minSize={15}
              collapsible={true}
              collapsedSize={0}
              onResize={(size) => {
                if (skipResizePersistRef.current) return;
                if (Date.now() < suppressResizePersistUntilRef.current) return;
                const sizeNum = typeof size === "number" ? size : (size as any)?.asPercentage ?? 20;
                const isCurrentlyCollapsed = sizeNum <= 2;
                if (isCurrentlyCollapsed !== isAiCollapsedRef.current) {
                  updateAiCollapsedState(isCurrentlyCollapsed);
                  persistLayoutState(layout, isCurrentlyCollapsed);
                }
              }}
              className="h-full overflow-hidden"
              data-testid="panel-ai"
            >
              <div className="h-full min-h-0">
                <AiSidebar
                  source={source}
                  onApplyToBuffer={handleApplyRepair}
                  isCollapsed={isAiCollapsed}
                  isPoppedOut={false}
                  onPopOut={handleToggleAiPopOut}
                  masterFacts={masterFacts}
                  onToggleCollapse={toggleAiSidebarCollapse}
                  repairContext={repairContext}
                  onDismissRepair={() => setRepairContext(null)}
                  onModeChange={setAiMode}
                />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div
            className="hidden lg:flex h-full w-full"
            data-testid="editor-resizable-panel-group-placeholder"
            aria-hidden
          />
        )}

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
                masterFacts={masterFacts}
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
                masterFacts={masterFacts}
                repairContext={repairContext}
                onDismissRepair={() => setRepairContext(null)}
                onModeChange={setAiMode}
              />
            </div>
          )}
        </div>
      </div>

      {/* Floating Portaled AI Assistant Window */}
      {isAiPoppedOut && (
        <AiAssistantWindow
          open={isAiPoppedOut}
          onOpenChange={(open) => {
            setIsAiPoppedOut(open);
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem("resumeforge_ai_popped_out", String(open));
              } catch {
                // ignore
              }
            }
            if (!open) {
              aiPanelRef.current?.expand();
              updateAiCollapsedState(false);
            }
          }}
          title={aiMode === "chat" ? "AI Chat" : "AI Tailor"}
        >
          <div className="h-full w-full">
            <AiSidebar
              source={source}
              onApplyToBuffer={handleApplyRepair}
              isCollapsed={false}
              isPoppedOut={true}
              onPopOut={handleToggleAiPopOut}
              masterFacts={masterFacts}
              repairContext={repairContext}
              onDismissRepair={() => setRepairContext(null)}
              onModeChange={setAiMode}
            />
          </div>
        </AiAssistantWindow>
      )}
    </AppShell>
  );
}
