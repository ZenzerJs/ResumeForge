import { NextResponse } from "next/server";
import { JobRequirementsSchema } from "@/lib/jd-parser/types";
import { getEvidenceItems } from "@/lib/db/evidence";
import { matchEvidenceToRequirements } from "@/lib/matching/matcher";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = JobRequirementsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid job requirements payload",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const evidenceItems = await getEvidenceItems();
    const matches = matchEvidenceToRequirements(evidenceItems, validation.data);

    return NextResponse.json({ success: true, data: matches });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to match evidence", message: String(err) },
      { status: 500 }
    );
  }
}
