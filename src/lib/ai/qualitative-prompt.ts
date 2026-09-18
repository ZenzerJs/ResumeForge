import { JobRequirements } from "@/lib/jd-parser/types";
import { AtsEvaluationResult } from "@/lib/ats-evaluator/types";
import { ProviderConfig } from "./types";
import { buildComposedSystemPrompt } from "./master-prompt";

export interface QualitativeReviewPromptInput {
  providerConfig: ProviderConfig;
  typstContent: string;
  jobRequirements: JobRequirements;
  rawDescription?: string;
  deterministicResult: AtsEvaluationResult;
}

export function buildQualitativeReviewSystemPrompt(): string {
  const taskInstructions = `## TASK-SPECIFIC: QUALITATIVE ATS REVIEW

Provide QUALITATIVE COMMENTARY ONLY. The deterministic ATS score is already computed — do not invent competing grades.

### OUTPUT FORMAT (CRITICAL)
- Return ONE raw JSON object only.
- Do NOT wrap in markdown fences (\`\`\`json).
- Do NOT add prose before or after the JSON.

### HARD VALIDATION RULES
1. overviewCommentary: never include fractions like 85/100, 8/10, or letter grades (Grade A).
2. categoryName MUST be exactly one of:
   - "Base Resume Health"
   - "Required Role Match"
   - "Preferred Match"
   - "Role-Relevant Evidence"
3. verdict MUST be exactly one of:
   - "STRONG_EVIDENCE" | "WEAK_EVIDENCE" | "KEYWORD_STUFFING" | "VAGUE_CLAIM"
4. jdContextAdjustment: integer from -10 to +10 inclusive.
5. If jdContextAdjustment is 0 → adjustmentReasoning MUST be [].
6. If jdContextAdjustment is non-zero → adjustmentReasoning must be non-empty and sum(points) MUST equal jdContextAdjustment.
7. jdSignal must be a specific JD quote/paraphrase (≥5 chars). Never "important", "good fit", "n/a", "none".
8. Do NOT rewrite bullets or output Typst. Advice only.

SAFE DEFAULT: when unsure about JD adjustment, use jdContextAdjustment: 0 and adjustmentReasoning: [].

### CANONICAL VALID JSON SHAPE
{
  "overviewCommentary": "Your experience aligns with API and database priorities in the posting, while orchestration depth remains lightly evidenced.",
  "categoryFeedbacks": [
    {
      "categoryName": "Base Resume Health",
      "observations": ["Clear structure with measurable outcomes."],
      "strengths": ["Concrete technologies in context."],
      "weaknesses": ["Some bullets need stronger ownership language."]
    },
    {
      "categoryName": "Required Role Match",
      "observations": ["Core stack appears in experience bullets."],
      "strengths": ["Database and API work are demonstrated."],
      "weaknesses": ["Missing hands-on orchestration evidence."]
    },
    {
      "categoryName": "Preferred Match",
      "observations": ["Preferred cloud keywords are limited."],
      "strengths": [],
      "weaknesses": ["Preferred cloud exposure is thin."]
    },
    {
      "categoryName": "Role-Relevant Evidence",
      "observations": ["Evidence skews toward backend service work."],
      "strengths": ["Service ownership themes fit a backend overlay."],
      "weaknesses": ["Fewer product-wide delivery examples."]
    }
  ],
  "bulletFeedbacks": [
    {
      "bulletText": "Exact bullet text copied from the resume",
      "verdict": "STRONG_EVIDENCE",
      "reasoning": "Names technology and a concrete outcome.",
      "improvementAdvice": "Add scale metrics from Evidence Bank if available."
    }
  ],
  "jdContextAdjustment": 0,
  "adjustmentReasoning": [],
  "detectedAntiPatterns": [],
  "nextStepsAdvice": [
    "Add verified evidence before claiming unsupported requirements.",
    "Use the AI Patch Generator for evidence-backed edits."
  ]
}`;

  return buildComposedSystemPrompt(taskInstructions);
}

export function buildQualitativeReviewUserPrompt(
  input: QualitativeReviewPromptInput
): string {
  const { typstContent, jobRequirements, rawDescription, deterministicResult } = input;

  return `Evaluate this resume draft against the job posting and deterministic findings.

TARGET JOB:
- Role Title: ${jobRequirements.roleTitle || "Not specified"}
- Company: ${jobRequirements.company || "Not specified"}
- Required Skills: ${jobRequirements.requiredSkills.join(", ") || "None"}
- Preferred Skills: ${jobRequirements.preferredSkills.join(", ") || "None"}
- Domain Terms: ${jobRequirements.domainTerms.join(", ") || "None"}

RAW JOB DESCRIPTION:
${rawDescription || "No raw text provided."}

DETERMINISTIC EVALUATOR FINDINGS (baseline — do not invent a competing score):
- Overall baseline: ${deterministicResult.overallScore} / 100
- Base Resume Health: ${deterministicResult.baseHealth.score} / ${deterministicResult.baseHealth.maxScore}
- Required Role Match: ${deterministicResult.requiredMatch.score} / ${deterministicResult.requiredMatch.maxScore}
- Preferred Match: ${deterministicResult.preferredMatch.score} / ${deterministicResult.preferredMatch.maxScore}
- Role-Relevant Evidence (${deterministicResult.selectedProfile}): ${deterministicResult.roleEvidence.score} / ${deterministicResult.roleEvidence.maxScore}
- Skill statuses:
${deterministicResult.skillEvaluations
  .map((s) => `  * ${s.skill} (${s.category}): ${s.status} [${s.score}/${s.maxScore} pts]`)
  .join("\n")}

CANDIDATE RESUME (TYPST):
\`\`\`typst
${typstContent}
\`\`\`

Respond with ONE raw JSON object matching the canonical schema. Prefer jdContextAdjustment: 0 unless you have a specific JD quote.`;
}
