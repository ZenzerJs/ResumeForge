import { describe, expect, it } from "vitest";
import { buildResumeDocument, parseManagedResume, renderResumeDocument } from "@/lib/typst/resume-document";
import { renderPreviousResumeDocument } from "@/lib/typst/resume-document-v2-previous";
import { renderLegacyResumeDocument } from "@/lib/typst/resume-document-v2-legacy";
import { managedResumeExport } from "@/lib/export/resume-text";
import { classifyPdfTextFallback } from "@/lib/pdf/parser";

const rows = [
  ["name", "Morgan Example"],
  ["contact", "Portland | (555) 010-1234 | morgan@example.test | morgan@example.test | Other text"],
  ["section", "Experience"], ["entry-title", "Northwind"], ["entry-role", "Engineer"], ["bullet", "- Built tools"],
  ["entry-title", "Contoso"], ["entry-role", "Developer"], ["bullet", "- Improved systems"],
  ["section", "Education"], ["entry-title", "Example University"], ["entry-role", "Computer Science"],
  ["section", "Projects"], ["entry-title", "Atlas | GitHub | Live Demo"], ["bullet", "- Built Atlas"],
  ["entry-title", "Beacon | GitHub | Live Demo"], ["bullet", "- Built Beacon"],
  ["entry-title", "Cedar | GitHub | Live Demo"], ["bullet", "- Built Cedar"],
  ["section", "Skills"], ["skill", "Languages: TypeScript, Python"],
] as const;
const source = rows.map((row) => row[1]).join("\n");
let position = 0;
const assignments = rows.map(([kind, text]) => { const start = position; position += text.length + 1; return { kind, span: { start, end: start + text.length } }; });
const document = buildResumeDocument(source, assignments);
const spanIn = (entry: string, label: string) => { const start = source.indexOf(entry) + entry.indexOf(label); return { start, end: start + label.length }; };
const links = [
  { label: "GitHub", url: "https://github.com/example/atlas", span: spanIn("Atlas | GitHub | Live Demo", "GitHub") },
  { label: "Live Demo", url: "https://atlas.example.test", span: spanIn("Atlas | GitHub | Live Demo", "Live Demo") },
  { label: "GitHub", url: "https://github.com/example/beacon", span: spanIn("Beacon | GitHub | Live Demo", "GitHub") },
  { label: "Live Demo", url: "https://beacon.example.test", span: spanIn("Beacon | GitHub | Live Demo", "Live Demo") },
  { label: "GitHub", url: "https://github.com/example/cedar" },
  { label: "Live Demo", url: "https://cedar.example.test" },
];

describe("dense source-backed resume", () => {
  it("places span-backed links at the exact project and keeps ambiguous links for review", () => {
    const output = renderResumeDocument(document, "balanced", links);
    expect(output).toContain('Atlas | #link("https://github.com/example/atlas")[GitHub] | #link("https://atlas.example.test")[Live Demo]');
    expect(output).toContain('Beacon | #link("https://github.com/example/beacon")[GitHub] | #link("https://beacon.example.test")[Live Demo]');
    expect(output).toContain('Cedar | GitHub | Live Demo');
    expect(output).not.toContain('#section("Links requiring review")');
    expect(output).toContain("// @layout-v2-link-placement-required");
    expect(output).toContain('// @layout-v2-review-required');
    expect(parseManagedResume(output)?.document.source).toBe(source);
    expect(parseManagedResume(output.replace("Built Atlas", "Built altered"))).toBeNull();
    expect(output.split("// @resume-document-v2")[0].match(/morgan\\@example\.test/g)).toHaveLength(1);
    expect(output).toContain("Portland"); expect(output).toContain("Other text"); expect(output).toContain("(555) 010\\-1234");
  });
  it("accepts unchanged historical managed output and rejects stale historical metadata", () => {
    const old = renderLegacyResumeDocument(document, "comfortable", []);
    expect(parseManagedResume(old)?.document.source).toBe(source);
    expect(parseManagedResume(old.replace("Northwind", "Changed"))).toBeNull();
    const previous = renderPreviousResumeDocument(document, "balanced", links);
    expect(parseManagedResume(previous)?.document.source).toBe(source);
    expect(parseManagedResume(previous.replace("Northwind", "Changed"))).toBeNull();
  });
  it("exports visible entry content after a direct edit", () => {
    const output = renderResumeDocument(document, "balanced", links).replace("Built Atlas", "Built edited Atlas");
    expect(managedResumeExport(output)?.text).toContain("Atlas | GitHub (https://github.com/example/atlas) | Live Demo (https://atlas.example.test)");
  });
  it("deduplicates a verified portfolio address without discarding header details", () => {
    const raw = "Morgan Example\nPortland | 555-010-1234 | Portfolio\nwork.example.test/path\nExperience\n- Built tools";
    const doc = buildResumeDocument(raw, classifyPdfTextFallback(raw));
    expect(doc.header[2].kind).toBe("contact");
    const output = renderResumeDocument(doc, "comfortable", [{ url: "https://work.example.test/path", label: "Portfolio" }]);
    const visible = output.split("// @resume-document-v2")[0];
    expect(visible).toContain("Portland");
    expect(visible).toContain("555\\-010\\-1234");
    expect(visible).toContain('#link("https://work.example.test/path")[Portfolio]');
    expect(visible).not.toContain("work.example.test/path]");
    expect(doc.source).toBe(raw);
  });
  it("keeps competing destinations unresolved when they claim the same source label", () => {
    const span = spanIn("Atlas | GitHub | Live Demo", "GitHub");
    const output = renderResumeDocument(document, "comfortable", [
      { label: "GitHub", url: "https://example.test/one", span },
      { label: "GitHub", url: "https://example.test/two", span },
    ]);
    expect(output).toContain("Atlas | GitHub | Live Demo");
    expect(output).toContain("// @layout-v2-review-required");
    expect(output).toContain("// @layout-v2-link-placement-required");
    expect(parseManagedResume(output)?.links).toHaveLength(2);
  });
});
