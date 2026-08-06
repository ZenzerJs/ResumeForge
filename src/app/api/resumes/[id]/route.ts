import { NextResponse } from "next/server";
import { z } from "zod";
import { getResumeById, updateResume } from "@/lib/db/resumes";

const UpdateResumeSchema = z.object({
  title: z.string().optional(),
  typstSource: z.string().min(1, "typstSource cannot be empty").optional(),
  isMaster: z.boolean().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const resume = await getResumeById(id);

    if (!resume) {
      return NextResponse.json(
        { success: false, error: "Resume record not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: resume });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch resume", message: String(err) },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validation = UpdateResumeSchema.safeParse(body);

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

    const existing = await getResumeById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Resume record not found" },
        { status: 404 }
      );
    }

    const updated = await updateResume(id, validation.data);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to update resume", message: String(err) },
      { status: 500 }
    );
  }
}
