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

export interface MatchEvidenceOptions {
  /**
   * When true, includes draft items and unverified bullets (still excluding archived items).
   * Defaults to false so verified match scoring never leaks draft or unverified evidence.
   */
  includeDrafts?: boolean;
}

const UNVERIFIED_MARKER_RE = /\[\s*(?:UNVERIFIED|PLANNED)\b[^\]]*\]/i;

export function hasUnverifiedMarker(text: string | null | undefined): boolean {
  if (!text) return false;
  return UNVERIFIED_MARKER_RE.test(text);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Boundary-aware skill token matcher.
 * Prevents short tokens (Go, C, R, AI, SQL) from matching inside unrelated words
 * (algorithm, cargo, sqlite, postgresql, react) while handling C++, C#, .NET, Node.js, Next.js.
 */
export function matchSkillToken(
  text: string | null | undefined,
  skill: string
): boolean {
  if (!text || !skill) return false;
  const trimmed = skill.trim();
  if (!trimmed) return false;

  const escaped = escapeRegExp(trimmed).replace(/\s+/g, "\\s+");
  const startsWithDot = trimmed.startsWith(".");
  const isSingleChar = trimmed.length === 1;

  const leftBoundary = startsWithDot
    ? "(?<![A-Za-z0-9_])"
    : isSingleChar
      ? "(?<![A-Za-z0-9_.-])"
      : "(?<![A-Za-z0-9_.])";

  const rightBoundary = isSingleChar
    ? "(?![A-Za-z0-9_+#&-])"
    : "(?![A-Za-z0-9_+#])";

  const regex = new RegExp(`${leftBoundary}${escaped}${rightBoundary}`, "i");
  return regex.test(text);
}

function matchesSkillList(list: string[], label: string, lowerKey: string): boolean {
  return list.some((entry) => {
    const trimmed = entry.trim();
    if (!trimmed) return false;
    return trimmed.toLowerCase() === lowerKey || matchSkillToken(trimmed, label);
  });
}

export function matchEvidenceToRequirements(
  evidenceItems: EvidenceItemWithBullets[],
  requirements: JobRequirements,
  options: MatchEvidenceOptions = {}
): RankedEvidenceMatch[] {
  const { includeDrafts = false } = options;
  const { requiredSkills = [], preferredSkills = [], domainTerms = [] } = requirements;

  // Deduplicate requirements case-insensitively, keeping highest weight:
  // requiredSkills (3) > preferredSkills (2) > domainTerms (1)
  const requirementEntries: Array<{ label: string; key: string; weight: number }> = [];
  const seenReqKeys = new Map<string, number>();

  const addReqs = (list: string[], weight: number) => {
    for (const raw of list) {
      const label = raw.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      const existingIdx = seenReqKeys.get(key);
      if (existingIdx !== undefined) {
        if (weight > requirementEntries[existingIdx].weight) {
          requirementEntries[existingIdx] = { label, key, weight };
        }
        continue;
      }
      seenReqKeys.set(key, requirementEntries.length);
      requirementEntries.push({ label, key, weight });
    }
  };

  addReqs(requiredSkills, 3);
  addReqs(preferredSkills, 2);
  addReqs(domainTerms, 1);

  const totalPossiblePoints = requirementEntries.reduce((sum, req) => sum + req.weight, 0);

  const results: RankedEvidenceMatch[] = [];

  for (const item of evidenceItems) {
    // Rule 1: Exclude archived items entirely
    if (item.status === "archived") {
      continue;
    }

    const itemHasUnverifiedMarker =
      hasUnverifiedMarker(item.title) ||
      hasUnverifiedMarker(item.verifiedSummary) ||
      hasUnverifiedMarker(item.organization) ||
      item.tags.some((t) => hasUnverifiedMarker(t));

    const isItemVerified = item.status === "verified" && !itemHasUnverifiedMarker;

    // Rule 2: Exclude draft/unverified items from verified match scoring unless includeDrafts is set
    if (!includeDrafts && !isItemVerified) {
      continue;
    }

    // Rule 3: Only check verified bullets (without [UNVERIFIED]/[PLANNED] markers) in verified mode
    const eligibleBullets = includeDrafts
      ? item.bullets
      : item.bullets.filter((b) => b.verified && !hasUnverifiedMarker(b.text));

    const bulletMatchesMap = new Map<string, Set<string>>();
    for (const b of eligibleBullets) {
      const matchedReqs = new Set<string>();
      for (const req of requirementEntries) {
        if (
          matchesSkillList(b.technologies, req.label, req.key) ||
          matchSkillToken(b.text, req.label)
        ) {
          matchedReqs.add(req.label);
        }
      }
      if (matchedReqs.size > 0) {
        bulletMatchesMap.set(b.id, matchedReqs);
      }
    }

    const itemMatchedReqsSet = new Set<string>();
    let score = 0;

    for (const req of requirementEntries) {
      const matchedInItemMeta =
        matchesSkillList(item.tags, req.label, req.key) ||
        matchSkillToken(item.title, req.label) ||
        matchSkillToken(item.verifiedSummary, req.label);

      const matchedInEligibleBullets = eligibleBullets.some((b) =>
        bulletMatchesMap.get(b.id)?.has(req.label)
      );

      if (matchedInItemMeta || matchedInEligibleBullets) {
        score += req.weight;
        itemMatchedReqsSet.add(req.label);
      }
    }

    // Only include bullets that actually matched at least one requirement
    const matchedBullets: MatchedBullet[] = [];
    for (const b of eligibleBullets) {
      const matchedReqs = bulletMatchesMap.get(b.id);
      if (matchedReqs && matchedReqs.size > 0) {
        matchedBullets.push({
          id: b.id,
          text: b.text,
          technologies: b.technologies,
          verified: b.verified,
          matchedRequirements: Array.from(matchedReqs),
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
        isDraft: !isItemVerified,
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
