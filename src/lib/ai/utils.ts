/**
 * Cleans raw string output from LLM responses by stripping markdown code fences.
 * Supports ```typst, ```json, ```markdown, or bare ``` wrappers.
 */
export function stripCodeFences(text: string): string {
  if (!text) return "";
  return text
    .trim()
    .replace(/^```(?:typst|json|markdown|text)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}
