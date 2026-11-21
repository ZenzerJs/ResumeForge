import type { JobRequirements } from "@/lib/jd-parser/types";
import {
  hasUnverifiedMarker,
  matchEvidenceToRequirements,
  matchSkillToken,
  type EvidenceItemWithBullets,
} from "@/lib/matching/matcher";

export type RequirementVerificationStatus =
  | "verified"
  | "needs_verification"
  | "missing";

export type RequirementCategory = "required" | "preferred" | "domain";

export interface EvidenceMatchChecklistItem {
  label: string;
  matched: boolean;
  status: RequirementVerificationStatus;
  category: RequirementCategory;
}

export interface EvidenceMatchChecklist {
  total: number;
  matched: number;
  needsVerification: number;
  percent: number;
  items: EvidenceMatchChecklistItem[];
}

function isVerifiedEvidenceMatchForRequirement(
  item: EvidenceItemWithBullets,
  reqLabel: string,
): boolean {
  if (item.status !== "verified") return false;
  if (
    hasUnverifiedMarker(item.title) ||
    hasUnverifiedMarker(item.verifiedSummary) ||
    hasUnverifiedMarker(item.organization) ||
    item.tags.some((t) => hasUnverifiedMarker(t))
  ) {
    return false;
  }

  const lowerReq = reqLabel.toLowerCase();

  if (
    item.tags.some((t) => t.toLowerCase() === lowerReq || matchSkillToken(t, reqLabel)) ||
    matchSkillToken(item.title, reqLabel) ||
    matchSkillToken(item.verifiedSummary, reqLabel)
  ) {
    return true;
  }

  return item.bullets.some(
    (b) =>
      b.verified &&
      !hasUnverifiedMarker(b.text) &&
      (b.technologies.some((t) => t.toLowerCase() === lowerReq || matchSkillToken(t, reqLabel)) ||
        matchSkillToken(b.text, reqLabel)),
  );
}

/**
 * Builds a checklist of job requirements vs Evidence Bank.
 * Only verified evidence items (via verified summary/title/tags or verified bullets)
 * count as `matched: true` (`status: "verified"`). Draft items or unverified bullets
 * produce `status: "needs_verification"` and do not count as verified matches.
 */
export function buildEvidenceMatchChecklist(
  requirements: JobRequirements,
  evidence: EvidenceItemWithBullets[],
): EvidenceMatchChecklist {
  const rankedWithDrafts = matchEvidenceToRequirements(evidence, requirements, {
    includeDrafts: true,
  });
  const matchedAnyKeys = new Set<string>();
  for (const hit of rankedWithDrafts) {
    for (const req of hit.matchedRequirements) {
      matchedAnyKeys.add(req.toLowerCase());
    }
  }

  const verifiedMatchedKeys = new Set<string>();
  const orderedEntries: Array<{ label: string; category: RequirementCategory }> = [
    ...(requirements.requiredSkills ?? []).map((label) => ({ label, category: "required" as const })),
    ...(requirements.preferredSkills ?? []).map((label) => ({ label, category: "preferred" as const })),
    ...(requirements.domainTerms ?? []).map((label) => ({ label, category: "domain" as const })),
  ];

  const seen = new Set<string>();
  const items: EvidenceMatchChecklistItem[] = [];
  for (const { label, category } of orderedEntries) {
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const isVerifiedMatch = evidence.some((item) =>
      isVerifiedEvidenceMatchForRequirement(item, label),
    );
    if (isVerifiedMatch) {
      verifiedMatchedKeys.add(key);
    }

    const status: RequirementVerificationStatus = isVerifiedMatch
      ? "verified"
      : matchedAnyKeys.has(key)
        ? "needs_verification"
        : "missing";

    items.push({
      label,
      matched: status === "verified",
      status,
      category,
    });
  }

  const matched = items.filter((i) => i.status === "verified").length;
  const needsVerification = items.filter((i) => i.status === "needs_verification").length;
  const total = items.length;
  const percent = total === 0 ? 0 : Math.round((matched / total) * 100);

  return { total, matched, needsVerification, percent, items };
}
