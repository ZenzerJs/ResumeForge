import * as ipaddr from "ipaddr.js";

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

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
}

export function isPublicIpAddress(address: string): boolean {
  const normalized = normalizeHostname(address);
  // process() converts IPv4-mapped IPv6 before classifying the address.
  return ipaddr.isValid(normalized) && ipaddr.process(normalized).range() === "unicast";
}

function hostnameIsBlocked(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  if (BLOCKED_HOSTS.has(host)) return true;
  if (ipaddr.isValid(host)) return !isPublicIpAddress(host);
  return host.endsWith(".localhost") || host.endsWith(".internal");
}

export function isLocalDevHost(hostname: string): boolean {
  const host = normalizeHostname(hostname);
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

  const allowLocalhost = options?.allowLocalhost ?? false;

  if (parsed.protocol !== "https:") {
    if (!(allowLocalhost && parsed.protocol === "http:" && isLocalDevHost(parsed.hostname))) {
      throw new UnsafeUrlError("Only HTTPS URLs are allowed");
    }
  }

  if (parsed.username || parsed.password) {
    throw new UnsafeUrlError("URLs with credentials are not allowed");
  }

  if (options?.allowedHosts && options.allowedHosts.length > 0) {
    const allowed = new Set(options.allowedHosts.map(normalizeHostname));
    if (!allowed.has(normalizeHostname(parsed.hostname))) {
      throw new UnsafeUrlError(`Host ${parsed.hostname} is not on the import allowlist`);
    }
  }

  if (!(allowLocalhost && isLocalDevHost(parsed.hostname)) && hostnameIsBlocked(parsed.hostname)) {
    throw new UnsafeUrlError("Private or loopback hosts are not allowed");
  }

  return parsed;
}
