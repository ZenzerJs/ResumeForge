import { describe, it, expect } from "vitest";
import {
  canPersistDiagnosticVariant,
  buildDiagnosticVariantTitle,
  extractDiagnosticSkill,
  resolveDiagnosticFixAction,
} from "../src/components/tailor/tailor-diagnostic-panel";

// Regression coverage for deterministic-fix variant persistence gating:
// a fix must only be saveable when a real master resume and saved job exist.

describe("extractDiagnosticSkill & resolveDiagnosticFixAction", () => {
  it("strips prefixes and the Evidence Bank advisory suffix from diagnostic messages", () => {
    expect(
      extractDiagnosticSkill(
        "Missing required skill: Kubernetes. Only add if you have real experience; log it in your Evidence Bank first, otherwise treat it as a gap."
      )
    ).toBe("Kubernetes");

    expect(
      extractDiagnosticSkill(
        "Consider adding preferred tooling: Terraform (only add if you have real experience; log it in your Evidence Bank first, otherwise treat it as a gap)."
      )
    ).toBe("Terraform");
  });

  it("refuses to insert an unverified missing skill when no matching Evidence Bank item exists", () => {
    const outcome = resolveDiagnosticFixAction(
      {
        id: "diag-missing-k8s",
        severity: "urgent",
        category: "missing_hard_requirement",
        message:
          "Missing required skill: Kubernetes. Only add if you have real experience; log it in your Evidence Bank first, otherwise treat it as a gap.",
        suggestedFix:
          "Only add Kubernetes if you have real experience; log it in your Evidence Bank first, otherwise treat it as a gap.",
        targetLineOrBulletId: "bullet-1",
      },
      "- Built scalable APIs in TypeScript",
      [
        {
          id: "evid-1",
          verifiedSummary: "Built scalable APIs in TypeScript and PostgreSQL.",
          tags: ["TypeScript", "PostgreSQL"],
        },
      ]
    );

    expect(outcome.applied).toBe(false);
    if (!outcome.applied) {
      expect(outcome.error).toContain("No verified evidence found");
      expect(outcome.error).toContain("never invents experience");
    }
  });

  it("refuses document-level missing-skill insertion even when verified evidence exists (requires explicit bullet anchor)", () => {
    const outcome = resolveDiagnosticFixAction(
      {
        id: "diag-missing-go",
        severity: "urgent",
        category: "missing_hard_requirement",
        message:
          "Missing required skill: Go. Only add if you have real experience; log it in your Evidence Bank first, otherwise treat it as a gap.",
        suggestedFix:
          "Only add Go if you have real experience; log it in your Evidence Bank first, otherwise treat it as a gap.",
        targetLineOrBulletId: "global",
      },
      "- Built scalable APIs in TypeScript",
      [
        {
          id: "evid-go",
          verifiedSummary: "Built gRPC microservices in Go.",
          tags: ["Go", "gRPC"],
        },
      ]
    );

    expect(outcome.applied).toBe(false);
    if (!outcome.applied) {
      expect(outcome.error).toContain("document-level (no bullet anchor)");
    }
  });

  it("returns the verified evidence and bullet pair needed by the saved proposal API", () => {
    const outcome = resolveDiagnosticFixAction(
      {
        id: "diag-k8s",
        severity: "non_urgent",
        category: "missing_hard_requirement",
        message: "Missing required skill: Kubernetes",
        suggestedFix: "Use verified Kubernetes evidence",
        targetLineOrBulletId: "bullet-42",
      },
      "// RF_BULLET:bullet-42\n- Built services in TypeScript",
      [{ id: "evid-k8s", verifiedSummary: "Built services with Kubernetes", tags: ["Kubernetes"] }]
    );

    expect(outcome.applied).toBe(true);
    if (outcome.applied) {
      expect(outcome.evidenceId).toBe("evid-k8s");
      expect(outcome.targetBulletId).toBe("bullet-42");
    }
  });
});

describe("canPersistDiagnosticVariant", () => {
  it("refuses when no patch has been applied", () => {
    const gate = canPersistDiagnosticVariant(
      { masterResumeId: "m1", jobId: "j1" },
      null
    );
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toContain("Apply a fix first");
  });

  it("refuses when master resume is missing", () => {
    const gate = canPersistDiagnosticVariant(
      { masterResumeId: null, jobId: "j1" },
      "patched typst"
    );
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toContain("Master Resume");
  });

  it("refuses when job is not saved", () => {
    const gate = canPersistDiagnosticVariant(
      { masterResumeId: "m1", jobId: null },
      "patched typst"
    );
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toContain("job posting");
  });

  it("allows persistence when context is complete", () => {
    const gate = canPersistDiagnosticVariant(
      { masterResumeId: "m1", jobId: "j1" },
      "patched typst"
    );
    expect(gate.allowed).toBe(true);
    expect(gate.reason).toBeUndefined();
  });

  it("refuses when context object is entirely missing", () => {
    const gate = canPersistDiagnosticVariant(undefined, "patched typst");
    expect(gate.allowed).toBe(false);
  });
});

describe("buildDiagnosticVariantTitle", () => {
  it("uses the deterministic-fix prefix with a date", () => {
    const title = buildDiagnosticVariantTitle(new Date("2026-09-14T12:00:00Z"));
    expect(title).toMatch(/^Deterministic Fix Variant — /);
    expect(title).toContain("2026");
  });
});
