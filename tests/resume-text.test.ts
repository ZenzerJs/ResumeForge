import { describe, expect, it } from "vitest";
import { formatPlaintextLink, managedResumeExport } from "@/lib/export/resume-text";
import { cleanTypstToText } from "@/lib/export/zip";
import { buildResumeDocument, renderResumeDocument } from "@/lib/typst/resume-document";

describe("plain text ATS export (resume-text)", () => {
  it("formats links as clean bare URLs/emails without Label (url) wrapping", () => {
    expect(formatPlaintextLink("https://github.com/example/atlas", "GitHub")).toBe("https://github.com/example/atlas");
    expect(formatPlaintextLink("https://atlas.example.test", "Live Demo")).toBe("https://atlas.example.test");
    expect(formatPlaintextLink("mailto:alex@example.com", "Email")).toBe("alex@example.com");
    expect(formatPlaintextLink("https://github.com/alex", "github.com/alex")).toBe("https://github.com/alex");
  });

  it("exports Skills and ATS-clean project links from a real layout-v2 resume", () => {
    const rows = [
      ["name", "Alex Rivera"],
      ["contact", "Seattle, WA | alex@example.test | github.com/alexrivera"],
      ["section", "Projects"],
      ["entry-title", "ResumeForge | GitHub | Live Demo"],
      ["bullet", "- Built local-first Typst resume editor"],
      ["section", "Skills"],
      ["skill", "Languages: TypeScript, Python, SQL"],
      ["skill", "Frameworks: React, Next.js, Tailwind CSS"],
    ] as const;
    const source = rows.map((row) => row[1]).join("\n");
    let offset = 0;
    const assignments = rows.map(([kind, text]) => {
      const start = offset;
      offset += text.length + 1;
      return { kind, span: { start, end: start + text.length } };
    });
    const doc = buildResumeDocument(source, assignments);
    const projectLine = "ResumeForge | GitHub | Live Demo";
    const projectStart = source.indexOf(projectLine);
    const links = [
      {
        label: "GitHub",
        url: "https://github.com/alexrivera/resumeforge",
        span: {
          start: projectStart + projectLine.indexOf("GitHub"),
          end: projectStart + projectLine.indexOf("GitHub") + "GitHub".length,
        },
      },
      {
        label: "Live Demo",
        url: "https://resumeforge.example.test",
        span: {
          start: projectStart + projectLine.indexOf("Live Demo"),
          end: projectStart + projectLine.indexOf("Live Demo") + "Live Demo".length,
        },
      },
    ];

    const v2Typst = renderResumeDocument(doc, "balanced", links);

    // Unmodified layout-v2 export
    const unmodified = managedResumeExport(v2Typst);
    expect(unmodified?.text).toContain("Skills\nLanguages: TypeScript, Python, SQL\nFrameworks: React, Next.js, Tailwind CSS");

    // Edited layout-v2 export (forces visibleManagedExport path)
    const edited = v2Typst.replace("Typst resume editor", "Typst resume workspace");
    const exported = managedResumeExport(edited);
    expect(exported).not.toBeNull();
    expect(exported?.text).toContain("Skills");
    expect(exported?.text).toContain("Languages: TypeScript, Python, SQL");
    expect(exported?.text).toContain("Frameworks: React, Next.js, Tailwind CSS");
    expect(exported?.text).toContain(
      "ResumeForge | https://github.com/alexrivera/resumeforge | https://resumeforge.example.test"
    );
    expect(exported?.text).not.toContain("GitHub (https://");
    expect(exported?.text).not.toContain("Live Demo (https://");

    // End-to-end cleanTypstToText should also match
    expect(cleanTypstToText(edited)).toBe(exported?.text);
  });

  it("unwraps bare #block[...], parameterized #block(...)[...], multiline #block, and #skill-line in edited layout-v2", () => {
    const rows = [
      ["name", "Alex Rivera"],
      ["contact", "alex@example.test"],
      ["section", "Skills"],
      ["skill", "Languages: TypeScript"],
    ] as const;
    const source = rows.map((row) => row[1]).join("\n");
    let offset = 0;
    const assignments = rows.map(([kind, text]) => {
      const start = offset;
      offset += text.length + 1;
      return { kind, span: { start, end: start + text.length } };
    });
    const base = renderResumeDocument(buildResumeDocument(source, assignments), "compact", []);
    const modified = base.replace(
      '#block(above: 0.35em, below: 0.15em)[#strong[Languages:] TypeScript]',
      [
        "#block[#strong[Languages:] TypeScript, Python]",
        "#block(breakable: false)[#text(weight: \"bold\")[Frameworks:] React, Next.js]",
        "#block(\n  above: 0.2em,\n  below: 0.2em\n)[\n  - #strong[Tools:] Docker #sym.bullet PostgreSQL\n]",
        '#skill-line(category: "Cloud", items: "AWS, Vercel")',
        "#v(0.2em)",
      ].join("\n")
    );

    const exported = managedResumeExport(modified);
    expect(exported).not.toBeNull();
    expect(exported?.text).toContain("Languages: TypeScript, Python");
    expect(exported?.text).toContain("Frameworks: React, Next.js");
    expect(exported?.text).toContain("- Tools: Docker • PostgreSQL");
    expect(exported?.text).toContain("Cloud: AWS, Vercel");
  });
});
