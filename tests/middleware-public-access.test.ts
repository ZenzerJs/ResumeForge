import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware, HEAVY_ENDPOINT_LIMITS } from "@/middleware";
import { isPublicPath } from "@/lib/security/session";
import { resetRateLimitsForTests } from "@/lib/security/rate-limit";

describe("Middleware & Public Path Access for Jobs Board & Practice", () => {
  beforeEach(() => {
    resetRateLimitsForTests();
  });
  it("allows unauthenticated guest access to all tracker and job feed routes", () => {
    expect(isPublicPath("/tracker")).toBe(true);
    expect(isPublicPath("/tracker/feed")).toBe(true);
    expect(isPublicPath("/tracker/saved")).toBe(true);
    expect(isPublicPath("/tracker/applied")).toBe(true);
    expect(isPublicPath("/discover")).toBe(true);
    expect(isPublicPath("/terms")).toBe(true);
    expect(isPublicPath("/privacy")).toBe(true);
  });

  it("allows unauthenticated guest access to public job connectors and public APIs", () => {
    expect(isPublicPath("/api/connectors/jobs")).toBe(true);
    expect(isPublicPath("/api/connectors/status")).toBe(true);
    expect(isPublicPath("/api/jobs/sample-123/interview-prep")).toBe(true);
  });

  it("allows access to new /practice interactive workspace", () => {
    expect(isPublicPath("/practice")).toBe(true);
    expect(isPublicPath("/practice/two-sum")).toBe(true);
  });

  it("still gates private user routes and state mutations appropriately", () => {
    expect(isPublicPath("/editor")).toBe(false);
    expect(isPublicPath("/library")).toBe(false);
    expect(isPublicPath("/api/resumes")).toBe(false);
    expect(isPublicPath("/api/evidence")).toBe(false);
    expect(isPublicPath("/api/practice/execute")).toBe(false);
    expect(isPublicPath("/api/practice/problems")).toBe(false);
  });

  it("rate limits /api/jobs/hydrate (10/min) and dynamic /api/jobs/[id]/fetch-fulltext (15/min across IDs)", async () => {
    expect(HEAVY_ENDPOINT_LIMITS["/api/jobs/hydrate"]).toEqual({ limit: 10, windowMs: 60_000 });

    for (let i = 0; i < 10; i++) {
      const res = await middleware(
        new NextRequest("http://localhost:3000/api/jobs/hydrate", {
          method: "POST",
          headers: { "x-forwarded-for": "198.51.100.10" },
        })
      );
      expect(res.status).toBe(200);
    }
    const blockedHydrate = await middleware(
      new NextRequest("http://localhost:3000/api/jobs/hydrate", {
        method: "POST",
        headers: { "x-forwarded-for": "198.51.100.10" },
      })
    );
    expect(blockedHydrate.status).toBe(429);

    for (let i = 0; i < 15; i++) {
      const res = await middleware(
        new NextRequest(`http://localhost:3000/api/jobs/job-${i}/fetch-fulltext`, {
          method: "POST",
          headers: { "x-forwarded-for": "198.51.100.11" },
        })
      );
      expect(res.status).toBe(200);
    }
    const blockedFetchFulltext = await middleware(
      new NextRequest("http://localhost:3000/api/jobs/job-different-99/fetch-fulltext", {
        method: "POST",
        headers: { "x-forwarded-for": "198.51.100.11" },
      })
    );
    expect(blockedFetchFulltext.status).toBe(429);
  });
});
