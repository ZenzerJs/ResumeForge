import { afterEach, describe, expect, it } from "vitest";
import {
  clientKey,
  rateLimit,
  rateLimitBucketCount,
  resetRateLimitsForTests,
} from "@/lib/security/rate-limit";

describe("rate limit client key", () => {
  afterEach(() => {
    resetRateLimitsForTests();
  });

  it("uses the closest proxy hop, not the client-supplied left entry", () => {
    const request = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(clientKey(request, "auth")).toBe("auth:5.6.7.8");
  });

  it("falls back to x-real-ip when forwarded is absent", () => {
    const request = new Request("http://localhost/api/auth/login", {
      headers: { "x-real-ip": "9.9.9.9" },
    });
    expect(clientKey(request, "auth")).toBe("auth:9.9.9.9");
  });

  it("keeps the live bucket map capped", () => {
    for (let i = 0; i < 1005; i++) {
      expect(rateLimit(`cap:${i}`, 5, 60_000)).toBe(true);
    }
    expect(rateLimitBucketCount()).toBeLessThanOrEqual(1000);
    expect(rateLimit("cap:fresh", 5, 60_000)).toBe(true);
    expect(rateLimitBucketCount()).toBeLessThanOrEqual(1000);
  });
});
