import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { createEvidenceItem, getEvidenceItemById, getEvidenceItems, getEvidenceStatusCounts } from "@/lib/db/evidence";
import { sanitizeError } from "@/lib/ai/redact";
import { getRequestUserId, requireUserId } from "@/lib/security/auth-request";

const BulletSchema = z.object({
  text: z.string().min(1, "Bullet text is required"),
  technologies: z.array(z.string()).optional(),
  roleAffinity: z.array(z.string()).optional(),
  verified: z.boolean().optional(),
  orderIndex: z.number().int().optional(),
});

const CreateEvidenceSchema = z.object({
  importId: z.string().regex(/^pdf-import-[a-f0-9]{32}-[0-9]{1,8}$/).optional(),
  type: z.enum(["experience", "project", "skill", "education", "award", "metric"]),
  title: z.string().min(1, "Title is required"),
  organization: z.string().optional(),
  dates: z.string().optional(),
  verifiedSummary: z.string().min(1, "Verified summary is required"),
  tags: z.array(z.string()).optional(),
  status: z.enum(["verified", "draft", "archived"]).optional(),
  bullets: z.array(BulletSchema).optional(),
});

export async function GET(request: Request) {
  try {
    const userId = await getRequestUserId(request);
    if (!userId) {
      return NextResponse.json({ success: true, data: [], guest: true });
    }
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;

    const [items, counts] = await Promise.all([
      getEvidenceItems(status, userId),
      getEvidenceStatusCounts(userId).catch(() => undefined),
    ]);
    return NextResponse.json({ success: true, data: items, ...(counts ? { counts } : {}) });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch evidence items", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = await request.json();
    const validation = CreateEvidenceSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request payload",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { importId, ...payload } = validation.data;
    try {
      const newItem = await createEvidenceItem({ ...payload, ...(importId ? { id: importId } : {}), userId });
      return NextResponse.json({ success: true, data: newItem }, { status: 201 });
    } catch (error) {
      if (importId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await getEvidenceItemById(importId, userId);
        if (existing) return NextResponse.json({ success: true, data: existing });
        return NextResponse.json({ success: false, error: "Evidence import could not be saved." }, { status: 409 });
      }
      throw error;
    }
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to create evidence item", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}
