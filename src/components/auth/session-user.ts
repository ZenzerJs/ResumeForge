export type SessionUser = {
  id: string;
  email: string;
  username: string;
};

export type SessionPayload = {
  data?: SessionUser | null;
  guest?: boolean;
  error?: boolean;
};

const SESSION_TTL_MS = 3000;
let inflight: Promise<SessionPayload> | null = null;
let fetchedAt = 0;

export type DemoConfig = {
  demoMode: boolean;
  signupEnabled?: boolean;
  persistence?: string;
  ai?: string;
};

const DEMO_CONFIG_TTL_MS = 30_000;
const DEFAULT_DEMO_CONFIG: DemoConfig = { demoMode: false, signupEnabled: true };
let demoInflight: Promise<DemoConfig> | null = null;
let demoFetchedAt = 0;

/** One shared /api/demo-config request across nav, shell, and workspace callers. */
export function fetchDemoConfig(): Promise<DemoConfig> {
  if (demoInflight && Date.now() - demoFetchedAt < DEMO_CONFIG_TTL_MS) return demoInflight;
  demoFetchedAt = Date.now();
  demoInflight = fetch("/api/demo-config")
    .then(async (res) => (res.ok ? ((await res.json()) as DemoConfig) : DEFAULT_DEMO_CONFIG))
    .catch(() => DEFAULT_DEMO_CONFIG);
  return demoInflight;
}

export function resetDemoConfigCache(): void {
  demoInflight = null;
  demoFetchedAt = 0;
}

/** One shared /api/auth/me request per page load (nav, banner, and shell all read it). */
export function fetchSessionPayload(): Promise<SessionPayload> {
  if (inflight && Date.now() - fetchedAt < SESSION_TTL_MS) return inflight;
  fetchedAt = Date.now();
  const request = fetch("/api/auth/me")
    .then(async (res) => {
      if (!res.ok) {
        if (inflight === request) inflight = null;
        return { data: null, guest: false, error: true } as SessionPayload;
      }
      return (await res.json()) as SessionPayload;
    })
    .catch(() => {
      if (inflight === request) inflight = null;
      return { data: null, guest: false, error: true } as SessionPayload;
    });
  inflight = request;
  return request;
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
