"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CodeEditor } from "./code-editor";
import { PreviewPanel } from "./preview-panel";
import { AiSidebar } from "./ai-sidebar";
import { compileTypstToSvg } from "@/lib/typst/compiler";
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
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const [error, setError] = useState<{ message: string; line?: number } | null>(null);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"editor" | "preview" | "ai">("editor");

  const [isSavingMaster, setIsSavingMaster] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Task B1: Canonical Document Loading & Metadata State
  const [isLoadingDocument, setIsLoadingDocument] = useState<boolean>(true);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [docMetadata, setDocMetadata] = useState<DocumentMetadata>({
    type: "LOCAL_FALLBACK",
    title: "Local Workspace",
  });

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

  const handleSourceChange = (newVal: string) => {
    setSource(newVal);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, newVal);
    }
  };

  const handleResetTemplate = async () => {
    const starter = await loadStarterTemplate();
    handleSourceChange(starter);
  };

  const handleSaveAsMaster = async () => {
    if (!source || source.trim().length === 0) return;
    try {
      setIsSavingMaster(true);
      setSaveSuccess(false);

      const res = await fetch("/api/resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Master Resume",
          typstSource: source,
          isMaster: true,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        // Refresh canonical metadata
        setDocMetadata({
          type: "MASTER_RESUME",
          title: "Master Resume",
        });
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save master resume:", err);
    } finally {
      setIsSavingMaster(false);
    }
  };

  return (
    <div className="dark flex h-dvh w-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Top Navbar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Primary">
          <Link
            href="/"
            className="mr-1 flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground shadow-sm">
              R
            </div>
            <span className="text-sm font-semibold tracking-tight">
              ResumeForge
            </span>
          </Link>

          <span className="mx-1 hidden h-4 w-px bg-border sm:block" aria-hidden />

          {/* Task B1: Explicit Document Type Indicator Badge */}
          <div className="hidden sm:flex items-center gap-2" data-testid="document-type-badge">
            {docMetadata.type === "MASTER_RESUME" && (
              <span
                data-testid="doc-badge-master"
                className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800 flex items-center gap-1.5 shadow-sm"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Master Resume ({docMetadata.title})
              </span>
            )}

            {docMetadata.type === "RESUME_VARIANT" && (
              <span
                data-testid="doc-badge-variant"
                className="text-xs font-semibold px-2.5 py-1 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800 flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                Tailored Variant ({docMetadata.title})
              </span>
            )}

            {docMetadata.type === "LOCAL_FALLBACK" && (
              <span
                data-testid="doc-badge-fallback"
                className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-900 text-slate-300 border border-slate-700 flex items-center gap-1.5"
              >
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                {docMetadata.title}
              </span>
            )}
          </div>

          <span className="mx-1 hidden h-4 w-px bg-border sm:block" aria-hidden />

          <Link
            href="/library"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-muted-foreground hover:text-foreground",
            )}
          >
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            Evidence Library
          </Link>

          <Link
            href="/tracker"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-muted-foreground hover:text-foreground",
            )}
          >
            <Briefcase className="h-3.5 w-3.5 text-indigo-400" />
            Tracker
          </Link>

          <Link
            href="/settings"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-muted-foreground hover:text-foreground",
            )}
          >
            <Settings className="h-3.5 w-3.5 text-primary" />
            AI Settings
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleSaveAsMaster}
            disabled={isSavingMaster}
            className="bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
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
      </header>

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
          className="flex items-center justify-between px-4 py-2 bg-red-950/80 border-b border-red-800 text-xs text-red-300"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <span>Document error: {documentError}</span>
          </div>
          <button
            type="button"
            onClick={loadCanonicalDocument}
            className="px-2 py-1 bg-red-900 hover:bg-red-800 text-white rounded text-[11px] font-mono transition"
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* Main Workspace Body */}
      <main className="flex flex-1 overflow-hidden bg-background p-2 md:p-3">
        {/* Desktop 3-Panel Grid (>= lg screens) */}
        <div className="hidden lg:grid h-full w-full grid-cols-12 gap-3">
          {/* Panel 1: CodeMirror Editor (5 cols) */}
          <div className="col-span-5 h-full overflow-hidden">
            <CodeEditor value={source} onChange={handleSourceChange} />
          </div>

          {/* Panel 2: Live Preview (4 cols) */}
          <div className="col-span-4 h-full overflow-hidden">
            <PreviewPanel
              svg={svg}
              error={error}
              source={source}
              isCompiling={isCompiling}
              onResetTemplate={handleResetTemplate}
            />
          </div>

          {/* Panel 3: AI Sidebar (3 cols) */}
          <div className="col-span-3 h-full overflow-hidden">
            <AiSidebar />
          </div>
        </div>

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
              />
            </div>
          )}
          {activeTab === "ai" && (
            <div className="h-full w-full overflow-hidden">
              <AiSidebar />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
