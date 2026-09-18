import { describe, it, expect } from "vitest";
import {
  normalizeString,
  normalizeEmployer,
  normalizeTitle,
  normalizeSkillToken,
  parseDateRange,
  extractMetricsFromText,
} from "@/lib/facts/normalize";
import { extractResumeFacts, VerifiedEvidenceInput } from "@/lib/facts/extract";

describe("Facts Engine: Normalization & Extraction", () => {
  describe("String & Employer Normalization", () => {
    it("strips accents and cleans punctuation", () => {
      expect(normalizeString("Société Générale")).toBe("societe generale");
      expect(normalizeString("C++ Developer")).toBe("c++ developer");
      expect(normalizeString("Node.js Backend")).toBe("node.js backend");
    });

    it("strips common corporate suffixes from employer names", () => {
      expect(normalizeEmployer("Google, Inc.")).toBe("google");
      expect(normalizeEmployer("Stripe LLC")).toBe("stripe");
      expect(normalizeEmployer("Amazon Technologies Corp.")).toBe("amazon");
      expect(normalizeEmployer("Microsoft Corporation")).toBe("microsoft");
    });

    it("normalizes job titles", () => {
      expect(normalizeTitle("Senior Full-Stack Engineer")).toBe("senior full-stack engineer");
      expect(normalizeTitle("Staff Software Engineer II")).toBe("staff software engineer ii");
    });

    it("canonicalizes skill tokens", () => {
      expect(normalizeSkillToken("React.js")).toBe("react");
      expect(normalizeSkillToken("Node.js")).toBe("nodejs");
      expect(normalizeSkillToken("PostgreSQL")).toBe("postgresql");
      expect(normalizeSkillToken("K8s")).toBe("kubernetes");
      expect(normalizeSkillToken("Golang")).toBe("go");
    });
  });

  describe("Date Range Parsing", () => {
    it("parses word-based month and year ranges", () => {
      const range = parseDateRange("Jan 2022 - Aug 2023");
      expect(range.startIso).toBe("2022-01");
      expect(range.endIso).toBe("2023-08");
      expect(range.isCurrent).toBe(false);
    });

    it("detects ongoing/current positions", () => {
      const range = parseDateRange("May 2023 - Present");
      expect(range.startIso).toBe("2023-05");
      expect(range.endIso).toBeUndefined();
      expect(range.isCurrent).toBe(true);
    });

    it("parses numeric month and year formats", () => {
      const range = parseDateRange("05/2021 - 12/2022");
      expect(range.startIso).toBe("2021-05");
      expect(range.endIso).toBe("2022-12");
    });
  });

  describe("Metric Extraction & Trivial Number Filtering", () => {
    it("extracts non-trivial metrics with units and values", () => {
      const text = "Reduced latency by 45ms and scaled system to 500k QPS generating $1.2M in savings.";
      const metrics = extractMetricsFromText(text);

      expect(metrics.some((m) => m.value === 45 && m.unit.toLowerCase() === "ms")).toBe(true);
      expect(metrics.some((m) => m.value === 500 && m.unit.toLowerCase() === "k")).toBe(true);
      expect(metrics.some((m) => m.value === 1.2 && m.unit === "$M")).toBe(true);
    });

    it("classifies trivial integers 0-10 without units as trivial", () => {
      const text = "Led a team of 4 engineers on 2 internal projects.";
      const metrics = extractMetricsFromText(text);

      const teamMetric = metrics.find((m) => m.value === 4);
      expect(teamMetric?.isTrivial).toBe(true);

      const projMetric = metrics.find((m) => m.value === 2);
      expect(projMetric?.isTrivial).toBe(true);
    });

    it("does not classify percentages 0-10% as trivial", () => {
      const text = "Increased conversion rate by 5%.";
      const metrics = extractMetricsFromText(text);

      const pctMetric = metrics.find((m) => m.value === 5 && m.unit === "%");
      expect(pctMetric?.isTrivial).toBe(false);
    });
  });

  describe("ResumeFacts Full Extraction Pipeline", () => {
    it("extracts facts strictly from verified evidence and master Typst", () => {
      const typst = `
#resume-entry(title: "Software Engineer", location: "New York, NY", date: "May 2023 - Present")
- Built high-performance GraphQL APIs handling 10M daily requests with 99.9% uptime.
- *Google* -- *Software Engineer*
      `;

      const evidenceBank: VerifiedEvidenceInput[] = [
        {
          id: "evid-1",
          type: "experience",
          title: "Backend Engineer",
          organization: "Stripe, Inc.",
          dates: "Jan 2022 - Apr 2023",
          verifiedSummary: "Scaled payment ledger processing $50M volume.",
          tags: ["TypeScript", "PostgreSQL"],
          status: "verified",
          bullets: [
            {
              id: "bullet-1",
              text: "Optimized database queries reducing p99 response time by 60ms.",
              technologies: ["PostgreSQL", "Redis"],
              verified: true,
            },
          ],
        },
        {
          id: "evid-unverified",
          type: "experience",
          title: "Hallucinated Chief Architect",
          organization: "Fake Unicorn LLC",
          dates: "2020 - 2021",
          verifiedSummary: "Made up $1B company.",
          status: "draft", // UNVERIFIED DRAFT
        },
        {
          id: "evid-archived",
          type: "experience",
          title: "Archived Role",
          organization: "Old Corp",
          status: "archived", // ARCHIVED
          verifiedSummary: "Old archived claim",
        },
      ];

      const facts = extractResumeFacts(typst, evidenceBank);

      expect(facts.version).toBe(1);
      // Verified evidence included
      expect(facts.employers.some((e) => e.normalized === "stripe")).toBe(true);
      expect(facts.titles.some((t) => t.normalized === "backend engineer")).toBe(true);
      expect(facts.skills).toContain("typescript");
      expect(facts.skills).toContain("postgresql");
      expect(facts.skills).toContain("redis");
      expect(facts.evidenceIds).toContain("evid-1");
      expect(facts.evidenceIds).toContain("bullet-1");

      // Typst facts included
      expect(facts.employers.some((e) => e.normalized === "google")).toBe(true);
      expect(facts.metrics.some((m) => m.value === 10 && m.unit.toLowerCase() === "m")).toBe(true);

      // Unverified drafts and archived items completely excluded
      expect(facts.employers.some((e) => e.normalized.includes("fake unicorn"))).toBe(false);
      expect(facts.titles.some((t) => t.normalized.includes("hallucinated chief architect"))).toBe(false);
      expect(facts.employers.some((e) => e.normalized.includes("old corp"))).toBe(false);
      expect(facts.evidenceIds).not.toContain("evid-unverified");
      expect(facts.evidenceIds).not.toContain("evid-archived");
    });
  });
});
