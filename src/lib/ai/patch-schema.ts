import { z } from "zod";
import type { VerifiedEvidenceRegistry } from "@/lib/facts/types";

// --- Patch citation types & registry resolution ---
export const PatchCitationObjectSchema = z.object({
  evidenceId: z.string().optional(),
  bulletId: z.string().optional(),
});
export type PatchCitationObject = z.infer<typeof PatchCitationObjectSchema>;
export type PatchCitationInput = string | PatchCitationObject;
export interface NormalizedPatchCitation {
  evidenceId?: string;
  bulletId?: string;
}

export class InvalidPatchCitationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPatchCitationError";
  }
}

export interface EvidenceRegistryInput {
  id: string;
  userId?: string | null;
  status: string;
  bullets: Array<{ id: string; evidenceId?: string; verified: boolean }>;
}

export interface ResolvedEvidenceRegistry {
  evidenceIds: Set<string>;
  bulletIds: Set<string>;
  bulletToEvidenceId: Map<string, string>;
}

/** Builds a verified evidence + bullet lookup registry for a single owner. */
export function createVerifiedEvidenceRegistry(
  evidenceItems: readonly EvidenceRegistryInput[],
  ownerId?: string
): ResolvedEvidenceRegistry {
  const evidenceIds = new Set<string>();
  const bulletIds = new Set<string>();
  const bulletToEvidenceId = new Map<string, string>();

  for (const item of evidenceItems) {
    if (item.status !== "verified") continue;
    if (ownerId !== undefined && item.userId !== ownerId) continue;
    evidenceIds.add(item.id);
    for (const bullet of item.bullets) {
      if (!bullet.verified) continue;
      if (bullet.evidenceId !== undefined && bullet.evidenceId !== item.id) continue;
      bulletIds.add(bullet.id);
      bulletToEvidenceId.set(bullet.id, item.id);
    }
  }

  return { evidenceIds, bulletIds, bulletToEvidenceId };
}

export function toResolvedEvidenceRegistry(
  input: Set<string> | VerifiedEvidenceRegistry | ResolvedEvidenceRegistry,
  validBulletIds?: Set<string>,
  bulletToEvidenceId?: Map<string, string> | Record<string, string>
): ResolvedEvidenceRegistry {
  if (input instanceof Set) {
    const map =
      bulletToEvidenceId instanceof Map
        ? bulletToEvidenceId
        : bulletToEvidenceId
          ? new Map(Object.entries(bulletToEvidenceId))
          : new Map<string, string>();
    return {
      evidenceIds: input,
      bulletIds: validBulletIds ?? new Set<string>(),
      bulletToEvidenceId: map,
    };
  }
  if ("bulletToEvidenceId" in input && input.bulletToEvidenceId instanceof Map) {
    return input as ResolvedEvidenceRegistry;
  }
  const plain = input as VerifiedEvidenceRegistry;
  return {
    evidenceIds: new Set(plain.evidenceIds),
    bulletIds: new Set(plain.bulletIds),
    bulletToEvidenceId: new Map(Object.entries(plain.bulletToEvidenceId || {})),
  };
}

/**
 * Resolves string or paired `{ evidenceId, bulletId }` references through one verified registry.
 * If both `evidenceId` and `bulletId` are set, the bullet must belong to that evidence item.
 */
export function resolvePatchCitationReferences(
  references: readonly PatchCitationInput[],
  registry: ResolvedEvidenceRegistry
): NormalizedPatchCitation[] {
  if (references.length === 0) {
    throw new InvalidPatchCitationError("A patch must cite evidence or a verified bullet.");
  }

  return references.map((reference) => {
    if (typeof reference === "string") {
      if (!reference) {
        throw new InvalidPatchCitationError("A citation needs a non-empty evidenceId or bulletId.");
      }
      if (registry.evidenceIds.has(reference)) return { evidenceId: reference };
      if (registry.bulletIds.has(reference)) return { bulletId: reference };
      throw new InvalidPatchCitationError(
        "Citation is unavailable, unverified, archived, or not owned by this user."
      );
    }

    const { evidenceId, bulletId } = reference;
    if ((!evidenceId && !bulletId) || evidenceId === "" || bulletId === "") {
      throw new InvalidPatchCitationError("A citation needs a non-empty evidenceId or bulletId.");
    }
    if (evidenceId && !registry.evidenceIds.has(evidenceId)) {
      throw new InvalidPatchCitationError(
        "Citation is unavailable, unverified, archived, or not owned by this user."
      );
    }
    if (bulletId && !registry.bulletIds.has(bulletId)) {
      throw new InvalidPatchCitationError(
        "Citation is unavailable, unverified, archived, or not owned by this user."
      );
    }
    if (evidenceId && bulletId) {
      const parentId = registry.bulletToEvidenceId.get(bulletId);
      if (parentId !== evidenceId) {
        throw new InvalidPatchCitationError(
          "The cited bullet does not belong to the cited evidence item."
        );
      }
    }
    return {
      ...(evidenceId ? { evidenceId } : {}),
      ...(bulletId ? { bulletId } : {}),
    };
  });
}

// --- Structured error categories for Apply / Tailoring ---
export const PatchErrorCategorySchema = z.enum([
  "evidence_changed",
  "evidence_unavailable",
  "stale_resume_or_job",
  "missing_patch_anchor",
  "compile_failed",
  "save_failed",
]);
export type PatchErrorCategory = z.infer<typeof PatchErrorCategorySchema>;

export interface PatchApplicationErrorDetails {
  category: PatchErrorCategory;
  message: string;
  recoveryAction: string;
  httpStatus: number;
  details?: Record<string, unknown>;
}

const DEFAULT_RECOVERY_ACTIONS: Record<PatchErrorCategory, string> = {
  evidence_changed:
    "Evidence Bank items changed after these patches were generated. Re-generate patches to validate against your latest verified evidence.",
  evidence_unavailable:
    "Required verified evidence is missing, unverified, archived, or unacknowledged. Verify the supporting evidence (or acknowledge unverified skills) and re-generate patches.",
  stale_resume_or_job:
    "Your Master Resume, target job, or proposal batch changed or expired. Reload and re-generate patches.",
  missing_patch_anchor:
    "The resume text no longer matches a patch target anchor. Re-generate patches against your current Master Resume.",
  compile_failed:
    "The patched Typst source failed to compile. Reject or adjust the conflicting patch and re-compile before applying.",
  save_failed:
    "Could not save the tailored variant due to a transient error. Retry applying or reload the page.",
};

export function getPatchRecoveryAction(category: PatchErrorCategory): string {
  return DEFAULT_RECOVERY_ACTIONS[category];
}

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
  citations: z.array(PatchCitationObjectSchema).optional(),
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
  validEvidenceIdsOrRegistry:
    | Set<string>
    | VerifiedEvidenceRegistry
    | ResolvedEvidenceRegistry,
  validBulletIds?: Set<string>,
  bulletToEvidenceId?: Map<string, string> | Record<string, string>
): VerificationResult & { patches: PatchProposal[] } {
  const registry = toResolvedEvidenceRegistry(
    validEvidenceIdsOrRegistry,
    validBulletIds,
    bulletToEvidenceId
  );
  const verified: PatchProposal[] = [];
  const validPatches = verified;
  const rejected: RejectedPatch[] = [];
  const gaps: Gap[] = [...response.gaps];

  for (const patch of response.patches) {
    // REPORT_GAP operations don't need evidence citations — they ARE gap reports
    if (patch.operation === "REPORT_GAP") {
      // Convert REPORT_GAP patches into gap entries instead
      gaps.push({
        requirement: patch.before || patch.after,
        severity: "MODERATE",
        recommendation: patch.rationale,
      });
      continue;
    }

    const stringRefs = patch.evidenceIds || [];
    const structuredRefs = patch.citations || [];

    // Reject patches with empty citations — no evidence backing = hallucination
    if (stringRefs.length === 0 && structuredRefs.length === 0) {
      rejected.push({
        patch,
        reason: "Patch has no evidence citations. Content without evidence backing is rejected to prevent hallucination.",
      });
      continue;
    }

    // Resolve all string and paired `{ evidenceId, bulletId }` references through the verified registry
    try {
      if (stringRefs.length > 0) {
        resolvePatchCitationReferences(stringRefs, registry);
      }
      if (structuredRefs.length > 0) {
        resolvePatchCitationReferences(structuredRefs, registry);
      }
    } catch (err) {
      const invalidIds = stringRefs.filter(
        (eid) => !registry.evidenceIds.has(eid) && !registry.bulletIds.has(eid)
      );
      const reason =
        invalidIds.length > 0
          ? `Invalid evidence citation(s): ${invalidIds.join(", ")}. Entire patch rejected — all cited evidence must exist in the active Evidence Bank.`
          : err instanceof Error
            ? err.message
            : "Invalid evidence citation.";
      rejected.push({ patch, reason });
      continue;
    }

    // All citations valid — patch passes
    verified.push(patch);
  }

  return { ...response, verified, rejected, patches: validPatches, gaps };
}
