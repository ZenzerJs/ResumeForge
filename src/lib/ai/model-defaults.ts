/**
 * Single source of truth for default AI provider models and retired alias mapping.
 */

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export const DEFAULT_MODELS: Record<string, string> = {
  gemini: DEFAULT_GEMINI_MODEL,
  openai: "gpt-4.1",
  anthropic: "claude-sonnet-4-20250514",
  groq: "llama-3.3-70b-versatile",
  ollama: "llama3",
  custom: "llama3",
};

/**
 * Only genuinely retired 1.x Gemini identifiers are mapped forward.
 * Newer or custom user-supplied Gemini model IDs (e.g. gemini-3.8-flash,
 * gemini-2.5-flash, preview models) are preserved verbatim.
 */
const RETIRED_GEMINI_MODEL_ALIASES: ReadonlySet<string> = new Set([
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-pro",
  "gemini-1.5-pro-latest",
]);

export function normalizeGeminiModel(model?: string | null, fallback = DEFAULT_GEMINI_MODEL): string {
  const trimmed = typeof model === "string" ? model.trim() : "";
  if (!trimmed) {
    return fallback;
  }
  if (RETIRED_GEMINI_MODEL_ALIASES.has(trimmed)) {
    return fallback;
  }
  return trimmed;
}

export function formatProviderFailureMessage(
  rawError: string | undefined,
  providerStatus?: number
): string {
  if (providerStatus === 503) {
    return "The configured AI model is temporarily overloaded (503). Retry in a moment or switch models in Settings.";
  }
  if (providerStatus === 429) {
    return "The configured AI provider is rate-limited or out of quota (429). Wait a moment or check your billing/quota in Settings.";
  }
  if (providerStatus === 404) {
    return "The configured AI model was not found (404). Open Settings, run Test Connection, and pick an available model.";
  }
  return rawError || "AI provider returned no content.";
}
