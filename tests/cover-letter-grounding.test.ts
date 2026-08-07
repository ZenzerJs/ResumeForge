import { describe, it, expect } from "vitest";
import { verifyCoverLetterGrounding } from "@/lib/ai/cover-letter-verifier";

describe("Cover Letter Evidence Grounding Verifier (Fail-First Protocol)", () => {
  const activeEvidenceIds = [
    "exp-1",
    "bullet-101",
    "bullet-102",
    "proj-201",
  ];

  it("1. accepts cover letter when all cited evidenceIds exist in active Evidence Bank", () => {
    const mockCoverLetter = {
      salutation: "Dear Hiring Manager,",
      openingParagraph: "I am writing to express my strong interest...",
      bodyParagraphs: [
        "Led backend microservices architecture using Node.js and TypeScript.",
        "Scaled PostgreSQL queries achieving a 40% reduction in latency.",
      ],
      closingParagraph: "Thank you for your time and consideration.",
      fullMarkdown: "# Cover Letter\n...",
      evidenceCitations: ["exp-1", "bullet-101"],
    };

    const result = verifyCoverLetterGrounding(mockCoverLetter, activeEvidenceIds);
    expect(result.verified).toBe(true);
    expect(result.invalidCitations).toEqual([]);
  });

  it("2. rejects cover letter when it cites non-existent or hallucinated evidenceIds", () => {
    const mockHallucinatedLetter = {
      salutation: "Dear Hiring Manager,",
      openingParagraph: "I am writing to apply for the Senior AI Engineer role...",
      bodyParagraphs: [
        "Invanted non-existent Quantum Computing framework that solves P vs NP.",
      ],
      closingParagraph: "Sincerely, Candidate.",
      fullMarkdown: "# Cover Letter\n...",
      evidenceCitations: ["exp-1", "fake-nonexistent-id-999"],
    };

    const result = verifyCoverLetterGrounding(mockHallucinatedLetter, activeEvidenceIds);
    expect(result.verified).toBe(false);
    expect(result.invalidCitations).toContain("fake-nonexistent-id-999");
  });
});
