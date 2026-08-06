/**
 * API Key Redaction Utility
 *
 * Scrubs any sensitive API key patterns from error messages, stack traces, and console logs.
 * Supports OpenAI, Anthropic, Gemini, Bearer tokens, and common API key pattern formats.
 */

// Common API key patterns
const API_KEY_PATTERNS = [
  /sk-proj-[A-Za-z0-9_-]+/g,
  /sk-ant-[A-Za-z0-9_-]+/g,
  /sk-[A-Za-z0-9_-]{20,}/g,
  /AIzaSy[A-Za-z0-9_-]{33}/g,
  /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi,
  /key=[A-Za-z0-9_-]{20,}/gi,
];

/**
 * Redacts any key-shaped string from a given input string.
 */
export function redactKeys(text: string): string {
  if (!text || typeof text !== "string") {
    return text;
  }

  let sanitized = text;

  for (const pattern of API_KEY_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => {
      if (match.toLowerCase().startsWith("bearer ")) {
        return "Bearer [REDACTED_KEY]";
      }
      if (match.toLowerCase().startsWith("key=")) {
        return "key=[REDACTED_KEY]";
      }
      return "[REDACTED_KEY]";
    });
  }

  return sanitized;
}

/**
 * Converts an arbitrary error object into a safely sanitized error message string,
 * ensuring no API keys or tokens are leaked in exception output.
 */
export function sanitizeError(error: unknown): string {
  if (!error) {
    return "An unknown error occurred.";
  }

  let message = "";
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  } else {
    try {
      message = JSON.stringify(error);
    } catch {
      message = String(error);
    }
  }

  return redactKeys(message);
}
