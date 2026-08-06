import { JobRequirements } from "@/lib/jd-parser/types";
import { AtsEvaluationResult } from "@/lib/ats-evaluator/types";
import { ProviderConfig } from "./types";

export interface QualitativeReviewPromptInput {
  providerConfig: ProviderConfig;
  typstContent: string;
  jobRequirements: JobRequirements;
  rawDescription?: string;
  deterministicResult: AtsEvaluationResult;
}

export function buildQualitativeReviewSystemPrompt(): string {
  return `You are an expert technical resume auditor and ATS qualitative reviewer for ResumeForge.
Your job is to provide QUALITATIVE COMMENTARY ONLY for a candidate's tailored resume draft against a target job posting.

CRITICAL GUARDRAILS & MANDATORY CONSTRAINTS:
1. STRICT JSON OUTPUT ONLY: Your output MUST strictly conform to the JSON schema provided below. Do not wrap in markdown prose outside JSON.
2. NO COMPETING NUMERIC SCORES IN COMMENTARY: You must NEVER invent, calculate, or output any numeric score, grade, or rating inside \`overviewCommentary\` or reasoning fields (e.g. NEVER output "85/100" or "Grade A"). The 100-point deterministic score has already been computed by the engine. Refer to deterministic categories by name only ("Base Resume Health", "Required Role Match", "Preferred Match", "Role-Relevant Evidence").
3. BOUNDED JD CONTEXT ADJUSTMENT (-10 to +10 pts max):
   - You may provide a \`jdContextAdjustment\` signed integer between -10 and +10 inclusive based STRICTLY on how well the resume matches THIS SPECIFIC posting's emphasis (e.g. production ownership vs automated testing emphasis).
   - Do NOT use this adjustment for general resume quality — general quality is already scored by the deterministic engine.
   - For every point of adjustment, you MUST provide an entry in \`adjustmentReasoning\` containing an exact quote or clear paraphrase from the JD (\`jdSignal\`), the integer \`points\`, the target \`targetCategory\` name, and a clear explanation.
   - The sum of \`points\` across \`adjustmentReasoning\` entries MUST equal \`jdContextAdjustment\` exactly.
   - \`jdSignal\` MUST be a specific quote or paraphrase from the JD, never generic placeholders like "important" or "nice to have".
4. NO NEW BULLET REWRITES / NO TYPST PROPOSALS: You MUST NOT output proposed replacement bullet text or Typst code. You only provide feedback and advice (e.g. "Elaborate on the PostgreSQL query optimization metrics"). If improvements are recommended, instruct the candidate to use the AI Patch Generator flow.
5. NO ATS GAMING / NO HIDDEN TEXT: Never recommend adding invisible text, white text, or unverified keyword dumps.

JSON SCHEMA STRUCTURE:
{
  "overviewCommentary": "Qualitative summary without any score numbers (e.g. 'Your backend experience strongly aligns with REST API design...')",
  "categoryFeedbacks": [
    {
      "categoryName": "Required Role Match" | "Base Resume Health" | "Preferred Match" | "Role-Relevant Evidence",
      "observations": ["Detailed observations"],
      "strengths": ["Key strengths"],
      "weaknesses": ["Key areas for improvement"]
    }
  ],
  "bulletFeedbacks": [
    {
      "bulletText": "Exact text of a bullet from the resume",
      "verdict": "STRONG_EVIDENCE" | "WEAK_EVIDENCE" | "KEYWORD_STUFFING" | "VAGUE_CLAIM",
      "reasoning": "Explanation of why this bullet is strong or weak",
      "improvementAdvice": "Guidance on what accomplishment details or metrics to emphasize"
    }
  ],
  "jdContextAdjustment": 3,
  "adjustmentReasoning": [
    {
      "points": 3,
      "jdSignal": "Must have strong hands-on experience with PostgreSQL query optimization",
      "targetCategory": "Required Role Match",
      "explanation": "The posting heavily stresses database optimization depth, which is well-demonstrated in your experience section."
    }
  ],
  "detectedAntiPatterns": ["List of subtle anti-patterns if any"],
  "nextStepsAdvice": ["Actionable guidance pointing to Evidence Bank and AI Patch Generator"]
}`;
}

export function buildQualitativeReviewUserPrompt(
  input: QualitativeReviewPromptInput
): string {
  const { typstContent, jobRequirements, rawDescription, deterministicResult } = input;

  return `Please evaluate the following candidate resume draft against the target job description requirements and deterministic evaluator findings.

TARGET JOB POSTING DETAILS:
- Role Title: ${jobRequirements.roleTitle || "Not specified"}
- Company: ${jobRequirements.company || "Not specified"}
- Required Skills: ${jobRequirements.requiredSkills.join(", ") || "None"}
- Preferred Skills: ${jobRequirements.preferredSkills.join(", ") || "None"}
- Domain Terms: ${jobRequirements.domainTerms.join(", ") || "None"}

RAW JOB DESCRIPTION TEXT:
${rawDescription || "No raw text provided."}

DETERMINISTIC EVALUATOR FINDINGS (Phase 4.3 Baseline):
- Overall Deterministic Base Score: ${deterministicResult.overallScore} / 100
- Base Resume Health: ${deterministicResult.baseHealth.score} / ${deterministicResult.baseHealth.maxScore}
- Required Role Match: ${deterministicResult.requiredMatch.score} / ${deterministicResult.requiredMatch.maxScore}
- Preferred Match: ${deterministicResult.preferredMatch.score} / ${deterministicResult.preferredMatch.maxScore}
- Role-Relevant Evidence (${deterministicResult.selectedProfile}): ${deterministicResult.roleEvidence.score} / ${deterministicResult.roleEvidence.maxScore}
- Skill Demonstration Statuses:
${deterministicResult.skillEvaluations
  .map((s) => `  * ${s.skill} (${s.category}): ${s.status} [${s.score}/${s.maxScore} pts]`)
  .join("\n")}

CANDIDATE TAILORED RESUME (TYPST MARKUP):
\`\`\`typst
${typstContent}
\`\`\`

Provide your qualitative evaluation in strict JSON conforming to the system prompt specification.`;
}
