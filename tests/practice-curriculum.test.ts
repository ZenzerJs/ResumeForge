import { describe, it, expect } from "vitest";
import {
  getAllTopics,
  getTopicById,
  getAllProblems,
  getProblemBySlug,
  getProblemsByTopic,
  getProblemsByCompany,
  getAllCompanies,
} from "@/lib/practice/practice-curriculum";

describe("Practice Curriculum & Pattern Library", () => {
  it("loads 7 core algorithmic pattern topics with complete theory and blueprints", () => {
    const topics = getAllTopics();
    expect(topics.length).toBe(7);

    for (const topic of topics) {
      expect(topic.id).toBeTruthy();
      expect(topic.title).toBeTruthy();
      expect(topic.overview).toBeTruthy();
      expect(topic.patternIntuition).toBeTruthy();
      expect(topic.commonUseCases.length).toBeGreaterThan(0);
      expect(topic.timeComplexity).toBeTruthy();
      expect(topic.spaceComplexity).toBeTruthy();
      expect(topic.blueprintPseudocode).toBeTruthy();

      // Worked example validation
      expect(topic.workedExample.title).toBeTruthy();
      expect(topic.workedExample.problemStatement).toBeTruthy();
      expect(topic.workedExample.walkthrough).toBeTruthy();
      expect(topic.workedExample.code).toBeTruthy();
      expect(topic.workedExample.keyTakeaways.length).toBeGreaterThan(0);
    }
  });

  it("retrieves individual topic by ID", () => {
    const arraysTopic = getTopicById("arrays-hashing");
    expect(arraysTopic).toBeDefined();
    expect(arraysTopic?.title).toBe("Arrays & Hashing");

    const nonExistent = getTopicById("quantum-computing");
    expect(nonExistent).toBeUndefined();
  });

  it("loads practice problems with multi-language templates, test cases, and progressive hints", () => {
    const problems = getAllProblems();
    expect(problems.length).toBeGreaterThanOrEqual(5);

    for (const p of problems) {
      expect(p.id).toBeTruthy();
      expect(p.slug).toBeTruthy();
      expect(p.title).toBeTruthy();
      expect(p.topicId).toBeTruthy();
      expect(["Easy", "Medium", "Hard"]).toContain(p.difficulty);
      expect(p.companies.length).toBeGreaterThan(0);
      expect(p.examples.length).toBeGreaterThan(0);
      expect(p.constraints.length).toBeGreaterThan(0);

      // Starter code in all 5 languages
      expect(p.starterTemplates.typescript).toBeTruthy();
      expect(p.starterTemplates.javascript).toBeTruthy();
      expect(p.starterTemplates.python).toBeTruthy();
      expect(p.starterTemplates.java).toBeTruthy();
      expect(p.starterTemplates.cpp).toBeTruthy();

      // Test cases with arguments and expected values
      expect(p.testCases.length).toBeGreaterThan(0);
      for (const tc of p.testCases) {
        expect(tc.id).toBeTruthy();
        expect(tc.args).toBeDefined();
        expect(tc.expected).toBeDefined();
      }

      // 3 Progressive hints
      expect(p.hints.length).toBe(3);
      expect(p.hints[0].step).toBe(1);
      expect(p.hints[1].step).toBe(2);
      expect(p.hints[2].step).toBe(3);

      // Solution with explanation
      expect(p.solution.approach).toBeTruthy();
      expect(p.solution.timeComplexity).toBeTruthy();
      expect(p.solution.spaceComplexity).toBeTruthy();
      expect(p.solution.explanation).toBeTruthy();
    }
  });

  it("retrieves problem by slug", () => {
    const twoSum = getProblemBySlug("two-sum");
    expect(twoSum).toBeDefined();
    expect(twoSum?.title).toBe("Two Sum");
    expect(twoSum?.topicId).toBe("arrays-hashing");
  });

  it("filters problems by topic and by company", () => {
    const twoPointerProblems = getProblemsByTopic("two-pointers");
    expect(twoPointerProblems.length).toBeGreaterThan(0);
    expect(twoPointerProblems.every((p) => p.topicId === "two-pointers")).toBe(true);

    const amazonProblems = getProblemsByCompany("Amazon");
    expect(amazonProblems.length).toBeGreaterThan(0);
    expect(amazonProblems.some((p) => p.slug === "two-sum")).toBe(true);
  });

  it("extracts unique sorted list of companies", () => {
    const companies = getAllCompanies();
    expect(companies.length).toBeGreaterThan(0);
    expect(companies).toContain("Amazon");
    expect(companies).toContain("Google");
    expect(companies).toContain("Spotify");
  });
});
