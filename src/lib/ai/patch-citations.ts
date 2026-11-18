import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  InvalidPatchCitationError,
  createVerifiedEvidenceRegistry,
  resolvePatchCitationReferences,
  type PatchCitationInput,
  type NormalizedPatchCitation,
  type ResolvedEvidenceRegistry,
} from "@/lib/ai/patch-schema";

export {
  InvalidPatchCitationError,
  createVerifiedEvidenceRegistry,
  resolvePatchCitationReferences,
  type PatchCitationInput,
  type NormalizedPatchCitation,
};
export interface PatchCitationReadResult {
  citations: NormalizedPatchCitation[];
  unresolvedLegacyReferences: string[];
}

interface EvidenceForCitation {
  id: string;
  userId: string | null;
  status: string;
  bullets: Array<{ id: string; evidenceId: string; verified: boolean }>;
}
type CitationLookup = Pick<Prisma.TransactionClient, "evidenceItem">;

/** Exact-ID resolution for legacy string citations and validated current inputs. */
export function normalizePatchCitations(
  references: readonly PatchCitationInput[],
  evidenceItems: readonly EvidenceForCitation[],
  ownerId: string
): NormalizedPatchCitation[] {
  const registry = createVerifiedEvidenceRegistry(evidenceItems, ownerId);
  return resolvePatchCitationReferences(references, registry);
}

/**
 * Validates and builds normalized Prisma PatchCitation create inputs for a patch proposal
 * against a pre-resolved verified evidence registry.
 */
export function validateAndBuildPatchCitations(
  proposal: { evidenceIds: readonly string[]; citations?: readonly PatchCitationInput[] },
  registry: ResolvedEvidenceRegistry
): Array<{ evidenceId?: string; bulletId?: string }> {
  const sourceRefs =
    proposal.citations && proposal.citations.length > 0
      ? proposal.citations
      : proposal.evidenceIds;
  return resolvePatchCitationReferences(sourceRefs, registry).map((cit) => ({
    ...(cit.evidenceId ? { evidenceId: cit.evidenceId } : {}),
    ...(cit.bulletId
      ? {
          bulletId: cit.bulletId,
          evidenceId: cit.evidenceId ?? registry.bulletToEvidenceId.get(cit.bulletId),
        }
      : {}),
  }));
}

async function findVerifiedOwnerEvidence(
  client: CitationLookup,
  ownerId: string
): Promise<EvidenceForCitation[]> {
  return client.evidenceItem.findMany({
    where: { userId: ownerId, status: "verified" },
    include: { bullets: { select: { id: true, evidenceId: true, verified: true } } },
  });
}

/** Validate and persist using the caller's transaction after creating the Patch row. */
export async function createPatchCitations(
  tx: Prisma.TransactionClient,
  input: { patchId: string; ownerId: string; citations: readonly PatchCitationInput[] }
): Promise<NormalizedPatchCitation[]> {
  const patch = await tx.patch.findFirst({
    where: { id: input.patchId, variant: { masterResume: { userId: input.ownerId } } },
    select: { id: true },
  });
  if (!patch) {
    throw new InvalidPatchCitationError("Patch is unavailable or not owned by this user.");
  }
  const evidence = await findVerifiedOwnerEvidence(tx, input.ownerId);
  const normalized = normalizePatchCitations(input.citations, evidence, input.ownerId);
  await tx.patchCitation.createMany({
    data: normalized.map((citation) => ({
      patchId: input.patchId,
      evidenceId: citation.evidenceId,
      bulletId: citation.bulletId,
    })),
  });
  return normalized;
}

function parseLegacyIds(value: string): { ids: string[]; unresolved: string[] } {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return { ids: [], unresolved: ["<legacy citations are not an array>"] };
    const ids: string[] = [];
    const unresolved: string[] = [];
    for (const entry of parsed) {
      if (typeof entry === "string" && entry.length > 0) ids.push(entry);
      else unresolved.push(JSON.stringify(entry) ?? "<unserializable legacy reference>");
    }
    return { ids, unresolved };
  } catch {
    return { ids: [], unresolved: ["<legacy citations are invalid JSON>"] };
  }
}

/** Prefer normalized rows; legacy IDs resolve only when an exact owner-scoped match exists. */
export async function readPatchCitations(
  patchId: string,
  ownerId: string,
  client: typeof prisma = prisma
): Promise<PatchCitationReadResult | null> {
  const patch = await client.patch.findFirst({
    where: { id: patchId, variant: { masterResume: { userId: ownerId } } },
    select: {
      evidenceCitations: true,
      citations: { select: { evidenceId: true, bulletId: true } },
    },
  });
  if (!patch) return null;
  if (patch.citations.length > 0) {
    return {
      citations: patch.citations.map((citation) => ({
        ...(citation.evidenceId ? { evidenceId: citation.evidenceId } : {}),
        ...(citation.bulletId ? { bulletId: citation.bulletId } : {}),
      })),
      unresolvedLegacyReferences: [],
    };
  }

  const parsed = parseLegacyIds(patch.evidenceCitations);
  const unresolved = [...parsed.unresolved];
  if (parsed.ids.length === 0) return { citations: [], unresolvedLegacyReferences: unresolved };
  const items = await client.evidenceItem.findMany({
    where: {
      userId: ownerId,
      OR: [
        { id: { in: parsed.ids } },
        { bullets: { some: { id: { in: parsed.ids } } } },
      ],
    },
    include: { bullets: { where: { id: { in: parsed.ids } } } },
  });
  const evidenceIds = new Set(items.map((item) => item.id));
  const bulletIds = new Set(items.flatMap((item) => item.bullets.map((bullet) => bullet.id)));
  const citations: NormalizedPatchCitation[] = [];
  for (const id of parsed.ids) {
    if (evidenceIds.has(id)) citations.push({ evidenceId: id });
    else if (bulletIds.has(id)) citations.push({ bulletId: id });
    else unresolved.push(id);
  }
  return { citations, unresolvedLegacyReferences: unresolved };
}
