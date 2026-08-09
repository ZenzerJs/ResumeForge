import { NextResponse } from "next/server";
import { TypstRepairInputSchema, MAX_REPAIR_SOURCE_LENGTH, MAX_REPAIR_ERROR_LENGTH } from "@/lib/ai/repair-schema";
import { ProviderConfigSchema } from "@/lib/ai/types";
import { repairTypstSource } from "@/lib/ai/gateway";
import { sanitizeError } from "@/lib/ai/redact";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { providerConfig, ...inputData } = body || {};

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

    const providerConfigToUse = providerConfig || {
      provider: process.env.NEXT_PUBLIC_DEFAULT_AI_PROVIDER || "openai",
      model: process.env.NEXT_PUBLIC_DEFAULT_AI_MODEL || "gpt-4o",
      apiKey: process.env.OPENAI_API_KEY || "",
    };

    const configParse = ProviderConfigSchema.safeParse(providerConfigToUse);
    if (!configParse.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid provider configuration: ${configParse.error.message}`,
        },
        { status: 400 }
      );
    }

    const result = await repairTypstSource(configParse.data, inputParse.data);

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
      changedLinesCount: result.data?.changedLinesCount ?? diffCount,
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
