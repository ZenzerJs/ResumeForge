import { describe, it, expect } from "vitest";
import {
  NEETCODE_150,
  SYSTEM_DESIGN_QUESTIONS,
  OA_PROBLEMS,
  ALL_QUESTIONS,
  COMPANY_LOGOS,
} from "@/lib/interview/questionDatabase";
import { getCompanyLogo } from "@/components/interview/company-logos";

describe("Question Database & Curricula", () => {
  const EXPECTED_NEETCODE_CATEGORIES = [
    "Arrays & Hashing",
    "Two Pointers",
    "Sliding Window",
    "Stack",
    "Binary Search",
    "Linked List",
    "Trees",
    "Tries",
    "Heap / Priority Queue",
    "Backtracking",
    "Graphs",
    "Advanced Graphs",
    "1-D DP",
    "2-D DP",
    "Greedy",
    "Intervals",
    "Math & Geometry",
    "Bit Manipulation",
  ];

  it("contains exactly 150 NeetCode problems across all 18 standard categories", () => {
    expect(NEETCODE_150.length).toBe(150);

    const categories = new Set(NEETCODE_150.map((q) => q.category));
    for (const expectedCat of EXPECTED_NEETCODE_CATEGORIES) {
      expect(categories.has(expectedCat)).toBe(true);
    }
    expect(categories.size).toBe(18);
  });

  it("contains exactly 15 System Design problems with architecture trade-offs", () => {
    expect(SYSTEM_DESIGN_QUESTIONS.length).toBe(15);

    for (const q of SYSTEM_DESIGN_QUESTIONS) {
      expect(q.track).toBe("system_design");
      expect(q.rubricGuide).toContain("Key Components");
      expect(q.rubricGuide).toContain("Constraints");
      expect(q.rubricGuide).toContain("Trade-offs");
      expect(q.starRubric?.situation).toBeTruthy();
      expect(q.starRubric?.task).toBeTruthy();
      expect(q.starRubric?.action).toBeTruthy();
      expect(q.starRubric?.result).toBeTruthy();
    }
  });

  it("contains exactly 10 Online Assessment (OA) screening problems", () => {
    expect(OA_PROBLEMS.length).toBe(10);

    for (const q of OA_PROBLEMS) {
      expect(q.track).toBe("oa_screening");
      expect(q.rubricGuide).toBeTruthy();
      expect(q.companyTags.length).toBeGreaterThan(0);
      expect(q.starRubric?.situation).toBeTruthy();
      expect(q.starRubric?.task).toBeTruthy();
      expect(q.starRubric?.action).toBeTruthy();
      expect(q.starRubric?.result).toBeTruthy();
    }
  });

  it("aggregates all curricula into ALL_QUESTIONS with unique IDs and valid schema", () => {
    expect(ALL_QUESTIONS.length).toBe(175);

    const idSet = new Set<string>();
    for (const q of ALL_QUESTIONS) {
      expect(idSet.has(q.id)).toBe(false);
      idSet.add(q.id);

      expect(q.title).toBeTruthy();
      expect(["Easy", "Medium", "Hard"]).toContain(q.difficulty);
      expect(["algorithms", "system_design", "behavioral", "oa_screening"]).toContain(q.track);
      expect(q.companyTags.length).toBeGreaterThan(0);
      expect(q.rubricGuide).toBeTruthy();
      expect(q.timeComplexity).toBeTruthy();
      expect(q.spaceComplexity).toBeTruthy();
    }
  });

  it("defines Tier 1 company brand assets and provides valid SVG renderers", () => {
    const expectedCompanies = [
      "google",
      "meta",
      "amazon",
      "apple",
      "netflix",
      "openai",
      "microsoft",
      "uber",
      "stripe",
      "databricks",
    ];

    expect(COMPANY_LOGOS.length).toBe(10);
    const logoSlugs = COMPANY_LOGOS.map((c) => c.slug);

    for (const slug of expectedCompanies) {
      expect(logoSlugs).toContain(slug);
      const svgElement = getCompanyLogo(slug, "w-4 h-4");
      expect(svgElement).toBeDefined();
    }
  });
});
