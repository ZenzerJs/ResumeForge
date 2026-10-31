import { describe, expect, it } from "vitest";
import {
  buildResumeDocument,
  renderResumeDocument,
  ResumeDocumentSchema,
  validateAssignments,
  type ResumeAssignment,
} from "@/lib/typst/resume-document";

function lineAssignments(source: string, kinds: ResumeAssignment["kind"][]): ResumeAssignment[] {
  let start = 0;
  return source.split("\n").map((text, index) => {
    const span = { start, end: start + text.length };
    start = span.end + 1;
    return { kind: kinds[index], span };
  });
}

describe("Independent resume layout integrity audit", () => {
  it.each([
    null,
    [{ kind: "name", span: { start: 0, end: 4 }, text: "Invented" }],
    [{ kind: "name", span: { start: 0, end: 4 } }, { kind: "contact", span: { start: 0, end: 4 } }],
    [{ kind: "name", span: { start: 2, end: 20 } }],
    [{ kind: "name", span: { start: 2, end: 2 } }],
    [{ kind: "name", span: { start: -1, end: 2 } }],
  ])("rejects forged or invalid source assignments: %j", (assignments) => {
    expect(() => validateAssignments("Alex Rivera", assignments)).toThrow();
  });

  it("retains unclassified content with a review issue", () => {
    const source = "Alex Rivera\nCommunity service supporting local libraries.";
    const doc = buildResumeDocument(source, [{ kind: "name", span: { start: 0, end: 11 } }]);
    expect(doc.header.map((block) => block.text).join("\n")).toBe(source);
    expect(doc.issues.length).toBeGreaterThan(0);
    expect(renderResumeDocument(doc)).toContain("Community service supporting local libraries.");
  });

  it("rejects edited text that no longer matches extraction source", () => {
    const doc = buildResumeDocument("Alex Rivera", [{ kind: "name", span: { start: 0, end: 11 } }]);
    doc.header[0].text = "Invented Candidate";
    expect(ResumeDocumentSchema.safeParse(doc).success).toBe(false);
  });

  it("permits explicit section reorder without losing span validation", () => {
    const source = "Alex Rivera\nEducation\nState University\nExperience\nNorthwind Systems";
    const doc = buildResumeDocument(source, lineAssignments(source, ["name", "section", "paragraph", "section", "paragraph"]));
    doc.sections.reverse();
    expect(ResumeDocumentSchema.safeParse(doc).success).toBe(true);
    const rendered = renderResumeDocument(doc);
    expect(rendered.indexOf("Northwind Systems")).toBeLessThan(rendered.indexOf("State University"));
  });

  it("does not overwrite repeated entry-field assignments", () => {
    const source = "Alex Rivera\nExperience\nNorthwind Systems\nSoftware Engineer\nPlatform Lead\n- Built reliable systems.";
    const doc = buildResumeDocument(source, lineAssignments(source, ["name", "section", "entry-title", "entry-role", "entry-role", "bullet"]));
    const rendered = renderResumeDocument(doc);
    expect(rendered).toContain("Software Engineer");
    expect(rendered).toContain("Platform Lead");
    expect(rendered).toContain("Built reliable systems.");
  });

  it("preserves repeated and custom sections", () => {
    const source = "Alex Rivera\nPublications\nFirst article\nCommunity\nLibrary volunteering\nPublications\nSecond article";
    const doc = buildResumeDocument(source, lineAssignments(source, ["name", "section", "paragraph", "section", "paragraph", "section", "paragraph"]));
    expect(doc.sections.map((section) => section.heading.text)).toEqual(["Publications", "Community", "Publications"]);
    const rendered = renderResumeDocument(doc);
    for (const text of ["First article", "Library volunteering", "Second article"]) expect(rendered).toContain(text);
  });
});
