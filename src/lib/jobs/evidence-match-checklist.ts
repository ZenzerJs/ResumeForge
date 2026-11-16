import type { JobRequirements } from "@/lib/jd-parser/types";
import {
  matchEvidenceToRequirements,
  type EvidenceItemWithBullets,
} from "@/lib/matching/matcher";

export type RequirementVerificationStatus =
  | "verified"
  | "needs_verification"
  | "missing";

export interface EvidenceMatchChecklistItem {
  label: string;
  matched: boolean;
  status: RequirementVerificationStatus;
}

export interface EvidenceMatchChecklist {
  total: number;
  matched: number;
  needsVerification: number;
  percent: number;
  items: EvidenceMatchChecklistItem[];
}

function containsIgnoreCase(target: string | null | undefined, query: string): boolean {
  if (!target) return false;
  return target.toLowerCase().includes(query.toLowerCase());
}

function isVerifiedEvidenceMatchForRequirement(
  item: EvidenceItemWithBullets,
  reqLabel: string,
): boolean {
  if (item.status !== "verified") return false;
  const lowerReq = reqLabel.toLowerCase();

  if (
    item.tags.some((t) => t.toLowerCase() === lowerReq) ||
    containsIgnoreCase(item.title, reqLabel) ||
    containsIgnoreCase(item.verifiedSummary, reqLabel)
  ) {
    return true;
  }

  return item.bullets.some(
    (b) =>
      b.verified &&
      (b.technologies.some((t) => t.toLowerCase() === lowerReq) ||
        containsIgnoreCase(b.text, reqLabel)),
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
  const ranked = matchEvidenceToRequirements(evidence, requirements);
  const matchedAnyKeys = new Set<string>();
  for (const hit of ranked) {
    for (const req of hit.matchedRequirements) {
      matchedAnyKeys.add(req.toLowerCase());
    }
  }

  const verifiedMatchedKeys = new Set<string>();
  const orderedLabels = [
    ...(requirements.requiredSkills ?? []),
    ...(requirements.preferredSkills ?? []),
    ...(requirements.domainTerms ?? []),
  ];

  const seen = new Set<string>();
  const items: EvidenceMatchChecklistItem[] = [];
  for (const label of orderedLabels) {
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
    });
  }

  const matched = items.filter((i) => i.status === "verified").length;
  const needsVerification = items.filter((i) => i.status === "needs_verification").length;
  const total = items.length;
  const percent = total === 0 ? 0 : Math.round((matched / total) * 100);

  return { total, matched, needsVerification, percent, items };
}
