import { ProviderConfig, TestConnectionResult, GeneratePatchesResult } from "../types";
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

/**
 * Sends a structured chat completion request to OpenAI for patch generation.
 */
export async function generateOpenAIPatches(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<GeneratePatchesResult> {
  const apiKey = config.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
  const baseUrl = (config.baseUrl?.trim() || process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com").replace(/\/+$/, "");
  const model = config.model?.trim() || "gpt-4o";

  if (!apiKey) {
    return { success: false, error: "OpenAI API key is missing." };
  }

  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
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
      return { success: false, error: sanitizeError(`OpenAI API returned status ${res.status}: ${errBody}`) };
    }

    const data = await res.json();
    const rawJson = data.choices?.[0]?.message?.content;

    if (!rawJson) {
      return { success: false, error: "OpenAI returned empty content in response." };
    }

    return { success: true, rawJson };
  } catch (err) {
    return { success: false, error: sanitizeError(`OpenAI patch generation failed: ${err instanceof Error ? err.message : String(err)}`) };
  }
}

