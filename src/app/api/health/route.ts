import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const timestamp = new Date().toISOString();
  const url = new URL(request.url);
  const headers = { "Cache-Control": "no-store" };

  if (url.searchParams.get("live") === "1") {
    return NextResponse.json(
      { status: "ok", mode: "liveness", timestamp },
      { status: 200, headers }
    );
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", db: "ok", timestamp },
      { status: 200, headers }
    );
  } catch {
    return NextResponse.json(
      { status: "error", db: "error", timestamp },
      { status: 503, headers }
    );
  }
}
