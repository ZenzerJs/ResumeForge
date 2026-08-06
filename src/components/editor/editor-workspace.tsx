"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { CodeEditor } from "./code-editor";
import { PreviewPanel } from "./preview-panel";
import { AiSidebar } from "./ai-sidebar";
import { compileTypstToSvg } from "@/lib/typst/compiler";
import { Code2, Eye, Bot, Save, BookOpen, Check, Loader2, Settings } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "resumeforge_typst_source";

export function EditorWorkspace() {
  const [source, setSource] = useState<string>("");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; line?: number } | null>(null);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"editor" | "preview" | "ai">("editor");

  const [isSavingMaster, setIsSavingMaster] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Load initial starter template
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

  // Initialize source from localStorage or starter template
  useEffect(() => {
    async function init() {
      const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (saved && saved.trim().length > 0) {
        setSource(saved);
      } else {
        const starter = await loadStarterTemplate();
        setSource(starter);
      }
    }
    init();
  }, [loadStarterTemplate]);

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
