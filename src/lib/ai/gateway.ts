import { ProviderConfig, ProviderConfigSchema, TestConnectionResult, GeneratePatchesInput, GeneratePatchesResult, EvidenceItemForPrompt, ConvertPdfInput, ConvertPdfResult } from "./types";
import { testOpenAIConnection, generateOpenAIPatches, generateOpenAIQualitativeReview, generateOpenAICoverLetter, convertOpenAIPdfTextToTypst, repairTypstWithOpenAI, chatOpenAI } from "./providers/openai";
import { testAnthropicConnection, generateAnthropicPatches, generateAnthropicQualitativeReview, generateAnthropicCoverLetter, convertAnthropicPdfTextToTypst, repairTypstWithAnthropic, chatAnthropic } from "./providers/anthropic";
import { testGeminiConnection, generateGeminiPatches, generateGeminiQualitativeReview, generateGeminiCoverLetter, convertGeminiPdfTextToTypst, repairTypstWithGemini, chatGemini } from "./providers/gemini";
import { testCustomConnection, generateCustomPatches, generateCustomQualitativeReview, generateCustomCoverLetter, convertCustomPdfTextToTypst, repairTypstWithCustom, chatCustom, ChatCompletionResult } from "./providers/custom";
import { sanitizeError } from "./redact";
import { buildPatchSystemPrompt, buildPatchUserPrompt } from "./prompt-template";
import { buildQualitativeReviewSystemPrompt, buildQualitativeReviewUserPrompt, QualitativeReviewPromptInput } from "./qualitative-prompt";
import { buildCoverLetterSystemPrompt, buildCoverLetterUserPrompt } from "./cover-letter-prompt";
import { buildPdfToTypstSystemPrompt, buildPdfToTypstUserPrompt } from "./pdf-prompt";
import { GenerateCoverLetterInput } from "./cover-letter-schema";
import { TypstRepairInput, TypstRepairInputSchema, TypstRepairProposal } from "./repair-schema";
import { buildEvidenceExtractSystemPrompt, buildEvidenceExtractUserPrompt } from "./evidence-prompt";
import { FormattedJd, FormattedJdSchema } from "./jd-format-schema";
import { buildJdFormatSystemPrompt, buildJdFormatUserPrompt, JdFormatPromptInput } from "./jd-format-prompt";
import { sanitizeTypstSource } from "../typst/sanitizer";
import { isDemoMode } from "../demo-mode";

/**
 * Resolves server-side defaults and environment variables for AI providers.
 */
export function resolveServerProviderConfig(config: ProviderConfig): ProviderConfig {
  if (config.provider === "groq") {
    return {
      ...config,
      apiKey: config.apiKey?.trim() || (!isDemoMode() ? process.env.GROQ_API_KEY?.trim() : undefined) || undefined,
      baseUrl: config.baseUrl || "https://api.groq.com/openai/v1",
      model: config.model || "llama-3.3-70b-versatile",
    };
  }
  if (config.provider === "ollama") {
    return {
      ...config,
      baseUrl: config.baseUrl || (!isDemoMode() ? process.env.OLLAMA_BASE_URL : undefined) || "http://localhost:11434/v1",
      model: config.model || "llama3.2",
      apiKey: config.apiKey || "ollama",
    };
  }
  return config;
}

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

  const resolved = resolveServerProviderConfig(parseResult.data);

  try {
    switch (resolved.provider) {
      case "openai":
        return await testOpenAIConnection(resolved);
      case "anthropic":
        return await testAnthropicConnection(resolved);
      case "gemini":
        return await testGeminiConnection(resolved);
      case "groq":
      case "ollama":
      case "custom":
        return await testCustomConnection(resolved);
      default:
        return {
          success: false,
          provider: resolved.provider,
          message: `Unsupported AI provider: ${resolved.provider}`,
        };
    }
  } catch (err) {
    return {
      success: false,
      provider: resolved.provider,
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

  const resolvedConfig = resolveServerProviderConfig(parseResult.data);
  const systemPrompt = buildPatchSystemPrompt(input.tailorFeedback);
  const userPrompt = buildPatchUserPrompt(input);

  try {
    switch (resolvedConfig.provider) {
      case "openai":
        return await generateOpenAIPatches(resolvedConfig, systemPrompt, userPrompt);
      case "anthropic":
        return await generateAnthropicPatches(resolvedConfig, systemPrompt, userPrompt);
      case "gemini":
        return await generateGeminiPatches(resolvedConfig, systemPrompt, userPrompt);
      case "groq":
      case "ollama":
      case "custom":
        return await generateCustomPatches(resolvedConfig, systemPrompt, userPrompt);
      default:
        return {
          success: false,
          error: `Unsupported AI provider for patch generation: ${resolvedConfig.provider}`,
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

  const resolvedConfig = resolveServerProviderConfig(parseResult.data);
  const systemPrompt = buildQualitativeReviewSystemPrompt();
  const userPrompt = buildQualitativeReviewUserPrompt(input);

  try {
    switch (resolvedConfig.provider) {
      case "openai":
        return await generateOpenAIQualitativeReview(resolvedConfig, systemPrompt, userPrompt);
      case "anthropic":
        return await generateAnthropicQualitativeReview(resolvedConfig, systemPrompt, userPrompt);
      case "gemini":
        return await generateGeminiQualitativeReview(resolvedConfig, systemPrompt, userPrompt);
      case "groq":
      case "ollama":
      case "custom":
        return await generateCustomQualitativeReview(resolvedConfig, systemPrompt, userPrompt);
      default:
        return {
          success: false,
          error: `Unsupported AI provider for qualitative review: ${resolvedConfig.provider}`,
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
  evidenceItems: EvidenceItemForPrompt[],
  masterTypstSource?: string
): Promise<GeneratePatchesResult> {
  const parseResult = ProviderConfigSchema.safeParse(providerConfig);
  if (!parseResult.success) {
    return {
      success: false,
      error: sanitizeError(`Invalid provider configuration: ${parseResult.error.message}`),
    };
  }

  const resolvedConfig = resolveServerProviderConfig(parseResult.data);
  const systemPrompt = buildCoverLetterSystemPrompt();
  const userPrompt = buildCoverLetterUserPrompt(input, evidenceItems, masterTypstSource);

  try {
    switch (resolvedConfig.provider) {
      case "openai":
        return await generateOpenAICoverLetter(resolvedConfig, systemPrompt, userPrompt);
      case "anthropic":
        return await generateAnthropicCoverLetter(resolvedConfig, systemPrompt, userPrompt);
      case "gemini":
        return await generateGeminiCoverLetter(resolvedConfig, systemPrompt, userPrompt);
      case "groq":
      case "ollama":
      case "custom":
        return await generateCustomCoverLetter(resolvedConfig, systemPrompt, userPrompt);
      default:
        return {
          success: false,
          error: `Unsupported AI provider for cover letter generation: ${resolvedConfig.provider}`,
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

  const resolvedConfig = resolveServerProviderConfig(parseResult.data);
  const systemPrompt = buildPdfToTypstSystemPrompt();
  const userPrompt = buildPdfToTypstUserPrompt(input.rawText, input.fileName, input.links);

  try {
    let result: ConvertPdfResult;
    switch (resolvedConfig.provider) {
      case "openai":
        result = await convertOpenAIPdfTextToTypst(resolvedConfig, systemPrompt, userPrompt);
        break;
      case "anthropic":
        result = await convertAnthropicPdfTextToTypst(resolvedConfig, systemPrompt, userPrompt);
        break;
      case "gemini":
        result = await convertGeminiPdfTextToTypst(resolvedConfig, systemPrompt, userPrompt);
        break;
      case "groq":
      case "ollama":
      case "custom":
        result = await convertCustomPdfTextToTypst(resolvedConfig, systemPrompt, userPrompt);
        break;
      default:
        return {
          success: false,
          error: `Unsupported AI provider for PDF conversion: ${resolvedConfig.provider}`,
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

  const resolvedConfig = resolveServerProviderConfig(parseResult.data);

  try {
    switch (resolvedConfig.provider) {
      case "openai":
        return await repairTypstWithOpenAI(resolvedConfig, inputValidate.data);
      case "anthropic":
        return await repairTypstWithAnthropic(resolvedConfig, inputValidate.data);
      case "gemini":
        return await repairTypstWithGemini(resolvedConfig, inputValidate.data);
      case "groq":
      case "ollama":
      case "custom":
        return await repairTypstWithCustom(resolvedConfig, inputValidate.data);
      default:
        return {
          success: false,
          error: `Unsupported AI provider for Typst repair: ${resolvedConfig.provider}`,
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
 * Uses generic JSON chat adapters (patch completions), never cover-letter prompts.
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

  const resolvedConfig = resolveServerProviderConfig(parseResult.data);
  const systemPrompt = buildEvidenceExtractSystemPrompt();
  const userPrompt = buildEvidenceExtractUserPrompt(typstSource);

  try {
    switch (resolvedConfig.provider) {
      case "openai":
        return await generateOpenAIPatches(resolvedConfig, systemPrompt, userPrompt);
      case "anthropic":
        return await generateAnthropicPatches(resolvedConfig, systemPrompt, userPrompt);
      case "gemini":
        return await generateGeminiPatches(resolvedConfig, systemPrompt, userPrompt);
      case "groq":
      case "ollama":
      case "custom":
        return await generateCustomPatches(resolvedConfig, systemPrompt, userPrompt);
      default:
        return {
          success: false,
          error: `Unsupported AI provider for evidence extract: ${resolvedConfig.provider}`,
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

/**
 * Multi-turn chat completion dispatcher.
 * Collects a full provider response (MVP). The chat API route emits SSE chunks.
 */
export async function sendChatCompletion(
  rawConfig: ProviderConfig,
  messages: Array<{ role: string; content: string }>,
  tools: unknown = []
): Promise<ChatCompletionResult> {
  const parseResult = ProviderConfigSchema.safeParse(rawConfig);
  if (!parseResult.success) {
    throw new Error(sanitizeError(`Invalid provider configuration: ${parseResult.error.message}`));
  }

  const resolvedConfig = resolveServerProviderConfig(parseResult.data);
  let effectiveMessages = messages;
  let effectiveTools: any[] = [];
  if (typeof tools === "string") {
    effectiveMessages = [{ role: "system", content: tools }, ...messages];
  } else if (Array.isArray(tools)) {
    effectiveTools = tools;
  }

  try {
    switch (resolvedConfig.provider) {
      case "openai":
        return await chatOpenAI(resolvedConfig, effectiveMessages, effectiveTools);
      case "anthropic":
        return await chatAnthropic(resolvedConfig, effectiveMessages, effectiveTools);
      case "gemini":
        return await chatGemini(resolvedConfig, effectiveMessages, effectiveTools);
      case "groq":
      case "ollama":
      case "custom":
        return await chatCustom(resolvedConfig, effectiveMessages, effectiveTools);
      default:
        throw new Error(`Unsupported AI provider for chat: ${resolvedConfig.provider}`);
    }
  } catch (err) {
    throw new Error(
      sanitizeError(`Chat completion failed: ${err instanceof Error ? err.message : String(err)}`)
    );
  }
}

export interface FormatJdResult {
  success: boolean;
  data?: FormattedJd;
  error?: string;
}

/**
 * Formats a raw Job Description into structured taxonomy via BYOK AI provider.
 */
export async function formatJobDescriptionWithAi(
  providerConfig: ProviderConfig,
  input: JdFormatPromptInput
): Promise<FormatJdResult> {
  const parseResult = ProviderConfigSchema.safeParse(providerConfig);
  if (!parseResult.success) {
    return {
      success: false,
      error: sanitizeError(`Invalid provider configuration: ${parseResult.error.message}`),
    };
  }

  const resolvedConfig = resolveServerProviderConfig(parseResult.data);
  const systemPrompt = buildJdFormatSystemPrompt();
  const userPrompt = buildJdFormatUserPrompt(input);

  try {
    let rawResult: GeneratePatchesResult;
    switch (resolvedConfig.provider) {
      case "openai":
        rawResult = await generateOpenAIPatches(resolvedConfig, systemPrompt, userPrompt);
        break;
      case "anthropic":
        rawResult = await generateAnthropicPatches(resolvedConfig, systemPrompt, userPrompt);
        break;
      case "gemini":
        rawResult = await generateGeminiPatches(resolvedConfig, systemPrompt, userPrompt);
        break;
      case "groq":
      case "ollama":
      case "custom":
        rawResult = await generateCustomPatches(resolvedConfig, systemPrompt, userPrompt);
        break;
      default:
        return {
          success: false,
          error: `Unsupported AI provider: ${resolvedConfig.provider}`,
        };
    }

    if (!rawResult.success || !rawResult.rawJson) {
      return {
        success: false,
        error: rawResult.error || "Failed to generate formatted job description",
      };
    }

    const parsedJson =
      typeof rawResult.rawJson === "string"
        ? JSON.parse(rawResult.rawJson)
        : rawResult.rawJson;
    const validated = FormattedJdSchema.safeParse(parsedJson);
    if (!validated.success) {
      return {
        success: false,
        error: `AI output failed validation: ${validated.error.issues.map((i) => i.message).join(", ")}`,
      };
    }

    return {
      success: true,
      data: validated.data,
    };
  } catch (err) {
    return {
      success: false,
      error: sanitizeError(
        `JD Formatter gateway error: ${err instanceof Error ? err.message : String(err)}`
      ),
    };
  }
}


