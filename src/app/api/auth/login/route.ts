import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizeEmail, verifyPassword } from "@/lib/security/passwords";
import { isEmailIdentifier, normalizeUsername } from "@/lib/security/usernames";
import {
  buildSessionCookie,
  createSessionToken,
  getAppAccessSecret,
} from "@/lib/security/session";

const LoginSchema = z.object({
  email: z.string().min(1).max(200).optional(),
  username: z.string().min(1).max(24).optional(),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  if (!getAppAccessSecret()) {
    return NextResponse.json(
      { success: false, error: "Server is missing APP_ACCESS_SECRET" },
      { status: 503 }
    );
  }

  try {
    let raw: unknown = {};
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      raw = await request.json().catch(() => ({}));
    } else {
      const form = await request.formData().catch(() => null);
      raw = {
        email: String(form?.get("email") || form?.get("username") || ""),
        password: String(form?.get("password") || ""),
      };
    }

    const parsed = LoginSchema.safeParse(raw);
    const identifier = (parsed.data?.email || parsed.data?.username || "").trim();
    if (!parsed.success || !identifier) {
      return NextResponse.json({ success: false, error: "Invalid email, username, or password" }, { status: 401 });
    }

    const user = isEmailIdentifier(identifier)
      ? await prisma.user.findUnique({ where: { email: normalizeEmail(identifier) } })
      : await prisma.user.findUnique({ where: { username: normalizeUsername(identifier) } });

    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return NextResponse.json({ success: false, error: "Invalid email, username, or password" }, { status: 401 });
    }

    const token = await createSessionToken(user.id);
    if (!token) {
      return NextResponse.json({ success: false, error: "Unable to create session" }, { status: 500 });
    }

    const secure = new URL(request.url).protocol === "https:";
    const response = NextResponse.json({
      success: true,
      data: { id: user.id, email: user.email, username: user.username },
    });
    response.headers.set("Set-Cookie", buildSessionCookie(token, secure));
    return response;
  } catch (err) {
    const isDbError = err instanceof Error && (err.message.includes("Can't reach database") || err.message.includes("PrismaClient"));
    return NextResponse.json(
      {
        success: false,
        error: isDbError
          ? "Database connection failed. Please ensure PostgreSQL is running."
          : "Sign-in request failed. Please try again.",
      },
      { status: 500 }
    );
  }
}
