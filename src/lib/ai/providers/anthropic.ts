import { ProviderConfig, TestConnectionResult } from "../types";
import { sanitizeError } from "../redact";

export async function testAnthropicConnection(config: ProviderConfig): Promise<TestConnectionResult> {
  const apiKey = config.apiKey?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
  const baseUrl = (config.baseUrl?.trim() || process.env.ANTHROPIC_BASE_URL?.trim() || "https://api.anthropic.com").replace(/\/+$/, "");

  if (!apiKey) {
    return {
      success: false,
      provider: "anthropic",
      message: "Anthropic API key is missing. Please provide a key in settings or set ANTHROPIC_API_KEY.",
    };
  }

  const startTime = Date.now();
  try {
    const res = await fetch(`${baseUrl}/v1/models`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
    });

    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      let errBody = "";
      try {
        const json = await res.json();
        errBody = json.error?.message || JSON.stringify(json);
      } catch {
        errBody = res.statusText;
      }
      return {
        success: false,
        provider: "anthropic",
        message: sanitizeError(`Anthropic API returned status ${res.status}: ${errBody}`),
        latencyMs,
      };
    }

    const data = await res.json();
    const modelCount = Array.isArray(data?.data) ? data.data.length : undefined;

    return {
      success: true,
      provider: "anthropic",
      message: `Successfully connected to Anthropic models API (${modelCount ?? 0} models available).`,
      modelCount,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      provider: "anthropic",
      message: sanitizeError(`Connection failed: ${err instanceof Error ? err.message : String(err)}`),
      latencyMs,
    };
  }
}
