import { NextResponse } from "next/server";
import { ProviderConfigSchema } from "@/lib/ai/types";
import { testProviderConnection } from "@/lib/ai/gateway";
import { sanitizeError } from "@/lib/ai/redact";
import { requireUserId } from "@/lib/security/auth-request";
import { isDemoMode } from "@/lib/demo-mode";
import { originAllowed } from "@/lib/security/session";

export async function POST(request: Request) {
  if (isDemoMode()) {
    const hasOrigin = Boolean(request.headers.get("origin") || request.headers.get("referer"));
    if (!hasOrigin || !originAllowed(request)) {
      return NextResponse.json(
        { success: false, provider: "unknown", error: "Invalid request origin", message: "Invalid request origin" },
        { status: 403 }
      );
    }
  } else {
    const auth = await requireUserId(request);
    if (auth instanceof Response) return auth;
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, provider: "unknown", error: "Invalid JSON payload", message: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const parseResult = ProviderConfigSchema.safeParse(body);

    if (!parseResult.success) {
      const provider =
        body && typeof body === "object" && "provider" in body && typeof (body as { provider?: unknown }).provider === "string"
          ? (body as { provider: string }).provider
          : "openai";
      return NextResponse.json(
        {
          success: false,
          provider,
          message: sanitizeError(`Validation failed: ${parseResult.error.issues.map((i) => i.message).join(", ")}`),
        },
        { status: 400 }
      );
    }

    const result = await testProviderConnection(parseResult.data);

    // Explicit security guarantee: return only sanitized non-sensitive fields
    return NextResponse.json({
      success: result.success,
      provider: result.provider,
      message: result.message,
      modelCount: result.modelCount,
      latencyMs: result.latencyMs,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        provider: "unknown",
        message: sanitizeError(`Internal server error: ${err instanceof Error ? err.message : String(err)}`),
      },
      { status: 500 }
    );
  }
}
