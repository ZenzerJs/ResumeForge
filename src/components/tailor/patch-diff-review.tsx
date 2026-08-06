"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  Check,
  X,
  Loader2,
  Info,
  Edit3,
} from "lucide-react";
import type { PatchProposal, Gap, RejectedPatch } from "@/lib/ai/patch-schema";

interface PatchDiffReviewProps {
  verified: PatchProposal[];
  rejected: RejectedPatch[];
  gaps: Gap[];
  masterResumeId: string;
  masterTypstSource: string;
  jobId: string;
  onApplySuccess?: (variantId: string, mergedContent: string) => void;
}

type PatchDecision = "pending" | "accepted" | "rejected";

const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  CRITICAL: { bg: "bg-red-950/60", border: "border-red-800/60", text: "text-red-300", icon: "text-red-400" },
  MODERATE: { bg: "bg-amber-950/60", border: "border-amber-800/60", text: "text-amber-300", icon: "text-amber-400" },
  MINOR: { bg: "bg-slate-800/60", border: "border-slate-700/60", text: "text-slate-300", icon: "text-slate-400" },
};

const OPERATION_STYLES: Record<string, { bg: string; text: string }> = {
  MODIFY_BULLET: { bg: "bg-indigo-950", text: "text-indigo-300" },
  ADD_SKILL: { bg: "bg-emerald-950", text: "text-emerald-300" },
  REORDER_BULLETS: { bg: "bg-purple-950", text: "text-purple-300" },
  TWEAK_SUMMARY: { bg: "bg-cyan-950", text: "text-cyan-300" },
};

/**
 * Phase 4.2: Patch Diff Review Component
 *
 * Renders verified patches with side-by-side before/after diffs,
 * rejected patches with invalid citation warnings (Amendment 1),
 * gap reports with severity badges, and individual accept/reject controls.
 *
 * Amendment 2: Validates Typst compilation before persisting applied patches.
 */
export function PatchDiffReview({
  verified,
  rejected,
  gaps,
  masterResumeId,
  masterTypstSource,
  jobId,
  onApplySuccess,
}: PatchDiffReviewProps) {
  const [decisions, setDecisions] = useState<Record<string, PatchDecision>>(() => {
    const initial: Record<string, PatchDecision> = {};
    for (const patch of verified) {
      initial[patch.id] = "pending";
    }
    return initial;
  });

  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [createdVariantId, setCreatedVariantId] = useState<string | null>(null);

  const acceptedPatches = verified.filter((p) => decisions[p.id] === "accepted");
  const rejectedByUser = verified.filter((p) => decisions[p.id] === "rejected");
  const pendingPatches = verified.filter((p) => decisions[p.id] === "pending");

  const handleDecision = (patchId: string, decision: PatchDecision) => {
    setDecisions((prev) => ({ ...prev, [patchId]: decision }));
  };

  const handleAcceptAll = () => {
    const updated: Record<string, PatchDecision> = {};
    for (const patch of verified) {
      updated[patch.id] = "accepted";
    }
    setDecisions(updated);
  };

  const handleRejectAll = () => {
    const updated: Record<string, PatchDecision> = {};
    for (const patch of verified) {
      updated[patch.id] = "rejected";
    }
    setDecisions(updated);
  };

  /**
   * Apply accepted patches:
   * 1. Compute merged Typst content
   * 2. Validate compilation via Typst WASM compiler (Amendment 2)
   * 3. Persist as ResumeVariant via API (Amendment 3)
   */
  const handleApplyAccepted = async () => {
    if (acceptedPatches.length === 0) {
      setApplyError("No patches accepted. Please accept at least one patch to apply.");
      return;
    }

    setIsApplying(true);
    setApplyError(null);
    setApplySuccess(null);

    try {
      // Step 1: Compute merged Typst content
      let mergedContent = masterTypstSource;
      for (const patch of acceptedPatches) {
        if (patch.before && patch.after && mergedContent.includes(patch.before)) {
          mergedContent = mergedContent.replace(patch.before, patch.after);
        }
      }

      // Step 2: Amendment 2 — Typst compile validation
      // Import compiler dynamically (browser-only WASM)
      const { compileTypstToSvg } = await import("@/lib/typst/compiler");
      const compileResult = await compileTypstToSvg(mergedContent);

      if (!compileResult.success) {
        const errorMsg = "error" in compileResult ? compileResult.error.message : "Unknown compilation error";
        setApplyError(
          `Typst compilation failed — cannot apply patches. Error: ${errorMsg}. ` +
          `The merged resume content does not compile. Please review and adjust the accepted patches.`
        );
        setIsApplying(false);
        return;
      }

      // Step 3: Persist as ResumeVariant via API
      const res = await fetch("/api/ai/apply-patches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterResumeId,
          jobId,
          variantTitle: `AI Tailored Variant — ${new Date().toLocaleDateString()}`,
          mergedTypstContent: mergedContent,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setApplyError(json.error || "Failed to save tailored variant.");
        setIsApplying(false);
        return;
      }

      setCreatedVariantId(json.data.variantId);
      setApplySuccess(
        `Tailored variant "${json.data.variantTitle}" created successfully.`
      );
      onApplySuccess?.(json.data.variantId, mergedContent);
    } catch (err) {
      setApplyError(`Error applying patches: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="patch-diff-review">
      {/* Summary Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-emerald-300 font-medium">
            ✓ {verified.length} verified patches
          </span>
          {rejected.length > 0 && (
            <span className="text-red-400 font-medium">
              ✗ {rejected.length} rejected (invalid citations)
            </span>
          )}
          {gaps.length > 0 && (
            <span className="text-amber-400 font-medium">
              ⚠ {gaps.length} unmet gaps
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAcceptAll}
            className="px-3 py-1.5 bg-emerald-900/60 hover:bg-emerald-800/60 border border-emerald-700/60 text-emerald-300 text-xs rounded-md transition"
            data-testid="accept-all-btn"
          >
            Accept All
          </button>
          <button
            type="button"
            onClick={handleRejectAll}
            className="px-3 py-1.5 bg-red-900/60 hover:bg-red-800/60 border border-red-700/60 text-red-300 text-xs rounded-md transition"
            data-testid="reject-all-btn"
          >
            Reject All
          </button>
        </div>
      </div>

      {/* Gap Reports Panel */}
      {gaps.length > 0 && (
        <div className="space-y-3" data-testid="gaps-panel">
          <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Unmet Job Requirements ({gaps.length})
          </h3>
          {gaps.map((gap, idx) => {
            const style = SEVERITY_STYLES[gap.severity] || SEVERITY_STYLES.MINOR;
            return (
              <div
                key={`gap-${idx}`}
                data-testid="gap-item"
                className={`${style.bg} ${style.border} border rounded-lg p-4 space-y-2`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${style.bg} ${style.text} border ${style.border}`}
                  >
                    {gap.severity}
                  </span>
                  <span className={`text-sm font-medium ${style.text}`}>
                    {gap.requirement}
                  </span>
                </div>
                <p className="text-xs text-slate-300 flex items-start gap-2">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400" />
                  {gap.recommendation}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Rejected Patches Panel (Amendment 1) */}
      {rejected.length > 0 && (
        <div className="space-y-3" data-testid="rejected-patches-panel">
          <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Rejected Patches — Invalid Citations ({rejected.length})
          </h3>
          <p className="text-xs text-slate-400">
            These patches were rejected because they cited evidence IDs that do not exist in the active Evidence Bank.
            This prevents AI hallucination from reaching your resume.
          </p>
          {rejected.map((item, idx) => (
            <div
              key={`rejected-${idx}`}
              data-testid="rejected-patch-item"
              className="bg-red-950/30 border border-red-900/50 rounded-lg p-4 space-y-2"
            >
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-400" />
                <span className="text-xs font-mono text-red-300 bg-red-950 px-2 py-0.5 rounded">
                  {item.patch.operation}
                </span>
                <span className="text-xs text-red-200">{item.patch.targetSection}</span>
              </div>
              <div className="text-xs text-red-300/80 bg-red-950/50 rounded p-2 font-mono">
                {item.reason}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase">Before</span>
                  <div className="text-slate-400 bg-slate-950/50 rounded p-2 mt-1 font-mono">
                    {item.patch.before || "(empty)"}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase">After (Rejected)</span>
                  <div className="text-red-300/60 bg-slate-950/50 rounded p-2 mt-1 font-mono line-through">
                    {item.patch.after || "(empty)"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Verified Patches Diff List */}
      {verified.length > 0 && (
        <div className="space-y-3" data-testid="verified-patches-panel">
          <h3 className="text-sm font-semibold text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Proposed Changes ({verified.length})
            <span className="text-xs font-normal text-slate-400 ml-2">
              {acceptedPatches.length} accepted · {rejectedByUser.length} rejected · {pendingPatches.length} pending
            </span>
          </h3>

          {verified.map((patch) => {
            const decision = decisions[patch.id];
            const opStyle = OPERATION_STYLES[patch.operation] || { bg: "bg-slate-800", text: "text-slate-300" };

            return (
              <div
                key={patch.id}
                data-testid={`patch-card-${patch.id}`}
                className={`border rounded-xl p-4 space-y-3 transition-all ${
                  decision === "accepted"
                    ? "bg-emerald-950/20 border-emerald-800/50"
                    : decision === "rejected"
                    ? "bg-red-950/10 border-red-900/30 opacity-60"
                    : "bg-slate-900 border-slate-800"
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${opStyle.bg} ${opStyle.text} border border-current/20`}>
                      {patch.operation.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-slate-300 font-medium">{patch.targetSection}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Confidence: {Math.round(patch.confidence * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleDecision(patch.id, "accepted")}
                      data-testid={`accept-patch-${patch.id}`}
                      className={`p-1.5 rounded-md transition ${
                        decision === "accepted"
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-800 hover:bg-emerald-900/60 text-slate-400 hover:text-emerald-300"
                      }`}
                      title="Accept patch"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecision(patch.id, "rejected")}
                      data-testid={`reject-patch-${patch.id}`}
                      className={`p-1.5 rounded-md transition ${
                        decision === "rejected"
                          ? "bg-red-600 text-white"
                          : "bg-slate-800 hover:bg-red-900/60 text-slate-400 hover:text-red-300"
                      }`}
                      title="Reject patch"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Side-by-side diff */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 font-semibold">Before</span>
                    <div className="text-xs text-slate-300 bg-red-950/20 border border-red-900/30 rounded-lg p-3 mt-1 font-mono whitespace-pre-wrap">
                      {patch.before || "(empty)"}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 font-semibold">After</span>
                    <div className="text-xs text-emerald-200 bg-emerald-950/20 border border-emerald-900/30 rounded-lg p-3 mt-1 font-mono whitespace-pre-wrap">
                      {patch.after || "(empty)"}
                    </div>
                  </div>
                </div>

                {/* Rationale */}
                <p className="text-xs text-slate-400 flex items-start gap-2">
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-indigo-400" />
                  {patch.rationale}
                </p>

                {/* Evidence Citations */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold mr-1">Evidence:</span>
                  {patch.evidenceIds.map((eid) => (
                    <span
                      key={eid}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/50"
                    >
                      {eid.length > 16 ? `${eid.slice(0, 8)}…${eid.slice(-4)}` : eid}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Apply Accepted Patches Button */}
      {verified.length > 0 && (
        <div className="space-y-3">
          {applyError && (
            <div
              className="p-3 bg-red-950/50 border border-red-800/50 rounded-lg flex items-center gap-2 text-xs text-red-300"
              data-testid="apply-error"
            >
              <XCircle className="h-4 w-4 shrink-0" />
              <span>{applyError}</span>
            </div>
          )}

          {applySuccess && (
            <div
              className="p-4 bg-emerald-950/60 border border-emerald-800/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-300 shadow-md"
              data-testid="apply-success"
            >
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                <div>
                  <span className="font-semibold block text-white">{applySuccess}</span>
                  <span className="text-[11px] text-slate-300">
                    Your tailored variant is saved to the database. Edit and compile it live in the editor.
                  </span>
                </div>
              </div>

              {createdVariantId && (
                <Link
                  href={`/editor?variantId=${createdVariantId}`}
                  data-testid="open-variant-in-editor-btn"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg flex items-center gap-1.5 shadow-md transition shrink-0 self-start sm:self-center"
                >
                  <Edit3 className="h-4 w-4" />
                  Open Variant in Editor
                </Link>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleApplyAccepted}
            disabled={isApplying || acceptedPatches.length === 0}
            data-testid="apply-patches-btn"
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm px-6 py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition"
          >
            {isApplying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Compiling & Applying Patches...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Apply {acceptedPatches.length} Accepted Patch{acceptedPatches.length !== 1 ? "es" : ""} & Create Variant
              </>
            )}
          </button>
        </div>
      )}

      {/* Empty state */}
      {verified.length === 0 && rejected.length === 0 && gaps.length === 0 && (
        <div className="text-center py-12 text-slate-500 text-xs">
          No patch proposals generated yet.
        </div>
      )}
    </div>
  );
}
