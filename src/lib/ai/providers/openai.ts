import { ProviderConfig, TestConnectionResult } from "../types";
import { sanitizeError } from "../redact";

export async function testOpenAIConnection(config: ProviderConfig): Promise<TestConnectionResult> {
  const apiKey = config.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
  const baseUrl = (config.baseUrl?.trim() || process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com").replace(/\/+$/, "");

  if (!apiKey) {
    return {
      success: false,
      provider: "openai",
      message: "OpenAI API key is missing. Please provide a key in settings or set OPENAI_API_KEY.",
    };
  }

  const startTime = Date.now();
  try {
    const res = await fetch(`${baseUrl}/v1/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
        provider: "openai",
        message: sanitizeError(`OpenAI API returned status ${res.status}: ${errBody}`),
        latencyMs,
      };
    }

    const data = await res.json();
    const modelCount = Array.isArray(data?.data) ? data.data.length : undefined;

    return {
      success: true,
      provider: "openai",
      message: `Successfully connected to OpenAI models API (${modelCount ?? 0} models available).`,
      modelCount,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      provider: "openai",
      message: sanitizeError(`Connection failed: ${err instanceof Error ? err.message : String(err)}`),
      latencyMs,
    };
  }
}
