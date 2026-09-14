import { describe, it, expect } from "vitest";
import { convertExtractedPdfToEvidenceItems } from "@/lib/evidence/evidence-transform";

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

  it("converts ExtractedPdfEvidence into structured Evidence Bank items", () => {
    const samplePdfExtracted = {
      sourceDoc: "jayden_resume.pdf",
      pages: [{ pageNumber: 1, text: "Sample text" }],
      sections: {
        experience: [
          "Developed distributed streaming pipeline handling 50k events/sec.",
          "Reduced p99 database query latency by 45% using Redis caching.",
        ],
        projects: [
          "Architected real-time multiplayer code editor with operational transformation.",
        ],
        skills: ["TypeScript", "Rust", "Next.js", "PostgreSQL"],
        education: ["Wilfrid Laurier University, Honours Computer Science"],
        certifications: ["AWS Certified Solutions Architect"],
        uncategorized: [],
      },
      extractedTechnologies: ["TypeScript", "Rust", "Next.js"],
      impactMetrics: ["50k events/sec", "45%"],
    };

    const items = convertExtractedPdfToEvidenceItems(samplePdfExtracted);
    expect(items.length).toBeGreaterThanOrEqual(4);

    const expItem = items.find((i) => i.type === "experience");
    expect(expItem).toBeDefined();
    expect(expItem?.title).toContain("jayden_resume");
    expect(expItem?.bullets).toHaveLength(2);
    expect(expItem?.bullets[0].text).toContain("streaming pipeline");

    const projItem = items.find((i) => i.type === "project");
    expect(projItem).toBeDefined();
    expect(projItem?.bullets).toHaveLength(1);

    const skillItem = items.find((i) => i.type === "skill");
    expect(skillItem).toBeDefined();
    expect(skillItem?.bullets.map((b) => b.text)).toContain("TypeScript");

    const eduItem = items.find((i) => i.type === "education");
    expect(eduItem).toBeDefined();
    expect(eduItem?.organization).toContain("Wilfrid Laurier University");
  });
});
