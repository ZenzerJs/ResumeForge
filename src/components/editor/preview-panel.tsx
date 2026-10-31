"use client";

import React, { useEffect, useRef, useState } from "react";
import { assertLayoutExportReady, isResumeLayoutV2Enabled, parseManagedResume } from "@/lib/typst/resume-document";
import { Download, RefreshCw, AlertCircle, CheckCircle2, Loader2, BarChart3, Sparkles, FileText, ChevronDown, Package } from "lucide-react";
import dynamic from "next/dynamic";
import { cleanTypstToText, sanitizeZipFilename } from "@/lib/export/zip";
import { assertCanExport } from "@/lib/guardrail/policy";
import { ResumeFacts } from "@/lib/facts/types";
import { AtsEvaluationResult } from "@/lib/ats-evaluator/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const AtsScorePanel = dynamic(
  () => import("@/components/tailor/ats-score-panel").then((m) => ({ default: m.AtsScorePanel })),
  { ssr: false }
);

const APPROVAL_LINE = /^\/\/ @layout-(two-pages|review)-approved: ([a-f0-9]{64})\r?\n/gm;
function approvalBase(source: string) { return source.replace(APPROVAL_LINE, ""); }
async function approvalHash(source: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(approvalBase(source)));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

interface PreviewPanelProps {
  svg: string | null;
  error: { message: string; line?: number; column?: number } | null;
  source: string;
  isCompiling: boolean;
  onResetTemplate: () => void;
  onApplyLayout?: (source: string) => void;
  masterFacts?: ResumeFacts | null;
  allowUnfrozenMasterSelfExport?: boolean;
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
  onApplyLayout,
  masterFacts,
  allowUnfrozenMasterSelfExport,
  extractedRequirements,
  roleTitle,
  onTriggerRepair,
}: PreviewPanelProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const v2 = isResumeLayoutV2Enabled() && source.includes("// ResumeForge layout v2");
  const [measurement, setMeasurement] = useState<{ source: string; pages: number; pdf: Uint8Array } | null>(null);
  const [pageImages, setPageImages] = useState<{ source: string; pages: string[] } | null>(null);
  const [measurementError, setMeasurementError] = useState<string | null>(null);
  const [isFitting, setIsFitting] = useState(false);
  const [twoPageApproval, setTwoPageApproval] = useState<string | null>(null);
  const [reviewApproval, setReviewApproval] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setMeasurement(null);
    setPageImages(null);
    setMeasurementError(null);
    setTwoPageApproval(null);
    setReviewApproval(null);
    if (!v2 || !source.trim()) return () => { cancelled = true; };
    void approvalHash(source).then((hash) => {
      if (cancelled) return;
      if (source.includes(`// @layout-two-pages-approved: ${hash}\n`)) setTwoPageApproval(source);
      if (source.includes(`// @layout-review-approved: ${hash}\n`)) setReviewApproval(source);
    }).catch(() => { /* No saved approval can be trusted without a digest. */ });
    const timer = window.setTimeout(() => { void (async () => {
      try {
        const { measureTypstDocument } = await import("@/lib/typst/compiler");
        const hash = await approvalHash(source);
        const hasTwoPageApproval = source.includes(`// @layout-two-pages-approved: ${hash}\n`);
        if (onApplyLayout && !hasTwoPageApproval && parseManagedResume(source)) {
          const { fitManagedLayout } = await import("@/lib/typst/layout-fit");
          const fitted = await fitManagedLayout(source, 1, async (candidate) => (await measureTypstDocument(candidate)).pageCount);
          if (cancelled || sourceRef.current !== source) return;
          if (fitted.status === "fit" && fitted.source !== source) { onApplyLayout(fitted.source); return; }
        }
        const result = await measureTypstDocument(source, true);
        if (!cancelled) {
          setPageImages({ source: result.source, pages: result.pageImages });
          setMeasurement({ source: result.source, pages: result.pageCount, pdf: result.pdf });
        }
      } catch (err) {
        if (!cancelled) setMeasurementError(err instanceof Error ? err.message : "Could not measure the compiled document.");
      }
    })(); }, 400);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [source, v2, onApplyLayout]);
  const measuredPdf = () => {
    if (!v2) return undefined;
    if (sourceRef.current !== source) throw new Error("The document changed. Try again.");
    assertLayoutExportReady(source, measurement, twoPageApproval, reviewApproval);
    if (!measurement) throw new Error("Wait for the current document to compile and measure before export.");
    return measurement.pdf;
  };

  const approve = async (kind: "two-pages" | "review") => {
    if (!onApplyLayout) return;
    try {
      let approvedSource = source;
      if (kind === "two-pages" && parseManagedResume(source)) {
        const [{ fitManagedLayout }, { measureTypstDocument }] = await Promise.all([
          import("@/lib/typst/layout-fit"), import("@/lib/typst/compiler"),
        ]);
        const result = await fitManagedLayout(source, 2, async (candidate) => (await measureTypstDocument(candidate)).pageCount);
        if (result.status !== "fit") throw new Error("Could not find a readable two-page layout.");
        approvedSource = result.source;
      }
      const hash = await approvalHash(approvedSource);
      if (sourceRef.current !== source) throw new Error("The document changed. Review it again.");
      const existing = kind === "two-pages" ? /^\/\/ @layout-two-pages-approved: [a-f0-9]{64}\r?\n/gm : /^\/\/ @layout-review-approved: [a-f0-9]{64}\r?\n/gm;
      onApplyLayout(`// @layout-${kind}-approved: ${hash}\n${approvedSource.replace(existing, "")}`);
    } catch (err) { setExportError(err instanceof Error ? err.message : "Could not record approval."); }
  };

  const fitToOnePage = async () => {
    if (!onApplyLayout) return;
    setIsFitting(true);
    setExportError(null);
    try {
      const { fitManagedLayout } = await import("@/lib/typst/layout-fit");
      const { measureTypstDocument } = await import("@/lib/typst/compiler");
      const result = await fitManagedLayout(source, 1, async (candidate) => (await measureTypstDocument(candidate)).pageCount);
      if (sourceRef.current !== source) throw new Error("The document changed while fitting. Try again.");
      if (result.status === "fit") onApplyLayout(result.source);
      else if (result.status === "no-fit") throw new Error("This resume does not fit on one page with the readable profiles. Review content or use two pages.");
      else if (result.status === "unmanaged") throw new Error("This source has custom settings and cannot be fitted automatically.");
      else throw new Error("Could not compile and measure the layout profiles.");
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Could not fit the document.");
    } finally { setIsFitting(false); }
  };

  // Task 9.5: ATS Grade in Editor preview state
  const [showGrade, setShowGrade] = useState(false);

  const handleToggleGrade = () => {
    setShowGrade((prev) => !prev);
  };

  const handleExportPdf = async () => {
    try {
      setIsExporting(true);
      setExportError(null);

      // Phase 11.2 Mechanical Guardrail Gate
      assertCanExport(source, masterFacts, { allowUnfrozenMasterSelfExport });

      const { compileTypstToPdf } = await import("@/lib/typst/compiler");
      const pdfBytes = measuredPdf() || await compileTypstToPdf(source);
      if (sourceRef.current !== source) throw new Error("The document changed during export. Try again.");
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

  const handleExportDocx = async () => {
    try {
      setIsExporting(true);
      setExportError(null);

      // Phase 11.2 Mechanical Guardrail Gate
      assertCanExport(source, masterFacts, { allowUnfrozenMasterSelfExport });

      const { generateAtsDocx } = await import("@/lib/export/docx");
      const docxBytes = await generateAtsDocx(source, { facts: masterFacts || undefined });
      const blob = new Blob([docxBytes.buffer as ArrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resume.docx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to export DOCX");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportTypst = () => {
    try {
      const blob = new Blob([source], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resume.typ";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to export Typst source");
    }
  };

  const handleExportTxt = () => {
    try {
      const cleanTxt = cleanTypstToText(source);

      const blob = new Blob([cleanTxt], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resume.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to export Text resume");
    }
  };

  const handleExportJson = () => {
    try {
      const jsonResume = {
        basics: {
          name: "Candidate",
          summary: "Tailored Professional Resume",
        },
        skills: masterFacts?.skills || [],
        work: (masterFacts?.employers || []).map((emp, i) => ({
          name: emp.raw,
          position: masterFacts?.titles[i]?.raw || "Role",
          startDate: emp.startDate,
          endDate: emp.endDate,
        })),
        metrics: masterFacts?.metrics || [],
      };

      const blob = new Blob([JSON.stringify(jsonResume, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resume.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to export JSON resume");
    }
  };

  const handleExportZip = async () => {
    try {
      setIsExporting(true);
      setExportError(null);

      const compiledPdf = measuredPdf();
      const { generateApplicationPackageZip } = await import("@/lib/export/zip");
      const zipBytes = await generateApplicationPackageZip({
        typstSource: source,
        compiledPdf,
        layoutMeasurement: v2 ? measurement : undefined,
        twoPageApproval,
        reviewApproval,
        masterFacts: masterFacts || undefined,
        allowUnfrozenMasterSelfExport,
        job: roleTitle
          ? {
              company: "Target Company",
              roleTitle: roleTitle,
              requirements: extractedRequirements,
            }
          : null,
      });

      if (sourceRef.current !== source) throw new Error("The document changed during export. Try again.");
      const blob = new Blob([zipBytes.buffer as ArrayBuffer], {
        type: "application/zip",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = sanitizeZipFilename("Target_Company", roleTitle || "Resume");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(
        err instanceof Error
          ? err.message
          : "Package creation failed. You can try again or download individual PDF / DOCX files below."
      );
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={isExporting}
                data-testid="export-dropdown-btn"
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1 text-xs font-semibold text-slate-950 shadow-sm hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isExporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Export
                <ChevronDown className="h-3 w-3 opacity-80" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={handleExportPdf}
                data-testid="export-pdf-menu-item"
                className="cursor-pointer text-xs flex items-center gap-2"
              >
                <Download className="size-3.5 text-amber-500" />
                <span>Compiled PDF (.pdf)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportDocx}
                data-testid="export-docx-menu-item"
                className="cursor-pointer text-xs flex items-center gap-2"
              >
                <FileText className="size-3.5 text-blue-500" />
                <span>Word ATS (.docx)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportTypst}
                data-testid="export-typst-menu-item"
                className="cursor-pointer text-xs flex items-center gap-2"
              >
                <FileText className="size-3.5 text-amber-500" />
                <span>Typst Source (.typ)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportTxt}
                data-testid="export-txt-menu-item"
                className="cursor-pointer text-xs flex items-center gap-2"
              >
                <FileText className="size-3.5 text-emerald-500" />
                <span>Plain Text ATS (.txt)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportJson}
                data-testid="export-json-menu-item"
                className="cursor-pointer text-xs flex items-center gap-2"
              >
                <FileText className="size-3.5 text-slate-500" />
                <span>JSON Resume (.json)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportZip}
                data-testid="export-zip-menu-item"
                className="cursor-pointer text-xs flex items-center gap-2"
              >
                <Package className="size-3.5 text-amber-600" />
                <span>Application Package (.zip)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {v2 && <div className="border-b border-slate-200 bg-white px-4 py-2 text-xs text-slate-700" role="status" data-testid="layout-page-status">
        {onApplyLayout && <button type="button" className="mr-3 underline font-semibold disabled:opacity-50" disabled={isFitting} onClick={() => void fitToOnePage()}>{isFitting ? "Fitting…" : "Fit to one page"}</button>}
        {measurementError ? `Measurement failed: ${measurementError}` : !measurement || measurement.source !== source ? "Measuring current document…" : `${measurement.pages} ${measurement.pages === 1 ? "page" : "pages"} measured`}
        {source.includes("// @layout-v2-link-placement-required") && <span> · Place unresolved PDF links in Visual Form before export. Review controls stay outside the resume.</span>}
        {source.includes("// @layout-v2-review-required") && <span> · Review unclassified content before final export. <button type="button" className="underline font-semibold" onClick={() => void approve("review")}>I reviewed this content</button>{reviewApproval === source && " ✓"}</span>}
        {measurement?.source === source && measurement.pages === 2 && <span className="ml-2">Review content or <button type="button" className="underline font-semibold" onClick={() => void approve("two-pages")}>Use two pages</button>{twoPageApproval === source && " ✓"}</span>}
        {measurement?.source === source && measurement.pages > 2 && " · Review content to reduce this resume to two pages."}
      </div>}
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
          <div
            data-testid="export-error-recovery-banner"
            className="w-full max-w-[850px] mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 shadow-sm space-y-2"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">
                Export Notice: {exportError}
              </p>
              <button
                type="button"
                onClick={() => setExportError(null)}
                className="text-amber-800 hover:text-amber-950 text-xs underline font-medium shrink-0"
              >
                Dismiss
              </button>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-amber-200">
              <span className="text-[11px] text-amber-800 font-medium">Fallback direct downloads:</span>
              <button
                type="button"
                onClick={handleExportPdf}
                data-testid="fallback-download-pdf-btn"
                className="px-2 py-0.5 rounded bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 font-medium text-[11px] inline-flex items-center gap-1 shadow-xs"
              >
                <Download className="size-3" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={handleExportDocx}
                data-testid="fallback-download-docx-btn"
                className="px-2 py-0.5 rounded bg-white border border-amber-300 text-blue-700 hover:bg-blue-50 font-medium text-[11px] inline-flex items-center gap-1 shadow-xs"
              >
                <FileText className="size-3" />
                <span>DOCX</span>
              </button>
            </div>
          </div>
        )}

        {/* Paper Sheet Preview Container */}
        {v2 && pageImages?.source === source ? (
          <div className="w-full max-w-[850px] space-y-5" data-testid="layout-page-preview">
            {pageImages.pages.map((image, index) => (
              <div key={index} className="overflow-hidden border border-slate-200 bg-white shadow-md">
                {/* Browser-rendered pages reflect the same PDF bytes used for export. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt={`Resume page ${index + 1}`} className="block h-auto w-full" />
              </div>
            ))}
          </div>
        ) : svg ? (
          <div className="w-full max-w-[850px] rounded-sm bg-white p-4 sm:p-8 shadow-md border border-slate-200">
            <div
              data-testid="typst-preview-svg"
              className="typst-preview-svg w-full overflow-hidden [&_svg]:w-full [&_svg]:h-auto [&_svg]:max-w-full"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mb-2 text-amber-500" />
            <p className="text-xs">Initializing Typst WASM compiler...</p>
          </div>
        )}
      </div>
    </div>
  );
}
