import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  createBlankResumeTypst,
  isResumeSourceSafeForForm,
  parseTypstToStructuredModel,
  serializeStructuredModelToTypst,
} from "@/components/editor/resume-form-builder";
import { convertTextToTypst } from "@/lib/pdf/parser";

describe("ResumeFormBuilder round-trip and safeToEdit", () => {
  const starter = fs.readFileSync(
    path.join(process.cwd(), "public/templates/starter-resume.typ"),
    "utf8"
  );

  it("allows editing public/templates/starter-resume.typ safely", () => {
    expect(isResumeSourceSafeForForm(starter)).toBe(true);
    const parsed = parseTypstToStructuredModel(starter);
    expect(parsed.fullName).toBe("Alex Morgan");
    expect(parsed.location).toBe("San Francisco, CA");
    expect(parsed.phone).toBe("(555) 019-2834");
    expect(parsed.skills.length).toBe(3);
    expect(parsed.skills[0]?.items).toContain("HTML/CSS");
  });

  it("round-trips T5 visual form edits without escaping corruption", () => {
    const base = parseTypstToStructuredModel(starter);
    const edited = {
      ...base,
      fullName: "Sarah Connor",
      location: "Berlin, Germany",
      phone: "+49 30 123456",
      summary: "Cybernetic defense engineer specializing in temporal resilience.",
    };
    const typst = serializeStructuredModelToTypst(edited);
    expect(typst).toContain("Sarah Connor");
    expect(typst).toContain("Berlin, Germany");
    expect(typst).toContain("+49 30 123456");
    expect(isResumeSourceSafeForForm(typst)).toBe(true);

    const reparsed = parseTypstToStructuredModel(typst);
    expect(reparsed.fullName).toBe("Sarah Connor");
    expect(reparsed.location).toBe("Berlin, Germany");
    expect(reparsed.phone).toBe("+49 30 123456");
    expect(reparsed.summary).toBe("Cybernetic defense engineer specializing in temporal resilience.");
  });

  it("does not misparse entry dates as phone when phone is empty", () => {
    const base = parseTypstToStructuredModel(starter);
    const edited = {
      ...base,
      phone: "",
      experience: base.experience.map((e, i) => (i === 0 ? { ...e, date: "2020-2024" } : e)),
    };
    const typst = serializeStructuredModelToTypst(edited);
    const reparsed = parseTypstToStructuredModel(typst);
    expect(reparsed.phone).toBe("");
    expect(isResumeSourceSafeForForm(typst)).toBe(true);
  });

  it("does not misparse phone as location when location and email are empty", () => {
    const base = parseTypstToStructuredModel(starter);
    const edited = {
      ...base,
      location: "",
      email: "",
      phone: "+49 30 123456",
    };
    const typst = serializeStructuredModelToTypst(edited);
    const reparsed = parseTypstToStructuredModel(typst);
    expect(reparsed.location).toBe("");
    expect(reparsed.phone).toBe("+49 30 123456");
    expect(isResumeSourceSafeForForm(typst)).toBe(true);
  });

  it("blocks custom or patched Typst sources from silent loss", () => {
    expect(isResumeSourceSafeForForm("= Protected Master\n")).toBe(false);
    expect(isResumeSourceSafeForForm(`// @resumeforge-patched: true\n${starter}`)).toBe(false);
    expect(isResumeSourceSafeForForm(`${starter}\n#let custom = 1 + 2\n`)).toBe(false);
    expect(
      isResumeSourceSafeForForm(`${starter}\n#section("Publications")\n- Paper Title\n`)
    ).toBe(false);
  });

  it("remains safe-to-edit when fields contain trailing spaces during active typing", () => {
    const base = parseTypstToStructuredModel(starter);
    const withTrailingSpaces = serializeStructuredModelToTypst({
      ...base,
      fullName: "Alex Morgan ",
      location: "San Francisco, CA ",
      summary: "Systems engineer ",
    });
    expect(isResumeSourceSafeForForm(withTrailingSpaces)).toBe(true);
    expect(isResumeSourceSafeForForm(starter.replace("[Alex Morgan]", "[Alex Morgan ]"))).toBe(true);

    const blank = createBlankResumeTypst();
    expect(isResumeSourceSafeForForm(blank)).toBe(true);
    expect(parseTypstToStructuredModel(blank).fullName).toBe("");
  });

  it("parses AI-converted resumes using #resume-entry, #project-entry, #skill-line, and == Section headings", () => {
    const aiConverted = `// @pdf-conversion-draft: Review and edit before saving as Master Resume
// @conversion-path: ai
#set page(paper: "us-letter", margin: (x: 1.25cm, y: 1.1cm))
#set text(font: "Liberation Sans", size: 9pt, fill: rgb("#111827"))
#let section(title) = { text(title) }
#let entry(title: "", role: "", location: "", date: "", details: []) = { title }
#let resume-entry(title: "", location: "", subtitle: "", date: "", details: []) = entry(title: title, role: subtitle, location: location, date: date, details: details)
#let project-entry(title: "", links: none, date: "", stack: "", details: []) = { title }
#let skill-line(category: "", items: "") = block[*#category:* #items]

// HEADER
#align(center)[
  #text(size: 18pt, weight: "bold", fill: rgb("#111827"))[Priya Nair] \\
  #v(2pt)
  #text(size: 9pt, fill: rgb("#475569"))[
    Seattle, WA #sym.dot #link("mailto:priya@example.com")[priya\\@example.com] #sym.dot (206) 555-0142 #sym.dot #link("https://github.com/priyanair")[github.com/priyanair]
  ]
]

#section("Experience")
#resume-entry(
  title: "CloudScale",
  location: "Seattle, WA",
  subtitle: "Senior Backend Engineer",
  date: "2022 – Present",
  details: [
    - Reduced API p99 latency by 38% across 12 services.
  ]
)

== Projects
#project-entry(
  title: "TraceFlow",
  links: [#link("https://github.com/priyanair/traceflow")[GitHub]],
  date: "2025",
  stack: "Go, PostgreSQL, OpenTelemetry",
  details: [
    - Built distributed trace collector handling 50k spans/sec.
  ]
)

== Skills
#skill-line(category: "Languages", items: "Go, TypeScript, Python, SQL")
#skill-line(category: "Infrastructure", items: "Docker, Kubernetes, PostgreSQL")
`;

    expect(isResumeSourceSafeForForm(aiConverted)).toBe(true);
    const parsed = parseTypstToStructuredModel(aiConverted);
    expect(parsed.fullName).toBe("Priya Nair");
    expect(parsed.location).toBe("Seattle, WA");
    expect(parsed.email).toBe("priya@example.com");
    expect(parsed.experience).toHaveLength(1);
    expect(parsed.experience[0]).toMatchObject({
      title: "CloudScale",
      role: "Senior Backend Engineer",
      location: "Seattle, WA",
      date: "2022 – Present",
      bullets: ["Reduced API p99 latency by 38% across 12 services."],
    });
    expect(parsed.projects).toHaveLength(1);
    expect(parsed.projects[0]).toMatchObject({
      title: "TraceFlow",
      role: "Go, PostgreSQL, OpenTelemetry",
      date: "2025",
      bullets: ["Built distributed trace collector handling 50k spans/sec."],
    });
    expect(parsed.projects[0].location).toContain("https://github.com/priyanair/traceflow");
    expect(parsed.skills).toHaveLength(2);
    expect(parsed.skills[0]).toMatchObject({
      category: "Languages",
      items: "Go, TypeScript, Python, SQL",
    });

    const fallbackConverted = convertTextToTypst(
      [
        "Jordan Lee",
        "Experience",
        "Acme Corp — Software Engineer, New York, NY 2021 - 2024",
        "- Shipped payment webhooks.",
        "Skills",
        "Languages: TypeScript, Python",
      ].join("\n")
    );
    expect(isResumeSourceSafeForForm(fallbackConverted)).toBe(true);
    const parsedFallback = parseTypstToStructuredModel(fallbackConverted);
    expect(parsedFallback.fullName).toBe("Jordan Lee");
    expect(parsedFallback.experience).toHaveLength(1);
    expect(parsedFallback.skills).toHaveLength(1);
  });
});
