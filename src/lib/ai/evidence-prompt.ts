import { buildComposedSystemPrompt } from "./master-prompt";

/**
 * Prompt builders for Master Typst → Evidence Bank draft extraction.
 * Creates draft (unverified) evidence candidates only — never auto-verify.
 */

export function buildEvidenceExtractSystemPrompt(): string {
  const taskInstructions = `## TASK-SPECIFIC: MASTER RESUME → EVIDENCE BANK DRAFT EXTRACT

Your task is to extract structured Evidence Bank draft items from a candidate's Master Resume Typst source.

## EXTRACTION GUARDRAILS (IN ADDITION TO MASTER RULES)

1. **ZERO HALLUCINATION**: Extract ONLY facts that appear in the Typst source. Do NOT invent companies, dates, metrics, technologies, or accomplishments.
2. **NO INFLATION**: Do not strengthen wording, round metrics up, or add implied seniority.
3. **DRAFT STATUS INTENT**: Output is for human review as draft evidence. Prefer faithful paraphrase over marketing spin.
4. **STRUCTURE**: Prefer \`experience\` / \`project\` items with bullet arrays. Standalone skill lists may become \`type: "skill"\` items and/or tags on related experience.
5. **SKIP**: Contact headers, pure hobbies without career signal, and decorative layout-only content → list names in \`skippedSections\`.
6. **JSON ONLY**: Return a single JSON object matching the schema below. No markdown fences.
7. **NOT A COVER LETTER**: This task extracts Evidence Bank drafts. Do NOT write a cover letter. Do NOT return \`salutation\`, \`openingParagraph\`, \`bodyParagraphs\`, \`fullMarkdown\`, or \`evidenceCitations\`. Return ONLY \`items\` and \`skippedSections\`.

## OUTPUT JSON SCHEMA

{
  "items": [
    {
      "type": "experience" | "project" | "skill" | "education" | "award" | "metric",
      "title": "Role title, project name, skill cluster, or degree",
      "organization": "Company / school / org if present",
      "dates": "Date range if present",
      "verifiedSummary": "1-3 sentence factual summary grounded ONLY in the Typst text",
      "tags": ["technology", "domain", "keywords from source"],
      "bullets": [
        {
          "text": "Exact or near-exact bullet from the resume",
          "technologies": ["tech mentioned in this bullet"],
          "roleAffinity": ["optional role profile tags e.g. Backend"]
        }
      ]
    }
  ],
  "skippedSections": ["Contact", "Interests"]
}`;

  return buildComposedSystemPrompt(taskInstructions);
}

export function buildEvidenceExtractUserPrompt(typstSource: string): string {
  return `Extract draft Evidence Bank items from this Master Resume Typst source.

## MASTER RESUME (Typst)

\`\`\`typst
${typstSource}
\`\`\`

## INSTRUCTIONS

1. Identify experience, projects, education, skills, awards, and metrics present in the source.
2. Produce one evidence item per role/project/education entry when possible.
3. Copy bullet substance faithfully; attach technologies mentioned in each bullet.
4. List skipped non-evidence sections in skippedSections.
5. Return JSON only matching the system schema (\`items\` + \`skippedSections\`).
6. Do not generate a cover letter.`;
}
