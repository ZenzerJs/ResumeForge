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

export async function getEvidenceItems(statusFilter?: string) {
  const where = statusFilter && statusFilter !== "all" ? { status: statusFilter } : {};

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

export async function getEvidenceItemById(id: string) {
  const item = await prisma.evidenceItem.findUnique({
    where: { id },
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

export async function updateEvidenceItem(id: string, input: UpdateEvidenceItemInput) {
  return await prisma.$transaction(async (tx) => {
    const updateData: Record<string, unknown> = {};

    if (input.type !== undefined) updateData.type = input.type;
    if (input.title !== undefined) updateData.title = input.title;
    if (input.organization !== undefined) updateData.organization = input.organization;
    if (input.dates !== undefined) updateData.dates = input.dates;
    if (input.verifiedSummary !== undefined) updateData.verifiedSummary = input.verifiedSummary;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.tags !== undefined) updateData.tags = JSON.stringify(input.tags);

    // If bullets provided, recreate bullets
    if (input.bullets !== undefined) {
      await tx.bullet.deleteMany({
        where: { evidenceId: id },
      });

      const bulletsCreate = input.bullets.map((b, idx) => ({
        text: b.text,
        technologies: JSON.stringify(b.technologies || []),
        roleAffinity: JSON.stringify(b.roleAffinity || []),
        verified: b.verified ?? true,
        orderIndex: b.orderIndex ?? idx,
      }));

      await tx.evidenceItem.update({
        where: { id },
        data: {
          ...updateData,
          bullets: {
            create: bulletsCreate,
          },
        },
      });
    } else {
      await tx.evidenceItem.update({
        where: { id },
        data: updateData,
      });
    }

    return await getEvidenceItemById(id);
  });
}

export async function archiveEvidenceItem(id: string) {
  return await prisma.evidenceItem.update({
    where: { id },
    data: { status: "archived" },
  });
}

export async function deleteEvidenceItem(id: string) {
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
