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

export async function createSessionToken(userId: string, now = Date.now()): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  if (!userId.trim()) return null;
  const payload = `uid=${encodeURIComponent(userId)}|exp=${now + SESSION_TTL_MS}`;
  const signature = await hmacSign(secret, payload);
  return `${payload}.${signature}`;
}

export type SessionPayload = { userId: string; exp: number };

export async function readSessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const secret = getSecret();
  if (!secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!(await hmacVerify(secret, payload, signature))) return null;
  const match = payload.match(/^uid=([^|]+)\|exp=(\d+)$/);
  if (!match) return null;
  const exp = Number(match[2]);
  if (!Number.isFinite(exp) || exp <= Date.now()) return null;
  const userId = decodeURIComponent(match[1]);
  if (!userId) return null;
  return { userId, exp };
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
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/wasm/") ||
    pathname.startsWith("/fonts/") ||
    pathname === "/icon" ||
    pathname === "/apple-icon" ||
    pathname === "/opengraph-image" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/favicon.ico"
  ) {
    return true;
  }
  return /\.(?:js|css|map|png|jpg|jpeg|gif|svg|webp|woff2?|ttf|otf|ico|txt|wasm)$/i.test(pathname);
}

export function isMutationMethod(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

function headerHost(request: Request): string | null {
  const host = (request.headers.get("host") || "").split(",")[0].trim().toLowerCase();
  if (host) return host;
  try {
    return new URL(request.url).host.toLowerCase();
  } catch {
    return null;
  }
}

function urlHost(value: string): string | null {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

export function originAllowed(request: Request): boolean {
  const expectedHost = headerHost(request);
  if (!expectedHost) return false;

  const origin = request.headers.get("origin");
  if (!origin) {
    // Same-origin navigations and some clients omit Origin.
    const referer = request.headers.get("referer");
    if (!referer) return true;
    return urlHost(referer) === expectedHost;
  }
  return urlHost(origin) === expectedHost;
}

export { fromBase64Url };
