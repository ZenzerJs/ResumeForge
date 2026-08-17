import { describe, it, expect } from "vitest";
import {
  normalizeJob,
  parseLocation,
  inferEmploymentType,
  stripBoilerplate,
} from "@/lib/ingestion/normalize-job";

describe("WS1.3 — Universal Job Normalizer", () => {
  it("parses Canadian cities and sets geographic coordinates", () => {
    const locToronto = parseLocation("Toronto, ON");
    expect(locToronto?.city).toBe("Toronto");
    expect(locToronto?.region).toBe("ON");
    expect(locToronto?.country).toBe("Canada");
    expect(locToronto?.lat).toBeCloseTo(43.6532, 2);
    expect(locToronto?.lng).toBeCloseTo(-79.3832, 2);
    expect(locToronto?.isRemote).toBe(false);

    const locVancouverRemote = parseLocation("Vancouver, BC (Remote eligible)");
    expect(locVancouverRemote?.city).toBe("Vancouver");
    expect(locVancouverRemote?.region).toBe("BC");
    expect(locVancouverRemote?.isRemote).toBe(true);
  });

  it("identifies remote workplaces correctly", () => {
    const loc = parseLocation("Remote - Anywhere in Canada");
    expect(loc?.isRemote).toBe(true);

    const locWfh = parseLocation("Work from home / Waterloo, ON");
    expect(locWfh?.isRemote).toBe(true);
    expect(locWfh?.city).toBe("Waterloo");
  });

  it("infers employment types reliably", () => {
    expect(inferEmploymentType("Software Engineering Intern (Summer 2025)", "Join our team...")).toBe(
      "intern"
    );
    expect(inferEmploymentType("Full Stack Co-op Developer", "Requirements...")).toBe("intern");
    expect(inferEmploymentType("Senior Backend Contractor", "Contract role...")).toBe("contract");
    expect(inferEmploymentType("Lead Platform Engineer", "Full-time permanent role")).toBe(
      "full_time"
    );
  });

  it("strips EEO and diversity boilerplate into separate metadata", () => {
    const rawText = `
Role: Senior Go Developer
We are looking for a Go engineer to build high-scale APIs.

Equal Opportunity Employer:
Acme Corp is an Equal Opportunity Employer. All qualified applicants will receive consideration for employment without regard to race, color, religion, sex, sexual orientation, gender identity, national origin, or protected veteran status.

Requirements:
- 4+ years Go experience
- PostgreSQL query optimization
`;

    const { cleanText, boilerplate } = stripBoilerplate(rawText);
    expect(boilerplate).not.toBeNull();
    expect(boilerplate).toContain("Equal Opportunity Employer");
    expect(cleanText).not.toContain("All qualified applicants will receive consideration");
    expect(cleanText).toContain("4+ years Go experience");
  });

  it("normalizes a full job posting payload with skills and requirements", () => {
    const sampleDesc = `
Company: CloudScale
Title: Distributed Systems Engineer
Location: Montreal, QC

About the role:
We need a distributed systems developer experienced in Go, Docker, Kubernetes, and PostgreSQL.
Preferred: AWS and Terraform.
`;

    const normalized = normalizeJob({
      descriptionText: sampleDesc,
      source: "ats_greenhouse",
      sourceUrl: "https://boards.greenhouse.io/cloudscale/jobs/123",
      locationRaw: "Montreal, QC",
    });

    expect(normalized.source).toBe("ats_greenhouse");
    expect(normalized.sourceUrl).toBe("https://boards.greenhouse.io/cloudscale/jobs/123");
    expect(normalized.location?.city).toBe("Montreal");
    expect(normalized.location?.region).toBe("QC");
    expect(normalized.location?.country).toBe("Canada");
    expect(normalized.skills).toEqual(
      expect.arrayContaining(["Go", "Docker", "Kubernetes", "PostgreSQL"])
    );
  });
});
