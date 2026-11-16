import { NextResponse } from "next/server";
import { z } from "zod";
import { bulkEvidenceAction } from "@/lib/db/evidence";
import { sanitizeError } from "@/lib/ai/redact";
import { requireUserId } from "@/lib/security/auth-request";

const BulkItemDirectiveSchema = z.object({
  id: z.string().min(1),
  restoreStatus: z.enum(["verified", "draft"]).optional(),
  expectedUpdatedAt: z.string().optional(),
});

const BulkEvidenceSchema = z
  .object({
    action: z.enum(["verify", "archive", "restore", "delete", "preflight_delete"]),
    ids: z
      .array(z.string().min(1))
      .min(1, "Select at least one evidence item")
      .max(100, "Cannot process more than 100 items at once")
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "Duplicate evidence IDs are not allowed",
      }),
    items: z.array(BulkItemDirectiveSchema).max(100).optional(),
  })
  .refine(
    (payload) =>
      !payload.items ||
      payload.items.every((entry) => payload.ids.includes(entry.id)),
    {
      message: "Item directives must reference IDs present in ids",
      path: ["items"],
    }
  );

export async function POST(request: Request) {
  try {
    const userId = await requireUserId(request);
    if (userId instanceof NextResponse) return userId;

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const validation = BulkEvidenceSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid bulk evidence request",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await bulkEvidenceAction(validation.data, userId);
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process bulk evidence action",
        message: sanitizeError(err),
      },
      { status: 500 }
    );
  }
}
