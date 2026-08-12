import { NextResponse } from "next/server";
import { z } from "zod";
import { createResume, getResumes } from "@/lib/db/resumes";
import { sanitizeError } from "@/lib/ai/redact";
import { getRequestUserId, requireUserId } from "@/lib/security/auth-request";

const CreateResumeSchema = z.object({
  title: z.string().max(200).optional(),
  typstSource: z.string().min(1, "typstSource is required").max(200_000),
});

export async function GET(request: Request) {
  try {
    const userId = await getRequestUserId(request);
    if (!userId) {
      return NextResponse.json({ success: true, data: [], guest: true });
    }
    const resumes = await getResumes(userId);
    return NextResponse.json({ success: true, data: resumes });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch resumes", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = await request.json();
    const validation = CreateResumeSchema.safeParse(body);

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

    const newResume = await createResume({
      ...validation.data,
      isMaster: false,
      userId,
    });
    return NextResponse.json({ success: true, data: newResume }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to create resume", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}
