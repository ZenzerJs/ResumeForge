import { describe, it, expect } from "vitest";
import { convertTextToTypst } from "@/lib/pdf/parser";
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
    expect(typst).toContain("- Built high-throughput");
    expect(typst).toContain("== Education");
  });

  it("handles empty or single line text gracefully", () => {
    const typst = convertTextToTypst("John Doe", "MyResume.pdf");
    expect(typst).toContain("= John Doe");
    expect(typst).toContain("#line(length: 100%");
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
    expect(typst).not.toContain("Ontario, Canada | alex\\@example.com");
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
    expect(typst).not.toContain("Ontario, Canada | alex.rivera\\@example.com");

    // 3. Hyphenated wrap rejoined ("idempo-\ntent" -> "idempotent") and continuation lines merged into bullet
    expect(typst).toContain("idempotent webhook ingestion across 1,000+ licenses and 45% faster processing.");
    expect(typst).toContain(
      "- Maintained data-center asset, rack, and cabinet documentation using Sunbird dcTrack and monitored infrastructure health through Power IQ."
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
});
