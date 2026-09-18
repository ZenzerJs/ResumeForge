import type { JobRequirements } from "@/lib/jd-parser/types";
import {
  matchEvidenceToRequirements,
  type EvidenceItemWithBullets,
} from "@/lib/matching/matcher";

export interface EvidenceMatchChecklistItem {
  label: string;
  matched: boolean;
}

export interface EvidenceMatchChecklist {
  total: number;
  matched: number;
  percent: number;
  items: EvidenceMatchChecklistItem[];
}

/**
 * Builds a Glassdoor-style checklist of job requirements vs Evidence Bank.
 * A requirement is matched when any non-archived evidence item matched that
 * string (case-insensitive) via `matchEvidenceToRequirements`.
 */
export function buildEvidenceMatchChecklist(
  requirements: JobRequirements,
  evidence: EvidenceItemWithBullets[],
): EvidenceMatchChecklist {
  const ranked = matchEvidenceToRequirements(evidence, requirements);
  const matchedKeys = new Set<string>();
  for (const hit of ranked) {
    for (const req of hit.matchedRequirements) {
      matchedKeys.add(req.toLowerCase());
    }
  }

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
    items.push({ label, matched: matchedKeys.has(key) });
  }

  const matched = items.filter((i) => i.matched).length;
  const total = items.length;
  const percent = total === 0 ? 0 : Math.round((matched / total) * 100);

  return { total, matched, percent, items };
}
