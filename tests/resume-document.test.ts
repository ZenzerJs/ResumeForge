import { describe, expect, it } from "vitest";
import { buildResumeDocument, renderResumeDocument, typstContent, typstString, validateAssignments } from "@/lib/typst/resume-document";

describe("source-backed resume layout", () => {
  it("accepts only non-overlapping source spans and rejects supplied text", () => {
    expect(validateAssignments("one two", [{ kind: "paragraph", span: { start: 0, end: 3 } }])).toHaveLength(1);
    expect(() => validateAssignments("one", [{ kind: "paragraph", span: { start: 0, end: 3 } }, { kind: "bullet", span: { start: 0, end: 3 } }])).toThrow();
    expect(() => validateAssignments("one", [{ kind: "paragraph", span: { start: 0, end: 4 } }])).toThrow();
    expect(() => validateAssignments("one", [{ kind: "paragraph", span: { start: 0, end: 3 }, text: "invented" }])).toThrow();
  });
  it("retains unassigned and repeated sections, and rejects stale text", () => {
    const source = "Awards\nUnclassified\nAwards";
    const doc = buildResumeDocument(source, [{ kind: "section", span: { start: 0, end: 6 } }, { kind: "section", span: { start: 20, end: 26 } }], "a4");
    expect(doc.issues).toHaveLength(1);
    const output = renderResumeDocument(doc);
    expect(output.match(/Awards/g)).toHaveLength(2);
    expect(output).toContain("Unclassified");
    expect(output).toContain('paper: "a4"');
    doc.sections[0].blocks[0].text = "invented";
    expect(() => renderResumeDocument(doc)).toThrow();
  });
  it("escapes content separately from strings", () => {
    expect(typstString('a"b')).toBe('"a\\"b"');
    expect(typstContent('a#b[c]')).toBe('a\\#b\\[c\\]');
  });
});

it("rejects empty source and spans splitting surrogate pairs", () => {
  expect(() => buildResumeDocument("  ")).toThrow();
  expect(() => validateAssignments("A😀B", [{ kind: "paragraph", span: { start: 1, end: 2 } }])).toThrow();
  expect(() => validateAssignments("A😀B", [{ kind: "paragraph", span: { start: 2, end: 3 } }])).toThrow();
});

it("retains clickable annotations in bullets and entry labels", () => {
  const source = "Project\nPortfolio";
  const document = buildResumeDocument(source, [
    { kind: "entry-title", span: { start: 0, end: 7 } },
    { kind: "bullet", span: { start: 8, end: 17 } },
  ]);
  const rendered = renderResumeDocument(document, "comfortable", [
    { url: "https://project.example", label: "Project" },
    { url: "https://portfolio.example", label: "Portfolio" },
  ]);
  expect(rendered).toContain('#link("https://portfolio.example")[Portfolio]');
  expect(rendered).toContain('#link("https://project.example")[Project]');
});

it("groups contact items and styles skills and entry rows without changing content", () => {
  const source = "Jane\nParis\njane@example.com\nSkills\nLanguages: TypeScript";
  const doc = buildResumeDocument(source, [
    { kind: "name", span: { start: 0, end: 4 } },
    { kind: "contact", span: { start: 5, end: 10 } },
    { kind: "contact", span: { start: 11, end: 27 } },
    { kind: "section", span: { start: 28, end: 34 } },
    { kind: "skill", span: { start: 35, end: 56 } },
  ]);
  const rendered = renderResumeDocument(doc);
  expect(rendered).toContain("#box[Paris] #sym.dot #box[");
  expect(rendered).toContain("#strong[Languages:] TypeScript");
  expect(rendered).toContain("#emph(role)");
});

it("renders wrapped bullet and skill spans as continuous text while retaining source", () => {
  const source = "Experience\n- Built robust\n  cloud services\nSkills\nLanguages: TypeScript,\n  Python";
  const assignments = [
    { kind: "section", span: { start: 0, end: 10 } },
    { kind: "bullet", span: { start: 11, end: 42 } },
    { kind: "section", span: { start: 43, end: 49 } },
    { kind: "skill", span: { start: 50, end: source.length } },
  ];
  const doc = buildResumeDocument(source, assignments);
  const output = renderResumeDocument(doc);
  expect(doc.source).toBe(source);
  expect(output).toContain("- Built robust cloud services");
  expect(output).toContain("#strong[Languages:] TypeScript, Python");
});
