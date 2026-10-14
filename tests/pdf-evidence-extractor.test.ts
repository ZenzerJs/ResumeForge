import { describe, it, expect } from "vitest";
import {
  detectSectionHeading,
  extractTechnologies,
  extractMetrics,
  cleanLigatures,
  ExtractedPdfEvidence,
} from "@/lib/evidence/pdfExtractor";
import {
  convertExtractedPdfToEvidenceItems,
  cleanBulletText,
  assembleBullets,
  DATE_RANGE_REGEX,
} from "@/lib/evidence/evidence-transform";

describe("PDF Evidence Extractor & Transform", () => {
  describe("detectSectionHeading normalization and matching", () => {
    it("normalizes Career Evidence Bank headings with numbers, IDs, and subtitles", () => {
      expect(
        detectSectionHeading("2. PROFESSIONAL EXPERIENCE (Evidence IDs: EXP-*)")
      ).toBe("experience");
      expect(
        detectSectionHeading("3. PROJECTS (Evidence IDs: PRJ-*)")
      ).toBe("projects");
      expect(
        detectSectionHeading("4. TECHNICAL SKILLS MATRIX")
      ).toBe("skills");
      expect(
        detectSectionHeading("1. EXECUTIVE SUMMARY")
      ).toBe("uncategorized");
      expect(
        detectSectionHeading("5. EDUCATION")
      ).toBe("education");
      expect(
        detectSectionHeading("6. CERTIFICATIONS & CREDENTIALS")
      ).toBe("certifications");
    });

    it("matches standard resume section headings", () => {
      expect(detectSectionHeading("WORK EXPERIENCE")).toBe("experience");
      expect(detectSectionHeading("Professional Experience")).toBe("experience");
      expect(detectSectionHeading("TECHNICAL PROJECTS")).toBe("projects");
      expect(detectSectionHeading("Projects")).toBe("projects");
      expect(detectSectionHeading("Technical Skills")).toBe("skills");
      expect(detectSectionHeading("Skills & Technologies")).toBe("skills");
      expect(detectSectionHeading("Education & Training")).toBe("education");
      expect(detectSectionHeading("Certifications")).toBe("certifications");
    });

    it("ignores long body sentences containing section keywords", () => {
      expect(
        detectSectionHeading(
          "5+ years of professional experience building scalable web architectures in Next.js and TypeScript."
        )
      ).toBeNull();
      expect(
        detectSectionHeading(
          "Engineered high-throughput projects handling millions of requests per day."
        )
      ).toBeNull();
    });
  });

  describe("extractTechnologies & extractMetrics", () => {
    it("extracts common technologies from text and skills section", () => {
      const text =
        "Built full-stack applications with Next.js, TypeScript, Python, FastAPI, Prisma, PostgreSQL, Docker, and AWS.";
      const techs = extractTechnologies(text, ["Languages: Rust, Go, SQL"]);

      expect(techs).toContain("Next.js");
      expect(techs).toContain("TypeScript");
      expect(techs).toContain("Python");
      expect(techs).toContain("FastAPI");
      expect(techs).toContain("Prisma");
      expect(techs).toContain("PostgreSQL");
      expect(techs).toContain("Docker");
      expect(techs).toContain("AWS");
      expect(techs).toContain("Rust");
      expect(techs).toContain("Go");
      expect(techs).toContain("SQL");
    });

    it("extracts metrics including percentages, volume units, multipliers, and currency", () => {
      const text =
        "Reduced p99 query latency by 45% using Redis caching. Handled 50k events/sec with 99.9% uptime. Accelerated CI build speeds by 2.5x and saved $1.2M annually across 40+ packages.";
      const metrics = extractMetrics(text);

      expect(metrics).toContain("45%");
      expect(metrics).toContain("50k events/sec");
      expect(metrics).toContain("99.9%");
      expect(metrics).toContain("2.5x");
      expect(metrics).toContain("$1.2M");
      expect(metrics).toContain("40+ packages");
    });
  });

  describe("cleanBulletText and assembleBullets", () => {
    it("cleans bullet characters from beginning of lines", () => {
      expect(cleanBulletText("• Built distributed service")).toBe(
        "Built distributed service"
      );
      expect(cleanBulletText("- Implemented caching")).toBe(
        "Implemented caching"
      );
      expect(cleanBulletText("* Deployed with Docker")).toBe(
        "Deployed with Docker"
      );
      expect(cleanBulletText("— Scaled to 1M users")).toBe(
        "Scaled to 1M users"
      );
    });

    it("assembles multi-line wrapped bullets without breaking midway", () => {
      const rawLines = [
        "• Architected distributed event streaming pipeline using Kafka and Go,",
        "  reducing end-to-end event latency from 450ms to 45ms across 12 services.",
        "• Integrated WebAssembly AST parser for Typst rendering in the browser.",
      ];

      const bullets = assembleBullets(rawLines);
      expect(bullets).toHaveLength(2);
      expect(bullets[0]).toBe(
        "Architected distributed event streaming pipeline using Kafka and Go, reducing end-to-end event latency from 450ms to 45ms across 12 services."
      );
      expect(bullets[1]).toBe(
        "Integrated WebAssembly AST parser for Typst rendering in the browser."
      );
    });
  });

  describe("Career Evidence Bank segmentation (EXP-*, PRJ-*, skills matrix)", () => {
    const evidenceBankData: ExtractedPdfEvidence = {
      sourceDoc: "Jayden_Saha_Evidence_Bank.pdf",
      pages: [{ pageNumber: 1, text: "Sample career evidence bank" }],
      sections: {
        experience: [
          "EXP-01 — Acme Corp — Senior Software Engineer [VERIFIED]",
          "Where/when: Remote / May 2023 – Aug 2023",
          "Official title: Staff Full Stack Engineer",
          "• Architected distributed streaming pipeline handling 50k events/sec using Go and Kafka,",
          "  reducing end-to-end event latency from 450ms to 45ms across 12 services.",
          "• Implemented zero-downtime database migrations using Prisma and PostgreSQL.",
          "EXP-02 — Beta Systems — Backend Developer [UNVERIFIED]",
          "Where/when: New York, NY | Jan 2022 – Apr 2023",
          "• Built real-time telemetry dashboard in FastAPI and Python.",
        ],
        projects: [
          "PRJ-01 — ResumeForge — AI-Powered Resume Platform [VERIFIED]",
          "Where/when: Personal Project / 2024",
          "• Built reactive workspace editor with real-time Typst preview in Next.js.",
          "• Automated bullet targeting with deterministic patch verification.",
          "PRJ-02 — Hyperion KV Store [PLANNED]",
          "• Designed distributed key-value store with Raft consensus in Rust.",
        ],
        skills: [
          "Languages & Runtimes: TypeScript, JavaScript, Python, Go, Rust, SQL",
          "Frontend Frameworks: React, Next.js, Tailwind CSS",
          "Backend & Storage: Node.js, FastAPI, PostgreSQL, Prisma, Redis",
          "DevOps & Cloud: Docker, Kubernetes, AWS, CI/CD",
        ],
        education: [
          "Wilfrid Laurier University",
          "Honours Bachelor of Science in Computer Science",
          "2020 – 2024",
        ],
        certifications: [
          "AWS Certified Solutions Architect — Associate",
        ],
        uncategorized: [],
      },
      extractedTechnologies: ["TypeScript", "Next.js", "Go", "Kafka", "Prisma", "PostgreSQL", "Rust", "FastAPI"],
      impactMetrics: ["50k events/sec", "45ms"],
    };

    it("segments discrete EXP-* items with official titles, dates, and verification status", () => {
      const items = convertExtractedPdfToEvidenceItems(evidenceBankData);
      const expItems = items.filter((i) => i.type === "experience");

      expect(expItems).toHaveLength(2);

      // First item: EXP-01
      const exp1 = expItems[0];
      expect(exp1.organization).toBe("Acme Corp");
      expect(exp1.title).toBe("Staff Full Stack Engineer");
      expect(exp1.dates).toBe("Remote / May 2023 – Aug 2023");
      expect(exp1.status).toBe("verified");
      expect(exp1.bullets).toHaveLength(2);
      expect(exp1.bullets[0].verified).toBe(true);
      expect(exp1.bullets[0].text).toContain("reducing end-to-end event latency");

      // Second item: EXP-02 with [UNVERIFIED] -> draft status
      const exp2 = expItems[1];
      expect(exp2.organization).toBe("Beta Systems");
      expect(exp2.title).toBe("Backend Developer");
      expect(exp2.dates).toBe("New York, NY | Jan 2022 – Apr 2023");
      expect(exp2.status).toBe("draft");
      expect(exp2.bullets[0].verified).toBe(false);
    });

    it("segments discrete PRJ-* items with verification status", () => {
      const items = convertExtractedPdfToEvidenceItems(evidenceBankData);
      const projItems = items.filter((i) => i.type === "project");

      expect(projItems).toHaveLength(2);

      const prj1 = projItems[0];
      expect(prj1.title).toBe("ResumeForge");
      expect(prj1.status).toBe("verified");
      expect(prj1.bullets).toHaveLength(2);

      const prj2 = projItems[1];
      expect(prj2.title).toBe("Hyperion KV Store");
      expect(prj2.status).toBe("draft");
      expect(prj2.bullets[0].verified).toBe(false);
    });

    it("groups skills matrix by category with clean tags and bullets", () => {
      const items = convertExtractedPdfToEvidenceItems(evidenceBankData);
      const skillItems = items.filter((i) => i.type === "skill");

      expect(skillItems.length).toBeGreaterThanOrEqual(4);

      const langItem = skillItems.find((s) => s.title.includes("Languages"));
      expect(langItem).toBeDefined();
      expect(langItem?.tags).toContain("TypeScript");
      expect(langItem?.tags).toContain("Python");
      expect(langItem?.tags).toContain("Rust");

      const backendItem = skillItems.find((s) => s.title.includes("Backend"));
      expect(backendItem).toBeDefined();
      expect(backendItem?.tags).toContain("PostgreSQL");
      expect(backendItem?.tags).toContain("Prisma");
    });

    it("extracts discrete education and certification items", () => {
      const items = convertExtractedPdfToEvidenceItems(evidenceBankData);

      const eduItem = items.find((i) => i.type === "education");
      expect(eduItem).toBeDefined();
      expect(eduItem?.organization).toContain("Wilfrid Laurier University");
      expect(eduItem?.title).toContain("Computer Science");

      const certItem = items.find((i) => i.type === "award");
      expect(certItem).toBeDefined();
      expect(certItem?.title).toContain("AWS Certified Solutions Architect");
    });
  });

  describe("Standard resume format segmentation", () => {
    const standardResumeData: ExtractedPdfEvidence = {
      sourceDoc: "standard_resume.pdf",
      pages: [{ pageNumber: 1, text: "Standard Resume Text" }],
      sections: {
        experience: [
          "Google",
          "Software Engineer",
          "May 2022 – Aug 2023 | Mountain View, CA",
          "• Built high-throughput search indexing pipeline in C++ and Go,",
          "  processing 100k requests per second with high availability.",
          "• Optimized query evaluation reducing p99 latency by 35%.",
          "Stripe",
          "Senior Backend Engineer",
          "Jan 2021 – Apr 2022 | San Francisco, CA",
          "• Built payment settlement service handling $10M+ daily volume.",
          "• Scaled database cluster to 100k req/sec with PostgreSQL and Redis.",
        ],
        projects: [
          "ResumeForge | Next.js, TypeScript, Tailwind, Prisma",
          "• Built reactive workspace editor with real-time preview.",
          "• Automated bullet targeting with deterministic patch verification.",
          "Hyperion Engine — Rust, Raft, gRPC",
          "• Implemented Raft consensus protocol from scratch.",
        ],
        skills: [
          "Languages: TypeScript, JavaScript, Python, Go, Rust, C++",
          "Web: Next.js, React, Tailwind CSS",
        ],
        education: [
          "University of Waterloo — B.S. in Computer Science | 2018 – 2022",
        ],
        certifications: [
          "Certified Kubernetes Administrator (CKA)",
        ],
        uncategorized: [],
      },
      extractedTechnologies: ["C++", "Go", "PostgreSQL", "Redis", "Next.js", "TypeScript", "Rust"],
      impactMetrics: ["35%", "$10M+", "100k req/sec"],
    };

    it("identifies individual jobs from standard resume format", () => {
      const items = convertExtractedPdfToEvidenceItems(standardResumeData);
      const expItems = items.filter((i) => i.type === "experience");

      expect(expItems).toHaveLength(2);

      const googleJob = expItems.find((j) => j.organization === "Google");
      expect(googleJob).toBeDefined();
      expect(googleJob?.title).toBe("Software Engineer");
      expect(googleJob?.dates).toContain("May 2022 – Aug 2023");
      expect(googleJob?.bullets).toHaveLength(2);
      expect(googleJob?.bullets[0].text).toContain("processing 100k requests per second");

      const stripeJob = expItems.find((j) => j.organization === "Stripe");
      expect(stripeJob).toBeDefined();
      expect(stripeJob?.title).toBe("Senior Backend Engineer");
      expect(stripeJob?.dates).toContain("Jan 2021 – Apr 2022");
      expect(stripeJob?.bullets).toHaveLength(2);
    });

    it("identifies individual projects from standard resume format", () => {
      const items = convertExtractedPdfToEvidenceItems(standardResumeData);
      const projItems = items.filter((i) => i.type === "project");

      expect(projItems).toHaveLength(2);

      const rfProject = projItems.find((p) => p.title.includes("ResumeForge"));
      expect(rfProject).toBeDefined();
      expect(rfProject?.bullets).toHaveLength(2);
      expect(rfProject?.tags).toContain("Next.js");

      const hypProject = projItems.find((p) => p.title.includes("Hyperion"));
      expect(hypProject).toBeDefined();
      expect(hypProject?.bullets).toHaveLength(1);
    });
  });

  describe("Backward compatibility with flat raw bullets (library-import-search)", () => {
    it("maintains fallback behavior for flat bullet lists without job headers", () => {
      const flatExtracted: ExtractedPdfEvidence = {
        sourceDoc: "flat_resume.pdf",
        pages: [{ pageNumber: 1, text: "Flat text" }],
        sections: {
          experience: [
            "Developed distributed streaming pipeline handling 50k events/sec.",
            "Reduced p99 database query latency by 45% using Redis caching.",
          ],
          projects: [
            "Architected real-time multiplayer code editor with operational transformation.",
          ],
          skills: ["TypeScript", "Rust", "Next.js", "PostgreSQL"],
          education: ["Wilfrid Laurier University, Honours Computer Science"],
          certifications: ["AWS Certified Solutions Architect"],
          uncategorized: [],
        },
        extractedTechnologies: ["TypeScript", "Rust", "Next.js"],
        impactMetrics: ["50k events/sec", "45%"],
      };

      const items = convertExtractedPdfToEvidenceItems(flatExtracted);
      expect(items.length).toBeGreaterThanOrEqual(4);

      const expItem = items.find((i) => i.type === "experience");
      expect(expItem).toBeDefined();
      expect(expItem?.title).toContain("flat_resume");
      expect(expItem?.bullets).toHaveLength(2);

      const projItem = items.find((i) => i.type === "project");
      expect(projItem).toBeDefined();
      expect(projItem?.bullets).toHaveLength(1);

      const skillItem = items.find((i) => i.type === "skill");
      expect(skillItem).toBeDefined();
      expect(skillItem?.bullets.map((b) => b.text)).toContain("TypeScript");

      const eduItem = items.find((i) => i.type === "education");
      expect(eduItem).toBeDefined();
      expect(eduItem?.organization).toContain("Wilfrid Laurier University");
    });
  });

  describe("Edge cases and fallbacks", () => {
    it("handles completely empty sections with fallback to raw page text", () => {
      const emptyDoc: ExtractedPdfEvidence = {
        sourceDoc: "empty_or_unstructured.pdf",
        pages: [{ pageNumber: 1, text: "Some unstructured career narrative text that has no sections at all." }],
        sections: {
          experience: [],
          projects: [],
          skills: [],
          education: [],
          certifications: [],
          uncategorized: [],
        },
        extractedTechnologies: ["TypeScript"],
        impactMetrics: [],
      };

      const items = convertExtractedPdfToEvidenceItems(emptyDoc);
      expect(items).toHaveLength(1);
      expect(items[0].title).toContain("empty_or_unstructured");
      expect(items[0].bullets.length).toBeGreaterThan(0);
    });

    it("extracts EXP-* and PRJ-* items even if placed in uncategorized", () => {
      const uncategorizedData: ExtractedPdfEvidence = {
        sourceDoc: "unparsed_headers.pdf",
        pages: [{ pageNumber: 1, text: "Raw text" }],
        sections: {
          experience: [],
          projects: [],
          skills: [],
          education: [],
          certifications: [],
          uncategorized: [
            "EXP-99 — Autonomous Corp — Robotics Lead [VERIFIED]",
            "Where/when: Boston, MA | 2023",
            "• Built real-time control loop with 1ms latency.",
            "PRJ-99 — OpenBot [VERIFIED]",
            "• Autonomous navigation system.",
          ],
        },
        extractedTechnologies: ["C++"],
        impactMetrics: ["1ms"],
      };

      const items = convertExtractedPdfToEvidenceItems(uncategorizedData);
      const exp = items.find((i) => i.type === "experience");
      expect(exp).toBeDefined();
      expect(exp?.organization).toBe("Autonomous Corp");
      expect(exp?.title).toBe("Robotics Lead");

      const prj = items.find((i) => i.type === "project");
      expect(prj).toBeDefined();
      expect(prj?.title).toBe("OpenBot");
    });

    it("handles single-line jobs with only company name and no role title or dates", () => {
      const minimalJobData: ExtractedPdfEvidence = {
        sourceDoc: "minimal.pdf",
        pages: [{ pageNumber: 1, text: "Minimal" }],
        sections: {
          experience: [
            "Freelance Software Consulting",
            "• Delivered 5 client projects on time and within budget.",
          ],
          projects: [],
          skills: [],
          education: [],
          certifications: [],
          uncategorized: [],
        },
        extractedTechnologies: [],
        impactMetrics: [],
      };

      const items = convertExtractedPdfToEvidenceItems(minimalJobData);
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe("experience");
      expect(items[0].organization).toContain("Freelance Software Consulting");
      expect(items[0].bullets).toHaveLength(1);
    });
  });

  describe("Ligature cleaning & unicode dashes", () => {
    it("cleans PDF font ligature artifacts without breaking words", () => {
      expect(cleanLigatures("O ffi cial title: IT Operations.")).toBe(
        "Official title: IT Operations."
      );
      expect(cleanLigatures("Replaced spreadsheet work fl ows")).toBe(
        "Replaced spreadsheet workflows"
      );
      expect(cleanLigatures("sta ff and learner pools")).toBe(
        "staff and learner pools"
      );
      expect(cleanLigatures("speci fi c next step")).toBe(
        "specific next step"
      );
      expect(cleanLigatures("ResumeForge ⭐ fl agship")).toBe(
        "ResumeForge ⭐ flagship"
      );
      expect(cleanLigatures("Veri fi ed with Vitest")).toBe(
        "Verified with Vitest"
      );
    });

    it("matches unicode dashes including figure dash in DATE_RANGE_REGEX", () => {
      expect(DATE_RANGE_REGEX.test("May 2026 ‒ Present")).toBe(true); // figure dash \u2012
      expect(DATE_RANGE_REGEX.test("January 2022 – April 2023")).toBe(true); // en-dash \u2013
      expect(DATE_RANGE_REGEX.test("2020 — 2024")).toBe(true); // em-dash \u2014
      expect(DATE_RANGE_REGEX.test("2021 to Present")).toBe(true);
    });
  });

  describe("Advanced Career Evidence Bank structures", () => {
    it("preserves unspaced hyphens in names like Ai-Lab, Omni-Architect, and self-study", () => {
      const advancedData: ExtractedPdfEvidence = {
        sourceDoc: "advanced_eb.pdf",
        pages: [{ pageNumber: 1, text: "Sample" }],
        sections: {
          experience: [
            "EXP-04 — The Odin Project (self-study)",
            "When: April 2025 ‒ Present",
            "• Independent curriculum covering full-stack web fundamentals.",
          ],
          projects: [
            "PRJ-04 — Ai-Lab (September 2026)",
            "When: September 2026 ‒ Present",
            "• Built deterministic agentic coding harness in TypeScript.",
            "PRJ-06 — Omni-Architect",
            "When: February 2026 ‒ March 2026",
            "• Built multi-agent AI orchestration system with LangGraph.",
          ],
          skills: [],
          education: [],
          certifications: [],
          uncategorized: [],
        },
        extractedTechnologies: ["TypeScript", "LangGraph"],
        impactMetrics: [],
      };

      const items = convertExtractedPdfToEvidenceItems(advancedData);

      const odin = items.find((i) => i.organization?.includes("Odin"));
      expect(odin).toBeDefined();
      expect(odin?.title).toBe("The Odin Project (self-study)");
      expect(odin?.dates).toBe("April 2025 ‒ Present");

      const ailab = items.find((i) => i.title.includes("Ai-Lab"));
      expect(ailab).toBeDefined();
      expect(ailab?.title).toBe("Ai-Lab");
      expect(ailab?.organization).toBe("Personal Project");
      expect(ailab?.dates).toBe("September 2026 ‒ Present");

      const omni = items.find((i) => i.title.includes("Omni-Architect"));
      expect(omni).toBeDefined();
      expect(omni?.title).toBe("Omni-Architect");
    });

    it("prefers Resume-facing title when present in Official title line", () => {
      const titleData: ExtractedPdfEvidence = {
        sourceDoc: "title_test.pdf",
        pages: [{ pageNumber: 1, text: "Sample" }],
        sections: {
          experience: [
            "EXP-01 — Trillium Health Partners — Clinical License Operations Portal",
            "Where/when: Mississauga, Ontario | May 2026 ‒ Present [VERIFIED]",
            'Official title: IT Operations. Resume-facing: "IT Operations (Software Development)".',
            "• Deployed production clinical license portal in Next.js.",
          ],
          projects: [],
          skills: [],
          education: [],
          certifications: [],
          uncategorized: [],
        },
        extractedTechnologies: ["Next.js"],
        impactMetrics: [],
      };

      const items = convertExtractedPdfToEvidenceItems(titleData);
      const expItems = items.filter((i) => i.type === "experience");
      expect(expItems).toHaveLength(1);
      expect(expItems[0].title).toBe("IT Operations (Software Development)");
      expect(expItems[0].organization).toBe("Trillium Health Partners");
      expect(expItems[0].dates).toBe("Mississauga, Ontario | May 2026 ‒ Present");
    });

    it("prioritizes Resume-ready bullets block and filters out internal candidate notes", () => {
      const notesData: ExtractedPdfEvidence = {
        sourceDoc: "notes_test.pdf",
        pages: [{ pageNumber: 1, text: "Sample" }],
        sections: {
          experience: [],
          projects: [
            "PRJ-01 — ResumeForge ⭐ flagship",
            "GitHub: https://github.com/ZenzerJs/ResumeForge | When: August 2026 ‒ Present",
            "Target families: Fullstack, backend, AI application.",
            "Scale note: Active development with 480 unit tests.",
            "Product: Local-first AI-native resume workspace.",
            "Capabilities [VERIFIED]: Protected master resume + evidence bank.",
            "September 2026 competitive upgrade cycle [REPORTED]: Deterministic match engine.",
            "In-flight [PLANNED]: Client-side PDF ingestion.",
            "Resume-ready bullets:",
            "• Built local-first AI-native resume workspace with Next.js and Prisma. [VERIFIED]",
            "• Implemented deterministic job-description parsing and ATS evaluation. [VERIFIED]",
            "Interview story / differentiator: Commercial AI tools hallucinate experience.",
            "Claim guards: Production only if genuinely used operationally.",
          ],
          skills: [],
          education: [],
          certifications: [],
          uncategorized: [],
        },
        extractedTechnologies: ["Next.js", "Prisma"],
        impactMetrics: [],
      };

      const items = convertExtractedPdfToEvidenceItems(notesData);
      const prjItems = items.filter((i) => i.type === "project");
      expect(prjItems).toHaveLength(1);
      const prj = prjItems[0];
      expect(prj.title).toBe("ResumeForge");
      expect(prj.dates).toBe("August 2026 ‒ Present");
      expect(prj.bullets).toHaveLength(2);
      expect(prj.bullets[0].text).toContain("Built local-first AI-native resume workspace");
      expect(prj.bullets[1].text).toContain("Implemented deterministic job-description parsing");
      // Assert internal notes are not leaked as bullets
      expect(prj.bullets.some((b) => b.text.includes("Interview story"))).toBe(false);
      expect(prj.bullets.some((b) => b.text.includes("Claim guards"))).toBe(false);
      expect(prj.bullets.some((b) => b.text.includes("Scale note"))).toBe(false);
    });

    it("detects wrapped section headings with unclosed parentheses and distinguishes numbered sentences", () => {
      expect(
        detectSectionHeading("2. PROFESSIONAL EXPERIENCE (Evidence IDs: EXP-")
      ).toBe("experience");
      expect(
        detectSectionHeading("4. TECHNICAL SKILLS MATRIX (ATS keyword pool —")
      ).toBe("skills");
      expect(
        detectSectionHeading("5. ROLE ROUTING TABLE (primary agent lookup)")
      ).toBe("uncategorized");
      // Must NOT detect numbered instruction sentences as section headers
      expect(
        detectSectionHeading(
          '3. For each item, use ONLY the "Resume-ready bullets" marked [VERIFIED] or'
        )
      ).toBeNull();
      expect(
        detectSectionHeading(
          '2. Open with the matching hook. Never open with "I am writing to apply for..."'
        )
      ).toBeNull();
    });

    it("assembles multi-line wrapped categories in skills matrix without leaking into unmapped skills", () => {
      const skillsData: ExtractedPdfEvidence = {
        sourceDoc: "skills_test.pdf",
        pages: [{ pageNumber: 1, text: "Sample" }],
        sections: {
          experience: [],
          projects: [],
          skills: [
            "every entry is evidence-backed)",
            "Frontend: Next.js, React, React Native, Tailwind CSS, CSS Grid, Flexbox,",
            "responsive/mobile-first design, Mapbox GL JS, WebGL, GSAP, Lenis, accessibility (reduced",
            "motion).",
            "Backend/APIs: FastAPI, Prisma, REST APIs, Next.js server-side routes, data normalization,",
            "rate-limit handling, server-side secret protection, BYOK architecture, SQLite, JSON",
            "caching, data pipelines.",
          ],
          education: [],
          certifications: [],
          uncategorized: [],
        },
        extractedTechnologies: ["Next.js", "React", "FastAPI", "Prisma"],
        impactMetrics: [],
      };

      const items = convertExtractedPdfToEvidenceItems(skillsData);
      const skillItems = items.filter((i) => i.type === "skill");
      expect(skillItems).toHaveLength(2);

      const frontend = skillItems.find((s) => s.title.includes("Frontend"));
      expect(frontend).toBeDefined();
      expect(frontend?.bullets.map((b) => b.text)).toContain("Next.js");
      expect(frontend?.bullets.map((b) => b.text)).toContain("WebGL");
      expect(frontend?.bullets.map((b) => b.text)).toContain("GSAP");

      const backend = skillItems.find((s) => s.title.includes("Backend/APIs"));
      expect(backend).toBeDefined();
      expect(backend?.bullets.map((b) => b.text)).toContain("FastAPI");
      expect(backend?.bullets.map((b) => b.text)).toContain("rate-limit handling");

      // Verify no broken "Additional Competencies" card is created from wrapped lines
      expect(skillItems.some((s) => s.title.includes("Additional Competencies"))).toBe(false);
    });

    it("extracts clean candidate quick-facts education and ignores false-positive changelog notes", () => {
      const eduData: ExtractedPdfEvidence = {
        sourceDoc: "quick_facts.pdf",
        pages: [{ pageNumber: 1, text: "Quick facts" }],
        sections: {
          experience: [],
          projects: [],
          skills: [],
          education: [],
          certifications: [],
          uncategorized: [
            "name: Jayden Saha",
            "education: BSc Computer Science, Management Option — Wilfrid Laurier",
            "University",
            "graduation: Expected April 2029 # target internships",
            "skills + education. Drop weakest itemsfirst per Section 5.",
            '"Career Education College" → Council; "Scholars Spark" naming consistent; neutral',
            'bio now "CS @ Wilfrid Laurier University · Building reliable full-stack apps"',
          ],
        },
        extractedTechnologies: [],
        impactMetrics: [],
      };

      const items = convertExtractedPdfToEvidenceItems(eduData);
      const eduItems = items.filter((i) => i.type === "education");
      expect(eduItems).toHaveLength(1);

      const edu = eduItems[0];
      expect(edu.title).toBe("BSc Computer Science, Management Option");
      expect(edu.organization).toBe("Wilfrid Laurier University");
      expect(edu.dates).toBe("Expected April 2029");
      expect(edu.bullets[0].text).toBe(
        "BSc Computer Science, Management Option — Wilfrid Laurier University (Expected April 2029)"
      );
    });

    it("joins wrapped date ranges and cleans trailing notes and tags", () => {
      const dateWrappedData: ExtractedPdfEvidence = {
        sourceDoc: "wrapped_dates.pdf",
        pages: [{ pageNumber: 1, text: "Dates" }],
        sections: {
          experience: [
            "EXP-02 — Career Education Council — Scholars Spark iOS App",
            "Where/when: Remote | February 2024 ‒ June 2024. Role framing: App Developer. High",
            "school co-op placement [VERIFIED — confirmed by candidate] .",
            "• Developed and tested Scholars Spark, an iOS app connecting students with curated academic resources.",
            "One concise resume entry max. Details are sparse by nature of the placement. Do not pad or infer.",
          ],
          projects: [
            "PRJ-06 — Omni-Architect",
            "GitHub: https://github.com/ZenzerJs/Omni-Architect | When: February 2026 ‒ March",
            "2026 | Python",
            "• Built a multi-agent AI orchestration system with LangGraph.",
            "PRJ-08 — Geometry Dash RL Agent",
            "When: January 2026. Link: confirm current location before using [UNVERIFIED location] .",
            "• Trained autonomous RL agent in PyTorch.",
          ],
          skills: [],
          education: [],
          certifications: [],
          uncategorized: [],
        },
        extractedTechnologies: ["Python", "PyTorch"],
        impactMetrics: [],
      };

      const items = convertExtractedPdfToEvidenceItems(dateWrappedData);

      const exp = items.find((i) => i.type === "experience");
      expect(exp).toBeDefined();
      expect(exp?.dates).toBe("Remote | February 2024 ‒ June 2024");
      expect(exp?.bullets).toHaveLength(1);
      expect(exp?.bullets[0].text).toContain("Developed and tested Scholars Spark");

      const omni = items.find((i) => i.title === "Omni-Architect");
      expect(omni).toBeDefined();
      expect(omni?.dates).toBe("February 2026 ‒ March 2026");

      const rl = items.find((i) => i.title.includes("Geometry Dash"));
      expect(rl).toBeDefined();
      expect(rl?.dates).toBe("January 2026");
    });
  });
});

