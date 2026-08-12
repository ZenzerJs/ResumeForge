import { createEvidenceItem, getEvidenceItems } from "@/lib/db/evidence";
import type { EvidenceExtractItem, EvidenceExtractResponse } from "@/lib/ai/evidence-extract-schema";

export interface PersistDraftEvidenceResult {
  createdCount: number;
  skippedVerifiedCount: number;
  skippedDuplicateDraftCount: number;
  createdIds: string[];
}

function normalizeKey(type: string, title: string, organization?: string | null): string {
  return `${type}::${title.trim().toLowerCase()}::${(organization || "").trim().toLowerCase()}`;
}

/**
 * Persist AI-extracted evidence as drafts.
 * - Never overwrites verified items (skip).
 * - Skips exact draft duplicates by (type, title, organization).
 */
export async function persistDraftEvidenceFromExtract(
  extract: EvidenceExtractResponse,
  userId?: string
): Promise<PersistDraftEvidenceResult> {
  const existing = await getEvidenceItems(undefined, userId);
  const verifiedKeys = new Set(
    existing
      .filter((e) => e.status === "verified")
      .map((e) => normalizeKey(e.type, e.title, e.organization))
  );
  const draftKeys = new Set(
    existing
      .filter((e) => e.status === "draft")
      .map((e) => normalizeKey(e.type, e.title, e.organization))
  );

  let createdCount = 0;
  let skippedVerifiedCount = 0;
  let skippedDuplicateDraftCount = 0;
  const createdIds: string[] = [];

  for (const item of extract.items as EvidenceExtractItem[]) {
    const key = normalizeKey(item.type, item.title, item.organization);
    if (verifiedKeys.has(key)) {
      skippedVerifiedCount += 1;
      continue;
    }
    if (draftKeys.has(key)) {
      skippedDuplicateDraftCount += 1;
      continue;
    }

    const created = await createEvidenceItem({
      type: item.type,
      title: item.title,
      organization: item.organization,
      dates: item.dates,
      verifiedSummary: item.verifiedSummary,
      tags: item.tags || [],
      status: "draft",
      userId,
      bullets: (item.bullets || []).map((b, idx) => ({
        text: b.text,
        technologies: b.technologies || [],
        roleAffinity: b.roleAffinity || [],
        verified: false,
        orderIndex: idx,
      })),
    });

    draftKeys.add(key);
    createdCount += 1;
    createdIds.push(created.id);
  }

  return {
    createdCount,
    skippedVerifiedCount,
    skippedDuplicateDraftCount,
    createdIds,
  };
}
