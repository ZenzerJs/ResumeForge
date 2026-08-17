import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJobDescription } from "@/lib/jd-parser/parser";
import { sanitizeError } from "@/lib/ai/redact";
import { normalizeJob } from "@/lib/ingestion/normalize-job";
import { extractFullTextFromUrl } from "@/lib/ingestion/tier2-fetcher";
import { ProviderConfigSchema } from "@/lib/ai/types";
import { formatJobDescriptionWithAi } from "@/lib/ai/gateway";

const ExtractRequestSchema = z
  .object({
    rawDescription: z.string().min(1, "Job description text is required").max(200_000).optional(),
    url: z.string().url("Invalid URL format").optional(),
    company: z.string().optional(),
    roleTitle: z.string().optional(),
    formatWithAi: z.boolean().optional().default(false),
    providerConfig: ProviderConfigSchema.optional(),
  })
  .refine((data) => Boolean(data.rawDescription || data.url), {
    message: "Either rawDescription or url is required",
    path: ["rawDescription"],
  });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = ExtractRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request payload",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { rawDescription, url, company, roleTitle, formatWithAi, providerConfig } = validation.data;

    let targetDescription = rawDescription?.trim() || "";
    let sourceUrl = url || null;

    if (!targetDescription && url) {
      const fetchResult = await extractFullTextFromUrl(url, { company, roleTitle });
      if (!fetchResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: fetchResult.message,
            reason: fetchResult.reason,
            failureCode: fetchResult.failureCode,
            diagnostics: fetchResult.diagnostics,
          },
          { status: 422 }
        );
      }
      targetDescription = fetchResult.rawDescription;
      sourceUrl = fetchResult.sourceUrl;
    }

    if (!targetDescription) {
      return NextResponse.json(
        {
          success: false,
          error: "Job description text or valid URL is required.",
        },
        { status: 400 }
      );
    }

    const extracted = parseJobDescription(targetDescription);
    const normalized = normalizeJob({
      descriptionText: targetDescription,
      sourceUrl,
      title: roleTitle || extracted.roleTitle,
      company: company || extracted.company,
      locationRaw: extracted.location,
      requirements: extracted.requiredSkills,
      niceToHaves: extracted.preferredSkills,
    });

    let formattedJd = null;
    if (formatWithAi && providerConfig) {
      const aiFormatResult = await formatJobDescriptionWithAi(providerConfig, {
        rawDescription: targetDescription,
        roleTitle: normalized.title,
        company: normalized.company,
      });
      if (aiFormatResult.success) {
        formattedJd = aiFormatResult.data;
      }
    }

    return NextResponse.json({
      success: true,
      data: extracted,
      normalized,
      formattedJd,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to extract requirements", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}
