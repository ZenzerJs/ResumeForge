import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { verifyCoverLetterGrounding } from "@/lib/ai/cover-letter-verifier";
import {
  buildCoverLetterSystemPrompt,
  buildCoverLetterUserPrompt,
} from "@/lib/ai/cover-letter-prompt";
import {
  extractCandidateNameFromTypst,
  managedResumeExport,
  replacePlaceholderSignature,
} from "@/lib/export/resume-text";
import { cleanTypstToText } from "@/lib/export/zip";
import { buildResumeDocument, renderResumeDocument } from "@/lib/typst/resume-document";
import { classifyPdfTextFallback } from "@/lib/pdf/parser";

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

  it("3. rejects cover letter with empty citations when Evidence Bank has active items", () => {
    const genericLetter = {
      salutation: "Dear Hiring Manager,",
      openingParagraph: "I am excited to apply for this role at your company.",
      bodyParagraphs: ["I have strong experience and would be a great fit for the team."],
      closingParagraph: "Thank you for your consideration.",
      fullMarkdown: "# Cover Letter\n...",
      evidenceCitations: [],
    };

    const result = verifyCoverLetterGrounding(genericLetter, activeEvidenceIds);
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/at least one Evidence Bank ID/i);
  });

  it("4. cover letter prompt removes claim-seeding examples and distinguishes experience vs project framing", () => {
    const systemPrompt = buildCoverLetterSystemPrompt();
    expect(systemPrompt).not.toContain("containerized microservice deployments");
    expect(systemPrompt).not.toContain("Acme Platform");
    expect(systemPrompt).not.toContain("cutting p95 query latency by 40%");
    expect(systemPrompt).not.toMatch(/Sincerely,\\nCandidate["\s]/);
    expect(systemPrompt).toContain("[Type: experience]");
    expect(systemPrompt).toContain("in professional settings");
    expect(systemPrompt).toContain("in past roles");

    const userPrompt = buildCoverLetterUserPrompt(
      {
        jobId: "job-1",
        company: "Northwind",
        roleTitle: "Software Engineer",
        rawDescription: "Build web applications with TypeScript and PostgreSQL.",
        candidateName: "Alex Morgan",
        activeRoleProfile: "Full-stack",
      },
      [
        {
          id: "proj-1",
          type: "project",
          title: "Campus Transit Tracker",
          organization: "UC Berkeley",
          dates: "2025",
          verifiedSummary: "Built a transit delay dashboard for campus buses.",
          tags: ["TypeScript"],
          status: "verified",
          bullets: [{ id: "b-1", text: "Built TypeScript frontend views.", technologies: ["TypeScript"], verified: true }],
        },
      ]
    );
    expect(userPrompt).toContain("[Type: project]");
    expect(userPrompt).toContain("Alex Morgan");
  });

  it("5. extracts real candidate name from managed and unmanaged Typst sources and replaces Candidate signature", () => {
    const raw = "Morgan Sample\nmorgan@example.com\nExperience\nNorthwind Health Systems\nIT Operations May 2026 - Present\n- Supported systems";
    const managedSource = renderResumeDocument(
      buildResumeDocument(raw, classifyPdfTextFallback(raw)),
      "comfortable"
    );
    expect(extractCandidateNameFromTypst(managedSource)).toBe("Morgan Sample");

    const starter = readFileSync("public/templates/starter-resume.typ", "utf8");
    expect(extractCandidateNameFromTypst(starter)).toBe("Alex Morgan");

    const headingTypst = `= Jordan Example\njordan@example.com\n== Experience\n- Built API`;
    expect(extractCandidateNameFromTypst(headingTypst)).toBe("Jordan Example");

    const placeholderTypst = `#align(center)[#text(size: 18pt, weight: "bold")[CANDIDATE NAME]]`;
    expect(extractCandidateNameFromTypst(placeholderTypst)).toBeNull();

    const signed = replacePlaceholderSignature(
      "# Cover Letter\n\nDear Team,\n\nBody.\n\nSincerely,\nCandidate",
      "Alex Morgan"
    );
    expect(signed).toContain("Sincerely,\nAlex Morgan");
    expect(signed).not.toContain("Sincerely,\nCandidate");

    expect(
      replacePlaceholderSignature("Kind regards,\n  [Your Name]", "Jane $1 Doe")
    ).toBe("Kind regards,\n  Jane $1 Doe");
    expect(
      replacePlaceholderSignature("Best,\n[Candidate]", "Alex Morgan")
    ).toBe("Best,\nAlex Morgan");
    expect(
      replacePlaceholderSignature("Warmly,\nYour Name", "Alex Morgan")
    ).toBe("Warmly,\nAlex Morgan");
    expect(
      replacePlaceholderSignature("Sincerely,\nCandidate Name", "Alex Morgan")
    ).toBe("Sincerely,\nAlex Morgan");
    expect(
      replacePlaceholderSignature("Sincerely,\nCandidate Smith", "Alex Morgan")
    ).toBe("Sincerely,\nCandidate Smith");
  });

  it("6. emits bare email and bare URL in plain-text resume exports instead of label (url)", () => {
    const unmanaged = `= Jordan Example\n#link("mailto:jordan@example.invalid")[jordan\\@example.invalid] | #link("https://github.com/jordan")[github.com/jordan]\n== Experience\n- Built API`;
    const cleaned = cleanTypstToText(unmanaged);
    expect(cleaned).toContain("jordan@example.invalid | https://github.com/jordan");
    expect(cleaned).not.toContain("(mailto:");
    expect(cleaned).not.toContain("(https://");

    const raw = "Morgan Sample\nmorgan@example.com | github.com/morgan\nExperience\n- Built API";
    const managed = renderResumeDocument(
      buildResumeDocument(raw, classifyPdfTextFallback(raw)),
      "comfortable"
    ).replace("Built API", "Built edited API");
    const exported = managedResumeExport(managed)?.text ?? "";
    expect(exported).toContain("morgan@example.com");
    expect(exported).not.toContain("(mailto:");
  });
});
