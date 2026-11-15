import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUserId } from "@/lib/security/auth-request";
import { UsernameSchema } from "@/lib/security/usernames";
import { sanitizeError } from "@/lib/ai/redact";

const publicSelect = { id: true, email: true, username: true } as const;

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
}

export async function GET(request: Request) {
  try {
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
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch account", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await getRequestUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Sign in to update your account.", code: "GUEST_READ_ONLY" },
        { status: 401 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON payload" }, { status: 400 });
    }

    const usernameInput =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as { username?: unknown }).username
        : undefined;
    const parsed = UsernameSchema.safeParse(usernameInput);
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
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return NextResponse.json({ success: false, error: "That username is already taken" }, { status: 409 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to update account", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}
