import { NextResponse } from "next/server";
import { TypstRepairInputSchema, MAX_REPAIR_SOURCE_LENGTH, MAX_REPAIR_ERROR_LENGTH } from "@/lib/ai/repair-schema";
import { ProviderConfigSchema } from "@/lib/ai/types";
import {
  repairTypstSource,
  detectServerFallbackProviderConfig,
  resolveServerProviderConfig,
} from "@/lib/ai/gateway";
import { sanitizeError } from "@/lib/ai/redact";
import { requireUserId } from "@/lib/security/auth-request";
import { isDemoMode } from "@/lib/demo-mode";
import { originAllowed } from "@/lib/security/session";

export async function POST(request: Request) {
  const demoMode = isDemoMode();
  if (demoMode) {
    const hasOrigin = Boolean(request.headers.get("origin") || request.headers.get("referer"));
    if (!hasOrigin || !originAllowed(request)) {
      return NextResponse.json({ success: false, error: "Invalid request origin" }, { status: 403 });
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
      return NextResponse.json({ success: false, error: "Invalid JSON payload" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: "Invalid request payload" }, { status: 400 });
    }
    const { providerConfig, ...inputData } = body as Record<string, unknown>;

    if (!inputData.source || typeof inputData.source !== "string") {
      return NextResponse.json({ success: false, error: "source string is required" }, { status: 400 });
    }

    if (inputData.source.length > MAX_REPAIR_SOURCE_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          error: `Typst source exceeds maximum allowed length of ${MAX_REPAIR_SOURCE_LENGTH} characters for repair`,
        },
        { status: 400 }
      );
    }

    if (!inputData.compileError || typeof inputData.compileError !== "string") {
      return NextResponse.json({ success: false, error: "compileError string is required" }, { status: 400 });
    }

    if (inputData.compileError.length > MAX_REPAIR_ERROR_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          error: `Compiler error message exceeds maximum allowed length of ${MAX_REPAIR_ERROR_LENGTH} characters`,
        },
        { status: 400 }
      );
    }

    const inputParse = TypstRepairInputSchema.safeParse(inputData);
    if (!inputParse.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid repair payload: ${inputParse.error.issues.map((i) => i.message).join(", ")}`,
        },
        { status: 400 }
      );
    }

    let providerConfigToUse =
      providerConfig && typeof providerConfig === "object" && !Array.isArray(providerConfig)
        ? (providerConfig as Record<string, unknown>)
        : undefined;
    if ((!providerConfigToUse || !providerConfigToUse.provider) && !demoMode) {
      providerConfigToUse = detectServerFallbackProviderConfig({
        includeDefaultFallback: true,
      }) as Record<string, unknown> | undefined;
    }
    if (
      demoMode &&
      (!providerConfigToUse ||
        typeof providerConfigToUse.apiKey !== "string" ||
        !providerConfigToUse.apiKey.trim())
    ) {
      return NextResponse.json({ success: false, error: "Provide your own AI provider key in Settings to use AI in the demo." }, { status: 400 });
    }

    const configParse = ProviderConfigSchema.safeParse(providerConfigToUse);
    if (!configParse.success) {
      return NextResponse.json(
        {
          success: false,
          error: sanitizeError(`Invalid provider configuration: ${configParse.error.message}`),
        },
        { status: 400 }
      );
    }

    const result = await repairTypstSource(resolveServerProviderConfig(configParse.data), inputParse.data);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    // Compute changedLinesCount defensively if missing from LLM response
    const origLines = inputParse.data.source.split("\n");
    const repLines = result.data?.replacementSource ? result.data.replacementSource.split("\n") : [];
    let diffCount = 0;
    const maxLen = Math.max(origLines.length, repLines.length);
    for (let i = 0; i < maxLen; i++) {
      if (origLines[i] !== repLines[i]) diffCount++;
    }

    const proposalWithDiff = {
      ...result.data,
      changedLinesCount: diffCount,
    };

    return NextResponse.json({ success: true, data: proposalWithDiff }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: sanitizeError(`Internal server error in repair endpoint: ${err instanceof Error ? err.message : String(err)}`),
      },
      { status: 500 }
    );
  }
}
