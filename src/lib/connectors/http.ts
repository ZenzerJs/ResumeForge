import * as ipaddr from "ipaddr.js";

export const ALLOWED_HOSTS = new Set([
  "boards-api.greenhouse.io",
  "api.lever.co",
  "api.ashbyhq.com",
  "api.adzuna.com",
  "jobicy.com",
  "remotive.com",
  "remoteok.com",
]);

const BLOCKED_IP_RANGES = [
  "private",
  "loopback",
  "linkLocal",
  "uniqueLocal",
  "carrierGradeNat",
  "reserved",
  "broadcast",
];

export async function safeFetch(
  urlInput: string | URL,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const url = typeof urlInput === "string" ? new URL(urlInput) : urlInput;

  // 1. Protocol Validation
  if (url.protocol !== "https:") {
    throw new Error(`SSRF Blocked: Protocol "${url.protocol}" is disallowed. Only https: is permitted.`);
  }

  const hostname = url.hostname.toLowerCase();

  // 2. Direct IP Address Validation
  if (ipaddr.isValid(hostname)) {
    const parsedIp = ipaddr.parse(hostname);
    const range = parsedIp.range();
    if (BLOCKED_IP_RANGES.includes(range)) {
      throw new Error(`SSRF Blocked: Destination is a protected IP address (${hostname} - ${range}).`);
    }
  }

  // 3. Hostname Allowlist Check
  if (!ALLOWED_HOSTS.has(hostname)) {
    throw new Error(`SSRF Blocked: Host "${hostname}" is not allowlisted.`);
  }

  // 4. DNS Resolution & IP Range Check (Node.js runtime)
  try {
    const dns = await import("node:dns/promises");
    if (dns && typeof dns.resolve4 === "function") {
      const addresses = await dns.resolve4(hostname);
      for (const addr of addresses) {
        if (ipaddr.isValid(addr)) {
          const parsedIp = ipaddr.parse(addr);
          const range = parsedIp.range();
          if (BLOCKED_IP_RANGES.includes(range)) {
            throw new Error(`SSRF Blocked: Host "${hostname}" resolved to protected IP (${addr} - ${range}).`);
          }
        }
      }
    }
  } catch (err: any) {
    if (err?.message?.startsWith("SSRF Blocked:")) {
      throw err;
    }
    // If dns.resolve4 is unavailable in the environment, hostname allowlist still protects requests
  }

  // 5. Hardened Fetch Execution
  const timeoutMs = init?.timeoutMs ?? 10000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url.toString(), {
      ...init,
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "User-Agent": "ResumeForge-Sync/1.0 (+https://github.com/resumeforge)",
        Accept: "application/json",
        ...init?.headers,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}
