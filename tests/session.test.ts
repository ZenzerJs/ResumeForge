import { describe, it, expect } from "vitest";
import {
  createSessionToken,
  isPublicPath,
  cookieSecure,
  originAllowed,
  passwordsMatch,
  verifySessionToken,
} from "@/lib/security/session";

describe("session helpers", () => {
  it("creates and verifies a signed session token", async () => {
    const token = await createSessionToken("user-test-id");
    expect(token).toBeTruthy();
    expect(await verifySessionToken(token)).toBe(true);
    expect(await verifySessionToken("uid=x|exp=1.not-a-signature")).toBe(false);
  });

  it("matches the access password", () => {
    expect(passwordsMatch(process.env.APP_ACCESS_SECRET || "vitest-local-secret")).toBe(true);
    expect(passwordsMatch("wrong-password")).toBe(false);
  });

  it("treats wasm and typst font assets as public paths", () => {
    expect(isPublicPath("/wasm/typst_ts_web_compiler_bg.wasm")).toBe(true);
    expect(isPublicPath("/fonts/typst/NewCM10-Regular.otf")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/privacy")).toBe(true);
    expect(isPublicPath("/api/jobs")).toBe(false);
  });

  it("forces the Secure cookie flag in production and ignores x-forwarded-proto", () => {
    const env = process.env as { NODE_ENV?: string; NEXT_PUBLIC_APP_URL?: string };
    const previousEnv = env.NODE_ENV;
    const previousUrl = env.NEXT_PUBLIC_APP_URL;

    env.NODE_ENV = "production";
    env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(cookieSecure(new Request("http://localhost/api/auth/login"))).toBe(false);

    env.NEXT_PUBLIC_APP_URL = "https://resumeforge.app";
    expect(cookieSecure(new Request("http://localhost/api/auth/login"))).toBe(true);

    env.NEXT_PUBLIC_APP_URL = "not a url";
    expect(cookieSecure()).toBe(false);
    delete env.NEXT_PUBLIC_APP_URL;
    expect(cookieSecure()).toBe(false);

    env.NODE_ENV = previousEnv;
    if (previousUrl === undefined) delete env.NEXT_PUBLIC_APP_URL;
    else env.NEXT_PUBLIC_APP_URL = previousUrl;
  });

  it("allows mutations when Origin matches the Host header even if the server bound 0.0.0.0", () => {
    const request = new Request("http://0.0.0.0:3005/api/resumes/save-master", {
      method: "POST",
      headers: {
        origin: "http://localhost:3005",
        host: "localhost:3005",
      },
    });
    expect(originAllowed(request)).toBe(true);
  });

  it("rejects mutations from a different origin", () => {
    const request = new Request("http://0.0.0.0:3005/api/resumes/save-master", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        host: "localhost:3005",
      },
    });
    expect(originAllowed(request)).toBe(false);
  });

  it.each([
    "null",
    "",
    "not-a-url",
    "http://localhost.attacker.example:3005",
    "http://127.0.0.1.attacker.example:3005",
    "http://0.0.0.0.attacker.example:3005",
    "http://[::1]:3006",
    "https://localhost:3005",
    "ftp://localhost:3005",
  ])("rejects invalid or foreign origin %s", (origin) => {
    expect(originAllowed(new Request("http://localhost:3005/api/auth/login", {
      method: "POST",
      headers: { origin, host: "localhost:3005" },
    }))).toBe(false);
  });

  it.each(["http://127.0.0.1:3005", "http://[::1]:3005", "http://0.0.0.0:3005"])(
    "allows exact loopback alias %s on the same port",
    (origin) => {
      expect(originAllowed(new Request("http://localhost:3005/api/auth/login", {
        method: "POST",
        headers: { origin, host: "localhost:3005" },
      }))).toBe(true);
    }
  );

  it("validates HTTPS origins behind a TLS-terminating proxy", () => {
    expect(originAllowed(new Request("http://internal:3000/api/auth/login", {
      method: "POST",
      headers: {
        origin: "https://resumeforge.example",
        "x-forwarded-host": "resumeforge.example",
        "x-forwarded-proto": "https",
      },
    }))).toBe(true);
  });

  it("validates Referer when Origin is absent and permits non-browser requests", () => {
    expect(originAllowed(new Request("http://localhost:3005/api/auth/login"))).toBe(true);
    expect(originAllowed(new Request("http://localhost:3005/api/auth/login", {
      headers: { referer: "null" },
    }))).toBe(false);
    expect(originAllowed(new Request("http://localhost:3005/api/auth/login", {
      headers: { referer: "http://localhost:3005/login" },
    }))).toBe(true);
  });
});
