import { describe, expect, it } from "vitest";
import { assertLayoutExportReady, buildResumeDocument, renderResumeDocument } from "@/lib/typst/resume-document";

describe("unresolved link export guard", () => {
  it("requires measurement and refuses unresolved placement even with review approval", () => {
    const source = renderResumeDocument(buildResumeDocument("Morgan Example\nProjects\nAtlas | GitHub\nBeacon | GitHub"), "comfortable", [
      { label: "GitHub", url: "https://example.test/one" },
      { label: "GitHub", url: "https://example.test/two" },
    ]);
    expect(source).toContain("// @layout-v2-link-placement-required");
    expect(() => assertLayoutExportReady(source)).toThrow(/measure/);
    expect(() => assertLayoutExportReady(source, { source, pages: 1 }, null, source)).toThrow(/Place the unresolved PDF links/);
  });
  it("allows a measured source with resolved links", () => {
    const source = renderResumeDocument(buildResumeDocument("Morgan Example\nmorgan@example.test", [
      { kind: "name", span: { start: 0, end: 14 } },
      { kind: "contact", span: { start: 15, end: 34 } },
    ]));
    expect(() => assertLayoutExportReady(source, { source, pages: 1 })).not.toThrow();
  });
});
