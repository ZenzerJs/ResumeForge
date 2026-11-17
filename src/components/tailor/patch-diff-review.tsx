"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  RotateCcw,
  RefreshCw,
  BookOpen,
  ChevronDown,
} from "lucide-react";
import {
  getPatchRecoveryAction,
  PatchErrorCategorySchema,
  resolvePatchCitationReferences,
  toResolvedEvidenceRegistry,
  type PatchProposal,
  type Gap,
  type RejectedPatch,
  type PatchErrorCategory,
} from "@/lib/ai/patch-schema";
import { checkGuardrail } from "@/lib/guardrail/check";
import { assertCanApplyPatches, GuardrailBlockError, markDocumentAsPatched } from "@/lib/guardrail/policy";
import { applyPatchProposals } from "@/lib/ai/patch-application";
import type { ResumeFacts, TailoringValidationContext } from "@/lib/facts/types";
import { readApiResponse } from "@/lib/api-error";
import { SuggestionPreview } from "./suggestion-preview";

/**
 * Pure helper that merges accepted patches into Typst source and stamps the document
 * with the persistent patch provenance marker so it travels with the document across sessions.
 */
export function mergeAndMarkAcceptedPatches(
  baseTypstSource: string,
  acceptedPatches: Array<{ before?: string; after?: string }>
): string {
  let mergedContent = baseTypstSource;
  for (const patch of acceptedPatches) {
    if (patch.before && patch.after && mergedContent.includes(patch.before)) {
      mergedContent = mergedContent.replace(patch.before, patch.after);
    }
  }
  return markDocumentAsPatched(mergedContent);
}

export type PatchDecision = "pending" | "accepted" | "rejected";
export type ReviewSubTab = "suggestions" | "gaps" | "blocked";

export interface EvidenceMetadataEntry {
  id: string;
  title: string;
  organization?: string | null;
  dates?: string | null;
  status: string;
  verifiedSummary: string;
  bulletTexts?: Record<string, string>;
}

export interface StructuredPatchError {
  category: PatchErrorCategory;
  message: string;
  recoveryAction: string;
  affectedPatchIds?: string[];
  details?: Record<string, unknown>;
}

export interface PatchPreflightResult {
  citationChecked: boolean;
  blocked: boolean;
  reason?: string;
  category?: PatchErrorCategory;
  recoveryAction?: string;
}

export function preflightPatchProposal(
  patch: PatchProposal,
  options: {
    validationContext?: TailoringValidationContext | null;
    baseTypstSource?: string | null;
    masterTypstSource: string;
    acknowledgedSkills?: string[];
  }
): PatchPreflightResult {
  const { validationContext, baseTypstSource, masterTypstSource, acknowledgedSkills = [] } = options;

  let citationChecked = false;
  if (validationContext?.version === 2) {
    const registry = toResolvedEvidenceRegistry(validationContext.registry);
    const stringRefs = patch.evidenceIds || [];
    const structuredRefs = patch.citations || [];
    if (stringRefs.length === 0 && structuredRefs.length === 0) {
      return {
        citationChecked: false,
        blocked: true,
        category: "evidence_unavailable",
        reason: "Suggestion has no verified evidence citations.",
        recoveryAction: getPatchRecoveryAction("evidence_unavailable"),
      };
    }
    try {
      if (stringRefs.length > 0) resolvePatchCitationReferences(stringRefs, registry);
      if (structuredRefs.length > 0) resolvePatchCitationReferences(structuredRefs, registry);
      citationChecked = true;
    } catch (err) {
      return {
        citationChecked: false,
        blocked: true,
        category: "evidence_unavailable",
        reason: err instanceof Error ? err.message : "Cited evidence is unavailable or unverified.",
        recoveryAction: getPatchRecoveryAction("evidence_unavailable"),
      };
    }

    const gResult = checkGuardrail(masterTypstSource, validationContext, {
      patches: [patch],
      acknowledgedSkills,
    });
    const hardNonSkill = gResult.violations.filter(
      (v) => v.severity === "HARD" && v.kind !== "skill"
    );
    if (hardNonSkill.length > 0) {
      return {
        citationChecked: false,
        blocked: true,
        category: "evidence_unavailable",
        reason: hardNonSkill.map((v) => v.message).join(" "),
        recoveryAction: getPatchRecoveryAction("evidence_unavailable"),
      };
    }
  }

  if (baseTypstSource) {
    try {
      applyPatchProposals(baseTypstSource, [patch]);
    } catch (err) {
      return {
        citationChecked,
        blocked: true,
        category: "missing_patch_anchor",
        reason:
          err instanceof Error
            ? err.message
            : "The resume text no longer matches this suggestion target.",
        recoveryAction: getPatchRecoveryAction("missing_patch_anchor"),
      };
    }
  }

  return { citationChecked, blocked: false };
}

function normalizeErrorCategory(value: unknown, fallback: PatchErrorCategory): PatchErrorCategory {
  const parsed = PatchErrorCategorySchema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

function buildErrorFromPayload(
  payload: Record<string, unknown> | null | undefined,
  fallbackMessage: string,
  fallbackCategory: PatchErrorCategory = "save_failed"
): StructuredPatchError {
  const category = normalizeErrorCategory(payload?.errorCategory, fallbackCategory);
  const message =
    typeof payload?.error === "string" && payload.error.trim()
      ? payload.error
      : fallbackMessage;
  const recoveryAction =
    typeof payload?.recoveryAction === "string" && payload.recoveryAction.trim()
      ? payload.recoveryAction
      : getPatchRecoveryAction(category);
  const details =
    payload?.details && typeof payload.details === "object"
      ? (payload.details as Record<string, unknown>)
      : undefined;
  const affectedPatchIds = Array.isArray(details?.affectedPatchIds)
    ? details.affectedPatchIds.filter((id): id is string => typeof id === "string")
    : undefined;

  return {
    category,
    message,
    recoveryAction,
    ...(affectedPatchIds?.length ? { affectedPatchIds } : {}),
    ...(details ? { details } : {}),
  };
}

const ERROR_CATEGORY_LABELS: Record<PatchErrorCategory, string> = {
  evidence_changed: "Evidence changed",
  evidence_unavailable: "Evidence unavailable",
  stale_resume_or_job: "Stale resume or job",
  missing_patch_anchor: "Missing patch anchor",
  compile_failed: "Typst compile failed",
  save_failed: "Save failed",
};

interface PatchDiffReviewProps {
  verified: PatchProposal[];
  rejected: RejectedPatch[];
  gaps: Gap[];
  masterTypstSource: string;
  jobId: string;
  batch: {
    batchId: string;
    revisionToken: string;
    baseTypstSource: string;
    jobId: string;
    evidenceRevision?: string;
  } | null;
  localOnly?: boolean;
  localBaseTypstSource?: string | null;
  localStorageSourceKey?: string;
  masterFactsSnapshot: ResumeFacts | null;
  validationContext?: TailoringValidationContext | null;
  onValidationContextUpdate?: (ctx: TailoringValidationContext) => void;
  evidenceMetadata?: Record<string, EvidenceMetadataEntry>;
  decisions?: Record<string, PatchDecision>;
  onDecisionsChange?: React.Dispatch<React.SetStateAction<Record<string, PatchDecision>>>;
  acknowledgedSkills?: Set<string>;
  onAcknowledgedSkillsChange?: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedPatch?: string | null;
  onSelectedPatchChange?: (id: string | null) => void;
  onApplySuccess?: (variantId: string, mergedContent: string) => void;
  onRegeneratePatches?: () => void;
  renderInlinePreview?: boolean;
}

const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  CRITICAL: { bg: "bg-red-950/60", border: "border-red-800/60", text: "text-red-300" },
  MODERATE: { bg: "bg-amber-950/60", border: "border-amber-800/60", text: "text-amber-300" },
  MINOR: { bg: "bg-elevated/80", border: "border-hairline", text: "text-text-secondary" },
};

const OPERATION_STYLES: Record<string, { bg: string; text: string }> = {
  MODIFY_BULLET: { bg: "bg-amber-950/60", text: "text-amber-300" },
  ADD_SKILL: { bg: "bg-status-success/15", text: "text-status-success-soft" },
  REORDER_BULLETS: { bg: "bg-purple-950", text: "text-purple-300" },
  TWEAK_SUMMARY: { bg: "bg-signal/15", text: "text-status-success-soft" },
};

function renderRecoveryActions(
  category: PatchErrorCategory,
  options: { onRegenerate?: () => void; onRetry?: () => void }
) {
  const showReviewEvidence =
    category === "evidence_changed" || category === "evidence_unavailable";
  const showRegenerate =
    Boolean(options.onRegenerate) &&
    (category === "evidence_changed" ||
      category === "evidence_unavailable" ||
      category === "stale_resume_or_job" ||
      category === "missing_patch_anchor");
  const showRetry = Boolean(options.onRetry) && category === "save_failed";

  if (!showReviewEvidence && !showRegenerate && !showRetry) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {showReviewEvidence && (
        <Link
          href="/library"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-hairline bg-elevated px-2.5 py-1 text-xs font-medium text-foreground hover:bg-panel transition-colors motion-reduce:transition-none"
        >
          <BookOpen className="h-3.5 w-3.5 text-status-success" aria-hidden />
          Review evidence
        </Link>
      )}
      {showRegenerate && (
        <button
          type="button"
          onClick={options.onRegenerate}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity motion-reduce:transition-none"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Generate updated suggestions
        </button>
      )}
      {showRetry && (
        <button
          type="button"
          onClick={options.onRetry}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-hairline bg-elevated px-2.5 py-1 text-xs font-medium text-foreground hover:bg-panel transition-colors motion-reduce:transition-none"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Retry apply
        </button>
      )}
    </div>
  );
}

/**
 * Patch Diff Review Component
 *
 * Review-first proposal triage with counted tabs (Suggestions, Gaps, Blocked),
 * Workstream 1A verified-registry preflight and structured error recovery,
 * responsive Before/After diff cards, human-readable evidence disclosures,
 * and a sticky bottom action bar.
 */
export function PatchDiffReview({
  verified,
  rejected,
  gaps,
  masterTypstSource,
  jobId,
  batch,
  localOnly = false,
  localBaseTypstSource,
  localStorageSourceKey = "resumeforge_typst_source",
  masterFactsSnapshot,
  validationContext,
  onValidationContextUpdate,
  evidenceMetadata,
  decisions: controlledDecisions,
  onDecisionsChange,
  acknowledgedSkills: controlledAcknowledgedSkills,
  onAcknowledgedSkillsChange,
  selectedPatch: controlledSelectedPatch,
  onSelectedPatchChange,
  onApplySuccess,
  onRegeneratePatches,
  renderInlinePreview = true,
}: PatchDiffReviewProps) {
  const [internalDecisions, setInternalDecisions] = useState<Record<string, PatchDecision>>(() => {
    const initial: Record<string, PatchDecision> = {};
    for (const patch of verified) {
      initial[patch.id] = "pending";
    }
    return initial;
  });
  const decisions = controlledDecisions ?? internalDecisions;
  const setDecisions = onDecisionsChange ?? setInternalDecisions;

  const [internalSelectedPatch, setInternalSelectedPatch] = useState<string | null>(null);
  const selectedPatch =
    controlledSelectedPatch !== undefined ? controlledSelectedPatch : internalSelectedPatch;
  const setSelectedPatch = onSelectedPatchChange ?? setInternalSelectedPatch;

  const [activeSubTab, setActiveSubTab] = useState<ReviewSubTab>("suggestions");
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<StructuredPatchError | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [createdVariantId, setCreatedVariantId] = useState<string | null>(null);
  const [appliedPatchIds, setAppliedPatchIds] = useState<Set<string>>(new Set());
  const [internalAcknowledgedSkills, setInternalAcknowledgedSkills] = useState<Set<string>>(new Set());
  const acknowledgedSkills = controlledAcknowledgedSkills ?? internalAcknowledgedSkills;
  const setAcknowledgedSkills = onAcknowledgedSkillsChange ?? setInternalAcknowledgedSkills;

  const reviewContainerRef = useRef<HTMLDivElement>(null);
  const [reviewWidth, setReviewWidth] = useState<number | null>(null);

  useEffect(() => {
    const el = reviewContainerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const updateWidth = () => {
      setReviewWidth(el.getBoundingClientRect().width);
    };
    updateWidth();
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setReviewWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const diffGridClass =
    reviewWidth === null
      ? "grid grid-cols-1 md:grid-cols-2 gap-3"
      : reviewWidth >= 720
        ? "grid grid-cols-2 gap-3"
        : "grid grid-cols-1 gap-3";

  const baseTypstSource = localOnly ? localBaseTypstSource : batch?.baseTypstSource;
  const validationInput = validationContext ?? masterFactsSnapshot;

  const preflightById = useMemo(() => {
    const map: Record<string, PatchPreflightResult> = {};
    const ackArray = Array.from(acknowledgedSkills);
    for (const patch of verified) {
      map[patch.id] = preflightPatchProposal(patch, {
        validationContext,
        baseTypstSource,
        masterTypstSource,
        acknowledgedSkills: ackArray,
      });
    }
    return map;
  }, [verified, validationContext, baseTypstSource, masterTypstSource, acknowledgedSkills]);

  const actionablePatches = useMemo(
    () => verified.filter((patch) => !preflightById[patch.id]?.blocked),
    [verified, preflightById]
  );

  const preflightBlockedPatches = useMemo(
    () => verified.filter((patch) => preflightById[patch.id]?.blocked),
    [verified, preflightById]
  );

  const blockedCount = rejected.length + preflightBlockedPatches.length;

  const acceptedPatches = actionablePatches.filter((p) => decisions[p.id] === "accepted");
  const rejectedByUser = actionablePatches.filter((p) => decisions[p.id] === "rejected");
  const pendingPatches = actionablePatches.filter((p) => (decisions[p.id] || "pending") === "pending");

  const unverifiedSkillsForAccepted = useMemo(() => {
    if (!validationInput || acceptedPatches.length === 0) return [];
    const gResult = checkGuardrail(masterTypstSource, validationInput, {
      patches: acceptedPatches,
    });
    return Array.from(
      new Set(
        gResult.violations
          .filter((v) => v.kind === "skill" && typeof v.actual === "string")
          .map((v) => v.actual as string)
      )
    );
  }, [masterTypstSource, validationInput, acceptedPatches]);

  const toggleSkillAck = (skill: string) => {
    setAcknowledgedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(skill)) next.delete(skill);
      else next.add(skill);
      return next;
    });
  };

  const handleDecision = (patchId: string, decision: PatchDecision) => {
    setDecisions((prev) => ({ ...prev, [patchId]: decision }));
  };

  const handleAcceptAll = () => {
    setDecisions((prev) => {
      const updated: Record<string, PatchDecision> = { ...prev };
      for (const patch of actionablePatches) {
        updated[patch.id] = "accepted";
      }
      return updated;
    });
  };

  const handleRejectAll = () => {
    setDecisions((prev) => {
      const updated: Record<string, PatchDecision> = { ...prev };
      for (const patch of actionablePatches) {
        updated[patch.id] = "rejected";
      }
      return updated;
    });
  };

  const scrollToPatchCard = (patchId: string) => {
    setSelectedPatch(patchId);
    setActiveSubTab("suggestions");
    const target = document.querySelector<HTMLElement>(`[data-testid="patch-card-${patchId}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const resolveCitationLabel = (refId: string) => {
    if (!evidenceMetadata) return null;
    if (evidenceMetadata[refId]) {
      return {
        entry: evidenceMetadata[refId],
        bulletText: undefined as string | undefined,
      };
    }
    for (const entry of Object.values(evidenceMetadata)) {
      if (entry.bulletTexts?.[refId]) {
        return {
          entry,
          bulletText: entry.bulletTexts[refId],
        };
      }
    }
    return null;
  };

  const handleApplyAccepted = async () => {
    if (acceptedPatches.length === 0) {
      setApplyError({
        category: "stale_resume_or_job",
        message: "No patches accepted. Accept at least one suggestion to apply.",
        recoveryAction: "Accept one or more suggestions in the list above, then apply.",
      });
      return;
    }

    setIsApplying(true);
    setApplyError(null);
    setApplySuccess(null);

    try {
      const currentBase = localOnly ? localBaseTypstSource : batch?.baseTypstSource;
      if (!currentBase) {
        setApplyError({
          category: "stale_resume_or_job",
          message: "This proposal is missing its original resume source.",
          recoveryAction: getPatchRecoveryAction("stale_resume_or_job"),
        });
        return;
      }
      if (!localOnly && (!batch || batch.jobId !== jobId)) {
        setApplyError({
          category: "stale_resume_or_job",
          message: "This proposal has no saved server batch.",
          recoveryAction: getPatchRecoveryAction("stale_resume_or_job"),
        });
        return;
      }
      if (masterTypstSource !== currentBase) {
        setApplyError({
          category: "stale_resume_or_job",
          message: "The resume changed after these suggestions were generated.",
          recoveryAction: getPatchRecoveryAction("stale_resume_or_job"),
        });
        return;
      }
      if (localOnly && localStorage.getItem(localStorageSourceKey) !== currentBase) {
        setApplyError({
          category: "stale_resume_or_job",
          message: "The browser draft changed after these suggestions were generated.",
          recoveryAction: getPatchRecoveryAction("stale_resume_or_job"),
        });
        return;
      }
      if (localOnly && !masterFactsSnapshot) {
        setApplyError({
          category: "stale_resume_or_job",
          message: "Freeze a local master resume before applying patches.",
          recoveryAction: "Open the Editor to freeze your Master Resume, then generate updated suggestions.",
        });
        return;
      }

      if (validationInput) {
        try {
          assertCanApplyPatches(masterTypstSource, validationInput, acceptedPatches, {
            acknowledgedSkills: Array.from(acknowledgedSkills),
          });
        } catch (err) {
          const category =
            err instanceof GuardrailBlockError && err.errorCategory
              ? err.errorCategory
              : "evidence_unavailable";
          const affectedIds = acceptedPatches
            .filter((p) => {
              const g = checkGuardrail(masterTypstSource, validationInput, {
                patches: [p],
                acknowledgedSkills: Array.from(acknowledgedSkills),
              });
              return g.violations.some((v) => v.severity === "HARD");
            })
            .map((p) => p.id);
          setApplyError({
            category,
            message: err instanceof Error ? err.message : "Guardrail verification blocked apply.",
            recoveryAction: getPatchRecoveryAction(category),
            ...(affectedIds.length ? { affectedPatchIds: affectedIds } : {}),
            ...(err instanceof GuardrailBlockError && err.result
              ? { details: { violations: err.result.violations } }
              : {}),
          });
          return;
        }
      }

      let reconstructed;
      try {
        reconstructed = applyPatchProposals(currentBase, acceptedPatches);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Patch target anchor is missing or ambiguous.";
        const affectedIds = acceptedPatches
          .filter((p) => {
            try {
              applyPatchProposals(currentBase, [p]);
              return false;
            } catch {
              return true;
            }
          })
          .map((p) => p.id);
        setApplyError({
          category: "missing_patch_anchor",
          message: msg,
          recoveryAction: getPatchRecoveryAction("missing_patch_anchor"),
          ...(affectedIds.length ? { affectedPatchIds: affectedIds } : {}),
        });
        return;
      }

      const acceptedIds = acceptedPatches.map((patch) => patch.id);
      if (
        new Set(acceptedIds).size !== acceptedIds.length ||
        reconstructed.appliedIds.length !== acceptedIds.length ||
        acceptedIds.some((id) => !reconstructed.appliedIds.includes(id))
      ) {
        setApplyError({
          category: "stale_resume_or_job",
          message: "The proposal set changed before applying.",
          recoveryAction: getPatchRecoveryAction("stale_resume_or_job"),
        });
        return;
      }

      if (localOnly && validationInput) {
        assertCanApplyPatches(reconstructed.typstSource, validationInput, acceptedPatches, {
          acknowledgedSkills: Array.from(acknowledgedSkills),
        });
      }

      const mergedContent = markDocumentAsPatched(reconstructed.typstSource);

      const { compileTypstToSvg } = await import("@/lib/typst/compiler");
      const compileResult = await compileTypstToSvg(mergedContent);

      if (!compileResult.success) {
        const errorMsg = "error" in compileResult ? compileResult.error.message : "Unknown compilation error";
        setApplyError({
          category: "compile_failed",
          message: `Typst compilation failed â€” cannot apply patches: ${errorMsg}`,
          recoveryAction: getPatchRecoveryAction("compile_failed"),
          details: { compileError: errorMsg, acceptedPatchIds: acceptedIds },
        });
        return;
      }

      if (localOnly) {
        const localVariantId = `demo-local-${Date.now()}`;
        localStorage.setItem(localStorageSourceKey, mergedContent);
        localStorage.setItem("resumeforge_has_guest_draft", "true");
        setCreatedVariantId(localVariantId);
        setAppliedPatchIds(new Set(acceptedIds));
        setApplySuccess("Sample variant applied to this browser only. It was compiled and checked locally.");
        onApplySuccess?.(localVariantId, mergedContent);
        return;
      }

      if (!batch) {
        setApplyError({
          category: "stale_resume_or_job",
          message: "This proposal has no saved server batch.",
          recoveryAction: getPatchRecoveryAction("stale_resume_or_job"),
        });
        return;
      }

      const expectedEvidenceRevision = batch.evidenceRevision ?? validationContext?.revision;
      const res = await fetch("/api/ai/apply-patches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: batch.batchId,
          revisionToken: batch.revisionToken,
          acceptedPatchIds: acceptedIds,
          acknowledgedSkills: Array.from(acknowledgedSkills),
          variantTitle: `AI Tailored Variant â€” ${new Date().toLocaleDateString()}`,
          ...(expectedEvidenceRevision ? { expectedEvidenceRevision } : {}),
        }),
      });

      const { ok, data: json } = await readApiResponse<{
        success?: boolean;
        error?: string;
        errorCategory?: string;
        recoveryAction?: string;
        details?: Record<string, unknown>;
        data?: {
          variantId: string;
          variantTitle: string;
          typstContent: string;
          validationContext?: TailoringValidationContext;
        };
      }>(res, "Failed to save tailored variant.");

      if (!ok || !json?.success || !json.data) {
        setApplyError(
          buildErrorFromPayload(
            json as unknown as Record<string, unknown>,
            "Failed to save tailored variant.",
            "save_failed"
          )
        );
        return;
      }

      if (json.data.validationContext) {
        onValidationContextUpdate?.(json.data.validationContext);
      }

      setCreatedVariantId(json.data.variantId);
      setAppliedPatchIds(new Set(acceptedIds));
      setApplySuccess(`Tailored variant "${json.data.variantTitle}" created successfully.`);
      onApplySuccess?.(json.data.variantId, json.data.typstContent);
    } catch (err) {
      setApplyError({
        category: "save_failed",
        message: err instanceof Error ? err.message : String(err),
        recoveryAction: getPatchRecoveryAction("save_failed"),
      });
    } finally {
      setIsApplying(false);
    }
  };

  const evidenceTitlesMap = useMemo(() => {
    if (!evidenceMetadata) return undefined;
    const titles: Record<string, string> = {};
    for (const [id, entry] of Object.entries(evidenceMetadata)) {
      titles[id] = entry.organization ? `${entry.title} @ ${entry.organization}` : entry.title;
      if (entry.bulletTexts) {
        for (const bid of Object.keys(entry.bulletTexts)) {
          titles[bid] = titles[id];
        }
      }
    }
    return titles;
  }, [evidenceMetadata]);

  return (
    <div ref={reviewContainerRef} className="space-y-4 pb-6" data-testid="patch-diff-review">
      {/* Counted Review Tabs + Bulk Actions */}
      <div className="surface-raised rounded-xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Proposal review sections"
          className="flex flex-wrap items-center gap-1.5 rounded-lg bg-inset p-1 border border-hairline"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === "suggestions"}
            onClick={() => setActiveSubTab("suggestions")}
            data-testid="review-tab-suggestions"
            className={`min-h-9 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors motion-reduce:transition-none ${
              activeSubTab === "suggestions"
                ? "bg-elevated text-foreground border border-hairline shadow-[var(--shadow-1)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Suggestions ({actionablePatches.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === "gaps"}
            onClick={() => setActiveSubTab("gaps")}
            data-testid="review-tab-gaps"
            className={`min-h-9 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors motion-reduce:transition-none ${
              activeSubTab === "gaps"
                ? "bg-elevated text-amber-300 border border-hairline shadow-[var(--shadow-1)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Gaps ({gaps.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === "blocked"}
            onClick={() => setActiveSubTab("blocked")}
            data-testid="review-tab-blocked"
            className={`min-h-9 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors motion-reduce:transition-none ${
              activeSubTab === "blocked"
                ? "bg-elevated text-red-300 border border-hairline shadow-[var(--shadow-1)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Blocked ({blockedCount})
          </button>
        </div>

        {actionablePatches.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAcceptAll}
              className="min-h-9 px-3 py-1.5 status-success-surface border hover:bg-status-success/20 text-xs font-medium rounded-md transition-colors motion-reduce:transition-none"
              data-testid="accept-all-btn"
            >
              Accept All
            </button>
            <button
              type="button"
              onClick={handleRejectAll}
              className="min-h-9 px-3 py-1.5 bg-red-900/50 hover:bg-red-800/60 border border-red-700/60 text-red-300 text-xs font-medium rounded-md transition-colors motion-reduce:transition-none"
              data-testid="reject-all-btn"
            >
              Reject All
            </button>
          </div>
        )}
      </div>

      {renderInlinePreview && verified.length > 0 && (
        <SuggestionPreview
          base={localOnly ? localBaseTypstSource : batch?.baseTypstSource}
          current={masterTypstSource}
          validBatch={localOnly || Boolean(batch && batch.jobId === jobId)}
          localStorageSourceKey={localOnly ? localStorageSourceKey : undefined}
          patches={verified}
          decisions={decisions}
          selected={selectedPatch}
          onSelect={setSelectedPatch}
          onDecision={handleDecision}
          evidenceTitles={evidenceTitlesMap}
        />
      )}

      {/* TAB 1: Suggestions (Primary Review List) */}
      {activeSubTab === "suggestions" && (
        <div className="space-y-4" data-testid="verified-patches-panel">
          {actionablePatches.length > 0 ? (
            <>
              {/* Compact Patch Navigator */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-hairline bg-inset px-3 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground mr-1">Jump to:</span>
                  {actionablePatches.map((patch, idx) => {
                    const dec = decisions[patch.id] || "pending";
                    const isApplied = appliedPatchIds.has(patch.id);
                    const hasCardError = Boolean(applyError?.affectedPatchIds?.includes(patch.id));
                    return (
                      <button
                        key={patch.id}
                        type="button"
                        onClick={() => scrollToPatchCard(patch.id)}
                        aria-current={selectedPatch === patch.id ? "true" : undefined}
                        className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-2 text-xs font-mono font-semibold transition-colors motion-reduce:transition-none ${
                          hasCardError
                            ? "border-red-500/60 bg-red-950/60 text-red-200"
                            : isApplied || dec === "accepted"
                              ? "border-status-success/50 bg-status-success/20 text-status-success-soft"
                              : dec === "rejected"
                                ? "border-red-800/50 bg-red-950/40 text-red-300"
                                : selectedPatch === patch.id
                                  ? "border-amber-500/60 bg-amber-500/20 text-amber-200"
                                  : "border-hairline bg-panel text-text-secondary hover:text-foreground"
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
                <span className="text-xs text-muted-foreground font-mono tabular-nums">
                  {acceptedPatches.length} accepted Â· {rejectedByUser.length} rejected Â· {pendingPatches.length} pending
                </span>
              </div>

              {actionablePatches.map((patch, patchIndex) => {
                const decision = decisions[patch.id] || "pending";
                const opStyle = OPERATION_STYLES[patch.operation] || {
                  bg: "bg-elevated",
                  text: "text-text-secondary",
                };
                const preflight = preflightById[patch.id];
                const isApplied = appliedPatchIds.has(patch.id);
                const isAffectedByError = Boolean(
                  applyError &&
                    (applyError.affectedPatchIds?.includes(patch.id) ||
                      (!applyError.affectedPatchIds?.length && decision === "accepted"))
                );

                const citationRefs =
                  patch.citations && patch.citations.length > 0
                    ? patch.citations.map((c, cIdx) => ({
                        key: `${c.evidenceId ?? ""}-${c.bulletId ?? ""}-${cIdx}`,
                        primaryId: c.evidenceId || c.bulletId || "",
                        evidenceId: c.evidenceId,
                        bulletId: c.bulletId,
                      }))
                    : patch.evidenceIds.map((eid, cIdx) => ({
                        key: `${eid}-${cIdx}`,
                        primaryId: eid,
                        evidenceId: eid,
                        bulletId: undefined as string | undefined,
                      }));

                return (
                  <article
                    key={patch.id}
                    data-testid={`patch-card-${patch.id}`}
                    className={`border rounded-xl p-4 sm:p-5 space-y-4 transition-colors duration-150 motion-reduce:transition-none ${
                      isAffectedByError
                        ? "bg-red-950/15 border-red-700/60"
                        : isApplied || decision === "accepted"
                          ? "bg-status-success/10 border-status-success/40"
                          : decision === "rejected"
                            ? "bg-red-950/10 border-red-900/30 opacity-75"
                            : selectedPatch === patch.id
                              ? "bg-panel border-amber-500/60"
                              : "bg-panel border-hairline"
                    }`}
                  >
                    {/* Card Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span
                          className={`text-xs uppercase font-bold px-2 py-0.5 rounded ${opStyle.bg} ${opStyle.text} border border-current/20`}
                        >
                          {patch.operation.replace(/_/g, " ")}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedPatch(patch.id)}
                          aria-pressed={selectedPatch === patch.id}
                          className="text-sm text-foreground font-semibold hover:underline text-left break-words"
                        >
                          {patchIndex + 1}. {patch.targetSection}
                        </button>
                        <span className="text-xs text-muted-foreground font-mono tabular-nums">
                          {Math.round(patch.confidence * 100)}%
                        </span>
                        {/* Status Distinction Badges */}
                        {isApplied ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full border status-success-surface">
                            Applied
                          </span>
                        ) : decision === "accepted" ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full border status-success-surface">
                            Accepted
                          </span>
                        ) : decision === "rejected" ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-red-800/60 bg-red-950/40 text-red-300">
                            Rejected
                          </span>
                        ) : null}
                        {preflight?.citationChecked && (
                          <span
                            data-testid={`citation-checked-${patch.id}`}
                            className="text-xs font-medium px-2 py-0.5 rounded-full border border-signal/35 bg-signal/10 text-status-success-soft"
                          >
                            Citation checked
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDecision(patch.id, "accepted")}
                          data-testid={`accept-patch-${patch.id}`}
                          className={`min-h-9 px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors motion-reduce:transition-none ${
                            decision === "accepted"
                              ? "bg-status-success text-contrast-ink"
                              : "bg-elevated hover:bg-status-success/20 text-muted-foreground hover:text-status-success-soft border border-hairline"
                          }`}
                          title="Accept suggestion"
                          aria-label={`Accept suggestion ${patchIndex + 1}`}
                          aria-pressed={decision === "accepted"}
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden />
                          <span>Accept</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDecision(patch.id, "rejected")}
                          data-testid={`reject-patch-${patch.id}`}
                          className={`min-h-9 px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors motion-reduce:transition-none ${
                            decision === "rejected"
                              ? "bg-red-600 text-white"
                              : "bg-elevated hover:bg-red-900/60 text-muted-foreground hover:text-red-300 border border-hairline"
                          }`}
                          title="Reject suggestion"
                          aria-label={`Reject suggestion ${patchIndex + 1}`}
                          aria-pressed={decision === "rejected"}
                        >
                          <X className="h-3.5 w-3.5" aria-hidden />
                          <span>Reject</span>
                        </button>
                        {decision !== "pending" && (
                          <button
                            type="button"
                            onClick={() => handleDecision(patch.id, "pending")}
                            data-testid={`undo-patch-${patch.id}`}
                            className="min-h-9 px-2 py-1.5 rounded-md text-xs font-medium bg-elevated hover:bg-panel text-text-secondary border border-hairline flex items-center gap-1 transition-colors motion-reduce:transition-none"
                            title="Undo decision"
                            aria-label={`Undo decision for suggestion ${patchIndex + 1}`}
                          >
                            <RotateCcw className="h-3 w-3" aria-hidden />
                            <span className="hidden sm:inline">Undo</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline Card Error Callout (for affected patches) */}
                    {isAffectedByError && applyError && (
                      <div
                        role="alert"
                        className="rounded-lg border border-red-800/70 bg-red-950/40 p-3 text-xs text-red-200 space-y-1.5 transition-opacity duration-150 motion-reduce:transition-none"
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" aria-hidden />
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="font-semibold text-red-200">
                              {ERROR_CATEGORY_LABELS[applyError.category]}: {applyError.message}
                            </p>
                            <p className="text-text-secondary">{applyError.recoveryAction}</p>
                            {renderRecoveryActions(applyError.category, {
                              onRegenerate: onRegeneratePatches,
                              onRetry: handleApplyAccepted,
                            })}
                            <details className="pt-1">
                              <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                                Technical details
                              </summary>
                              <div className="mt-1 rounded bg-inset p-2 font-mono text-xs text-muted-foreground break-all space-y-0.5">
                                <div>category: {applyError.category}</div>
                                <div>patchId: {patch.id}</div>
                                {batch?.batchId && <div>batchId: {batch.batchId}</div>}
                                {validationContext?.revision && (
                                  <div>evidenceRevision: {validationContext.revision}</div>
                                )}
                              </div>
                            </details>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Before / After Diff (Stacked < 720px, Side-by-side >= 720px) */}
                    <div className={diffGridClass}>
                      <div className="min-w-0">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                          Before
                        </span>
                        <div className="mt-1.5 rounded-lg border border-red-900/35 bg-red-950/20 p-3 text-sm sm:text-[15px] leading-relaxed font-sans text-text-secondary whitespace-pre-wrap break-words">
                          {patch.before || "(empty)"}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                          After
                        </span>
                        <div className="mt-1.5 rounded-lg border border-status-success/35 bg-status-success/10 p-3 text-sm sm:text-[15px] leading-relaxed font-sans text-status-success-soft whitespace-pre-wrap break-words">
                          {patch.after || "(empty)"}
                        </div>
                      </div>
                    </div>

                    {/* Rationale */}
                    <p className="text-sm text-text-secondary leading-relaxed flex items-start gap-2 break-words">
                      <ArrowRight className="h-4 w-4 shrink-0 mt-1 text-primary" aria-hidden />
                      <span>{patch.rationale}</span>
                    </p>

                    {/* Human-readable Evidence Citations with expandable source/status/IDs */}
                    <div className="space-y-2 border-t border-hairline/70 pt-3">
                      <span className="text-xs text-muted-foreground font-medium block">
                        Supporting Evidence ({citationRefs.length})
                      </span>
                      <div className="space-y-2">
                        {citationRefs.map((ref) => {
                          const resolved =
                            resolveCitationLabel(ref.evidenceId || ref.primaryId) ||
                            (ref.bulletId ? resolveCitationLabel(ref.bulletId) : null);
                          const displayTitle = resolved
                            ? resolved.entry.organization
                              ? `${resolved.entry.title} @ ${resolved.entry.organization}`
                              : resolved.entry.title
                            : ref.primaryId;

                          return (
                            <details
                              key={ref.key}
                              className="rounded-lg border border-hairline bg-inset/70 px-3 py-2 text-xs"
                            >
                              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 list-none">
                                <span className="flex flex-wrap items-center gap-2 min-w-0">
                                  <span className="font-medium text-foreground break-words">
                                    {displayTitle}
                                  </span>
                                  {resolved && (
                                    <span
                                      className={`text-xs font-semibold uppercase px-1.5 py-0.5 rounded border ${
                                        resolved.entry.status === "verified"
                                          ? "status-success-surface"
                                          : "border-amber-800/60 bg-amber-950/40 text-amber-300"
                                      }`}
                                    >
                                      {resolved.entry.status}
                                    </span>
                                  )}
                                </span>
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  <span>Source &amp; IDs</span>
                                  <ChevronDown className="h-3 w-3" aria-hidden />
                                </span>
                              </summary>
                              <div className="mt-2 space-y-1.5 border-t border-hairline pt-2 text-xs">
                                {resolved?.bulletText && (
                                  <p className="text-text-secondary leading-relaxed break-words">
                                    <span className="font-semibold text-foreground">Bullet: </span>
                                    {resolved.bulletText}
                                  </p>
                                )}
                                {resolved?.entry.verifiedSummary && (
                                  <p className="text-text-secondary leading-relaxed break-words">
                                    <span className="font-semibold text-foreground">Summary: </span>
                                    {resolved.entry.verifiedSummary}
                                  </p>
                                )}
                                <div className="font-mono text-xs text-muted-foreground break-all space-y-0.5">
                                  {ref.evidenceId && <div>evidenceId: {ref.evidenceId}</div>}
                                  {ref.bulletId && <div>bulletId: {ref.bulletId}</div>}
                                </div>
                              </div>
                            </details>
                          );
                        })}
                      </div>
                    </div>
                  </article>
                );
              })}
            </>
          ) : (
            <div className="surface-raised rounded-xl p-6 text-center text-sm text-muted-foreground space-y-2">
              <p>
                {blockedCount > 0
                  ? `No ready suggestions right now â€” inspect Blocked (${blockedCount}) to review citation or anchor issues.`
                  : "No actionable patch proposals in this batch."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Gaps */}
      {activeSubTab === "gaps" && (
        <div className="space-y-3" data-testid="gaps-panel">
          {gaps.length > 0 ? (
            <>
              <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                Unmet Job Requirements ({gaps.length})
              </h3>
              {gaps.map((gap, idx) => {
                const style = SEVERITY_STYLES[gap.severity] || SEVERITY_STYLES.MINOR;
                return (
                  <div
                    key={`gap-${idx}`}
                    data-testid="gap-item"
                    className={`${style.bg} ${style.border} border rounded-xl p-4 space-y-2`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs uppercase font-bold px-2 py-0.5 rounded ${style.bg} ${style.text} border ${style.border}`}
                      >
                        {gap.severity}
                      </span>
                      <span className={`text-sm font-medium break-words ${style.text}`}>
                        {gap.requirement}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary flex items-start gap-2 leading-relaxed break-words">
                      <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" aria-hidden />
                      <span>{gap.recommendation}</span>
                    </p>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="surface-raised rounded-xl p-6 text-center text-sm text-muted-foreground">
              No unmet requirement gaps reported for this batch.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Blocked (Rejected citations + Preflight-blocked proposals) */}
      {activeSubTab === "blocked" && (
        <div className="space-y-4" data-testid="rejected-patches-panel">
          {blockedCount > 0 ? (
            <>
              {preflightBlockedPatches.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" aria-hidden />
                    Needs Review â€” Preflight Blocked ({preflightBlockedPatches.length})
                  </h3>
                  {preflightBlockedPatches.map((patch) => {
                    const pf = preflightById[patch.id];
                    return (
                      <div
                        key={`pf-blocked-${patch.id}`}
                        className="rounded-xl border border-amber-800/60 bg-amber-950/20 p-4 space-y-2.5 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-foreground break-words">
                            {patch.targetSection} ({patch.operation.replace(/_/g, " ")})
                          </span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-amber-700/60 bg-amber-950/60 text-amber-300">
                            Needs review
                          </span>
                        </div>
                        <p className="text-xs text-amber-200 leading-relaxed break-words">
                          {pf.reason}
                        </p>
                        {pf.recoveryAction && (
                          <p className="text-xs text-text-secondary leading-relaxed">
                            {pf.recoveryAction}
                          </p>
                        )}
                        {pf.category &&
                          renderRecoveryActions(pf.category, {
                            onRegenerate: onRegeneratePatches,
                          })}
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            Technical IDs
                          </summary>
                          <div className="mt-1 rounded bg-inset p-2 font-mono text-xs text-muted-foreground break-all">
                            patchId: {patch.id} Â· evidenceIds: {patch.evidenceIds.join(", ")}
                          </div>
                        </details>
                      </div>
                    );
                  })}
                </div>
              )}

              {rejected.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4" aria-hidden />
                    Rejected Patches â€” Invalid Citations ({rejected.length})
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    These proposals were blocked because they cited evidence IDs that are missing,
                    unverified, archived, or unowned. Review your Evidence Bank or generate updated
                    suggestions.
                  </p>
                  {rejected.map((item, idx) => (
                    <div
                      key={`rejected-${idx}`}
                      data-testid="rejected-patch-item"
                      className="bg-red-950/30 border border-red-900/50 rounded-xl p-4 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-400 shrink-0" aria-hidden />
                        <span className="text-xs font-mono text-red-300 bg-red-950 px-2 py-0.5 rounded">
                          {item.patch.operation}
                        </span>
                        <span className="text-xs text-red-200 break-words">
                          {item.patch.targetSection}
                        </span>
                      </div>
                      <div className="text-xs text-red-200 bg-red-950/50 rounded p-2.5 leading-relaxed break-words">
                        {item.reason}
                      </div>
                      <div className={diffGridClass}>
                        <div className="min-w-0">
                          <span className="text-muted-foreground text-xs uppercase">Before</span>
                          <div className="text-text-secondary bg-inset rounded p-2.5 mt-1 text-sm font-sans break-words whitespace-pre-wrap">
                            {item.patch.before || "(empty)"}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <span className="text-muted-foreground text-xs uppercase">
                            After (Blocked)
                          </span>
                          <div className="text-red-300/70 bg-inset rounded p-2.5 mt-1 text-sm font-sans line-through break-words whitespace-pre-wrap">
                            {item.patch.after || "(empty)"}
                          </div>
                        </div>
                      </div>
                      {renderRecoveryActions("evidence_unavailable", {
                        onRegenerate: onRegeneratePatches,
                      })}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="surface-raised rounded-xl p-6 text-center text-sm text-muted-foreground">
              No blocked or rejected proposals in this batch.
            </div>
          )}
        </div>
      )}

      {/* Unverified Skills Acknowledgment + Error / Success Feedback */}
      {verified.length > 0 && (
        <div className="space-y-3">
          {unverifiedSkillsForAccepted.length > 0 && (
            <div
              data-testid="unverified-skills-ack-box"
              className="p-3.5 bg-amber-950/40 border border-amber-800/60 rounded-xl space-y-2 text-xs text-amber-200"
            >
              <div className="flex items-center gap-2 font-semibold text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
                <span>Acknowledge unverified skills before applying</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Only add skills if you have real experience; log them in your Evidence Bank first, or
                check below to confirm each skill:
              </p>
              <div className="space-y-1.5 pt-1">
                {unverifiedSkillsForAccepted.map((skill) => (
                  <label
                    key={skill}
                    className="flex items-center gap-2 text-xs text-amber-200 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={acknowledgedSkills.has(skill)}
                      onChange={() => toggleSkillAck(skill)}
                      data-testid={`ack-skill-checkbox-${skill}`}
                      className="rounded border-amber-600 bg-inset text-amber-500 focus:ring-amber-500"
                    />
                    <span>
                      I have real experience with <strong>{skill}</strong>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {applyError && (
            <div
              role="alert"
              className="p-4 bg-red-950/50 border border-red-800/60 rounded-xl flex items-start gap-3 text-xs text-red-200 transition-opacity duration-150 motion-reduce:transition-none"
              data-testid="apply-error"
            >
              <XCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" aria-hidden />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-semibold text-red-200">
                  {ERROR_CATEGORY_LABELS[applyError.category]}: {applyError.message}
                </p>
                <p className="text-text-secondary leading-relaxed">{applyError.recoveryAction}</p>
                {renderRecoveryActions(applyError.category, {
                  onRegenerate: onRegeneratePatches,
                  onRetry: handleApplyAccepted,
                })}
                <details className="pt-1">
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                    Technical IDs &amp; details
                  </summary>
                  <pre className="mt-1 whitespace-pre-wrap break-all rounded bg-inset p-2 font-mono text-xs text-muted-foreground">
                    {JSON.stringify(
                      {
                        category: applyError.category,
                        batchId: batch?.batchId ?? null,
                        expectedEvidenceRevision:
                          batch?.evidenceRevision ?? validationContext?.revision ?? null,
                        ...(applyError.details ? { details: applyError.details } : {}),
                      },
                      null,
                      2
                    )}
                  </pre>
                </details>
              </div>
            </div>
          )}

          {applySuccess && (
            <div
              className="p-4 status-success-surface border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-md transition-opacity duration-150 motion-reduce:transition-none"
              data-testid="apply-success"
            >
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-status-success mt-0.5" aria-hidden />
                <div>
                  <span className="font-semibold block text-foreground text-sm">{applySuccess}</span>
                  <span className="text-xs text-text-secondary">
                    {localOnly
                      ? "Your tailored draft is saved in this browser. Open the editor to continue editing."
                      : "Your tailored variant is saved to the database. Edit and compile it live in the editor."}
                  </span>
                </div>
              </div>

              {createdVariantId && (
                <Link
                  href={localOnly ? "/editor" : `/editor?variantId=${createdVariantId}`}
                  data-testid="open-variant-in-editor-btn"
                  className="min-h-10 px-4 py-2 bg-status-success hover:bg-status-success/90 text-contrast-ink font-semibold rounded-lg flex items-center gap-1.5 shadow-md transition-colors motion-reduce:transition-none shrink-0 self-start sm:self-center"
                >
                  <Edit3 className="h-4 w-4" aria-hidden />
                  Open in editor
                </Link>
              )}
            </div>
          )}

          {/* Sticky Bottom Action Bar */}
          <div
            data-testid="patch-sticky-action-bar"
            className="sticky bottom-2 z-20 rounded-xl border border-hairline glass-bar p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-2)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-text-secondary">
              <span className="font-semibold text-foreground">
                {acceptedPatches.length} accepted Â· {pendingPatches.length} pending
              </span>
              {rejectedByUser.length > 0 && (
                <span className="text-muted-foreground">Â· {rejectedByUser.length} rejected</span>
              )}
            </div>

            <button
              type="button"
              onClick={handleApplyAccepted}
              disabled={isApplying || acceptedPatches.length === 0}
              data-testid="apply-patches-btn"
              className="min-h-11 w-full sm:w-auto bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-semibold text-sm px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-opacity motion-reduce:transition-none"
            >
              {isApplying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Compiling &amp; Applying Patches...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  {localOnly
                    ? `Apply ${acceptedPatches.length} Accepted Patch${acceptedPatches.length !== 1 ? "es" : ""} to This Browser`
                    : `Apply ${acceptedPatches.length} Accepted Patch${acceptedPatches.length !== 1 ? "es" : ""} & Create Variant`}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {verified.length === 0 && rejected.length === 0 && gaps.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-xs">
          No patch proposals generated yet.
        </div>
      )}
    </div>
  );
}
