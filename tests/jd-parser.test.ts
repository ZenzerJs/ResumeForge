import { describe, it, expect } from "vitest";
import { parseJobDescription } from "@/lib/jd-parser/parser";
import { JobRequirementsSchema } from "@/lib/jd-parser/types";

describe("Deterministic JD Parser Unit Tests", () => {
  const backendJD = `
    Senior Backend Engineer
    Qualifications:
    - 5+ years of software development experience with Python, Node.js, and PostgreSQL.
    - Solid understanding of Docker and Redis.

    Preferred Qualifications:
    - Experience with GraphQL, Go, and Microservices.
  `;

  const frontendJD = `
    Frontend Developer
    Must Have:
    - TypeScript, React, Next.js, HTML, and CSS.
    - Experience with Vitest and Playwright.

    Nice to Have:
    - WebAssembly (WASM) and Tailwind CSS.
  `;

  const unsectionedJD = `
    Full Stack Engineer
    We need someone skilled in Rust, Docker, SQL, and System Design.
  `;

  it("extracts backend skills correctly categorized into required and preferred", () => {
    const result = parseJobDescription(backendJD);

    expect(result.requiredSkills).toContain("Python");
    expect(result.requiredSkills).toContain("Node.js");
    expect(result.requiredSkills).toContain("PostgreSQL");
    expect(result.requiredSkills).toContain("Docker");
    expect(result.requiredSkills).toContain("Redis");

    expect(result.preferredSkills).toContain("GraphQL");
    expect(result.preferredSkills).toContain("Go");

    expect(result.domainTerms).toContain("Microservices");
  });

  it("extracts frontend skills correctly categorized", () => {
    const result = parseJobDescription(frontendJD);

    expect(result.requiredSkills).toContain("TypeScript");
    expect(result.requiredSkills).toContain("React");
    expect(result.requiredSkills).toContain("Next.js");
    expect(result.requiredSkills).toContain("HTML");
    expect(result.requiredSkills).toContain("CSS");
    expect(result.requiredSkills).toContain("Vitest");
    expect(result.requiredSkills).toContain("Playwright");

    expect(result.preferredSkills).toContain("WebAssembly");
    expect(result.preferredSkills).toContain("Tailwind CSS");
  });

  it("defaults to required skills when no section headers exist", () => {
    const result = parseJobDescription(unsectionedJD);

    expect(result.requiredSkills).toContain("Rust");
    expect(result.requiredSkills).toContain("Docker");
    expect(result.requiredSkills).toContain("SQL");
    expect(result.domainTerms).toContain("System Design");
    expect(result.preferredSkills.length).toBe(0);
  });

  it("outputs valid JobRequirements matching Zod schema", () => {
    const result = parseJobDescription(backendJD);
    const parsed = JobRequirementsSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });
});
