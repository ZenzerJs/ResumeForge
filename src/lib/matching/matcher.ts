import { JobRequirements } from "@/lib/jd-parser/types";

export interface BulletWithTags {
  id: string;
  text: string;
  technologies: string[];
  roleAffinity: string[];
  verified: boolean;
  orderIndex?: number;
}

export interface EvidenceItemWithBullets {
  id: string;
  type: string;
  title: string;
  organization?: string | null;
  dates?: string | null;
  verifiedSummary: string;
  tags: string[];
  status: string; // verified | draft | archived
  bullets: BulletWithTags[];
}

export interface MatchedBullet {
  id: string;
  text: string;
  technologies: string[];
  verified: boolean;
  matchedRequirements: string[];
}

export interface RankedEvidenceMatch {
  id: string;
  title: string;
  type: string;
  organization: string | null;
  dates: string | null;
  status: string;
  isDraft: boolean;
  verifiedSummary: string;
  tags: string[];
  score: number;
  matchPercentage: number;
  matchedRequirements: string[];
  matchedBullets: MatchedBullet[];
}

export function matchEvidenceToRequirements(
  evidenceItems: EvidenceItemWithBullets[],
  requirements: JobRequirements
): RankedEvidenceMatch[] {
  const { requiredSkills = [], preferredSkills = [], domainTerms = [] } = requirements;

  // Total possible max weight for percentage calculation
  const totalPossiblePoints =
    requiredSkills.length * 3 + preferredSkills.length * 2 + domainTerms.length * 1;

  const results: RankedEvidenceMatch[] = [];

  for (const item of evidenceItems) {
    // Rule 1: Exclude archived items entirely
    if (item.status === "archived") {
      continue;
    }

    const itemTagsSet = new Set(item.tags.map((t) => t.toLowerCase()));

    // Collect all bullet technology tags for this item
    const bulletTechsSet = new Set<string>();
    for (const b of item.bullets) {
      for (const tech of b.technologies) {
        bulletTechsSet.add(tech.toLowerCase());
      }
    }

    const itemMatchedReqsSet = new Set<string>();
    let score = 0;

    // Check requiredSkills matches (+3 points)
    for (const reqSkill of requiredSkills) {
      const lowerReq = reqSkill.toLowerCase();
      if (itemTagsSet.has(lowerReq) || bulletTechsSet.has(lowerReq) || containsIgnoreCase(item.title, reqSkill) || containsIgnoreCase(item.verifiedSummary, reqSkill)) {
        score += 3;
        itemMatchedReqsSet.add(reqSkill);
      }
    }

    // Check preferredSkills matches (+2 points)
    for (const prefSkill of preferredSkills) {
      const lowerPref = prefSkill.toLowerCase();
      if (itemTagsSet.has(lowerPref) || bulletTechsSet.has(lowerPref) || containsIgnoreCase(item.title, prefSkill) || containsIgnoreCase(item.verifiedSummary, prefSkill)) {
        score += 2;
        itemMatchedReqsSet.add(prefSkill);
      }
    }

    // Check domainTerms matches (+1 point)
    for (const domainTerm of domainTerms) {
      const lowerDomain = domainTerm.toLowerCase();
      if (itemTagsSet.has(lowerDomain) || bulletTechsSet.has(lowerDomain) || containsIgnoreCase(item.title, domainTerm) || containsIgnoreCase(item.verifiedSummary, domainTerm)) {
        score += 1;
        itemMatchedReqsSet.add(domainTerm);
      }
    }

    // Match individual bullets
    const matchedBullets: MatchedBullet[] = [];

    for (const b of item.bullets) {
      const bulletTechSet = new Set(b.technologies.map((t) => t.toLowerCase()));
      const bulletMatchedReqsSet = new Set<string>();

      for (const reqSkill of requiredSkills) {
        if (bulletTechSet.has(reqSkill.toLowerCase()) || containsIgnoreCase(b.text, reqSkill)) {
          bulletMatchedReqsSet.add(reqSkill);
        }
      }
      for (const prefSkill of preferredSkills) {
        if (bulletTechSet.has(prefSkill.toLowerCase()) || containsIgnoreCase(b.text, prefSkill)) {
          bulletMatchedReqsSet.add(prefSkill);
        }
      }
      for (const domainTerm of domainTerms) {
        if (bulletTechSet.has(domainTerm.toLowerCase()) || containsIgnoreCase(b.text, domainTerm)) {
          bulletMatchedReqsSet.add(domainTerm);
        }
      }

      if (bulletMatchedReqsSet.size > 0 || itemMatchedReqsSet.size > 0) {
        matchedBullets.push({
          id: b.id,
          text: b.text,
          technologies: b.technologies,
          verified: b.verified,
          matchedRequirements: Array.from(bulletMatchedReqsSet),
        });
      }
    }

    // Only include items that have at least one match or non-zero score
    if (score > 0 || itemMatchedReqsSet.size > 0) {
      const matchPercentage =
        totalPossiblePoints > 0
          ? Math.min(100, Math.round((score / totalPossiblePoints) * 100))
          : 0;

      results.push({
        id: item.id,
        title: item.title,
        type: item.type,
        organization: item.organization || null,
        dates: item.dates || null,
        status: item.status,
        isDraft: item.status === "draft",
        verifiedSummary: item.verifiedSummary,
        tags: item.tags,
        score,
        matchPercentage,
        matchedRequirements: Array.from(itemMatchedReqsSet),
        matchedBullets,
      });
    }
  }

  // Sort descending by score
  return results.sort((a, b) => b.score - a.score);
}

function containsIgnoreCase(target: string | null | undefined, query: string): boolean {
  if (!target) return false;
  return target.toLowerCase().includes(query.toLowerCase());
}
