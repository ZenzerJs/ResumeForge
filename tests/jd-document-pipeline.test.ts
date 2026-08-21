import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  parseJobDescriptionDocument,
  createUserRequirement,
  computeContentHash,
  classifySectionHeading,
  classifyRequirementCategory,
} from "@/lib/jd/document-pipeline";

describe("Job Description Document Pipeline (H4)", () => {
  const fixturesDir = path.join(__dirname, "fixtures", "jobs");

  it("parses Greenhouse full description JSON fixture into structured sections and requirements", () => {
    const raw = fs.readFileSync(path.join(fixturesDir, "greenhouse-full-description.json"), "utf8");
    const json = JSON.parse(raw);

    const doc = parseJobDescriptionDocument({
      rawJson: json,
      sourceUrl: "https://boards.greenhouse.io/acme/jobs/4829102003",
    });

    expect(doc.sourceKind).toBe("GREENHOUSE");
    expect(doc.diagnostics.status).toBe("VERIFIED_ATS");
    expect(doc.sections.length).toBeGreaterThanOrEqual(4);

    // Verify Section Kinds
    const sectionKinds = doc.sections.map((s) => s.kind);
    expect(sectionKinds).toContain("ABOUT_COMPANY");
    expect(sectionKinds).toContain("RESPONSIBILITIES");
    expect(sectionKinds).toContain("REQUIRED");
    expect(sectionKinds).toContain("PREFERRED");
    expect(sectionKinds).toContain("COMPENSATION");

    // Verify Requirements Extraction with exact quotes and source linkages
    expect(doc.requirements.length).toBeGreaterThanOrEqual(4);
    const reqSection = doc.sections.find((s) => s.kind === "REQUIRED");
    expect(reqSection).toBeDefined();

    doc.requirements.forEach((req) => {
      expect(req.id).toBeDefined();
      expect(req.sourceQuote).toBeDefined();
      expect(req.sourceQuote.length).toBeGreaterThan(5);
      expect(req.sourceSectionId).toBeDefined();
      expect(["REQUIRED", "PREFERRED", "UNKNOWN"]).toContain(req.priority);
      expect(["SKILL", "EXPERIENCE", "EDUCATION", "CERTIFICATION", "DOMAIN"]).toContain(req.category);
    });

    // Check specific requirement categorization
    const expReq = doc.requirements.find((r) => r.sourceQuote.includes("8+ years"));
    expect(expReq?.category).toBe("EXPERIENCE");
    expect(expReq?.priority).toBe("REQUIRED");

    const eduReq = doc.requirements.find((r) => r.sourceQuote.includes("BS or MS"));
    expect(eduReq?.category).toBe("EDUCATION");
    expect(eduReq?.priority).toBe("REQUIRED");
  });

  it("parses Lever posting JSON fixture preserving list classifications", () => {
    const raw = fs.readFileSync(path.join(fixturesDir, "lever-posting.json"), "utf8");
    const json = JSON.parse(raw);

    const doc = parseJobDescriptionDocument({
      rawJson: json,
      sourceUrl: "https://jobs.lever.co/tech/e674b011",
    });

    expect(doc.sourceKind).toBe("LEVER");
    expect(doc.diagnostics.status).toBe("VERIFIED_ATS");

    const kinds = doc.sections.map((s) => s.kind);
    expect(kinds).toContain("RESPONSIBILITIES");
    expect(kinds).toContain("REQUIRED");
    expect(kinds).toContain("PREFERRED");

    const reqs = doc.requirements.filter((r) => r.priority === "REQUIRED");
    const prefs = doc.requirements.filter((r) => r.priority === "PREFERRED");
    expect(reqs.length).toBeGreaterThanOrEqual(2);
    expect(prefs.length).toBeGreaterThanOrEqual(1);
  });

  it("parses Ashby posting JSON fixture with nested jobPosting descriptionHtml", () => {
    const raw = fs.readFileSync(path.join(fixturesDir, "ashby-posting.json"), "utf8");
    const json = JSON.parse(raw);

    const doc = parseJobDescriptionDocument({
      rawJson: json,
      sourceUrl: "https://jobs.ashbyhq.com/linear/ashby-job-90418",
    });

    expect(doc.sourceKind).toBe("ASHBY");
    expect(doc.diagnostics.status).toBe("VERIFIED_ATS");

    const kinds = doc.sections.map((s) => s.kind);
    expect(kinds).toContain("ABOUT_COMPANY");
    expect(kinds).toContain("RESPONSIBILITIES");
    expect(kinds).toContain("REQUIRED");
    expect(kinds).toContain("PREFERRED");

    const certReq = doc.requirements.find((r) => r.sourceQuote.includes("AWS Certified"));
    expect(certReq?.category).toBe("CERTIFICATION");
  });

  it("parses JSON-LD schema JobPosting script tags from HTML documents", () => {
    const html = fs.readFileSync(path.join(fixturesDir, "jsonld-jobposting.html"), "utf8");

    const doc = parseJobDescriptionDocument({
      html,
      sourceUrl: "https://techcorp.example.com/careers/ai-engineer",
    });

    expect(doc.sourceKind).toBe("JSON_LD");
    expect(doc.diagnostics.status).toBe("STRUCTURED_PAGE");
    expect(doc.sections.length).toBeGreaterThanOrEqual(3);

    const reqs = doc.requirements;
    expect(reqs.length).toBeGreaterThanOrEqual(3);
  });

  it("detects SPA shell and emits partial extraction warning for sparse HTML", () => {
    const html = fs.readFileSync(path.join(fixturesDir, "spa-shell.html"), "utf8");

    const doc = parseJobDescriptionDocument({
      html,
      sourceUrl: "https://careers.portal.example.com",
    });

    expect(doc.sourceKind).toBe("HTML");
    expect(doc.diagnostics.warnings.length).toBeGreaterThanOrEqual(1);
    expect(doc.diagnostics.warnings[0]).toContain("SPA shell");
  });

  it("parses generic HTML with page noise, extracting clean sections and requirements", () => {
    const html = fs.readFileSync(path.join(fixturesDir, "generic-page-noise.html"), "utf8");

    const doc = parseJobDescriptionDocument({
      html,
      sourceUrl: "https://enterprise.example.com/careers/infra-architect",
    });

    expect(doc.sourceKind).toBe("HTML");
    expect(doc.sections.length).toBeGreaterThanOrEqual(3);

    const kinds = doc.sections.map((s) => s.kind);
    expect(kinds).toContain("ABOUT_COMPANY");
    expect(kinds).toContain("RESPONSIBILITIES");
    expect(kinds).toContain("REQUIRED");
    expect(kinds).toContain("PREFERRED");

    const expReq = doc.requirements.find((r) => r.sourceQuote.includes("10+ years"));
    expect(expReq).toBeDefined();
    expect(expReq?.category).toBe("EXPERIENCE");
    expect(expReq?.priority).toBe("REQUIRED");
  });

  it("safely handles malformed broken HTML tags without throwing or crashing", () => {
    const html = fs.readFileSync(path.join(fixturesDir, "malformed-description.html"), "utf8");

    const doc = parseJobDescriptionDocument({
      html,
      sourceUrl: "https://malformed.example.com/job",
    });

    expect(doc).toBeDefined();
    expect(doc.sections.length).toBeGreaterThanOrEqual(1);
    expect(doc.requirements.length).toBeGreaterThanOrEqual(1);
    expect(doc.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("creates user-added requirements with confidence: USER_ADDED", () => {
    const userReq = createUserRequirement(
      "Demonstrated experience with Kafka event streaming",
      "DOMAIN",
      "REQUIRED"
    );

    expect(userReq.confidence).toBe("USER_ADDED");
    expect(userReq.category).toBe("DOMAIN");
    expect(userReq.priority).toBe("REQUIRED");
    expect(userReq.sourceQuote).toBe("Demonstrated experience with Kafka event streaming");
    expect(userReq.sourceSectionId).toBe("user-defined");
  });

  it("computes deterministic content hashes that change when text changes", () => {
    const hashA = computeContentHash("Senior Backend Engineer at Acme Corp");
    const hashB = computeContentHash("Senior Backend Engineer at Acme Corp");
    const hashC = computeContentHash("Staff Backend Engineer at Acme Corp");

    expect(hashA).toBe(hashB);
    expect(hashA).not.toBe(hashC);
    expect(hashA).toMatch(/^[0-9a-f]{64}$/);
  });

  it("accurately classifies diverse section heading aliases", () => {
    expect(classifySectionHeading("What you'll do at Stripe")).toBe("RESPONSIBILITIES");
    expect(classifySectionHeading("Minimum qualifications")).toBe("REQUIRED");
    expect(classifySectionHeading("What you bring")).toBe("REQUIRED");
    expect(classifySectionHeading("Nice to have")).toBe("PREFERRED");
    expect(classifySectionHeading("Bonus Points")).toBe("PREFERRED");
    expect(classifySectionHeading("Salary & Compensation")).toBe("COMPENSATION");
    expect(classifySectionHeading("Perks & Benefits")).toBe("BENEFITS");
    expect(classifySectionHeading("About Us")).toBe("ABOUT_COMPANY");
  });

  it("accurately classifies requirement categories", () => {
    expect(classifyRequirementCategory("5+ years of experience with Go")).toBe("EXPERIENCE");
    expect(classifyRequirementCategory("B.S. in Computer Science or related")).toBe("EDUCATION");
    expect(classifyRequirementCategory("AWS Certified Security Specialist")).toBe("CERTIFICATION");
    expect(classifyRequirementCategory("Deep knowledge of distributed systems and latency SLAs")).toBe("DOMAIN");
    expect(classifyRequirementCategory("Proficiency in TypeScript and React")).toBe("SKILL");
  });
});
