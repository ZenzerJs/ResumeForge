import { describe, it, expect } from "vitest";
import { tokenizeHighlightedJd } from "@/lib/jd/highlight-keywords";
import { formatH1BBadge, formatFundingBadge } from "@/lib/companyIntel";
import { calculateMatchScore } from "@/lib/matchScore";
import { parseJobDescription } from "@/lib/jd-parser/parser";

describe("Jobright Upgrade Cycle: Bug Reproductions and Regressions", () => {
  describe("Issue 1: Keyword Highlighting for Non-Word Characters (C++, C#, .NET)", () => {
    it("correctly highlights C++, C#, .NET, Node.js, and AWS/GCP without word boundary failures", () => {
      const text = "We are seeking a Senior C++ Engineer with C# and .NET experience. Knowledge of Node.js and AWS/GCP is a plus.";
      const skills = ["C++", "C#", ".NET", "Node.js", "AWS/GCP"];

      const tokens = tokenizeHighlightedJd(text, skills);

      const matchedTerms = tokens.filter((t) => t.isMatch).map((t) => t.text);
      expect(matchedTerms).toContain("C++");
      expect(matchedTerms).toContain("C#");
      expect(matchedTerms).toContain(".NET");
      expect(matchedTerms).toContain("Node.js");
      expect(matchedTerms).toContain("AWS/GCP");
    });

    it("prioritizes longer compound terms over substrings (JavaScript vs Java)", () => {
      const text = "Full stack role requiring Java and JavaScript.";
      const skills = ["Java", "JavaScript"];

      const tokens = tokenizeHighlightedJd(text, skills);

      const matchedTerms = tokens.filter((t) => t.isMatch).map((t) => t.text);
      expect(matchedTerms).toEqual(["Java", "JavaScript"]);
    });

    it("returns plain token when skills list is empty", () => {
      const text = "Just plain text without skills.";
      const tokens = tokenizeHighlightedJd(text, []);
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toEqual({ text, isMatch: false });
    });
  });

  describe("Issue 2: Dynamic Sandbox Job Description Parsing & Scoring", () => {
    const candidate = {
      skills: ["Go", "Python", "Docker", "PostgreSQL"],
      totalYoe: 6,
      evidenceItems: [
        {
          id: "ev-1",
          title: "Microservices",
          tags: ["Go", "PostgreSQL"],
          bullets: [{ text: "Go & PostgreSQL", technologies: ["Go", "PostgreSQL"] }],
        },
      ],
    };

    it("dynamically recalculates fit score when custom JD text is parsed", () => {
      const customJd = `Staff Infrastructure Engineer — CloudTech
Requirements:
- 5+ years of experience in backend development.
- Deep expertise in Go and PostgreSQL.
- Experience with Docker.
`;
      const parsed = parseJobDescription(customJd);
      expect(parsed.requiredSkills).toContain("Go");
      expect(parsed.requiredSkills).toContain("PostgreSQL");

      const dynamicScore = calculateMatchScore(
        {
          requiredSkills: parsed.requiredSkills,
          preferredSkills: parsed.preferredSkills,
          requiredYoe: 5,
        },
        candidate
      );

      expect(dynamicScore.compositeScore).toBeGreaterThanOrEqual(80);
      expect(dynamicScore.matchedSkills.some((s) => s.skill === "Go" && s.verified)).toBe(true);
    });
  });

  describe("Issue 3: H1B Badge Text Specification", () => {
    it("formats H1B badge as 'H1B Filings Verified (YEAR)'", () => {
      const badge = formatH1BBadge({
        hasHistoricalFilings: true,
        recentFilingCount: { "2024": 6, "2025": 14, "2026": 18 },
        engineeringRoleRatio: 0.88,
        sponsorConfidence: "high",
        source: "US_DOL_LCA_PUBLIC",
      });

      expect(badge).toBe("H1B Filings Verified (2026)");
    });
  });

  describe("Issue 4: Case-Insensitive Deduplication in Calculate Match Score", () => {
    it("deduplicates case variants in tools and coverage without double counting", () => {
      const job = {
        requiredSkills: ["Go", "Docker"],
        tools: ["Docker", "docker", "DOCKER"],
        preferredSkills: ["docker"],
        requiredYoe: 3,
      };

      const candidate = {
        skills: ["Go", "Docker"],
        totalYoe: 4,
        evidenceItems: [
          {
            id: "ev-1",
            title: "Container Systems",
            tags: ["Go", "Docker"],
            bullets: [{ text: "Built with Go and Docker", technologies: ["Go", "Docker"] }],
          },
        ],
      };

      const result = calculateMatchScore(job, candidate);
      expect(result.breakdown.toolsScore).toBe(100);
      expect(result.compositeScore).toBe(100);
    });

    it("deduplicates case variants in requiredSkills without duplicating matchedSkills or skewing score", () => {
      const job = {
        requiredSkills: ["Go", "go", "GO", "Python", "python"],
        requiredYoe: 3,
      };

      const candidate = {
        skills: ["Go", "Python"],
        totalYoe: 4,
        evidenceItems: [
          {
            id: "ev-1",
            title: "Backend Services",
            tags: ["Go", "Python"],
            bullets: [{ text: "Go and Python", technologies: ["Go", "Python"] }],
          },
        ],
      };

      const result = calculateMatchScore(job, candidate);
      expect(result.breakdown.coreStackScore).toBe(100);
      expect(result.matchedSkills).toHaveLength(2); // Only "Go" and "Python"
      expect(result.missingRequiredSkills).toHaveLength(0);
      expect(result.explanationDerivation[0]).toContain("based on 2 required skills");
    });
  });

  describe("Issue 5: H1B Badge Missing or Undefined recentFilingCount Resilience", () => {
    it("handles undefined or empty recentFilingCount without throwing TypeError", () => {
      // @ts-expect-error Testing partial object runtime resilience
      const badgeEmpty = formatH1BBadge({
        hasHistoricalFilings: true,
        recentFilingCount: {},
        sponsorConfidence: "high",
        source: "US_DOL_LCA_PUBLIC",
      });
      expect(badgeEmpty).toBe("H1B Sponsor: High");

      // @ts-expect-error Testing undefined recentFilingCount runtime resilience
      const badgeUndefined = formatH1BBadge({
        hasHistoricalFilings: true,
        sponsorConfidence: "moderate",
        source: "US_DOL_LCA_PUBLIC",
      });
      expect(badgeUndefined).toBe("H1B Sponsor: Moderate");
    });
  });
});
