import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizeError } from "@/lib/ai/redact";
import { requireUserId } from "@/lib/security/auth-request";

export async function POST(request: Request) {
  try {
    const userId = await requireUserId(request);
    if (userId instanceof NextResponse) return userId;

    await prisma.resume.updateMany({
      where: { isMaster: true, userId },
      data: { isMaster: false, isProtected: false },
    });

    return NextResponse.json({
      success: true,
      message: "Cleared master resume status. Session reset.",
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to clear master resume", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}
