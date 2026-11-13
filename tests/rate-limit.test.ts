import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clientKey,
  NAMESPACE_QUOTAS,
  rateLimit,
  rateLimitBucketCount,
  resetRateLimitsForTests,
} from "@/lib/security/rate-limit";
import { middleware } from "@/middleware";
import { NextRequest } from "next/server";

describe("rate limit client key and namespace quotas", () => {
  afterEach(() => {
    resetRateLimitsForTests();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("ignores spoofed forwarded headers in direct deployment and uses shared fallback", () => {
    vi.stubEnv("TRUST_PROXY", "false");
    vi.stubEnv("VERCEL", "");
    const req1 = new Request("http://localhost/api/auth/login", {
      headers: {
        "x-forwarded-for": "1.2.3.4, 5.6.7.8",
        "x-real-ip": "9.9.9.9",
        "x-vercel-forwarded-for": "8.8.8.8",
      },
    });
    const req2 = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.55" },
    });
    expect(clientKey(req1, "auth")).toBe("auth:direct");
    expect(clientKey(req2, "auth")).toBe("auth:direct");
  });

  it("uses closest proxy hop and x-real-ip fallback only when TRUST_PROXY is enabled", () => {
    vi.stubEnv("TRUST_PROXY", "true");
    const forwardedReq = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(clientKey(forwardedReq, "auth")).toBe("auth:5.6.7.8");

    const realIpReq = new Request("http://localhost/api/auth/login", {
      headers: { "x-real-ip": "9.9.9.9" },
    });
    expect(clientKey(realIpReq, "auth")).toBe("auth:9.9.9.9");
  });

  it("trusts ingress-overwritten IP on verified Vercel platform ingress", () => {
    vi.stubEnv("VERCEL", "1");
    const req = new Request("http://localhost/api/auth/login", {
      headers: { "x-vercel-forwarded-for": "198.51.100.77" },
    });
    expect(clientKey(req, "auth")).toBe("auth:198.51.100.77");
  });

  it("bounds finite explicit namespace quotas to the 1,000 bucket cap", () => {
    const sum = Object.values(NAMESPACE_QUOTAS).reduce((acc, q) => acc + q, 0);
    expect(sum).toBe(1000);

    for (let i = 0; i < 1005; i++) {
      expect(rateLimit(`ai:${i}`, 5, 60_000)).toBe(true);
    }
    expect(rateLimitBucketCount()).toBeLessThanOrEqual(NAMESPACE_QUOTAS.ai);
    expect(rateLimit("ai:fresh", 5, 60_000)).toBe(true);
    expect(rateLimitBucketCount()).toBeLessThanOrEqual(1000);
  });

  it("preserves an active auth lockout and 429/reset behavior when another namespace is flooded", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-13T12:00:00Z"));
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ACCESS_SECRET", "prod-secret");
    vi.stubEnv("TRUST_PROXY", "false");

    // Exhaust auth limit (10/min in prod) for direct client
    for (let i = 0; i < 10; i++) {
      const res = await middleware(
        new NextRequest("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { origin: "http://localhost:3000", host: "localhost:3000" },
        })
      );
      expect(res.status).not.toBe(429);
    }
    const locked = await middleware(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { origin: "http://localhost:3000", host: "localhost:3000" },
      })
    );
    expect(locked.status).toBe(429);

    // Flood another namespace with distinct keys beyond its quota
    for (let i = 0; i < 500; i++) {
      expect(rateLimit(`ai:attacker-${i}`, 5, 60_000)).toBe(true);
    }
    expect(rateLimitBucketCount()).toBeLessThanOrEqual(1000);

    // Auth lockout must still hold
    const stillLocked = await middleware(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { origin: "http://localhost:3000", host: "localhost:3000" },
      })
    );
    expect(stillLocked.status).toBe(429);

    // After window expiry, auth resets cleanly
    vi.advanceTimersByTime(60_001);
    const resetRes = await middleware(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { origin: "http://localhost:3000", host: "localhost:3000" },
      })
    );
    expect(resetRes.status).not.toBe(429);
  });
});
