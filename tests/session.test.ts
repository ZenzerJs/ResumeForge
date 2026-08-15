import { describe, it, expect } from "vitest";
import {
  createSessionToken,
  isPublicPath,
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
});
