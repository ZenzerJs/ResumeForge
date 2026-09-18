import { NextResponse } from "next/server";
import { getCoverLetters, createCoverLetter, getCoverLettersByJobId } from "@/lib/db/cover-letters";
import { getJobById } from "@/lib/db/jobs";
import { sanitizeError } from "@/lib/ai/redact";
import { z } from "zod";
import { getRequestUserId, requireUserId } from "@/lib/security/auth-request";

const CreateCoverLetterSchema = z.object({
  jobId: z.string().min(1),
  variantId: z.string().optional(),
  title: z.string().min(1),
  salutation: z.string().optional(),
  openingParagraph: z.string().min(1),
  bodyParagraphs: z.array(z.string()).min(1),
  closingParagraph: z.string().min(1),
  fullMarkdown: z.string().min(1),
  evidenceCitations: z.array(z.string()).optional(),
  status: z.enum(["DRAFT", "FINAL"]).optional(),
});

export async function GET(request: Request) {
  try {
    const userId = await getRequestUserId(request);
    if (!userId) {
      return NextResponse.json({ success: true, data: [], guest: true });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (jobId) {
      const job = await getJobById(jobId, userId);
      if (!job) {
        return NextResponse.json({ success: true, data: [] });
      }
      const letters = await getCoverLettersByJobId(jobId, userId);
      return NextResponse.json({ success: true, data: letters });
    }

    const letters = await getCoverLetters(userId);
    return NextResponse.json({ success: true, data: letters });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch cover letters",
        message: sanitizeError(String(err)),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = await request.json();
    const parseResult = CreateCoverLetterSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid cover letter creation payload",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const coverLetter = await createCoverLetter({ ...parseResult.data, userId });
    return NextResponse.json({ success: true, data: coverLetter }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to save cover letter",
        message: sanitizeError(String(err)),
      },
      { status: 500 }
    );
  }
}
