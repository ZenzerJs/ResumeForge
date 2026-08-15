import { describe, it, expect } from "vitest";
import { executeServerTool } from "@/lib/ai/tools/executor";
import { ResumeFacts } from "@/lib/facts/types";

describe("AI Model Tool Protocol & Executor", () => {
  const masterFacts: ResumeFacts = {
    version: 1,
    snapshotAt: "2026-08-14T00:00:00.000Z",
    employers: [{ raw: "Google", normalized: "google" }],
    titles: [{ raw: "Software Engineer", normalized: "software engineer" }],
    dateRanges: [{ raw: "2022 - 2023", startIso: "2022-01", endIso: "2023-12" }],
    metrics: [{ raw: "45ms", value: 45, unit: "ms", context: "latency", isTrivial: false }],
    skills: ["typescript", "postgresql"],
    evidenceIds: ["evid-100"],
  };

  it("executes get_ats_score tool cleanly", async () => {
    const result = await executeServerTool("get_ats_score", {
      typstContent: `
= Jane Doe
== EXPERIENCE
*Google* -- *Software Engineer*
- Built TypeScript backend with PostgreSQL database.
      `,
      roleProfile: "Backend",
      requirements: {
        requiredSkills: ["typescript", "postgresql", "sql"],
        preferredSkills: ["redis"],
        domainTerms: ["database"],
      },
    });

    expect(result.success).toBe(true);
    expect(result.data.overallScore).toBeGreaterThan(0);
    expect(result.data.baseHealth).toBeDefined();
  });

  it("executes run_guardrail tool detecting clean vs violation states", async () => {
    const cleanResult = await executeServerTool("run_guardrail", {
      candidateTypst: `*Google* -- *Software Engineer*\n- Reduced latency by 45ms.`,
      masterFacts,
    });
    expect(cleanResult.success).toBe(true);
    expect(cleanResult.data.passed).toBe(true);

    const badResult = await executeServerTool("run_guardrail", {
      candidateTypst: `*Uber* -- *Principal Architect*\n- Scaled to 100M users.`,
      masterFacts,
    });
    expect(badResult.success).toBe(true);
    expect(badResult.data.passed).toBe(false);
    expect(badResult.data.hasHardViolations).toBe(true);
  });

  it("executes apply_patches tool with guardrail check", async () => {
    const currentTypst = `*Google* -- *Software Engineer*\n- Handled database optimization.`;
    const acceptedPatches = [
      {
        id: "patch-1",
        before: "- Handled database optimization.",
        after: "- Reduced latency by 45ms.",
        evidenceIds: ["evid-100"],
      },
    ];

    const result = await executeServerTool("apply_patches", {
      currentTypst,
      patchIds: ["patch-1"],
      acceptedPatches,
      masterFacts,
    });

    expect(result.success).toBe(true);
    expect(result.data.updatedTypst).toContain("Reduced latency by 45ms.");
  });

  it("rejects unsupported tools gracefully", async () => {
    const result = await executeServerTool("invalid_tool" as any, {});
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unsupported tool");
  });
});
