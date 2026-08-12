import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUserId } from "@/lib/security/auth-request";

export async function GET(request: Request) {
  const userId = await getRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ success: true, data: null, guest: true });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ success: true, data: null, guest: true });
  }

  return NextResponse.json({ success: true, data: user, guest: false });
}
