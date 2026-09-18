import { describe, it, expect } from "vitest";
import { augmentTypstWithEvidenceBank } from "@/lib/ats-evaluator/evidence-augment";

describe("ATS evidence bank augmentation", () => {
  it("appends non-archived evidence into typst content for scoring", () => {
    const typst = "= Experience\n- Built APIs in Go";
    const result = augmentTypstWithEvidenceBank(typst, [
      {
        status: "verified",
        title: "Platform Engineer",
        organization: "Acme",
        verifiedSummary: "Owned Kubernetes clusters",
        tags: ["Kubernetes", "Go"],
        bullets: [{ text: "Scaled Kubernetes workloads across regions", technologies: ["Kubernetes"] }],
      },
      {
        status: "archived",
        title: "Old Role",
        verifiedSummary: "Should not appear",
        bullets: [],
      },
    ]);

    expect(result).toContain("Built APIs in Go");
    expect(result).toContain("Evidence Bank");
    expect(result).toContain("Kubernetes");
    expect(result).toContain("Platform Engineer");
    expect(result).not.toContain("Should not appear");
  });

  it("returns original typst when no active evidence exists", () => {
    const typst = "= Skills\nPython";
    expect(augmentTypstWithEvidenceBank(typst, [])).toBe(typst);
  });
});
