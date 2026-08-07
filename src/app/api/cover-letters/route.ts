import { NextResponse } from "next/server";
import { getCoverLetters, createCoverLetter, getCoverLettersByJobId } from "@/lib/db/cover-letters";
import { sanitizeError } from "@/lib/ai/redact";
import { z } from "zod";

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
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (jobId) {
      const letters = await getCoverLettersByJobId(jobId);
      return NextResponse.json({ success: true, data: letters });
    }

    const letters = await getCoverLetters();
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

    const coverLetter = await createCoverLetter(parseResult.data);
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
