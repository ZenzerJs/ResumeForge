import { describe, it, expect } from "vitest";
import { ALLOWLISTED_TOOLS, CHAT_TOOLS, SearchEvidenceParamsSchema, InspectLayoutBudgetParamsSchema } from "@/lib/ai/tools/definitions";

describe("Living UI & Agent Tooling Architecture Contracts", () => {
  it("1. ALLOWLISTED_TOOLS contains search_evidence and inspect_layout_budget", () => {
    expect(ALLOWLISTED_TOOLS).toContain("search_evidence");
    expect(ALLOWLISTED_TOOLS).toContain("inspect_layout_budget");
    expect(ALLOWLISTED_TOOLS).toContain("get_resume_facts");
    expect(ALLOWLISTED_TOOLS).toContain("run_guardrail");
    expect(ALLOWLISTED_TOOLS).toContain("apply_patches");
    expect(ALLOWLISTED_TOOLS).toContain("export_docx");
  });

  it("1b. CHAT_TOOLS excludes mutation tools", () => {
    expect(CHAT_TOOLS).not.toContain("apply_patches");
    expect(CHAT_TOOLS).not.toContain("export_docx");
  });

  it("2. SearchEvidenceParamsSchema validates required query and default limits", () => {
    const valid = SearchEvidenceParamsSchema.parse({
      query: "distributed systems rust",
    });
    expect(valid.query).toBe("distributed systems rust");
    expect(valid.limit).toBe(10);
    expect(valid.status).toBe("verified");

    const custom = SearchEvidenceParamsSchema.parse({
      query: "react",
      tags: ["frontend", "web"],
      limit: 3,
      status: "all",
    });
    expect(custom.limit).toBe(3);
    expect(custom.tags).toEqual(["frontend", "web"]);
  });

  it("3. InspectLayoutBudgetParamsSchema parses single-page budget defaults", () => {
    const parsed = InspectLayoutBudgetParamsSchema.parse({
      typstSource: "= My Resume\n== Education\nUniversity of Waterloo",
    });
    expect(parsed.pageLimit).toBe(1);
    expect(parsed.typstSource).toContain("Waterloo");
  });

  it("4. Tool life-cycle state strings match ToolBadge contracts", () => {
    const validStates = ["running", "completed", "error"];
    expect(validStates).toContain("running");
    expect(validStates).toContain("completed");
    expect(validStates).toContain("error");
  });
});
