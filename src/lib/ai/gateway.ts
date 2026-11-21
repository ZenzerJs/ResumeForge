import {
  ProviderConfig,
  ProviderConfigSchema,
  TestConnectionResult,
  GeneratePatchesInput,
  GeneratePatchesResult,
  EvidenceItemForPrompt,
  ConvertPdfInput,
  ConvertPdfResult,
  TextCompletionMessage,
  TextCompletionOptions,
  TextCompletionResult,
} from "./types";
import { testOpenAIConnection, completeText as completeOpenAIText, chatOpenAI } from "./providers/openai";
import { testAnthropicConnection, completeText as completeAnthropicText, chatAnthropic } from "./providers/anthropic";
import { testGeminiConnection, completeText as completeGeminiText, chatGemini } from "./providers/gemini";
import { testCustomConnection, completeText as completeCustomText, chatCustom, ChatCompletionResult, type ChatMessageInput } from "./providers/custom";
import { sanitizeError } from "./redact";
import { stripCodeFences } from "./utils";
import { buildPatchSystemPrompt, buildPatchUserPrompt } from "./prompt-template";
import { buildQualitativeReviewSystemPrompt, buildQualitativeReviewUserPrompt, QualitativeReviewPromptInput } from "./qualitative-prompt";
import { buildCoverLetterSystemPrompt, buildCoverLetterUserPrompt } from "./cover-letter-prompt";
import { buildPdfToTypstSystemPrompt, buildPdfToTypstUserPrompt, buildPdfSpanSystemPrompt, buildPdfSpanUserPrompt } from "./pdf-prompt";
import { validateAssignments } from "@/lib/typst/resume-document";
import { z } from "zod";
import { GenerateCoverLetterInput } from "./cover-letter-schema";
import { TypstRepairInput, TypstRepairInputSchema, TypstRepairProposal, TypstRepairProposalSchema } from "./repair-schema";
import { buildTypstRepairSystemPrompt, buildTypstRepairUserPrompt } from "./repair-prompt";
import { buildEvidenceExtractSystemPrompt, buildEvidenceExtractUserPrompt } from "./evidence-prompt";
import { FormattedJd, FormattedJdSchema } from "./jd-format-schema";
import { buildJdFormatSystemPrompt, buildJdFormatUserPrompt, JdFormatPromptInput } from "./jd-format-prompt";
import { sanitizeTypstSource } from "../typst/sanitizer";
import { isDemoMode } from "../demo-mode";
import { DEFAULT_GEMINI_MODEL, DEFAULT_MODELS } from "./model-defaults";
import {
  isServerManagedLocalConfig,
  markServerManagedLocalConfig,
  resolveProviderCredentials,
} from "./providers/credentials";

export { isServerManagedLocalConfig };

async function dispatchTextCompletion(
  resolvedConfig: ProviderConfig,
  messages: TextCompletionMessage[],
  jsonMode: boolean,
  options?: TextCompletionOptions
): Promise<TextCompletionResult> {
  switch (resolvedConfig.provider) {
    case "openai":
      return completeOpenAIText(resolvedConfig, messages, jsonMode, options);
    case "anthropic":
      return completeAnthropicText(resolvedConfig, messages, jsonMode, options);
    case "gemini":
      return completeGeminiText(resolvedConfig, messages, jsonMode, options);
    case "groq":
    case "ollama":
    case "custom":
      return completeCustomText(resolvedConfig, messages, jsonMode, options);
    default:
      return {
        success: false,
        error: `Unsupported AI provider for ${options?.taskLabel ?? "completion"}: ${resolvedConfig.provider}`,
      };
  }
}

/**
 * Detects a server-side fallback ProviderConfig from environment variables when
 * the caller did not supply a providerConfig (only when not in demo mode).
 */
export function detectServerFallbackProviderConfig(options?: {
  includeDefaultFallback?: boolean;
}): ProviderConfig | undefined {
  if (isDemoMode()) return undefined;
  if (process.env.OPENAI_API_KEY?.trim()) {
    return { provider: "openai", apiKey: process.env.OPENAI_API_KEY.trim(), model: "gpt-4o" };
  }
  if (process.env.ANTHROPIC_API_KEY?.trim()) {
    return {
      provider: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY.trim(),
      model: "claude-3-5-sonnet-20241022",
    };
  }
  if (process.env.GEMINI_API_KEY?.trim()) {
    return { provider: "gemini", apiKey: process.env.GEMINI_API_KEY.trim(), model: DEFAULT_GEMINI_MODEL };
  }
  if (process.env.GROQ_API_KEY?.trim()) {
    return resolveServerProviderConfig({ provider: "groq", apiKey: process.env.GROQ_API_KEY.trim() });
  }
  if (process.env.CUSTOM_OPENAI_API_KEY?.trim()) {
    return {
      provider: "custom",
      apiKey: process.env.CUSTOM_OPENAI_API_KEY.trim(),
      baseUrl: process.env.CUSTOM_OPENAI_BASE_URL,
    };
  }
  if (options?.includeDefaultFallback) {
    const fallbackProvider = (process.env.NEXT_PUBLIC_DEFAULT_AI_PROVIDER || "openai") as ProviderConfig["provider"];
    return {
      provider: fallbackProvider,
      model: process.env.NEXT_PUBLIC_DEFAULT_AI_MODEL || "gpt-4o",
      apiKey: process.env.OPENAI_API_KEY || "",
    };
  }
  return undefined;
}

/**
 * Resolves server-side defaults and environment variables for AI providers.
 */
export function resolveServerProviderConfig(config: ProviderConfig): ProviderConfig {
  if (!isDemoMode() && !config.apiKey?.trim()) {
    if (config.provider === "openai" && process.env.OPENAI_API_KEY?.trim()) {
      return { ...config, apiKey: process.env.OPENAI_API_KEY.trim() };
    }
    if (config.provider === "anthropic" && process.env.ANTHROPIC_API_KEY?.trim()) {
      return { ...config, apiKey: process.env.ANTHROPIC_API_KEY.trim() };
    }
    if (config.provider === "gemini" && process.env.GEMINI_API_KEY?.trim()) {
      return { ...config, apiKey: process.env.GEMINI_API_KEY.trim() };
    }
    if (config.provider === "custom" && process.env.CUSTOM_OPENAI_API_KEY?.trim()) {
      return {
        ...config,
        apiKey: process.env.CUSTOM_OPENAI_API_KEY.trim(),
        baseUrl: config.baseUrl || process.env.CUSTOM_OPENAI_BASE_URL,
      };
    }
  }
  if (config.provider === "groq") {
    const { apiKey, baseUrl } = resolveProviderCredentials({
      configApiKey: config.apiKey,
      configBaseUrl: config.baseUrl,
      envApiKey: process.env.GROQ_API_KEY,
      defaultBaseUrl: "https://api.groq.com/openai/v1",
      officialHosts: ["api.groq.com"],
    });
    return {
      ...config,
      apiKey,
      baseUrl,
      model: config.model || "llama-3.3-70b-versatile",
    };
  }
  if (config.provider === "ollama") {
    const hasCallerBase = Boolean(config.baseUrl?.trim());
    const resolved: ProviderConfig = {
      ...config,
      baseUrl:
        config.baseUrl?.trim() ||
        (!isDemoMode() ? process.env.OLLAMA_BASE_URL : undefined) ||
        "http://localhost:11434/v1",
      model: config.model || "llama3.2",
      apiKey: config.apiKey || "ollama",
    };
    if (!hasCallerBase) {
      markServerManagedLocalConfig(resolved);
    }
    return resolved;
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

function toPatchEnvelope(res: TextCompletionResult): GeneratePatchesResult {
  if (!res.success || !res.text) {
    return { success: false, error: res.error, providerStatus: res.providerStatus };
  }
  return { success: true, rawJson: res.text };
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
    const res = await dispatchTextCompletion(
      resolvedConfig,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      true,
      {
        temperature: 0.3,
        defaultModel: resolvedConfig.provider === "anthropic" ? "claude-sonnet-4-20250514" : undefined,
        taskLabel: "patch generation",
      }
    );
    return toPatchEnvelope(res);
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
    const res = await dispatchTextCompletion(
      resolvedConfig,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      true,
      {
        temperature: 0.3,
        defaultModel: resolvedConfig.provider === "anthropic" ? DEFAULT_MODELS.anthropic : undefined,
        taskLabel: "qualitative review",
      }
    );
    return toPatchEnvelope(res);
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
    const res = await dispatchTextCompletion(
      resolvedConfig,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      true,
      {
        temperature: 0.4,
        defaultModel: resolvedConfig.provider === "anthropic" ? DEFAULT_MODELS.anthropic : undefined,
        taskLabel: "cover letter generation",
      }
    );
    return toPatchEnvelope(res);
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
  const systemPrompt = input.formattingVersion === 2 ? buildPdfSpanSystemPrompt() : buildPdfToTypstSystemPrompt();
  const userPrompt = input.formattingVersion === 2 ? buildPdfSpanUserPrompt(input.rawText) : buildPdfToTypstUserPrompt(input.rawText, input.fileName, input.links);

  try {
    const completion = await dispatchTextCompletion(
      resolvedConfig,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      false,
      {
        temperature: resolvedConfig.provider === "gemini" ? 0.1 : 0.2,
        timeoutMs: 30_000,
        thinkingBudget: resolvedConfig.provider === "gemini" ? 1024 : undefined,
        defaultModel: resolvedConfig.provider === "anthropic" ? DEFAULT_MODELS.anthropic : undefined,
        taskLabel: "PDF conversion",
      }
    );

    const result: ConvertPdfResult = completion.success && completion.text
      ? { success: true, typstSource: stripCodeFences(completion.text) }
      : { success: false, error: completion.error };

    if (input.formattingVersion === 2) {
      if (!result.success || !result.typstSource) return { success: false, error: "Empty PDF extraction response" };
      try {
        const envelope = z.object({ assignments: z.unknown() }).strict().parse(JSON.parse(result.typstSource));
        const assignments = validateAssignments(input.rawText, envelope.assignments);
        if (!assignments.length) return { success: false, error: "Empty PDF extraction assignments" };
        return { success: true, assignments };
      } catch {
        return { success: false, error: "Invalid PDF extraction assignments" };
      }
    }
    if (result.success && result.typstSource) {
      const v1Validated = z.string().trim().min(1).safeParse(sanitizeTypstSource(result.typstSource));
      if (!v1Validated.success) {
        return { success: false, error: "Invalid v1 PDF Typst conversion output" };
      }
      result.typstSource = v1Validated.data;
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
  const systemPrompt = buildTypstRepairSystemPrompt();
  const userPrompt = buildTypstRepairUserPrompt(inputValidate.data);

  const missingKeyByProvider: Partial<Record<ProviderConfig["provider"], string>> = {
    openai: "OpenAI API key is missing. Please configure your key in Settings.",
    anthropic: "Anthropic API key is missing. Please configure your key in Settings.",
    gemini: "Gemini API key is missing. Please configure your key in Settings.",
  };

  try {
    const completion = await dispatchTextCompletion(
      resolvedConfig,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      resolvedConfig.provider === "gemini",
      {
        temperature: 0.1,
        timeoutMs: 30_000,
        defaultModel:
          resolvedConfig.provider === "gemini"
            ? DEFAULT_GEMINI_MODEL
            : resolvedConfig.provider === "anthropic"
            ? DEFAULT_MODELS.anthropic
            : undefined,
        missingKeyMessage: missingKeyByProvider[resolvedConfig.provider],
        taskLabel: "repair",
      }
    );

    if (!completion.success || !completion.text) {
      return { success: false, error: completion.error };
    }

    const cleaned = stripCodeFences(completion.text);
    const parsedJson = JSON.parse(cleaned);
    const validated = TypstRepairProposalSchema.safeParse(parsedJson);

    if (!validated.success) {
      return {
        success: false,
        error: `Provider returned invalid repair proposal JSON: ${validated.error.issues.map((i) => i.message).join(", ")}`,
      };
    }

    return { success: true, data: validated.data };
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
    const res = await dispatchTextCompletion(
      resolvedConfig,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      true,
      {
        temperature: 0.3,
        defaultModel: resolvedConfig.provider === "anthropic" ? "claude-sonnet-4-20250514" : undefined,
        taskLabel: "evidence extract",
      }
    );
    return toPatchEnvelope(res);
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
  messages: ChatMessageInput[],
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
    const rawResult = toPatchEnvelope(
      await dispatchTextCompletion(
        resolvedConfig,
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        true,
        {
          temperature: 0.3,
          defaultModel: resolvedConfig.provider === "anthropic" ? "claude-sonnet-4-20250514" : undefined,
          taskLabel: "JD formatting",
        }
      )
    );

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


