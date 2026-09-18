import { describe, it, expect } from "vitest";
import { assertSafePublicUrl, isSafeHref, UnsafeUrlError } from "@/lib/security/safe-fetch";

describe("safe-fetch SSRF guards", () => {
  it("rejects loopback and metadata hosts", () => {
    expect(() =>
      assertSafePublicUrl("http://127.0.0.1/secret", { allowLocalhost: false })
    ).toThrow(UnsafeUrlError);
    expect(() =>
      assertSafePublicUrl("http://169.254.169.254/latest/meta-data", { allowLocalhost: false })
    ).toThrow(UnsafeUrlError);
    expect(() =>
      assertSafePublicUrl("https://localhost/admin", { allowLocalhost: false })
    ).toThrow(UnsafeUrlError);
  });

  it("allows public HTTPS URLs", () => {
    const parsed = assertSafePublicUrl("https://boards.greenhouse.io/example");
    expect(parsed.hostname).toBe("boards.greenhouse.io");
  });

  it("isSafeHref accepts http(s) and rejects javascript", () => {
    expect(isSafeHref("https://example.com/apply")).toBe(true);
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("")).toBe(false);
  });
});
