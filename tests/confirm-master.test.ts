import { describe, it, expect } from "vitest";
import { extractResumeFacts } from "@/lib/facts/extract";
import { computeLineDiff } from "@/lib/diff/simple-diff";

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

  it("calculates source diff against prior baseline with change statistics", () => {
    const priorSource = `
= Alex Smith
== EXPERIENCE
*Google* | *Software Engineer* | *2019 – 2021*
- Maintained distributed systems.
    `;

    const draftSource = `
= Alex Smith
== EXPERIENCE
*Stripe* | *Senior Backend Engineer* | *2021 – Present*
- Scaled database layer reducing p99 latency by 50ms across 20M requests.
- Mentored team of 5 engineers.
    `;

    const diff = computeLineDiff(priorSource, draftSource);

    expect(diff.stats.addedCount).toBeGreaterThan(0);
    expect(diff.stats.deletedCount).toBeGreaterThan(0);
    expect(diff.lines.some((l) => l.type === "add" && l.text.includes("Stripe"))).toBe(true);
    expect(diff.lines.some((l) => l.type === "delete" && l.text.includes("Google"))).toBe(true);
  });

  it("identifies when there are no source diff changes against existing baseline", () => {
    const source = "= Alex Smith\n== SKILLS\n- TypeScript, Python";
    const diff = computeLineDiff(source, source);

    expect(diff.stats.addedCount).toBe(0);
    expect(diff.stats.deletedCount).toBe(0);
    expect(diff.stats.unchangedCount).toBe(3);
  });

  it("identifies initial baseline creation when priorSource is empty or null", () => {
    const newSource = "= Alex Smith\n== EXPERIENCE\n*Stripe*";
    const diff = computeLineDiff("", newSource);

    expect(diff.stats.addedCount).toBe(3);
    expect(diff.stats.deletedCount).toBe(0);
    expect(diff.stats.unchangedCount).toBe(0);
  });
});
