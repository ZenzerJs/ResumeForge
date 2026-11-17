"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { assertLayoutExportReady, isResumeLayoutV2Enabled, parseManagedResume } from "@/lib/typst/resume-document";
import { sanitizeTypstSvg } from "@/lib/typst/svg-sanitize";
import { Download, RefreshCw, AlertCircle, CheckCircle2, Loader2, BarChart3, Sparkles, FileText, ChevronDown, Package, MoreHorizontal } from "lucide-react";
import dynamic from "next/dynamic";
import { cleanTypstToText, sanitizeZipFilename } from "@/lib/export/zip";
import { downloadBlob } from "@/lib/utils";
import { assertCanExport } from "@/lib/guardrail/policy";
import { ResumeFacts } from "@/lib/facts/types";
import { AtsEvaluationResult } from "@/lib/ats-evaluator/types";
import { evaluateAtsScore } from "@/lib/ats-evaluator/evaluator";
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
const EMPTY_EXTRACTED_REQUIREMENTS = {
  requiredSkills: [] as string[],
  preferredSkills: [] as string[],
  domainTerms: [] as string[],
};
const BLANK_PAGE_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 850 1100'%3E%3C/svg%3E";
const MAX_SETTLED_MEASUREMENTS = 4;
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
  const [pageImages, setPageImages] = useState<{ source: string; pages: Record<number, string> } | null>(null);
  const [visiblePages, setVisiblePages] = useState<number[]>([1]);
  const settledCacheRef = useRef<Map<string, { source: string; pages: number; pdf: Uint8Array }>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageSlotRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [measurementError, setMeasurementError] = useState<string | null>(null);
  const [isFitting, setIsFitting] = useState(false);
  const [twoPageApproval, setTwoPageApproval] = useState<string | null>(null);
  const [reviewApproval, setReviewApproval] = useState<string | null>(null);
  const [sanitizedSvg, setSanitizedSvg] = useState<{
    raw: string;
    clean: string | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!svg) {
      setSanitizedSvg(null);
      return;
    }
    const result = sanitizeTypstSvg(svg);
    if (result.ok) {
      setSanitizedSvg({ raw: svg, clean: result.svg, error: null });
    } else {
      setSanitizedSvg({ raw: svg, clean: null, error: result.error });
    }
  }, [svg]);
  const cacheSettledMeasurement = (entry: { source: string; pages: number; pdf: Uint8Array }) => {
    const cache = settledCacheRef.current;
    if (cache.has(entry.source)) cache.delete(entry.source);
    cache.set(entry.source, entry);
    while (cache.size > MAX_SETTLED_MEASUREMENTS) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setMeasurement(null);
    setPageImages(null);
    setVisiblePages([1]);
    setMeasurementError(null);
    setTwoPageApproval(null);
    setReviewApproval(null);
    if (!v2 || !source.trim()) return () => { cancelled = true; };

    void approvalHash(source).then((hash) => {
      if (cancelled || sourceRef.current !== source) return;
      if (source.includes(`// @layout-two-pages-approved: ${hash}\n`)) setTwoPageApproval(source);
      if (source.includes(`// @layout-review-approved: ${hash}\n`)) setReviewApproval(source);
    }).catch(() => { /* No saved approval can be trusted without a digest. */ });

    const cached = settledCacheRef.current.get(source);
    if (cached) {
      setMeasurement(cached);
      return () => { cancelled = true; };
    }

    const timer = window.setTimeout(() => { void (async () => {
      try {
        const [{ measureTypstPageCount }, hash] = await Promise.all([
          import("@/lib/typst/compiler"),
          approvalHash(source),
        ]);
        if (cancelled || sourceRef.current !== source) return;

        const current = await measureTypstPageCount(source, { callerId: "editor-preview-measure", mode: "live" });
        if (cancelled || sourceRef.current !== source) return;

        const currentEntry = { source: current.source, pages: current.pageCount, pdf: current.pdf };
        cacheSettledMeasurement(currentEntry);

        const hasTwoPageApproval = source.includes(`// @layout-two-pages-approved: ${hash}\n`);
        // Fit additional profiles only when the current settled source exceeds the 1-page budget.
        if (current.pageCount > 1 && onApplyLayout && !hasTwoPageApproval && parseManagedResume(source)) {
          const { fitManagedLayout } = await import("@/lib/typst/layout-fit");
          const measuredInPass = new Map<string, { source: string; pages: number; pdf: Uint8Array }>([
            [source, currentEntry],
          ]);
          const fitted = await fitManagedLayout(source, 1, async (candidate) => {
            if (cancelled || sourceRef.current !== source) {
              throw new Error("Superseded layout measurement");
            }
            const existing = measuredInPass.get(candidate) || settledCacheRef.current.get(candidate);
            if (existing) return existing.pages;
            const measured = await measureTypstPageCount(candidate, { callerId: "editor-preview-measure", mode: "live" });
            const entry = { source: measured.source, pages: measured.pageCount, pdf: measured.pdf };
            measuredInPass.set(candidate, entry);
            cacheSettledMeasurement(entry);
            return measured.pageCount;
          });
          if (cancelled || sourceRef.current !== source) return;
          if (fitted.status === "fit" && fitted.source !== source) {
            onApplyLayout(fitted.source);
            return;
          }
        }

        if (!cancelled && sourceRef.current === source) {
          setMeasurement(currentEntry);
        }
      } catch (err) {
        if (
          !cancelled &&
          sourceRef.current === source &&
          !(err instanceof Error && (err.name === "SupersededCompileError" || err.message === "Superseded layout measurement"))
        ) {
          setMeasurementError(err instanceof Error ? err.message : "Could not measure the compiled document.");
        }
      }
    })(); }, 400);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [source, v2, onApplyLayout]);

  useEffect(() => {
    if (!v2 || !measurement || measurement.source !== source) return;
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const newlyVisible: number[] = [];
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const pageAttr = (entry.target as HTMLElement).dataset.pageSlot;
          const pageNumber = pageAttr ? Number(pageAttr) : NaN;
          if (Number.isInteger(pageNumber) && pageNumber >= 1) {
            newlyVisible.push(pageNumber);
          }
        }
        if (newlyVisible.length > 0) {
          setVisiblePages((prev) => {
            const merged = new Set(prev);
            let changed = false;
            for (const pageNumber of newlyVisible) {
              if (!merged.has(pageNumber)) {
                merged.add(pageNumber);
                changed = true;
              }
            }
            return changed ? Array.from(merged).sort((a, b) => a - b) : prev;
          });
        }
      },
      { root: scrollContainerRef.current, rootMargin: "40px 0px", threshold: 0.01 },
    );

    for (let pageNumber = 1; pageNumber <= measurement.pages; pageNumber++) {
      const el = pageSlotRefs.current.get(pageNumber);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [v2, measurement, source]);

  useEffect(() => {
    if (!v2 || !measurement || measurement.source !== source) return;
    const currentImages = pageImages?.source === measurement.source ? pageImages.pages : {};
    const missingPages = visiblePages.filter(
      (pageNumber) => pageNumber >= 1 && pageNumber <= measurement.pages && !currentImages[pageNumber],
    );
    if (missingPages.length === 0) return;

    let cancelled = false;
    void (async () => {
      try {
        const { renderPdfPages } = await import("@/lib/typst/compiler");
        const rendered = await renderPdfPages(measurement.pdf, missingPages);
        if (cancelled || sourceRef.current !== measurement.source) return;
        setPageImages((prev) => {
          const base = prev?.source === measurement.source ? prev.pages : {};
          return {
            source: measurement.source,
            pages: { ...base, ...rendered },
          };
        });
      } catch (err) {
        if (!cancelled && sourceRef.current === measurement.source) {
          setMeasurementError(err instanceof Error ? err.message : "Could not render document preview.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [v2, measurement, source, visiblePages, pageImages]);

  const resolveMeasuredExport = async () => {
    if (!v2) return undefined;
    const activeSource = source;
    if (sourceRef.current !== activeSource) throw new Error("The document changed. Try again.");

    let currentMeasurement =
      measurement?.source === activeSource
        ? measurement
        : settledCacheRef.current.get(activeSource) || null;
    let currentTwoPageApproval = twoPageApproval;
    let currentReviewApproval = reviewApproval;

    if (!currentMeasurement) {
      const [{ measureTypstPageCount }, hash] = await Promise.all([
        import("@/lib/typst/compiler"),
        approvalHash(activeSource),
      ]);
      if (sourceRef.current !== activeSource) throw new Error("The document changed during export. Try again.");
      const measured = await measureTypstPageCount(activeSource, {
        callerId: "editor-preview-measure",
        mode: "export",
      });
      if (sourceRef.current !== activeSource) throw new Error("The document changed during export. Try again.");
      currentMeasurement = { source: measured.source, pages: measured.pageCount, pdf: measured.pdf };
      cacheSettledMeasurement(currentMeasurement);
      setMeasurement(currentMeasurement);
      if (activeSource.includes(`// @layout-two-pages-approved: ${hash}\n`)) {
        currentTwoPageApproval = activeSource;
        setTwoPageApproval(activeSource);
      }
      if (activeSource.includes(`// @layout-review-approved: ${hash}\n`)) {
        currentReviewApproval = activeSource;
        setReviewApproval(activeSource);
      }
    }

    assertLayoutExportReady(activeSource, currentMeasurement, currentTwoPageApproval, currentReviewApproval);
    return {
      pdf: currentMeasurement.pdf,
      measurement: currentMeasurement,
      twoPageApproval: currentTwoPageApproval,
      reviewApproval: currentReviewApproval,
    };
  };

  const approve = async (kind: "two-pages" | "review") => {
    if (!onApplyLayout) return;
    try {
      let approvedSource = source;
      let approvedMeasurement: { source: string; pages: number; pdf: Uint8Array } | null = null;
      if (kind === "two-pages" && parseManagedResume(source)) {
        const [{ fitManagedLayout }, { measureTypstPageCount }] = await Promise.all([
          import("@/lib/typst/layout-fit"), import("@/lib/typst/compiler"),
        ]);
        const result = await fitManagedLayout(source, 2, async (candidate) => {
          const existing = settledCacheRef.current.get(candidate);
          if (existing) {
            approvedMeasurement = existing;
            return existing.pages;
          }
          const measured = await measureTypstPageCount(candidate, { callerId: "editor-preview-fit", mode: "live" });
          const entry = { source: measured.source, pages: measured.pageCount, pdf: measured.pdf };
          cacheSettledMeasurement(entry);
          approvedMeasurement = entry;
          return measured.pageCount;
        });
        if (result.status !== "fit") throw new Error("Could not find a readable two-page layout.");
        approvedSource = result.source;
      }
      const hash = await approvalHash(approvedSource);
      if (sourceRef.current !== source) throw new Error("The document changed. Review it again.");
      const existing = kind === "two-pages" ? /^\/\/ @layout-two-pages-approved: [a-f0-9]{64}\r?\n/gm : /^\/\/ @layout-review-approved: [a-f0-9]{64}\r?\n/gm;
      const finalSource = `// @layout-${kind}-approved: ${hash}\n${approvedSource.replace(existing, "")}`;
      if (approvedMeasurement) {
        const currentMeasurement = approvedMeasurement as { source: string; pages: number; pdf: Uint8Array };
        cacheSettledMeasurement({ source: finalSource, pages: currentMeasurement.pages, pdf: currentMeasurement.pdf });
      }
      onApplyLayout(finalSource);
    } catch (err) { setExportError(err instanceof Error ? err.message : "Could not record approval."); }
  };

  const fitToOnePage = async () => {
    if (!onApplyLayout) return;
    setIsFitting(true);
    setExportError(null);
    try {
      const { fitManagedLayout } = await import("@/lib/typst/layout-fit");
      const { measureTypstPageCount } = await import("@/lib/typst/compiler");
      const result = await fitManagedLayout(source, 1, async (candidate) => {
        const existing = settledCacheRef.current.get(candidate);
        if (existing) return existing.pages;
        const measured = await measureTypstPageCount(candidate, { callerId: "editor-preview-fit", mode: "live" });
        cacheSettledMeasurement({ source: measured.source, pages: measured.pageCount, pdf: measured.pdf });
        return measured.pageCount;
      });
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
  const [showDockedGrade, setShowDockedGrade] = useState(true);
  const [previewView, setPreviewView] = useState<"fit" | "actual">("fit");

  const handleToggleGrade = () => {
    setShowGrade((prev) => !prev);
  };

  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const hasHydratedSource = hasMounted && source.trim().length > 0;
  const hasJobRequirements = Boolean(
    extractedRequirements &&
      (extractedRequirements.requiredSkills.length > 0 ||
        extractedRequirements.preferredSkills.length > 0 ||
        extractedRequirements.domainTerms.length > 0)
  );

  // Synchronous client-side Ember Ink ATS Grade computation for the docked Editor grade rail
  const liveAtsGrade = useMemo<AtsEvaluationResult>(() => {
    return evaluateAtsScore(
      source || "",
      extractedRequirements || EMPTY_EXTRACTED_REQUIREMENTS,
      "Backend"
    );
  }, [source, extractedRequirements]);

  const handleExportPdf = async () => {
    try {
      setIsExporting(true);
      setExportError(null);

      // Phase 11.2 Mechanical Guardrail Gate
      assertCanExport(source, masterFacts, { allowUnfrozenMasterSelfExport });

      const resolvedExport = await resolveMeasuredExport();
      const { compileTypstToPdf } = await import("@/lib/typst/compiler");
      const pdfBytes = resolvedExport?.pdf || await compileTypstToPdf(source, { mode: "export" });
      if (sourceRef.current !== source) throw new Error("The document changed during export. Try again.");
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
      downloadBlob(blob, "resume.pdf");
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
      downloadBlob(blob, "resume.docx");
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to export DOCX");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportTypst = () => {
    try {
      const blob = new Blob([source], { type: "text/plain;charset=utf-8" });
      downloadBlob(blob, "resume.typ");
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to export Typst source");
    }
  };

  const handleExportTxt = () => {
    try {
      const cleanTxt = cleanTypstToText(source);

      const blob = new Blob([cleanTxt], { type: "text/plain;charset=utf-8" });
      downloadBlob(blob, "resume.txt");
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
      downloadBlob(blob, "resume.json");
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to export JSON resume");
    }
  };

  const handleExportZip = async () => {
    try {
      setIsExporting(true);
      setExportError(null);

      const resolvedExport = await resolveMeasuredExport();
      const { generateApplicationPackageZip } = await import("@/lib/export/zip");
      const zipBytes = await generateApplicationPackageZip({
        typstSource: source,
        compiledPdf: resolvedExport?.pdf,
        layoutMeasurement: v2 ? (resolvedExport?.measurement ?? measurement) : undefined,
        twoPageApproval: resolvedExport ? resolvedExport.twoPageApproval : twoPageApproval,
        reviewApproval: resolvedExport ? resolvedExport.reviewApproval : reviewApproval,
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
      downloadBlob(blob, sanitizeZipFilename("Target_Company", roleTitle || "Resume"));
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
    <div className="flex h-full flex-col overflow-hidden rounded-b-[6px] border-x border-b border-outline/70 bg-inset">
      {/* 32px Pane Toolbar */}
      <div className="flex h-8 shrink-0 items-center justify-between gap-x-2 border-b border-outline/70 bg-panel px-2.5 text-xs text-text-secondary overflow-hidden">
        <div className="flex min-w-0 items-center gap-x-2 overflow-hidden">
          <span className="h-2 w-2 shrink-0 rounded-full bg-status-success" />
          <button
            type="button"
            data-testid="preview-mode-pdf"
            onClick={() => setShowGrade(false)}
            aria-pressed={!showGrade}
            className="font-semibold text-foreground shrink-0 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            title="Show live paper preview"
          >
            Preview
          </button>
          {!v2 && (
            <button
              type="button"
              onClick={() => {
                if (showGrade) {
                  setShowGrade(false);
                  setShowDockedGrade(true);
                } else {
                  setShowDockedGrade((prev) => !prev);
                }
              }}
              aria-pressed={showDockedGrade && !showGrade}
              data-testid="preview-split-grade-toggle"
              className="hidden xl:inline-flex items-center gap-1.5 font-mono text-xs tabular-nums text-text-secondary hover:text-foreground transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              title="Toggle docked ATS Grade column alongside paper preview"
            >
              <span className={showDockedGrade && !showGrade ? "text-signal font-semibold" : "text-text-secondary"}>
                Preview · Grade ▸
              </span>
            </button>
          )}
          {isCompiling && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />}
          {v2 && (
            <div
              className="inline-flex min-w-0 items-center gap-x-2 text-xs font-mono tabular-nums text-text-secondary overflow-hidden"
              role="status"
              data-testid="layout-page-status"
            >
              <span className="whitespace-nowrap">
                {measurementError
                  ? `Measurement failed: ${measurementError}`
                  : !measurement || measurement.source !== source
                  ? "Measuring…"
                  : `${measurement.pages} ${measurement.pages === 1 ? "page" : "pages"} measured`}
              </span>
              {onApplyLayout && (
                <button
                  type="button"
                  className="shrink-0 underline font-semibold text-primary hover:text-primary/80 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  disabled={isFitting}
                  onClick={() => void fitToOnePage()}
                >
                  {isFitting ? "Fitting…" : "Fit to one page"}
                </button>
              )}
              {source.includes("// @layout-v2-link-placement-required") && (
                <span className="shrink-0 text-status-warning">· Place links in Visual Form</span>
              )}
              {source.includes("// @layout-v2-review-required") && (
                <span className="shrink-0">
                  · <button type="button" className="underline font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm" onClick={() => void approve("review")}>I reviewed this content</button>
                  {reviewApproval === source && " ✓"}
                </span>
              )}
              {measurement?.source === source && measurement.pages === 2 && (
                <span className="shrink-0">
                  <button type="button" className="underline font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm" onClick={() => void approve("two-pages")}>Use two pages</button>
                  {twoPageApproval === source && " ✓"}
                </span>
              )}
              {measurement?.source === source && measurement.pages > 2 && (
                <span className="shrink-0 text-text-muted">· Trim to ≤2 pages</span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setPreviewView((v) => (v === "fit" ? "actual" : "fit"))}
            data-testid="preview-view-toggle-btn"
            className="inline-flex h-6 items-center rounded border border-outline/70 bg-elevated px-2 text-xs font-mono tabular-nums text-text-secondary hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Toggle page preview sizing (Fit pane width or 100% scale)"
          >
            {previewView === "fit" ? "Fit" : "100%"}
          </button>

          <button
            type="button"
            onClick={handleToggleGrade}
            data-testid="grade-resume-btn"
            className={`inline-flex h-6 items-center gap-1 rounded border px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              showGrade
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-outline/70 bg-elevated text-foreground hover:bg-muted"
            }`}
            title="Grade current draft against ATS evaluation engine"
          >
            <BarChart3 className="h-3 w-3 text-signal" />
            {showGrade ? "Close Grade" : "Grade"}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={isExporting}
                data-testid="export-dropdown-btn"
                className="inline-flex h-6 items-center gap-1 rounded bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {isExporting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                Export
                <ChevronDown className="h-3 w-3 opacity-80" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-popover border-outline/70 text-popover-foreground">
              <DropdownMenuItem
                onClick={handleExportPdf}
                data-testid="export-pdf-menu-item"
                className="cursor-pointer text-xs flex items-center gap-2"
              >
                <Download className="size-3.5 text-primary" />
                <span>Compiled PDF (.pdf)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportDocx}
                data-testid="export-docx-menu-item"
                className="cursor-pointer text-xs flex items-center gap-2"
              >
                <FileText className="size-3.5 text-status-info" />
                <span>Word ATS (.docx)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportTypst}
                data-testid="export-typst-menu-item"
                className="cursor-pointer text-xs flex items-center gap-2"
              >
                <FileText className="size-3.5 text-primary" />
                <span>Typst Source (.typ)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportTxt}
                data-testid="export-txt-menu-item"
                className="cursor-pointer text-xs flex items-center gap-2"
              >
                <FileText className="size-3.5 text-status-success" />
                <span>Plain Text ATS (.txt)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportJson}
                data-testid="export-json-menu-item"
                className="cursor-pointer text-xs flex items-center gap-2"
              >
                <FileText className="size-3.5 text-text-secondary" />
                <span>JSON Resume (.json)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportZip}
                data-testid="export-zip-menu-item"
                className="cursor-pointer text-xs flex items-center gap-2"
              >
                <Package className="size-3.5 text-primary" />
                <span>Application Package (.zip)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="More preview actions"
                title="More preview actions"
                data-testid="preview-more-actions-btn"
                className="inline-flex h-6 w-6 items-center justify-center rounded border border-outline/70 bg-elevated text-text-secondary hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-popover border-outline/70 text-popover-foreground">
              <DropdownMenuItem
                onClick={onResetTemplate}
                className="cursor-pointer text-xs flex items-center gap-2"
              >
                <RefreshCw className="size-3.5 text-text-secondary" />
                <span>Reset Template</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Preview Body: Paper Stage + Docked Ember Ink ATS Grade Column */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="relative flex-1 min-w-0 min-h-0 overflow-auto bg-deep px-4 pb-6 pt-2 flex flex-col items-center"
          style={{
            backgroundImage:
              "radial-gradient(520px 280px at 50% 0%, rgb(var(--accent-action) / 0.06), transparent 70%)",
          }}
        >
        {/* Task 9.5: Dark ATS Grade Overlay Breakdown */}
        {showGrade && (
          <div data-testid="editor-ats-score-overlay" className="w-full max-w-[850px] mb-4">
            {!source || !source.trim() ? (
              <div
                data-testid="editor-grade-error"
                className="p-4 bg-panel border border-status-danger/60 rounded-[10px] flex items-center justify-between gap-3 text-xs text-foreground"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-status-danger shrink-0" />
                  <span>Cannot grade an empty document. Please enter valid Typst source.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGrade(false)}
                  className="text-text-secondary hover:text-foreground text-xs underline font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                >
                  Dismiss
                </button>
              </div>
            ) : (
              <AtsScorePanel
                typstContent={source}
                extractedRequirements={extractedRequirements || EMPTY_EXTRACTED_REQUIREMENTS}
                roleTitle={roleTitle}
              />
            )}
          </div>
        )}

        {/* Error Banner overlay at top if present */}
        {error && (
          <div
            data-testid="typst-error-banner"
            className="w-full max-w-[850px] mb-3 rounded-[10px] border border-status-danger/60 bg-panel p-3 text-xs text-foreground"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-status-danger shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 font-semibold">
                  <span>Compilation Error</span>
                  {typeof error.line === "number" && (
                    <span className="rounded bg-status-danger/20 border border-status-danger/40 px-1.5 py-0.5 text-xs font-bold text-status-danger tabular-nums">
                      Line {error.line}
                    </span>
                  )}
                </div>
                <p className="mt-1 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-text-secondary">
                  {error.message}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-text-muted">
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
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            className="w-full max-w-[850px] mb-3 rounded-[10px] border border-status-warning/60 bg-panel p-3 text-xs text-foreground space-y-2"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-status-warning">
                Export Notice: {exportError}
              </p>
              <button
                type="button"
                onClick={() => setExportError(null)}
                className="text-text-secondary hover:text-foreground text-xs underline font-semibold shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                Dismiss
              </button>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-outline/60">
              <span className="text-xs text-text-secondary font-semibold">Fallback direct downloads:</span>
              <button
                type="button"
                onClick={handleExportPdf}
                data-testid="fallback-download-pdf-btn"
                className="px-2 py-0.5 rounded bg-elevated border border-outline/70 text-primary hover:bg-muted font-semibold text-xs inline-flex items-center gap-1"
              >
                <Download className="size-3" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={handleExportDocx}
                data-testid="fallback-download-docx-btn"
                className="px-2 py-0.5 rounded bg-elevated border border-outline/70 text-status-info hover:bg-muted font-semibold text-xs inline-flex items-center gap-1"
              >
                <FileText className="size-3" />
                <span>DOCX</span>
              </button>
            </div>
          </div>
        )}

        {/* White Paper Sheet Preview Container (1px edge + 1 restrained shadow) */}
        {v2 && measurement?.source === source ? (
          <div
            className={previewView === "actual" ? "w-[816px] shrink-0 space-y-5" : "w-full max-w-[850px] space-y-5"}
            data-testid="layout-page-preview"
          >
            {Array.from({ length: measurement.pages }, (_, index) => {
              const pageNumber = index + 1;
              const renderedImage =
                pageImages?.source === source ? pageImages.pages[pageNumber] : undefined;
              return (
                <div
                  key={pageNumber}
                  data-page-slot={pageNumber}
                  ref={(el) => {
                    if (el) pageSlotRefs.current.set(pageNumber, el);
                    else pageSlotRefs.current.delete(pageNumber);
                  }}
                  className="overflow-hidden border border-[#d8dce0] bg-paper text-paper-ink shadow-[0_4px_16px_rgba(0,0,0,0.45)]"
                >
                  {/* Browser-rendered pages reflect the same PDF bytes used for export. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={renderedImage || BLANK_PAGE_PLACEHOLDER}
                    alt={`Resume page ${pageNumber}`}
                    data-page-number={pageNumber}
                    data-page-rendered={renderedImage ? "true" : "false"}
                    className={renderedImage ? "block h-auto w-full" : "block h-auto w-full aspect-[8.5/11]"}
                  />
                </div>
              );
            })}
          </div>
        ) : svg ? (
          sanitizedSvg?.raw === svg && sanitizedSvg.error ? (
            <div
              data-testid="typst-preview-sanitize-error"
              role="alert"
              className="w-full max-w-[850px] rounded-[10px] border border-status-danger/60 bg-panel p-4 text-xs text-foreground"
            >
              <p className="font-semibold text-status-danger">Unsafe or invalid preview blocked</p>
              <p className="mt-1 text-text-secondary">{sanitizedSvg.error}</p>
            </div>
          ) : sanitizedSvg?.raw === svg && sanitizedSvg.clean ? (
            <div
              data-testid="typst-paper-sheet"
              className={`${previewView === "actual" ? "w-[816px] shrink-0" : "w-full max-w-[850px]"} rounded-[2px] bg-paper text-paper-ink p-4 sm:p-8 border border-[#d8dce0] shadow-[0_4px_16px_rgba(0,0,0,0.45)]`}
            >
              <div
                data-testid="typst-preview-svg"
                className="typst-preview-svg w-full overflow-hidden [&_svg]:w-full [&_svg]:h-auto [&_svg]:max-w-full"
                dangerouslySetInnerHTML={{ __html: sanitizedSvg.clean }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-text-muted">
              <Loader2 className="h-6 w-6 animate-spin mb-2 text-primary" />
              <p className="text-xs">Verifying SVG preview...</p>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-text-muted">
            <Loader2 className="h-8 w-8 animate-spin mb-2 text-primary" />
            <p className="text-xs">Initializing Typst WASM compiler...</p>
          </div>
        )}
        </div>

        {/* Docked Right-Hand ATS Grade Column matching palette-lab.html#ember Section 03 */}
        {!showGrade && showDockedGrade && (
          <aside
            data-testid="editor-ats-grade-aside"
            aria-label="ATS Grade summary"
            className="hidden xl:flex w-[248px] 2xl:w-[268px] shrink-0 flex-col gap-3.5 border-l border-hairline bg-panel p-4 overflow-y-auto"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">ATS Grade</h3>
              <button
                type="button"
                data-testid="preview-mode-grade"
                onClick={handleToggleGrade}
                className="font-mono text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                Full Rubric ▸
              </button>
            </div>

            {hasHydratedSource ? (
              <>
                <div className="flex items-center gap-3.5">
                  <div
                    className="relative grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full"
                    style={{
                      background: `conic-gradient(rgb(var(--accent-contrast)) ${liveAtsGrade.overallScore}%, rgb(214 196 176 / 0.14) 0)`,
                      filter: "drop-shadow(0 0 14px rgb(var(--accent-contrast) / 0.35))",
                    }}
                  >
                    <div className="grid h-[58px] w-[58px] place-items-center rounded-full bg-panel font-sans text-[22px] font-bold tracking-[-0.03em] tabular-nums text-foreground">
                      {liveAtsGrade.overallScore}
                    </div>
                  </div>
                  <div className="min-w-0">
                    {hasJobRequirements ? (
                      <>
                        <strong className="block text-sm font-semibold text-foreground">
                          {liveAtsGrade.overallScore >= 80
                            ? "Strong"
                            : liveAtsGrade.overallScore >= 60
                            ? "Solid"
                            : "Developing"}
                        </strong>
                        <p className="mt-0.5 text-xs text-muted-foreground truncate">
                          {roleTitle ? `vs. ${roleTitle}` : "General ATS readiness"}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground leading-snug">
                        No job loaded: base checks only
                      </p>
                    )}
                  </div>
                </div>

            <div className="flex flex-col gap-2.5 text-xs">
              <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1">
                <span className="text-text-secondary">Keywords</span>
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  {liveAtsGrade.requiredMatch.percentage}
                </span>
                <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-hairline/70">
                  <i
                    className={`block h-full rounded-full ${
                      liveAtsGrade.requiredMatch.percentage >= 75 ? "bg-signal" : "bg-primary"
                    }`}
                    style={{ width: `${liveAtsGrade.requiredMatch.percentage}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1">
                <span className="text-text-secondary">Core stack</span>
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  {liveAtsGrade.roleEvidence.percentage}
                </span>
                <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-hairline/70">
                  <i
                    className={`block h-full rounded-full ${
                      liveAtsGrade.roleEvidence.percentage >= 75 ? "bg-signal" : "bg-primary"
                    }`}
                    style={{ width: `${liveAtsGrade.roleEvidence.percentage}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1">
                <span className="text-text-secondary">Impact metrics</span>
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  {liveAtsGrade.baseHealth.percentage}
                </span>
                <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-hairline/70">
                  <i
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${liveAtsGrade.baseHealth.percentage}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {liveAtsGrade.gaps.length > 0 ? (
                liveAtsGrade.gaps.slice(0, 2).map((issueText, idx) => {
                  const isUrgent = idx === 0;
                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 rounded-[8px] border border-hairline bg-inset p-2.5 text-xs text-text-secondary"
                    >
                      <span
                        className={`shrink-0 rounded-[5px] border px-1.5 py-0.5 text-xs font-semibold ${
                          isUrgent
                            ? "border-status-danger/40 bg-status-danger/10 text-status-danger"
                            : "border-primary/40 bg-primary/10 text-primary"
                        }`}
                      >
                        {isUrgent ? "Urgent" : "Non-urgent"}
                      </span>
                      <span className="leading-snug">
                        {issueText.replace(/^Warning:\s*/i, "").replace(/^Penalized:\s*/i, "")}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-start gap-2.5 rounded-[8px] border border-hairline bg-inset p-2.5 text-xs text-text-secondary">
                  <span className="shrink-0 rounded-[5px] border border-signal/40 bg-signal/10 px-1.5 py-0.5 text-xs font-semibold text-signal">
                    Ready
                  </span>
                  <span className="leading-snug">
                    No baseline ATS gaps detected. Open Full Rubric to score against a job posting.
                  </span>
                </div>
              )}
            </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Waiting for resume source...
              </p>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
