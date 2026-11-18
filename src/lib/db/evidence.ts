import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class EvidenceVersionConflictError extends Error {
  public readonly currentUpdatedAt: string;

  constructor(
    currentUpdatedAt: string,
    message = "Evidence item was modified since you last loaded it. Refresh and try again."
  ) {
    super(message);
    this.name = "EvidenceVersionConflictError";
    this.currentUpdatedAt = currentUpdatedAt;
  }
}

export type BulkEvidenceAction =
  | "verify"
  | "archive"
  | "restore"
  | "delete"
  | "preflight_delete";

export type BulkEvidenceOutcome = "succeeded" | "skipped" | "conflict" | "blocked";

export interface BulkEvidenceItemDirective {
  id: string;
  restoreStatus?: "verified" | "draft";
  expectedUpdatedAt?: string;
}

export interface BulkEvidenceActionInput {
  action: BulkEvidenceAction;
  ids: string[];
  items?: BulkEvidenceItemDirective[];
}

export interface BulkEvidenceItemResult {
  id: string;
  title?: string;
  outcome: BulkEvidenceOutcome;
  reason?: string;
  code?: string;
  citationCount?: number;
  status?: string;
  previousStatus?: string;
  updatedAt?: string;
}

export interface BulletInput {
  text: string;
  technologies?: string[];
  roleAffinity?: string[];
  verified?: boolean;
  orderIndex?: number;
}

export interface CreateEvidenceItemInput {
  id?: string;
  type: string; // experience | project | skill | education | award | metric
  title: string;
  organization?: string;
  dates?: string;
  verifiedSummary: string;
  tags?: string[];
  status?: string; // verified | draft | archived
  bullets?: BulletInput[];
  userId?: string;
}

export interface UpdateEvidenceItemInput {
  type?: string;
  title?: string;
  organization?: string;
  dates?: string;
  verifiedSummary?: string;
  tags?: string[];
  status?: string;
  bullets?: BulletInput[];
  expectedUpdatedAt?: string;
}

type TxLike = Prisma.TransactionClient;

async function invalidateOpenProposalBatches(
  tx: TxLike,
  userId?: string | null
): Promise<void> {
  if (!userId) return;
  const delegate = (
    tx as unknown as {
      patchProposalBatch?: {
        updateMany?: (args: {
          where: { userId: string; status: string };
          data: { status: string };
        }) => Promise<unknown>;
      };
    }
  ).patchProposalBatch;
  if (delegate?.updateMany) {
    await delegate.updateMany({
      where: { userId, status: "OPEN" },
      data: { status: "INVALIDATED" },
    });
  }
}

function normalizeIsoTimestamp(value?: string | Date | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export async function getEvidenceItems(statusFilter?: string, userId?: string) {
  const where: Record<string, unknown> = {};
  if (statusFilter && statusFilter !== "all") where.status = statusFilter;
  if (userId) where.userId = userId;

  const items = await prisma.evidenceItem.findMany({
    where,
    include: {
      bullets: {
        orderBy: { orderIndex: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return items.map((item) => ({
    ...item,
    tags: parseJsonArray(item.tags),
    bullets: item.bullets.map((b) => ({
      ...b,
      technologies: parseJsonArray(b.technologies),
      roleAffinity: parseJsonArray(b.roleAffinity),
    })),
  }));
}

export async function getEvidenceItemById(id: string, userId?: string) {
  const item = await prisma.evidenceItem.findFirst({
    where: { id, ...(userId ? { userId } : {}) },
    include: {
      bullets: {
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!item) return null;

  return {
    ...item,
    tags: parseJsonArray(item.tags),
    bullets: item.bullets.map((b) => ({
      ...b,
      technologies: parseJsonArray(b.technologies),
      roleAffinity: parseJsonArray(b.roleAffinity),
    })),
  };
}

export async function createEvidenceItem(input: CreateEvidenceItemInput) {
  const tagsJson = JSON.stringify(input.tags || []);

  const bulletsCreate = (input.bullets || []).map((b, idx) => ({
    text: b.text,
    technologies: JSON.stringify(b.technologies || []),
    roleAffinity: JSON.stringify(b.roleAffinity || []),
    verified: b.verified ?? true,
    orderIndex: b.orderIndex ?? idx,
  }));

  const item = await prisma.evidenceItem.create({
    data: {
      ...(input.id ? { id: input.id } : {}),
      type: input.type,
      title: input.title,
      organization: input.organization || null,
      dates: input.dates || null,
      verifiedSummary: input.verifiedSummary,
      tags: tagsJson,
      status: input.status || "verified",
      userId: input.userId,
      bullets: {
        create: bulletsCreate,
      },
    },
    include: {
      bullets: true,
    },
  });

  return {
    ...item,
    tags: parseJsonArray(item.tags),
    bullets: item.bullets.map((b) => ({
      ...b,
      technologies: parseJsonArray(b.technologies),
      roleAffinity: parseJsonArray(b.roleAffinity),
    })),
  };
}

export async function updateEvidenceItem(
  id: string,
  input: UpdateEvidenceItemInput,
  userId?: string,
) {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.evidenceItem.findFirst({
      where: { id, ...(userId ? { userId } : {}) },
      select: { id: true, userId: true, updatedAt: true },
    });
    if (!existing) return false;

    const expectedIso = normalizeIsoTimestamp(input.expectedUpdatedAt);
    const currentIso = normalizeIsoTimestamp(existing.updatedAt);
    if (expectedIso && currentIso && expectedIso !== currentIso) {
      throw new EvidenceVersionConflictError(currentIso);
    }

    const updateData: Record<string, unknown> = {};

    if (input.type !== undefined) updateData.type = input.type;
    if (input.title !== undefined) updateData.title = input.title;
    if (input.organization !== undefined) updateData.organization = input.organization;
    if (input.dates !== undefined) updateData.dates = input.dates;
    if (input.verifiedSummary !== undefined) updateData.verifiedSummary = input.verifiedSummary;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.tags !== undefined) updateData.tags = JSON.stringify(input.tags);

    if (Object.keys(updateData).length > 0) {
      await tx.evidenceItem.update({
        where: { id },
        data: updateData,
      });
    }

    if (input.status === "verified" && input.bullets === undefined) {
      await tx.bullet.updateMany({
        where: { evidenceId: id, verified: false },
        data: { verified: true },
      });
    }

    if (input.bullets !== undefined) {
      const existingBullets = await tx.bullet.findMany({
        where: { evidenceId: id },
        orderBy: { orderIndex: "asc" },
      });
      const existingIds = existingBullets.map((b) => b.id);
      const citedRows =
        existingIds.length > 0
          ? await tx.patchCitation.findMany({
              where: { bulletId: { in: existingIds } },
              select: { bulletId: true },
            })
          : [];
      const citedIds = new Set(
        citedRows
          .map((c) => c.bulletId)
          .filter((bulletId): bulletId is string => Boolean(bulletId)),
      );

      const reuseCount = Math.min(existingBullets.length, input.bullets.length);
      for (let i = 0; i < reuseCount; i++) {
        const b = input.bullets[i];
        await tx.bullet.update({
          where: { id: existingBullets[i].id },
          data: {
            text: b.text,
            technologies: JSON.stringify(b.technologies || []),
            roleAffinity: JSON.stringify(b.roleAffinity || []),
            verified: b.verified ?? true,
            orderIndex: b.orderIndex ?? i,
          },
        });
      }

      if (input.bullets.length > existingBullets.length) {
        await tx.bullet.createMany({
          data: input.bullets.slice(existingBullets.length).map((b, offset) => ({
            evidenceId: id,
            text: b.text,
            technologies: JSON.stringify(b.technologies || []),
            roleAffinity: JSON.stringify(b.roleAffinity || []),
            verified: b.verified ?? true,
            orderIndex: b.orderIndex ?? existingBullets.length + offset,
          })),
        });
      }

      const uncitedRemovedIds = existingBullets
        .slice(input.bullets.length)
        .map((b) => b.id)
        .filter((bulletId) => !citedIds.has(bulletId));
      if (uncitedRemovedIds.length > 0) {
        await tx.bullet.deleteMany({
          where: { id: { in: uncitedRemovedIds } },
        });
      }
    }

    await invalidateOpenProposalBatches(tx, existing.userId ?? userId);
    return true;
  });

  if (!updated) return null;

  // Transaction committed; re-read outside the transaction callback so the
  // updated row (including synced bullets) is returned to callers.
  return await getEvidenceItemById(id, userId);
}

export async function archiveEvidenceItem(id: string, userId?: string) {
  return await prisma.$transaction(async (tx) => {
    const owned = await tx.evidenceItem.findFirst({
      where: { id, ...(userId ? { userId } : {}) },
      select: { id: true, status: true, userId: true },
    });
    if (!owned) return null;

    const updated = await tx.evidenceItem.update({
      where: { id },
      data: { status: "archived" },
    });
    await invalidateOpenProposalBatches(tx, owned.userId ?? userId);
    return {
      ...updated,
      tags: parseJsonArray(updated.tags),
      previousStatus: owned.status,
    };
  });
}

export async function deleteEvidenceItem(id: string, userId?: string) {
  return await prisma.$transaction(async (tx) => {
    const owned = await tx.evidenceItem.findFirst({
      where: { id, ...(userId ? { userId } : {}) },
      select: { id: true, userId: true },
    });
    if (!owned) return null;

    const deleted = await tx.evidenceItem.delete({
      where: { id },
    });
    await invalidateOpenProposalBatches(tx, owned.userId ?? userId);
    return deleted;
  });
}

async function getCitationCountsByEvidenceIds(
  ids: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (ids.length === 0) return counts;

  const bullets = await prisma.bullet.findMany({
    where: { evidenceId: { in: ids } },
    select: { id: true, evidenceId: true },
  });
  const bulletToEvidence = new Map(bullets.map((b) => [b.id, b.evidenceId]));
  const bulletIds = bullets.map((b) => b.id);

  const orFilters: Array<Record<string, unknown>> = [{ evidenceId: { in: ids } }];
  if (bulletIds.length > 0) {
    orFilters.push({ bulletId: { in: bulletIds } });
  }

  const citations = await prisma.patchCitation.findMany({
    where: { OR: orFilters },
    select: {
      evidenceId: true,
      bulletId: true,
    },
  });

  const targetSet = new Set(ids);
  for (const row of citations) {
    const matched = new Set<string>();
    if (row.evidenceId && targetSet.has(row.evidenceId)) {
      matched.add(row.evidenceId);
    }
    if (row.bulletId) {
      const parentEvidenceId = bulletToEvidence.get(row.bulletId);
      if (parentEvidenceId && targetSet.has(parentEvidenceId)) {
        matched.add(parentEvidenceId);
      }
    }
    for (const eid of matched) {
      counts.set(eid, (counts.get(eid) ?? 0) + 1);
    }
  }
  return counts;
}

export async function preflightEvidenceDeletion(ids: string[], userId?: string) {
  const ownedItems = await prisma.evidenceItem.findMany({
    where: {
      id: { in: ids },
      ...(userId ? { userId } : {}),
    },
    select: { id: true, title: true },
  });
  const ownedMap = new Map(ownedItems.map((item) => [item.id, item]));
  const ownedIds = ownedItems.map((item) => item.id);
  const citationCounts = await getCitationCountsByEvidenceIds(ownedIds);

  const eligibleIds: string[] = [];
  const blocked: Array<{
    id: string;
    title: string;
    citationCount: number;
    reason: string;
  }> = [];
  const notFoundIds: string[] = [];

  for (const id of ids) {
    const item = ownedMap.get(id);
    if (!item) {
      notFoundIds.push(id);
      continue;
    }
    const citationCount = citationCounts.get(id) ?? 0;
    if (citationCount > 0) {
      blocked.push({
        id,
        title: item.title,
        citationCount,
        reason: `Cited by ${citationCount} saved resume patch${citationCount === 1 ? "" : "es"} and cannot be permanently deleted. Archive it instead.`,
      });
    } else {
      eligibleIds.push(id);
    }
  }

  return { eligibleIds, blocked, notFoundIds };
}

function isForeignKeyRestrictionError(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: unknown }).code === "P2003"
  );
}

export async function bulkEvidenceAction(
  input: BulkEvidenceActionInput,
  userId: string
): Promise<{
  action: BulkEvidenceAction;
  results: BulkEvidenceItemResult[];
  summary: Record<BulkEvidenceOutcome, number>;
}> {
  const directiveById = new Map(
    (input.items ?? []).map((entry) => [entry.id, entry])
  );

  const ownedItems = await prisma.evidenceItem.findMany({
    where: {
      id: { in: input.ids },
      userId,
    },
    include: {
      bullets: {
        select: { id: true, verified: true },
      },
    },
  });
  const ownedMap = new Map(ownedItems.map((item) => [item.id, item]));
  const citationCounts =
    input.action === "delete" || input.action === "preflight_delete"
      ? await getCitationCountsByEvidenceIds(ownedItems.map((i) => i.id))
      : new Map<string, number>();

  const results: BulkEvidenceItemResult[] = [];
  const summary: Record<BulkEvidenceOutcome, number> = {
    succeeded: 0,
    skipped: 0,
    conflict: 0,
    blocked: 0,
  };

  let mutatedAny = false;

  for (const id of input.ids) {
    const item = ownedMap.get(id);
    const directive = directiveById.get(id);

    if (!item) {
      summary.skipped += 1;
      results.push({
        id,
        outcome: "skipped",
        reason: "Evidence item not found or unavailable.",
        code: "NOT_FOUND",
      });
      continue;
    }

    const currentIso = normalizeIsoTimestamp(item.updatedAt);
    const expectedIso = normalizeIsoTimestamp(directive?.expectedUpdatedAt);
    if (expectedIso && currentIso && expectedIso !== currentIso) {
      summary.conflict += 1;
      results.push({
        id,
        title: item.title,
        outcome: "conflict",
        reason: "Item was updated since you last loaded it. Refresh before retrying.",
        code: "EVIDENCE_VERSION_CONFLICT",
        updatedAt: currentIso,
      });
      continue;
    }

    if (input.action === "preflight_delete") {
      const citationCount = citationCounts.get(id) ?? 0;
      if (citationCount > 0) {
        summary.blocked += 1;
        results.push({
          id,
          title: item.title,
          outcome: "blocked",
          code: "EVIDENCE_CITATION_RESTRICTED",
          citationCount,
          reason: `Cited by ${citationCount} saved resume patch${citationCount === 1 ? "" : "es"}. Archive it instead.`,
        });
      } else {
        summary.succeeded += 1;
        results.push({
          id,
          title: item.title,
          outcome: "succeeded",
          status: item.status,
          updatedAt: currentIso ?? undefined,
        });
      }
      continue;
    }

    if (input.action === "verify") {
      if (item.status === "archived") {
        summary.skipped += 1;
        results.push({
          id,
          title: item.title,
          outcome: "skipped",
          reason: "Archived items must be restored before verifying.",
          code: "ARCHIVED_SKIPPED",
          status: item.status,
        });
        continue;
      }
      const hasUnverifiedBullets = item.bullets.some((b) => !b.verified);
      if (item.status === "verified" && !hasUnverifiedBullets) {
        summary.skipped += 1;
        results.push({
          id,
          title: item.title,
          outcome: "skipped",
          reason: "Already verified.",
          code: "ALREADY_VERIFIED",
          status: item.status,
        });
        continue;
      }

      const updated = await prisma.$transaction(async (tx) => {
        const nextItem = await tx.evidenceItem.update({
          where: { id },
          data: { status: "verified" },
        });
        await tx.bullet.updateMany({
          where: { evidenceId: id, verified: false },
          data: { verified: true },
        });
        return nextItem;
      });
      mutatedAny = true;
      summary.succeeded += 1;
      results.push({
        id,
        title: item.title,
        outcome: "succeeded",
        status: updated.status,
        previousStatus: item.status,
        updatedAt: normalizeIsoTimestamp(updated.updatedAt) ?? undefined,
      });
      continue;
    }

    if (input.action === "archive") {
      if (item.status === "archived") {
        summary.skipped += 1;
        results.push({
          id,
          title: item.title,
          outcome: "skipped",
          reason: "Already archived.",
          code: "ALREADY_ARCHIVED",
          status: item.status,
        });
        continue;
      }

      const updated = await prisma.evidenceItem.update({
        where: { id },
        data: { status: "archived" },
      });
      mutatedAny = true;
      summary.succeeded += 1;
      results.push({
        id,
        title: item.title,
        outcome: "succeeded",
        status: updated.status,
        previousStatus: item.status,
        updatedAt: normalizeIsoTimestamp(updated.updatedAt) ?? undefined,
      });
      continue;
    }

    if (input.action === "restore") {
      if (item.status !== "archived") {
        summary.skipped += 1;
        results.push({
          id,
          title: item.title,
          outcome: "skipped",
          reason: "Item is not archived.",
          code: "NOT_ARCHIVED",
          status: item.status,
        });
        continue;
      }
      const targetStatus = directive?.restoreStatus ?? "draft";
      const updated = await prisma.evidenceItem.update({
        where: { id },
        data: { status: targetStatus },
      });
      mutatedAny = true;
      summary.succeeded += 1;
      results.push({
        id,
        title: item.title,
        outcome: "succeeded",
        status: updated.status,
        previousStatus: item.status,
        updatedAt: normalizeIsoTimestamp(updated.updatedAt) ?? undefined,
      });
      continue;
    }

    if (input.action === "delete") {
      const citationCount = citationCounts.get(id) ?? 0;
      if (citationCount > 0) {
        summary.blocked += 1;
        results.push({
          id,
          title: item.title,
          outcome: "blocked",
          code: "EVIDENCE_CITATION_RESTRICTED",
          citationCount,
          reason: `Cited by ${citationCount} saved resume patch${citationCount === 1 ? "" : "es"}. Archive it instead.`,
        });
        continue;
      }

      try {
        await prisma.evidenceItem.delete({
          where: { id },
        });
        mutatedAny = true;
        summary.succeeded += 1;
        results.push({
          id,
          title: item.title,
          outcome: "succeeded",
        });
      } catch (err) {
        if (isForeignKeyRestrictionError(err)) {
          summary.blocked += 1;
          results.push({
            id,
            title: item.title,
            outcome: "blocked",
            code: "EVIDENCE_CITATION_RESTRICTED",
            reason:
              "Cited by a saved resume patch and cannot be permanently deleted. Archive it instead.",
          });
        } else {
          throw err;
        }
      }
    }
  }

  if (mutatedAny) {
    await prisma.$transaction(async (tx) => {
      await invalidateOpenProposalBatches(tx, userId);
    });
  }

  return {
    action: input.action,
    results,
    summary,
  };
}

function parseJsonArray(str: string): string[] {
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
