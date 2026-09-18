import { describe, it, expect } from "vitest";
import { checkGuardrail } from "@/lib/guardrail/check";
import { evaluateAtsScore } from "@/lib/ats-evaluator/evaluator";
import { ResumeFacts } from "@/lib/facts/types";

describe("One-Click Apply Pipeline", () => {
  const masterFacts: ResumeFacts = {
    version: 1,
    snapshotAt: "2026-08-14T00:00:00.000Z",
    employers: [{ raw: "Stripe", normalized: "stripe" }],
    titles: [{ raw: "Software Engineer", normalized: "software engineer" }],
    dateRanges: [{ raw: "2022 – 2024", startIso: "2022-01", endIso: "2024-01" }],
    metrics: [{ raw: "45ms", value: 45, unit: "ms", context: "latency", isTrivial: false }],
    skills: ["typescript", "postgresql", "react"],
    evidenceIds: ["evid-1"],
  };

  const candidateTypst = `
= Jane Doe
== EXPERIENCE
*Stripe* -- *Software Engineer*
- Reduced latency by 45ms across TypeScript and PostgreSQL services.
== SKILLS
- Languages: TypeScript, SQL, React
  `;

  it("completes deterministic ATS scoring against job requirements", () => {
    const requirements = {
      roleTitle: "Software Engineer",
      company: "Stripe",
      requiredSkills: ["typescript", "postgresql"],
      preferredSkills: ["react"],
      domainTerms: ["latency"],
    };

    const score = evaluateAtsScore(candidateTypst, requirements, "Full-stack");
    expect(score.overallScore).toBeGreaterThan(50);
    expect(score.requiredMatch.score).toBeGreaterThan(0);
  });

  it("verifies clean mechanical guardrail status before permitting downloads", () => {
    const result = checkGuardrail(candidateTypst, masterFacts);
    expect(result.passed).toBe(true);
    expect(result.hasHardViolations).toBe(false);
  });

  it("generates an application package zip for the job with ATS score audit", async () => {
    const { generateApplicationPackageZip } = await import("@/lib/export/zip");
    const JSZip = (await import("jszip")).default;

    const requirements = {
      roleTitle: "Software Engineer",
      company: "Stripe",
      requiredSkills: ["typescript", "postgresql"],
      preferredSkills: ["react"],
      domainTerms: ["latency"],
    };

    const score = evaluateAtsScore(candidateTypst, requirements, "Full-stack");

    const zipBytes = await generateApplicationPackageZip({
      typstSource: candidateTypst,
      masterFacts,
      job: {
        company: "Stripe",
        roleTitle: "Software Engineer",
        location: "San Francisco, CA",
        requirements,
      },
      atsScore: score,
    });

    expect(zipBytes).toBeInstanceOf(Uint8Array);
    const unzipped = await JSZip.loadAsync(zipBytes);
    expect(unzipped.file("resume.pdf")).not.toBeNull();
    expect(unzipped.file("resume.docx")).not.toBeNull();
    expect(unzipped.file("resume.txt")).not.toBeNull();
    expect(unzipped.file("resume.typ")).not.toBeNull();
    expect(unzipped.file("application_summary.txt")).not.toBeNull();

    const summary = await unzipped.file("application_summary.txt")?.async("string");
    expect(summary).toContain("Company: Stripe");
    expect(summary).toContain("Role: Software Engineer");
    expect(summary).toContain(`Overall Match Score: ${score.overallScore} / 100`);
  });

  it("blocks downloads and export generation when guardrail detects hard violations", async () => {
    const { assertCanExport, GuardrailBlockError } = await import("@/lib/guardrail/policy");
    const { generateApplicationPackageZip } = await import("@/lib/export/zip");

    const invalidCandidate = `
= Jane Doe
== EXPERIENCE
*Tesla* -- *Chief Architect*
- Invented full self driving reducing latency by 99% across $10B revenue fleet.
    `;

    expect(() => assertCanExport(invalidCandidate, masterFacts)).toThrow(GuardrailBlockError);

    await expect(
      generateApplicationPackageZip({
        typstSource: invalidCandidate,
        masterFacts,
        job: { company: "Stripe", roleTitle: "Software Engineer" },
      })
    ).rejects.toThrow(GuardrailBlockError);
  });
});


