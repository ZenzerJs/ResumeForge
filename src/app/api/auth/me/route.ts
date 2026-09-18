import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUserId } from "@/lib/security/auth-request";
import { UsernameSchema } from "@/lib/security/usernames";

const publicSelect = { id: true, email: true, username: true } as const;

export async function GET(request: Request) {
  const userId = await getRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ success: true, data: null, guest: true });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: publicSelect,
  });
  if (!user) {
    return NextResponse.json({ success: true, data: null, guest: true });
  }

  return NextResponse.json({ success: true, data: user, guest: false });
}

export async function PATCH(request: Request) {
  const userId = await getRequestUserId(request);
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Sign in to update your account.", code: "GUEST_READ_ONLY" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = UsernameSchema.safeParse((body as { username?: unknown }).username);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid username",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const taken = await prisma.user.findFirst({
    where: { username: parsed.data, NOT: { id: userId } },
    select: { id: true },
  });
  if (taken) {
    return NextResponse.json({ success: false, error: "That username is already taken" }, { status: 409 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { username: parsed.data },
    select: publicSelect,
  });

  return NextResponse.json({ success: true, data: user, guest: false });
}
