import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJobDescription } from "@/lib/jd-parser/parser";
import { sanitizeError } from "@/lib/ai/redact";

const ExtractRequestSchema = z.object({
  rawDescription: z.string().min(1, "Job description text is required").max(200_000),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = ExtractRequestSchema.safeParse(body);

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

    const extracted = parseJobDescription(validation.data.rawDescription);
    return NextResponse.json({ success: true, data: extracted });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to extract requirements", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}
