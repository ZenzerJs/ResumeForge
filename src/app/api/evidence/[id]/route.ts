import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getEvidenceItemById,
  updateEvidenceItem,
  archiveEvidenceItem,
  deleteEvidenceItem,
} from "@/lib/db/evidence";
import { sanitizeError } from "@/lib/ai/redact";
import { getRequestUserId, requireUserId } from "@/lib/security/auth-request";

const BulletSchema = z.object({
  text: z.string().min(1, "Bullet text is required"),
  technologies: z.array(z.string()).optional(),
  roleAffinity: z.array(z.string()).optional(),
  verified: z.boolean().optional(),
  orderIndex: z.number().int().optional(),
});

const UpdateEvidenceSchema = z.object({
  type: z.enum(["experience", "project", "skill", "education", "award", "metric"]).optional(),
  title: z.string().min(1).optional(),
  organization: z.string().optional(),
  dates: z.string().optional(),
  verifiedSummary: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["verified", "draft", "archived"]).optional(),
  bullets: z.array(BulletSchema).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getRequestUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Evidence item not found" },
        { status: 404 }
      );
    }
    const { id } = await params;
    const item = await getEvidenceItemById(id, userId);

    if (!item) {
      return NextResponse.json(
        { success: false, error: "Evidence item not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: item });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch evidence item", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId(request);
    if (userId instanceof NextResponse) return userId;

    const { id } = await params;
    const existing = await getEvidenceItemById(id, userId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Evidence item not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = UpdateEvidenceSchema.safeParse(body);

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

    const updated = await updateEvidenceItem(id, validation.data);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to update evidence item", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId(request);
    if (userId instanceof NextResponse) return userId;

    const { id } = await params;
    const existing = await getEvidenceItemById(id, userId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Evidence item not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    if (mode === "purge") {
      await deleteEvidenceItem(id);
    } else {
      await archiveEvidenceItem(id);
    }

    return NextResponse.json({ success: true, message: "Evidence item processed" });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to delete evidence item", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}
