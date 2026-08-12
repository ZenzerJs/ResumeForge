const PRIVATE_IPV4 =
  /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/;
const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google.com",
  "instance-data",
]);

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

function hostnameIsBlocked(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
    return true;
  }
  if (PRIVATE_IPV4.test(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".internal")) return true;
  return false;
}

function isLocalDevHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export function isSafeHref(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function assertSafePublicUrl(
  rawUrl: string,
  options?: { allowLocalhost?: boolean; allowedHosts?: string[] }
): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }

  const allowLocalhost =
    options?.allowLocalhost ?? process.env.NODE_ENV !== "production";

  if (parsed.protocol !== "https:") {
    if (!(allowLocalhost && parsed.protocol === "http:" && isLocalDevHost(parsed.hostname))) {
      throw new UnsafeUrlError("Only HTTPS URLs are allowed");
    }
  }

  if (parsed.username || parsed.password) {
    throw new UnsafeUrlError("URLs with credentials are not allowed");
  }

  if (options?.allowedHosts && options.allowedHosts.length > 0) {
    const allowed = new Set(options.allowedHosts.map((h) => h.toLowerCase()));
    if (!allowed.has(parsed.hostname.toLowerCase())) {
      throw new UnsafeUrlError(`Host ${parsed.hostname} is not on the import allowlist`);
    }
  }

  if (!allowLocalhost || !isLocalDevHost(parsed.hostname)) {
    if (hostnameIsBlocked(parsed.hostname)) {
      throw new UnsafeUrlError("Private or loopback hosts are not allowed");
    }
  }

  return parsed;
}

export function getImportAllowlist(): string[] {
  const extra = (process.env.ALLOWED_IMPORT_HOSTS || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return ["raw.githubusercontent.com", ...extra];
}

export async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
  options?: {
    allowLocalhost?: boolean;
    allowedHosts?: string[];
    timeoutMs?: number;
    followRedirects?: boolean;
    maxRedirects?: number;
  }
): Promise<Response> {
  const parsed = assertSafePublicUrl(rawUrl, options);
  const timeoutMs = options?.timeoutMs ?? 8000;
  const followRedirects = options?.followRedirects ?? false;
  const maxRedirects = options?.maxRedirects ?? 5;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const parentSignal = init.signal;
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort();
    else parentSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    let current = parsed.toString();
    const hops = followRedirects ? maxRedirects : 0;

    for (let hop = 0; hop <= hops; hop++) {
      const res = await fetch(current, {
        ...init,
        redirect: "manual",
        signal: controller.signal,
      });

      const isRedirect = res.status >= 300 && res.status < 400;
      if (!isRedirect || hop === hops) {
        return res;
      }

      const location = res.headers.get("location");
      if (!location) return res;

      try {
        await res.body?.cancel();
      } catch {
        // Ignore cancel errors on unused redirect bodies.
      }

      const next = new URL(location, current).toString();
      assertSafePublicUrl(next, options);
      current = next;
    }

    throw new UnsafeUrlError("Too many redirects");
  } finally {
    clearTimeout(timeoutId);
  }
}
