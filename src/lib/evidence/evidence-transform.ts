import { ExtractedPdfEvidence } from "./pdfExtractor";

export interface CreateEvidencePayload {
  type: string;
  title: string;
  organization?: string;
  dates?: string;
  verifiedSummary: string;
  tags: string[];
  status: string;
  bullets: Array<{ text: string; verified: boolean }>;
}

export function convertExtractedPdfToEvidenceItems(
  extracted: ExtractedPdfEvidence
): CreateEvidencePayload[] {
  const items: CreateEvidencePayload[] = [];
  const baseName = extracted.sourceDoc.replace(/\.pdf$/i, "");

  // 1. Work Experience
  if (extracted.sections.experience && extracted.sections.experience.length > 0) {
    const rawBullets = extracted.sections.experience
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (rawBullets.length > 0) {
      items.push({
        type: "experience",
        title: `Professional Experience (${baseName})`,
        organization: baseName,
        verifiedSummary:
          rawBullets.slice(0, 2).join(". ").slice(0, 200) ||
          `Extracted work experience bullets from ${extracted.sourceDoc}`,
        tags: extracted.extractedTechnologies.slice(0, 6),
        status: "verified",
        bullets: rawBullets.map((text) => ({ text, verified: true })),
      });
    }
  }

  // 2. Projects
  if (extracted.sections.projects && extracted.sections.projects.length > 0) {
    const rawBullets = extracted.sections.projects
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (rawBullets.length > 0) {
      items.push({
        type: "project",
        title: `Technical Projects (${baseName})`,
        organization: "Personal & Academic Projects",
        verifiedSummary:
          rawBullets.slice(0, 2).join(". ").slice(0, 200) ||
          `Extracted project work from ${extracted.sourceDoc}`,
        tags: extracted.extractedTechnologies.slice(0, 6),
        status: "verified",
        bullets: rawBullets.map((text) => ({ text, verified: true })),
      });
    }
  }

  // 3. Technical Skills
  const allSkills = [
    ...extracted.sections.skills,
    ...extracted.extractedTechnologies,
  ]
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (allSkills.length > 0) {
    const uniqueSkills = Array.from(new Set(allSkills));
    items.push({
      type: "skill",
      title: `Technical Competencies & Stack (${baseName})`,
      organization: "Core Competencies",
      verifiedSummary: uniqueSkills.slice(0, 15).join(", ").slice(0, 200),
      tags: uniqueSkills.slice(0, 8),
      status: "verified",
      bullets: uniqueSkills.map((text) => ({ text, verified: true })),
    });
  }

  // 4. Education
  if (extracted.sections.education && extracted.sections.education.length > 0) {
    const rawBullets = extracted.sections.education
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (rawBullets.length > 0) {
      items.push({
        type: "education",
        title: `Education & Academics (${baseName})`,
        organization: rawBullets[0]?.slice(0, 50) || "Academic Institution",
        verifiedSummary: rawBullets.join(" | ").slice(0, 200),
        tags: ["Education", "Degree"],
        status: "verified",
        bullets: rawBullets.map((text) => ({ text, verified: true })),
      });
    }
  }

  // 5. Certifications
  if (extracted.sections.certifications && extracted.sections.certifications.length > 0) {
    const rawBullets = extracted.sections.certifications
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (rawBullets.length > 0) {
      items.push({
        type: "award",
        title: `Certifications & Credentials (${baseName})`,
        organization: "Certification Authority",
        verifiedSummary: rawBullets.join(". ").slice(0, 200),
        tags: ["Certifications"],
        status: "verified",
        bullets: rawBullets.map((text) => ({ text, verified: true })),
      });
    }
  }

  // 6. Fallback: Uncategorized or raw text lines if no specific sections matched
  if (items.length === 0) {
    const rawLines = [
      ...extracted.sections.uncategorized,
      ...extracted.pages.flatMap((p) => p.text.split("\n")),
    ]
      .map((l) => l.trim())
      .filter((l) => l.length > 5);

    if (rawLines.length > 0) {
      items.push({
        type: "experience",
        title: `Indexed Content from ${extracted.sourceDoc}`,
        organization: baseName,
        verifiedSummary: rawLines.slice(0, 3).join(". ").slice(0, 200),
        tags: extracted.extractedTechnologies.slice(0, 5),
        status: "verified",
        bullets: rawLines.slice(0, 25).map((text) => ({ text, verified: true })),
      });
    }
  }

  return items;
}
