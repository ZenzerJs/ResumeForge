export type SessionUser = {
  id: string;
  email: string;
  username: string;
};

export async function fetchSessionUser(): Promise<SessionUser | null> {
  try {
    const res = await fetch("/api/auth/me");
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

export async function signOutAndRedirect(path = "/") {
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
