import { describe, expect, it } from "vitest";
import {
  InvalidPatchCitationError,
  normalizePatchCitations,
} from "@/lib/ai/patch-citations";
import {
  createVerifiedEvidenceRegistry,
  PatchResponseSchema,
  verifyEvidenceCitations,
} from "@/lib/ai/patch-schema";
import {
  classifyPatchApplicationError,
  PatchBatchError,
} from "@/lib/ai/patch-batches";
import { GuardrailBlockError } from "@/lib/guardrail/policy";

const ownerId = "owner-1";
const evidence = [
  {
    id: "evidence-1",
    userId: ownerId,
    status: "verified",
    bullets: [
      { id: "bullet-1", evidenceId: "evidence-1", verified: true },
      { id: "bullet-unverified", evidenceId: "evidence-1", verified: false },
    ],
  },
  {
    id: "evidence-2",
    userId: ownerId,
    status: "verified",
    bullets: [{ id: "bullet-2", evidenceId: "evidence-2", verified: true }],
  },
  {
    id: "archived",
    userId: ownerId,
    status: "archived",
    bullets: [{ id: "archived-bullet", evidenceId: "archived", verified: true }],
  },
  {
    id: "foreign",
    userId: "owner-2",
    status: "verified",
    bullets: [{ id: "foreign-bullet", evidenceId: "foreign", verified: true }],
  },
];

describe("normalized patch citations", () => {
  it("resolves exact evidence, bullet, and matching paired references", () => {
    expect(normalizePatchCitations(
      ["evidence-1", "bullet-1", { evidenceId: "evidence-1", bulletId: "bullet-1" }],
      evidence,
      ownerId
    )).toEqual([
      { evidenceId: "evidence-1" },
      { bulletId: "bullet-1" },
      { evidenceId: "evidence-1", bulletId: "bullet-1" },
    ]);
  });

  it("rejects empty references", () => {
    expect(() => normalizePatchCitations([], evidence, ownerId)).toThrow(InvalidPatchCitationError);
    expect(() => normalizePatchCitations([{}], evidence, ownerId)).toThrow(InvalidPatchCitationError);
  });

  it("rejects mismatched bullet and evidence pairs", () => {
    expect(() => normalizePatchCitations(
      [{ evidenceId: "evidence-1", bulletId: "bullet-2" }],
      evidence,
      ownerId
    )).toThrow("does not belong");
  });

  it("rejects foreign, archived, unavailable, and unverified citations", () => {
    for (const id of [
      "foreign", "foreign-bullet", "archived", "archived-bullet",
      "bullet-unverified", "missing",
    ]) {
      expect(() => normalizePatchCitations([id], evidence, ownerId)).toThrow(
        InvalidPatchCitationError
      );
    }
  });

  it("enforces unified registry resolution in verifyEvidenceCitations including paired bullet ownership", () => {
    const registry = createVerifiedEvidenceRegistry(evidence, ownerId);
    const response = PatchResponseSchema.parse({
      patches: [
        {
          id: "valid-pair",
          operation: "MODIFY_BULLET",
          targetSection: "experience",
          before: "- Old bullet",
          after: "- New verified bullet",
          evidenceIds: ["evidence-1", "bullet-1"],
          citations: [{ evidenceId: "evidence-1", bulletId: "bullet-1" }],
          rationale: "Valid pair",
          confidence: 0.95,
        },
        {
          id: "mismatched-pair",
          operation: "MODIFY_BULLET",
          targetSection: "experience",
          before: "- Old bullet",
          after: "- Cross-item mismatch",
          evidenceIds: ["evidence-1"],
          citations: [{ evidenceId: "evidence-1", bulletId: "bullet-2" }],
          rationale: "Bullet belongs to evidence-2, not evidence-1",
          confidence: 0.9,
        },
        {
          id: "unverified-bullet",
          operation: "MODIFY_BULLET",
          targetSection: "experience",
          before: "- Old bullet",
          after: "- Draft bullet",
          evidenceIds: ["bullet-unverified"],
          rationale: "Draft bullet",
          confidence: 0.8,
        },
      ],
      gaps: [],
    });

    const result = verifyEvidenceCitations(response, registry);
    expect(result.verified.map((p) => p.id)).toEqual(["valid-pair"]);
    expect(result.rejected).toHaveLength(2);
    expect(result.rejected[0].reason).toContain("does not belong");
    expect(result.rejected[1].reason).toContain("Invalid evidence citation");
  });

  it("classifies all 6 structured Apply error categories with human-readable recovery actions", () => {
    const categories = [
      ["evidence_changed", 409],
      ["evidence_unavailable", 422],
      ["stale_resume_or_job", 409],
      ["missing_patch_anchor", 409],
      ["compile_failed", 422],
      ["save_failed", 500],
    ] as const;

    for (const [category, expectedStatus] of categories) {
      const classified = classifyPatchApplicationError(
        new PatchBatchError(category, `Synthetic ${category} failure`)
      );
      expect(classified.category).toBe(category);
      expect(classified.httpStatus).toBe(expectedStatus);
      expect(classified.message).toBe(`Synthetic ${category} failure`);
      expect(classified.recoveryAction.length).toBeGreaterThan(15);
    }

    const guardrailClassified = classifyPatchApplicationError(
      new GuardrailBlockError("Blocked by guardrail", {
        passed: false,
        status: "blocked",
        hasHardViolations: true,
        hasSoftViolations: false,
        violations: [],
      })
    );
    expect(guardrailClassified.category).toBe("evidence_unavailable");
    expect(guardrailClassified.httpStatus).toBe(422);

    const anchorClassified = classifyPatchApplicationError(
      new Error("Patch p1 source anchor is missing or ambiguous.")
    );
    expect(anchorClassified.category).toBe("missing_patch_anchor");
    expect(anchorClassified.httpStatus).toBe(409);

    const retryClassified = classifyPatchApplicationError({ code: "P2034" });
    expect(retryClassified.category).toBe("save_failed");
    expect(retryClassified.httpStatus).toBe(409);
  });
});
