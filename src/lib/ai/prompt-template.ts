import { EvidenceItemForPrompt, GeneratePatchesInput, TailorFeedbackContext } from "./types";
import { buildComposedSystemPrompt } from "./master-prompt";

/**
 * Builds the system prompt for structured patch generation.
 *
 * Enforces: zero-hallucination, mandatory evidence citations, explicit gap reporting,
 * Typst-clean output, and the PatchProposal JSON schema contract from docs/ai-guardrails.md.
 */
export function buildPatchSystemPrompt(tailorFeedback?: TailorFeedbackContext): string {
  let taskInstructions = `## TASK-SPECIFIC: STRUCTURED RESUME PATCH GENERATION

Your task is to analyze a master resume (in Typst markup format) against a job description's extracted requirements, and propose specific, evidence-backed edits to tailor the resume for the target role.`;

  if (tailorFeedback) {
    taskInstructions += `\n\n## CARRIED TAILOR REVIEW FEEDBACK CONTEXT

The user has explicitly carried over qualitative review feedback from Tailor to guide this tailoring session:
- Overview Commentary: ${tailorFeedback.overviewCommentary}
${tailorFeedback.nextStepsAdvice && tailorFeedback.nextStepsAdvice.length > 0 ? `- Recommended Actions: ${tailorFeedback.nextStepsAdvice.join("; ")}` : ""}

You MUST address the specific points raised in this qualitative feedback while generating patches, while strictly adhering to all master prompt guardrails.`;
  }

  taskInstructions += `\n\n## PATCH & GAP SPECIFIC CONSTRAINTS

1. **ONE-PAGE CONSTRAINT**: The resume must remain within a single page. Do not add content that would cause overflow.
2. **TYPST COMPATIBILITY**: The \`before\` and \`after\` fields must contain valid Typst markup that compiles without errors.
3. **EXACT SUBSTRING MATCH (\`before\`)**: The \`before\` field MUST be a character-for-character verbatim substring copied directly from the Master Resume Typst source (including exact \`*bold*\` markers, punctuation, and escaping). If \`before\` does not match exactly, the patch will fail to apply.
4. **CHARACTER BUDGET (1-PAGE PROTECTION)**: For \`MODIFY_BULLET\` and \`TWEAK_SUMMARY\`, the character length of \`after\` MUST NOT exceed the character length of \`before\` by more than +15% (and ideally stay within ±10 chars) so line wraps do not push the resume onto a second page.
5. **TYPST SYNTAX IN \`after\`**: Preserve Typst inline emphasis (\`*bold*\`, \`_italic_\`) and escape special characters (\`\\@\`, \`\\$\`, \`\\#\`). Never output Markdown \`**bold**\` (double asterisks) inside Typst fields.
6. **NO DUPLICATE KEYWORDS**: Before proposing an \`ADD_SKILL\` patch, verify the skill (or its direct alias, e.g., \`Postgres\` vs \`PostgreSQL\`) is not already present in the Master Resume Skills section.

## OUTPUT FORMAT — STRICT JSON SCHEMA

You MUST return a single valid JSON object matching this exact schema:

\`\`\`json
{
  "patches": [
    {
      "id": "patch-<unique-short-id>",
      "operation": "MODIFY_BULLET" | "ADD_SKILL" | "REORDER_BULLETS" | "TWEAK_SUMMARY",
      "targetSection": "<section name, e.g. Experience, Skills, Summary>",
      "targetId": "<optional: bullet or item ID being modified>",
      "before": "<exact current text from the resume>",
      "after": "<proposed replacement text>",
      "evidenceIds": ["<evidence-item-id-1>", "<bullet-id-1>"],
      "rationale": "<brief explanation of why this change improves job match>",
      "confidence": 0.0 to 1.0
    }
  ],
  "gaps": [
    {
      "requirement": "<the job requirement that cannot be met>",
      "severity": "CRITICAL" | "MODERATE" | "MINOR",
      "recommendation": "<honest advice, e.g. highlight transferable skills>"
    }
  ]
}
\`\`\`

Return ONLY the JSON object. No markdown fences, no prose, no explanations outside the JSON.`;

  return buildComposedSystemPrompt(taskInstructions);
}

/**
 * Builds the user prompt containing the master resume, job requirements, and evidence bank.
 */
export function buildPatchUserPrompt(input: GeneratePatchesInput): string {
  const { masterTypst, jobRequirements, evidenceItems, tailorFeedback } = input;

  const evidenceSection = evidenceItems
    .slice(0, 40)
    .map((item) => formatEvidenceItem(item))
    .join("\n\n")
    .slice(0, 24_000);
  const masterSource = masterTypst.slice(0, 24_000);

  const feedbackSection = tailorFeedback
    ? `\n\n## CARRIED TAILOR REVIEW FEEDBACK CONTEXT\n**Overview Commentary**: ${tailorFeedback.overviewCommentary}`
    : "";

  return `## MASTER RESUME (Typst Source)

\`\`\`typst
${masterSource}
\`\`\`

## TARGET JOB REQUIREMENTS

**Role**: ${jobRequirements.roleTitle || "Not specified"}
**Company**: ${jobRequirements.company || "Not specified"}

**Required Skills**: ${jobRequirements.requiredSkills.join(", ") || "None specified"}
**Preferred Skills**: ${jobRequirements.preferredSkills.join(", ") || "None specified"}
**Domain Concepts**: ${jobRequirements.domainTerms.join(", ") || "None specified"}${feedbackSection}

## EVIDENCE BANK (Your ONLY source of truth — do NOT use information outside this bank)

${evidenceSection || "No evidence items available."}

## INSTRUCTIONS

1. Compare the master resume against the job requirements.
2. For each requirement that CAN be better addressed using evidence from the bank, propose a specific patch.
3. For each requirement that CANNOT be addressed by any evidence in the bank, add a gap entry.
4. Return the JSON response matching the schema specified in your system instructions.`;
}

function formatEvidenceItem(item: EvidenceItemForPrompt): string {
  const bullets = item.bullets
    .map(
      (b) =>
        `  - [Bullet ID: ${b.id}] ${b.text} (Technologies: ${b.technologies.join(", ") || "none"}, Verified: ${b.verified})`
    )
    .join("\n");

  return `### Evidence Item [ID: ${item.id}]
- Type: ${item.type}
- Title: ${item.title}
- Organization: ${item.organization || "N/A"}
- Dates: ${item.dates || "N/A"}
- Status: ${item.status}
- Summary: ${item.verifiedSummary}
- Tags: ${item.tags.join(", ") || "none"}
- Bullets:
${bullets || "  (no bullets)"}`;
}
