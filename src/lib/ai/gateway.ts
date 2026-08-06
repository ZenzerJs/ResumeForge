import { ProviderConfig, ProviderConfigSchema, TestConnectionResult, GeneratePatchesInput, GeneratePatchesResult } from "./types";
import { testOpenAIConnection } from "./providers/openai";
import { testAnthropicConnection } from "./providers/anthropic";
import { testGeminiConnection } from "./providers/gemini";
import { testCustomConnection } from "./providers/custom";
import { generateOpenAIPatches } from "./providers/openai";
import { generateAnthropicPatches } from "./providers/anthropic";
import { generateGeminiPatches } from "./providers/gemini";
import { generateCustomPatches } from "./providers/custom";
import { sanitizeError } from "./redact";
import { buildPatchSystemPrompt, buildPatchUserPrompt } from "./prompt-template";

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
  const systemPrompt = buildPatchSystemPrompt();
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
