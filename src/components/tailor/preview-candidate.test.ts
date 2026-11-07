import { describe, expect, it } from "vitest";
import type { PatchProposal } from "@/lib/ai/patch-schema";
import { buildPreviewCandidate } from "./preview-candidate";
const patch = (id: string, before: string, after: string): PatchProposal => ({
  id,
  before,
  after,
  operation: "MODIFY_BULLET",
  targetSection: "Work",
  evidenceIds: ["e1"],
  rationale: "reason",
  confidence: 1,
});
describe("temporary preview candidate", () => {
  it("handles deletion, reorder and rejected changes without modifying the base", () => {
    const base = "one\ntwo\nthree";
    const result = buildPreviewCandidate(
      base,
      [
        patch("remove", "one\n", ""),
        patch("order", "two\nthree", "three\ntwo"),
        patch("no", "three", "ignored"),
      ],
      { no: "rejected" },
    );
    expect(result.source).toBe("three\ntwo");
    expect(result.included).toEqual(["remove", "order"]);
    expect(base).toBe("one\ntwo\nthree");
  });
  it("excludes duplicate, overlapping, missing, and ambiguous anchors", () => {
    const result = buildPreviewCandidate(
      "alpha beta beta",
      [
        patch("first", "alpha", "changed"),
        patch("overlap", "alpha beta", "x"),
        patch("ambiguous", "beta", "x"),
        patch("duplicate", "changed", "x"),
        patch("duplicate", "alpha", "x"),
      ],
      {},
    );
    expect(result.source).toBe("changed beta beta");
    expect(result.included).toEqual(["first"]);
    expect(result.excluded).toEqual([
      "overlap",
      "ambiguous",
      "duplicate",
      "duplicate",
    ]);
  });
  it("keeps pending and accepted candidate output identical and excludes uncited changes", () => {
    const patches = [
      patch("p", "before", "after"),
      { ...patch("uncited", "after", "bad"), evidenceIds: [] },
    ];
    const pending = buildPreviewCandidate("before", patches, {});
    expect(pending).toEqual(
      buildPreviewCandidate("before", patches, { p: "accepted" }),
    );
    expect(pending.source).toBe("after");
    expect(pending.included).toEqual(["p"]);
    expect(pending.excluded).toEqual(["uncited"]);
  });
});
