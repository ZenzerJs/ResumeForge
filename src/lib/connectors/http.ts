import { safeFetch as securitySafeFetch } from "@/lib/security/safe-fetch";

export const ALLOWED_HOSTS = new Set([
  "boards-api.greenhouse.io",
  "api.lever.co",
  "api.ashbyhq.com",
  "api.adzuna.com",
  "jobicy.com",
  "remotive.com",
  "remoteok.com",
]);

export async function safeFetch(
  urlInput: string | URL,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const rawUrl = typeof urlInput === "string" ? urlInput : urlInput.toString();
  const { timeoutMs, headers, ...restInit } = init ?? {};

  const mergedHeaders = new Headers({
    "User-Agent": "ResumeForge-Sync/1.0 (+https://github.com/resumeforge)",
    Accept: "application/json",
  });
  if (headers) {
    new Headers(headers).forEach((value, key) => {
      mergedHeaders.set(key, value);
    });
  }

  return securitySafeFetch(
    rawUrl,
    {
      ...restInit,
      headers: mergedHeaders,
    },
    {
      allowLocalhost: false,
      allowedHosts: Array.from(ALLOWED_HOSTS),
      timeoutMs: timeoutMs ?? 10_000,
      followRedirects: false,
    }
  );
}
