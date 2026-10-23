import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type PatchCitationInput = string | { evidenceId?: string; bulletId?: string };
export interface NormalizedPatchCitation { evidenceId?: string; bulletId?: string }
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

export class InvalidPatchCitationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPatchCitationError";
  }
}

/** Exact-ID resolution for legacy string citations and validated current inputs. */
export function normalizePatchCitations(
  references: readonly PatchCitationInput[],
  evidenceItems: readonly EvidenceForCitation[],
  ownerId: string
): NormalizedPatchCitation[] {
  if (references.length === 0) {
    throw new InvalidPatchCitationError("A patch must cite evidence or a verified bullet.");
  }
  const ownerEvidence = evidenceItems.filter(
    (item) => item.userId === ownerId && item.status === "verified"
  );
  const evidenceById = new Map(ownerEvidence.map((item) => [item.id, item]));
  const bulletById = new Map(ownerEvidence.flatMap((item) =>
    item.bullets
      .filter((bullet) => bullet.verified && bullet.evidenceId === item.id)
      .map((bullet) => [bullet.id, { bullet, evidence: item }] as const)
  ));

  return references.map((reference) => {
    if (typeof reference === "string") {
      const evidence = evidenceById.get(reference);
      if (evidence) return { evidenceId: evidence.id };
      const bullet = bulletById.get(reference);
      if (bullet) return { bulletId: bullet.bullet.id };
      throw new InvalidPatchCitationError(
        "Citation is unavailable, unverified, archived, or not owned by this user."
      );
    }
    const evidenceId = reference.evidenceId;
    const bulletId = reference.bulletId;
    if ((!evidenceId && !bulletId) || evidenceId === "" || bulletId === "") {
      throw new InvalidPatchCitationError("A citation needs a non-empty evidenceId or bulletId.");
    }
    const evidence = evidenceId ? evidenceById.get(evidenceId) : undefined;
    const bullet = bulletId ? bulletById.get(bulletId) : undefined;
    if ((evidenceId && !evidence) || (bulletId && !bullet)) {
      throw new InvalidPatchCitationError(
        "Citation is unavailable, unverified, archived, or not owned by this user."
      );
    }
    if (evidence && bullet && bullet.evidence.id !== evidence.id) {
      throw new InvalidPatchCitationError("The cited bullet does not belong to the cited evidence item.");
    }
    return {
      ...(evidenceId ? { evidenceId } : {}),
      ...(bulletId ? { bulletId } : {}),
    };
  });
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
