import { ProviderConfig, ProviderConfigSchema, TestConnectionResult, GeneratePatchesInput, GeneratePatchesResult, EvidenceItemForPrompt, ConvertPdfInput, ConvertPdfResult } from "./types";
import { testOpenAIConnection, generateOpenAIPatches, generateOpenAIQualitativeReview, generateOpenAICoverLetter, convertOpenAIPdfTextToTypst, repairTypstWithOpenAI } from "./providers/openai";
import { testAnthropicConnection, generateAnthropicPatches, generateAnthropicQualitativeReview, generateAnthropicCoverLetter, convertAnthropicPdfTextToTypst, repairTypstWithAnthropic } from "./providers/anthropic";
import { testGeminiConnection, generateGeminiPatches, generateGeminiQualitativeReview, generateGeminiCoverLetter, convertGeminiPdfTextToTypst, repairTypstWithGemini } from "./providers/gemini";
import { testCustomConnection, generateCustomPatches, generateCustomQualitativeReview, generateCustomCoverLetter, convertCustomPdfTextToTypst, repairTypstWithCustom } from "./providers/custom";
import { sanitizeError } from "./redact";
import { buildPatchSystemPrompt, buildPatchUserPrompt } from "./prompt-template";
import { buildQualitativeReviewSystemPrompt, buildQualitativeReviewUserPrompt, QualitativeReviewPromptInput } from "./qualitative-prompt";
import { buildCoverLetterSystemPrompt, buildCoverLetterUserPrompt } from "./cover-letter-prompt";
import { buildPdfToTypstSystemPrompt, buildPdfToTypstUserPrompt } from "./pdf-prompt";
import { GenerateCoverLetterInput } from "./cover-letter-schema";
import { TypstRepairInput, TypstRepairInputSchema, TypstRepairProposal } from "./repair-schema";
import { buildEvidenceExtractSystemPrompt, buildEvidenceExtractUserPrompt } from "./evidence-prompt";
import { sanitizeTypstSource } from "../typst/sanitizer";

/**
 * Unified AI Provider Gateway Connectivity Interface
 *
 * Dispatches test connection requests to the selected provider adapter.
 * Ensures all output messages are scrubbed of API key traces.
 */
export async function testProviderConnection(rawConfig: ProviderConfig): Promise<TestConnectionResult> {
  const parseResult = ProviderConfigSchema.safeParse(rawConfig);
  if (!parseResult.success) {
    return {
      success: false,
      provider: rawConfig?.provider || "openai",
      message: sanitizeError(`Invalid provider configuration: ${parseResult.error.message}`),
    };
  }

  const config = parseResult.data;

  try {
    switch (config.provider) {
      case "openai":
        return await testOpenAIConnection(config);
      case "anthropic":
        return await testAnthropicConnection(config);
      case "gemini":
        return await testGeminiConnection(config);
      case "custom":
        return await testCustomConnection(config);
      default:
        return {
          success: false,
          provider: config.provider,
          message: `Unsupported AI provider: ${config.provider}`,
        };
    }
  } catch (err) {
    return {
      success: false,
      provider: config.provider,
      message: sanitizeError(`Unhandled gateway exception: ${err instanceof Error ? err.message : String(err)}`),
    };
  }
}

/**
 * Phase 4.2: Generates structured patch proposals via the configured BYOK AI provider.
 *
 * Builds system and user prompts, dispatches to the active provider,
 * and returns raw JSON for Zod validation and evidence citation verification.
 */
export async function generatePatchProposals(input: GeneratePatchesInput): Promise<GeneratePatchesResult> {
  const parseResult = ProviderConfigSchema.safeParse(input.providerConfig);
  if (!parseResult.success) {
    return {
      success: false,
      error: sanitizeError(`Invalid provider configuration: ${parseResult.error.message}`),
    };
  }

  const config = parseResult.data;
  const systemPrompt = buildPatchSystemPrompt(input.tailorFeedback);
  const userPrompt = buildPatchUserPrompt(input);

  try {
    switch (config.provider) {
      case "openai":
        return await generateOpenAIPatches(config, systemPrompt, userPrompt);
      case "anthropic":
        return await generateAnthropicPatches(config, systemPrompt, userPrompt);
      case "gemini":
        return await generateGeminiPatches(config, systemPrompt, userPrompt);
      case "custom":
        return await generateCustomPatches(config, systemPrompt, userPrompt);
      default:
        return {
          success: false,
          error: `Unsupported AI provider for patch generation: ${config.provider}`,
        };
    }
  } catch (err) {
    return {
      success: false,
      error: sanitizeError(`Patch generation gateway exception: ${err instanceof Error ? err.message : String(err)}`),
    };
  }
}

/**
 * Phase 4.3b: Generates structured AI qualitative feedback via the configured BYOK AI provider.
 */
export async function generateQualitativeReview(input: QualitativeReviewPromptInput): Promise<GeneratePatchesResult> {
  const parseResult = ProviderConfigSchema.safeParse(input.providerConfig);
  if (!parseResult.success) {
    return {
      success: false,
      error: sanitizeError(`Invalid provider configuration: ${parseResult.error.message}`),
    };
  }

  const config = parseResult.data;
  const systemPrompt = buildQualitativeReviewSystemPrompt();
  const userPrompt = buildQualitativeReviewUserPrompt(input);

  try {
    switch (config.provider) {
      case "openai":
        return await generateOpenAIQualitativeReview(config, systemPrompt, userPrompt);
      case "anthropic":
        return await generateAnthropicQualitativeReview(config, systemPrompt, userPrompt);
      case "gemini":
        return await generateGeminiQualitativeReview(config, systemPrompt, userPrompt);
      case "custom":
        return await generateCustomQualitativeReview(config, systemPrompt, userPrompt);
      default:
        return {
          success: false,
          error: `Unsupported AI provider for qualitative review: ${config.provider}`,
        };
    }
  } catch (err) {
    return {
      success: false,
      error: sanitizeError(`Qualitative review gateway exception: ${err instanceof Error ? err.message : String(err)}`),
    };
  }
}

/**
 * Phase 5: Generates a tailored cover letter via the configured BYOK AI provider.
 */
export async function generateCoverLetter(
  providerConfig: ProviderConfig,
  input: GenerateCoverLetterInput,
  evidenceItems: EvidenceItemForPrompt[]
): Promise<GeneratePatchesResult> {
  const parseResult = ProviderConfigSchema.safeParse(providerConfig);
  if (!parseResult.success) {
    return {
      success: false,
      error: sanitizeError(`Invalid provider configuration: ${parseResult.error.message}`),
    };
  }

  const config = parseResult.data;
  const systemPrompt = buildCoverLetterSystemPrompt();
  const userPrompt = buildCoverLetterUserPrompt(input, evidenceItems);

  try {
    switch (config.provider) {
      case "openai":
        return await generateOpenAICoverLetter(config, systemPrompt, userPrompt);
      case "anthropic":
        return await generateAnthropicCoverLetter(config, systemPrompt, userPrompt);
      case "gemini":
        return await generateGeminiCoverLetter(config, systemPrompt, userPrompt);
      case "custom":
        return await generateCustomCoverLetter(config, systemPrompt, userPrompt);
      default:
        return {
          success: false,
          error: `Unsupported AI provider for cover letter generation: ${config.provider}`,
        };
    }
  } catch (err) {
    return {
      success: false,
      error: sanitizeError(`Cover letter generation gateway exception: ${err instanceof Error ? err.message : String(err)}`),
    };
  }
}

/**
 * Task 9.1: Converts raw extracted PDF text to clean Typst markup via the active BYOK AI provider.
 */
export async function convertPdfTextToTypst(input: ConvertPdfInput): Promise<ConvertPdfResult> {
  const parseResult = ProviderConfigSchema.safeParse(input.providerConfig);
  if (!parseResult.success) {
    return {
      success: false,
      error: sanitizeError(`Invalid provider configuration: ${parseResult.error.message}`),
    };
  }

  const config = parseResult.data;
  const systemPrompt = buildPdfToTypstSystemPrompt();
  const userPrompt = buildPdfToTypstUserPrompt(input.rawText, input.fileName);

  try {
    let result: ConvertPdfResult;
    switch (config.provider) {
      case "openai":
        result = await convertOpenAIPdfTextToTypst(config, systemPrompt, userPrompt);
        break;
      case "anthropic":
        result = await convertAnthropicPdfTextToTypst(config, systemPrompt, userPrompt);
        break;
      case "gemini":
        result = await convertGeminiPdfTextToTypst(config, systemPrompt, userPrompt);
        break;
      case "custom":
        result = await convertCustomPdfTextToTypst(config, systemPrompt, userPrompt);
        break;
      default:
        return {
          success: false,
          error: `Unsupported AI provider for PDF conversion: ${config.provider}`,
        };
    }

    if (result.success && result.typstSource) {
      result.typstSource = sanitizeTypstSource(result.typstSource);
    }
    return result;
  } catch (err) {
    return {
      success: false,
      error: sanitizeError(`PDF conversion gateway exception: ${err instanceof Error ? err.message : String(err)}`),
    };
  }
}

/**
  * Task 10.5: Dispatches AI Typst repair request through configured provider.
  */
export async function repairTypstSource(
  providerConfig: ProviderConfig,
  input: TypstRepairInput
): Promise<{ success: boolean; data?: TypstRepairProposal; error?: string }> {
  const parseResult = ProviderConfigSchema.safeParse(providerConfig);
  if (!parseResult.success) {
    return {
      success: false,
      error: sanitizeError(`Invalid provider configuration: ${parseResult.error.message}`),
    };
  }

  const inputValidate = TypstRepairInputSchema.safeParse(input);
  if (!inputValidate.success) {
    return {
      success: false,
      error: `Invalid repair payload: ${inputValidate.error.issues.map((i) => i.message).join(", ")}`,
    };
  }

  const config = parseResult.data;

  try {
    switch (config.provider) {
      case "openai":
        return await repairTypstWithOpenAI(config, inputValidate.data);
      case "anthropic":
        return await repairTypstWithAnthropic(config, inputValidate.data);
      case "gemini":
        return await repairTypstWithGemini(config, inputValidate.data);
      case "custom":
        return await repairTypstWithCustom(config, inputValidate.data);
      default:
        return {
          success: false,
          error: `Unsupported AI provider for Typst repair: ${config.provider}`,
        };
    }
  } catch (err) {
    return {
      success: false,
      error: sanitizeError(`Typst repair gateway exception: ${err instanceof Error ? err.message : String(err)}`),
    };
  }
}

/**
 * Extract draft Evidence Bank items from Master Typst via BYOK provider.
 * Reuses JSON chat completion adapters (same shape as cover letter / patches).
 */
export async function extractEvidenceFromMaster(
  providerConfig: ProviderConfig,
  typstSource: string
): Promise<GeneratePatchesResult> {
  const parseResult = ProviderConfigSchema.safeParse(providerConfig);
  if (!parseResult.success) {
    return {
      success: false,
      error: sanitizeError(`Invalid provider configuration: ${parseResult.error.message}`),
    };
  }

  const config = parseResult.data;
  const systemPrompt = buildEvidenceExtractSystemPrompt();
  const userPrompt = buildEvidenceExtractUserPrompt(typstSource);

  try {
    switch (config.provider) {
      case "openai":
        return await generateOpenAICoverLetter(config, systemPrompt, userPrompt);
      case "anthropic":
        return await generateAnthropicCoverLetter(config, systemPrompt, userPrompt);
      case "gemini":
        return await generateGeminiCoverLetter(config, systemPrompt, userPrompt);
      case "custom":
        return await generateCustomCoverLetter(config, systemPrompt, userPrompt);
      default:
        return {
          success: false,
          error: `Unsupported AI provider for evidence extract: ${config.provider}`,
        };
    }
  } catch (err) {
    return {
      success: false,
      error: sanitizeError(
        `Evidence extract gateway exception: ${err instanceof Error ? err.message : String(err)}`
      ),
    };
  }
}

