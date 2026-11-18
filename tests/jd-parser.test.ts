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

  it("keeps inline preferred skills out of the required skill list", () => {
    const posting = "Platform engineer. Required skills: TypeScript and PostgreSQL. Preferred skills: AWS.";
    const result = parseJobDescription(posting);
    expect(result.requiredSkills).toEqual(expect.arrayContaining(["TypeScript", "PostgreSQL"]));
    expect(result.requiredSkills).not.toContain("AWS");
    expect(result.preferredSkills).toContain("AWS");
  });

  it("splits one-line Nice-to-have, Preferred, and Bonus clauses after delimiters and handles Preferred qualifications", () => {
    const afterPeriod =
      "Backend role. Required: TypeScript, PostgreSQL. Nice to have: AWS, Docker, Kubernetes, GraphQL, Go, Redis, Python, Rust.";
    const res1 = parseJobDescription(afterPeriod);
    expect(res1.requiredSkills).toEqual(expect.arrayContaining(["TypeScript", "PostgreSQL"]));
    expect(res1.requiredSkills).not.toContain("AWS");
    expect(res1.requiredSkills).not.toContain("Kubernetes");
    expect(res1.preferredSkills).toEqual(expect.arrayContaining(["AWS", "Docker", "Kubernetes", "GraphQL"]));

    const afterDelimiters = "Required: React and Node.js; Preferred: Terraform | Bonus: Rust";
    const res2 = parseJobDescription(afterDelimiters);
    expect(res2.requiredSkills).toEqual(expect.arrayContaining(["React", "Node.js"]));
    expect(res2.requiredSkills).not.toContain("Terraform");
    expect(res2.requiredSkills).not.toContain("Rust");
    expect(res2.preferredSkills).toEqual(expect.arrayContaining(["Terraform", "Rust"]));

    const hyphenated = parseJobDescription("Required: Python, SQL. Nice-to-have: AWS, Docker.");
    expect(hyphenated.requiredSkills).toEqual(expect.arrayContaining(["Python", "SQL"]));
    expect(hyphenated.requiredSkills).not.toContain("AWS");
    expect(hyphenated.preferredSkills).toEqual(expect.arrayContaining(["AWS", "Docker"]));

    const preferredQuals = parseJobDescription("Preferred qualifications: Kubernetes, Terraform.");
    expect(preferredQuals.preferredSkills).toEqual(expect.arrayContaining(["Kubernetes", "Terraform"]));
    expect(preferredQuals.requiredSkills).toEqual([]);
  });

  it("does not flip subsequent skills to preferred when prose mentions Annual bonus", () => {
    const multiLineProse = `
      Required: Python, SQL.
      Annual bonus: 15% + equity.
      Experience with Docker and Kubernetes.
    `;
    const resMulti = parseJobDescription(multiLineProse);
    expect(resMulti.requiredSkills).toEqual(
      expect.arrayContaining(["Python", "SQL", "Docker", "Kubernetes"])
    );
    expect(resMulti.preferredSkills).toEqual([]);

    const inlineProse =
      "Required: Python, SQL. Annual bonus: 15% + equity. Experience with Docker.";
    const resInline = parseJobDescription(inlineProse);
    expect(resInline.requiredSkills).toEqual(expect.arrayContaining(["Python", "SQL", "Docker"]));
    expect(resInline.preferredSkills).toEqual([]);

    const unsectionedBonusProse =
      "We offer competitive pay and an annual bonus: 15% + equity. Experience with Docker.";
    const resUnsectioned = parseJobDescription(unsectionedBonusProse);
    expect(resUnsectioned.requiredSkills).toContain("Docker");
    expect(resUnsectioned.preferredSkills).toEqual([]);
  });

  it("outputs valid JobRequirements matching Zod schema", () => {
    const result = parseJobDescription(backendJD);
    const parsed = JobRequirementsSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });
});
