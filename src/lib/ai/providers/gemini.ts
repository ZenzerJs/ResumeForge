import { ProviderConfig, TestConnectionResult, GeneratePatchesResult, ConvertPdfResult } from "../types";
import { sanitizeError } from "../redact";
import { stripCodeFences } from "../utils";
import { TypstRepairInput, TypstRepairProposal, TypstRepairProposalSchema } from "../repair-schema";
import { buildTypstRepairSystemPrompt, buildTypstRepairUserPrompt } from "../repair-prompt";
import type { ChatCompletionResult } from "./custom";

function geminiHeaders(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-goog-api-key": apiKey,
  };
}

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
    const res = await fetch(`${baseUrl}/v1beta/models`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: AbortSignal.timeout(5000),
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
      `${baseUrl}/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: geminiHeaders(apiKey),
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
      `${baseUrl}/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: geminiHeaders(apiKey),
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

/**
 * Phase 5: Sends a structured generateContent request to Gemini for cover letter generation.
 */
export async function generateGeminiCoverLetter(
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
      `${baseUrl}/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: geminiHeaders(apiKey),
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.4,
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
    return { success: false, error: sanitizeError(`Gemini cover letter generation failed: ${err instanceof Error ? err.message : String(err)}`) };
  }
}

/**
 * Task 9.1: Sends a generateContent request to Gemini for PDF-to-Typst conversion.
 */
export async function convertGeminiPdfTextToTypst(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<ConvertPdfResult> {
  const apiKey = config.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
  const baseUrl = (config.baseUrl?.trim() || process.env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");
  const model = config.model?.trim() || "gemini-2.5-flash";

  if (!apiKey) {
    return { success: false, error: "Gemini API key is missing." };
  }

  try {
    const res = await fetch(
      `${baseUrl}/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: geminiHeaders(apiKey),
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.2,
          },
        }),
        signal: AbortSignal.timeout(30000),
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
    const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawContent) {
      return { success: false, error: "Gemini returned empty content in response." };
    }

    const typstSource = stripCodeFences(rawContent);
    return { success: true, typstSource };
  } catch (err) {
    return { success: false, error: sanitizeError(`Gemini PDF conversion failed: ${err instanceof Error ? err.message : String(err)}`) };
  }
}

export async function repairTypstWithGemini(
  config: ProviderConfig,
  input: TypstRepairInput
): Promise<{ success: boolean; data?: TypstRepairProposal; error?: string }> {
  const apiKey = config.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
  const baseUrl = (config.baseUrl?.trim() || process.env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");
  const model = config.model?.trim() || "gemini-1.5-pro";

  if (!apiKey) {
    return { success: false, error: "Gemini API key is missing. Please configure your key in Settings." };
  }

  const systemPrompt = buildTypstRepairSystemPrompt();
  const userPrompt = buildTypstRepairUserPrompt(input);

  try {
    const res = await fetch(
      `${baseUrl}/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: geminiHeaders(apiKey),
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(30000),
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
      return { success: false, error: sanitizeError(`Gemini API status ${res.status}: ${errBody}`) };
    }

    const data = await res.json();
    const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawContent) {
      return { success: false, error: "Gemini returned empty content." };
    }

    const cleaned = stripCodeFences(rawContent);
    const parsedJson = JSON.parse(cleaned);
    const validated = TypstRepairProposalSchema.safeParse(parsedJson);

    if (!validated.success) {
      return {
        success: false,
        error: `Gemini returned invalid repair proposal JSON: ${validated.error.issues.map((i) => i.message).join(", ")}`,
      };
    }

    return { success: true, data: validated.data };
  } catch (err) {
    return {
      success: false,
      error: sanitizeError(`Gemini repair failed: ${err instanceof Error ? err.message : String(err)}`),
    };
  }
}

/**
 * Multi-turn chat completion via Gemini generateContent with function calling.
 */
export async function chatGemini(
  config: ProviderConfig,
  messages: Array<{ role: string; content: string }>,
  tools: any[],
): Promise<ChatCompletionResult> {
  const apiKey = config.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
  const baseUrl = (config.baseUrl?.trim() || process.env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");
  const model = config.model?.trim() || "gemini-2.0-flash";

  if (!apiKey) {
    throw new Error("Gemini API key is missing.");
  }

  // Extract system message and convert to Gemini contents format
  const systemMsg = messages.find((m) => m.role === "system");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  // Convert OpenAI tool schemas to Gemini functionDeclarations
  const functionDeclarations = tools.map((t: any) => ({
    name: t.function?.name || t.name,
    description: t.function?.description || t.description || "",
    parameters: t.function?.parameters || t.parameters || { type: "object", properties: {} },
  }));

  const body: any = { contents, generationConfig: { temperature: 0.4 } };
  if (systemMsg) {
    body.system_instruction = { parts: [{ text: systemMsg.content }] };
  }
  if (functionDeclarations.length > 0) {
    body.tools = [{ functionDeclarations }];
  }

  const res = await fetch(
    `${baseUrl}/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: geminiHeaders(apiKey),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
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
    throw new Error(sanitizeError(`Gemini chat failed (${res.status}): ${errBody}`));
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];

  const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);
  const functionCallParts = parts.filter((p: any) => p.functionCall);

  return {
    content: textParts.join(""),
    toolCalls: functionCallParts.map((p: any) => ({
      id: crypto.randomUUID(),
      name: p.functionCall.name,
      arguments: JSON.stringify(p.functionCall.args || {}),
    })),
  };
}

