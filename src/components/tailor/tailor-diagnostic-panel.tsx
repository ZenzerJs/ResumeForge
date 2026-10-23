"use client";

import React, { useState } from "react";
import { ResumeDiagnosticReport, ResumeDiagnosticItem } from "@/lib/schema/resumeFeedback";
import { applyDeterministicPatch } from "@/lib/diagnostics/deterministicPatcher";
import { validateMetricGrounding } from "@/lib/diagnostics/deterministicPatcher";
import { hasSkillWordBoundary } from "@/lib/diagnostics/auditResume";
import { BadgeCheck, TriangleAlert, Save } from "lucide-react";

interface RankedMatchLite {
  id: string;
  verifiedSummary: string;
  tags: string[];
  matchedBullets?: Array<{ id: string; text: string }>;
}

export interface DiagnosticVariantContext {
  masterResumeId: string | null;
  jobId: string | null;
}

interface TailorDiagnosticPanelProps {
  report?: ResumeDiagnosticReport;
  /** Current variant/master Typst source to patch — no fake AST fallback. */
  typstAst: string;
  /** Evidence bank items available for grounding deterministic fixes. */
  evidence?: RankedMatchLite[];
  /** Called with the patched Typst source so the parent can update working copy state. */
  onPatchApplied?: (patchedTypstAst: string) => void;
  /** Context required to persist a patched working copy as a ResumeVariant. */
  variantContext?: DiagnosticVariantContext;
}

/** Pure gating helper — exported for unit testing. */
export function canPersistDiagnosticVariant(
  context: DiagnosticVariantContext | undefined,
  patchedTypstAst: string | null
): { allowed: boolean; reason?: string } {
  if (!patchedTypstAst) return { allowed: false, reason: "Apply a fix first." };
  if (!context?.masterResumeId) return { allowed: false, reason: "Save a Master Resume first." };
  if (!context?.jobId) return { allowed: false, reason: "Save the job posting first." };
  return { allowed: true };
}

/** Pure title builder — exported for unit testing. */
export function buildDiagnosticVariantTitle(now: Date = new Date()): string {
  return `Deterministic Fix Variant — ${now.toLocaleDateString()}`;
}

/**
 * Extracts the canonical skill/requirement name from a diagnostic message,
 * stripping both the diagnostic prefix and the Evidence Bank advisory suffix.
 */
export function extractDiagnosticSkill(message: string): string {
  return message
    .replace(/^Missing required skill:\s*/i, "")
    .replace(/^Consider adding preferred tooling:\s*/i, "")
    .replace(/\.\s*Only add if you have real experience.*$/i, "")
    .replace(/\s*\(only add if you have real experience.*\)\.?$/i, "")
    .trim();
}

export type DiagnosticFixActionResult =
  | { applied: true; patchedTypstAst: string; evidenceId: string }
  | { applied: false; error: string };

/**
 * Pure deterministic fix resolver — exported for unit testing.
 * Refuses to insert any unverified skill or fabricate content when no matching
 * Evidence Bank item or specific bullet anchor exists.
 */
export function resolveDiagnosticFixAction(
  item: ResumeDiagnosticItem,
  typstAst: string,
  evidence: RankedMatchLite[]
): DiagnosticFixActionResult {
  if (typstAst.trim().length === 0) {
    return {
      applied: false,
      error: "No resume content loaded — cannot apply a deterministic fix.",
    };
  }

  const diagnosticSkill = extractDiagnosticSkill(item.message);
  const evidenceMatch = evidence.find((e) => {
    const haystack = [e.verifiedSummary, ...(e.tags || [])].join(" ");
    return diagnosticSkill.length > 0 && hasSkillWordBoundary(haystack, diagnosticSkill);
  });

  if (!evidenceMatch) {
    return {
      applied: false,
      error: `No verified evidence found for "${item.message}". Add matching evidence in the Library first — this tool never invents experience.`,
    };
  }

  const targetBulletId =
    item.targetLineOrBulletId && item.targetLineOrBulletId !== "global"
      ? item.targetLineOrBulletId
      : null;
  if (!targetBulletId) {
    return {
      applied: false,
      error: "This diagnostic is document-level (no bullet anchor). Edit the resume directly in the editor.",
    };
  }

  const grounding = validateMetricGrounding(
    evidenceMatch.verifiedSummary,
    evidenceMatch.verifiedSummary
  );
  if (!grounding.valid) {
    return {
      applied: false,
      error: `Evidence metric not grounded: ${grounding.reason}`,
    };
  }

  const result = applyDeterministicPatch(typstAst, evidenceMatch.id, targetBulletId, [
    {
      id: evidenceMatch.id,
      content: evidenceMatch.verifiedSummary,
      extractedTechnologies: e_tags(evidenceMatch),
    },
  ]);

  if (!result.applied) {
    return {
      applied: false,
      error: result.error || "Patch could not be applied — anchor not found.",
    };
  }

  return {
    applied: true,
    patchedTypstAst: result.patchedTypstAst,
    evidenceId: evidenceMatch.id,
  };
}

/**
 * Renders the deterministic resume diagnostics and applies real, evidence-grounded
 * patches against the caller's Typst source. Never fabricates evidence content:
 * a fix only applies when the diagnostic maps to a real Evidence Bank item.
 */
export const TailorDiagnosticPanel = ({
  report,
  typstAst,
  evidence = [],
  onPatchApplied,
  variantContext,
}: TailorDiagnosticPanelProps) => {
  const [patchResult, setPatchResult] = useState<string | null>(null);
  const [patchError, setPatchError] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const [isPersisting, setIsPersisting] = useState(false);
  const [persistedVariantId, setPersistedVariantId] = useState<string | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);

  if (!report) return <div>No diagnostics</div>;

  const handleApplyFix = (item: ResumeDiagnosticItem) => {
    setPatchError(null);

    try {
      const outcome = resolveDiagnosticFixAction(item, typstAst, evidence);
      if (!outcome.applied) {
        setPatchError(outcome.error);
        return;
      }
      setPatchResult(outcome.patchedTypstAst);
      setAppliedIds((prev) => [...prev, item.id]);
      setPersistedVariantId(null);
      setPersistError(null);
      onPatchApplied?.(outcome.patchedTypstAst);
    } catch (err) {
      console.error(err);
      setPatchError("Unexpected error while applying the deterministic fix.");
    }
  };

  /**
   * Persists the patched working copy as a ResumeVariant via the same
   * Amendment-2/Amendment-3 guarded pipeline used by AI patch application.
   * Gated on a real master resume + saved job — never fabricates either.
   */
  const handleSaveVariant = async () => {
    setPersistError(null);
    const gate = canPersistDiagnosticVariant(variantContext, patchResult);
    if (!gate.allowed) {
      setPersistError(gate.reason || "Cannot save variant.");
      return;
    }

    setIsPersisting(true);
    try {
      // Amendment 2: validate Typst compilation BEFORE persisting.
      const { compileTypstToSvg } = await import("@/lib/typst/compiler");
      const compileResult = await compileTypstToSvg(patchResult!);
      if (!compileResult.success) {
        const errorMsg =
          "error" in compileResult ? compileResult.error.message : "Unknown compilation error";
        setPersistError(
          `Typst compilation failed — variant not saved. Error: ${errorMsg}`
        );
        return;
      }

      const res = await fetch("/api/ai/apply-patches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterResumeId: variantContext!.masterResumeId,
          jobId: variantContext!.jobId,
          variantTitle: buildDiagnosticVariantTitle(),
          mergedTypstContent: patchResult,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setPersistError(json.error || "Failed to save deterministic fix variant.");
        return;
      }
      setPersistedVariantId(json.data.variantId ?? null);
    } catch (err) {
      setPersistError(err instanceof Error ? err.message : "Failed to save deterministic fix variant.");
    } finally {
      setIsPersisting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 border rounded" data-testid="tailor-diagnostic-panel">
      <h3 className="font-bold">
        Diagnostics ({report.overallScore}%)
      </h3>

      {patchResult && (
        <div data-testid="diagnostic-patch-success" className="text-xs text-green-500 flex items-center gap-1.5">
          <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
          Patched successfully! Review the change in the editor before saving.
        </div>
      )}

      {patchResult && (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            data-testid="save-diagnostic-variant-btn"
            onClick={handleSaveVariant}
            disabled={isPersisting || Boolean(persistedVariantId)}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-amber-700/70 bg-amber-900/30 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-900/50 transition disabled:opacity-50 w-fit"
          >
            <Save className="h-3.5 w-3.5" aria-hidden />
            {persistedVariantId ? "Variant saved" : isPersisting ? "Saving variant…" : "Save as variant"}
          </button>
          {persistedVariantId && (
            <div data-testid="diagnostic-variant-saved" className="text-xs text-green-500">
              Saved as ResumeVariant. Open it from the Editor via ?variantId=.
            </div>
          )}
          {persistError && (
            <div
              data-testid="diagnostic-variant-save-error"
              role="alert"
              className="text-xs text-rose-400 rounded border border-rose-800/60 bg-rose-950/30 p-2"
            >
              {persistError}
            </div>
          )}
        </div>
      )}

      {patchError && (
        <div
          data-testid="diagnostic-patch-error"
          role="alert"
          className="text-xs text-amber-500 flex items-start gap-1.5 rounded border border-amber-800/60 bg-amber-950/30 p-2"
        >
          <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
          {patchError}
        </div>
      )}

      <div className="space-y-2">
        {report.items.map((item, index) => {
          const applied = appliedIds.includes(item.id);
          return (
            <div key={item.id} className="p-2 border rounded">
              <div className="flex justify-between items-center">
                <span
                  className={`px-2 py-1 text-xs rounded ${
                    item.severity === "urgent"
                      ? "bg-red-100 text-red-800"
                      : item.severity === "non_urgent"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {item.severity}
                </span>
                <span className="text-sm font-medium">{item.category}</span>
              </div>
              <p className="text-sm mt-1">{item.message}</p>
              {applied ? (
                <span data-testid={`diagnostic-fix-applied-${index}`} className="text-xs text-green-500 mt-2 inline-block">
                  Fix applied.
                </span>
              ) : (
                <button
                  type="button"
                  data-testid={`apply-diagnostic-fix-${index}`}
                  onClick={() => handleApplyFix(item)}
                  className="text-xs text-amber-400 mt-2 hover:underline"
                >
                  Apply Fix
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

function e_tags(item: RankedMatchLite): string[] {
  return item.tags || [];
}
