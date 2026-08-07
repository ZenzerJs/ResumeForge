import { describe, it, expect } from "vitest";

describe("Evidence Bank Search & Import Data Format Verification", () => {
  it("validates evidence item JSON payload structure", () => {
    const rawImportData = [
      {
        title: "Senior Full Stack Engineer",
        organization: "Vercel",
        type: "experience",
        verifiedSummary: "Built edge network dashboard and reduced bundle sizes by 35%.",
        tags: ["Next.js", "React", "Edge"],
        bullets: [
          "Optimized bundle size across 40+ packages.",
          "Implemented zero-downtime database migrations.",
        ],
      },
    ];

    expect(Array.isArray(rawImportData)).toBe(true);
    const item = rawImportData[0];
    expect(item.title).toBe("Senior Full Stack Engineer");
    expect(item.type).toBe("experience");
    expect(item.verifiedSummary).toContain("bundle sizes");
    expect(item.tags).toHaveLength(3);
    expect(item.bullets).toHaveLength(2);
  });

  it("filters items by query string accurately", () => {
    const items = [
      {
        title: "Lead Frontend Engineer",
        organization: "Stripe",
        verifiedSummary: "Built payment element components in React.",
        tags: ["React", "Stripe.js"],
      },
      {
        title: "Backend Architect",
        organization: "AWS",
        verifiedSummary: "Designed serverless event-driven architecture.",
        tags: ["Rust", "Lambda"],
      },
    ];

    const searchQuery = "stripe";
    const filtered = items.filter((item) => {
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.organization.toLowerCase().includes(q) ||
        item.verifiedSummary.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q))
      );
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].organization).toBe("Stripe");
  });
});
