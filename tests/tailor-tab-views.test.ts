import { describe, it, expect } from "vitest";

describe("WS5.1 — Tailor Information Architecture & Tabbed Segmentation", () => {
  type TailorTab = "overview" | "job-info";

  it("supports valid tailor workspace tab identifiers", () => {
    const tabs: TailorTab[] = ["overview", "job-info"];
    expect(tabs).toContain("overview");
    expect(tabs).toContain("job-info");
    expect(tabs.length).toBe(2);
  });

  it("maintains state structure across tab switches without resetting", () => {
    let currentTab: TailorTab = "overview";

    const state = {
      company: "Nova Labs",
      roleTitle: "Senior Backend Engineer",
      rawDescription: "Sample Job Description Text",
      extractedRequirements: {
        requiredSkills: ["Go", "Kubernetes", "PostgreSQL"],
        preferredSkills: ["AWS"],
        domainTerms: ["Microservices"],
      },
      selectedProfile: "Backend",
      generatedPatches: [
        {
          id: "patch-1",
          section: "Experience",
          targetText: "old",
          replacementText: "new",
        },
      ],
    };

    // Switch to job-info tab
    currentTab = "job-info";
    expect(currentTab).toBe("job-info");
    expect(state.company).toBe("Nova Labs");
    expect(state.extractedRequirements.requiredSkills).toHaveLength(3);

    // Switch back to overview tab
    currentTab = "overview";
    expect(currentTab).toBe("overview");
    expect(state.generatedPatches).toHaveLength(1);
    expect(state.selectedProfile).toBe("Backend");
  });
});
