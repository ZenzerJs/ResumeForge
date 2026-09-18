import { TECH_SKILLS_DICTIONARY, TECH_ALIASES, DOMAIN_TERMS_DICTIONARY } from "./dictionary";
import { JobRequirements, JobRequirementsSchema } from "./types";

export function parseJobDescription(rawText: string): JobRequirements {
  if (!rawText || !rawText.trim()) {
    return JobRequirementsSchema.parse({
      requiredSkills: [],
      preferredSkills: [],
      domainTerms: [],
    });
  }

  const lines = rawText.split(/\r?\n/);
  const requiredSkillsSet = new Set<string>();
  const preferredSkillsSet = new Set<string>();
  const domainTermsSet = new Set<string>();

  const requiredHeaderRegex = /(?:required|qualifications|must have|requirements|what you bring|minimum qualifications|basic qualifications|what we're looking for)/i;
  const preferredHeaderRegex = /(?:preferred|nice to have|pluses|bonus|desirable|additional qualifications|preferred qualifications)/i;

  let currentSection: "required" | "preferred" | "general" = "general";

  // Pre-build regex matchers for dictionary terms to handle word boundaries
  const techTermsWithRegex = TECH_SKILLS_DICTIONARY.map((term) => ({
    canonical: term,
    regex: new RegExp(`\\b${escapeRegExp(term)}\\b`, "i"),
  }));

  const aliasTermsWithRegex = Object.entries(TECH_ALIASES).map(([alias, canonical]) => ({
    canonical,
    regex: new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i"),
  }));

  const domainTermsWithRegex = DOMAIN_TERMS_DICTIONARY.map((term) => ({
    canonical: term,
    regex: new RegExp(`\\b${escapeRegExp(term)}\\b`, "i"),
  }));

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if line is a section header
    if (preferredHeaderRegex.test(trimmed) && trimmed.length < 80) {
      currentSection = "preferred";
    } else if (requiredHeaderRegex.test(trimmed) && trimmed.length < 80) {
      currentSection = "required";
    }

    // Match tech skills
    for (const { canonical, regex } of techTermsWithRegex) {
      if (regex.test(trimmed)) {
        if (currentSection === "preferred") {
          preferredSkillsSet.add(canonical);
        } else {
          requiredSkillsSet.add(canonical);
        }
      }
    }

    // Match aliases
    for (const { canonical, regex } of aliasTermsWithRegex) {
      if (regex.test(trimmed)) {
        if (currentSection === "preferred") {
          preferredSkillsSet.add(canonical);
        } else {
          requiredSkillsSet.add(canonical);
        }
      }
    }

    // Match domain terms
    for (const { canonical, regex } of domainTermsWithRegex) {
      if (regex.test(trimmed)) {
        domainTermsSet.add(canonical);
      }
    }
  }

  // Remove items from preferred if they are already in required
  const requiredSkills = Array.from(requiredSkillsSet);
  const preferredSkills = Array.from(preferredSkillsSet).filter(
    (skill) => !requiredSkillsSet.has(skill)
  );
  const domainTerms = Array.from(domainTermsSet);

  // Attempt role title, company, and location extraction from header lines
  const roleTitle = extractRoleTitle(lines);
  const company = extractCompany(lines);
  const location = extractLocation(lines);

  return JobRequirementsSchema.parse({
    requiredSkills,
    preferredSkills,
    domainTerms,
    roleTitle,
    company,
    location,
  });
}

function extractRoleTitle(lines: string[]): string | undefined {
  // First check explicit Title: / Role: / Position: header lines in first 15 lines
  for (const line of lines.slice(0, 15)) {
    const trimmed = line.trim();
    const titleMatch = trimmed.match(/^(?:title|role|position|job title):\s*(.+)$/i);
    if (titleMatch && titleMatch[1].trim()) {
      return titleMatch[1].trim();
    }
  }

  const rolePatterns = [
    /(?:software|senior|staff|lead|principal|junior)?\s*(?:engineer|developer|architect|data scientist)\b/i,
    /(?:frontend|back-end|backend|fullstack|full-stack|ai\/ml|data|devops)\s*(?:engineer|developer|lead)?\b/i,
  ];

  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    for (const pattern of rolePatterns) {
      if (pattern.test(trimmed) && trimmed.length < 80) {
        return trimmed;
      }
    }
  }
  return undefined;
}

function extractCompany(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 15)) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(?:company|organization|employer|company name):\s*(.+)$/i);
    if (match && match[1].trim()) {
      return match[1].trim();
    }
  }
  return undefined;
}

function extractLocation(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 15)) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(?:location|place|job location|office location):\s*(.+)$/i);
    if (match && match[1].trim()) {
      return match[1].trim();
    }
  }
  return undefined;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
