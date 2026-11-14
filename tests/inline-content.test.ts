import { describe, expect, it } from "vitest";
import { createInlineRenderer, renderInlineContent, safeDestination } from "@/lib/typst/inline-content";

describe("source-backed inline contact links", () => {
  it("links combined contact fields without losing phone, location, or separators", () => {
    const value = "Toronto, ON | jane@example.com | (555) 010-1234 | linkedin.com/in/jane";
    const { content } = renderInlineContent(value);
    expect(content).toContain("Toronto, ON | ");
    expect(content).toContain('#link("mailto:jane@example.com")[jane\\@example.com]');
    expect(content).toContain(" | (555) 010\\-1234 | ");
    expect(content).toContain('#link("https://linkedin.com/in/jane")[linkedin.com\\/in\\/jane]');
  });
  it("matches verified annotation labels and emits unmatched annotations with their labels", () => {
    const renderer = createInlineRenderer([{ url: "https://example.com/work", label: "Portfolio" }, { url: "https://github.com/jane", label: "GitHub" }]);
    expect(renderer.render("Jane | Portfolio")).toBe('Jane | #link("https://example.com/work")[Portfolio]');
    expect(renderer.renderRemaining()).toEqual(['#link("https://github.com/jane")[GitHub]']);
  });
  it("links each destination only once and keeps other visible labels", () => {
    const renderer = createInlineRenderer([{ url: "https://example.com/", label: "Home" }, { url: "https://example.com/", label: "Portfolio" }]);
    expect(renderer.render("Home | Portfolio")).toBe('#link("https://example.com/")[Home] | Portfolio');
    expect(renderer.renderRemaining()).toEqual([]);
  });
  it("keeps unsafe annotation destinations inactive and reports them", () => {
    const renderer = createInlineRenderer([
      { url: "javascript:alert(1)", label: "Portfolio" },
      { url: "vbscript:msgbox(1)", label: "VB" },
      { url: "file:///secret" },
      { url: "https://safe.example/cv", label: "CV" },
    ]);
    expect(renderer.render("Portfolio | VB | CV")).toBe(
      'Portfolio | VB | #link("https://safe.example/cv")[CV]'
    );
    expect(renderer.renderRemaining()).toEqual(["file:\\/\\/\\/secret"]);
    expect(renderer.issues).toHaveLength(3);
  });
  it("escapes candidate markup and only applies explicit validated emphasis spans", () => {
    const renderer = createInlineRenderer();
    expect(renderer.render('Hi #eval("danger") [x] *text*')).toBe('Hi \\#eval("danger") \\[x\\] \\*text\\*');
    expect(renderer.render("Strong text", [{ start: 0, end: 6, kind: "bold" }])).toBe("#strong[Strong] text");
    expect(() => renderer.render("short", [{ start: 0, end: 100, kind: "bold" }])).toThrow();
  });

  it("validates only safe HTTP(S) and mailto destinations via safeDestination", () => {
    expect(safeDestination("https://example.com")).toBe("https://example.com/");
    expect(safeDestination("mailto:alex@example.com")).toBe("mailto:alex@example.com");
    expect(safeDestination("javascript:alert(1)")).toBeNull();
    expect(safeDestination("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeDestination("file:///etc/passwd")).toBeNull();
    expect(safeDestination("https://user:pass@example.com/")).toBeNull();
    expect(safeDestination("https://example.com/\r\ninjected")).toBeNull();
  });
});
