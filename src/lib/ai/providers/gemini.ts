import { ProviderConfig, TestConnectionResult, GeneratePatchesResult } from "../types";
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

/**
 * Sends a structured generateContent request to Gemini for patch generation.
 */
export async function generateGeminiPatches(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<GeneratePatchesResult> {
  const apiKey = config.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
  const baseUrl = (config.baseUrl?.trim() || process.env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");
  const model = config.model?.trim() || "gemini-2.5-flash";

  if (!apiKey) {
    return { success: false, error: "Gemini API key is missing." };
  }

  try {
    const res = await fetch(
      `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!res.ok) {
      let errBody = "";
      try {
        const json = await res.json();
        errBody = json.error?.message || JSON.stringify(json);
      } catch {
        errBody = res.statusText;
      }
      return { success: false, error: sanitizeError(`Gemini API returned status ${res.status}: ${errBody}`) };
    }

    const data = await res.json();
    const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawJson) {
      return { success: false, error: "Gemini returned empty content in response." };
    }

    return { success: true, rawJson };
  } catch (err) {
    return { success: false, error: sanitizeError(`Gemini patch generation failed: ${err instanceof Error ? err.message : String(err)}`) };
  }
}

/**
 * Phase 4.3b: Sends a structured generateContent request to Gemini for qualitative review.
 */
export async function generateGeminiQualitativeReview(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<GeneratePatchesResult> {
  const apiKey = config.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
  const baseUrl = (config.baseUrl?.trim() || process.env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");
  const model = config.model?.trim() || "gemini-2.5-flash";

  if (!apiKey) {
    return { success: false, error: "Gemini API key is missing." };
  }

  try {
    const res = await fetch(
      `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!res.ok) {
      let errBody = "";
      try {
        const json = await res.json();
        errBody = json.error?.message || JSON.stringify(json);
      } catch {
        errBody = res.statusText;
      }
      return { success: false, error: sanitizeError(`Gemini API returned status ${res.status}: ${errBody}`) };
    }

    const data = await res.json();
    const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawJson) {
      return { success: false, error: "Gemini returned empty content in response." };
    }

    return { success: true, rawJson };
  } catch (err) {
    return { success: false, error: sanitizeError(`Gemini qualitative review failed: ${err instanceof Error ? err.message : String(err)}`) };
  }
}

