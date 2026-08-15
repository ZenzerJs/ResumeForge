import { describe, it, expect } from "vitest";
import { extractResumeFacts } from "@/lib/facts/extract";

describe("Confirm-Before-Master Flow", () => {
  it("previews extracted facts from draft Typst source accurately", () => {
    const draftSource = `
= Alex Smith
alex.smith@example.com | San Francisco, CA

== EXPERIENCE
*Stripe* | *Senior Backend Engineer* | *2021 – Present*
- Scaled database layer reducing p99 latency by 50ms across 20M requests.
- Mentored team of 5 engineers.

== EDUCATION
*Stanford University* | *B.S. Computer Science* | *2017 – 2021*

== SKILLS
- Languages: Python, TypeScript, Go
    `;

    const facts = extractResumeFacts(draftSource);

    expect(facts.employers.some((e) => e.normalized === "stripe")).toBe(true);
    expect(facts.titles.some((t) => t.normalized === "senior backend engineer")).toBe(true);
    expect(facts.skills).toContain("typescript");
    expect(facts.skills).toContain("python");
    expect(facts.skills).toContain("go");

    // Metrics check: 50ms and 20M are non-trivial; team of 5 is trivial
    const nonTrivial = facts.metrics.filter((m) => !m.isTrivial);
    expect(nonTrivial.some((m) => m.value === 50 && m.unit === "ms")).toBe(true);
    expect(nonTrivial.some((m) => m.value === 20 && m.unit.toLowerCase() === "m")).toBe(true);

    const trivial = facts.metrics.filter((m) => m.isTrivial);
    expect(trivial.some((m) => m.value === 5)).toBe(true);
  });
});
