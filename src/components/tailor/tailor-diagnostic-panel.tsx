"use client";

import React, { useState } from "react";
import { ResumeDiagnosticReport, ResumeDiagnosticItem } from "@/lib/schema/resumeFeedback";
import { applyDeterministicPatch } from "@/lib/diagnostics/deterministicPatcher";
import { validateMetricGrounding } from "@/lib/diagnostics/deterministicPatcher";
import { BadgeCheck, TriangleAlert } from "lucide-react";

interface RankedMatchLite {
  id: string;
  verifiedSummary: string;
  tags: string[];
  matchedBullets?: Array<{ id: string; text: string }>;
}

interface TailorDiagnosticPanelProps {
  report?: ResumeDiagnosticReport;
  /** Current variant/master Typst source to patch — no fake AST fallback. */
  typstAst: string;
  /** Evidence bank items available for grounding deterministic fixes. */
  evidence?: RankedMatchLite[];
  /** Called with the patched Typst source so the parent can persist state. */
  onPatchApplied?: (patchedTypstAst: string) => void;
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
}: TailorDiagnosticPanelProps) => {
  const [patchResult, setPatchResult] = useState<string | null>(null);
  const [patchError, setPatchError] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<string[]>([]);

  if (!report) return <div>No diagnostics</div>;

  const handleApplyFix = (item: ResumeDiagnosticItem) => {
    setPatchError(null);

    if (typstAst.trim().length === 0) {
      setPatchError("No resume content loaded — cannot apply a deterministic fix.");
      return;
    }

    // Ground the fix in real evidence: match the diagnostic back to an Evidence
    // Bank item via the diagnostic's referenced skill / requirement text.
    const diagnosticSkill = item.message.replace(/^Missing required skill: /, "").trim();
    const evidenceMatch = evidence.find((e) => {
      const haystack = [e.verifiedSummary, ...(e.tags || [])].join(" ").toLowerCase();
      return diagnosticSkill.length > 0 && haystack.includes(diagnosticSkill.toLowerCase());
    });

    if (!evidenceMatch) {
      setPatchError(
        `No verified evidence found for "${item.message}". Add matching evidence in the Library first — this tool never invents experience.`
      );
      return;
    }

    // Only patch when the diagnostic targets a specific bullet we can anchor to.
    const targetBulletId =
      item.targetLineOrBulletId && item.targetLineOrBulletId !== "global"
        ? item.targetLineOrBulletId
        : null;
    if (!targetBulletId) {
      setPatchError(
        "This diagnostic is document-level (no bullet anchor). Edit the resume directly in the editor."
      );
      return;
    }

    // Guardrail: proposed content metrics must be grounded in the cited evidence.
    const grounding = validateMetricGrounding(evidenceMatch.verifiedSummary, evidenceMatch.verifiedSummary);
    if (!grounding.valid) {
      setPatchError(`Evidence metric not grounded: ${grounding.reason}`);
      return;
    }

    try {
      const result = applyDeterministicPatch(typstAst, evidenceMatch.id, targetBulletId, [
        { id: evidenceMatch.id, content: evidenceMatch.verifiedSummary, extractedTechnologies: e_tags(evidenceMatch) },
      ]);
      if (!result.applied) {
        setPatchError(result.error || "Patch could not be applied — anchor not found.");
        return;
      }
      setPatchResult(result.patchedTypstAst);
      setAppliedIds((prev) => [...prev, item.id]);
      onPatchApplied?.(result.patchedTypstAst);
    } catch (err) {
      console.error(err);
      setPatchError("Unexpected error while applying the deterministic fix.");
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
