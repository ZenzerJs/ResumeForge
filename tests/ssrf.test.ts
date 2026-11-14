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

  it.each([
    "https://[::ffff:127.0.0.1]/",
    "https://[::ffff:10.0.0.1]/",
    "https://[::]/",
    "https://[fe90::1]/",
    "https://[fd00::1]/",
    "https://[ff02::1]/",
    "https://localhost./",
    "https://service.localhost./",
    "https://metadata.google.internal./",
    "https://100.64.0.1/",
    "https://198.18.0.1/",
    "https://224.0.0.1/",
    "https://2130706433/",
  ])("rejects private and reserved destination %s", (url) => {
    expect(() => assertSafePublicUrl(url, { allowLocalhost: false })).toThrow(UnsafeUrlError);
  });

  it.each([
    "https://8.8.8.8/",
    "https://[2001:4860:4860::8888]/",
    "https://fc-public.example/",
    "https://fd-public.example/",
  ])("allows public destination %s", (url) => {
    expect(() => assertSafePublicUrl(url, { allowLocalhost: false })).not.toThrow();
  });

  it("allows only explicit loopback development destinations", () => {
    expect(() => assertSafePublicUrl("http://[::1]:11434/v1", { allowLocalhost: true })).not.toThrow();
    expect(() => assertSafePublicUrl("https://10.0.0.1/", { allowLocalhost: true })).toThrow(UnsafeUrlError);
  });

  it("isSafeHref accepts http(s) and rejects javascript", () => {
    expect(isSafeHref("https://example.com/apply")).toBe(true);
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("")).toBe(false);
  });
});
