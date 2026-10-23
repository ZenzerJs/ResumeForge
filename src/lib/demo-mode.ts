export function isDemoMode(): boolean {
  return process.env.DEMO_MODE?.trim().toLowerCase() === "true";
}

const DEMO_SAFE_POST_PATHS = new Set([
  "/api/auth/signup",
  "/api/ai/byok-proxy",
  "/api/ai/test-connection",
  "/api/ai/qualitative-review",
  "/api/demo/generate-patches",
  "/api/demo/generate-cover-letter",
  "/api/resumes/upload-pdf",
  "/api/ai/repair-typst",
  "/api/jobs/extract",
  "/api/ats/evaluate",
]);

const DEMO_OPERATOR_PATHS = new Set([
  "/api/jobs/cleanup",
  "/api/jobs/sync-pittcsc",
]);

export function demoAllowsMutation(pathname: string): boolean {
  if (!isDemoMode()) return true;
  if (pathname === "/api/auth/login" || pathname === "/api/auth/logout") return true;
  if (DEMO_OPERATOR_PATHS.has(pathname)) return true;
  return DEMO_SAFE_POST_PATHS.has(pathname);
}

export function demoConfig() {
  return {
    demoMode: isDemoMode(),
    signupEnabled: !isDemoMode(),
    persistence: isDemoMode() ? "browser-local" : "database",
    ai: isDemoMode() ? "visitor-byok" : "byok-or-self-host-provider",
  } as const;
}
