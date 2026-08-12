"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Bot,
  Sparkles,
  Loader2,
  AlertTriangle,
  Settings,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Wand2,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { QualitativeCategoryFeedback, BulletFeedback } from "@/lib/ai/qualitative-schema";
import { TypstRepairProposal } from "@/lib/ai/repair-schema";
import { compileTypstToSvg } from "@/lib/typst/compiler";

interface AiSidebarProps {
  /** Current Typst source in the editor buffer */
  source: string;
  /** Setter to apply AI suggestions directly to the buffer */
  onApplyToBuffer: (newSource: string) => void;
  /** Optional callback to toggle collapse state of AI sidebar */
  onToggleCollapse?: () => void;
  /** Collapsed state boolean */
  isCollapsed?: boolean;
  /** Task 10.5: Active compile error repair context */
  repairContext?: {
    compileError: string;
    line?: number;
    column?: number;
    sourceExcerpt?: string;
  } | null;
  /** Callback to clear/dismiss repair mode */
  onDismissRepair?: () => void;
}

interface ProviderSettings {
  provider: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

interface PatchSuggestion {
  id: string;
  operation: string;
  targetSection: string;
  before: string;
  after: string;
  rationale: string;
  confidence: number;
  evidenceIds: string[];
}

interface GapItem {
  requirement: string;
  severity: "CRITICAL" | "MODERATE" | "MINOR";
  recommendation: string;
}

function loadAiSettings(): ProviderSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("resumeforge_ai_settings");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.provider || !parsed?.apiKey) return null;
    return parsed as ProviderSettings;
  } catch {
    return null;
  }
}

const SEVERITY_COLORS = {
  CRITICAL: "text-red-400 bg-red-950/50 border-red-800/50",
  MODERATE: "text-amber-400 bg-amber-950/50 border-amber-800/50",
  MINOR: "text-slate-400 bg-slate-800/60 border-slate-700/50",
};

export function AiSidebar({
  source,
  onApplyToBuffer,
  onToggleCollapse,
  isCollapsed,
  repairContext,
  onDismissRepair,
}: AiSidebarProps) {
  const searchParams = useSearchParams();
  const urlJobId = searchParams ? searchParams.get("jobId") : null;

  const [jdText, setJdText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noKeyError, setNoKeyError] = useState(false);
  const [suggestions, setSuggestions] = useState<PatchSuggestion[]>([]);
  const [gaps, setGaps] = useState<GapItem[]>([]);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());
  const [showGaps, setShowGaps] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);

  // Task 9.6: Seeded feedback context from Tailor review
  const [seededFeedback, setSeededFeedback] = useState<{
    jobId: string;
    overviewCommentary: string;
    categoryFeedbacks: QualitativeCategoryFeedback[];
    bulletFeedbacks: BulletFeedback[];
    nextStepsAdvice: string[];
    timestamp: number;
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const activeJobId = urlJobId || sessionStorage.getItem("resumeforge_active_job_id") || "default";
    const stored = sessionStorage.getItem(`resumeforge_tailor_feedback_${activeJobId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.overviewCommentary) {
          setSeededFeedback(parsed);
          sessionStorage.removeItem(`resumeforge_tailor_feedback_${activeJobId}`);
        }
      } catch {
        // ignore
      }
    }
  }, [urlJobId]);

  const handleDismissSeededFeedback = () => {
    setSeededFeedback(null);
    if (typeof window !== "undefined") {
      const activeJobId = urlJobId || sessionStorage.getItem("resumeforge_active_job_id") || "default";
      sessionStorage.removeItem(`resumeforge_tailor_feedback_${activeJobId}`);
    }
  };

  // Auto-populate from active job in sessionStorage
  useEffect(() => {
    const activeJobId = sessionStorage.getItem("resumeforge_active_job_id");
    if (!activeJobId) return;
    fetch(`/api/jobs/${activeJobId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.rawDescription) {
          setJdText(json.data.rawDescription);
        }
      })
      .catch(() => {});
  }, []);

  const handleGenerate = useCallback(async () => {
    setError(null);
    setNoKeyError(false);

    if (!jdText.trim()) {
      setError("Paste a job description first.");
      return;
    }

    const aiSettings = loadAiSettings();
    if (!aiSettings) {
      setNoKeyError(true);
      setError("No AI provider configured. Go to Settings to add your API key.");
      return;
    }

    setIsGenerating(true);
    setSuggestions([]);
    setGaps([]);
    setAcceptedIds(new Set());
    setRejectedIds(new Set());
    setHasApplied(false);

    try {
      // Step 1: Extract requirements from JD text
      const extractRes = await fetch("/api/jobs/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawDescription: jdText }),
      });
      const extractJson = await extractRes.json();

      if (!extractRes.ok || !extractJson.success) {
        setError(extractJson.error || "Failed to extract job requirements.");
        return;
      }

      const jobRequirements = extractJson.data;

      // Step 2: Generate patches against master resume
      const patchRes = await fetch("/api/ai/generate-patches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerConfig: {
            provider: aiSettings.provider,
            apiKey: aiSettings.apiKey,
            baseUrl: aiSettings.baseUrl || undefined,
            model: aiSettings.model || undefined,
          },
          jobRequirements: {
            requiredSkills: jobRequirements.requiredSkills,
            preferredSkills: jobRequirements.preferredSkills,
            domainTerms: jobRequirements.domainTerms,
          },
          tailorFeedback: seededFeedback
            ? {
                overviewCommentary: seededFeedback.overviewCommentary,
                nextStepsAdvice: seededFeedback.nextStepsAdvice,
              }
            : undefined,
        }),
      });

      const patchJson = await patchRes.json();

      if (!patchRes.ok || !patchJson.success) {
        const errMsg = patchJson.error || "AI generation failed.";
        setError(errMsg);
        if (errMsg.toLowerCase().includes("api key") || errMsg.toLowerCase().includes("provider")) {
          setNoKeyError(true);
        }
        return;
      }

      setSuggestions(patchJson.data.verified || []);
      setGaps(patchJson.data.gaps || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error during generation.");
    } finally {
      setIsGenerating(false);
    }
  }, [jdText, seededFeedback]);

  const handleAccept = (id: string) => {
    setAcceptedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setRejectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleReject = (id: string) => {
    setRejectedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setAcceptedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleApplyAccepted = () => {
    // Apply all accepted patches to the buffer by simple string replacement
    let updatedSource = source;
    for (const patch of suggestions) {
      if (acceptedIds.has(patch.id) && patch.before && patch.after) {
        updatedSource = updatedSource.replace(patch.before, patch.after);
      }
    }
    onApplyToBuffer(updatedSource);
    setHasApplied(true);
  };

  const pendingCount = suggestions.filter(
    (s) => !acceptedIds.has(s.id) && !rejectedIds.has(s.id)
  ).length;

  // Task 10.5: Typst Repair Assist state
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairProposal, setRepairProposal] = useState<TypstRepairProposal | null>(null);
  const [repairError, setRepairError] = useState<string | null>(null);
  const [preValidationValid, setPreValidationValid] = useState<boolean | null>(null);
  const [preValidationError, setPreValidationError] = useState<string | null>(null);
  const [repairApplied, setRepairApplied] = useState(false);
  const [confirmLargeRepair, setConfirmLargeRepair] = useState(false);

  useEffect(() => {
    setRepairProposal(null);
    setRepairError(null);
    setPreValidationValid(null);
    setPreValidationError(null);
    setRepairApplied(false);
    setConfirmLargeRepair(false);
  }, [repairContext]);

  const handleGenerateRepair = async () => {
    if (!repairContext) return;
    setIsRepairing(true);
    setRepairError(null);
    setRepairProposal(null);
    setPreValidationValid(null);
    setPreValidationError(null);
    setRepairApplied(false);
    setConfirmLargeRepair(false);

    try {
      const providerConfig = loadAiSettings();

      const res = await fetch("/api/ai/repair-typst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          compileError: repairContext.compileError,
          line: repairContext.line,
          column: repairContext.column,
          sourceExcerpt: repairContext.sourceExcerpt,
          providerConfig,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success && json.data) {
        const prop: TypstRepairProposal = json.data;
        setRepairProposal(prop);

        // Pre-validate replacementSource on client with WASM Typst compiler
        const valResult = await compileTypstToSvg(prop.replacementSource);
        if (!valResult.success) {
          setPreValidationValid(false);
          setPreValidationError(valResult.error.message);
        } else {
          setPreValidationValid(true);
          setPreValidationError(null);
        }
      } else {
        setRepairError(json.error || "Failed to generate Typst repair proposal");
      }
    } catch (err) {
      setRepairError(err instanceof Error ? err.message : "Error generating repair");
    } finally {
      setIsRepairing(false);
    }
  };

  const handleApplyRepairFix = () => {
    if (!repairProposal || preValidationValid === false) return;
    onApplyToBuffer(repairProposal.replacementSource);
    setRepairApplied(true);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <span className="flex items-center gap-2 text-xs font-semibold text-slate-200">
          <Wand2 className="h-4 w-4 text-amber-400" />
          {repairContext ? "Typst Repair Assist" : "AI Tailoring Assistant"}
        </span>
        <div className="flex items-center gap-2">
          {repairContext && onDismissRepair && (
            <button
              type="button"
              onClick={onDismissRepair}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close Repair Assist Mode"
              data-testid="close-repair-mode-btn"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <Link
            href="/settings"
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition"
          >
            <Settings className="h-3 w-3" />
            Settings
          </Link>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title={isCollapsed ? "Expand AI Sidebar" : "Collapse AI Sidebar"}
              data-testid="toggle-ai-sidebar-btn"
            >
              {isCollapsed ? (
                <PanelRightOpen className="h-3.5 w-3.5 text-amber-400" />
              ) : (
                <PanelRightClose className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 flex-col overflow-y-auto p-4 gap-4">
        {/* Task 10.5: Typst Repair Assist Mode Card */}
        {repairContext && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-3.5 text-xs text-amber-200 shadow-md space-y-3">
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
              <div className="flex items-center gap-2 font-bold text-amber-400">
                <Sparkles className="h-4 w-4" />
                <span>Typst Repair Assist</span>
              </div>
              {onDismissRepair && (
                <button
                  type="button"
                  onClick={onDismissRepair}
                  className="text-slate-400 hover:text-white text-xs font-mono"
                  data-testid="close-repair-mode-btn"
                >
                  ✕ Exit
                </button>
              )}
            </div>

            <div className="space-y-1 font-mono text-[11px] bg-slate-900/80 p-2.5 rounded border border-slate-800">
              <div className="text-red-400 font-semibold">Compiler Error:</div>
              <div className="text-slate-300 break-words">{repairContext.compileError}</div>
              {repairContext.line && (
                <div className="text-slate-500 text-[10px]">Line: {repairContext.line}</div>
              )}
            </div>

            {repairError && (
              <div className="p-2 rounded bg-red-950/50 border border-red-800 text-red-300 text-[11px]">
                {repairError}
              </div>
            )}

            {!repairProposal && (
              <button
                type="button"
                disabled={isRepairing}
                onClick={handleGenerateRepair}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs shadow transition cursor-pointer"
                data-testid="generate-repair-btn"
              >
                {isRepairing ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                ) : (
                  <Sparkles className="h-4 w-4 text-slate-950" />
                )}
                {isRepairing ? "Diagnosing & Generating Fix..." : "Generate AI Repair Proposal"}
              </button>
            )}

            {repairProposal && (
              <div className="space-y-3 pt-1 border-t border-amber-500/30">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-300 text-xs">Proposal Summary</span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                    repairProposal.confidence === "high"
                      ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                      : repairProposal.confidence === "medium"
                      ? "bg-amber-950 text-amber-400 border-amber-800"
                      : "bg-red-950 text-red-400 border-red-800"
                  }`}>
                    {repairProposal.confidence} confidence
                  </span>
                </div>

                <p className="text-slate-300 leading-relaxed font-sans">{repairProposal.summary}</p>
                <div className="text-slate-400 text-[11px] italic font-sans">{repairProposal.errorAnalysis}</div>

                {/* Pre-compilation status badge */}
                {preValidationValid === true && (
                  <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 p-2 rounded text-[11px]">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Pre-compilation verification: PASSED</span>
                  </div>
                )}

                {preValidationValid === false && (
                  <div className="flex items-center gap-1.5 text-red-400 bg-red-950/40 border border-red-800/40 p-2 rounded text-[11px]">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Pre-compilation verification: FAILED ({preValidationError})</span>
                  </div>
                )}

                {/* Diff-scope warning & confirmation checkbox if proposal modifies > 25% of lines */}
                {(() => {
                  const origLineCount = source.split("\n").length;
                  const isLargeDiff =
                    repairProposal.changedLinesCount !== undefined &&
                    origLineCount > 0 &&
                    repairProposal.changedLinesCount / origLineCount > 0.25;

                  return (
                    <>
                      {isLargeDiff && (
                        <div className="p-2.5 rounded bg-amber-950/60 border border-amber-700 text-amber-300 text-[11px] space-y-2">
                          <div className="flex items-center gap-1.5 font-bold text-amber-400">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>Large Repair Warning ({repairProposal.changedLinesCount} lines changed, &gt;25% of document)</span>
                          </div>
                          <p className="text-[10px] text-amber-200/90 leading-tight">
                            Applying this proposal will replace a substantial portion of your document. Confirm below to enable Apply Fix.
                          </p>
                          <label className="flex items-start gap-2 text-[11px] text-amber-300 cursor-pointer pt-0.5">
                            <input
                              type="checkbox"
                              checked={confirmLargeRepair}
                              onChange={(e) => setConfirmLargeRepair(e.target.checked)}
                              className="mt-0.5 rounded border-amber-600 bg-slate-900 text-amber-500 focus:ring-amber-500"
                              data-testid="confirm-large-repair-checkbox"
                            />
                            <span>I confirm I want to replace &gt;25% of my document.</span>
                          </label>
                        </div>
                      )}

                      {repairProposal.warnings && repairProposal.warnings.length > 0 && (
                        <ul className="list-disc pl-4 text-[10px] text-amber-400 space-y-0.5">
                          {repairProposal.warnings.map((w, idx) => (
                            <li key={idx}>{w}</li>
                          ))}
                        </ul>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={preValidationValid === false || (isLargeDiff && !confirmLargeRepair) || repairApplied}
                          onClick={handleApplyRepairFix}
                          className="flex-1 py-1.5 px-3 rounded font-bold text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow transition cursor-pointer"
                          data-testid="apply-typst-fix-btn"
                        >
                          {repairApplied ? "Fix Applied!" : "Apply Fix"}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(repairProposal.replacementSource);
                          }}
                          className="py-1.5 px-3 rounded font-semibold text-xs border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 transition"
                        >
                          Copy
                        </button>

                        {onDismissRepair && (
                          <button
                            type="button"
                            onClick={onDismissRepair}
                            className="py-1.5 px-3 rounded font-semibold text-xs border border-slate-800 bg-slate-950 text-slate-400 hover:text-white transition"
                          >
                            Dismiss
                          </button>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}
        {/* Seeded Tailor Feedback Banner */}
        {seededFeedback && (
          <div
            data-testid="seeded-feedback-banner"
            className="p-3.5 bg-amber-950/40 border border-amber-800/60 rounded-xl space-y-2 text-xs shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-amber-300 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                Seeded Feedback from Tailor Review
              </span>
              <button
                type="button"
                onClick={handleDismissSeededFeedback}
                data-testid="dismiss-seeded-feedback-btn"
                className="text-amber-400 hover:text-amber-200 text-[10px] underline font-medium"
              >
                Dismiss Context
              </button>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed italic bg-slate-900/80 p-2 rounded border border-slate-800">
              &quot;{seededFeedback.overviewCommentary}&quot;
            </p>
            {seededFeedback.nextStepsAdvice && seededFeedback.nextStepsAdvice.length > 0 && (
              <div className="text-[10px] text-amber-200 space-y-0.5 pt-1">
                <span className="font-semibold block text-amber-400">Recommended Actions:</span>
                <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                  {seededFeedback.nextStepsAdvice.map((adv: string, idx: number) => (
                    <li key={idx}>{adv}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* JD Input */}
        <div className="space-y-2">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Job Description
          </label>
          <textarea
            rows={6}
            value={jdText}
            onChange={(e) => {
              setJdText(e.target.value);
              setError(null);
              setNoKeyError(false);
            }}
            placeholder={"Paste the job posting here…\n\n(or navigate to a job in the Tracker and click Copy JD to auto-fill)"}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 resize-none font-mono leading-relaxed"
          />
        </div>

        {/* Error banner */}
        {error && (
          <div
            className={`p-3 rounded-lg flex items-start gap-2 text-xs border ${
              noKeyError
                ? "bg-amber-950/50 border-amber-800/60 text-amber-300"
                : "bg-red-950/50 border-red-800/50 text-red-300"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span>{error}</span>
              {noKeyError && (
                <Link
                  href="/settings"
                  className="block underline underline-offset-2 text-amber-400 hover:text-amber-300 font-medium"
                >
                  → Configure your API key in Settings
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Generate button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || !jdText.trim()}
          className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold text-xs py-2.5 rounded-lg shadow shadow-amber-500/20 transition"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating suggestions…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Suggestions
            </>
          )}
        </button>

        {/* Suggestions list */}
        {suggestions.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                {suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""}
                {pendingCount > 0 && (
                  <span className="ml-2 text-amber-400">{pendingCount} pending</span>
                )}
              </h3>
              {acceptedIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleApplyAccepted}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                    hasApplied
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-amber-500 hover:bg-amber-400 text-slate-950"
                  }`}
                >
                  {hasApplied ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      Applied!
                    </>
                  ) : (
                    <>
                      <ClipboardCheck className="h-3 w-3" />
                      Apply {acceptedIds.size} accepted
                    </>
                  )}
                </button>
              )}
            </div>

            {suggestions.map((s) => {
              const isAccepted = acceptedIds.has(s.id);
              const isRejected = rejectedIds.has(s.id);
              return (
                <div
                  key={s.id}
                  className={`rounded-lg border p-3 space-y-2 text-xs transition-all ${
                    isAccepted
                      ? "border-emerald-700/50 bg-emerald-950/30"
                      : isRejected
                      ? "border-slate-800/50 bg-slate-900/40 opacity-50"
                      : "border-slate-800 bg-slate-900"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-slate-300 leading-snug line-clamp-2">
                      {s.targetSection}
                    </span>
                    <span className="shrink-0 text-[10px] font-mono text-slate-500">
                      {Math.round(s.confidence * 100)}%
                    </span>
                  </div>

                  {s.before && (
                    <div className="text-[10px] bg-red-950/30 border border-red-900/40 rounded p-2 text-red-300 font-mono line-clamp-2">
                      − {s.before}
                    </div>
                  )}
                  {s.after && (
                    <div className="text-[10px] bg-emerald-950/30 border border-emerald-900/40 rounded p-2 text-emerald-300 font-mono line-clamp-2">
                      + {s.after}
                    </div>
                  )}

                  <p className="text-slate-500 text-[10px] leading-relaxed">{s.rationale}</p>

                  {!isAccepted && !isRejected && (
                    <div className="flex gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleAccept(s.id)}
                        className="flex-1 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold transition"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(s.id)}
                        className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 text-[10px] font-semibold transition"
                      >
                        Skip
                      </button>
                    </div>
                  )}
                  {(isAccepted || isRejected) && (
                    <button
                      type="button"
                      onClick={() => {
                        setAcceptedIds((p) => { const n = new Set(p); n.delete(s.id); return n; });
                        setRejectedIds((p) => { const n = new Set(p); n.delete(s.id); return n; });
                      }}
                      className="text-[10px] text-slate-500 hover:text-slate-300 transition flex items-center gap-1"
                    >
                      <X className="h-3 w-3" />
                      Undo
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Gaps section */}
        {gaps.length > 0 && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowGaps((v) => !v)}
              className="flex items-center justify-between w-full text-[10px] font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition"
            >
              <span>{gaps.length} gap{gaps.length !== 1 ? "s" : ""} identified</span>
              {showGaps ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {showGaps &&
              gaps.map((g, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-2.5 text-[11px] ${SEVERITY_COLORS[g.severity]}`}
                >
                  <p className="font-semibold">{g.requirement}</p>
                  <p className="mt-1 text-[10px] opacity-80">{g.recommendation}</p>
                </div>
              ))}
          </div>
        )}

        {/* Empty state */}
        {!isGenerating && suggestions.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center flex-1 text-center py-6 gap-3">
            <div className="rounded-full bg-amber-500/10 border border-amber-500/20 p-3">
              <Bot className="h-6 w-6 text-amber-400" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-300">Tailoring Assistant</p>
              <p className="text-[11px] text-slate-500 max-w-[200px] leading-relaxed">
                Paste a job description and click Generate to get evidence-backed resume suggestions.
              </p>
            </div>
            <Link
              href="/tracker"
              className="text-[11px] text-amber-400/80 hover:text-amber-400 underline underline-offset-2 transition"
            >
              Browse saved jobs in Tracker →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
