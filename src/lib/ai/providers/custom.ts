import { ProviderConfig, TestConnectionResult, GeneratePatchesResult } from "../types";
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

/**
 * Sends a structured chat completion request to a Custom OpenAI-compatible endpoint.
 */
export async function generateCustomPatches(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<GeneratePatchesResult> {
  const apiKey = config.apiKey?.trim() || process.env.CUSTOM_OPENAI_API_KEY?.trim();
  const baseUrlRaw = config.baseUrl?.trim() || process.env.CUSTOM_OPENAI_BASE_URL?.trim() || "http://localhost:8000";
  const baseUrl = baseUrlRaw.replace(/\/+$/, "");
  const model = config.model?.trim() || "default";

  const completionsUrl = baseUrl.endsWith("/v1")
    ? `${baseUrl}/chat/completions`
    : `${baseUrl}/v1/chat/completions`;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const res = await fetch(completionsUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      let errBody = "";
      try {
        const json = await res.json();
        errBody = json.error?.message || JSON.stringify(json);
      } catch {
        errBody = res.statusText;
      }
      return { success: false, error: sanitizeError(`Custom endpoint returned status ${res.status}: ${errBody}`) };
    }

    const data = await res.json();
    const rawJson = data.choices?.[0]?.message?.content;

    if (!rawJson) {
      return { success: false, error: "Custom endpoint returned empty content in response." };
    }

    return { success: true, rawJson };
  } catch (err) {
    return { success: false, error: sanitizeError(`Custom endpoint patch generation failed: ${err instanceof Error ? err.message : String(err)}`) };
  }
}

/**
 * Phase 4.3b: Sends a qualitative review request to a Custom OpenAI-compatible endpoint.
 */
export async function generateCustomQualitativeReview(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<GeneratePatchesResult> {
  const apiKey = config.apiKey?.trim() || process.env.CUSTOM_OPENAI_API_KEY?.trim();
  const baseUrlRaw = config.baseUrl?.trim() || process.env.CUSTOM_OPENAI_BASE_URL?.trim() || "http://localhost:8000";
  const baseUrl = baseUrlRaw.replace(/\/+$/, "");
  const model = config.model?.trim() || "default";

  const completionsUrl = baseUrl.endsWith("/v1")
    ? `${baseUrl}/chat/completions`
    : `${baseUrl}/v1/chat/completions`;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const res = await fetch(completionsUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      let errBody = "";
      try {
        const json = await res.json();
        errBody = json.error?.message || JSON.stringify(json);
      } catch {
        errBody = res.statusText;
      }
      return { success: false, error: sanitizeError(`Custom endpoint returned status ${res.status}: ${errBody}`) };
    }

    const data = await res.json();
    const rawJson = data.choices?.[0]?.message?.content;

    if (!rawJson) {
      return { success: false, error: "Custom endpoint returned empty content in response." };
    }

    return { success: true, rawJson };
  } catch (err) {
    return { success: false, error: sanitizeError(`Custom endpoint qualitative review failed: ${err instanceof Error ? err.message : String(err)}`) };
  }
}

