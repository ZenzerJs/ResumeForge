import { describe, it, expect } from "vitest";
import {
  PatchProposalSchema,
  GapSchema,
  PatchResponseSchema,
  verifyEvidenceCitations,
} from "../src/lib/ai/patch-schema";
import type { PatchResponse } from "../src/lib/ai/patch-schema";

describe("PatchProposalSchema Zod validation", () => {
  it("accepts a valid patch proposal", () => {
    const valid = {
      id: "patch-001",
      operation: "MODIFY_BULLET",
      targetSection: "Experience",
      targetId: "bullet-001",
      before: "Built web apps",
      after: "Built scalable web applications using React and TypeScript",
      evidenceIds: ["ev-001", "bullet-001"],
      rationale: "Emphasizes React and TypeScript for frontend role",
      confidence: 0.85,
    };
    const result = PatchProposalSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects a patch with invalid operation", () => {
    const invalid = {
      id: "patch-002",
      operation: "INVALID_OP",
      targetSection: "Skills",
      before: "",
      after: "Python",
      evidenceIds: ["ev-001"],
      rationale: "test",
      confidence: 0.5,
    };
    const result = PatchProposalSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects a patch with confidence out of range", () => {
    const invalid = {
      id: "patch-003",
      operation: "ADD_SKILL",
      targetSection: "Skills",
      before: "",
      after: "Docker",
      evidenceIds: ["ev-002"],
      rationale: "test",
      confidence: 1.5,
    };
    const result = PatchProposalSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects a patch missing required fields", () => {
    const invalid = {
      id: "patch-004",
      operation: "MODIFY_BULLET",
      // missing targetSection, before, after, evidenceIds, rationale, confidence
    };
    const result = PatchProposalSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("GapSchema Zod validation", () => {
  it("accepts a valid gap", () => {
    const valid = {
      requirement: "5+ years Kubernetes experience",
      severity: "CRITICAL",
      recommendation: "Candidate lacks Kubernetes experience. Highlight Docker skills.",
    };
    const result = GapSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects a gap with invalid severity", () => {
    const invalid = {
      requirement: "test",
      severity: "LOW",
      recommendation: "test",
    };
    const result = GapSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("PatchResponseSchema Zod validation", () => {
  it("accepts a valid full response with patches and gaps", () => {
    const valid = {
      patches: [
        {
          id: "patch-001",
          operation: "MODIFY_BULLET",
          targetSection: "Experience",
          before: "Old text",
          after: "New text",
          evidenceIds: ["ev-001"],
          rationale: "Improves match",
          confidence: 0.9,
        },
      ],
      gaps: [
        {
          requirement: "Kubernetes expertise",
          severity: "CRITICAL",
          recommendation: "No evidence available",
        },
      ],
    };
    const result = PatchResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("accepts an empty patches and gaps response", () => {
    const valid = { patches: [], gaps: [] };
    const result = PatchResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});

describe("verifyEvidenceCitations — Amendment 1: Whole-Patch Rejection", () => {
  const validEvidenceIds = new Set(["ev-001", "ev-002", "ev-003"]);
  const validBulletIds = new Set(["bullet-001", "bullet-002"]);

  it("passes patches where ALL evidence IDs are valid", () => {
    const response: PatchResponse = {
      patches: [
        {
          id: "p1",
          operation: "MODIFY_BULLET",
          targetSection: "Experience",
          before: "old",
          after: "new",
          evidenceIds: ["ev-001", "bullet-001"],
          rationale: "test",
          confidence: 0.9,
        },
      ],
      gaps: [],
    };

    const result = verifyEvidenceCitations(response, validEvidenceIds, validBulletIds);
    expect(result.verified).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
  });

  it("REJECTS entire patch if ANY evidenceId is invalid", () => {
    const response: PatchResponse = {
      patches: [
        {
          id: "p2",
          operation: "MODIFY_BULLET",
          targetSection: "Experience",
          before: "old",
          after: "new",
          evidenceIds: ["ev-001", "FAKE-ID-999"],
          rationale: "test",
          confidence: 0.8,
        },
      ],
      gaps: [],
    };

    const result = verifyEvidenceCitations(response, validEvidenceIds, validBulletIds);
    expect(result.verified).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toContain("FAKE-ID-999");
    expect(result.rejected[0].reason).toContain("Entire patch rejected");
  });

  it("REJECTS patches with empty evidenceIds (no evidence = hallucination)", () => {
    const response: PatchResponse = {
      patches: [
        {
          id: "p3",
          operation: "ADD_SKILL",
          targetSection: "Skills",
          before: "",
          after: "Kubernetes",
          evidenceIds: [],
          rationale: "test",
          confidence: 0.7,
        },
      ],
      gaps: [],
    };

    const result = verifyEvidenceCitations(response, validEvidenceIds, validBulletIds);
    expect(result.verified).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toContain("no evidence citations");
  });

  it("converts REPORT_GAP operations into gap entries (not verified patches)", () => {
    const response: PatchResponse = {
      patches: [
        {
          id: "p4",
          operation: "REPORT_GAP",
          targetSection: "Experience",
          before: "5+ years Kubernetes",
          after: "",
          evidenceIds: [],
          rationale: "No K8s experience found",
          confidence: 0,
        },
      ],
      gaps: [],
    };

    const result = verifyEvidenceCitations(response, validEvidenceIds, validBulletIds);
    expect(result.verified).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
    expect(result.gaps).toHaveLength(1);
    expect(result.gaps[0].requirement).toBe("5+ years Kubernetes");
  });

  it("handles mixed response: some valid, some invalid, some gaps", () => {
    const response: PatchResponse = {
      patches: [
        {
          id: "valid-1",
          operation: "MODIFY_BULLET",
          targetSection: "Experience",
          before: "A",
          after: "B",
          evidenceIds: ["ev-001"],
          rationale: "good",
          confidence: 0.9,
        },
        {
          id: "invalid-1",
          operation: "ADD_SKILL",
          targetSection: "Skills",
          before: "",
          after: "Java",
          evidenceIds: ["NONEXISTENT"],
          rationale: "bad",
          confidence: 0.5,
        },
        {
          id: "empty-citations",
          operation: "TWEAK_SUMMARY",
          targetSection: "Summary",
          before: "old summary",
          after: "new summary",
          evidenceIds: [],
          rationale: "no evidence",
          confidence: 0.3,
        },
      ],
      gaps: [
        {
          requirement: "Machine Learning",
          severity: "MODERATE",
          recommendation: "Highlight relevant coursework",
        },
      ],
    };

    const result = verifyEvidenceCitations(response, validEvidenceIds, validBulletIds);
    expect(result.verified).toHaveLength(1);
    expect(result.verified[0].id).toBe("valid-1");
    expect(result.rejected).toHaveLength(2);
    expect(result.gaps).toHaveLength(1);
  });
});
