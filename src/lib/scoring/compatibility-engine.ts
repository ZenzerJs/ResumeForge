import { JobRequirements } from "@/lib/jd-parser/types";
import { EvidenceItemWithBullets } from "@/lib/matching/matcher";

export interface CompatibilityResult {
  overallScore: number; // 0 - 100
  requiredScore: number; // 0 - 100
  preferredScore: number; // 0 - 100
  matchedSkills: string[];
  missingSkills: string[];
  matchedPreferred: string[];
  missingPreferred: string[];
  matchedEvidenceCount: number;
  totalRequiredCount: number;
  totalPreferredCount: number;
  compatibilityTier: "HIGH" | "MEDIUM" | "LOW";
}

const COMMON_SYNONYMS: Record<string, string[]> = {
  go: ["golang"],
  golang: ["go"],
  react: ["react.js", "reactjs"],
  "react.js": ["react", "reactjs"],
  postgres: ["postgresql", "psql"],
  postgresql: ["postgres", "psql"],
  node: ["node.js", "nodejs"],
  "node.js": ["node", "nodejs"],
  typescript: ["ts"],
  javascript: ["js"],
  k8s: ["kubernetes"],
  kubernetes: ["k8s"],
  aws: ["amazon web services"],
  gcp: ["google cloud", "google cloud platform"],
  azure: ["microsoft azure"],
  docker: ["containers", "containerization"],
  rest: ["restful", "restful apis", "rest api"],
};

function normalizeSkill(skill: string): string {
  return skill.toLowerCase().trim().replace(/[-_]/g, " ");
}

function skillsMatch(skillA: string, skillB: string): boolean {
  const a = normalizeSkill(skillA);
  const b = normalizeSkill(skillB);

  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  const synonyms = COMMON_SYNONYMS[a] || [];
  if (synonyms.some((syn) => normalizeSkill(syn) === b || b.includes(normalizeSkill(syn)))) {
    return true;
  }

  const synonymsB = COMMON_SYNONYMS[b] || [];
  if (synonymsB.some((syn) => normalizeSkill(syn) === a || a.includes(normalizeSkill(syn)))) {
    return true;
  }

  return false;
}

/**
 * Fast deterministic compatibility calculation between candidate skills/evidence and job requirements.
 */
export function calculateJobCompatibility(
  requirements: JobRequirements | null | undefined,
  candidateSkills: string[],
  evidenceItems: EvidenceItemWithBullets[] = []
): CompatibilityResult {
  const reqSkills = requirements?.requiredSkills || [];
  const prefSkills = requirements?.preferredSkills || [];

  const activeEvidence = evidenceItems.filter((e) => e.status !== "archived");

  // Collect candidate skill knowledge bank
  const allCandidateSkills = new Set<string>();
  for (const s of candidateSkills) {
    if (s && s.trim()) allCandidateSkills.add(normalizeSkill(s));
  }
  for (const item of activeEvidence) {
    for (const tag of item.tags || []) {
      if (tag && tag.trim()) allCandidateSkills.add(normalizeSkill(tag));
    }
    for (const bullet of item.bullets || []) {
      for (const tech of bullet.technologies || []) {
        if (tech && tech.trim()) allCandidateSkills.add(normalizeSkill(tech));
      }
    }
  }

  const candidateArray = Array.from(allCandidateSkills);

  // Evaluate required skills
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const req of reqSkills) {
    const isMatched = candidateArray.some((cand) => skillsMatch(cand, req));
    if (isMatched) {
      matchedSkills.push(req);
    } else {
      missingSkills.push(req);
    }
  }

  // Evaluate preferred skills
  const matchedPreferred: string[] = [];
  const missingPreferred: string[] = [];

  for (const pref of prefSkills) {
    const isMatched = candidateArray.some((cand) => skillsMatch(cand, pref));
    if (isMatched) {
      matchedPreferred.push(pref);
    } else {
      missingPreferred.push(pref);
    }
  }

  // Calculate scores
  const requiredScore =
    reqSkills.length > 0 ? Math.round((matchedSkills.length / reqSkills.length) * 100) : 80;

  const preferredScore =
    prefSkills.length > 0 ? Math.round((matchedPreferred.length / prefSkills.length) * 100) : 70;

  // Count evidence items that back at least one matched skill
  let matchedEvidenceCount = 0;
  for (const item of activeEvidence) {
    const itemSkills = [
      ...(item.tags || []),
      ...(item.bullets?.flatMap((b) => b.technologies || []) || []),
    ];
    const supportsRequirement = [...matchedSkills, ...matchedPreferred].some((req) =>
      itemSkills.some((s) => skillsMatch(s, req))
    );
    if (supportsRequirement) {
      matchedEvidenceCount++;
    }
  }

  // Weight required skills 80%, preferred 20%
  let overallScore = 0;
  if (reqSkills.length > 0 && prefSkills.length > 0) {
    overallScore = Math.round(requiredScore * 0.8 + preferredScore * 0.2);
    if (requiredScore === 100 && overallScore < 80) {
      overallScore = 80;
    }
  } else if (reqSkills.length > 0) {
    overallScore = requiredScore;
  } else if (prefSkills.length > 0) {
    overallScore = preferredScore;
  } else {
    overallScore = 75;
  }

  const compatibilityTier =
    overallScore >= 80 ? "HIGH" : overallScore >= 60 ? "MEDIUM" : "LOW";

  return {
    overallScore,
    requiredScore,
    preferredScore,
    matchedSkills,
    missingSkills,
    matchedPreferred,
    missingPreferred,
    matchedEvidenceCount,
    totalRequiredCount: reqSkills.length,
    totalPreferredCount: prefSkills.length,
    compatibilityTier,
  };
}
