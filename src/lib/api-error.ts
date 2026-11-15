/**
 * Helpers for safely reading and formatting API responses (JSON or non-JSON HTML/text error bodies).
 */

function isHtmlBody(raw: string): boolean {
  const trimmed = raw.trimStart();
  return (
    trimmed.startsWith("<") &&
    /^<(?:!doctype|html|head|body|title|h[1-6]|p|div|span|pre)\b/i.test(trimmed)
  );
}

function formatErrorDetails(details: unknown): string {
  if (!details) return "";
  if (typeof details === "string") return details.trim();
  if (Array.isArray(details)) {
    const parts = details
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (
          item &&
          typeof item === "object" &&
          "message" in item &&
          typeof (item as { message?: unknown }).message === "string"
        ) {
          return ((item as { message: string }).message).trim();
        }
        return "";
      })
      .filter(Boolean);
    return parts.join("; ");
  }
  if (typeof details === "object") {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        const msgs = value.filter((m): m is string => typeof m === "string" && Boolean(m.trim()));
        if (msgs.length > 0) {
          parts.push(`${key}: ${msgs.join(", ")}`);
        }
      } else if (typeof value === "string" && value.trim()) {
        parts.push(`${key}: ${value.trim()}`);
      }
    }
    return parts.join("; ");
  }
  return "";
}

/**
 * Extracts a human-readable error message from a parsed JSON response payload,
 * preferring `message || error` and appending `details` when present.
 */
export function extractApiErrorMessage(payload: unknown, fallback = "Request failed"): string {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as Record<string, unknown>;

  const nestedErrorMessage =
    record.error &&
    typeof record.error === "object" &&
    "message" in record.error &&
    typeof (record.error as { message?: unknown }).message === "string"
      ? (record.error as { message: string }).message.trim()
      : "";

  const baseMessage =
    (typeof record.message === "string" && record.message.trim()) ||
    (typeof record.error === "string" && record.error.trim()) ||
    nestedErrorMessage ||
    "";

  const detailsMessage = formatErrorDetails(record.details);

  if (baseMessage && detailsMessage) {
    return baseMessage.includes(detailsMessage)
      ? baseMessage
      : `${baseMessage}: ${detailsMessage}`;
  }
  if (detailsMessage) return detailsMessage;
  if (baseMessage) return baseMessage;
  return fallback;
}

function formatFromRawText(
  rawText: string,
  status: number,
  statusText: string,
  fallback: string
): string {
  const trimmed = rawText.trim();
  if (trimmed) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const extracted = extractApiErrorMessage(parsed, "");
      if (extracted) return extracted;
    } catch {
      if (!isHtmlBody(trimmed) && trimmed.length <= 240) {
        return trimmed;
      }
    }
  }
  const statusLabel = status ? `HTTP ${status}${statusText ? ` ${statusText}` : ""}` : "";
  return statusLabel ? `${fallback} (${statusLabel})` : fallback;
}

/**
 * Safely parses a Response body as JSON without throwing `SyntaxError` on HTML or empty bodies.
 */
export async function readJsonSafe<T = Record<string, unknown>>(res: Response): Promise<T | null> {
  try {
    if (typeof res.text === "function") {
      const text = await res.text();
      if (!text || !text.trim()) return null;
      return JSON.parse(text) as T;
    }
    if (typeof res.json === "function") {
      return (await res.json()) as T;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Reads an error Response (JSON or non-JSON HTML/text) and returns a formatted error message.
 */
export async function parseApiError(res: Response, fallback = "Request failed"): Promise<string> {
  try {
    if (typeof res.text === "function") {
      const rawText = await res.text();
      return formatFromRawText(rawText, res.status, res.statusText || "", fallback);
    }
    if (typeof res.json === "function") {
      const parsed = await res.json();
      return extractApiErrorMessage(parsed, fallback);
    }
  } catch {
    // Fall through to status-based fallback
  }
  const statusLabel = res.status ? `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""}` : "";
  return statusLabel ? `${fallback} (${statusLabel})` : fallback;
}

/**
 * Reads a Response body once, safely parsing JSON and computing a formatted error string when
 * `!res.ok` or `data.success === false`.
 */
export async function readApiResponse<T = Record<string, unknown>>(
  res: Response,
  fallback = "Request failed"
): Promise<{ ok: boolean; status: number; data: T | null; error: string | null }> {
  let rawText = "";
  let data: T | null = null;

  try {
    if (typeof res.text === "function") {
      rawText = await res.text();
      if (rawText.trim()) {
        try {
          data = JSON.parse(rawText) as T;
        } catch {
          data = null;
        }
      }
    } else if (typeof res.json === "function") {
      data = (await res.json()) as T;
    }
  } catch {
    data = null;
  }

  const payloadSuccess =
    data && typeof data === "object" && "success" in data
      ? (data as { success?: unknown }).success !== false
      : true;

  if (res.ok && payloadSuccess) {
    return { ok: true, status: res.status, data, error: null };
  }

  const error =
    data !== null
      ? extractApiErrorMessage(data, formatFromRawText("", res.status, res.statusText || "", fallback))
      : formatFromRawText(rawText, res.status, res.statusText || "", fallback);

  return { ok: false, status: res.status, data, error };
}
