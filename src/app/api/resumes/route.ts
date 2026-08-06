import { NextResponse } from "next/server";
import { z } from "zod";
import { createResume, getResumes } from "@/lib/db/resumes";

const CreateResumeSchema = z.object({
  title: z.string().optional(),
  typstSource: z.string().min(1, "typstSource is required"),
  isMaster: z.boolean().optional(),
});

export async function GET() {
  try {
    const resumes = await getResumes();
    return NextResponse.json({ success: true, data: resumes });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch resumes", message: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
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

    const newResume = await createResume(validation.data);
    return NextResponse.json({ success: true, data: newResume }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to create resume", message: String(err) },
      { status: 500 }
    );
  }
}
