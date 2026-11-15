const COOKIE_NAME = "rf_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getSecret(): string | null {
  const secret = process.env.APP_ACCESS_SECRET?.trim();
  return secret && secret.length >= 8 ? secret : null;
}

export function getAppAccessSecret(): string | null {
  return getSecret();
}

export function getSessionCookieName(): string {
  return COOKIE_NAME;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function hmacSign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

async function hmacVerify(secret: string, payload: string, signature: string): Promise<boolean> {
  const expected = await hmacSign(secret, payload);
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function createSessionToken(
  userId: string,
  now = Date.now(),
  sessionVersion = 0
): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  if (!userId.trim()) return null;
  const version = Number.isInteger(sessionVersion) && sessionVersion >= 0 ? sessionVersion : 0;
  const payload = `uid=${encodeURIComponent(userId)}|exp=${now + SESSION_TTL_MS}|sv=${version}`;
  const signature = await hmacSign(secret, payload);
  return `${payload}.${signature}`;
}

export type SessionPayload = { userId: string; exp: number; sessionVersion: number };

export async function readSessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const secret = getSecret();
  if (!secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!(await hmacVerify(secret, payload, signature))) return null;
  const match = payload.match(/^uid=([^|]+)\|exp=(\d+)(?:\|sv=(\d+))?$/);
  if (!match) return null;
  const exp = Number(match[2]);
  if (!Number.isFinite(exp) || exp <= Date.now()) return null;
  const userId = decodeURIComponent(match[1]);
  if (!userId) return null;
  const sessionVersion = match[3] === undefined ? 0 : Number(match[3]);
  if (!Number.isInteger(sessionVersion)) return null;
  return { userId, exp, sessionVersion };
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  return Boolean(await readSessionToken(token));
}

export function passwordsMatch(provided: string): boolean {
  const secret = getSecret();
  if (!secret) return false;
  const expected = process.env.APP_ACCESS_PASSWORD?.trim() || secret;
  if (provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * `Secure` follows `NEXT_PUBLIC_APP_URL` when configured as HTTPS, and otherwise
 * falls back to the request's TLS-terminating proxy (`x-forwarded-proto`) or
 * request URL scheme so Vercel Previews and reverse proxies receive `Secure`
 * cookies even when `NEXT_PUBLIC_APP_URL` is unset.
 */
export function cookieSecure(request?: Request): boolean {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    try {
      if (new URL(appUrl).protocol === "https:") return true;
    } catch {
      // Fall through to request-derived scheme when NEXT_PUBLIC_APP_URL is invalid.
    }
  }
  if (!request) return false;
  const forwardedProto = (request.headers.get("x-forwarded-proto") || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (forwardedProto) {
    return forwardedProto === "https";
  }
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function buildSessionCookie(token: string, secure: boolean): string {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function buildClearedSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function isPublicPath(pathname: string): boolean {
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/discover" ||
    pathname === "/practice" ||
    pathname.startsWith("/practice/") ||
    pathname === "/interview" ||
    pathname.startsWith("/interview/") ||
    pathname === "/tracker" ||
    pathname.startsWith("/tracker/") ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/connectors/jobs" ||
    pathname === "/api/connectors/status" ||
    (pathname.startsWith("/api/jobs/") && pathname.endsWith("/interview-prep")) ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/wasm/") ||
    pathname.startsWith("/fonts/") ||
    pathname.startsWith("/workers/") ||
    pathname === "/icon" ||
    pathname === "/apple-icon" ||
    pathname === "/opengraph-image" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/favicon.ico"
  ) {
    return true;
  }
  return /\.(?:js|mjs|css|map|png|jpg|jpeg|gif|svg|webp|woff2?|ttf|otf|ico|txt|wasm)$/i.test(pathname);
}

export function isMutationMethod(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

function headerHost(request: Request): string | null {
  const fwd = (request.headers.get("x-forwarded-host") || "").split(",")[0].trim().toLowerCase();
  if (fwd) return fwd;
  const host = (request.headers.get("host") || "").split(",")[0].trim().toLowerCase();
  if (host) return host;
  try {
    return new URL(request.url).host.toLowerCase();
  } catch {
    return null;
  }
}

function httpUrl(value: string): URL | null {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function originAllowed(request: Request): boolean {
  const expectedHost = headerHost(request);
  if (!expectedHost) return false;

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (origin === null && referer === null) return true; // Non-browser clients
  const target = httpUrl(origin ?? referer ?? "");
  if (!target) return false;

  const forwardedProto = (request.headers.get("x-forwarded-proto") || "").split(",")[0].trim();
  const protocol = forwardedProto ? `${forwardedProto}:` : new URL(request.url).protocol;
  const expected = httpUrl(`${protocol}//${expectedHost}`);
  if (!expected || target.protocol !== expected.protocol) return false;
  if (target.host === expected.host) return true;

  // Localhost / Loopback aliases handling (localhost:3000 vs 127.0.0.1:3000 vs 0.0.0.0:3000)
  const isLoopback = (hostname: string) =>
    ["localhost", "127.0.0.1", "[::1]", "0.0.0.0"].includes(hostname);

  if (isLoopback(expected.hostname) && isLoopback(target.hostname)) {
    return expected.port === target.port;
  }

  return false;
}

export { fromBase64Url };
