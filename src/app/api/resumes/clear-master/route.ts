import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    await prisma.resume.updateMany({
      where: { isMaster: true },
      data: { isMaster: false },
    });

    return NextResponse.json({
      success: true,
      message: "Cleared master resume status. Session reset.",
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to clear master resume", message: String(err) },
      { status: 500 }
    );
  }
}
