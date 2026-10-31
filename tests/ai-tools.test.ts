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

  it("rejects legacy client-authored apply_patches payloads", async () => {
    const result = await executeServerTool(
      "apply_patches",
      {
        currentTypst: "forged",
        patchIds: ["patch-1"],
        acceptedPatches: [{ id: "patch-1", before: "old", after: "forged" }],
      },
      "user-without-that-evidence"
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Tool failed");
  });

  it("does not claim page fit from source length without compilation", async () => {
    const compactSource = Array.from({ length: 35 }, (_, i) => `- Built feature ${i + 1} with high reliability.`).join("\n");
    const compactResult = await executeServerTool("inspect_layout_budget", {
      typstSource: compactSource,
      pageLimit: 1,
    });

    expect(compactResult.success).toBe(true);
    expect(compactResult.data.estimatedPages).toBeNull();
    expect(compactResult.data.exceedsLimit).toBeNull();
    expect(compactResult.data.measured).toBe(false);
    expect(compactResult.data.status).toBe("NOT_MEASURED");

    // Overflow source exceeding 1-page budget
    const overflowSource = Array.from({ length: 120 }, (_, i) => `- Built feature ${i + 1} with high reliability.`).join("\n");
    const overflowResult = await executeServerTool("inspect_layout_budget", {
      typstSource: overflowSource,
      pageLimit: 1,
    });

    expect(overflowResult.success).toBe(true);
    expect(overflowResult.data.estimatedPages).toBeNull();
    expect(overflowResult.data.exceedsLimit).toBeNull();
    expect(overflowResult.data.status).toBe("NOT_MEASURED");
    expect(overflowResult.data.recommendation).toContain("compile and measure");
  });

  it.each([{}, { typstSource: null }, { typstSource: "" }, { typstSource: "  " }, { typstSource: "resume", pageLimit: 0 }])(
    "rejects invalid layout inspection inputs: %j", async (input) => {
      const result = await executeServerTool("inspect_layout_budget", input);
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
    }
  );

  it("executes search_evidence with parameter validation", async () => {
    const result = await executeServerTool(
      "search_evidence",
      {
        query: "database postgresql performance",
        tags: ["database", "backend"],
        limit: 5,
        status: "all",
      },
      "user-without-evidence"
    );

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

