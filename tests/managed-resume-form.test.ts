import { describe, expect, it } from "vitest";
import { buildResumeDocument, parseManagedResume, renderResumeDocument, updateResumeBlock } from "@/lib/typst/resume-document";

describe("managed resume form safety", () => {
  it("retains linked annotations and rejects stale embedded data after a patch", () => {
    const doc = buildResumeDocument("Jane\nSkills\nTypeScript", [
      { kind: "name", span: { start: 0, end: 4 } },
      { kind: "section", span: { start: 5, end: 11 } },
      { kind: "skill", span: { start: 12, end: 22 } },
    ]);
    const links = [{ url: "https://example.com", label: "Portfolio" }];
    const source = renderResumeDocument(doc, "comfortable", links);
    expect(parseManagedResume(source)?.links).toEqual(links);
    expect(parseManagedResume(source.replace("TypeScript", "JavaScript"))).toBeNull();
    const updated = updateResumeBlock(doc, { start: 12, end: 22 }, "Rust");
    const rendered = renderResumeDocument(updated, "comfortable", links);
    expect(rendered).toContain("Rust");
    expect(parseManagedResume(rendered)?.links).toEqual(links);
  });
});

it("orders requested presets and preserves remaining research sections", async () => {
  const { presetSectionOrder } = await import("@/components/editor/managed-resume-form");
  const titles = ["Awards", "Projects", "Skills", "Experience", "Summary", "Education", "Research Experience", "Publications"];
  const sections = titles.map((text) => ({ heading: { text } }));
  expect(presetSectionOrder(sections, "professional").map((s) => s.heading.text)).toEqual(["Summary", "Experience", "Research Experience", "Skills", "Education", "Projects", "Awards", "Publications"]);
  expect(presetSectionOrder(sections, "research").map((s) => s.heading.text)).toEqual(["Education", "Research Experience", "Publications", "Awards", "Projects", "Skills", "Experience", "Summary"]);
});
