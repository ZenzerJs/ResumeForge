import { ProviderConfig, ProviderConfigSchema, TestConnectionResult } from "./types";
import { testOpenAIConnection } from "./providers/openai";
import { testAnthropicConnection } from "./providers/anthropic";
import { testGeminiConnection } from "./providers/gemini";
import { testCustomConnection } from "./providers/custom";
import { sanitizeError } from "./redact";

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
