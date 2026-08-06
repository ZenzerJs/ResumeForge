"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { CodeEditor } from "./code-editor";
import { PreviewPanel } from "./preview-panel";
import { AiSidebar } from "./ai-sidebar";
import { compileTypstToSvg } from "@/lib/typst/compiler";
import { Code2, Eye, Bot, Save, BookOpen, Check, Loader2, Settings } from "lucide-react";

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
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-900 text-slate-100">
      {/* Top Navbar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950 px-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 font-bold text-white shadow-sm">
              R
            </div>
            <span className="text-sm font-semibold tracking-tight text-white">
              ResumeForge
            </span>
          </Link>

          <span className="text-xs text-slate-600">|</span>

          <Link
            href="/library"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
            Evidence Library
          </Link>

          <span className="text-xs text-slate-600">|</span>

          <Link
            href="/settings"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Settings className="h-3.5 w-3.5 text-indigo-400" />
            AI Settings
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveAsMaster}
            disabled={isSavingMaster}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {isSavingMaster ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : saveSuccess ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {saveSuccess ? "Saved as Master!" : "Save as Master Resume"}
          </button>

          {/* Mobile Tab Selectors (< lg screens) */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-900 p-1 border border-slate-800 lg:hidden">
            <button
              type="button"
              onClick={() => setActiveTab("editor")}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                activeTab === "editor"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
              Editor
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                activeTab === "preview"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ai")}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                activeTab === "ai"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Bot className="h-3.5 w-3.5" />
              AI
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex flex-1 overflow-hidden p-2 md:p-3 bg-slate-950">
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
