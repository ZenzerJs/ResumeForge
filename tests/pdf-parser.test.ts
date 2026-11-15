import { describe, it, expect } from "vitest";
import { convertTextToTypst, ensurePdfJsNodeGlobals, parsePdfBuffer } from "@/lib/pdf/parser";
import { extractResumeFacts } from "@/lib/facts/extract";

describe("PDF Parser & Typst Converter", () => {
  it("converts raw resume text into valid Typst markup", () => {
    const sampleText = `Alex Mercer
alex@example.com | (555) 019-2831 | San Francisco, CA

EXPERIENCE
Senior Backend Engineer at Acme Systems
- Built high-throughput distributed API handling 50k req/sec
- Reduced database query latency by 40% with Redis caching

EDUCATION
B.S. Computer Science — UC Berkeley
`;

    const typst = convertTextToTypst(sampleText);
    expect(typst).toContain("= Alex Mercer");
    expect(typst).toContain("== Experience");
    expect(typst).toContain("- Built high\\-throughput");
    expect(typst).toContain("== Education");
  });

  it("handles empty or single line text gracefully", () => {
    const typst = convertTextToTypst("John Doe", "MyResume.pdf");
    expect(typst).toContain("= John Doe");
    expect(typst).toContain('#set page(paper: "us-letter"');
  });

  it("renders verified extracted link annotations in header when provided and drops duplicated raw contact line", () => {
    const links = [
      { url: "https://linkedin.com/in/alex", label: "LinkedIn" },
      { url: "https://github.com/alex", label: "GitHub" },
    ];
    const typst = convertTextToTypst(
      "Alex Mercer\nOntario, Canada | alex@example.com | LinkedIn | GitHub\n\nExperience\nNorthwind Health Systems Mississauga, ON\nIT Operations May 2026 - Present\n– Built portal.",
      "MyResume.pdf",
      links
    );
    expect(typst).toContain('#link("https://linkedin.com/in/alex")[LinkedIn]');
    expect(typst).toContain('#link("https://github.com/alex")[GitHub]');
    expect(typst).toContain("Ontario, Canada | alex\\@example.com");
  });

  it("Golden Test: synthetic persona resume text converts en-dash bullets, rejoins hyphenated wraps, avoids promoting entries to sections, and extracts facts", () => {
    const personaResumeText = `Alex Rivera
Ontario, Canada | alex.rivera@example.com | LinkedIn | GitHub | Portfolio

Education
State University Waterloo, ON
Bachelor of Science, Computer Science with Management Option Expected Apr. 2029
– Relevant Coursework: Data Structures and Algorithms, Object-Oriented Programming, Database Management Systems (SQL), Linear Algebra, Calculus II

Experience
Northwind Health Systems Mississauga, ON
IT Operations (Software Development) May 2026 – Present
– Deployed production clinical license portal in Next.js and TypeScript with idempo-
tent webhook ingestion across 1,000+ licenses and 45% faster processing.
– Maintained data-center asset, rack, and cabinet documentation using Sunbird dcTrack
and monitored infrastructure health through Power IQ.
Career Education Council Remote
App Developer Feb. 2024 – Sept. 2024
– Developed and tested Scholars Spark iOS app in Swift serving 500+ students.

Projects
ResumeForge | GitHub | Live Demo — Next.js, TypeScript, Prisma, PostgreSQL Aug. 2026 – Present
– Built a local-first AI resume workspace verified by 599 unit tests across 107 suites.

Technical Skills
Languages: Python, TypeScript, JavaScript, Java, Swift, SQL, HTML/CSS
Engineering: Next.js, React, FastAPI, REST APIs, PostgreSQL, Prisma, Docker, Git
`;

    const links = [
      { url: "mailto:alex.rivera@example.com", label: "alex.rivera@example.com" },
      { url: "https://linkedin.com/in/alex-rivera", label: "LinkedIn" },
      { url: "https://github.com/alex-rivera", label: "GitHub" },
    ];

    const typst = convertTextToTypst(personaResumeText, "Alex_Rivera_Resume.pdf", links);

    // 1. No experience entry promoted to a section header
    expect(typst).not.toContain("== Career Education Council");
    expect(typst).not.toContain("== Northwind Health Systems");

    // 2. Contact line not duplicated when links are rendered
    expect(typst).toContain("Ontario, Canada | alex.rivera\\@example.com");

    // 3. Hyphenated wrap rejoined ("idempo-\ntent" -> "idempotent") and continuation lines merged into bullet
    expect(typst).toContain("idempotent webhook ingestion across 1,000\\+ licenses and 45% faster processing.");
    expect(typst).toContain(
      "- Maintained data\\-center asset, rack, and cabinet documentation using Sunbird dcTrack and monitored infrastructure health through Power IQ."
    );

    // 4. Bullets using en-dash ("–") rendered as Typst list items ("- ")
    expect(typst).toContain("- Deployed production clinical license portal");
    expect(typst).toContain("- Developed and tested Scholars Spark iOS app");

    // 5. extractResumeFacts returns Northwind Health Systems, its title, date range, and bullet-only metrics
    const facts = extractResumeFacts(typst);
    const employerNames = facts.employers.map((e) => e.raw);
    expect(employerNames).toContain("Northwind Health Systems");
    expect(employerNames).toContain("Career Education Council");

    const titleNames = facts.titles.map((t) => t.raw);
    expect(titleNames).toContain("IT Operations (Software Development)");
    expect(titleNames).toContain("App Developer");

    // Date ranges parsed including "May 2026 – Present" and "Feb. 2024 – Sept. 2024"
    expect(facts.dateRanges.some((d) => d.startIso === "2026-05" && d.isCurrent === true)).toBe(true);
    expect(facts.dateRanges.some((d) => d.startIso === "2024-02" && d.endIso === "2024-09")).toBe(true);

    // Bullet metrics extracted cleanly without layout constants
    expect(facts.metrics.some((m) => m.value === 45 && m.unit === "%")).toBe(true);
    expect(facts.metrics.some((m) => m.value === 1000)).toBe(true);
    const forbiddenLayoutNums = new Set([0.45, 0.55, 0.28, 0.35, 2, 4, 6, 100]);
    for (const m of facts.metrics) {
      expect(forbiddenLayoutNums.has(m.value)).toBe(false);
    }
  });

  it("escapes Typst markup in headers, entries, bullets, and deduplicates or disarms unsafe links", () => {
    const injected = [
      'Alex #eval("pwn") [Mercer]',
      'alex@example.com | #import("evil")',
      "",
      "EXPERIENCE",
      'Acme "Quoted" #read("/etc/passwd") Corp Toronto, ON',
      'Lead #eval("role") May 2024 - Present',
      '- Built [fast] #eval("bullet") APIs with *SQL* and _Go_',
    ].join("\n");

    const typst = convertTextToTypst(injected, "bad.pdf", [
      { url: "https://example.com", label: "Site [1]" },
      { url: "https://example.com/", label: "Duplicate Site" },
      { url: "javascript:alert(1)", label: "Evil [JS]" },
      { url: 'https://evil.example/")#eval("x', label: "Broken" },
    ]);

    expect(typst).toContain('= Alex \\#eval("pwn") \\[Mercer\\]');
    expect(typst).toContain('title: "Acme \\"Quoted\\" #read(\\"/etc/passwd\\") Corp"');
    expect(typst).toContain('role: "Lead #eval(\\"role\\")');
    expect(typst).toContain('- Built \\[fast\\] \\#eval("bullet") APIs with \\*SQL\\* and \\_Go\\_');
    expect(typst).toContain('#link("https://example.com/")[Site \\[1\\]]');
    expect(typst).not.toContain("Duplicate Site");
    expect(typst).not.toContain('#link("javascript:');
    expect(typst).toContain("Evil \\[JS\\]");
    expect(typst).not.toContain(')#eval("x');
  });

  it("normalizes CR injections and blocks data/vbscript/file/credentialed URI annotations while keeping visible text", () => {
    const rawText = [
      "Alex Mercer",
      "Toronto, ON | Portfolio | Docs | Home",
      "",
      "EXPERIENCE",
      "Example\r#eval(\"break\") Corp\rToronto, ON",
      "Principal\rEngineer Jan 2025 - Present",
      "- Kept safe text intact.",
    ].join("\n");

    const typst = convertTextToTypst(rawText, "inert.pdf", [
      { url: "data:text/html,<script>alert(1)</script>", label: "DataLink" },
      { url: "vbscript:msgbox(1)", label: "VBLink" },
      { url: "file:///etc/passwd", label: "FileLink" },
      { url: "https://user:secret@evil.example/path", label: "CredLink" },
      { url: "https://portfolio.example.com/work", label: "Portfolio" },
    ]);

    expect(typst).not.toContain("\r");
    expect(typst).not.toContain('#link("data:');
    expect(typst).not.toContain('#link("vbscript:');
    expect(typst).not.toContain('#link("file:');
    expect(typst).not.toContain("user:secret@evil.example");
    expect(typst).toContain("DataLink");
    expect(typst).toContain("VBLink");
    expect(typst).toContain("FileLink");
    expect(typst).toContain("CredLink");
    expect(typst).toContain('#link("https://portfolio.example.com/work")[Portfolio]');
  });

  it("polyfills missing DOMMatrix/ImageData/Path2D globals and parses a PDF buffer safely", async () => {
    const g = globalThis as Record<string, unknown>;
    const prevDOMMatrix = g.DOMMatrix;
    const prevImageData = g.ImageData;
    const prevPath2D = g.Path2D;
    try {
      delete g.DOMMatrix;
      delete g.ImageData;
      delete g.Path2D;

      ensurePdfJsNodeGlobals();
      expect(typeof g.DOMMatrix).toBe("function");
      expect(typeof g.ImageData).toBe("function");
      expect(typeof g.Path2D).toBe("function");

      const samplePdf = Buffer.from(
        "%PDF-1.4\n" +
          "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n" +
          "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n" +
          "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n" +
          "4 0 obj<< /Length 44 >>stream\n" +
          "BT /F1 12 Tf 72 720 Td (Hello ResumeForge) Tj ET\n" +
          "endstream\nendobj\n" +
          "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n" +
          "xref\n0 6\n" +
          "0000000000 65535 f \n" +
          "0000000009 00000 n \n" +
          "0000000058 00000 n \n" +
          "0000000115 00000 n \n" +
          "0000000241 00000 n \n" +
          "0000000335 00000 n \n" +
          "trailer<< /Size 6 /Root 1 0 R >>\n" +
          "startxref\n405\n%%EOF"
      );
      const parsed = await parsePdfBuffer(samplePdf);
      expect(parsed.text).toContain("Hello ResumeForge");
      expect(parsed.numpages).toBe(1);
    } finally {
      if (prevDOMMatrix === undefined) delete g.DOMMatrix;
      else g.DOMMatrix = prevDOMMatrix;
      if (prevImageData === undefined) delete g.ImageData;
      else g.ImageData = prevImageData;
      if (prevPath2D === undefined) delete g.Path2D;
      else g.Path2D = prevPath2D;
    }
  });
});
