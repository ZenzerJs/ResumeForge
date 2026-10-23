import { describe, expect, it } from "vitest";
import { applyPatchProposals } from "@/lib/ai/patch-application";

const proposal = (before: string, after: string, id = "p1") => ({
  id, operation: "MODIFY_BULLET" as const, targetSection: "experience", before, after,
  evidenceIds: ["e1"], rationale: "evidence", confidence: 1,
});

describe("authoritative proposal reconstruction", () => {
  it("applies unique exact anchors in sequence", () => {
    expect(applyPatchProposals("- old\n", [proposal("- old", "- new")])).toEqual({
      typstSource: "- new\n", appliedIds: ["p1"],
    });
  });
  it("rejects missing, ambiguous, empty, and no-op anchors", () => {
    expect(() => applyPatchProposals("- other", [proposal("- old", "- new")])).toThrow(/missing or ambiguous/);
    expect(() => applyPatchProposals("- old\n- old", [proposal("- old", "- new")])).toThrow(/missing or ambiguous/);
    expect(() => applyPatchProposals("- old", [proposal(" ", "- new")])).toThrow(/no source anchor/);
    expect(() => applyPatchProposals("- old", [proposal("- old", "- old")])).toThrow(/no change/);
  });
});
