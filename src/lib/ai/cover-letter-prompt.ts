import type { GenerateCoverLetterInput } from "./cover-letter-schema";
import type { EvidenceItemForPrompt } from "./types";
import { buildComposedSystemPrompt } from "./master-prompt";

export function buildCoverLetterSystemPrompt(): string {
  const taskInstructions = `## TASK-SPECIFIC: TAILORED COVER LETTER SPECIALIST

Write a professional, evidence-grounded cover letter. Never invent employers, metrics, or skills.

### ADVERSARIAL GAP HANDLING
If a job requirement (e.g. Kubernetes, AWS, Go) is NOT supported by any item in the candidate's Evidence Bank, you MUST NOT claim or fabricate experience with that technology. Either omit the unsupported requirement or list it in gapsAddressed.

### OUTPUT FORMAT (CRITICAL)
- Return ONE raw JSON object only.
- Do NOT wrap in markdown fences (\`\`\`json).
- Do NOT add prose before or after the JSON.

### HARD VALIDATION RULES
1. evidenceCitations: every Evidence/Bullet ID you used from the prompt. If Evidence Bank has items, include at least one valid ID.
2. Never claim JD requirements unsupported by evidence — omit them or list in gapsAddressed.
3. Length floors:
   - openingParagraph ≥ 20 chars
   - each bodyParagraphs entry ≥ 30 chars
   - closingParagraph ≥ 20 chars
   - fullMarkdown ≥ 100 chars (complete letter)
4. fullMarkdown must include salutation, blank-line paragraphs, closing, and signature.
5. NATURAL HUMAN VOICE (NO SYSTEM META-LANGUAGE): Never mention "my Evidence Bank", "verified experience", "master resume", or "evidence citations" inside the cover letter text. Write naturally as the candidate speaking directly to the hiring team.
6. SYNCHRONIZED MARKDOWN: fullMarkdown must contain the exact same text as salutation + openingParagraph + bodyParagraphs + closingParagraph + signature, separated by \\n\\n. Do not summarize or truncate inside fullMarkdown.

### CANONICAL VALID JSON SHAPE
{
  "title": "Cover Letter — Acme Corp Senior Backend Engineer",
  "salutation": "Dear Hiring Team at Acme Corp,",
  "openingParagraph": "I am writing to apply for the Senior Backend Engineer role at Acme Corp. My background building production APIs and high-throughput data systems aligns with your reliability and scale priorities.",
  "bodyParagraphs": [
    "At Acme Platform, I architected TypeScript REST APIs and optimized PostgreSQL indexing, cutting p95 query latency by 40% across 1,000+ daily active users.",
    "I also partnered with infrastructure engineers on containerized microservice deployments, improving release predictability and observability across core services."
  ],
  "closingParagraph": "Thank you for considering my application. I would welcome the chance to discuss how my backend engineering background can support Acme Corp's roadmap.",
  "fullMarkdown": "# Cover Letter — Acme Corp Senior Backend Engineer\\n\\nDear Hiring Team at Acme Corp,\\n\\nI am writing to apply for the Senior Backend Engineer role at Acme Corp. My background building production APIs and high-throughput data systems aligns with your reliability and scale priorities.\\n\\nAt Acme Platform, I architected TypeScript REST APIs and optimized PostgreSQL indexing, cutting p95 query latency by 40% across 1,000+ daily active users.\\n\\nI also partnered with infrastructure engineers on containerized microservice deployments, improving release predictability and observability across core services.\\n\\nThank you for considering my application. I would welcome the chance to discuss how my backend engineering background can support Acme Corp's roadmap.\\n\\nSincerely,\\nCandidate",
  "evidenceCitations": ["exp-1", "bullet-101"],
  "gapsAddressed": ["No verified Kubernetes production ownership in Evidence Bank."]
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
    ? `CANDIDATE MASTER RESUME (Typst — use for tone/history; still cite Evidence Bank IDs for claims):
\`\`\`
${masterTypstSource.slice(0, 8000)}
\`\`\`
`
    : "CANDIDATE MASTER RESUME: (not available — ground exclusively in Evidence Bank)\n";

  const availableIds = preferred
    .flatMap((item) => [item.id, ...(item.bullets || []).map((b) => b.id)])
    .filter(Boolean);

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

AVAILABLE CITATION IDS (use only these in evidenceCitations):
${availableIds.length > 0 ? availableIds.map((id) => `- ${id}`).join("\n") : "- (none)"}

INSTRUCTIONS:
Write a 3–4 paragraph cover letter for ${candidateName} applying to ${roleTitle} at ${company}.
- Return ONE raw JSON object matching the canonical schema (no markdown fences).
- Cite real Evidence Bank IDs in evidenceCitations (required when IDs are listed above).
- Do not invent experience. Unsupported JD requirements go in gapsAddressed.
- fullMarkdown must be the complete letter signed "${candidateName}".
- Meet minimum lengths: opening≥20, each body≥30, closing≥20, fullMarkdown≥100.`;
}
