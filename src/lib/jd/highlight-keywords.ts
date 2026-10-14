/**
 * Robust JD keyword highlight tokenizer.
 * Handles tokens with non-word punctuation symbols like C++, C#, .NET, Node.js, AWS/GCP, and CI/CD.
 */

export interface HighlightToken {
  text: string;
  isMatch: boolean;
}

export function tokenizeHighlightedJd(text: string, skills: string[]): HighlightToken[] {
  if (!text) return [];

  const validSkills = skills
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (validSkills.length === 0) {
    return [{ text, isMatch: false }];
  }

  // Sort by length descending so longer compound terms match first (e.g. "JavaScript" before "Java", "ASP.NET" before ".NET")
  const sortedSkills = [...validSkills].sort((a, b) => b.length - a.length);
  const escaped = sortedSkills.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  // Match terms using lookbehind and lookahead so symbols like C++, C#, .NET, and AWS/GCP match correctly
  const regex = new RegExp(`((?<![a-zA-Z0-9])(?:${escaped.join("|")})(?![a-zA-Z0-9]))`, "gi");
  const parts = text.split(regex);

  const lowerSkillsSet = new Set(validSkills.map((s) => s.toLowerCase()));

  return parts
    .filter((p) => p.length > 0)
    .map((part) => ({
      text: part,
      isMatch: lowerSkillsSet.has(part.toLowerCase()),
    }));
}
