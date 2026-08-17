import { ProviderConfig, TestConnectionResult, GeneratePatchesResult, ConvertPdfResult } from "../types";
import { sanitizeError } from "../redact";
import { stripCodeFences } from "../utils";
import { TypstRepairInput, TypstRepairProposal, TypstRepairProposalSchema } from "../repair-schema";
import { buildTypstRepairSystemPrompt, buildTypstRepairUserPrompt } from "../repair-prompt";
import type { ChatCompletionResult } from "./custom";

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

/**
 * Phase 4.3b: Sends a structured chat completion request to OpenAI for qualitative review.
 */
export async function generateOpenAIQualitativeReview(
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
    return { success: false, error: sanitizeError(`OpenAI qualitative review failed: ${err instanceof Error ? err.message : String(err)}`) };
  }
}

/**
 * Phase 5: Sends a structured chat completion request to OpenAI for cover letter generation.
 */
export async function generateOpenAICoverLetter(
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
        temperature: 0.4,
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
    return { success: false, error: sanitizeError(`OpenAI cover letter generation failed: ${err instanceof Error ? err.message : String(err)}`) };
  }
}

/**
 * Task 9.1: Sends a chat completion request to OpenAI for PDF-to-Typst conversion.
 */
export async function convertOpenAIPdfTextToTypst(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<ConvertPdfResult> {
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
      return { success: false, error: sanitizeError(`OpenAI API returned status ${res.status}: ${errBody}`) };
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      return { success: false, error: "OpenAI returned empty content in response." };
    }

    const typstSource = stripCodeFences(rawContent);
    return { success: true, typstSource };
  } catch (err) {
    return { success: false, error: sanitizeError(`OpenAI PDF conversion failed: ${err instanceof Error ? err.message : String(err)}`) };
  }
}

export async function repairTypstWithOpenAI(
  config: ProviderConfig,
  input: TypstRepairInput
): Promise<{ success: boolean; data?: TypstRepairProposal; error?: string }> {
  const apiKey = config.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
  const baseUrl = (config.baseUrl?.trim() || process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com").replace(/\/+$/, "");
  const model = config.model?.trim() || "gpt-4o";

  if (!apiKey) {
    return { success: false, error: "OpenAI API key is missing. Please configure your key in Settings." };
  }

  const systemPrompt = buildTypstRepairSystemPrompt();
  const userPrompt = buildTypstRepairUserPrompt(input);

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
      return { success: false, error: sanitizeError(`OpenAI API status ${res.status}: ${errBody}`) };
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content;
    if (!rawContent) {
      return { success: false, error: "OpenAI returned empty content." };
    }

    const cleaned = stripCodeFences(rawContent);
    const parsedJson = JSON.parse(cleaned);
    const validated = TypstRepairProposalSchema.safeParse(parsedJson);

    if (!validated.success) {
      return {
        success: false,
        error: `OpenAI returned invalid repair proposal JSON: ${validated.error.issues.map((i) => i.message).join(", ")}`,
      };
    }

    return { success: true, data: validated.data };
  } catch (err) {
    return {
      success: false,
      error: sanitizeError(`OpenAI repair failed: ${err instanceof Error ? err.message : String(err)}`),
    };
  }
}

/**
 * Multi-turn chat completion via OpenAI with tool/function calling support.
 */
export async function chatOpenAI(
  config: ProviderConfig,
  messages: Array<{ role: string; content: string }>,
  tools: any[],
): Promise<ChatCompletionResult> {
  const apiKey = config.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
  const baseUrl = (config.baseUrl?.trim() || process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com").replace(/\/+$/, "");
  const model = config.model?.trim() || "gpt-4o-mini";

  if (!apiKey) {
    throw new Error("OpenAI API key is missing.");
  }

  const body: any = { model, messages, temperature: 0.4 };
  if (tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    let errBody = "";
    try {
      const json = await res.json();
      errBody = json.error?.message || JSON.stringify(json);
    } catch {
      errBody = res.statusText;
    }
    throw new Error(sanitizeError(`OpenAI chat failed (${res.status}): ${errBody}`));
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

