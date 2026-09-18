import { describe, it, expect } from "vitest";
import { isPublicPath } from "@/lib/security/session";

describe("Middleware & Public Path Access for Jobs Board & Practice", () => {
  it("allows unauthenticated guest access to all tracker and job feed routes", () => {
    expect(isPublicPath("/tracker")).toBe(true);
    expect(isPublicPath("/tracker/feed")).toBe(true);
    expect(isPublicPath("/tracker/saved")).toBe(true);
    expect(isPublicPath("/tracker/applied")).toBe(true);
    expect(isPublicPath("/discover")).toBe(true);
    expect(isPublicPath("/terms")).toBe(true);
    expect(isPublicPath("/privacy")).toBe(true);
  });

  it("allows unauthenticated guest access to public job connectors and practice APIs", () => {
    expect(isPublicPath("/api/connectors/jobs")).toBe(true);
    expect(isPublicPath("/api/connectors/status")).toBe(true);
    expect(isPublicPath("/api/practice/problems")).toBe(true);
    expect(isPublicPath("/api/practice/execute")).toBe(true);
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
  });
});
