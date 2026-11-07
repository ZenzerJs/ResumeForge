import { lookup } from "node:dns";
import type { LookupFunction } from "node:net";
import { Agent } from "undici";
import { assertSafePublicUrl, isLocalDevHost, isPublicIpAddress, UnsafeUrlError } from "./safe-url";

export { assertSafePublicUrl, isSafeHref, UnsafeUrlError } from "./safe-url";

// Validate addresses in the socket's own lookup, so a second DNS resolution
// cannot rebind a previously checked public hostname to a private address.
const publicLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) {
      callback(error, "", 0);
      return;
    }
    if (addresses.length === 0 || addresses.some(({ address }) => !isPublicIpAddress(address))) {
      callback(new UnsafeUrlError("Host resolved to a private or reserved address"), "", 0);
      return;
    }
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
};

const publicDispatcher = new Agent({ connect: { lookup: publicLookup } });

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
  const onAbort = () => controller.abort(parentSignal?.reason);
  if (parentSignal) {
    if (parentSignal.aborted) onAbort();
    else parentSignal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    let current = parsed.toString();
    const hops = followRedirects ? maxRedirects : 0;

    for (let hop = 0; hop <= hops; hop++) {
      const allowLocalhost = options?.allowLocalhost ?? process.env.NODE_ENV !== "production";
      const fetchInit = {
        ...init,
        redirect: "manual" as const,
        signal: controller.signal,
        dispatcher: allowLocalhost && isLocalDevHost(new URL(current).hostname)
          ? undefined
          : publicDispatcher,
      };
      const res = await fetch(current, fetchInit);

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
    parentSignal?.removeEventListener("abort", onAbort);
  }
}
