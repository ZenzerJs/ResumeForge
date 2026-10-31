import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildResumeDocument, renderResumeDocument } from "@/lib/typst/resume-document";
import { classifyPdfTextFallback } from "@/lib/pdf/parser";
import { cleanTypstToText } from "@/lib/export/zip";
import { generateAtsDocx } from "@/lib/export/docx";
import { applyPatchProposals } from "@/lib/ai/patch-application";
import { readFileSync } from "node:fs";
import { legacyFormToResumeDocument, parseTypstToStructuredModel } from "@/components/editor/resume-form-builder";

const raw = "Morgan Sample\nmorgan@example.com\nExperience\nNorthwind Health Systems Mississauga, ON\nIT Operations May 2026 - Present\n- Supported systems\nAwards\nWon a prize";
const source = renderResumeDocument(buildResumeDocument(raw, classifyPdfTextFallback(raw)), "comfortable", [{ url: "https://example.com/portfolio", label: "Portfolio" }]);

describe("managed resume text exports", () => {
  it("outputs source content and annotation links rather than metadata or template", () => {
    const text = cleanTypstToText(source);
    expect(text).toContain(raw);
    expect(text).toContain("Portfolio: https://example.com/portfolio");
    expect(text).not.toContain("@resume-document-v2");
    expect(text).not.toContain("#let entry");
  });
  it("exports candidate entries and date into DOCX, excluding layout code", async () => {
    const bytes = await generateAtsDocx(source);
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file("word/document.xml")!.async("string");
    for (const value of ["Morgan Sample", "Northwind Health Systems", "Mississauga, ON", "IT Operations", "May 2026 - Present", "Supported systems", "Won a prize", "https://example.com/portfolio"]) expect(xml).toContain(value);
    expect(xml).not.toContain("@resume-document-v2");
    expect(xml).not.toContain("#let entry");
  });
  it("never trusts stale metadata and removes metadata comments from unmanaged text", () => {
    const changed = source.replace("Northwind Health Systems", "Changed Employer");
    const text = cleanTypstToText(changed);
    expect(text).not.toContain("@resume-document-v2");
    expect(text).not.toContain("Morgan%20Sample");
    expect(text).toContain("Changed Employer");
  });
  it("exports the current accepted patch from visible source rather than stale metadata", async () => {
    const patched = applyPatchProposals(source, [{ id: "p1", operation: "MODIFY_BULLET", targetSection: "experience", before: "Supported systems", after: "Built reliable systems", evidenceIds: ["e1"], rationale: "Verified", confidence: 1 }]).typstSource;
    const text = cleanTypstToText(patched);
    const zip = await JSZip.loadAsync(await generateAtsDocx(patched));
    const xml = await zip.file("word/document.xml")!.async("string");
    for (const output of [text, xml]) {
      expect(output).toContain("Built reliable systems");
      expect(output).toContain("Northwind Health Systems");
      expect(output).toContain("May 2026 - Present");
      expect(output).not.toContain("Supported systems");
      expect(output).not.toContain("@resume-document-v2");
      expect(output).not.toContain("#let entry");
    }
  });
  it("refuses unsupported edited managed syntax rather than silently losing content", () => {
    const changed = source.replace("Supported systems", "#unknown[Supported systems]");
    expect(() => cleanTypstToText(changed)).toThrow(/unsupported Typst/);
  });
  it("preserves links-only source data after a patch and rejects malformed link data", () => {
    const edited = source.replace("Supported systems", "Improved systems");
    expect(cleanTypstToText(edited)).toContain("https://example.com/portfolio");
    expect(cleanTypstToText(edited)).not.toContain("Supported systems");
    const malformed = edited.replace(/^\/\/ @resume-links-v2 .+$/m, "// @resume-links-v2 invalid!");
    expect(() => cleanTypstToText(malformed)).toThrow(/malformed PDF link data/);
  });
  it("exports a patched shared starter with contacts, skills, and a verified annotation link", async () => {
    const starter = readFileSync("public/templates/starter-resume.typ", "utf8");
    const model = parseTypstToStructuredModel(starter);
    const managed = renderResumeDocument(legacyFormToResumeDocument(model), "comfortable", [{ url: "https://example.com/work", label: "Portfolio" }]);
    const bullet = managed.match(/^- .+$/m)?.[0];
    expect(bullet).toBeTruthy();
    expect(managed).toContain("#box[");
    expect(managed).toContain("#block(above: 0.35em, below: 0.15em)[#strong[");
    const patched = applyPatchProposals(managed, [{ id: "starter", operation: "MODIFY_BULLET", targetSection: "experience", before: bullet!, after: "- Crafted verified systems", evidenceIds: ["e1"], rationale: "Verified", confidence: 1 }]).typstSource;
    const text = cleanTypstToText(patched);
    const zip = await JSZip.loadAsync(await generateAtsDocx(patched));
    const xml = await zip.file("word/document.xml")!.async("string");
    for (const output of [text, xml]) {
      expect(output).toContain("Crafted verified systems");
      expect(output).toContain(model.email);
      expect(output).toContain(model.skills[0].category);
      expect(output).toContain("https://example.com/work");
      expect(output).not.toContain("#box[");
      expect(output).not.toContain("#block(");
      expect(output).not.toContain("@resume-document-v2");
    }
  });
});
