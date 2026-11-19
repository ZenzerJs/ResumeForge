import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import {
  generateApplicationPackageZip,
  cleanTypstToText,
  sanitizeZipFilename,
  computeSha256,
  ALLOWED_ZIP_ENTRIES,
  ZIP_MANIFEST_SCHEMA_VERSION,
  ZipManifest,
} from "@/lib/export/zip";
import { ResumeFacts } from "@/lib/facts/types";
import { extractResumeFacts } from "@/lib/facts/extract";
import { AtsEvaluationResult } from "@/lib/ats-evaluator/types";
import { GuardrailBlockError } from "@/lib/guardrail/policy";

describe("Application Package ZIP Generator (Release Hardening)", () => {
  const masterFacts: ResumeFacts = {
    version: 1,
    snapshotAt: "2026-08-14T00:00:00.000Z",
    employers: [{ raw: "Stripe", normalized: "stripe" }],
    titles: [{ raw: "Senior Software Engineer", normalized: "senior software engineer" }],
    dateRanges: [{ raw: "2022 – 2024", startIso: "2022-01", endIso: "2024-01" }],
    metrics: [{ raw: "45ms", value: 45, unit: "ms", context: "latency", isTrivial: false }],
    skills: ["typescript", "postgresql", "react"],
    evidenceIds: ["evid-1"],
  };

  const sampleTypst = `
= Jane Doe
jane.doe@example.com | San Francisco, CA

== EXPERIENCE
*Stripe* -- *Senior Software Engineer*
- Reduced latency by 45ms across TypeScript and PostgreSQL microservices.

== SKILLS
- Languages: TypeScript, SQL, React
  `;

  const sampleJob = {
    company: "Stripe",
    roleTitle: "Staff Software Engineer",
    location: "San Francisco, CA (Hybrid)",
    salarySnippet: "$210,000 - $260,000",
    requirements: {
      requiredSkills: ["typescript", "postgresql"],
      preferredSkills: ["react", "graphql"],
      domainTerms: ["latency", "microservices"],
    },
  };

  const sampleAtsScore: AtsEvaluationResult = {
    overallScore: 92,
    baseHealth: {
      score: 30,
      maxScore: 30,
      percentage: 100,
      findings: ["Clean contact info", "Standard headers"],
    },
    requiredMatch: {
      score: 40,
      maxScore: 40,
      percentage: 100,
      findings: ["Demonstrated TypeScript in Experience", "Demonstrated PostgreSQL in Experience"],
    },
    preferredMatch: {
      score: 12,
      maxScore: 15,
      percentage: 80,
      findings: ["Demonstrated React in Experience"],
    },
    roleEvidence: {
      score: 10,
      maxScore: 15,
      percentage: 67,
      findings: ["Demonstrated domain metrics"],
    },
    skillEvaluations: [
      {
        skill: "typescript",
        category: "required",
        status: "DEMONSTRATED_IN_EXPERIENCE",
        score: 20,
        maxScore: 20,
      },
      {
        skill: "postgresql",
        category: "required",
        status: "DEMONSTRATED_IN_EXPERIENCE",
        score: 20,
        maxScore: 20,
      },
      {
        skill: "react",
        category: "preferred",
        status: "DEMONSTRATED_IN_EXPERIENCE",
        score: 12,
        maxScore: 15,
      },
    ],
    gaps: ["GraphQL not demonstrated in experience or listed skills"],
    selectedProfile: "Full-stack",
  };

  it("exports ZIP_MANIFEST_SCHEMA_VERSION = 1 constant", () => {
    expect(ZIP_MANIFEST_SCHEMA_VERSION).toBe(1);
  });

  it("generates a valid ZIP bundle with manifest.json, mediaType, integrity note, and cryptographic checksums", async () => {
    const zipBytes = await generateApplicationPackageZip({
      typstSource: sampleTypst,
      masterFacts,
      job: sampleJob,
      atsScore: sampleAtsScore,
    });

    expect(zipBytes).toBeInstanceOf(Uint8Array);
    expect(zipBytes.length).toBeGreaterThan(500);

    const zip = await JSZip.loadAsync(zipBytes);

    // Verify all core files are present
    expect(zip.file("resume.pdf")).not.toBeNull();
    expect(zip.file("resume.docx")).not.toBeNull();
    expect(zip.file("resume.txt")).not.toBeNull();
    expect(zip.file("resume.typ")).not.toBeNull();
    expect(zip.file("application_summary.txt")).not.toBeNull();
    expect(zip.file("manifest.json")).not.toBeNull();

    // Verify all files adhere strictly to the allowed entry names
    Object.keys(zip.files).forEach((entryName) => {
      expect(ALLOWED_ZIP_ENTRIES.has(entryName)).toBe(true);
    });

    // Verify manifest contents and SHA-256 hashes
    const manifestStr = await zip.file("manifest.json")?.async("string");
    expect(manifestStr).toBeDefined();
    const manifest: ZipManifest = JSON.parse(manifestStr!);

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.generator).toBe("ResumeForge Multi-Format Exporter v1.0");
    expect(manifest.guardrailStatus).toBe("passed");
    expect(manifest.integrityNote).toContain("The manifest provides tamper-evident verification");
    expect(manifest.job.company).toBe("Stripe");
    expect(manifest.job.roleTitle).toBe("Staff Software Engineer");
    expect(manifest.artifacts.length).toBeGreaterThanOrEqual(5);

    manifest.artifacts.forEach((art) => {
      expect(art.name).toBeDefined();
      expect(art.byteLength).toBeGreaterThan(0);
      expect(art.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(art.mediaType).toBeDefined();
      expect(art.mediaType.length).toBeGreaterThan(3);
    });
  });

  it("computes valid 64-char hex hashes consistently across string and byte inputs", async () => {
    const hash1 = await computeSha256("Sample Content For Hashing");
    const hash2 = await computeSha256(new TextEncoder().encode("Sample Content For Hashing"));
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    expect(hash2).toBe(hash1);
  });

  it("bundles cover letter files and records them in manifest when provided", async () => {
    const coverLetter = `# Application for Staff Software Engineer at Stripe\n\nDear Hiring Team,\n\nI am excited to apply for the Staff Software Engineer role at Stripe.`;

    const zipBytes = await generateApplicationPackageZip({
      typstSource: sampleTypst,
      masterFacts,
      coverLetter,
      job: sampleJob,
    });

    const zip = await JSZip.loadAsync(zipBytes);
    expect(zip.file("cover_letter.md")).not.toBeNull();
    expect(zip.file("cover_letter.txt")).not.toBeNull();

    const manifestStr = await zip.file("manifest.json")?.async("string");
    const manifest: ZipManifest = JSON.parse(manifestStr!);

    const names = manifest.artifacts.map((a) => a.name);
    expect(names).toContain("cover_letter.md");
    expect(names).toContain("cover_letter.txt");

    const mdArtifact = manifest.artifacts.find((a) => a.name === "cover_letter.md");
    expect(mdArtifact?.mediaType).toBe("text/markdown;charset=utf-8");
  });

  it("omits cover letter files when cover letter is not provided or whitespace only", async () => {
    const zipBytesNull = await generateApplicationPackageZip({
      typstSource: sampleTypst,
      masterFacts,
      job: sampleJob,
    });

    const zipNull = await JSZip.loadAsync(zipBytesNull);
    expect(zipNull.file("cover_letter.md")).toBeNull();
    expect(zipNull.file("cover_letter.txt")).toBeNull();

    const zipBytesWhitespace = await generateApplicationPackageZip({
      typstSource: sampleTypst,
      masterFacts,
      coverLetter: "   \n\t  ",
      job: sampleJob,
    });

    const zipWhitespace = await JSZip.loadAsync(zipBytesWhitespace);
    expect(zipWhitespace.file("cover_letter.md")).toBeNull();
    expect(zipWhitespace.file("cover_letter.txt")).toBeNull();
  });

  it("sanitizes Windows reserved device names and illegal characters properly", () => {
    expect(sanitizeZipFilename("CON")).toBe("App_CON_Application_Package.zip");
    expect(sanitizeZipFilename("PRN", "Lead")).toBe("App_PRN_Lead_Application_Package.zip");
    expect(sanitizeZipFilename("NUL", "Developer")).toBe("App_NUL_Developer_Application_Package.zip");
    expect(sanitizeZipFilename("AUX")).toBe("App_AUX_Application_Package.zip");
    expect(sanitizeZipFilename("COM1")).toBe("App_COM1_Application_Package.zip");

    // Slashes and spaces
    expect(sanitizeZipFilename("Acme / Corp", "Staff Software Engineer")).toBe(
      "Acme_Corp_Staff_Software_Engineer_Application_Package.zip"
    );

    // Super long 150-char string capped at 50 chars base
    const longCompany = "A".repeat(150);
    const result = sanitizeZipFilename(longCompany);
    const baseName = result.replace("_Application_Package.zip", "");
    expect(baseName.length).toBeLessThanOrEqual(50);
    expect(result.endsWith("_Application_Package.zip")).toBe(true);

    // Empty / null handling
    expect(sanitizeZipFilename(null, null)).toBe("ResumeForge_Application_Package.zip");
  });

  it("passes secret-pattern scanning: never leaks API keys or DB connections", async () => {
    const zipBytes = await generateApplicationPackageZip({
      typstSource: sampleTypst,
      masterFacts,
      job: sampleJob,
      atsScore: sampleAtsScore,
    });

    const zip = await JSZip.loadAsync(zipBytes);
    const summary = (await zip.file("application_summary.txt")?.async("string")) || "";
    const manifest = (await zip.file("manifest.json")?.async("string")) || "";
    const txt = (await zip.file("resume.txt")?.async("string")) || "";

    const secretPatterns = [
      /sk-ant-[a-zA-Z0-9_-]+/,
      /sk-proj-[a-zA-Z0-9_-]+/,
      /AIza[0-9A-Za-z-_]{35}/,
      /Bearer\s+[a-zA-Z0-9._-]+/,
      /postgresql:\/\/[^\s]+/,
    ];

    [summary, manifest, txt].forEach((content) => {
      secretPatterns.forEach((pat) => {
        expect(content).not.toMatch(pat);
      });
    });
  });

  it("blocks ZIP generation when mechanical guardrail detects hard violations", async () => {
    const hallucinatedTypst = `
= Jane Doe
== EXPERIENCE
*Netflix* -- *Principal Architect*
- Invented quantum computing cluster increasing revenue by $500M.
    `;

    await expect(
      generateApplicationPackageZip({
        typstSource: hallucinatedTypst,
        masterFacts,
        job: sampleJob,
      })
    ).rejects.toThrow(GuardrailBlockError);
  });

  it("cleans typst markup syntax cleanly to plain text", () => {
    const raw = `
#show: resume-template
= Jane Doe
#link("https://github.com/janedoe")[github.com/janedoe]
== EXPERIENCE
#strong[Stripe] -- #emph[Software Engineer]
- Reduced latency by 45ms.
    `;

    const cleaned = cleanTypstToText(raw);
    expect(cleaned).toContain("=== Jane Doe ===");
    expect(cleaned).toContain("https://github.com/janedoe");
    expect(cleaned).not.toContain("(https://");
    expect(cleaned).toContain("--- EXPERIENCE ---");
    expect(cleaned).toContain("Stripe -- Software Engineer");
    expect(cleaned).not.toContain("#show");
  });

  it("cleans starter-resume.typ without leaking #, //, or =>", () => {
    const starter = readFileSync("public/templates/starter-resume.typ", "utf8");
    const cleaned = cleanTypstToText(starter);

    expect(cleaned).not.toContain("#");
    expect(cleaned.replace(/https?:\/\//g, "")).not.toContain("//");
    expect(cleaned).not.toContain("=>");
    expect(cleaned).toContain("Alex Morgan");
    expect(cleaned).toContain("TechCorp Systems");
    expect(cleaned).toContain("University of California, Berkeley");
  });

  it("extracts full text from #resume-entry, #project-entry, #skill-line, and unknown #func(...) content blocks", () => {
    const aiConvertedTypst = `
#set page(paper: "us-letter", margin: (x: 1.25cm, y: 1.1cm))
#let section(title) = { v(0.4em); text(size: 10pt, weight: "bold")[#upper(title)] }
#let entry(title: "", role: "", location: "", date: "", details: []) = { block[#title #role #location #date #details] }
#let resume-entry(title: "", location: "", subtitle: "", date: "", details: []) = entry(title: title, role: subtitle, location: location, date: date, details: details)
#let project-entry(title: "", links: none, date: "", stack: "", details: []) = { block[#title #links #date #stack #details] }
#let skill-line(category: "", items: "") = block[*#category:* #items]

#align(center)[
  #text(size: 18pt, weight: "bold", fill: rgb("#111827"))[Priya Nair] \\
  #v(2pt)
  #text(size: 9pt, fill: rgb("#475569"))[
    Seattle, WA #sym.dot #link("mailto:priya@example.com")[priya\\@example.com] #sym.dot #link("https://github.com/priyanair")[github.com/priyanair]
  ]
]

#section("Experience")
#resume-entry(
  title: "Cascade Cloud",
  location: "Seattle, WA",
  subtitle: "Backend Software Engineer",
  date: "2023 – Present",
  details: [
    - Built TypeScript and Go ingestion services handling 50k events/sec.
    - Cut PostgreSQL p95 query latency by 38% via partial indexes.
  ]
)

#section("Projects")
#project-entry(
  title: "QueryPulse",
  links: [#link("https://github.com/priyanair/querypulse")[GitHub]],
  date: "2024",
  stack: "TypeScript, PostgreSQL, Docker",
  details: [
    - Built an automated query plan analyzer supporting C\\# and SQL workloads.
  ]
)

#section("Skills")
#skill-line(category: "Languages", items: "TypeScript, Go, SQL, Python")
#skill-line(category: "Infrastructure", items: "Docker, PostgreSQL, Redis")

#section("Honors")
#custom-award(year: "2024", details: [
  - Dean's List and Systems Capstone Winner.
])
#grid(columns: (1fr, auto), [Distributed Systems Award], [2024])
`;

    const cleaned = cleanTypstToText(aiConvertedTypst);
    expect(cleaned.length).toBeGreaterThan(500);
    expect(cleaned).toContain("Priya Nair");
    expect(cleaned).toContain("priya@example.com");
    expect(cleaned).toContain("https://github.com/priyanair");
    expect(cleaned).not.toContain("(mailto:");
    expect(cleaned).toContain("Cascade Cloud -- Backend Software Engineer | Seattle, WA | 2023 – Present");
    expect(cleaned).toContain("Built TypeScript and Go ingestion services handling 50k events/sec.");
    expect(cleaned).toContain("QueryPulse | https://github.com/priyanair/querypulse | TypeScript, PostgreSQL, Docker | 2024");
    expect(cleaned).not.toContain("GitHub (https://");
    expect(cleaned).toContain("C# and SQL workloads");
    expect(cleaned).toContain("Languages: TypeScript, Go, SQL, Python");
    expect(cleaned).toContain("Infrastructure: Docker, PostgreSQL, Redis");
    expect(cleaned).toContain("Dean's List and Systems Capstone Winner.");
    expect(cleaned).toContain("Distributed Systems Award");
    expect(cleaned.replace(/C#/g, "")).not.toContain("#");
  });

  it("cleans guest/non-managed Typst sources without leaking raw Typst syntax", () => {
    const guestTypst = `
// Guest draft resume
#show: doc => doc
= Jordan Example
#link("mailto:jordan@example.invalid")[jordan\\@example.invalid] #sym.bullet #link("https://example.invalid")[example.invalid]
#resume-section("Projects")
- Built a deterministic parser in TypeScript.
`;
    const cleaned = cleanTypstToText(guestTypst);
    expect(cleaned).toContain("=== Jordan Example ===");
    expect(cleaned).toContain("--- Projects ---");
    expect(cleaned).toContain("jordan@example.invalid • https://example.invalid");
    expect(cleaned).not.toContain("(mailto:");
    expect(cleaned).not.toContain("#show");
    expect(cleaned).not.toContain("#resume-section");
    expect(cleaned).not.toContain("#sym");
    expect(cleaned).not.toContain("=>");
  });

  it("deduplicates bare email and normalized URL labels while stripping descriptive link wrapper noise", () => {
    const raw = `
= Jane Doe
#link("mailto:jane@example.com")[jane\\@example.com] | #link("https://www.github.com/janedoe/")[github.com/janedoe] | #link("https://janedoe.dev")[Portfolio] | #link("mailto:jane@example.com")[Email Jane]
== PROJECTS
- #link("https://demo.example.com")[Live Demo]
`;
    const cleaned = cleanTypstToText(raw);
    expect(cleaned).toContain(
      "jane@example.com | https://www.github.com/janedoe/ | https://janedoe.dev | jane@example.com"
    );
    expect(cleaned).toContain("https://demo.example.com");
    expect(cleaned).not.toContain("(mailto:");
    expect(cleaned).not.toContain("github.com/janedoe (https://");
    expect(cleaned).not.toContain("Live Demo (https://");
  });

  it("preserves nested #skill-line skills in cleanTypstToText and ZIP resume.txt for AI-converted master resumes", async () => {
    const aiMasterTypst = `// @pdf-conversion-draft: Review and edit before saving as Master Resume
// @conversion-path: ai
// PDF source: "Synthetic_Candidate_Resume.pdf" — converted 2026-11-15

#set page(
  paper: "us-letter",
  margin: (x: 1.25cm, y: 1.1cm),
)

#set text(
  font: "Liberation Sans",
  size: 9pt,
  fill: rgb("#111827"),
)

#set par(justify: true, leading: 0.48em)

// Link styling matching LaTeX linkblue (#1155CC)
#show link: set text(fill: rgb("#1155CC"))

// Section heading helper
#let section(title) = {
  v(0.4em)
  text(size: 10pt, weight: "bold", tracking: 0.05em, upper(title))
  v(-0.4em)
  line(length: 100%, stroke: 0.5pt + rgb("#9CA3AF"))
  v(0.15em)
}

// Header/entry helper for aligned 2-row roles & dates
#let entry(
  title: "",
  role: "",
  location: "",
  date: "",
  details: [],
) = {
  block(width: 100%, breakable: false, below: 0.45em, above: 0.55em)[
    #grid(
      columns: (1fr, auto),
      row-gutter: 0.28em,
      align: (left, right),
      [*#title*], [#location],
      [#emph(role)], [#emph(date)],
    )
    #v(-0.35em)
    #details
  ]
}

#let resume-entry(title: "", location: "", subtitle: "", date: "", details: []) = entry(title: title, role: subtitle, location: location, date: date, details: details)

#let project-entry(title: "", links: none, date: "", stack: "", details: []) = {
  block(width: 100%, breakable: false, below: 0.45em, above: 0.55em)[
    #grid(
      columns: (1fr, auto),
      row-gutter: 0.28em,
      align: (left, right),
      [*#title* #if links != none [| #links]], [#emph(date)],
      [#emph(stack)], [],
    )
    #v(-0.35em)
    #details
  ]
}

#let skill-line(category: "", items: "") = block(width: 100%, below: 0.35em)[*#category:* #items]

// Compact list styling
#set list(
  marker: [•],
  spacing: 0.4em,
  indent: 0em,
  body-indent: 0.4em,
)

// HEADER
#align(center)[
  #text(size: 18pt, weight: "bold", fill: rgb("#111827"))[Taylor Lin] \\
  #v(2pt)
  #text(size: 9pt, fill: rgb("#475569"))[
    Waterloo / Toronto, ON #sym.dot #link("mailto:taylor.lin.dev@example.com")[taylor.lin.dev\\@example.com] #sym.dot #link("https://linkedin.com/in/taylor-lin")[linkedin.com/in/taylor-lin] #sym.dot #link("https://github.com/taylorlin-dev")[github.com/taylorlin-dev] #sym.dot #link("https://taylor-portfolio.example.com/")[taylor-portfolio.example.com]
  ]
]

#section("Experience")
#resume-entry(
  title: "Northstar Health Partners",
  location: "Mississauga, ON",
  subtitle: "IT Operations (Software Development)",
  date: "May 2026 – Aug. 2026",
  details: [
    - Designed and deployed a production license operations portal in *Next.js*, *TypeScript*, and *Prisma*.
    - Built an on-premises *Ollama* assistant tested with *Vitest* and *Playwright*.
  ]
)

#section("Education")
#resume-entry(
  title: "Laurentian Tech University",
  location: "Waterloo, ON",
  subtitle: "Honours B.Sc. Computer Science",
  date: "Expected Apr. 2029",
  details: [
    - Coursework: *Data Structures I* (Python), *Object-Oriented Programming* (Java)
  ]
)

#section("Projects")
#project-entry(
  title: "Bench-Lab – Evaluation Harness",
  links: [#link("https://github.com/taylorlin-dev/bench-lab")[GitHub], #link("https://taylorlin-dev.github.io/bench-lab/")[Live Demo]],
  date: "Sept. 2026 – Present",
  stack: "Python, SQLite, React, TypeScript, GitHub Actions, Playwright",
  details: [
    - Built an evaluation harness in *Python* and *SQLite* with *126* automated tests in CI.
  ]
)

#section("Skills")
#entry(
  details: [
    #skill-line(category: "Languages", items: "Python, TypeScript, JavaScript, Java, SQL, Swift, HTML/CSS")
    #skill-line(category: "Web & Backend", items: "Next.js, React, Tailwind CSS, FastAPI, Prisma, REST APIs, SQLite, Node.js")
    #skill-line(category: "AI & Tools", items: "LangGraph, Ollama, LLM APIs, tool calling, Vitest, Playwright, GitHub Actions, Git, Docker, Linux, n8n")
  ]
)
`;

    const cleaned = cleanTypstToText(aiMasterTypst);
    expect(cleaned).toContain("--- Skills ---");
    expect(cleaned).toContain("Languages: Python, TypeScript, JavaScript, Java, SQL, Swift, HTML/CSS");
    expect(cleaned).toContain("Web & Backend: Next.js, React, Tailwind CSS, FastAPI, Prisma, REST APIs, SQLite, Node.js");
    expect(cleaned).toContain("AI & Tools: LangGraph, Ollama, LLM APIs, tool calling, Vitest, Playwright, GitHub Actions, Git, Docker, Linux, n8n");
    for (const tech of [
      "Python",
      "TypeScript",
      "HTML/CSS",
      "Next.js",
      "FastAPI",
      "Prisma",
      "LangGraph",
      "Ollama",
      "Vitest",
      "Playwright",
      "Docker",
      "n8n",
    ]) {
      expect(cleaned).toContain(tech);
    }
    expect(cleaned).not.toContain("#");
    expect(cleaned).not.toContain("=>");
    expect(cleaned.replace(/https?:\/\//g, "")).not.toContain("//");

    const extractedFacts = extractResumeFacts(aiMasterTypst);
    const zipBytes = await generateApplicationPackageZip({
      typstSource: aiMasterTypst,
      masterFacts: extractedFacts,
      job: {
        company: "Northstar Health Partners",
        roleTitle: "Software Developer",
      },
    });
    const zip = await JSZip.loadAsync(zipBytes);
    const resumeTxt = (await zip.file("resume.txt")?.async("string")) ?? "";
    expect(resumeTxt).toContain("--- Skills ---");
    expect(resumeTxt).toContain("Languages: Python, TypeScript, JavaScript, Java, SQL, Swift, HTML/CSS");
    expect(resumeTxt).toContain("Web & Backend: Next.js, React, Tailwind CSS, FastAPI, Prisma, REST APIs, SQLite, Node.js");
    expect(resumeTxt).toContain("AI & Tools: LangGraph, Ollama, LLM APIs, tool calling, Vitest, Playwright, GitHub Actions, Git, Docker, Linux, n8n");
  });

  it("extracts positional, trailing-body, and nested #skill-line calls inside #block or #grid", () => {
    const raw = `
= Taylor Lin
#section("Skills")
#skill-line("Languages", "Python, C\\#, SQL")
#skill-line("Tools")[Docker, Git]
#grid(columns: (1fr, 1fr), [#skill-line(category: "Cloud", items: "AWS, GCP")], [#block[#skill-line("Testing")[Vitest, Playwright]]])
`;
    const cleaned = cleanTypstToText(raw);
    expect(cleaned).toContain("--- Skills ---");
    expect(cleaned).toContain("Languages: Python, C#, SQL");
    expect(cleaned).toContain("Tools: Docker, Git");
    expect(cleaned).toContain("Cloud: AWS, GCP");
    expect(cleaned).toContain("Testing: Vitest, Playwright");
    expect(cleaned.replace(/C#/g, "")).not.toContain("#");
  });
});
