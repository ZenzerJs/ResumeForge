import { buildComposedSystemPrompt } from "./master-prompt";
import { TypstRepairInput } from "./repair-schema";

export const TYPST_REPAIR_INSTRUCTIONS = `
# TYPST COMPILATION REPAIR ASSISTANT CONTRACT

You are an expert Typst WASM compilation repair assistant for ResumeForge.
Your SOLE task is to diagnose and fix the provided Typst compilation error while preserving the document's content, structure, and styling.

## REPAIR RULES
1. Fix ONLY what is necessary to resolve the compilation error.
2. NEVER invent resume facts, work history, companies, dates, or metrics.
3. Preserve existing template helper functions (e.g., #let section(title), #let entry(...)), imports, and styling.
4. Do NOT remove valid resume sections or content merely to hide a syntax error.
5. If the source/error context is insufficient or unfixable, set confidence to "low" and add a clear warning in the warnings array.
6. Output MUST be strictly valid JSON conforming to the schema below. No markdown fences outside the JSON.

## OUTPUT JSON SCHEMA CONTRACT
{
  "summary": "<1-sentence summary of the fix>",
  "errorAnalysis": "<detailed explanation of what caused the compile error and how it was fixed>",
  "replacementSource": "<complete, valid, corrected Typst document source string>",
  "confidence": "high" | "medium" | "low",
  "warnings": ["<optional list of warnings or caveats>"]
}
`;

export function buildTypstRepairSystemPrompt(): string {
  return buildComposedSystemPrompt(TYPST_REPAIR_INSTRUCTIONS);
}

export function buildTypstRepairUserPrompt(input: TypstRepairInput): string {
  const lineInfo = input.line !== undefined ? `Line ${input.line}` : "Unknown line";
  const colInfo = input.column !== undefined ? `, Column ${input.column}` : "";
  const excerptBlock = input.sourceExcerpt
    ? `\n### Failing Source Excerpt:\n\`\`\`typst\n${input.sourceExcerpt}\n\`\`\``
    : "";

  return `### COMPILER ERROR:
${input.compileError}
Location: ${lineInfo}${colInfo}
${excerptBlock}

### CURRENT TYPST SOURCE DOCUMENT:
\`\`\`typst
${input.source}
\`\`\`

Return your response strictly as JSON conforming to the TypstRepairProposal contract.`;
}
