"use client";

import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
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
import {
  isDocumentPatched,
  markDocumentAsPatched,
  stripPatchedDocumentMarker,
} from "@/lib/guardrail/policy";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { AppShell } from "@/components/design-system/app-shell";
import { clearDemoSamplesForPersonalResume, getDemoContextFromBrowser, initializeDemoSamples } from "@/lib/demo-client";
import { fetchDemoConfig } from "@/components/auth/session-user";
import { EditorWorkspaceSkeleton } from "@/components/editor/editor-workspace-skeleton";

const STORAGE_KEY = "resumeforge_typst_source";
const COMPILE_DEBOUNCE_MS = 400;
const SOURCE_PERSIST_MS = 500;

import { ResumeFacts } from "@/lib/facts/types";
import { extractResumeFacts } from "@/lib/facts/extract";
import { resolveClientProviderConfig } from "@/lib/byok-vault";

const ConfirmMasterDialog = dynamic(
  () => import("./confirm-master-dialog").then((m) => m.ConfirmMasterDialog),
  { ssr: false }
);
const AiAssistantWindow = dynamic(
  () => import("./ai-assistant-window").then((m) => m.AiAssistantWindow),
  { ssr: false }
);

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

const WORKSPACE_PANEL_TABS = [
  { id: "editor", label: "Editor", icon: Code2 },
  { id: "preview", label: "Preview", icon: Eye },
  { id: "ai", label: "AI", icon: Bot },
] as const;

type WorkspacePanelTab = (typeof WORKSPACE_PANEL_TABS)[number]["id"];

interface EditorPaneHosts {
  code: HTMLDivElement;
  preview: HTMLDivElement;
  ai: HTMLDivElement;
}

function PortalSlot({ host, className }: { host: HTMLDivElement | null; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !host) return;
    container.appendChild(host);
    return () => {
      if (host.parentNode === container) {
        container.removeChild(host);
      }
    };
  }, [host]);
  return <div ref={containerRef} className={className} />;
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
  const [activeTab, setActiveTab] = useState<WorkspacePanelTab>("editor");
  const tabRefs = useRef<Record<WorkspacePanelTab, HTMLButtonElement | null>>({
    editor: null,
    preview: null,
    ai: null,
  });

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
  const [pendingRevertDoc, setPendingRevertDoc] = useState<{
    id: string | null;
    title: string;
  } | null>(null);
  const [lastSnapshotId, setLastSnapshotId] = useState<string | null>(null);
  const [isUndoing, setIsUndoing] = useState<boolean>(false);
  const [undoSuccess, setUndoSuccess] = useState<boolean>(false);
  const [draftEvidenceFromMaster, setDraftEvidenceFromMaster] = useState<boolean>(true);
  const [evidenceExtractToast, setEvidenceExtractToast] = useState<string | null>(null);
  const [isExtractingEvidence, setIsExtractingEvidence] = useState<boolean>(false);
  // Phase 11: Master Fact Snapshot state (strictly from frozen Master Resume + verified Evidence Bank)
  const [masterFacts, setMasterFacts] = useState<ResumeFacts | null>(null);
  const [hasAiPatchedBuffer, setHasAiPatchedBuffer] = useState<boolean>(false);

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
  const [isAiSheetOpen, setIsAiSheetOpen] = useState<boolean>(false);
  const [aiMode, setAiMode] = useState<"chat" | "tailor">("chat");
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [isXlDesktop, setIsXlDesktop] = useState(true);
  const [hosts, setHosts] = useState<EditorPaneHosts | null>(null);
  const isDesktopRef = useRef<boolean>(true);
  const isXlDesktopRef = useRef<boolean>(true);
  const isAiCollapsedRef = useRef<boolean>(isAiCollapsed);
  const isAiPoppedOutRef = useRef<boolean>(isAiPoppedOut);
  const skipResizePersistRef = useRef(false);
  const suppressResizePersistUntilRef = useRef(0);

  useEffect(() => {
    const mqLg = window.matchMedia("(min-width: 1024px)");
    const mqXl = window.matchMedia("(min-width: 1280px)");
    const sync = () => {
      suppressResizePersistUntilRef.current = Date.now() + 750;
      isDesktopRef.current = mqLg.matches;
      isXlDesktopRef.current = mqXl.matches;
      setIsDesktop(mqLg.matches);
      setIsXlDesktop(mqXl.matches);
      if (mqXl.matches || !mqLg.matches) {
        setIsAiSheetOpen(false);
      }
    };
    sync();
    mqLg.addEventListener("change", sync);
    mqXl.addEventListener("change", sync);
    return () => {
      mqLg.removeEventListener("change", sync);
      mqXl.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    const makeHost = () => {
      const el = document.createElement("div");
      el.className = "h-full w-full min-h-0";
      return el;
    };
    setHosts({ code: makeHost(), preview: makeHost(), ai: makeHost() });

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
        isAiPoppedOutRef.current = true;
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

  useEffect(() => {
    isAiPoppedOutRef.current = isAiPoppedOut;
  }, [isAiPoppedOut]);

  const updateAiCollapsedState = useCallback((collapsed: boolean) => {
    setIsAiCollapsed(collapsed);
    isAiCollapsedRef.current = collapsed;
  }, []);

  // Collapse panel on mount (or when returning to >=1280px) if layout was persisted as collapsed or popped out
  useEffect(() => {
    if (!isLayoutReady || !isXlDesktop) return;
    if (isAiCollapsed || isAiPoppedOut) {
      suppressResizePersistUntilRef.current = Date.now() + 750;
      const timer = setTimeout(() => {
        aiPanelRef.current?.collapse();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [aiPanelRef, isAiCollapsed, isAiPoppedOut, isXlDesktop, isLayoutReady]);

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

  const handleLayoutChange = useCallback((layoutData: Record<string, number> | number[]) => {
    if (!isXlDesktopRef.current) return;
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
      isAiPoppedOutRef.current = next;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("resumeforge_ai_popped_out", String(next));
        } catch {
          // ignore
        }
      }
      if (isXlDesktopRef.current) {
        if (next) {
          aiPanelRef.current?.collapse();
          updateAiCollapsedState(true);
        } else {
          aiPanelRef.current?.expand();
          updateAiCollapsedState(false);
        }
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
        if (process.env.NEXT_PUBLIC_RESUME_LAYOUT_V2 === "true") {
          const [{ parseTypstToStructuredModel, legacyFormToResumeDocument }, { renderResumeDocument }] = await Promise.all([
            import("./resume-form-builder"), import("@/lib/typst/resume-document"),
          ]);
          return renderResumeDocument(legacyFormToResumeDocument(parseTypstToStructuredModel(text)));
        }
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
   * 3. no param: fetch GET /api/resumes to load canonical PostgreSQL master resume
   * 4. fallback: localStorage or starter template only when no DB record exists
   */
  const loadGeneration = useRef(0);

  const loadFrozenMasterSnapshot = useCallback(async () => {
    try {
      const demoConfig = await fetchDemoConfig();
      if (demoConfig?.demoMode) {
        const rawSnapshot = localStorage.getItem("resumeforge_demo_master_facts");
        setMasterFacts(rawSnapshot ? JSON.parse(rawSnapshot) as ResumeFacts : null);
        return;
      }
      const [resumesRes, evidRes] = await Promise.all([
        fetch("/api/resumes").catch(() => null),
        fetch("/api/evidence").catch(() => null),
      ]);
      const resumesJson = resumesRes && resumesRes.ok ? await resumesRes.json().catch(() => null) : null;
      const evidJson = evidRes && evidRes.ok ? await evidRes.json().catch(() => null) : null;

      const resumesList = Array.isArray(resumesJson?.data) ? resumesJson.data : [];
      const frozenMaster = resumesList.find((r: { isMaster?: boolean; typstSource?: string }) => r.isMaster && r.typstSource);
      const verifiedEvidence = Array.isArray(evidJson?.data) ? evidJson.data : [];

      if (frozenMaster?.typstSource) {
        setMasterFacts(extractResumeFacts(frozenMaster.typstSource, verifiedEvidence));
      } else {
        setMasterFacts(null);
      }
    } catch {
      setMasterFacts(null);
    }
  }, []);

  const loadCanonicalDocument = useCallback(async () => {
    const generation = ++loadGeneration.current;
    const current = () => generation === loadGeneration.current;
    setIsLoadingDocument(true);
    setDocumentError(null);
    const persistedAiPatched =
      typeof window !== "undefined" &&
      sessionStorage.getItem("resumeforge_ai_patched_buffer") === "true";
    setHasAiPatchedBuffer(persistedAiPatched);
    try {
      const demoConfig = await fetchDemoConfig();
      if (demoConfig?.demoMode) {
        initializeDemoSamples();
        const personalSource = localStorage.getItem(STORAGE_KEY);
        if (personalSource?.trim()) clearDemoSamplesForPersonalResume(personalSource);
        await loadFrozenMasterSnapshot();
        const localSource = localStorage.getItem(STORAGE_KEY);
        if (current()) {
          if (localSource?.trim()) {
            setSource(localSource);
            setDocMetadata({
              type: "LOCAL_FALLBACK",
              title: localSource.includes("// Synthetic sample.") ? "Synthetic Sample Draft" : "Local Draft",
            });
          } else {
            const starter = await loadStarterTemplate();
            if (!current()) return;
            setSource(starter);
            setDocMetadata({ type: "LOCAL_FALLBACK", title: "Local Draft" });
            localStorage.setItem(STORAGE_KEY, starter);
            localStorage.setItem("resumeforge_has_guest_draft", "true");
          }
          setIsLoadingDocument(false);
        }
        return;
      }
      void loadFrozenMasterSnapshot();
      // Priority 1: variantId param
      if (variantIdParam && variantIdParam.trim().length > 0) {
        const res = await fetch(`/api/variants/${variantIdParam.trim()}`);
        const json = await res.json();
        if (res.ok && json.success && json.data) {
          if (!current()) return;
          setSource(json.data.typstContent);
          setDocMetadata({
            type: "RESUME_VARIANT",
            title: json.data.variantTitle || "Tailored Variant",
            id: json.data.id,
          });
          setIsLoadingDocument(false);
          return;
        } else {
          if (!current()) return;
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
          if (!current()) return;
          setSource(json.data.typstSource);
          setDocMetadata({
            type: json.data.isMaster ? "MASTER_RESUME" : "LOCAL_FALLBACK",
            title: json.data.title || (json.data.isMaster ? "Master Resume" : "Resume"),
            id: json.data.id,
          });
          setIsLoadingDocument(false);
          return;
        } else {
          if (!current()) return;
          setDocumentError(json.error || `Resume not found: ${resumeIdParam}`);
          setIsLoadingDocument(false);
          return;
        }
      }

      // Priority 3: No param -> fetch canonical PostgreSQL master resume
      const res = await fetch("/api/resumes");
      const json = await res.json();
      if (res.ok && json.success && Array.isArray(json.data) && json.data.length > 0) {
        if (!current()) return;
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
          localStorage.setItem("resumeforge_draft_migrated", "true");
          localStorage.removeItem("resumeforge_has_guest_draft");
        }
        setIsLoadingDocument(false);
        return;
      }
    } catch (err) {
      console.error("Database document fetch error:", err);
    }

    if (!current()) return;
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
      if (!current()) return;
      setSource(starter);
      setDocMetadata({
        type: "LOCAL_FALLBACK",
        title: "Starter Template",
      });
    }

    setIsLoadingDocument(false);
  }, [variantIdParam, resumeIdParam, loadStarterTemplate, loadFrozenMasterSnapshot]);

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
    void loadCanonicalDocument();
    return () => {
      loadGeneration.current += 1;
    };
  }, [loadCanonicalDocument]);

  const compileGeneration = useRef(0);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uiTimers = useRef<number[]>([]);

  const scheduleUiTimer = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    uiTimers.current.push(id);
  };

  useEffect(() => {
    const timers = uiTimers.current;
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      for (const id of timers) window.clearTimeout(id);
    };
  }, []);

  const runCompile = useCallback(async (codeToCompile: string) => {
    if (!codeToCompile || codeToCompile.trim().length === 0) return;
    const generation = ++compileGeneration.current;
    setIsCompiling(true);

    const { compileTypstToSvg } = await import("@/lib/typst/compiler");
    const result = await compileTypstToSvg(codeToCompile, {
      callerId: "editor-workspace",
      mode: "live",
    });
    if (generation !== compileGeneration.current || ("superseded" in result && result.superseded)) {
      return;
    }

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
    scheduleUiTimer(() => setShowShortcutSaveToast(false), 2000);

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

  const handleSourceChange = useCallback((newVal: string) => {
    setSource(newVal);
    if (typeof window === "undefined") return;
    clearDemoSamplesForPersonalResume(newVal);
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, newVal);
    }, SOURCE_PERSIST_MS);
  }, []);

  const handleTriggerRepair = useCallback(
    (context: { compileError: string; line?: number; column?: number; sourceExcerpt?: string }) => {
      setRepairContext(context);
      if (isXlDesktopRef.current && isAiCollapsedRef.current && !isAiPoppedOutRef.current && aiPanelRef.current) {
        aiPanelRef.current.expand();
        updateAiCollapsedState(false);
      } else if (isDesktopRef.current && !isXlDesktopRef.current) {
        setIsAiSheetOpen(true);
      }
      setActiveTab("ai");
    },
    [aiPanelRef, updateAiCollapsedState]
  );

  const handleTabListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = WORKSPACE_PANEL_TABS.findIndex((t) => t.id === activeTab);
      if (currentIndex === -1) return;
      let nextIndex: number | null = null;
      if (e.key === "ArrowRight") {
        nextIndex = (currentIndex + 1) % WORKSPACE_PANEL_TABS.length;
      } else if (e.key === "ArrowLeft") {
        nextIndex = (currentIndex - 1 + WORKSPACE_PANEL_TABS.length) % WORKSPACE_PANEL_TABS.length;
      } else if (e.key === "Home") {
        nextIndex = 0;
      } else if (e.key === "End") {
        nextIndex = WORKSPACE_PANEL_TABS.length - 1;
      }
      if (nextIndex === null) return;
      e.preventDefault();
      const nextTab = WORKSPACE_PANEL_TABS[nextIndex].id;
      setActiveTab(nextTab);
      tabRefs.current[nextTab]?.focus();
    },
    [activeTab]
  );

  const handleApplyRepair = useCallback(
    (newSource: string) => {
      const patchedSource = markDocumentAsPatched(newSource);
      setHasAiPatchedBuffer(true);
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem("resumeforge_ai_patched_buffer", "true");
        } catch {
          // ignore
        }
      }
      handleSourceChange(patchedSource);
      runCompile(patchedSource);
    },
    [runCompile, handleSourceChange]
  );

  const handleResetTemplate = async () => {
    setHasAiPatchedBuffer(false);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("resumeforge_ai_patched_buffer");
      } catch {
        // ignore
      }
    }
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
      const providerConfig = await resolveClientProviderConfig();
      if (!providerConfig) {
        setEvidenceExtractToast("Configure an AI provider in Settings to draft Evidence Bank items.");
        scheduleUiTimer(() => setEvidenceExtractToast(null), 8000);
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
      scheduleUiTimer(() => setEvidenceExtractToast(null), 8000);
    } catch (err) {
      console.error("Evidence extract failed:", err);
      setEvidenceExtractToast("Evidence extract failed.");
      scheduleUiTimer(() => setEvidenceExtractToast(null), 6000);
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
    const cleanMasterSource = stripPatchedDocumentMarker(source);
    try {
      setIsSavingMaster(true);
      setSaveSuccess(false);

      const demoConfig = await fetchDemoConfig();
      if (demoConfig?.demoMode) {
        const demoContext = getDemoContextFromBrowser();
        const facts = extractResumeFacts(cleanMasterSource, demoContext?.evidenceItems || []);
        localStorage.setItem("resumeforge_demo_master_facts", JSON.stringify(facts));
        localStorage.setItem(STORAGE_KEY, cleanMasterSource);
        localStorage.setItem("resumeforge_has_guest_draft", "true");
        setMasterFacts(facts);
        setSource(cleanMasterSource);
        setBaselineSource(cleanMasterSource);
        setDocMetadata({ type: "MASTER_RESUME", title: "Local Master Resume", id: "demo-local-master" });
        setHasAiPatchedBuffer(false);
        sessionStorage.removeItem("resumeforge_ai_patched_buffer");
        setShowSaveConfirm(false);
        setSaveSuccess(true);
        scheduleUiTimer(() => setSaveSuccess(false), 3000);
        return;
      }

      const res = await fetch("/api/resumes/save-master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: docMetadata.id,
          title: "Master Resume",
          typstSource: cleanMasterSource,
          confirmOverwrite: true,
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setSaveSuccess(true);
        setSource(cleanMasterSource);
        setBaselineSource(cleanMasterSource);
        if (json.snapshotId) {
          setLastSnapshotId(json.snapshotId);
        }
        setDocMetadata({
          type: "MASTER_RESUME",
          title: "Master Resume",
          id: json.data?.id,
        });
        setHasAiPatchedBuffer(false);
        void loadFrozenMasterSnapshot();
        if (typeof window !== "undefined") {
          localStorage.setItem("resumeforge_draft_migrated", "true");
          localStorage.removeItem("resumeforge_has_guest_draft");
          sessionStorage.removeItem("resumeforge_ai_patched_buffer");
        }
        setShowSaveConfirm(false);
        scheduleUiTimer(() => setSaveSuccess(false), 3000);

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

  const handleRevertToMaster = () => {
    setPendingRevertDoc({
      id: docMetadata.id ?? null,
      title: docMetadata.title || "current document",
    });
  };

  const performRevertToMaster = async (expectedDocId: string | null) => {
    if ((docMetadata.id ?? null) !== expectedDocId) {
      setPendingRevertDoc(null);
      return;
    }
    await loadCanonicalDocument();
    setLastSnapshotId(null);
    setPendingRevertDoc(null);
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
        scheduleUiTimer(() => setUndoSuccess(false), 3000);
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
                className="text-xs font-semibold px-2 py-0.5 rounded bg-elevated text-foreground border border-primary/40 flex items-center gap-1.5 whitespace-nowrap"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Master Resume
              </span>
            )}
            {docMetadata.type === "RESUME_VARIANT" && (
              <span
                data-testid="doc-badge-variant"
                className="text-xs font-semibold px-2 py-0.5 rounded bg-elevated text-foreground border border-status-info/40 flex items-center gap-1.5 whitespace-nowrap"
              >
                <Sparkles className="h-3.5 w-3.5 text-status-info" />
                Tailored Variant ({docMetadata.title})
              </span>
            )}
            {docMetadata.type === "LOCAL_FALLBACK" && (
              <span
                data-testid="doc-badge-fallback"
                className="text-xs font-semibold px-2 py-0.5 rounded bg-elevated text-text-secondary border border-outline/70 flex items-center gap-1.5 whitespace-nowrap"
              >
                <FileText className="h-3.5 w-3.5 text-text-muted" />
                {docMetadata.title}
              </span>
            )}
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            {showShortcutSaveToast && (
              <div
                data-testid="shortcut-save-toast"
                className="flex items-center gap-1.5 px-2.5 py-0.5 bg-elevated border border-status-success/60 text-foreground text-xs font-semibold rounded transition-all"
              >
                <Check className="h-3.5 w-3.5 text-status-success" />
                <span>Draft Saved &amp; Recompiled</span>
              </div>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleRevertToMaster}
              data-testid="revert-to-master-btn"
              className="min-h-10 xl:min-h-0 xl:h-7 px-2.5 text-xs border-outline/70 bg-transparent text-text-secondary hover:bg-elevated hover:text-foreground gap-1.5 focus-visible:ring-2 focus-visible:ring-ring"
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
              className={cn(
                "min-h-10 xl:min-h-0 xl:h-7 px-3 text-xs font-semibold gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                saveSuccess
                  ? "bg-status-success text-secondary-foreground hover:bg-status-success/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
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
                if (!isXlDesktop) {
                  setIsAiSheetOpen((prev) => !prev);
                } else if (isAiPoppedOut) {
                  handleToggleAiPopOut();
                } else if (isAiCollapsed) {
                  toggleAiSidebarCollapse();
                } else {
                  handleToggleAiPopOut();
                }
              }}
              data-testid={
                !isXlDesktop
                  ? isAiSheetOpen
                    ? "toggle-ai-assistant-btn"
                    : "expand-ai-sidebar-btn"
                  : isAiCollapsed
                    ? "expand-ai-sidebar-btn"
                    : "toggle-ai-assistant-btn"
              }
              className={cn(
                "h-7 shrink-0 gap-1.5 px-2.5 text-xs hidden lg:inline-flex transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                (isXlDesktop ? isAiPoppedOut || !isAiCollapsed : isAiSheetOpen)
                  ? "border-primary/60 bg-primary/15 text-primary hover:bg-primary/20"
                  : "border-outline/70 bg-elevated text-text-secondary hover:bg-muted hover:text-foreground"
              )}
              title={
                !isXlDesktop
                  ? isAiSheetOpen
                    ? "Close AI Assistant"
                    : "Open AI Assistant"
                  : isAiPoppedOut
                    ? "AI Assistant is popped out in floating window (Click to dock)"
                    : isAiCollapsed
                      ? "Expand AI Assistant"
                      : "Pop out AI Assistant into floating window"
              }
            >
              <Bot className="h-3.5 w-3.5 text-primary" />
              <span>AI Assistant</span>
              {isXlDesktop && isAiPoppedOut && (
                <span className="text-xs bg-primary/20 px-1 py-0.5 rounded font-mono text-primary">
                  POP-OUT
                </span>
              )}
            </Button>
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

      {(documentError ||
        (!isConversionBannerDismissed &&
          (source.includes("// @conversion-path: fallback") ||
            source.includes("// @conversion-path: ai"))) ||
        lastSnapshotId ||
        undoSuccess ||
        evidenceExtractToast) && (
        <div data-testid="editor-banner-slot" className="shrink-0 divide-y divide-hairline">
          {documentError && (
            <div
              data-testid="editor-error-state"
              className="flex items-center justify-between gap-2 px-4 py-1.5 bg-status-danger/10 border-b border-status-danger/30 text-xs text-status-danger"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-status-danger" />
                <span>{documentError}</span>
              </div>
              <button
                type="button"
                onClick={() => setDocumentError(null)}
                className="px-2.5 py-0.5 bg-status-danger/15 hover:bg-status-danger/25 text-foreground border border-status-danger/30 rounded text-xs font-medium transition"
              >
                Dismiss Error
              </button>
            </div>
          )}

          {/* Task 9.1: PDF Conversion Status Banners */}
          {!isConversionBannerDismissed && source.includes("// @conversion-path: fallback") && (
            <div
              data-testid="pdf-conversion-fallback-banner"
              className="flex items-center justify-between gap-2 px-4 py-1.5 bg-primary/10 border-b border-primary/30 text-xs text-primary"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>AI conversion unavailable — used basic formatting</span>
              </div>
              <button
                type="button"
                onClick={handleDismissConversionBanner}
                className="p-1 text-primary/80 hover:text-foreground transition inline-flex items-center justify-center rounded"
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
              className="flex items-center justify-between gap-2 px-4 py-1.5 bg-status-success/15 border-b border-status-success/35 text-xs text-status-info"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-status-success" />
                <span>AI-Converted Draft — Converted using BYOK AI provider</span>
              </div>
              <button
                type="button"
                onClick={handleDismissConversionBanner}
                className="p-1 text-status-info hover:text-foreground transition inline-flex items-center justify-center rounded"
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
              className="flex items-center justify-between gap-2 px-4 py-1.5 bg-primary/10 border-b border-primary/30 text-xs text-foreground"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>Master Resume overwritten. A pre-save snapshot was saved to database history.</span>
              </div>
              <button
                type="button"
                onClick={handleUndoOverwrite}
                disabled={isUndoing}
                data-testid="undo-overwrite-btn"
                className="flex items-center gap-1.5 px-2.5 py-0.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded text-xs font-semibold transition"
              >
                {isUndoing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                Undo Overwrite
              </button>
            </div>
          )}

          {undoSuccess && (
            <div
              data-testid="undo-success-banner"
              className="flex items-center gap-2 px-4 py-1.5 bg-status-success/15 border-b border-status-success/35 text-xs text-status-info"
            >
              <Check className="h-3.5 w-3.5 text-status-success" />
              <span>Restored Master Resume to pre-overwrite snapshot!</span>
            </div>
          )}

          {evidenceExtractToast && (
            <div
              data-testid="evidence-extract-toast"
              className="flex items-center gap-2 px-4 py-1.5 bg-status-info/10 border-b border-status-info/30 text-xs text-foreground"
            >
              <BookOpen className="h-3.5 w-3.5 text-status-info shrink-0" />
              <span>{evidenceExtractToast}</span>
              {evidenceExtractToast.includes("Library") && (
                <Link
                  href="/library"
                  className="ml-auto text-status-info underline underline-offset-2 hover:text-foreground"
                >
                  Open Library
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Phase 11: Confirm-Before-Master Fact Freezing Dialog */}
      <ConfirmMasterDialog
        open={showSaveConfirm}
        onOpenChange={setShowSaveConfirm}
        typstSource={source}
        priorSource={baselineSource}
        title={docMetadata.title}
        onConfirm={handleConfirmSaveAsMaster}
        isSaving={isSavingMaster}
      />

      {/* Main Workspace Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden bg-canvas px-1.5 pb-1.5 pt-0">
        {/* Desktop Resizable Layout (2-pane at >= lg, 3-pane at >= xl) vs Mobile/Tablet Tabbed View (< lg) */}
        {isDesktop ? (
          isLayoutReady && hosts ? (
            <ResizablePanelGroup
              key={isXlDesktop ? "3-pane" : "2-pane"}
              id="editor-resizable-panel-group"
              orientation="horizontal"
              onLayoutChange={handleLayoutChange}
              className="hidden lg:flex h-full w-full"
              data-testid="editor-resizable-panel-group"
            >
              {/* Panel 1: CodeMirror Editor */}
              <ResizablePanel
                id="panel-code"
                defaultSize={isXlDesktop ? (layout["panel-code"] ?? 45) : 50}
                minSize={20}
                className="h-full overflow-hidden"
                data-testid="panel-code"
              >
                <PortalSlot host={hosts.code} className="h-full min-h-0" />
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Panel 2: Live Preview */}
              <ResizablePanel
                id="panel-preview"
                defaultSize={isXlDesktop ? (layout["panel-preview"] ?? 35) : 50}
                minSize={25}
                className="h-full overflow-hidden"
                data-testid="panel-preview"
              >
                <PortalSlot host={hosts.preview} className="h-full min-h-0" />
              </ResizablePanel>

              {isXlDesktop && (
                <>
                  <ResizableHandle withHandle />

                  {/* Panel 3: AI Sidebar (Collapsible, >= xl) */}
                  <ResizablePanel
                    id="panel-ai"
                    panelRef={aiPanelRef}
                    defaultSize={isAiCollapsed || isAiPoppedOut ? 0 : (layout["panel-ai"] ?? 20)}
                    minSize={15}
                    collapsible={true}
                    collapsedSize={0}
                    onResize={(size) => {
                      if (!isXlDesktopRef.current) return;
                      if (skipResizePersistRef.current) return;
                      if (Date.now() < suppressResizePersistUntilRef.current) return;
                      const sizeNum =
                        typeof size === "number"
                          ? size
                          : typeof size === "object" &&
                              size !== null &&
                              "asPercentage" in size &&
                              typeof size.asPercentage === "number"
                            ? size.asPercentage
                            : 20;
                      const isCurrentlyCollapsed = sizeNum <= 2;
                      if (isCurrentlyCollapsed !== isAiCollapsedRef.current) {
                        updateAiCollapsedState(isCurrentlyCollapsed);
                        persistLayoutState(layout, isCurrentlyCollapsed);
                      }
                    }}
                    className="h-full overflow-hidden"
                    data-testid="panel-ai"
                  >
                    {!isAiPoppedOut ? (
                      <PortalSlot host={hosts.ai} className="h-full min-h-0" />
                    ) : (
                      <div className="h-full min-h-0" />
                    )}
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          ) : (
            <div
              className="hidden lg:flex h-full w-full"
              data-testid="editor-resizable-panel-group-placeholder"
              aria-hidden
            />
          )
        ) : (
          <div className="flex h-full w-full flex-col lg:hidden" data-testid="editor-mobile-tabs">
            <div className="flex shrink-0 items-center border-b border-outline/70 bg-panel px-2 py-1.5">
              <div
                role="tablist"
                aria-label="Workspace panels"
                onKeyDown={handleTabListKeyDown}
                className="grid w-full grid-cols-3 gap-1 rounded-[6px] border border-outline/70 bg-inset p-0.5 sm:inline-flex sm:w-auto"
              >
                {WORKSPACE_PANEL_TABS.map(({ id, label, icon: Icon }) => {
                  const selected = activeTab === id;
                  return (
                    <button
                      key={id}
                      ref={(el) => {
                        tabRefs.current[id] = el;
                      }}
                      type="button"
                      role="tab"
                      id={`workspace-tab-${id}`}
                      aria-selected={selected}
                      aria-controls={`workspace-tabpanel-${id}`}
                      tabIndex={selected ? 0 : -1}
                      data-state={selected ? "active" : "inactive"}
                      data-testid={`editor-tab-${id}`}
                      onClick={() => setActiveTab(id)}
                      className={cn(
                        "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[4px] px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8",
                        selected
                          ? "bg-primary font-semibold text-primary-foreground shadow-xs"
                          : "font-medium text-text-secondary hover:bg-elevated/60 hover:text-foreground"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              role="tabpanel"
              id="workspace-tabpanel-editor"
              aria-labelledby="workspace-tab-editor"
              hidden={activeTab !== "editor"}
              tabIndex={activeTab === "editor" ? 0 : -1}
              className={cn(
                "min-h-0 flex-1 overflow-hidden focus-visible:outline-none",
                activeTab !== "editor" && "hidden"
              )}
            >
              <PortalSlot host={hosts?.code ?? null} className="h-full w-full overflow-hidden" />
            </div>
            <div
              role="tabpanel"
              id="workspace-tabpanel-preview"
              aria-labelledby="workspace-tab-preview"
              hidden={activeTab !== "preview"}
              tabIndex={activeTab === "preview" ? 0 : -1}
              className={cn(
                "min-h-0 flex-1 overflow-hidden focus-visible:outline-none",
                activeTab !== "preview" && "hidden"
              )}
            >
              <PortalSlot host={hosts?.preview ?? null} className="h-full w-full overflow-hidden" />
            </div>
            <div
              role="tabpanel"
              id="workspace-tabpanel-ai"
              aria-labelledby="workspace-tab-ai"
              hidden={activeTab !== "ai"}
              tabIndex={activeTab === "ai" ? 0 : -1}
              className={cn(
                "min-h-0 flex-1 overflow-hidden focus-visible:outline-none",
                activeTab !== "ai" && "hidden"
              )}
            >
              <PortalSlot host={hosts?.ai ?? null} className="h-full w-full overflow-hidden" />
            </div>
          </div>
        )}
      </div>

      {/* AI Assistant Drawer (lg 1024px–1279px two-pane layout) */}
      {isDesktop && !isXlDesktop && hosts && (
        <Sheet open={isAiSheetOpen} onOpenChange={setIsAiSheetOpen}>
          <SheetContent
            side="right"
            hideCloseButton
            data-testid="editor-ai-sheet"
            className="flex w-[400px] flex-col border-l border-outline bg-panel p-0 sm:max-w-[420px]"
          >
            <SheetTitle className="sr-only">AI Assistant</SheetTitle>
            <SheetDescription className="sr-only">
              AI Chat and Tailor Assistant
            </SheetDescription>
            <PortalSlot host={hosts.ai} className="h-full min-h-0 flex-1" />
          </SheetContent>
        </Sheet>
      )}

      {/* Floating Portaled AI Assistant Window (desktop >=1280px only) */}
      {isXlDesktop && isAiPoppedOut && hosts && (
        <AiAssistantWindow
          open={isAiPoppedOut}
          onOpenChange={(open) => {
            setIsAiPoppedOut(open);
            isAiPoppedOutRef.current = open;
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem("resumeforge_ai_popped_out", String(open));
              } catch {
                // ignore
              }
            }
            if (!open && isXlDesktopRef.current) {
              aiPanelRef.current?.expand();
              updateAiCollapsedState(false);
            }
          }}
          title={aiMode === "chat" ? "AI Chat" : "AI Tailor"}
        >
          <PortalSlot host={hosts.ai} className="h-full w-full" />
        </AiAssistantWindow>
      )}

      {/* Persistent pane portals preserve CodeMirror selection/undo and AI state across tabs and resizes */}
      {hosts &&
        createPortal(
          <CodeEditor value={source} onChange={handleSourceChange} />,
          hosts.code
        )}
      {hosts &&
        createPortal(
          <PreviewPanel
            svg={svg}
            error={error}
            source={source}
            isCompiling={isCompiling}
            masterFacts={masterFacts}
            allowUnfrozenMasterSelfExport={
              docMetadata.type === "MASTER_RESUME" ||
              (docMetadata.type === "LOCAL_FALLBACK" &&
                !hasAiPatchedBuffer &&
                !isDocumentPatched(source))
            }
            onApplyLayout={handleSourceChange}
            onResetTemplate={handleResetTemplate}
            onTriggerRepair={handleTriggerRepair}
          />,
          hosts.preview
        )}
      {hosts &&
        createPortal(
          <AiSidebar
            source={source}
            onApplyToBuffer={handleApplyRepair}
            isCollapsed={isXlDesktop ? (isAiPoppedOut ? false : isAiCollapsed) : false}
            isPoppedOut={isXlDesktop ? isAiPoppedOut : false}
            onPopOut={isXlDesktop ? handleToggleAiPopOut : undefined}
            masterFacts={masterFacts}
            onToggleCollapse={
              isXlDesktop && !isAiPoppedOut
                ? toggleAiSidebarCollapse
                : isDesktop && !isXlDesktop
                  ? () => setIsAiSheetOpen(false)
                  : undefined
            }
            repairContext={repairContext}
            onDismissRepair={() => setRepairContext(null)}
            onModeChange={setAiMode}
          />,
          hosts.ai
        )}

      <ConfirmDialog
        open={Boolean(pendingRevertDoc)}
        onOpenChange={(open) => {
          if (!open) setPendingRevertDoc(null);
        }}
        title="Revert to Master Resume"
        description={
          pendingRevertDoc
            ? `Revert "${pendingRevertDoc.title}" to the persisted Master Resume? Any unsaved edits in this live buffer will be discarded.`
            : ""
        }
        confirmLabel="Revert Buffer"
        tone="destructive"
        dialogTestId="revert-master-confirm-modal"
        confirmTestId="confirm-revert-master-btn"
        cancelTestId="cancel-revert-master-btn"
        onConfirm={() =>
          performRevertToMaster(pendingRevertDoc?.id ?? null)
        }
      />
    </AppShell>
  );
}
