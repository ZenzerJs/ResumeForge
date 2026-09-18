import { ProviderConfig, TestConnectionResult, GeneratePatchesResult, ConvertPdfResult } from "../types";
import { sanitizeError } from "../redact";
import { stripCodeFences } from "../utils";
import { TypstRepairInput, TypstRepairProposal, TypstRepairProposalSchema } from "../repair-schema";
import { buildTypstRepairSystemPrompt, buildTypstRepairUserPrompt } from "../repair-prompt";
import { safeFetch } from "@/lib/security/safe-fetch";

async function customFetch(url: string, init?: RequestInit): Promise<Response> {
  return safeFetch(url, init ?? {}, {
    allowLocalhost: process.env.NODE_ENV !== "production",
    timeoutMs: 120_000,
  });
}

export interface ChatCompletionResult {
  content: string;
  toolCalls: Array<{ id: string; name: string; arguments: string }>;
}

/**
 * Multi-turn chat completion via a Custom OpenAI-compatible endpoint.
 * Supports function/tool calling in OpenAI format.
 */
export async function chatCustom(
  config: ProviderConfig,
  messages: Array<{ role: string; content: string }>,
  tools: any[],
): Promise<ChatCompletionResult> {
  const apiKey = config.apiKey?.trim() || process.env.CUSTOM_OPENAI_API_KEY?.trim();
  const baseUrlRaw = config.baseUrl?.trim() || process.env.CUSTOM_OPENAI_BASE_URL?.trim() || "http://localhost:8000";
  const baseUrl = baseUrlRaw.replace(/\/+$/, "");
  const model = config.model?.trim() || "default";

  const completionsUrl = baseUrl.endsWith("/v1")
    ? `${baseUrl}/chat/completions`
    : `${baseUrl}/v1/chat/completions`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const body: any = { model, messages, temperature: 0.4 };
  if (tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const res = await customFetch(completionsUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let errBody = "";
    try {
      const json = await res.json();
      errBody = json.error?.message || JSON.stringify(json);
    } catch {
      errBody = res.statusText;
    }
    throw new Error(sanitizeError(`Custom endpoint chat failed (${res.status}): ${errBody}`));
  }

  const data = await res.json();
  const choice = data.choices?.[0]?.message;
  const content = choice?.content || "";
  const rawToolCalls = choice?.tool_calls || [];

  return {
    content,
    toolCalls: rawToolCalls.map((tc: any) => ({
      id: tc.id || crypto.randomUUID(),
      name: tc.function?.name || tc.name || "unknown",
      arguments: typeof tc.function?.arguments === "string" ? tc.function.arguments : JSON.stringify(tc.function?.arguments || {}),
    })),
  };
}

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

    let res = await customFetch(targetUrl, {
      method: "GET",
      headers,
    });

    // Fallback: try raw /models if /v1/models returns 404
    if (res.status === 404 && !baseUrl.endsWith("/v1")) {
      res = await customFetch(`${baseUrl}/models`, {
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

    const res = await customFetch(completionsUrl, {
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

    const res = await customFetch(completionsUrl, {
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

/**
 * Phase 5: Sends a cover letter request to a Custom OpenAI-compatible endpoint.
 */
export async function generateCustomCoverLetter(
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

    const res = await customFetch(completionsUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
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
    return { success: false, error: sanitizeError(`Custom endpoint cover letter generation failed: ${err instanceof Error ? err.message : String(err)}`) };
  }
}

/**
 * Task 9.1: Sends a chat completion request to a Custom OpenAI-compatible endpoint for PDF-to-Typst conversion.
 */
export async function convertCustomPdfTextToTypst(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<ConvertPdfResult> {
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

    const res = await customFetch(completionsUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(30000),
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
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      return { success: false, error: "Custom endpoint returned empty content in response." };
    }

    const typstSource = stripCodeFences(rawContent);
    return { success: true, typstSource };
  } catch (err) {
    return { success: false, error: sanitizeError(`Custom endpoint PDF conversion failed: ${err instanceof Error ? err.message : String(err)}`) };
  }
}

export async function repairTypstWithCustom(
  config: ProviderConfig,
  input: TypstRepairInput
): Promise<{ success: boolean; data?: TypstRepairProposal; error?: string }> {
  const apiKey = config.apiKey?.trim() || process.env.CUSTOM_OPENAI_API_KEY?.trim();
  const baseUrlRaw = config.baseUrl?.trim() || process.env.CUSTOM_OPENAI_BASE_URL?.trim() || "http://localhost:8000";
  const baseUrl = baseUrlRaw.replace(/\/+$/, "");
  const model = config.model?.trim() || "default";

  const systemPrompt = buildTypstRepairSystemPrompt();
  const userPrompt = buildTypstRepairUserPrompt(input);

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const completionsUrl = baseUrl.endsWith("/v1") ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;

    const res = await customFetch(completionsUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(30000),
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
    const rawContent = data.choices?.[0]?.message?.content;
    if (!rawContent) {
      return { success: false, error: "Custom endpoint returned empty content." };
    }

    const cleaned = stripCodeFences(rawContent);
    const parsedJson = JSON.parse(cleaned);
    const validated = TypstRepairProposalSchema.safeParse(parsedJson);

    if (!validated.success) {
      return {
        success: false,
        error: `Custom endpoint returned invalid repair proposal JSON: ${validated.error.issues.map((i) => i.message).join(", ")}`,
      };
    }

    return { success: true, data: validated.data };
  } catch (err) {
    return {
      success: false,
      error: sanitizeError(`Custom endpoint repair failed: ${err instanceof Error ? err.message : String(err)}`),
    };
  }
}

