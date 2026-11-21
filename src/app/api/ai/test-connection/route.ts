import { NextResponse } from "next/server";
import { ProviderConfigSchema } from "@/lib/ai/types";
import { testProviderConnection } from "@/lib/ai/gateway";
import { sanitizeError } from "@/lib/ai/redact";
import { getRequestUserId, guestSaveResponse } from "@/lib/security/auth-request";
import { isDemoMode } from "@/lib/demo-mode";
import { originAllowed } from "@/lib/security/session";

const CLOUD_BYOK_PROVIDERS = new Set(["gemini", "openai", "anthropic", "groq"]);

export async function POST(request: Request) {
  const demoMode = isDemoMode();
  const hasOrigin = Boolean(request.headers.get("origin") || request.headers.get("referer"));
  let isGuestRequest = false;

  if (demoMode) {
    if (!hasOrigin || !originAllowed(request)) {
      return NextResponse.json(
        { success: false, provider: "unknown", error: "Invalid request origin", message: "Invalid request origin" },
        { status: 403 }
      );
    }
    const userId = await getRequestUserId(request);
    isGuestRequest = !userId;
  } else {
    const userId = await getRequestUserId(request);
    if (!userId) {
      if (!hasOrigin) {
        return guestSaveResponse();
      }
      if (!originAllowed(request)) {
        return NextResponse.json(
          { success: false, provider: "unknown", error: "Invalid request origin", message: "Invalid request origin" },
          { status: 403 }
        );
      }
      isGuestRequest = true;
    }
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

    let configToTest = parseResult.data;
    if (isGuestRequest) {
      if (!CLOUD_BYOK_PROVIDERS.has(configToTest.provider)) {
        return NextResponse.json(
          {
            success: false,
            provider: configToTest.provider,
            message: "Sign in to test local or custom AI endpoints.",
          },
          { status: 401 }
        );
      }
      if (configToTest.baseUrl?.trim()) {
        return NextResponse.json(
          {
            success: false,
            provider: configToTest.provider,
            message: "Sign in to use a custom endpoint base URL.",
          },
          { status: 403 }
        );
      }
      const explicitApiKey = configToTest.apiKey?.trim();
      if (!explicitApiKey) {
        return NextResponse.json(
          {
            success: false,
            provider: configToTest.provider,
            message: "API key is required to test a connection before signing in.",
          },
          { status: 400 }
        );
      }
      configToTest = {
        provider: configToTest.provider,
        apiKey: explicitApiKey,
        model: configToTest.model,
      };
    }

    const result = await testProviderConnection(configToTest);

    // Explicit security guarantee: return only sanitized non-sensitive fields
    return NextResponse.json({
      success: result.success,
      provider: result.provider,
      message: result.message,
      modelCount: result.modelCount,
      availableModels: result.availableModels,
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
