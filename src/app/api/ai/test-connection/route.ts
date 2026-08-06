import { NextResponse } from "next/server";
import { ProviderConfigSchema } from "@/lib/ai/types";
import { testProviderConnection } from "@/lib/ai/gateway";
import { sanitizeError } from "@/lib/ai/redact";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseResult = ProviderConfigSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          provider: body?.provider || "openai",
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
