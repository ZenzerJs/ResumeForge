export type SessionUser = {
  id: string;
  email: string;
  username: string;
};

export type SessionPayload = {
  data?: SessionUser | null;
  guest?: boolean;
};

const SESSION_TTL_MS = 3000;
let inflight: Promise<SessionPayload> | null = null;
let fetchedAt = 0;

/** One shared /api/auth/me request per page load (nav, banner, and shell all read it). */
export function fetchSessionPayload(): Promise<SessionPayload> {
  if (inflight && Date.now() - fetchedAt < SESSION_TTL_MS) return inflight;
  fetchedAt = Date.now();
  inflight = fetch("/api/auth/me")
    .then((res) => res.json() as Promise<SessionPayload>)
    .catch(() => ({ data: null, guest: true }) as SessionPayload);
  return inflight;
}

export async function fetchSessionUser(): Promise<SessionUser | null> {
  const json = await fetchSessionPayload();
  return json?.data ?? null;
}

export async function signOutAndRedirect(path = "/") {
  inflight = null;
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } finally {
    window.location.assign(path);
  }
}

export function usernameInitial(username: string): string {
  const trimmed = username.trim();
  return trimmed ? trimmed[0]!.toUpperCase() : "R";
}
