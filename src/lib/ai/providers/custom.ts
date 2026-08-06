import { ProviderConfig, TestConnectionResult } from "../types";
import { sanitizeError } from "../redact";

/**
 * Custom OpenAI-Compatible Endpoint Adapter
 *
 * Connects to any local or self-hosted endpoint that implements OpenAI-compatible API schemas.
 */
export async function testCustomConnection(config: ProviderConfig): Promise<TestConnectionResult> {
  const apiKey = config.apiKey?.trim() || process.env.CUSTOM_OPENAI_API_KEY?.trim();
  const baseUrlRaw = config.baseUrl?.trim() || process.env.CUSTOM_OPENAI_BASE_URL?.trim() || "http://localhost:8000";
  const baseUrl = baseUrlRaw.replace(/\/+$/, "");

  const startTime = Date.now();
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    // Attempt /models or /v1/models
    const targetUrl = baseUrl.endsWith("/v1") ? `${baseUrl}/models` : `${baseUrl}/v1/models`;

    let res = await fetch(targetUrl, {
      method: "GET",
      headers,
    });

    // Fallback: try raw /models if /v1/models returns 404
    if (res.status === 404 && !baseUrl.endsWith("/v1")) {
      res = await fetch(`${baseUrl}/models`, {
        method: "GET",
        headers,
      });
    }

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
        provider: "custom",
        message: sanitizeError(`Custom endpoint returned status ${res.status}: ${errBody}`),
        latencyMs,
      };
    }

    const data = await res.json();
    const modelCount = Array.isArray(data?.data)
      ? data.data.length
      : Array.isArray(data?.models)
      ? data.models.length
      : undefined;

    return {
      success: true,
      provider: "custom",
      message: `Successfully connected to custom OpenAI-compatible endpoint${modelCount !== undefined ? ` (${modelCount} models reported)` : ""}.`,
      modelCount,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      provider: "custom",
      message: sanitizeError(`Connection to custom endpoint failed: ${err instanceof Error ? err.message : String(err)}`),
      latencyMs,
    };
  }
}
