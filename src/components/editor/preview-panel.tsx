"use client";

import React, { useState } from "react";
import { Download, RefreshCw, AlertCircle, CheckCircle2, Loader2, BarChart3, Sparkles } from "lucide-react";
import { compileTypstToPdf } from "@/lib/typst/compiler";
import { AtsScorePanel } from "@/components/tailor/ats-score-panel";
import { AtsEvaluationResult } from "@/lib/ats-evaluator/types";

interface PreviewPanelProps {
  svg: string | null;
  error: { message: string; line?: number; column?: number } | null;
  source: string;
  isCompiling: boolean;
  onResetTemplate: () => void;
  extractedRequirements?: {
    requiredSkills: string[];
    preferredSkills: string[];
    domainTerms: string[];
  };
  roleTitle?: string;
  onTriggerRepair?: (context: {
    compileError: string;
    line?: number;
    column?: number;
    sourceExcerpt?: string;
  }) => void;
}

export function PreviewPanel({
  svg,
  error,
  source,
  isCompiling,
  onResetTemplate,
  extractedRequirements,
  roleTitle,
  onTriggerRepair,
}: PreviewPanelProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Task 9.5: ATS Grade in Editor preview state
  const [showGrade, setShowGrade] = useState(false);

  const handleToggleGrade = () => {
    setShowGrade((prev) => !prev);
  };

  const handleExportPdf = async () => {
    try {
      setIsExporting(true);
      setExportError(null);

      const pdfBytes = await compileTypstToPdf(source);
      // Create blob and trigger browser file download
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resume.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to export PDF");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-md border border-slate-200 bg-slate-100 shadow-sm">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>Live Document Preview</span>
          {isCompiling && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleGrade}
            data-testid="grade-resume-btn"
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors shadow-sm"
            title="Grade current draft against ATS evaluation engine"
          >
            <BarChart3 className="h-3.5 w-3.5 text-amber-600" />
            {showGrade ? "Close Grade" : "Grade"}
          </button>

          <button
            type="button"
            onClick={onResetTemplate}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            title="Reset to starter template"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset Template
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExporting || Boolean(error)}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Export PDF
          </button>
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="relative flex-1 min-h-0 overflow-auto p-4 md:p-6 flex flex-col items-center">
        {/* Task 9.5: ATS Grade Overlay Breakdown */}
        {showGrade && (
          <div data-testid="editor-ats-score-overlay" className="w-full max-w-[850px] mb-6">
            {!source || !source.trim() ? (
              <div
                data-testid="editor-grade-error"
                className="p-4 bg-red-950/90 border border-red-800 rounded-xl flex items-center justify-between gap-3 text-xs text-red-200 shadow-lg"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                  <span>Cannot grade an empty document. Please enter valid Typst source.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGrade(false)}
                  className="text-red-400 hover:text-red-200 text-xs underline font-medium"
                >
                  Dismiss
                </button>
              </div>
            ) : (
              <AtsScorePanel
                typstContent={source}
                extractedRequirements={
                  extractedRequirements || {
                    requiredSkills: [],
                    preferredSkills: [],
                    domainTerms: [],
                  }
                }
                roleTitle={roleTitle}
              />
            )}
          </div>
        )}

        {/* Error Banner overlay at top if present */}
        {error && (
          <div
            data-testid="typst-error-banner"
            className="w-full max-w-[850px] mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800 shadow-sm"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 font-semibold">
                  <span>Compilation Error</span>
                  {typeof error.line === "number" && (
                    <span className="rounded bg-red-200 px-1.5 py-0.5 text-[10px] font-bold text-red-900">
                      Line {error.line}
                    </span>
                  )}
                </div>
                <p className="mt-1 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">
                  {error.message}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-[10px] text-red-600">
                    Showing last valid compilation preview below.
                  </p>
                  {onTriggerRepair && (
                    <button
                      type="button"
                      onClick={() => {
                        const lineNum = typeof error.line === "number" ? error.line : undefined;
                        const colNum = typeof error.column === "number" ? error.column : undefined;
                        let excerpt: string | undefined = undefined;
                        if (source && lineNum) {
                          const lines = source.split("\n");
                          excerpt = lines.slice(Math.max(0, lineNum - 3), lineNum + 2).join("\n");
                        }
                        onTriggerRepair({
                          compileError: error.message,
                          line: lineNum,
                          column: colNum,
                          sourceExcerpt: excerpt,
                        });
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer"
                      data-testid="fix-typst-ai-btn"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Fix with AI
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {exportError && (
          <div className="w-full max-w-[850px] mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <p className="font-semibold">Export Warning: {exportError}</p>
          </div>
        )}

        {/* Paper Sheet Preview Container */}
        {svg ? (
          <div className="w-full max-w-[850px] rounded-sm bg-white p-4 sm:p-8 shadow-md border border-slate-200 transition-all">
            <div
              data-testid="typst-preview-svg"
              className="typst-preview-svg w-full overflow-hidden [&_svg]:w-full [&_svg]:h-auto [&_svg]:max-w-full"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mb-2 text-indigo-500" />
            <p className="text-xs">Initializing Typst WASM compiler...</p>
          </div>
        )}
      </div>
    </div>
  );
}
