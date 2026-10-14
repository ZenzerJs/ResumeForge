import { describe, it, expect } from "vitest";
import {
  canPersistDiagnosticVariant,
  buildDiagnosticVariantTitle,
} from "../src/components/tailor/tailor-diagnostic-panel";

// Regression coverage for deterministic-fix variant persistence gating:
// a fix must only be saveable when a real master resume and saved job exist.

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
