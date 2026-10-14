import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, normalizeEmail } from "@/lib/security/passwords";
import { UsernameSchema } from "@/lib/security/usernames";
import {
  buildSessionCookie,
  cookieSecure,
  createSessionToken,
  getAppAccessSecret,
} from "@/lib/security/session";

const SignupSchema = z.object({
  email: z.string().email(),
  username: UsernameSchema,
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

function publicUser(user: { id: string; email: string; username: string }) {
  return { id: user.id, email: user.email, username: user.username };
}

export async function POST(request: Request) {
  if (!getAppAccessSecret()) {
    return NextResponse.json(
      { success: false, error: "Server is missing APP_ACCESS_SECRET" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = SignupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid signup payload",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const email = normalizeEmail(parsed.data.email);
    const username = parsed.data.username;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "Could not create that account" },
        { status: 409 }
      );
    }

    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash: await hashPassword(parsed.data.password),
      },
    });

    const token = await createSessionToken(user.id, Date.now(), user.sessionVersion);
    if (!token) {
      return NextResponse.json({ success: false, error: "Unable to create session" }, { status: 500 });
    }

    const secure = cookieSecure(request);
    const response = NextResponse.json({
      success: true,
      data: publicUser(user),
    });
    response.headers.set("Set-Cookie", buildSessionCookie(token, secure));
    return response;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { success: false, error: "Could not create that account" },
        { status: 409 }
      );
    }
    const isDbError = err instanceof Error && (err.message.includes("Can't reach database") || err.message.includes("PrismaClient"));
    return NextResponse.json(
      {
        success: false,
        error: isDbError
          ? "Database connection failed. Please ensure PostgreSQL is running."
          : "Account creation failed. Please try again.",
      },
      { status: 500 }
    );
  }
}
