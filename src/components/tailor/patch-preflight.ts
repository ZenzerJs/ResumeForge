import {
  getPatchRecoveryAction,
  resolvePatchCitationReferences,
  toResolvedEvidenceRegistry,
  type PatchProposal,
  type PatchErrorCategory,
} from "@/lib/ai/patch-schema";
import { checkGuardrail } from "@/lib/guardrail/check";
import { applyPatchProposals } from "@/lib/ai/patch-application";
import type { TailoringValidationContext } from "@/lib/facts/types";

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
