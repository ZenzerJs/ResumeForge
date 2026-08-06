import { ProviderConfig, TestConnectionResult } from "../types";
import { sanitizeError } from "../redact";

export async function testGeminiConnection(config: ProviderConfig): Promise<TestConnectionResult> {
  const apiKey = config.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
  const baseUrl = (config.baseUrl?.trim() || process.env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");

  if (!apiKey) {
    return {
      success: false,
      provider: "gemini",
      message: "Gemini API key is missing. Please provide a key in settings or set GEMINI_API_KEY.",
    };
  }

  const startTime = Date.now();
  try {
    const res = await fetch(`${baseUrl}/v1beta/models?key=${apiKey}`, {
      method: "GET",
      headers: {
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
        provider: "gemini",
        message: sanitizeError(`Gemini API returned status ${res.status}: ${errBody}`),
        latencyMs,
      };
    }

    const data = await res.json();
    const modelCount = Array.isArray(data?.models) ? data.models.length : undefined;

    return {
      success: true,
      provider: "gemini",
      message: `Successfully connected to Gemini API (${modelCount ?? 0} models available).`,
      modelCount,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      provider: "gemini",
      message: sanitizeError(`Connection failed: ${err instanceof Error ? err.message : String(err)}`),
      latencyMs,
    };
  }
}
