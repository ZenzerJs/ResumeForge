import { describe, it, expect } from "vitest";
import { convertTextToTypst } from "@/lib/pdf/parser";
import { reorderTypstSections } from "@/lib/typst/section-order";
import { ensureTypstLinks } from "@/lib/typst/ensure-links";
import { sanitizeTypstSource } from "@/lib/typst/sanitizer";

describe("PDF → Typst section order & links", () => {
  it("fallback converter emits Experience → Education → Projects → Skills", () => {
    const sampleText = `Alex Mercer
alex@example.com

Skills
Python, TypeScript

Projects
ResumeForge

Education
UC Berkeley

Experience
Acme Corp
- Built APIs
`;

    const typst = convertTextToTypst(sampleText);
    const exp = typst.indexOf("== Experience");
    const edu = typst.indexOf("== Education");
    const proj = typst.indexOf("== Projects");
    const skills = typst.indexOf("== Skills");

    expect(exp).toBeGreaterThan(-1);
    expect(edu).toBeGreaterThan(exp);
    expect(proj).toBeGreaterThan(edu);
    expect(skills).toBeGreaterThan(proj);
  });

  it("normalizes EXPERIENCE / Technical Skills aliases", () => {
    const typst = convertTextToTypst(`Name
EXPERIENCE
Role
Technical Skills
Python
`);
    expect(typst).toContain("== Experience");
    expect(typst).toContain("== Skills");
    expect(typst).not.toContain("== EXPERIENCE");
    expect(typst).not.toContain("== Technical Skills");
  });

  it("reorderTypstSections enforces canonical order for #section blocks", () => {
    const disordered = `#align(center)[Name]

#section("Skills")
#entry(details: [- Python])

#section("Projects")
#entry(title: "App")

#section("Education")
#entry(title: "Uni")

#section("Experience")
#entry(title: "Corp")
`;
    const ordered = reorderTypstSections(disordered);
    const exp = ordered.indexOf('#section("Experience")');
    const edu = ordered.indexOf('#section("Education")');
    const proj = ordered.indexOf('#section("Projects")');
    const skills = ordered.indexOf('#section("Skills")');

    expect(exp).toBeGreaterThan(-1);
    expect(edu).toBeGreaterThan(exp);
    expect(proj).toBeGreaterThan(edu);
    expect(skills).toBeGreaterThan(proj);
  });

  it("sanitizeTypstSource reorders sections via reorderTypstSections", () => {
    const dirty = `#section("Skills")
x
#section("Experience")
y
#section("Education")
z
#section("Projects")
p
`;
    const clean = sanitizeTypstSource(dirty);
    expect(clean.indexOf('#section("Experience")')).toBeLessThan(
      clean.indexOf('#section("Education")')
    );
    expect(clean.indexOf('#section("Education")')).toBeLessThan(
      clean.indexOf('#section("Projects")')
    );
    expect(clean.indexOf('#section("Projects")')).toBeLessThan(
      clean.indexOf('#section("Skills")')
    );
  });

  it("ensureTypstLinks injects missing scraped URLs", () => {
    const source = `#align(center)[
  #text(size: 18pt)[Alex]
]`;
    const withLinks = ensureTypstLinks(source, [
      { url: "https://linkedin.com/in/alex", label: "LinkedIn" },
      { url: "mailto:alex@example.com", label: "alex@example.com" },
    ]);
    expect(withLinks).toContain('#link("https://linkedin.com/in/alex")[LinkedIn]');
    expect(withLinks).toContain('#link("mailto:alex@example.com")');
  });
});
