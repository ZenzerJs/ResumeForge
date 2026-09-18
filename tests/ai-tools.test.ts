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

  it("executes inspect_layout_budget detecting page limits and overflow", async () => {
    // 1-page sample source within budget
    const compactSource = Array.from({ length: 35 }, (_, i) => `- Built feature ${i + 1} with high reliability.`).join("\n");
    const compactResult = await executeServerTool("inspect_layout_budget", {
      typstSource: compactSource,
      pageLimit: 1,
    });

    expect(compactResult.success).toBe(true);
    expect(compactResult.data.estimatedPages).toBe(1);
    expect(compactResult.data.exceedsLimit).toBe(false);
    expect(compactResult.data.status).toBe("WITHIN_BUDGET");

    // Overflow source exceeding 1-page budget
    const overflowSource = Array.from({ length: 120 }, (_, i) => `- Built feature ${i + 1} with high reliability.`).join("\n");
    const overflowResult = await executeServerTool("inspect_layout_budget", {
      typstSource: overflowSource,
      pageLimit: 1,
    });

    expect(overflowResult.success).toBe(true);
    expect(overflowResult.data.estimatedPages).toBeGreaterThan(1);
    expect(overflowResult.data.exceedsLimit).toBe(true);
    expect(overflowResult.data.status).toBe("OVERFLOW");
    expect(overflowResult.data.recommendation).toContain("Recommend trimming");
  });

  it("executes search_evidence with parameter validation", async () => {
    const result = await executeServerTool("search_evidence", {
      query: "database postgresql performance",
      tags: ["database", "backend"],
      limit: 5,
      status: "all",
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data.results)).toBe(true);
  });

  it("rejects unsupported tools gracefully", async () => {
    const result = await executeServerTool("invalid_tool" as any, {});
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unsupported tool");
  });
});

