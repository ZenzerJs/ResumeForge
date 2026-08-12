import type { GenerateCoverLetterInput } from "./cover-letter-schema";
import type { EvidenceItemForPrompt } from "./types";
import { buildComposedSystemPrompt } from "./master-prompt";

export function buildCoverLetterSystemPrompt(): string {
  const taskInstructions = `## TASK-SPECIFIC: TAILORED COVER LETTER SPECIALIST

Your task is to write a highly compelling, professional, tailored cover letter for a candidate applying for a target job.

CITATIONS & COVER LETTER CONSTRAINTS:
1. CITATIONS: In the "evidenceCitations" JSON array, return every evidence ID (e.g. "exp-1", "bullet-101") that you referenced or drew from to write the body paragraphs.
2. ADVERSARIAL GAP HANDLING: If a job requirement (e.g. Kubernetes, AWS, Go) is NOT supported by any item in the candidate's Evidence Bank, you MUST NOT claim or fabricate experience with that technology. Either omit the unsupported requirement or explicitly represent it as a gap/review-needed item in the "gapsAddressed" array.

OUTPUT JSON SCHEMA:
{
  "title": "Cover Letter — [Company] [RoleTitle]",
  "salutation": "Dear [Hiring Manager / Hiring Team at Company],",
  "openingParagraph": "Strong 2-3 sentence hook referencing the candidate's enthusiasm, target role title, company name, and core value proposition.",
  "bodyParagraphs": [
    "First body paragraph detailing specific technical achievements grounded in evidence items...",
    "Second body paragraph highlighting problem-solving, scale, and role alignment..."
  ],
  "closingParagraph": "Polite, confident closing statement thanking the reader, expressing eagerness for an interview, and offering to discuss qualifications.",
  "fullMarkdown": "# Cover Letter\n\nDear Hiring Team,\n\n[Opening]\n\n[Body]\n\n[Closing]\n\nSincerely,\nCandidate",
  "evidenceCitations": ["exp-1", "bullet-101"],
  "gapsAddressed": []
}`;

  return buildComposedSystemPrompt(taskInstructions);
}

export function buildCoverLetterUserPrompt(
  input: GenerateCoverLetterInput,
  evidenceItems: EvidenceItemForPrompt[],
  masterTypstSource?: string
): string {
  const company = input.company || "Hiring Organization";
  const roleTitle = input.roleTitle || "Target Position";
  const candidateName = input.candidateName || "Candidate";

  const verified = evidenceItems.filter((item) => item.status === "verified");
  const drafts = evidenceItems.filter((item) => item.status === "draft");
  const preferred = verified.length > 0 ? verified : evidenceItems;

  const formatEvidence = (items: EvidenceItemForPrompt[], label: string) => {
    if (items.length === 0) return `${label}: (none)\n`;
    return `${label}:\n${items
      .map((item) => {
        const bulletsText = (item.bullets || [])
          .map((b: { id: string; text: string }) => `  - [ID: ${b.id}] ${b.text}`)
          .join("\n");
        return `Item [ID: ${item.id}] ${item.title} (${item.organization || "N/A"}) [${item.status}]\nSummary: ${item.verifiedSummary}\nBullets:\n${bulletsText}`;
      })
      .join("\n\n")}\n`;
  };

  const reqs = input.extractedRequirements as
    | { requiredSkills?: string[]; preferredSkills?: string[]; domainTerms?: string[] }
    | undefined;
  const reqBlock = reqs
    ? `EXTRACTED REQUIREMENTS:
- Required: ${(reqs.requiredSkills || []).join(", ") || "n/a"}
- Preferred: ${(reqs.preferredSkills || []).join(", ") || "n/a"}
- Domain: ${(reqs.domainTerms || []).join(", ") || "n/a"}`
    : "";

  const jdExcerpt = input.rawDescription.slice(0, 6000);
  const masterBlock = masterTypstSource?.trim()
    ? `CANDIDATE MASTER RESUME (Typst — use for tone, role history, and phrasing; still cite Evidence Bank IDs for claims):
\`\`\`
${masterTypstSource.slice(0, 8000)}
\`\`\`
`
    : "CANDIDATE MASTER RESUME: (not available — ground exclusively in Evidence Bank)\n";

  return `TARGET JOB DETAILS:
- Company: ${company}
- Role Title: ${roleTitle}
- Candidate Name: ${candidateName}
- Target Role Profile Overlay: ${input.activeRoleProfile}
- Raw Job Description:
${jdExcerpt}

${reqBlock}

${masterBlock}
${formatEvidence(preferred, "CANDIDATE EVIDENCE BANK (prefer verified)")}
${drafts.length > 0 && verified.length > 0 ? formatEvidence(drafts, "DRAFT EVIDENCE (use sparingly; label as unverified if used)") : ""}

INSTRUCTIONS:
Write a professional 3–4 paragraph cover letter for ${candidateName} applying to ${roleTitle} at ${company}.
- Ground every concrete claim in Evidence Bank IDs listed above; put those IDs in evidenceCitations.
- Mirror the candidate's real experience from the master resume and evidence — do not invent employers, metrics, or skills.
- Prefer verified evidence; never present draft-only claims as verified fact.
- fullMarkdown MUST be a complete letter with salutation, blank-line paragraph spacing, closing, and signature "${candidateName}".
- Omit unsupported JD requirements or list them only in gapsAddressed.
Return valid JSON only.`;
}
