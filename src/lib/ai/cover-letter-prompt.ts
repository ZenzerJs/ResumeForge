import type { GenerateCoverLetterInput } from "./cover-letter-schema";
import type { EvidenceItemForPrompt } from "./types";

export function buildCoverLetterSystemPrompt(): string {
  return `You are ResumeForge AI Cover Letter Specialist, an expert career advisor and technical writer.
Your task is to write a highly compelling, professional, tailored cover letter for a candidate applying for a target job.

CRITICAL SECURITY & EVIDENCE GROUNDING CONTRACT:
1. MANDATORY EVIDENCE GROUNDING: You MUST base all candidate claims, metrics, and experience strictly on the verified Evidence Bank items provided in the prompt.
2. ZERO HALLUCINATION: You MUST NOT invent companies, years of experience, metric percentages, or technologies that do not exist in the candidate's provided Evidence Bank items.
3. ADVERSARIAL GAP HANDLING: If a job requirement (e.g. Kubernetes, AWS, Go) is NOT supported by any item in the candidate's Evidence Bank, you MUST NOT claim or fabricate experience with that technology. Either omit the unsupported requirement or explicitly represent it as a gap/review-needed item in the "gapsAddressed" array. Never use confident generic wording to assert unverified skills.
4. CITATIONS: In the "evidenceCitations" JSON array, return every evidence ID (e.g. "exp-1", "bullet-101") that you referenced or drew from to write the body paragraphs.
5. NO ATS GAMING: Do not use keyword stuffing, white text, or deceptive phrasing.
6. STRUCTURED OUTPUT: You MUST return ONLY valid JSON conforming to the CoverLetterResponse schema without markdown codeblocks or extraneous commentary outside JSON.

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
}

export function buildCoverLetterUserPrompt(
  input: GenerateCoverLetterInput,
  evidenceItems: EvidenceItemForPrompt[]
): string {
  const company = input.company || "Hiring Organization";
  const roleTitle = input.roleTitle || "Target Position";

  const evidenceSummary = evidenceItems
    .map((item) => {
      const bulletsText = (item.bullets || [])
        .map((b: { id: string; text: string }) => `  - [ID: ${b.id}] ${b.text}`)
        .join("\n");
      return `Item [ID: ${item.id}] ${item.title} (${item.organization || "N/A"})\nSummary: ${item.verifiedSummary}\nBullets:\n${bulletsText}`;
    })
    .join("\n\n");

  return `TARGET JOB DETAILS:
- Company: ${company}
- Role Title: ${roleTitle}
- Target Role Profile Overlay: ${input.activeRoleProfile}
- Raw Description Excerpt:
${input.rawDescription.slice(0, 1500)}

CANDIDATE VERIFIED EVIDENCE BANK:
${evidenceSummary}

INSTRUCTIONS:
Craft a 3-4 paragraph tailored cover letter for ${company} (${roleTitle}). Ground all claims in verified evidence IDs. If job requirements are unsupported by evidence, omit them or flag in gapsAddressed. Return valid JSON only.`;
}
