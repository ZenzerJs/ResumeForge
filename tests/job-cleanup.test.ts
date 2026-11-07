import { describe, expect, it, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { isBoardEligible, postingTime, stablePostingDate, jobMaxAgeDays } from "@/lib/jobs/expiry";
import { POST } from "@/app/api/jobs/cleanup/route";
import * as jobs from "@/lib/db/jobs";
import { cleanupStalePositions } from "@/lib/db/jobs";

const now = new Date("2026-10-21T12:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);

afterEach(() => { delete process.env.JOB_BOARD_MAX_AGE_DAYS; delete process.env.JOB_SYNC_SECRET; vi.restoreAllMocks(); });

describe("job board expiry", () => {
  it("uses strict 60 and 30 day boundaries", () => {
    expect(jobMaxAgeDays()).toBe(60);
    expect(isBoardEligible(null, ago(60), now)).toBe(true);
    expect(isBoardEligible(null, ago(60.01), now)).toBe(false);
    process.env.JOB_BOARD_MAX_AGE_DAYS = "30";
    expect(isBoardEligible(null, ago(30), now)).toBe(true);
    expect(isBoardEligible(null, ago(30.01), now)).toBe(false);
  });
  it("anchors relative dates and falls back for missing or future dates", () => {
    expect(postingTime("3 days ago", ago(10), now)).toEqual(ago(13));
    expect(postingTime(null, ago(10), now)).toEqual(ago(10));
    expect(postingTime("2099-01-01", ago(10), now)).toEqual(ago(10));
    expect(isBoardEligible(ago(5).toISOString(), ago(90), now)).toBe(true);
  });
  it("only refreshes an existing posting for a newer valid absolute date", () => {
    expect(stablePostingDate(null, ago(80).toISOString(), ago(10), now)).toBe(ago(80).toISOString());
    expect(stablePostingDate("3 days ago", "1 day ago", ago(90), now)).toBe("3 days ago");
    expect(stablePostingDate("3 days ago", null, ago(90), now)).toBe("3 days ago");
    expect(stablePostingDate("3 days ago", "2099-01-01", ago(90), now)).toBe("3 days ago");
    expect(stablePostingDate("3 days ago", ago(2).toISOString(), ago(90), now)).toBe(ago(2).toISOString());
  });
  it("requires authentication and reports failures without exposing details", async () => {
    process.env.JOB_SYNC_SECRET = "test-secret";
    expect((await POST(new NextRequest("http://localhost/api/jobs/cleanup", { method: "POST" }))).status).toBe(401);
    vi.spyOn(jobs, "cleanupStalePositions").mockRejectedValueOnce(new Error("private failure"));
    const response = await POST(new NextRequest("http://localhost/api/jobs/cleanup", { method: "POST", headers: { Authorization: "Bearer test-secret" } }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, error: "Position cleanup failed" });
  });
  it("never deletes records and gives identical repeated audits", async () => {
    const first = await cleanupStalePositions({ now, dryRun: true });
    const second = await cleanupStalePositions({ now, dryRun: true });
    expect(first).toEqual(second);
    expect(first.totalDeleted).toBe(0);
  });
});
