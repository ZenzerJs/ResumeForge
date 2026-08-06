import { NextResponse } from "next/server";
import { z } from "zod";
import { createEvidenceItem, getEvidenceItems } from "@/lib/db/evidence";

const BulletSchema = z.object({
  text: z.string().min(1, "Bullet text is required"),
  technologies: z.array(z.string()).optional(),
  roleAffinity: z.array(z.string()).optional(),
  verified: z.boolean().optional(),
  orderIndex: z.number().int().optional(),
});

const CreateEvidenceSchema = z.object({
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
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;

    const items = await getEvidenceItems(status);
    return NextResponse.json({ success: true, data: items });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch evidence items", message: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
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

    const newItem = await createEvidenceItem(validation.data);
    return NextResponse.json({ success: true, data: newItem }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to create evidence item", message: String(err) },
      { status: 500 }
    );
  }
}
