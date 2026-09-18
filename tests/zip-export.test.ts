import { describe, it, expect } from "vitest";
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
    expect(cleaned).toContain("github.com/janedoe (https://github.com/janedoe)");
    expect(cleaned).toContain("--- EXPERIENCE ---");
    expect(cleaned).toContain("Stripe -- Software Engineer");
    expect(cleaned).not.toContain("#show");
  });
});
