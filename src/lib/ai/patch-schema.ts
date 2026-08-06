import { z } from "zod";

// --- Patch operation enum ---
export const PatchOperationSchema = z.enum([
  "MODIFY_BULLET",
  "ADD_SKILL",
  "REORDER_BULLETS",
  "TWEAK_SUMMARY",
  "REPORT_GAP",
]);
export type PatchOperation = z.infer<typeof PatchOperationSchema>;

// --- Individual patch proposal from AI ---
export const PatchProposalSchema = z.object({
  id: z.string(),
  operation: PatchOperationSchema,
  targetSection: z.string(),
  targetId: z.string().optional(),
  before: z.string(),
  after: z.string(),
  evidenceIds: z.array(z.string()),
  rationale: z.string(),
  confidence: z.number().min(0).max(1),
});
export type PatchProposal = z.infer<typeof PatchProposalSchema>;

// --- Gap report item ---
export const GapSeveritySchema = z.enum(["CRITICAL", "MODERATE", "MINOR"]);

export const GapSchema = z.object({
  requirement: z.string(),
  severity: GapSeveritySchema,
  recommendation: z.string(),
});
export type Gap = z.infer<typeof GapSchema>;

// --- Full AI response envelope ---
export const PatchResponseSchema = z.object({
  patches: z.array(PatchProposalSchema),
  gaps: z.array(GapSchema),
});
export type PatchResponse = z.infer<typeof PatchResponseSchema>;

// --- Rejected patch with reason ---
export interface RejectedPatch {
  patch: PatchProposal;
  reason: string;
}

// --- Verification result ---
export interface VerificationResult {
  verified: PatchProposal[];
  rejected: RejectedPatch[];
  gaps: Gap[];
}

/**
 * Verifies evidence citations in AI-generated patch proposals.
 *
 * Amendment 1 — Zero-Tolerance Citation Enforcement:
 * If ANY evidenceId cited in a patch does not exist in the active Evidence Bank,
 * the ENTIRE patch is rejected outright. Patches with empty evidenceIds are also
 * rejected (content with no evidence backing = hallucination).
 *
 * REPORT_GAP operations are excluded from citation checks because they are
 * gap reports, not evidence-backed content proposals.
 */
export function verifyEvidenceCitations(
  response: PatchResponse,
  validEvidenceIds: Set<string>,
  validBulletIds: Set<string>
): VerificationResult {
  const verified: PatchProposal[] = [];
  const rejected: RejectedPatch[] = [];

  for (const patch of response.patches) {
    // REPORT_GAP operations don't need evidence citations — they ARE gap reports
    if (patch.operation === "REPORT_GAP") {
      // Convert REPORT_GAP patches into gap entries instead
      response.gaps.push({
        requirement: patch.before || patch.after,
        severity: "MODERATE",
        recommendation: patch.rationale,
      });
      continue;
    }

    // Reject patches with empty evidenceIds — no evidence backing = hallucination
    if (!patch.evidenceIds || patch.evidenceIds.length === 0) {
      rejected.push({
        patch,
        reason: "Patch has no evidence citations. Content without evidence backing is rejected to prevent hallucination.",
      });
      continue;
    }

    // Check every cited evidence ID exists in the active bank
    const invalidIds: string[] = [];
    for (const eid of patch.evidenceIds) {
      if (!validEvidenceIds.has(eid) && !validBulletIds.has(eid)) {
        invalidIds.push(eid);
      }
    }

    if (invalidIds.length > 0) {
      rejected.push({
        patch,
        reason: `Invalid evidence citation(s): ${invalidIds.join(", ")}. Entire patch rejected — all cited evidence must exist in the active Evidence Bank.`,
      });
      continue;
    }

    // All citations valid — patch passes
    verified.push(patch);
  }

  return { verified, rejected, gaps: response.gaps };
}
