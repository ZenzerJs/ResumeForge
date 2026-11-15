import { prisma } from "@/lib/prisma";

export interface BulletInput {
  text: string;
  technologies?: string[];
  roleAffinity?: string[];
  verified?: boolean;
  orderIndex?: number;
}

export interface CreateEvidenceItemInput {
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
      select: { id: true },
    });
    if (!existing) return false;

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

    return true;
  });

  if (!updated) return null;

  // Transaction committed; re-read outside the transaction callback so the
  // updated row (including synced bullets) is returned to callers.
  return await getEvidenceItemById(id, userId);
}

export async function archiveEvidenceItem(id: string, userId?: string) {
  if (userId) {
    const owned = await prisma.evidenceItem.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!owned) return null;
  }
  return await prisma.evidenceItem.update({
    where: { id },
    data: { status: "archived" },
  });
}

export async function deleteEvidenceItem(id: string, userId?: string) {
  if (userId) {
    const owned = await prisma.evidenceItem.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!owned) return null;
  }
  return await prisma.evidenceItem.delete({
    where: { id },
  });
}

function parseJsonArray(str: string): string[] {
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
