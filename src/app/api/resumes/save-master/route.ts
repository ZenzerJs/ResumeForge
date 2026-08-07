import { NextResponse } from "next/server";
import { z } from "zod";
import { saveMasterResume, getMasterResume } from "@/lib/db/resumes";
import { sanitizeError } from "@/lib/ai/redact";

const SaveMasterSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  typstSource: z.string().min(1, "typstSource is required"),
  confirmOverwrite: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseResult = SaveMasterSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request payload for Save as Master",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { id, title, typstSource, confirmOverwrite } = parseResult.data;
    const existingMaster = await getMasterResume();

    if (existingMaster && confirmOverwrite !== true) {
      return NextResponse.json(
        {
          success: false,
          error: "Unconfirmed Master Resume overwrite blocked. Confirmation required before overwriting Master Resume.",
        },
        { status: 400 }
      );
    }

    const result = await saveMasterResume({
      id: id || existingMaster?.id,
      title,
      typstSource,
      confirmOverwrite: true,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      snapshotId: result.snapshotId,
      message: "Master Resume saved successfully with pre-overwrite snapshot.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to save Master Resume",
        message: sanitizeError(String(err)),
      },
      { status: 500 }
    );
  }
}
